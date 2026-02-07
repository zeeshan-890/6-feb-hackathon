const { ethers } = require('ethers');

let provider = null;
let contracts = {};

// Contract ABIs (simplified for essential functions)
const IDENTITY_REGISTRY_ABI = [
    'event StudentRegistered(uint256 indexed studentID, address indexed wallet, uint256 timestamp)',
    'event StatusChanged(uint256 indexed studentID, uint8 oldStatus, uint8 newStatus)',
    'event CredibilityUpdated(uint256 indexed studentID, uint256 oldScore, uint256 newScore)',
    'function registerStudent(bytes32 emailHMAC, bytes signature) external',
    'function getStudent(address wallet) view returns (tuple(uint256 studentID, address walletAddress, bytes32 emailHMAC, uint256 credibilityScore, uint8 status, uint256 votingPower, uint256 registeredAt, uint256 totalPosts, uint256 totalVotes, uint256 accuratePredictions, uint256 inaccuratePredictions, uint256 discreditedUntil, uint256 postsToday, uint256 lastPostDate, uint256 votesThisHour, uint256 lastVoteHour))',
    'function isRegistered(address wallet) view returns (bool)',
];

const RUMOR_REGISTRY_ABI = [
    'event RumorCreated(uint256 indexed rumorID, uint256 indexed authorID, string contentHash, int256 initialConfidence, uint256 timestamp)',
    'event ConfidenceUpdated(uint256 indexed rumorID, int256 newConfidence, uint256 timestamp)',
    'event RumorLocked(uint256 indexed rumorID, int256 finalConfidence, uint256 timestamp)',
    'event RumorDeleted(uint256 indexed rumorID, uint256 indexed authorID, int256 finalConfidence)',
    'function createRumor(string contentHash, string[] evidenceHashes, string[] keywords) returns (uint256)',
    'function getRumor(uint256 rumorID) view returns (tuple(uint256 rumorID, uint256 authorID, address authorWallet, string contentHash, string[] evidenceHashes, bool hasEvidence, int256 initialConfidence, int256 currentConfidence, int256 lockedConfidence, uint8 status, bool visible, uint256 createdAt, uint256 lockedAt, uint256 totalConfirmVotes, uint256 totalDisputeVotes, int256 weightedConfirmScore, int256 weightedDisputeScore, string[] keywords))',
    'function getTotalRumors() view returns (uint256)',
];

const VOTING_SYSTEM_ABI = [
    'event VoteCast(uint256 indexed voteID, uint256 indexed rumorID, uint256 indexed voterID, uint8 voteType, uint256 weight, uint256 timestamp)',
    'function voteOnRumor(uint256 rumorID, uint8 voteType) external returns (uint256)',
    'function getVote(uint256 voteID) view returns (tuple(uint256 voteID, uint256 rumorID, uint256 voterID, address voterWallet, uint8 voteType, uint256 voterWeight, uint256 voterCredibility, uint256 timestamp))',
    'function getVotesForRumor(uint256 rumorID) view returns (uint256[])',
    'function hasUserVoted(uint256 rumorID, address voter) view returns (bool)',
];

const CORRELATION_MANAGER_ABI = [
    'event CorrelationAdded(uint256 indexed rumorA, uint256 indexed rumorB, uint8 relationshipType, uint256 aiConfidence)',
    'event CorrelationBoostApplied(uint256 indexed rumorID, int256 boost, uint256 credibleSupportCount)',
    'function getRelatedRumors(uint256 rumorID) view returns (uint256[] supportive, uint256[] contradictory)',
];

/**
 * Initialize blockchain provider and contracts
 */
