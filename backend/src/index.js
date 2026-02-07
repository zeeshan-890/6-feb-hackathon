require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const rumorRoutes = require('./routes/rumors');
const userRoutes = require('./routes/users');
const correlationRoutes = require('./routes/correlations');

// Import services
const { initializeBlockchainListeners } = require('./services/blockchainService');
const { startTestRumorScheduler, generateAndPostTestRumor, autoVerifyTestRumors, getTestRumors } = require('./services/testRumorService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rumors', rumorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/correlations', correlationRoutes);
app.use('/api/votes', require('./routes/votes'));

// ═══ Test Rumor Admin Routes ═══
// POST /api/admin/test-rumor/generate — Manually trigger a test rumor
app.post('/api/admin/test-rumor/generate', async (req, res) => {
    try {
        const result = await generateAndPostTestRumor();
        if (result) {
            res.json({ success: true, message: 'Test rumor generated', ...result });
        } else {
            res.status(500).json({ error: 'Failed to generate test rumor' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/test-rumor/verify — Manually trigger auto-verification
app.post('/api/admin/test-rumor/verify', async (req, res) => {
    try {
        await autoVerifyTestRumors();
        res.json({ success: true, message: 'Auto-verification completed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/test-rumors — List all test rumors
app.get('/api/admin/test-rumors', (req, res) => {
    try {
        const rumors = getTestRumors();
        res.json({ testRumors: rumors });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Campus Rumors Backend running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);

    // Initialize blockchain event listeners
    if (process.env.IDENTITY_REGISTRY_ADDRESS) {
        initializeBlockchainListeners().catch(console.error);

        // Start the test rumor scheduler (weekly AI-generated false rumors)
        startTestRumorScheduler();
    } else {
        console.log('⚠️  Blockchain addresses not configured - event listeners disabled');
    }
});

module.exports = app;
