const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const tokenService = require('../services/tokenService');
const blockchainService = require('../services/blockchainService');

/**
 * POST /api/auth/send-code
 * Send verification code to email (for first-time registration)
 */
router.post('/send-code', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if already registered
        const isRegistered = await tokenService.isEmailRegistered(email);
        if (isRegistered) {
            return res.status(400).json({
                error: 'Email already registered. Use your token to login.',
                alreadyRegistered: true
            });
        }

        const result = await emailService.sendVerificationCode(email);

        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        const response = { message: result.message };
        if (result.code) {
            response.devCode = result.code; // Only in dev mode
        }

        res.json(response);
    } catch (error) {
        console.error('Send code error:', error);
        res.status(500).json({ error: 'Failed to send verification code' });
    }
});

/**
 * POST /api/auth/register
 * Verify code and create permanent token
 */
router.post('/register', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required' });
        }

        // Verify the code
        const verifyResult = emailService.verifyCode(email, code);
        if (!verifyResult.success) {
            return res.status(400).json({ error: verifyResult.message });
        }

        // Create permanent token and wallet
        const { token, displayEmail, walletAddress, emailHash } = await tokenService.registerUser(email);

        // Perform on-chain registration (async, don't block response too long but we need it for user to use app)
        // Since we are adding significant latency, we should handle this gracefully.
        // For MVP, we'll await it but wrap in try/catch so failure doesn't block token return (though app might be limited)

        let onChainStatus = 'pending';

        try {
            // 1. Fund the new wallet
            await blockchainService.fundWallet(walletAddress);

            // 2. Register on-chain with new wallet
            const privateKey = tokenService.exportPrivateKey(token);
            if (privateKey) {
                await blockchainService.registerStudentOnChain(privateKey, emailHash);
                onChainStatus = 'success';
            } else {
                console.error('Failed to retrieve private key for registration');
                onChainStatus = 'failed_key';
            }
        } catch (chainError) {
            console.error('On-chain registration error:', chainError);
            onChainStatus = 'failed_chain';
            // We still return the token, effectively creating an "off-chain" account until retry?
            // For hackathon, we just log it. The user has a wallet but might be empty or unregistered.
        }

        // Send token via email
        try {
            await emailService.sendTokenEmail(email, token);
        } catch (emailError) {
            console.error('Failed to send token email:', emailError);
        }

        res.json({
            success: true,
            message: 'Registration successful!',
            token: token,
            email: displayEmail,
            walletAddress: walletAddress,
            onChainStatus
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Failed to register' });
    }
});

/**
 * POST /api/auth/login
 * Login with permanent token
 */
router.post('/login', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const result = await tokenService.verifyUserToken(token);

        if (!result.valid) {
            return res.status(401).json({ error: result.error || 'Invalid token' });
        }

        res.json({
            success: true,
            message: 'Login successful!',
            user: result.user,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

/**
 * GET /api/auth/me
 * Get current user info (requires token in header)
 */
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const result = await tokenService.verifyUserToken(token);

        if (!result.valid) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        res.json(result.user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// Legacy endpoint for compatibility
router.post('/verify-code', async (req, res) => {
    // Redirect to register
    req.url = '/register';
    return router.handle(req, res);
});

module.exports = router;
