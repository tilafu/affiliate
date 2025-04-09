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

module.exports = {
  getUserDeposits,
  getUserWithdrawals,
  getWithdrawableBalance,
  getWithdrawHistory,
  // Other user-related functions
};