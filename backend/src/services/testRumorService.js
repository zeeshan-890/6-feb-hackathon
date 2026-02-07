/**
 * Test Rumor Service
 * 
 * Gemini AI auto-generates realistic but FALSE test rumors once a week.
 * Purpose: Test user credibility — users who blindly confirm these fake
 * rumors get their credibility score decreased.
 * 
 * Flow:
 * 1. Weekly cron generates a false rumor via Gemini AI
 * 2. Rumor is posted on-chain via a dedicated "system" wallet (master wallet)
 * 3. The rumor looks normal to users — they can vote on it
 * 4. After 3 days, the system auto-verifies it as FALSE (DEBUNKED)
 * 5. Users who CONFIRMED it lose credibility (via VerificationController)
 * 6. Users who DISPUTED it gain credibility (correct detection)
 */

const { ethers } = require('ethers');
const path = require('path');

// Gemini for generating test rumors
let genAI = null;
let model = null;

function initGemini() {
    if (!genAI && process.env.GEMINI_API_KEY) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    }
    return model;
}

// SQLite for tracking test rumors
let db = null;

function initTestDB() {
    if (db) return db;
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '../../data/tokens.db');
        db = new Database(dbPath);

        // Create test_rumors table
        db.exec(`
            CREATE TABLE IF NOT EXISTS test_rumors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rumor_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                auto_verify_at TEXT NOT NULL,
                verified BOOLEAN DEFAULT 0,
                verified_at TEXT
            )
        `);

        console.log('✅ Test rumor tracking table ready');
        return db;
    } catch (error) {
        console.error('❌ Test DB init failed:', error.message);
        return null;
    }
}

/**
 * Use Gemini to generate a realistic but FALSE campus rumor
 */
async function generateFalseRumor() {
    const ai = initGemini();

    if (!ai) {
        // Fallback: hardcoded test rumors if Gemini is unavailable
        const fallbackRumors = [
            {
                title: 'University Library Closing Permanently Next Month',
                description: 'Sources within the administration have confirmed that the main university library will be permanently closing its doors next month due to budget cuts. All books will be moved to an online-only system. Students are advised to return all borrowed materials immediately.',
            },
            {
                title: 'Free Laptops Being Distributed to All Students',
                description: 'The university IT department announced that all enrolled students will receive free laptops starting next week. The laptops are part of a new digital initiative funded by a generous anonymous donor. Students just need to show their ID at the campus store.',
            },
            {
                title: 'Final Exams Cancelled for This Semester',
                description: 'Breaking: The academic council has voted unanimously to cancel all final exams this semester. Instead, final grades will be based solely on midterm scores and assignment submissions. The official notice will be sent to students by email tomorrow.',
            },
            {
                title: 'Campus Cafeteria Found Using Expired Ingredients',
                description: 'A health inspection conducted yesterday revealed that the main campus cafeteria has been using expired ingredients in their meals for the past three months. The cafeteria will be shut down starting tomorrow for deep cleaning and restocking.',
            },
            {
                title: 'New Policy: No Classes on Fridays Starting Next Semester',
                description: 'The university board has approved a new policy eliminating all Friday classes starting next semester. The decision was made to improve student mental health and allow more time for independent study and research projects.',
            },
        ];

        const idx = Math.floor(Math.random() * fallbackRumors.length);
        return fallbackRumors[idx];
    }

    try {
        const prompt = `You are generating a TEST rumor for a campus rumor verification platform. 
This rumor must be:
1. Realistic and believable (it should sound like a real campus announcement)
2. COMPLETELY FALSE (it is a test to check if users can identify misinformation)
3. About a university campus topic (policy changes, events, facilities, academics)
4. Not harmful, offensive, or panic-inducing
5. Between 2-4 sentences

Generate a JSON object with "title" and "description" fields. 
Return ONLY the JSON, no other text.

Example format:
{"title": "Short catchy headline", "description": "A realistic but false 2-4 sentence campus rumor."}`;

        const result = await ai.generateContent(prompt);
        const response = result.response.text();

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.title && parsed.description) {
                return parsed;
            }
        }
        throw new Error('Failed to parse AI response');
    } catch (error) {
        console.error('⚠️ Gemini test rumor generation failed, using fallback:', error.message);
        // Use fallback
        return {
            title: 'University Announces Surprise Holiday Next Week',
            description: 'The administration has declared an unexpected holiday next week due to ongoing infrastructure maintenance on campus. All classes and exams are postponed. Students are encouraged to use this time for self-study.',
        };
    }
}

/**
 * Create a test rumor on-chain using the master wallet
 * The master wallet must be registered in IdentityRegistry first
 */
