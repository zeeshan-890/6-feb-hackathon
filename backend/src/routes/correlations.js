const express = require('express');
const router = express.Router();
const { analyzeCorrelation } = require('../services/geminiService');
const { getRelatedRumors, getRumor } = require('../services/blockchainService');
const { getContent } = require('../services/ipfsService');

/**
 * GET /api/correlations/:rumorId
 * Get correlations for a specific rumor
 */
router.get('/:rumorId', async (req, res) => {
    try {
        const rumorId = parseInt(req.params.rumorId);

        const related = await getRelatedRumors(rumorId);

        // Fetch details for related rumors
        const supportiveDetails = await Promise.all(
            related.supportive.map(async (id) => {
                const rumor = await getRumor(parseInt(id));
                if (rumor?.contentHash) {
                    const content = await getContent(rumor.contentHash);
                    return {
                        ...rumor,
                        content: content.success ? content.content : null,
                    };
                }
                return rumor;
            })
        );

        const contradictoryDetails = await Promise.all(
            related.contradictory.map(async (id) => {
                const rumor = await getRumor(parseInt(id));
                if (rumor?.contentHash) {
                    const content = await getContent(rumor.contentHash);
                    return {
                        ...rumor,
                        content: content.success ? content.content : null,
                    };
                }
                return rumor;
            })
        );

        res.json({
            rumorId,
            supportive: supportiveDetails.filter(Boolean),
            contradictory: contradictoryDetails.filter(Boolean),
        });
    } catch (error) {
        console.error('Correlation fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch correlations' });
    }
});

/**
 * POST /api/correlations/analyze
 * Analyze potential correlation between two rumors
 */
router.post('/analyze', async (req, res) => {
    try {
        const { rumorAText, rumorBText } = req.body;

        if (!rumorAText || !rumorBText) {
            return res.status(400).json({ error: 'Both rumor texts are required' });
        }

        const result = await analyzeCorrelation(rumorAText, rumorBText);

        if (!result.success) {
            return res.status(500).json({ error: 'Analysis failed' });
        }

        res.json(result.result);
    } catch (error) {
        console.error('Correlation analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze correlation' });
    }
});

module.exports = router;
