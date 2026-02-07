const crypto = require('crypto');
const nodemailer = require('nodemailer');

// In-memory store for verification codes (in production, use Redis)
const verificationCodes = new Map();
const CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes

// HMAC secret for email hashing
const HMAC_SECRET = process.env.HMAC_SECRET || 'default-hmac-secret';

// Email transporter
let transporter = null;

function initializeTransporter() {
    if (!transporter && process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    return transporter;
}

/**
 * Generate a 6-digit verification code
 */
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Calculate HMAC of an email address
 * @param {string} email - Email address to hash
 * @returns {string} HMAC hex string
 */
function generateEmailHMAC(email) {
    const normalizedEmail = email.toLowerCase().trim();
    return crypto.createHmac('sha256', HMAC_SECRET).update(normalizedEmail).digest('hex');
}

/**
 * Check if email is a valid Pakistani university email
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid .edu.pk email
 */
function isUniversityEmail(email) {
    const normalizedEmail = email.toLowerCase().trim();

    // Allow all Pakistani university emails (.edu.pk)
    return normalizedEmail.endsWith('.edu.pk');
}

/**
 * Send verification code to email
 * @param {string} email - Email address to send code to
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendVerificationCode(email) {
    if (!isUniversityEmail(email)) {
        return { success: false, message: 'Please use a valid Pakistani university email (.edu.pk)' };
    }

    const code = generateCode();
    const expiresAt = Date.now() + CODE_EXPIRY;

    // Store code with expiry
    verificationCodes.set(email.toLowerCase(), {
        code,
        expiresAt,
        attempts: 0,
    });

    // Send email
    const emailTransporter = initializeTransporter();

    if (!emailTransporter) {
        // Development mode - just log the code
        console.log(`📧 Verification code for ${email}: ${code}`);
        return { success: true, message: 'Verification code sent', code: process.env.NODE_ENV === 'development' ? code : undefined };
    }

    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@campusrumors.xyz',
            to: email,
            subject: 'Campus Rumor Verification - Email Verification Code',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Campus Rumor Verification</h2>
          <p>Your verification code is:</p>
          <h1 style="font-size: 36px; letter-spacing: 8px; color: #1F2937; background: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px;">
            ${code}
          </h1>
          <p style="color: #6B7280;">This code expires in 10 minutes.</p>
          <p style="color: #6B7280; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
        });

        return { success: true, message: 'Verification code sent to your email', code: process.env.NODE_ENV === 'development' ? code : undefined };
    } catch (error) {
        console.error('Email sending failed:', error);
        return { success: false, message: 'Failed to send verification email' };
    }
}

/**
 * Verify a code for an email
 * @param {string} email - Email address
 * @param {string} code - Verification code
 * @returns {{success: boolean, message: string, hmac?: string}}
 */
function verifyCode(email, code) {
    const normalizedEmail = email.toLowerCase();
    const stored = verificationCodes.get(normalizedEmail);

    if (!stored) {
        return { success: false, message: 'No verification code found. Please request a new one.' };
    }

    if (Date.now() > stored.expiresAt) {
        verificationCodes.delete(normalizedEmail);
        return { success: false, message: 'Verification code expired. Please request a new one.' };
    }

    stored.attempts++;

    if (stored.attempts > 5) {
        verificationCodes.delete(normalizedEmail);
        return { success: false, message: 'Too many attempts. Please request a new code.' };
    }

    if (stored.code !== code) {
        return { success: false, message: 'Invalid verification code' };
    }

    // Success - generate HMAC and delete the code
    const hmac = generateEmailHMAC(normalizedEmail);
    verificationCodes.delete(normalizedEmail);

    return {
        success: true,
        message: 'Email verified successfully',
        hmac: '0x' + hmac, // Return as hex string for blockchain
    };
}

/**
 * Create verification token (for temporary session)
 * @param {string} hmac - Email HMAC
 * @returns {string} Temporary token
 */
function createVerificationToken(hmac) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + CODE_EXPIRY;

    // Store token -> hmac mapping
    verificationCodes.set(`token:${token}`, { hmac, expiresAt });

    return token;
}

/**
 * Validate verification token
 * @param {string} token - Token to validate
 * @returns {{valid: boolean, hmac?: string}}
 */
function validateToken(token) {
    const stored = verificationCodes.get(`token:${token}`);

    if (!stored) {
        return { valid: false };
    }

    if (Date.now() > stored.expiresAt) {
        verificationCodes.delete(`token:${token}`);
        return { valid: false };
    }

    return { valid: true, hmac: stored.hmac };
}

/**
 * Consume verification token (one-time use)
 * @param {string} token - Token to consume
 * @returns {{valid: boolean, hmac?: string}}
 */
function consumeToken(token) {
    const result = validateToken(token);
    if (result.valid) {
        verificationCodes.delete(`token:${token}`);
    }
    return result;
}

/**
 * Send the permanent token to the user via email
 * @param {string} email - Recipient email
 * @param {string} token - The permanent token
 * @returns {Promise<boolean>} Success status
 */
async function sendTokenEmail(email, token) {
    const emailTransporter = initializeTransporter();

    if (!emailTransporter) {
        console.log(`📧 Token email for ${email}: ${token}`);
        return true;
    }

    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@campusrumors.xyz',
            to: email,
            subject: 'Your Campus Rumors Login Token 🔑',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Welcome to Campus Rumors!</h2>
          <p>Your anonymous identity has been created successfully.</p>
          <p><strong>This acts as your password. Do not share it.</strong></p>
          
          <div style="background: #1F2937; color: #10B981; padding: 20px; border-radius: 8px; margin: 20px 0; word-break: break-all; font-family: monospace;">
            ${token}
          </div>

          <p style="color: #6B7280;">You can use this token to login from any device.</p>
        </div>
      `,
        });
        console.log(`✅ Token email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Failed to send token email:', error);
        return false;
    }
}

module.exports = {
    sendVerificationCode,
    verifyCode,
    generateEmailHMAC,
    isUniversityEmail,
    createVerificationToken,
    validateToken,
    consumeToken,
    sendTokenEmail,
};
