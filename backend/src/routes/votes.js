const express = require('express');
const router = express.Router();
const { voteOnRumor } = require('../services/blockchainService');
const { verifyUserToken, exportPrivateKey } = require('../services/tokenService');

// Middleware to check token
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const result = await verifyUserToken(token);

    if (!result.valid) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = result.user;
    next();
};

/**
 * POST /api/votes
 * Vote on a rumor
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { rumorId, voteType } = req.body;

        if (rumorId === undefined || voteType === undefined) {
            return res.status(400).json({ error: 'Rumor ID and vote type are required' });
        }

        // Convert voteType to boolean (0/1 or true/false)
        const isConfirm = voteType === 'CONFIRM' || voteType === 0 || voteType === true;

        // Get the user's private key to sign the vote from their wallet
        const authToken = req.headers.authorization.split(' ')[1];
        const privateKey = exportPrivateKey(authToken);

        if (!privateKey) {
            return res.status(500).json({ error: 'Could not retrieve wallet key' });
        }

        await voteOnRumor(rumorId, isConfirm, privateKey);

        res.json({
            success: true,
            message: 'Vote cast successfully!',
        });
    } catch (error) {
        console.error('Vote error:', error);
        res.status(500).json({ error: 'Failed to cast vote' });
    }
});

module.exports = router;