function initializeProvider() {
    if (!provider) {
        const rpcUrl = process.env.POLYGON_AMOY_RPC_URL || 'http://127.0.0.1:8545';
        provider = new ethers.JsonRpcProvider(rpcUrl);

        // Initialize wallet if private key exists (for write operations)
        let wallet = null;
        if (process.env.MASTER_PRIVATE_KEY) {
            wallet = new ethers.Wallet(process.env.MASTER_PRIVATE_KEY, provider);
            console.log('🔐 Master wallet initialized:', wallet.address);
        }

        // Initialize contracts with wallet (if available) or provider (read-only)
        const signerOrProvider = wallet || provider;

        // Initialize contracts if addresses are configured
        if (process.env.IDENTITY_REGISTRY_ADDRESS) {
            contracts.identityRegistry = new ethers.Contract(
                process.env.IDENTITY_REGISTRY_ADDRESS,
                IDENTITY_REGISTRY_ABI,
                signerOrProvider
            );
        }

        if (process.env.RUMOR_REGISTRY_ADDRESS) {
            contracts.rumorRegistry = new ethers.Contract(
                process.env.RUMOR_REGISTRY_ADDRESS,
                RUMOR_REGISTRY_ABI,
                signerOrProvider
            );
        }

        if (process.env.VOTING_SYSTEM_ADDRESS) {
            contracts.votingSystem = new ethers.Contract(
                process.env.VOTING_SYSTEM_ADDRESS,
                VOTING_SYSTEM_ABI,
                signerOrProvider
            );
        }

        if (process.env.CORRELATION_MANAGER_ADDRESS) {
            contracts.correlationManager = new ethers.Contract(
                process.env.CORRELATION_MANAGER_ADDRESS,
                CORRELATION_MANAGER_ABI,
                signerOrProvider
            );
        }
    }

    return { provider, contracts };
}

/**
 * Create a rumor on blockchain
 * @param {string} contentHash - IPFS hash of content
 * @param {string[]} evidenceHashes - IPFS hashes of evidence
 * @param {string[]} keywords - Keywords
 * @param {string} [privateKey] - Optional private key to sign transaction (otherwise uses Master)
 */
async function createRumor(contentHash, evidenceHashes, keywords, privateKey) {
    const { contracts, provider } = initializeProvider();

    if (!contracts.rumorRegistry) {
        throw new Error('RumorRegistry contract not initialized');
    }

    let contractWithSigner = contracts.rumorRegistry;
    if (privateKey) {
        const signer = new ethers.Wallet(privateKey, provider);
        contractWithSigner = contracts.rumorRegistry.connect(signer);
    } else if (!contracts.rumorRegistry.runner) {
        throw new Error('Contract is read-only and no private key provided');
    }

    try {
        console.log('📝 Creating rumor on-chain:', { contentHash, keywords });
        const tx = await contractWithSigner.createRumor(contentHash, evidenceHashes, keywords);
        console.log('⏳ Transaction sent:', tx.hash);

        const receipt = await tx.wait();
        console.log('✅ Transaction confirmed:', receipt.hash);

        // Find RumorCreated event to get ID
        const event = receipt.logs.find(log => {
            try {
                const parsed = contracts.rumorRegistry.interface.parseLog(log);
                return parsed && parsed.name === 'RumorCreated';
            } catch (e) { return false; }
        });

        if (event) {
            const parsed = contracts.rumorRegistry.interface.parseLog(event);
            return parsed.args.rumorID.toString();
        }

        return null;
    } catch (error) {
        console.error('Create rumor error:', error);
        throw error;
    }
}

/**
 * Vote on a rumor
 * @param {number} rumorID - Rumor ID
 * @param {boolean} isConfirm - True for confirm, False for dispute
 * @param {string} [privateKey] - Optional private key
 */
async function voteOnRumor(rumorID, isConfirm, privateKey) {
    const { contracts, provider } = initializeProvider();

    if (!contracts.votingSystem) {
        throw new Error('VotingSystem contract not initialized');
    }

    let contractWithSigner = contracts.votingSystem;
    if (privateKey) {
        const signer = new ethers.Wallet(privateKey, provider);
        contractWithSigner = contracts.votingSystem.connect(signer);
    } else if (!contracts.votingSystem.runner) {
        throw new Error('Contract is read-only and no private key provided');
    }

    try {
        const voteType = isConfirm ? 0 : 1;
        console.log(`🗳️ Voting on rumor ${rumorID}: ${isConfirm ? 'CONFIRM' : 'DISPUTE'}`);

        const tx = await contractWithSigner.voteOnRumor(rumorID, voteType);
        await tx.wait();

        console.log('✅ Vote confirmed');
        return true;
    } catch (error) {
        console.error('Vote error:', error);
        throw error;
    }
}


/**
 * Set up event listeners for blockchain events with reconnection logic
 */