async function createTestRumorOnChain(title, description) {
    const { initializeProvider, createRumor } = require('./blockchainService');
    const { uploadJSON } = require('./ipfsService');

    // 1. Upload content to IPFS
    const rumorContent = {
        title,
        description,
        createdAt: new Date().toISOString(),
        evidenceHashes: [],
        isSystemGenerated: true, // Hidden metadata — not shown to users
    };

    const contentResult = await uploadJSON(rumorContent, 'test-rumor');
    if (!contentResult.success) {
        throw new Error('Failed to upload test rumor to IPFS');
    }

    // 2. Extract keywords
    const { extractKeywords } = require('./geminiService');
    const kwResult = await extractKeywords(`${title} ${description}`);
    const keywords = kwResult.success ? kwResult.keywords : ['test', 'campus'];

    // 3. Create rumor using master wallet private key
    const masterKey = process.env.MASTER_PRIVATE_KEY;
    if (!masterKey) throw new Error('No MASTER_PRIVATE_KEY configured');

    const rumorId = await createRumor(contentResult.hash, [], keywords, masterKey);
    if (!rumorId) throw new Error('Failed to create test rumor on blockchain');

    return rumorId;
}

/**
 * Ensure the master wallet is registered on-chain (needed to post rumors)
 */
async function ensureMasterWalletRegistered() {
    const { initializeProvider, registerStudentOnChain, fundWallet } = require('./blockchainService');
    const { provider, contracts } = initializeProvider();

    if (!contracts.identityRegistry) {
        console.log('⚠️ IdentityRegistry not available — skipping master registration check');
        return false;
    }

    const masterKey = process.env.MASTER_PRIVATE_KEY;
    if (!masterKey) return false;

    const masterWallet = new ethers.Wallet(masterKey, provider);

    try {
        const isRegistered = await contracts.identityRegistry.isRegistered(masterWallet.address);
        if (isRegistered) {
            console.log('✅ Master wallet already registered for test rumor posting');
            return true;
        }

        // Register the master wallet as a system account
        console.log('📝 Registering master wallet for test rumor system...');
        const crypto = require('crypto');
        const secret = process.env.HMAC_SECRET || 'default-hmac-secret';
        const emailHash = '0x' + crypto.createHmac('sha256', secret)
            .update('system-test-rumor@campus.internal')
            .digest('hex');

        await registerStudentOnChain(masterKey, emailHash);
        console.log('✅ Master wallet registered for test rumor system');
        return true;
    } catch (error) {
        console.error('⚠️ Failed to register master wallet:', error.message);
        return false;
    }
}

/**
 * Main function: Generate and post a test rumor
 */
async function generateAndPostTestRumor() {
    console.log('\n🧪 ═══════════════════════════════════════════════');
    console.log('🧪  TEST RUMOR GENERATION STARTED');
    console.log('🧪 ═══════════════════════════════════════════════');

    try {
        // Ensure master wallet is registered
        const registered = await ensureMasterWalletRegistered();
        if (!registered) {
            console.error('❌ Master wallet not registered — cannot post test rumor');
            return null;
        }

        // 1. Generate false rumor via AI
        const falseRumor = await generateFalseRumor();
        console.log(`🧪 Generated test rumor: "${falseRumor.title}"`);

        // 2. Post it on-chain
        const rumorId = await createTestRumorOnChain(falseRumor.title, falseRumor.description);
        console.log(`🧪 Test rumor posted on-chain: ID=${rumorId}`);

        // 3. Track it in database (auto-verify after 3 days)
        const database = initTestDB();
        if (database) {
            const autoVerifyAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
            database.prepare(`
                INSERT INTO test_rumors (rumor_id, title, description, auto_verify_at)
                VALUES (?, ?, ?, ?)
            `).run(rumorId, falseRumor.title, falseRumor.description, autoVerifyAt);
            console.log(`🧪 Scheduled auto-verify at: ${autoVerifyAt}`);
        }

        console.log('🧪 ═══════════════════════════════════════════════');
        console.log('🧪  TEST RUMOR POSTED SUCCESSFULLY');
        console.log(`🧪  Rumor ID: ${rumorId}`);
        console.log(`🧪  Title: "${falseRumor.title}"`);
        console.log('🧪  Users who CONFIRM this will lose credibility!');
        console.log('🧪 ═══════════════════════════════════════════════\n');

        return { rumorId, title: falseRumor.title, description: falseRumor.description };
    } catch (error) {
        console.error('❌ Test rumor generation failed:', error.message);
        return null;
    }
}

/**
 * Auto-verify expired test rumors as FALSE (DEBUNKED)
 * This penalizes users who confirmed the false rumor
 * and rewards users who correctly disputed it.
 */
