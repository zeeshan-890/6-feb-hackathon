const express = require('express');
const router = express.Router();
const { getStudent, hasUserVoted } = require('../services/blockchainService');

/**
 * GET /api/users/:address
 * Get user profile by wallet address
 */
router.get('/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!address || !address.startsWith('0x')) {
            return res.status(400).json({ error: 'Invalid wallet address' });
        }

        const student = await getStudent(address);

        if (!student) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(student);
    } catch (error) {
        console.error('User fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

/**
 * GET /api/users/:address/votes/:rumorId
 * Check if user has voted on a specific rumor
 */
router.get('/:address/votes/:rumorId', async (req, res) => {
    try {
        const { address, rumorId } = req.params;

        if (!address || !address.startsWith('0x')) {
            return res.status(400).json({ error: 'Invalid wallet address' });
        }

        const voted = await hasUserVoted(parseInt(rumorId), address);

        res.json({ voted });
    } catch (error) {
        console.error('Vote check error:', error);
        res.status(500).json({ error: 'Failed to check vote status' });
    }
});

/**
 * GET /api/users/:address/stats
 * Get user statistics
 */
router.get('/:address/stats', async (req, res) => {
    try {
        const { address } = req.params;

        if (!address || !address.startsWith('0x')) {
            return res.status(400).json({ error: 'Invalid wallet address' });
        }

        const student = await getStudent(address);

        if (!student) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Calculate accuracy rate
        const totalPredictions = parseInt(student.accuratePredictions) + parseInt(student.inaccuratePredictions);
        const accuracyRate = totalPredictions > 0
            ? (parseInt(student.accuratePredictions) / totalPredictions * 100).toFixed(1)
            : 0;

        res.json({
            studentID: student.studentID,
            credibilityScore: student.credibilityScore,
            status: student.status,
            votingPower: (parseInt(student.votingPower) / 100).toFixed(0) + '%',
            totalPosts: student.totalPosts,
            totalVotes: student.totalVotes,
            accuratePredictions: student.accuratePredictions,
            inaccuratePredictions: student.inaccuratePredictions,
            accuracyRate: accuracyRate + '%',
            memberSince: student.registeredAt,
        });
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
