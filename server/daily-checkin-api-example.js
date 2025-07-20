// Daily Check-in API Implementation Example
// Add these endpoints to your existing server routes

// API Routes for Daily Check-in System

/**
 * POST /api/checkin/daily
 * Perform daily check-in for authenticated user
 */
app.post('/api/checkin/daily', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Call the PostgreSQL function to perform check-in
        const result = await pool.query(
            'SELECT perform_daily_checkin($1) as result',
            [userId]
        );
        
        const checkinResult = result.rows[0].result;
        
        if (checkinResult.success) {
            res.json({
                success: true,
                message: checkinResult.message,
                data: checkinResult.data
            });
        } else {
            res.status(400).json({
                success: false,
                message: checkinResult.message
            });
        }
    } catch (error) {
        console.error('Daily check-in error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during check-in'
        });
    }
});

/**
 * GET /api/checkin/stats
 * Get user's check-in statistics and calendar data
 */
app.get('/api/checkin/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get user check-in statistics
        const result = await pool.query(
            'SELECT get_user_checkin_stats($1) as stats',
            [userId]
        );
        
        const stats = result.rows[0].stats;
        
        res.json(stats);
    } catch (error) {
        console.error('Get check-in stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error getting stats'
        });
    }
});

/**
 * GET /api/checkin/calendar/:year/:month
 * Get check-in calendar data for a specific month
 */
app.get('/api/checkin/calendar/:year/:month', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { year, month } = req.params;
        
        // Validate year and month
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        
        if (yearNum < 2020 || yearNum > 2030 || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({
                success: false,
                message: 'Invalid year or month'
            });
        }
        
        // Get check-ins for the specified month
        const result = await pool.query(`
            SELECT 
                checkin_date,
                bonus_points,
                streak_day
            FROM daily_checkins 
            WHERE user_id = $1 
            AND EXTRACT(YEAR FROM checkin_date) = $2
            AND EXTRACT(MONTH FROM checkin_date) = $3
            ORDER BY checkin_date ASC
        `, [userId, yearNum, monthNum]);
        
        const checkins = result.rows.map(row => ({
            date: row.checkin_date,
            points: row.bonus_points,
            streakDay: row.streak_day
        }));
        
        res.json({
            success: true,
            data: {
                year: yearNum,
                month: monthNum,
                checkins: checkins
            }
        });
    } catch (error) {
        console.error('Get calendar data error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error getting calendar data'
        });
    }
});

/**
 * GET /api/checkin/leaderboard
 * Get check-in leaderboard (top users by current streak)
 */
app.get('/api/checkin/leaderboard', authenticateToken, async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        
        const result = await pool.query(`
            SELECT 
                u.username,
                u.tier,
                ucs.current_streak,
                ucs.total_checkins,
                ucs.total_bonus_points
            FROM user_checkin_stats ucs
            JOIN users u ON u.id = ucs.user_id
            WHERE ucs.current_streak > 0
            ORDER BY ucs.current_streak DESC, ucs.total_checkins DESC
            LIMIT $1
        `, [limit]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error getting leaderboard'
        });
    }
});

// Frontend JavaScript Example for Daily Check-in Integration

