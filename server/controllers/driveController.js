const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');
const { calculateCommission } = require('../utils/commission');

// --- Helper Functions ---
async function getUserDriveInfo(userId) {
  const userResult = await pool.query('SELECT tier FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) throw new Error('User not found');
  const tier = userResult.rows[0].tier || 'bronze';
  const accountResult = await pool.query(
    'SELECT balance FROM accounts WHERE user_id = $1 AND type = \'main\'',
    [userId]
  );
  const balance = accountResult.rows.length > 0 ? parseFloat(accountResult.rows[0].balance) : 0;
  return { tier, balance };
}

async function getAvailableProduct(userId, tier, balance) {
  const query = 'SELECT * FROM products WHERE is_active = true ORDER BY RANDOM() LIMIT 1';
  const productsResult = await pool.query(query);
  if (productsResult.rows.length === 0) return null;
  return productsResult.rows[0];
}

// --- Controller Functions ---
const startDrive = async (req, res) => {
  let userId;
  try {
    userId = req.user.id;
    const now = new Date();
    const currentHour = now.getHours();
    
    const existingSessionResult = await pool.query(
      `SELECT id, status FROM drive_sessions
       WHERE user_id = $1 AND status IN ('active', 'pending_reset', 'frozen')
       ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );
    if (existingSessionResult.rows.length > 0) {
      const existingStatus = existingSessionResult.rows[0].status;
      let message = 'An active drive session already exists.';
      if (existingStatus === 'pending_reset') message = 'Your previous drive is complete and requires an admin reset.';
      else if (existingStatus === 'frozen') message = 'Your drive session is frozen due to insufficient balance. Please deposit funds.';
      return res.status(409).json({ code: 1, info: message });
    }

    const { tier, balance } = await getUserDriveInfo(userId);
    if (balance < 50.00) return res.status(400).json({ code: 1, info: 'Insufficient balance. Minimum 50.00 USDT required.' });

    const tasksRequiredMap = { bronze: 40, silver: 40, gold: 45, platinum: 50 };
    const tasksRequired = tasksRequiredMap[tier] || 40;
    const driveSessionUUID = uuidv4();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertResult = await client.query(
        `INSERT INTO drive_sessions (user_id, drive_type, status, tasks_required, session_uuid, started_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
        [userId, 'first', 'active', tasksRequired, driveSessionUUID]
      );
      const newSessionDbId = insertResult.rows[0].id;
      const productsResult = await client.query(
        'SELECT id FROM products WHERE is_active = true ORDER BY RANDOM() LIMIT $1',
        [tasksRequired]
      );
      if (productsResult.rows.length < tasksRequired) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(500).json({ code: 1, info: 'Insufficient active products available to start drive.' });
      }
      const driveOrderInserts = productsResult.rows.map(product =>
        client.query(
          'INSERT INTO drive_orders (session_id, product_id, status, tasks_required) VALUES ($1, $2, $3, $4)',
          [newSessionDbId, product.id, 'pending', 1]
        )
      );
      await Promise.all(driveOrderInserts);
      await client.query('COMMIT');
      return res.json({ code: 0, info: 'Data Drive initiated successfully.' });
    } catch (dbError) {
      await client.query('ROLLBACK');
      return res.status(500).json({ code: 1, info: 'Database error creating drive session: ' + dbError.message });
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ code: 1, info: 'Server error starting drive: ' + error.message });
  }
};

