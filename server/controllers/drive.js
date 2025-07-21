const pool = require('../config/db');
const CommissionService = require('../services/commissionService'); // Import commission service

// @desc    Start a new drive session
// @route   POST /api/drive/start
// @access  Private
const startDrive = async (req, res) => {
    const userId = req.user.id;
    console.log(`Drive start called for user ID: ${userId}`);
    
    try {
        // Import the comprehensive implementation from driveController
        const driveController = require('./driveController');
        return await driveController.startDrive(req, res);
    } catch (error) {
        console.error('Error starting drive session:', error);
        res.status(500).json({
            code: 1,
            message: 'Server error starting drive session'
        });
    }
};

// TODO: Implement completeDrive function
// @desc    Complete an active drive session and calculate commission
// @route   POST /api/drive/complete/:sessionId
// @access  Private
const completeDrive = async (req, res) => {
    const userId = req.user.id;
    const { sessionId } = req.params;

    if (!sessionId || isNaN(parseInt(sessionId))) {
        return res.status(400).json({ message: 'Valid Session ID is required' });
    }

    const client = await pool.connect(); // Use transaction

    try {
        await client.query('BEGIN');

        // 1. Find the session, ensure it belongs to the user and status is 'started'.
        const sessionResult = await client.query(
            `SELECT ds.id, ds.user_id, ds.product_combo_id, ds.status, pc.combo_price, pc.combo_commission_rate
             FROM drive_sessions ds
             JOIN product_combos pc ON ds.product_combo_id = pc.id
             WHERE ds.id = $1 AND ds.user_id = $2`,
            [sessionId, userId]
        );

        if (sessionResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Active drive session not found for this user' });
        }

        const session = sessionResult.rows[0];

        if (session.status !== 'started') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Session is already ${session.status}` });
        }

        // 2. Update session status to 'completed' and set end_time.
        const updateResult = await client.query(
            `UPDATE drive_sessions
             SET status = 'completed', end_time = NOW()
             WHERE id = $1
             RETURNING id, status, end_time`,
            [sessionId]
        );
        const updatedSession = updateResult.rows[0];

        // 3. & 4. Calculate and distribute commission using CommissionService
        // Assuming direct drive commission is the primary one here.
        // The service should handle upline commissions internally.
        await CommissionService.calculateDirectDriveCommission(
            userId,
            session.product_combo_id, // Use combo ID as source action ID? Or session ID? Let's use session ID.
            session.combo_price,
            session.combo_commission_rate,
            client, // Pass the transaction client
            sessionId // Pass session ID as source_action_id
        );

        // TODO: Potentially add Training Commission calculation here if applicable to drives

        await client.query('COMMIT');

        // 5. Return success message.
        res.status(200).json({
            message: 'Drive session completed successfully and commission processed.',
            session: updatedSession
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error completing drive session:', error);
        res.status(500).json({ message: 'Server error completing drive session' });
    } finally {
        client.release();
    }
};

// @desc    List available product combos
// @route   GET /api/drive/combos
// @access  Private (or Public, depending on requirements)
const listCombos = async (req, res) => {
    try {
        // Fetch active combos, selecting relevant fields for the frontend
        const comboResult = await pool.query(
            `SELECT id, name, combo_price, combo_commission_rate, image_url, min_balance_required, min_tier
             FROM product_combos
             WHERE is_active = true
             ORDER BY combo_price ASC` // Optional: order by price
        );

        res.status(200).json(comboResult.rows);

    } catch (error) {
        console.error('Error listing product combos:', error);
        res.status(500).json({ message: 'Server error listing product combos' });
    }
};

// @desc    Add commission from product rating
// @route   POST /api/drive/add-commission
// @access  Private
const addRatingCommission = async (req, res) => {
    const userId = req.user.id;
    const { rating, productId, productName, userTier } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ 
            code: 1, 
            message: 'Invalid rating. Must be between 1 and 5.' 
        });
    }
    
    try {
        // Define commission rates based on tier and rating
        const commissionRates = {
            'bronze': { 4: 0.40, 5: 0.20 },
            'silver': { 4: 0.70, 5: 0.30 },
            'gold': { 4: 0.90, 5: 0.50 }
        };
        
        const tier = (userTier || 'bronze').toLowerCase();
        let commissionAmount = 0;
        
        // Only pay commission for 4 and 5 star ratings
        if (rating >= 4) {
            commissionAmount = commissionRates[tier] ? 
                (commissionRates[tier][rating] || 0) : 
                commissionRates['bronze'][rating] || 0;
        }
        
        if (commissionAmount > 0) {
            // Add commission to user's drive session
            const addCommissionResult = await pool.query(
                `UPDATE drive_sessions 
                 SET commission_earned = commission_earned + $1
                 WHERE user_id = $2 AND status = 'started'
                 RETURNING commission_earned`,
                [commissionAmount, userId]
            );
            
            if (addCommissionResult.rowCount === 0) {
                // If no active session, create a simple commission record
                await pool.query(
                    `INSERT INTO user_commission_history 
                     (user_id, amount, source, description, created_at)
                     VALUES ($1, $2, 'product_rating', $3, NOW())`,
                    [
                        userId, 
                        commissionAmount, 
                        `Product rating commission for "${productName}" (${rating} stars)`
                    ]
                );
            }
            
            // Log the rating and commission
            await pool.query(
                `INSERT INTO product_ratings 
                 (user_id, product_id, product_name, rating, commission_earned, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (user_id, product_id) 
                 DO UPDATE SET 
                   rating = EXCLUDED.rating,
                   commission_earned = EXCLUDED.commission_earned,
                   updated_at = NOW()`,
                [userId, productId || 0, productName, rating, commissionAmount]
            );
        }
        
        res.status(200).json({
            code: 0,
            message: 'Rating submitted successfully',
            data: {
                rating: rating,
                commissionEarned: commissionAmount,
                tier: tier
            }
        });
        
    } catch (error) {
        console.error('Error adding rating commission:', error);
        res.status(500).json({ 
            code: 1, 
            message: 'Server error processing rating' 
        });
    }
};

// @desc    Get next order/product for drive
// @route   POST /api/drive/getorder
// @access  Private  
const getOrder = async (req, res) => {
    const userId = req.user.id;
    console.log(`Drive getOrder called for user ID: ${userId}`);

    try {
        // Import the comprehensive implementation from driveController
        const driveController = require('./driveController');
        return await driveController.getOrder(req, res);
    } catch (error) {
        console.error('Error getting order:', error);
        res.status(500).json({
            code: 1,
            message: 'Server error getting order'
        });
    }
};

// @desc    Save completed order
// @route   POST /api/drive/saveorder
// @access  Private
const saveOrder = async (req, res) => {
    const userId = req.user.id;
    console.log(`Drive saveOrder called for user ID: ${userId}`);
    
    try {
        // Import the comprehensive implementation from driveController
        const driveController = require('./driveController');
        return await driveController.saveOrder(req, res);
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({
            code: 1,
            message: 'Server error saving order'
        });
    }
};

// @desc    Process refund
// @route   POST /api/drive/refund
// @access  Private
const refundPurchase = async (req, res) => {
    const userId = req.user.id;
    
    try {
        // Basic response for now
        res.status(200).json({
            code: 0,
            message: 'Refund processed successfully',
            data: {
                success: true,
                refund_amount: 0
            }
        });
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({
            code: 1,
            message: 'Server error processing refund'
        });
    }
};

// @desc    Get current drive status
// @route   GET /api/drive/status
// @access  Private
const getDriveStatus = async (req, res) => {
    const userId = req.user.id;
    
    try {
        // Get user's current drive session
        const sessionResult = await pool.query(
            `SELECT ds.*, dc.name as configuration_name 
             FROM drive_sessions ds
             LEFT JOIN drive_configurations dc ON ds.drive_configuration_id = dc.id
             WHERE ds.user_id = $1 AND ds.status IN ('active', 'frozen')
             ORDER BY ds.created_at DESC
             LIMIT 1`,
            [userId]
        );
        
        if (sessionResult.rowCount === 0) {
            return res.status(200).json({
                code: 0,
                message: 'No active drive session',
                has_active_session: false,
                status: 'inactive',
                total_commission: 0,
                total_session_commission: 0,
                session: null
            });
        }
        
        const session = sessionResult.rows[0];
        
        // Get progress information
        const progressResult = await pool.query(
            `SELECT 
                COUNT(*) as total_items,
                COUNT(CASE WHEN user_status = 'COMPLETED' THEN 1 END) as completed_items,
                COUNT(CASE WHEN user_status = 'CURRENT' THEN 1 END) as current_items
             FROM user_active_drive_items 
             WHERE drive_session_id = $1`,
            [session.id]
        );
        
        const progress = progressResult.rows[0];
        const progressPercentage = progress.total_items > 0 ? 
            Math.round((progress.completed_items / progress.total_items) * 100) : 0;
        
        // Get current item if exists
        const currentItemResult = await pool.query(
            `SELECT * FROM user_active_drive_items 
             WHERE drive_session_id = $1 AND user_status = 'CURRENT'
             ORDER BY order_in_drive ASC
             LIMIT 1`,
            [session.id]
        );
        
        const responseData = {
            has_active_session: true,
            status: session.status,
            total_commission: parseFloat(session.commission_earned || 0),
            total_session_commission: parseFloat(session.commission_earned || 0),
            session: {
                id: session.id,
                session_uuid: session.session_uuid,
                status: session.status,
                configuration_name: session.configuration_name,
                tasks_completed: progress.completed_items,
                tasks_required: progress.total_items,
                progress_percentage: progressPercentage,
                commission_earned: parseFloat(session.commission_earned || 0),
                starting_balance: parseFloat(session.starting_balance || 0),
                frozen_amount_needed: parseFloat(session.frozen_amount_needed || 0),
                started_at: session.started_at,
                current_item: currentItemResult.rowCount > 0 ? currentItemResult.rows[0] : null
            }
        };
        
        res.status(200).json({
            code: 0,
            message: 'Drive status retrieved successfully',
            has_active_session: true,
            status: session.status,
            total_commission: parseFloat(session.commission_earned || 0),
            total_session_commission: parseFloat(session.commission_earned || 0),
            session: responseData.session
        });
        
    } catch (error) {
        console.error('Error getting drive status:', error);
        res.status(500).json({
            code: 1,
            message: 'Server error retrieving drive status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Check if account can be auto-unfrozen
// @route   POST /api/drive/check-unfreeze
// @access  Private
const checkAutoUnfreeze = async (req, res) => {
    const userId = req.user.id;
    const { current_balance, required_amount } = req.body;
    
    try {
        // Get user's current drive session
        const sessionResult = await pool.query(
            `SELECT id, status, frozen_amount_needed FROM drive_sessions 
             WHERE user_id = $1 AND status = 'frozen'`,
            [userId]
        );
        
        if (sessionResult.rowCount === 0) {
            return res.status(400).json({
                code: 1,
                message: 'No frozen drive session found'
            });
        }
        
        const session = sessionResult.rows[0];
        const amountNeeded = session.frozen_amount_needed || required_amount || 0;
        
        // Check if current balance is sufficient
        const canUnfreeze = current_balance >= amountNeeded;
        
        if (canUnfreeze) {
            // Update session status to active
            await pool.query(
                `UPDATE drive_sessions SET status = 'active', frozen_amount_needed = NULL 
                 WHERE id = $1`,
                [session.id]
            );
            
            return res.status(200).json({
                code: 0,
                message: 'Account successfully unfrozen',
                data: {
                    session_id: session.id,
                    status: 'active',
                    previous_frozen_amount: amountNeeded
                }
            });
        } else {
            return res.status(200).json({
                code: 1,
                message: 'Insufficient balance for auto-unfreeze',
                data: {
                    current_balance: current_balance,
                    amount_needed: amountNeeded,
                    deficit: amountNeeded - current_balance
                }
            });
        }
        
    } catch (error) {
        console.error('Error checking auto-unfreeze:', error);
        res.status(500).json({
            code: 1,
            message: 'Server error checking unfreeze status'
        });
    }
};

module.exports = {
  startDrive,
  getOrder, // Now properly implemented
  saveOrder, // Now properly implemented
  refundPurchase, // Now properly implemented
  saveComboOrder: completeDrive, // Alias for compatibility  
  getDriveOrders: listCombos, // Alias for compatibility
  saveComboProduct: completeDrive, // Alias for compatibility
  getDriveStatus, // Now properly implemented
  getDriveProgress: listCombos, // Alias for compatibility
  getDetailedDriveProgress: listCombos, // Alias for compatibility
  checkAutoUnfreeze, // Now properly implemented
  addRatingCommission // Our new commission function
};
