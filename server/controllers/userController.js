const pool = require('../config/db');

const getUserDeposits = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to calculate the total deposited amount
    const result = await pool.query(
      `SELECT COALESCE(SUM(commission_amount), 0) AS total_deposits
       FROM commission_logs
       WHERE user_id = $1 AND commission_type = 'admin_deposit'`,
      [userId]
    );

    const totalDeposits = result.rows[0].total_deposits;

    res.json({ success: true, totalDeposits: parseFloat(totalDeposits) });
  } catch (error) {
    console.error('Error fetching user deposits:', error);
    res.status(500).json({ success: false, message: 'Server error fetching deposits' });
  }
};

const getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to calculate the total withdrawn amount
    const result = await pool.query(
      `SELECT COALESCE(SUM(commission_amount), 0) AS total_withdrawals
       FROM commission_logs
       WHERE user_id = $1 AND commission_type = 'withdrawal'`,
      [userId]
    );

    const totalWithdrawals = result.rows[0].total_withdrawals;

    res.json({ success: true, totalWithdrawals: parseFloat(totalWithdrawals) });
  } catch (error) {
    console.error('Error fetching user withdrawals:', error);
    res.status(500).json({ success: false, message: 'Server error fetching withdrawals' });
  }
};

// Fetch withdrawable balance
const getWithdrawableBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to calculate the withdrawable balance
    const result = await pool.query(
      `SELECT main_balance AS withdrawable_balance
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    );

    const withdrawableBalance = result.rows[0]?.withdrawable_balance || 0;

    res.json({ success: true, withdrawableBalance: parseFloat(withdrawableBalance) });
  } catch (error) {
    console.error('Error fetching withdrawable balance:', error);
    res.status(500).json({ success: false, message: 'Server error fetching withdrawable balance' });
  }
};

// Fetch withdraw history
const getWithdrawHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to fetch withdraw history
    const result = await pool.query(
      `SELECT commission_amount AS amount, created_at AS date
       FROM commission_logs
       WHERE user_id = $1 AND commission_type = 'withdrawal'
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, history: result.rows });
  } catch (error) {
    console.error('Error fetching withdraw history:', error);
    res.status(500).json({ success: false, message: 'Server error fetching withdraw history' });
  }
};

const getUserBalances = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to fetch balances
    const result = await pool.query(
      `SELECT 
         COALESCE(main_balance, 0) AS withdrawable_balance,
         COALESCE(deposited_amount, 0) AS deposited_amount,
         COALESCE(data_drive_balance, 0) AS data_drive_balance
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { withdrawable_balance, deposited_amount, data_drive_balance } = result.rows[0];

    res.json({
      success: true,
      balances: {
        withdrawableBalance: parseFloat(withdrawable_balance),
        depositedAmount: parseFloat(deposited_amount),
        dataDriveBalance: parseFloat(data_drive_balance),
      },
    });
  } catch (error) {
    console.error('Error fetching user balances:', error);
    res.status(500).json({ success: false, message: 'Server error fetching balances' });
  }
};

const getUserBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch balance from the 'main' account in the accounts table
    const result = await pool.query(
      'SELECT balance FROM accounts WHERE user_id = $1 AND type = \'main\'',
      [userId]
    );

    // If user exists but has no main account row yet, balance is 0
    // No need to check users table here as protect middleware should ensure user exists
    const balance = result.rows.length > 0 ? parseFloat(result.rows[0].balance) : 0;

    res.json({
      success: true,
      balance: balance
    });
  } catch (error) {
    console.error('Error fetching user balance:', error);
    res.status(500).json({ success: false, message: 'Server error fetching balance' });
  }
};

module.exports = {
  getUserDeposits,
  getUserWithdrawals,
  getWithdrawableBalance,
  getWithdrawHistory,
  getUserBalances,
  getUserBalance,
  // Other user-related functions
};