class DailyCheckinAPI {
    constructor() {
        this.baseUrl = '/api/checkin';
        this.authHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        };
    }

    async performCheckin() {
        try {
            const response = await fetch(`${this.baseUrl}/daily`, {
                method: 'POST',
                headers: this.authHeaders
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Check-in API error:', error);
            throw error;
        }
    }

    async getStats() {
        try {
            const response = await fetch(`${this.baseUrl}/stats`, {
                headers: this.authHeaders
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get stats API error:', error);
            throw error;
        }
    }

    async getCalendarData(year, month) {
        try {
            const response = await fetch(`${this.baseUrl}/calendar/${year}/${month}`, {
                headers: this.authHeaders
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get calendar API error:', error);
            throw error;
        }
    }

    async getLeaderboard(limit = 10) {
        try {
            const response = await fetch(`${this.baseUrl}/leaderboard?limit=${limit}`, {
                headers: this.authHeaders
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get leaderboard API error:', error);
            throw error;
        }
    }
}

// Usage example in your daily-checkin.html
const checkinAPI = new DailyCheckinAPI();

// Replace the localStorage-based DailyCheckin class with this API-based version:
class DailyCheckin {
    constructor() {
        this.api = new DailyCheckinAPI();
        this.currentDate = new Date();
        this.currentMonth = this.currentDate.getMonth();
        this.currentYear = this.currentDate.getFullYear();
        this.checkinData = null;
        this.init();
    }

    async init() {
        await this.loadCheckinData();
        this.renderCalendar();
        this.updateStats();
        this.bindEvents();
        this.checkTodayStatus();
    }

    async loadCheckinData() {
        try {
            const response = await this.api.getStats();
            if (response.success) {
                this.checkinData = response.data;
            } else {
                console.error('Failed to load check-in data:', response.message);
                this.checkinData = this.getDefaultData();
            }
        } catch (error) {
            console.error('Error loading check-in data:', error);
            this.checkinData = this.getDefaultData();
        }
    }

    getDefaultData() {
        return {
            total_checkins: 0,
            current_streak: 0,
            longest_streak: 0,
            total_bonus_points: 0,
            has_checked_in_today: false,
            recent_checkin_dates: []
        };
    }

    async performCheckin() {
        try {
            const response = await this.api.performCheckin();
            if (response.success) {
                // Update local data with response
                this.checkinData.total_checkins = response.data.total_checkins;
                this.checkinData.current_streak = response.data.current_streak;
                this.checkinData.longest_streak = response.data.longest_streak;
                this.checkinData.total_bonus_points += response.data.points_earned;
                this.checkinData.has_checked_in_today = true;
                
                this.updateStats();
                this.renderCalendar();
                this.checkTodayStatus();
                this.showCheckinSuccess(response.data.points_earned);
                
                return true;
            } else {
                console.error('Check-in failed:', response.message);
                return false;
            }
        } catch (error) {
            console.error('Error performing check-in:', error);
            return false;
        }
    }

    updateStats() {
        if (!this.checkinData) return;
        
        document.getElementById('streakDays').textContent = this.checkinData.current_streak;
        document.getElementById('totalCheckins').textContent = this.checkinData.total_checkins;
        document.getElementById('bonusPoints').textContent = this.checkinData.total_bonus_points;

        // Update streak badge
        const streakBadge = document.getElementById('streakBadge');
        if (this.checkinData.current_streak >= 30) {
            streakBadge.textContent = '💎';
        } else if (this.checkinData.current_streak >= 14) {
            streakBadge.textContent = '⭐';
        } else if (this.checkinData.current_streak >= 7) {
            streakBadge.textContent = '🏆';
        } else {
            streakBadge.textContent = '🔥';
        }
    }

    checkTodayStatus() {
        const button = document.getElementById('checkinButton');
        const text = document.getElementById('checkinText');
        
        if (this.checkinData.has_checked_in_today) {
            button.disabled = true;
            button.classList.add('checked-in');
            text.textContent = 'Already Checked In Today!';
        } else {
            button.disabled = false;
            button.classList.remove('checked-in');
            text.textContent = 'Check In Today';
        }
    }

    async renderCalendar() {
        // Get calendar data for current month
        try {
            const calendarResponse = await this.api.getCalendarData(this.currentYear, this.currentMonth + 1);
            const checkinDates = calendarResponse.success ? 
                calendarResponse.data.checkins.map(c => c.date) : [];
            
            // Render calendar with check-in dates
            this.renderCalendarGrid(checkinDates);
        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.renderCalendarGrid([]);
        }
    }

    renderCalendarGrid(checkinDates) {
        const grid = document.getElementById('calendarGrid');
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        document.getElementById('currentMonth').textContent = 
            `${monthNames[this.currentMonth]} ${this.currentYear}`;

        // Clear previous calendar
        grid.innerHTML = '';

        // Add day headers
        const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        dayHeaders.forEach(day => {
            const header = document.createElement('div');
            header.className = 'calendar-day-header';
            header.textContent = day;
            grid.appendChild(header);
        });

        // Render calendar days
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day other-month';
            grid.appendChild(emptyDay);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;

            const currentDate = new Date(this.currentYear, this.currentMonth, day);
            const dateString = currentDate.toISOString().split('T')[0];
            
            if (this.isToday(currentDate)) {
                dayElement.classList.add('today');
            }

            if (checkinDates.includes(dateString)) {
                dayElement.classList.add('checked-in');
            }

            grid.appendChild(dayElement);
        }
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    showCheckinSuccess(pointsEarned) {
        const button = document.getElementById('checkinButton');
        const originalText = button.innerHTML;
        
        button.innerHTML = `<i class="fas fa-check"></i> Success! +${pointsEarned} Points`;
        button.style.background = 'linear-gradient(135deg, #30D158, #28a745)';
        
        setTimeout(() => {
            this.checkTodayStatus();
        }, 2000);
    }

    bindEvents() {
        document.getElementById('checkinButton').addEventListener('click', () => {
            this.performCheckin();
        });

        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }
            this.renderCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
            this.renderCalendar();
        });
    }
}
