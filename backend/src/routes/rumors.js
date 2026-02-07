const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadJSON, uploadFile, getContent, getGatewayUrl } = require('../services/ipfsService');
const { processRumor } = require('../services/geminiService');
const { getRumor, getRelatedRumors, createRumor } = require('../services/blockchainService');
const { verifyUserToken, exportPrivateKey } = require('../services/tokenService');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    },
});

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
 * POST /api/rumors/create
 * Authenticated endpoint to create a rumor
 */
router.post('/create', authenticate, upload.array('evidence', 5), async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }

        // 1. Upload evidence files to IPFS
        const evidenceHashes = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const result = await uploadFile(file.buffer, file.originalname, file.mimetype);
                if (result.success) {
                    evidenceHashes.push(result.hash);
                }
            }
        }

        // 2. Create rumor content object
        const rumorContent = {
            title,
            description,
            createdAt: new Date().toISOString(),
            evidenceHashes,
        };

        // 3. Upload rumor content to IPFS
        const contentResult = await uploadJSON(rumorContent, 'rumor');
        if (!contentResult.success) {
            return res.status(500).json({ error: 'Failed to upload rumor content' });
        }

        // 4. Process with AI (generate keywords)
        // We do this asynchronously to not block the response, or synchronously if needed for keywords
        // For simplicity, we'll do basic keyword extraction or skip
        const aiResult = await processRumor(contentResult.hash, `${title} ${description}`, []);

        // 5. Submit transaction to blockchain via user wallet (if available) or master (fallback)
        // Extract token to get private key
        const token = req.headers.authorization.split(' ')[1];
        const privateKey = exportPrivateKey(token);

        const rumorId = await createRumor(contentResult.hash, evidenceHashes, aiResult.keywords || [], privateKey);

        if (!rumorId) {
            return res.status(500).json({ error: 'Failed to create rumor on blockchain' });
        }

        res.json({
            success: true,
            message: 'Rumor created successfully!',
            rumorId,
            contentHash: contentResult.hash,
        });

    } catch (error) {
        console.error('Create rumor error:', error);
        res.status(500).json({ error: 'Failed to create rumor' });
    }
});

// LEGACY: Keep existing /prepare for backward compatibility if needed, or remove
router.post('/prepare', upload.array('evidence', 5), async (req, res) => {
    // ... same implementation as before ...
    // Since we are moving to gasless, we might deprecate this or leave it for advanced users
    // For now, let's keep it but simplified or redirect logic
    return res.status(410).json({ error: 'Use /api/rumors/create with auth token instead' });
});

/**
 * GET /api/rumors
 * List rumors with optional filters
 */
router.get('/', async (req, res) => {
    try {
        const { status, limit = 20, offset = 0, search } = req.query;
        const limitNum = parseInt(limit);
        const offsetNum = parseInt(offset);

        // Get total rumors from blockchain
        const { initializeProvider } = require('../services/blockchainService');
        const { contracts } = initializeProvider();

        if (!contracts.rumorRegistry) {
            return res.json({ rumors: [], total: 0 });
        }

        const totalRumors = Number(await contracts.rumorRegistry.getTotalRumors());

        if (totalRumors === 0) {
            return res.json({ rumors: [], total: 0 });
        }

        // Fetch rumors from blockchain (newest first)
        const rumors = [];
        const startId = Math.max(1, totalRumors - offsetNum);
        const endId = Math.max(1, startId - limitNum + 1);

        for (let id = startId; id >= endId && id >= 1; id--) {
            try {
                const rumor = await getRumor(id);
                if (rumor && rumor.visible) {
                    // Filter by status if provided
                    if (status && rumor.status !== status.toUpperCase()) {
                        continue;
                    }

                    // Fetch content from IPFS
                    let content = null;
                    if (rumor.contentHash) {
                        const contentResult = await getContent(rumor.contentHash);
                        if (contentResult.success) {
                            content = contentResult.content;
                        }
                    }

                    rumors.push({
                        ...rumor,
                        content,
                        evidenceUrls: rumor.evidenceHashes?.map(h => getGatewayUrl(h)) || [],
                    });
                }
            } catch (err) {
                console.error(`Error fetching rumor ${id}:`, err.message);
            }
        }

        res.json({ rumors, total: totalRumors });
    } catch (error) {
        console.error('Rumor list error:', error);
        res.status(500).json({ error: 'Failed to fetch rumors' });
    }
});

/**
 * GET /api/rumors/:id
 * Get rumor details
 */
router.get('/:id', async (req, res) => {
    try {
        const rumorID = req.params.id;
        const blockchainData = await getRumor(parseInt(rumorID));

        if (!blockchainData) {
            return res.status(404).json({ error: 'Rumor not found' });
        }

        // Fetch content if needed
        let content = null;
        if (blockchainData.contentHash) {
            const contentResult = await getContent(blockchainData.contentHash);
            if (contentResult.success) content = contentResult.content;
        }

        const related = await getRelatedRumors(parseInt(rumorID));

        res.json({
            ...blockchainData,
            content,
            relatedRumors: related,
            evidenceUrls: blockchainData.evidenceHashes?.map(h => getGatewayUrl(h)) || [],
        });
    } catch (error) {
        console.error('Rumor fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch rumor' });
    }
});

/**
 * GET /api/rumors/:id/content
 */
router.get('/:id/content', async (req, res) => {
    try {
        const { hash } = req.query;
        if (!hash) return res.status(400).json({ error: 'Hash required' });
        const result = await getContent(hash);
        if (!result.success) return res.status(404).json({ error: 'Content not found' });
        res.json(result.content);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

module.exports = router;
