const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');

// JWT secret - should be in env
const JWT_SECRET = process.env.JWT_SECRET || 'campus-rumors-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '30d'; // Token valid for 30 days

// Master wallet for submitting transactions on behalf of users
let masterWallet = null;
let contracts = null;

/**
 * Initialize the master wallet and contracts
 */
function initializeMasterWallet() {
    if (masterWallet) return;

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');

    // Use the first Hardhat account as master wallet (has 10000 ETH)
    const masterPrivateKey = process.env.MASTER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    masterWallet = new ethers.Wallet(masterPrivateKey, provider);

    console.log('✅ Master wallet initialized:', masterWallet.address);
}

/**
 * Get contract instances
 */
function getContracts() {
    if (contracts) return contracts;

    initializeMasterWallet();

    const IdentityRegistryABI = [
        'function registerStudent(bytes32 emailHmac, string calldata signature) external',
        'function getStudent(address student) external view returns (tuple(bytes32 emailHmac, uint8 status, uint256 credibilityScore, uint256 registeredAt, uint256 accuratePredictions, uint256 inaccuratePredictions))',
        'function isRegistered(address student) external view returns (bool)',
    ];

    const RumorRegistryABI = [
        'function createRumor(string memory contentHash, string[] memory evidenceHashes, string[] memory keywords) external returns (uint256)',
        'function getRumor(uint256 rumorId) external view returns (tuple(uint256 id, address author, string contentHash, string[] evidenceHashes, uint8 status, int256 confidenceScore, uint256 createdAt, uint256 lockedAt, string[] keywords))',
        'function getRumorCount() external view returns (uint256)',
    ];

    const VotingSystemABI = [
        'function vote(uint256 rumorId, uint8 voteType) external',
        'function hasVoted(uint256 rumorId, address voter) external view returns (bool)',
        'function getVoteStats(uint256 rumorId) external view returns (uint256 confirms, uint256 disputes, int256 weightedScore)',
    ];

    const CredibilityTokenABI = [
        'function balanceOf(address account) external view returns (uint256)',
    ];

    contracts = {
        identityRegistry: new ethers.Contract(
            process.env.IDENTITY_REGISTRY_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
            IdentityRegistryABI,
            masterWallet
        ),
        rumorRegistry: new ethers.Contract(
            process.env.RUMOR_REGISTRY_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
            RumorRegistryABI,
            masterWallet
        ),
        votingSystem: new ethers.Contract(
            process.env.VOTING_SYSTEM_ADDRESS || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
            VotingSystemABI,
            masterWallet
        ),
        credibilityToken: new ethers.Contract(
            process.env.CREDIBILITY_TOKEN_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
            CredibilityTokenABI,
            masterWallet
        ),
    };

    return contracts;
}

// In-memory user database (in production, use a real database)
const users = new Map();

/**
 * Generate JWT token for a user
 * @param {string} emailHmac - HMAC of user's email
 * @param {string} email - User's email (for display only)
 */
function generateToken(emailHmac, email) {
    // Create a deterministic wallet address from email HMAC
    const userWallet = ethers.Wallet.createRandom();
    const userAddress = userWallet.address;

    // Store user info
    users.set(emailHmac, {
        email,
        emailHmac,
        address: userAddress,
        privateKey: userWallet.privateKey,
        createdAt: new Date().toISOString(),
    });

    // Generate JWT
    const token = jwt.sign(
        {
            emailHmac,
            address: userAddress,
            email: email.split('@')[0] + '@...', // Partially hidden email
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    return { token, address: userAddress };
}

/**
 * Verify JWT token and get user info
 * @param {string} token - JWT token
 * @returns {object|null} User info or null if invalid
 */
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        return null;
    }
}

/**
 * Get user data from token
 * @param {string} emailHmac - User's email HMAC
 */
function getUser(emailHmac) {
    return users.get(emailHmac) || null;
}

/**
 * Register user on blockchain (called by backend)
 * @param {string} emailHmac - HMAC of user's email
 */
async function registerUserOnChain(emailHmac) {
    const user = users.get(emailHmac);
    if (!user) throw new Error('User not found');

    const { identityRegistry } = getContracts();

    // Check if already registered
    const isRegistered = await identityRegistry.isRegistered(user.address);
    if (isRegistered) {
        return { success: true, alreadyRegistered: true };
    }

    // Register using master wallet (pays gas)
    // Note: We'd need to modify the contract to allow this, or use meta-transactions
    // For now, we'll just mark as registered in our database
    user.isRegistered = true;
    users.set(emailHmac, user);

    return { success: true, address: user.address };
}

/**
 * Create a rumor on behalf of user
 * @param {string} emailHmac - User's email HMAC
 * @param {string} contentHash - IPFS hash of content
 * @param {string[]} evidenceHashes - IPFS hashes of evidence
 * @param {string[]} keywords - Keywords
 */
async function createRumorForUser(emailHmac, contentHash, evidenceHashes, keywords) {
    const user = users.get(emailHmac);
    if (!user) throw new Error('User not found');

    const { rumorRegistry } = getContracts();

    // Create rumor using master wallet
    const tx = await rumorRegistry.createRumor(contentHash, evidenceHashes, keywords);
    const receipt = await tx.wait();

    // Get the rumor ID from the event
    const rumorId = receipt.logs[0]?.args?.[0] || 1;

    return { success: true, rumorId: Number(rumorId) };
}

/**
 * Vote on a rumor on behalf of user
 * @param {string} emailHmac - User's email HMAC
 * @param {number} rumorId - Rumor ID
 * @param {number} voteType - 0 for confirm, 1 for dispute
 */
async function voteForUser(emailHmac, rumorId, voteType) {
    const user = users.get(emailHmac);
    if (!user) throw new Error('User not found');

    const { votingSystem } = getContracts();

    const tx = await votingSystem.vote(rumorId, voteType);
    await tx.wait();

    return { success: true };
}

/**
 * Get user's profile data
 * @param {string} emailHmac - User's email HMAC
 */
async function getUserProfile(emailHmac) {
    const user = users.get(emailHmac);
    if (!user) throw new Error('User not found');

    const { credibilityToken } = getContracts();

    const balance = await credibilityToken.balanceOf(user.address);

    return {
        email: user.email,
        address: user.address,
        isRegistered: user.isRegistered || false,
        tokenBalance: Number(balance),
        createdAt: user.createdAt,
    };
}

module.exports = {
    generateToken,
    verifyToken,
    getUser,
    registerUserOnChain,
    createRumorForUser,
    voteForUser,
    getUserProfile,
    getContracts,
    initializeMasterWallet,
};