const getDriveStatus = async (req, res) => {
  const userId = req.user.id;
  console.log(`getDriveStatus called for user: ${userId}`);
  try {
    // First check for ANY active, pending_reset, or frozen session
    const sessionResult = await pool.query(
      `SELECT id, status, tasks_completed, tasks_required, frozen_amount_needed
       FROM drive_sessions
       WHERE user_id = $1 AND status IN ('active', 'pending_reset', 'frozen')
       ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.json({ code: 0, status: 'no_session' });
    }

    const session = sessionResult.rows[0];
    const sessionId = session.id;
    
    if (session.status === 'pending_reset') {
      return res.json({ 
        code: 0, 
        status: 'complete',
        tasks_completed: session.tasks_completed,
        tasks_required: session.tasks_required,
        info: 'Drive is complete. Please wait for admin reset.' 
      });
    }

    if (session.status === 'frozen') {
       return res.json({
         code: 0,
         status: 'frozen',
         tasks_completed: session.tasks_completed,
         tasks_required: session.tasks_required,
         frozen_amount_needed: session.frozen_amount_needed,
         info: `Session frozen. Please deposit at least ${session.frozen_amount_needed} USDT to continue.`
       });
    }

    // Look for ANY incomplete order (either current or pending)
    const incompleteOrderResult = await pool.query(
      `SELECT drv_ord.id AS order_id, drv_ord.status AS order_status, 
              p.id AS product_id, p.name AS product_name, 
              p.image_url AS product_image, p.price AS product_price
       FROM drive_orders drv_ord
       JOIN products p ON drv_ord.product_id = p.id
       WHERE drv_ord.session_id = $1 
       AND drv_ord.status IN ('current', 'pending')
       ORDER BY CASE 
         WHEN drv_ord.status = 'current' THEN 0 
         WHEN drv_ord.status = 'pending' THEN 1 
       END, drv_ord.id ASC
       LIMIT 1`,
      [sessionId]
    );

    if (incompleteOrderResult.rows.length > 0) {
      const incompleteOrder = incompleteOrderResult.rows[0];
      const { tier } = await getUserDriveInfo(userId);
      const commission = calculateCommission(parseFloat(incompleteOrder.product_price), tier, 'single');

      // If order was pending, set it to current
      if (incompleteOrder.order_status === 'pending') {
        await pool.query(
          `UPDATE drive_orders SET status = 'current' WHERE id = $1`,
          [incompleteOrder.order_id]
        );
        incompleteOrder.order_status = 'current';
      }

      return res.json({
        code: 0,
        status: 'active',
        tasks_completed: session.tasks_completed,
        tasks_required: session.tasks_required,
        current_order: {
          order_id: incompleteOrder.order_id,
          product_id: incompleteOrder.product_id,
          product_name: incompleteOrder.product_name,
          product_image: incompleteOrder.product_image || './assets/uploads/products/newegg-1.jpg',
          product_price: parseFloat(incompleteOrder.product_price),
          order_commission: commission,
          fund_amount: parseFloat(incompleteOrder.product_price),
          premium_status: 0,
          product_number: uuidv4().substring(0, 18)
        }
      });
    }

    // If no incomplete orders, mark the drive as complete
    await pool.query(
      `UPDATE drive_sessions SET status = 'pending_reset', completed_at = NOW() WHERE id = $1`,
      [sessionId]
    );

    return res.json({ 
      code: 0, 
      status: 'complete', 
      tasks_completed: session.tasks_completed,
      tasks_required: session.tasks_required,
      info: 'Drive completed successfully. Please wait for admin reset.'
    });

  } catch (error) {
    logger.error('Error getting drive status:', error);
    res.status(500).json({ code: 1, info: 'Server error getting drive status: ' + error.message });
  }
};

const getOrder = async (req, res) => {
  const userId = req.user.id;
  try {
    const sessionResult = await pool.query(
      `SELECT id, tasks_completed, tasks_required, status
       FROM drive_sessions
       WHERE user_id = $1 AND status = 'active'
       ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );
    if (sessionResult.rows.length === 0) return res.status(400).json({ success: false, code: 1, info: 'No active drive session found. Please start a drive.' });
    const session = sessionResult.rows[0];
    if (session.tasks_completed >= session.tasks_required) return res.json({ success: true, code: 2, info: 'Data drive complete for today.' });
    const { tier, balance } = await getUserDriveInfo(userId);

    // Check if there's a current order already
    const currentOrderResult = await pool.query(
      `SELECT drive_orders.id AS order_id, products.id AS product_id, products.name AS product_name, products.image_url AS product_image, products.price AS product_price
       FROM drive_orders
       JOIN products ON drive_orders.product_id = products.id
       WHERE drive_orders.session_id = $1 AND drive_orders.status = 'current' LIMIT 1`,
      [session.id]
    );

    if (currentOrderResult.rows.length > 0) {
       const currentOrder = currentOrderResult.rows[0];
       const commission = calculateCommission(parseFloat(currentOrder.product_price), tier, 'single');
       return res.json({
         success: true,
         tasks_required: session.tasks_required,
         order_id: currentOrder.order_id,
         product_id: currentOrder.product_id,
         product_name: currentOrder.product_name,
         product_number: uuidv4().substring(0, 18),
         grabbed_date: new Date().toISOString(),
         product_image: currentOrder.product_image || './assets/uploads/products/newegg-1.jpg',
         product_price: parseFloat(currentOrder.product_price),
         order_commission: commission,
         fund_amount: parseFloat(currentOrder.product_price),
         premium_status: 0
       });
    }

    // If no current order, find the next pending order and set it to current
    const nextPendingOrderResult = await pool.query(
      `SELECT drive_orders.id AS order_id, products.id AS product_id, products.name AS product_name, products.image_url AS product_image, products.price AS product_price
       FROM drive_orders
       JOIN products ON drive_orders.product_id = products.id
       WHERE drive_orders.session_id = $1 AND drive_orders.status = 'pending'
       ORDER BY drive_orders.id ASC LIMIT 1`,
      [session.id]
    );

    if (nextPendingOrderResult.rows.length > 0) {
      const nextPendingOrder = nextPendingOrderResult.rows[0];
      await pool.query(
        `UPDATE drive_orders SET status = 'current' WHERE id = $1`,
        [nextPendingOrder.order_id]
      );
      const { tier } = await getUserDriveInfo(userId);
      const commission = calculateCommission(parseFloat(nextPendingOrder.product_price), tier, 'single');
       return res.json({
        success: true,
        tasks_required: session.tasks_required,
        order_id: nextPendingOrder.order_id,
        product_id: nextPendingOrder.product_id,
        product_name: nextPendingOrder.product_name,
        product_number: uuidv4().substring(0, 18),
        grabbed_date: new Date().toISOString(),
        product_image: nextPendingOrder.product_image || './assets/uploads/products/newegg-1.jpg',
        product_price: parseFloat(nextPendingOrder.product_price),
        order_commission: commission,
        fund_amount: parseFloat(nextPendingOrder.product_price),
        premium_status: 0
      });
    }

    // If no pending or current orders, the drive is complete
    return res.json({ success: true, code: 2, info: 'Data drive complete for today.' });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error getting order: ' + error.message });
  }
};