async function initializeBlockchainListeners() {
    try {
        const { provider, contracts } = initializeProvider();

        // Clear existing listeners to avoid duplicates on restart
        if (provider) provider.removeAllListeners();

        console.log('🔄 Initializing blockchain listeners...');

        const setupListener = (contract, eventName, callback) => {
            if (!contract) return;

            // Remove existing listener for this event
            contract.removeAllListeners(eventName);

            // Add new listener with error boundary
            contract.on(eventName, (...args) => {
                try {
                    callback(...args);
                } catch (err) {
                    console.error(`Error in ${eventName} listener:`, err.message);
                }
            });
        };

        if (contracts.identityRegistry) {
            setupListener(contracts.identityRegistry, 'StudentRegistered', (studentID, wallet, timestamp) => {
                console.log(`📝 New student registered: ID=${studentID}, wallet=${wallet}`);
            });

            setupListener(contracts.identityRegistry, 'StatusChanged', (studentID, oldStatus, newStatus) => {
                console.log(`🔄 Status changed: ID=${studentID}, ${oldStatus} → ${newStatus}`);
            });
        }

        if (contracts.rumorRegistry) {
            setupListener(contracts.rumorRegistry, 'RumorCreated', (rumorID, authorID, contentHash, confidence, timestamp) => {
                console.log(`📢 New rumor: ID=${rumorID}, author=${authorID}, confidence=${confidence}`);
            });

            setupListener(contracts.rumorRegistry, 'ConfidenceUpdated', (rumorID, newConfidence, timestamp) => {
                console.log(`📊 Confidence updated: ID=${rumorID}, confidence=${newConfidence}`);
            });

            setupListener(contracts.rumorRegistry, 'RumorLocked', (rumorID, finalConfidence, timestamp) => {
                console.log(`🔒 Rumor locked: ID=${rumorID}, finalConfidence=${finalConfidence}`);
            });
        }

        if (contracts.votingSystem) {
            setupListener(contracts.votingSystem, 'VoteCast', (voteID, rumorID, voterID, voteType, weight, timestamp) => {
                const type = voteType === 0 ? 'CONFIRM' : 'DISPUTE';
                console.log(`🗳️  Vote cast: rumor=${rumorID}, type=${type}, weight=${weight}`);
            });
        }

        // Handle provider connection errors
        provider.on('error', (error) => {
            console.error('Blockchain provider error:', error.message);
            // Attempt to reconnect after delay
            setTimeout(initializeBlockchainListeners, 5000);
        });

        console.log('🔗 Blockchain event listeners initialized');
    } catch (error) {
        console.error('Failed to initialize listeners:', error.message);
        // Retry after delay
        setTimeout(initializeBlockchainListeners, 10000);
    }
}

/**
 * Get student info from blockchain
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<object|null>} Student data or null
 */
async function getStudent(walletAddress) {
    const { contracts } = initializeProvider();

    if (!contracts.identityRegistry) {
        return null;
    }

    try {
        const isRegistered = await contracts.identityRegistry.isRegistered(walletAddress);
        if (!isRegistered) return null;

        const student = await contracts.identityRegistry.getStudent(walletAddress);
        return {
            studentID: student.studentID.toString(),
            walletAddress: student.walletAddress,
            credibilityScore: student.credibilityScore.toString(),
            status: ['NONE', 'NEW_USER', 'CREDIBLE_USER', 'DISCREDITED', 'BLOCKED'][student.status],
            votingPower: student.votingPower.toString(),
            registeredAt: new Date(Number(student.registeredAt) * 1000).toISOString(),
            totalPosts: student.totalPosts.toString(),
            totalVotes: student.totalVotes.toString(),
            accuratePredictions: student.accuratePredictions.toString(),
            inaccuratePredictions: student.inaccuratePredictions.toString(),
        };
    } catch (error) {
        console.error('Error fetching student:', error);
        return null;
    }
}

/**
 * Get rumor from blockchain
 * @param {number} rumorID - Rumor ID
 * @returns {Promise<object|null>} Rumor data or null
 */
