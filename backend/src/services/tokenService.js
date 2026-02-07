const crypto = require('crypto');
const path = require('path');

let db = null;

/**
 * Initialize SQLite database
 */
function initDatabase() {
    if (db) return db;

    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '../../data/tokens.db');

        // Ensure data directory exists
        const fs = require('fs');
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        db = new Database(dbPath);

        // Create table
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_hash TEXT UNIQUE NOT NULL,
                email_hash TEXT UNIQUE NOT NULL,
                wallet_address TEXT,
                private_key_enc TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check columns to migrate schema if needed (simple check)
        try {
            const info = db.pragma('table_info(users)');
            const hasWallet = info.some(c => c.name === 'wallet_address');
            if (!hasWallet) {
                console.log('🔄 Migrating database schema...');
                db.exec('ALTER TABLE users ADD COLUMN wallet_address TEXT');
                db.exec('ALTER TABLE users ADD COLUMN private_key_enc TEXT');
            }
        } catch (e) {
            console.error('Schema migration error:', e);
        }

        // TEMPORARY: Clear database on start (Requested by user)
        // try {
        //     db.exec('DELETE FROM users');
        //     console.log('⚠️  DATABASE CLEARED: All users deleted.');
        // } catch (e) {
        //     console.error('Error clearing users:', e);
        // }

        console.log('✅ SQLite database initialized at:', dbPath);
        return db;
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        return null;
    }
}

/**
 * Generate a unique user token (32 bytes = 64 hex chars)
 */
function generateUserToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage (we don't store raw tokens)
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Hash an email for storage (privacy)
 */
/**
 * Hash an email for storage (privacy)
 */
function hashEmail(email) {
    const secret = process.env.HMAC_SECRET || 'default-hmac-secret';
    return crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex');
}

/**
 * Encrypt private key
 */
function encryptPrivateKey(privateKey) {
    const secret = process.env.HMAC_SECRET || 'default-hmac-secret';
    // Use a simple encryption for this hackathon (XOR or AES)
    // For better security use proper AES-256-GCM
    // Here we use simple AES-256-CBC with fixed IV (not production secure but suffices for demo)
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(secret).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt private key
 */
function decryptPrivateKey(encryptedData) {
    if (!encryptedData) return null;
    try {
        const secret = process.env.HMAC_SECRET || 'default-hmac-secret';
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];
        const key = crypto.createHash('sha256').update(secret).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('Decryption failed:', e);
        return null;
    }
}

/**
 * Register a new user after email verification
 * @param {string} email - Verified email address
 * @returns {{token: string, emailHash: string, displayEmail: string}}
 */
/**
 * Register a new user after email verification
 * @param {string} email - Verified email address
 * @returns {{token: string, emailHash: string, displayEmail: string, walletAddress: string}}
 */
function registerUser(email) {
    const token = generateUserToken();
    const tokenHash = hashToken(token);
    const emailHash = hashEmail(email);
    const displayEmail = email.split('@')[0] + '@...';

    // Generate Wallet
    const { ethers } = require('ethers');
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKeyEnc = encryptPrivateKey(wallet.privateKey);

    const database = initDatabase();
    if (database) {
        try {
            // Check if user already exists to preserve wallet
            const check = database.prepare('SELECT wallet_address, private_key_enc FROM users WHERE email_hash = ?').get(emailHash);

            let stmt;
            if (check && check.wallet_address) {
                // Return existing wallet but new token
                stmt = database.prepare(`
                    UPDATE users SET token_hash = ? WHERE email_hash = ?
                `);
                stmt.run(tokenHash, emailHash);
                // Return existing wallet
                return { token, emailHash, displayEmail, walletAddress: check.wallet_address };
            } else {
                // New user
                stmt = database.prepare(`
                    INSERT INTO users (token_hash, email_hash, wallet_address, private_key_enc) 
                    VALUES (?, ?, ?, ?)
                `);
                stmt.run(tokenHash, emailHash, walletAddress, privateKeyEnc);
            }
            console.log(`✅ User registered: ${displayEmail} with wallet ${walletAddress}`);
        } catch (error) {
            console.error('Database insert error:', error.message);
        }
    }

    console.log(`🔑 Token generated: ${token.substring(0, 8)}...`);

    return { token, emailHash, displayEmail, walletAddress };
}

/**
 * Verify a token and get user info
 * @param {string} token - User's token
 * @returns {{valid: boolean, user?: object, error?: string}}
 */
function verifyUserToken(token) {
    if (!token || token.length !== 64) {
        return { valid: false, error: 'Invalid token format' };
    }

    const tokenHash = hashToken(token);
    const database = initDatabase();

    if (database) {
        try {
            const stmt = database.prepare('SELECT email_hash, wallet_address, created_at FROM users WHERE token_hash = ?');
            const row = stmt.get(tokenHash);

            if (row) {
                return {
                    valid: true,
                    user: {
                        emailHash: row.email_hash,
                        walletAddress: row.wallet_address,
                        // DO NOT RETURN PRIVATE KEY
                        createdAt: row.created_at,
                    },
                };
            }
        } catch (error) {
            console.error('Database query error:', error.message);
        }
    }

    return { valid: false, error: 'Token not found' };
}

/**
 * Check if email is already registered
 * @param {string} email - Email to check
 * @returns {boolean}
 */
function isEmailRegistered(email) {
    const emailHash = hashEmail(email);
    const database = initDatabase();

    if (database) {
        try {
            const stmt = database.prepare('SELECT 1 FROM users WHERE email_hash = ?');
            const row = stmt.get(emailHash);
            return !!row;
        } catch (error) {
            console.error('Database query error:', error.message);
        }
    }

    return false;
}

/**
 * Get all users count
 */
function getUserCount() {
    const database = initDatabase();
    if (database) {
        try {
            const stmt = database.prepare('SELECT COUNT(*) as count FROM users');
            return stmt.get().count;
        } catch (error) {
            return 0;
        }
    }
    return 0;
}

// Initialize on module load
initDatabase();

module.exports = {
    generateUserToken,
    hashToken,
    hashEmail,
    registerUser,
    verifyUserToken,
    isEmailRegistered,
    getUserCount,
    initDatabase,
    decryptPrivateKey, // Export for blockchainService
    // We also need a way to get private key by token hash internally
    exportPrivateKey: (token) => {
        const tokenHash = hashToken(token);
        const db = initDatabase();
        const row = db.prepare('SELECT private_key_enc FROM users WHERE token_hash = ?').get(tokenHash);
        if (row && row.private_key_enc) return decryptPrivateKey(row.private_key_enc);
        return null;
    }
};