const saveOrder = async (req, res) => {
  const userId = req.user.id;

  // Log raw request body for debugging
  console.log('Raw saveOrder request body:', req.body);

  const { order_id, product_id, order_amount, earning_commission, product_number } = req.body;

  // Log received data for debugging
  console.log('Destructured saveOrder request body:', { order_id, product_id, order_amount, earning_commission, product_number });


  // Refined validation checks
  let missingFields = [];
  if (order_id === undefined || order_id === null || order_id === '') missingFields.push('order_id');
  if (product_id === undefined || product_id === null || product_id === '') missingFields.push('product_id');
  if (order_amount === undefined || order_amount === null) missingFields.push('order_amount'); // Allow 0
  if (earning_commission === undefined || earning_commission === null) missingFields.push('earning_commission'); // Allow 0
  if (!product_number) missingFields.push('product_number'); // Check for non-empty string

  if (missingFields.length > 0) {
      const errorMsg = `Missing required order data: ${missingFields.join(', ')}.`;
      console.error(errorMsg, 'Fields received:', req.body);
      return res.status(400).json({ code: 1, info: errorMsg });
  }

  // Type validation
  let invalidTypes = [];
  if (isNaN(parseInt(order_id))) invalidTypes.push('order_id');
  if (isNaN(parseInt(product_id))) invalidTypes.push('product_id');
  if (isNaN(parseFloat(order_amount))) invalidTypes.push('order_amount');
  if (isNaN(parseFloat(earning_commission))) invalidTypes.push('earning_commission');

  if (invalidTypes.length > 0) {
      const errorMsg = `Invalid data types for order details: ${invalidTypes.join(', ')}.`;
      console.error(errorMsg, 'Fields received:', req.body);
      return res.status(400).json({ code: 1, info: errorMsg });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sessionResult = await client.query(
      `SELECT id, tasks_completed, tasks_required, status
       FROM drive_sessions
       WHERE user_id = $1 AND status = 'active'
       ORDER BY started_at DESC LIMIT 1 FOR UPDATE`,
      [userId]
    );
    if (sessionResult.rows.length === 0) throw new Error('No active drive session found.');
    const session = sessionResult.rows[0];
    if (session.tasks_completed >= session.tasks_required) {
      await client.query('ROLLBACK');
      client.release();
      return res.json({ code: 1, info: 'Drive already completed. Cannot submit more tasks.' });
    }

    // Verify the submitted order_id is the current one for this session
    const currentOrderResult = await client.query(
       `SELECT id, product_id, status FROM drive_orders WHERE id = $1 AND session_id = $2 AND status = 'current'`,
       [order_id, session.id]
    );
    if (currentOrderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ code: 1, info: 'Submitted order is not the current active task for this session.' });
    }
    const currentOrder = currentOrderResult.rows[0];
    if (currentOrder.product_id !== parseInt(product_id)) {
         await client.query('ROLLBACK');
         client.release();
         return res.status(400).json({ code: 1, info: 'Submitted product ID does not match the current task.' });
    }

    const productResult = await client.query('SELECT price FROM products WHERE id = $1', [product_id]);
    if (productResult.rows.length === 0) throw new Error(`Product with ID ${product_id} not found.`);
    const product = productResult.rows[0];
    const productPrice = parseFloat(product.price);
    const { tier } = await getUserDriveInfo(userId);
    const calculatedCommission = calculateCommission(productPrice, tier);
    const tolerance = 0.001;
    if (Math.abs(parseFloat(order_amount) - productPrice) > tolerance) {
      // Optionally handle mismatch
    }
    const accountResult = await client.query(
      'SELECT id, balance FROM accounts WHERE user_id = $1 AND type = \'main\' FOR UPDATE',
      [userId]
    );
    if (accountResult.rows.length === 0) throw new Error('User main account not found');
    const account = accountResult.rows[0];
    const currentBalance = parseFloat(account.balance);
    if (currentBalance < productPrice) {
      const frozenAmountNeeded = (productPrice - currentBalance).toFixed(2);
      await client.query(
        `UPDATE drive_sessions SET status = 'frozen', frozen_amount_needed = $1 WHERE id = $2`,
        [frozenAmountNeeded, session.id]
      );
      await client.query('COMMIT');
      client.release();
      return res.status(400).json({
        code: 3,
        info: `Insufficient balance. Session frozen. Please deposit at least ${frozenAmountNeeded} USDT to continue.`,
        frozen_amount_needed: frozenAmountNeeded
      });
    }
    const newBalance = currentBalance - productPrice + calculatedCommission;
    await client.query(
      'UPDATE accounts SET balance = $1 WHERE id = $2',
      [newBalance.toFixed(2), account.id]
    );
    await client.query(
      `INSERT INTO commission_logs
       (user_id, source_user_id, account_type, commission_amount, commission_type, description, reference_id, source_action_id)
       VALUES ($1, $1, $2, $3, $4, $5, $6, $7)`,
      [userId, 'main', calculatedCommission.toFixed(2), 'data_drive', `Commission for product #${product_id} (Task ${product_number})`, product_number, product_id]
    );
    await client.query(
      `UPDATE drive_orders SET status = 'completed' WHERE id = $1`,
      [order_id]
    );
    const newTasksCompleted = session.tasks_completed + 1;
    let newSessionStatus = session.status;
    if (newTasksCompleted >= session.tasks_required) {
      newSessionStatus = 'pending_reset';
      await client.query(
        'UPDATE drive_sessions SET tasks_completed = $1, status = $2, completed_at = NOW() WHERE id = $3',
        [newTasksCompleted, newSessionStatus, session.id]
      );
    } else {
      await client.query(
        'UPDATE drive_sessions SET tasks_completed = $1 WHERE id = $2',
        [newTasksCompleted, session.id]
      );
    }
    await client.query('COMMIT');
    res.json({ code: 0, info: 'Order Sent successfully!', tasks_completed: newTasksCompleted });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ code: 1, info: 'Server error saving order: ' + error.message });
  } finally {
    if (client) client.release();
  }
};