async function getRumor(rumorID) {
    const { contracts } = initializeProvider();

    if (!contracts.rumorRegistry) {
        return null;
    }

    try {
        const rumor = await contracts.rumorRegistry.getRumor(rumorID);
        if (rumor.rumorID.toString() === '0') return null;

        return {
            rumorID: rumor.rumorID.toString(),
            authorID: rumor.authorID.toString(),
            authorWallet: rumor.authorWallet,
            contentHash: rumor.contentHash,
            evidenceHashes: rumor.evidenceHashes,
            hasEvidence: rumor.hasEvidence,
            currentConfidence: rumor.currentConfidence.toString(),
            status: ['ACTIVE', 'LOCKED', 'VERIFIED', 'DEBUNKED', 'DELETED'][rumor.status],
            visible: rumor.visible,
            createdAt: new Date(Number(rumor.createdAt) * 1000).toISOString(),
            totalConfirmVotes: rumor.totalConfirmVotes.toString(),
            totalDisputeVotes: rumor.totalDisputeVotes.toString(),
            keywords: rumor.keywords,
        };
    } catch (error) {
        console.error('Error fetching rumor:', error);
        return null;
    }
}

/**
 * Check if user has voted on a rumor
 * @param {number} rumorID - Rumor ID
 * @param {string} walletAddress - Voter wallet
 * @returns {Promise<boolean>}
 */
async function hasUserVoted(rumorID, walletAddress) {
    const { contracts } = initializeProvider();

    if (!contracts.votingSystem) {
        return false;
    }

    try {
        return await contracts.votingSystem.hasUserVoted(rumorID, walletAddress);
    } catch (error) {
        console.error('Error checking vote:', error);
        return false;
    }
}

/**
 * Get related rumors
 * @param {number} rumorID - Rumor ID
 * @returns {Promise<{supportive: string[], contradictory: string[]}>}
 */
async function getRelatedRumors(rumorID) {
    const { contracts } = initializeProvider();

    if (!contracts.correlationManager) {
        return { supportive: [], contradictory: [] };
    }

    try {
        const [supportive, contradictory] = await contracts.correlationManager.getRelatedRumors(rumorID);
        return {
            supportive: supportive.map(id => id.toString()),
            contradictory: contradictory.map(id => id.toString()),
        };
    } catch (error) {
        console.error('Error fetching related rumors:', error);
        return { supportive: [], contradictory: [] };
    }
}

/**
 * Fund a wallet from the master wallet
 */
async function fundWallet(targetAddress, amount = '1.0') {
    const { provider } = initializeProvider();
    if (!process.env.MASTER_PRIVATE_KEY) throw new Error('No MASTER_PRIVATE_KEY');

    const wallet = new ethers.Wallet(process.env.MASTER_PRIVATE_KEY, provider);

    console.log(`💸 Funding ${targetAddress} with ${amount} ETH...`);
    const tx = await wallet.sendTransaction({
        to: targetAddress,
        value: ethers.parseEther(amount)
    });

    await tx.wait();
    console.log(`✅ Funded: ${tx.hash}`);
    return tx.hash;
}

/**
 * Register a student on-chain using their private key
 */
async function registerStudentOnChain(privateKey, emailHash) {
    const { contracts, provider } = initializeProvider();
    const userWallet = new ethers.Wallet(privateKey, provider);

    // Ensure emailHash is 0x-prefixed for ethers bytes32
    const emailHashBytes = emailHash.startsWith('0x') ? emailHash : '0x' + emailHash;

    // 1. Recover signature for IdentityRegistry
    // The contract verifies: signer == msg.sender
    // It also checks signature of (emailHMAC + msg.sender)
    // Actually, check IdentityRegistry.sol:
    // bytes32 messageHash = keccak256(abi.encodePacked(emailHMAC, msg.sender));
    // bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
    // address signer = ethSignedHash.recover(signature);

    const messageHash = ethers.solidityPackedKeccak256(['bytes32', 'address'], [emailHashBytes, userWallet.address]);
    const signature = await userWallet.signMessage(ethers.getBytes(messageHash));

    // 2. Register
    const contractWithSigner = contracts.identityRegistry.connect(userWallet);
    console.log(`📝 Registering student on-chain: ${userWallet.address}`);

    const tx = await contractWithSigner.registerStudent(emailHashBytes, signature);
    await tx.wait();
    console.log(`✅ Student registered on-chain: ${tx.hash}`);
    return tx.hash;
}

module.exports = {
    initializeProvider,
    initializeBlockchainListeners,
    getStudent,
    getRumor,
    hasUserVoted,
    getRelatedRumors,
    createRumor,
    voteOnRumor,
    fundWallet,
    registerStudentOnChain,
};