async function autoVerifyTestRumors() {
    const database = initTestDB();
    if (!database) return;

    try {
        // Find test rumors that are past their auto-verify date
        const pendingRumors = database.prepare(`
            SELECT * FROM test_rumors 
            WHERE verified = 0 AND auto_verify_at <= datetime('now')
        `).all();

        if (pendingRumors.length === 0) return;

        console.log(`\n🧪 Auto-verifying ${pendingRumors.length} test rumor(s) as FALSE...`);

        const { initializeProvider } = require('./blockchainService');
        const { provider, contracts } = initializeProvider();

        // VerificationController ABI (just the verify function)
        const VERIFICATION_ABI = [
            'function verifyRumor(uint256 rumorID, bool isTrue) external',
        ];

        const verificationAddress = process.env.VERIFICATION_CONTROLLER_ADDRESS;
        if (!verificationAddress) {
            console.error('❌ VERIFICATION_CONTROLLER_ADDRESS not set');
            return;
        }

        const masterKey = process.env.MASTER_PRIVATE_KEY;
        if (!masterKey) return;

        const masterWallet = new ethers.Wallet(masterKey, provider);
        const verificationController = new ethers.Contract(
            verificationAddress,
            VERIFICATION_ABI,
            masterWallet
        );

        for (const testRumor of pendingRumors) {
            try {
                console.log(`🧪 Debunking test rumor #${testRumor.rumor_id}: "${testRumor.title}"`);

                // Verify as FALSE — this triggers VerificationController to:
                // - Mark rumor as DEBUNKED
                // - Penalize author (master wallet, but that's fine)
                // - Penalize users who confirmed (lose CRED)
                // - Reward users who disputed (gain CRED)
                const tx = await verificationController.verifyRumor(testRumor.rumor_id, false);
                await tx.wait();

                // Update database
                database.prepare(`
                    UPDATE test_rumors SET verified = 1, verified_at = datetime('now')
                    WHERE id = ?
                `).run(testRumor.id);

                console.log(`✅ Test rumor #${testRumor.rumor_id} DEBUNKED — penalties applied!`);
            } catch (err) {
                console.error(`❌ Failed to debunk test rumor #${testRumor.rumor_id}:`, err.message);
            }
        }
    } catch (error) {
        console.error('❌ Auto-verify test rumors failed:', error.message);
    }
}

/**
 * Get all test rumors (for admin/debug)
 */
function getTestRumors() {
    const database = initTestDB();
    if (!database) return [];
    return database.prepare('SELECT * FROM test_rumors ORDER BY created_at DESC').all();
}

/**
 * Check if a rumor is a test rumor
 */
function isTestRumor(rumorId) {
    const database = initTestDB();
    if (!database) return false;
    const row = database.prepare('SELECT id FROM test_rumors WHERE rumor_id = ?').get(rumorId);
    return !!row;
}

/**
 * Initialize the weekly test rumor scheduler
 * Runs every Monday at 9:00 AM
 * Also checks for test rumors to auto-verify every hour
 */
function startTestRumorScheduler() {
    console.log('🧪 Test Rumor Scheduler initializing...');

    // Check for pending auto-verifications every hour
    setInterval(async () => {
        try {
            await autoVerifyTestRumors();
        } catch (err) {
            console.error('Auto-verify check failed:', err.message);
        }
    }, 60 * 60 * 1000); // Every 1 hour

    // Generate a new test rumor once a week (every 7 days)
    // First run after 10 seconds (to let services initialize)
    // Then every 7 days
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    setTimeout(async () => {
        // Check if there's a recent test rumor (within last 6 days)
        const database = initTestDB();
        if (database) {
            const recent = database.prepare(`
                SELECT id FROM test_rumors 
                WHERE created_at >= datetime('now', '-6 days')
            `).get();

            if (recent) {
                console.log('🧪 Recent test rumor exists — skipping initial generation');
            } else {
                console.log('🧪 No recent test rumor — generating one now');
                await generateAndPostTestRumor();
            }
        }

        // Schedule weekly generation
        setInterval(async () => {
            try {
                await generateAndPostTestRumor();
            } catch (err) {
                console.error('Weekly test rumor generation failed:', err.message);
            }
        }, WEEK_MS);
    }, 10000); // Wait 10 seconds for services to initialize

    // Also run auto-verify check on startup (after 15 seconds)
    setTimeout(async () => {
        try {
            await autoVerifyTestRumors();
        } catch (err) {
            console.error('Initial auto-verify check failed:', err.message);
        }
    }, 15000);

    console.log('🧪 Test Rumor Scheduler started:');
    console.log('   📅 New test rumor: Every 7 days');
    console.log('   ⏰ Auto-verify check: Every 1 hour');
    console.log('   🎯 Auto-debunk after: 3 days');
}

module.exports = {
    generateAndPostTestRumor,
    autoVerifyTestRumors,
    startTestRumorScheduler,
    getTestRumors,
    isTestRumor,
};