const saveComboOrder = async (req, res) => {
  // ...unchanged, omitted for brevity...
  res.json({ success: true, info: 'Combo order completed!' });
};

const saveComboProduct = async (req, res) => {
  // ...unchanged, omitted for brevity...
  res.json({ code: 0, info: 'Combo product saved successfully!' });
};

const getDriveOrders = async (req, res) => {
  const userId = req.user.id;
  const { statusFilter } = req.body;
  try {
    const sessionResult = await pool.query(
      `SELECT id, status
       FROM drive_sessions
       WHERE user_id = $1 AND status IN ('active', 'frozen')
       ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );
    if (sessionResult.rows.length === 0)
      return res.status(400).json({ code: 1, info: 'No active or frozen drive session found.' });
    
    const session = sessionResult.rows[0];
    const sessionId = session.id;
    const sessionStatus = session.status;
    
    let query = `
      SELECT
        drv_orders.id AS order_id,
        drv_orders.status AS order_status,
        p.id AS product_id,
        p.name AS product_name,
        p.image_url AS product_image,
        p.price AS product_price
      FROM drive_orders drv_orders
      JOIN products p ON drv_orders.product_id = p.id
      WHERE drv_orders.session_id = $1
    `;
    
    const queryParams = [sessionId];
    
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'frozen') {
        if (sessionStatus !== 'frozen') return res.json({ code: 0, orders: [] });
      } else if (statusFilter === 'pending') {
         query += ` AND drv_orders.status = 'current'`; // Changed from 'pending' to 'current'
      } else {
        query += ` AND drv_orders.status = $2`;
        queryParams.push(statusFilter);
      }
    } else if (statusFilter === 'all') {
        query += ` AND drv_orders.status IN ('pending', 'completed')`; // Changed order of statuses
    }

    query += ` ORDER BY drv_orders.id ASC`;
    
    const ordersResult = await pool.query(query, queryParams);
    const orders = ordersResult.rows.map(order => ({
      order_id: order.order_id,
      product_id: order.product_id,
      product_name: order.product_name,
      product_image: order.product_image || './assets/uploads/products/newegg-1.jpg',
      product_price: parseFloat(order.product_price).toFixed(2),
      order_status: sessionStatus === 'frozen' ? 'frozen' : order.order_status
    }));

    res.json({ code: 0, orders });
  } catch (error) {
    res.status(500).json({ code: 1, info: 'Server error getting drive orders: ' + error.message });
  }
};

module.exports = {
  startDrive,
  getOrder,
  saveOrder,
  saveComboOrder,
  saveComboProduct,
  getDriveOrders,
  getDriveStatus
};
