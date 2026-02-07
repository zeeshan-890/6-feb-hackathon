// Contract ABIs for frontend integration
// Simplified ABIs containing only the functions we need

export const IDENTITY_REGISTRY_ABI = [
    // Events
    "event StudentRegistered(uint256 indexed studentID, address indexed wallet, uint256 timestamp)",
    "event StatusChanged(uint256 indexed studentID, uint8 oldStatus, uint8 newStatus)",
    "event CredibilityUpdated(uint256 indexed studentID, uint256 oldScore, uint256 newScore)",

    // Read functions
    "function getStudent(address wallet) view returns (tuple(uint256 studentID, address walletAddress, bytes32 emailHMAC, uint256 credibilityScore, uint8 status, uint256 votingPower, uint256 registeredAt, uint256 totalPosts, uint256 totalVotes, uint256 accuratePredictions, uint256 inaccuratePredictions, uint256 discreditedUntil, uint256 postsToday, uint256 lastPostDate, uint256 votesThisHour, uint256 lastVoteHour))",
    "function isRegistered(address wallet) view returns (bool)",
    "function getVotingWeight(address wallet) view returns (uint256)",
    "function canPost(address wallet) view returns (bool canPost, bool requiresEvidence)",
    "function totalStudents() view returns (uint256)",

    // Write functions
    "function registerStudent(bytes32 emailHMAC, bytes memory walletSignature) external",
];

export const RUMOR_REGISTRY_ABI = [
    // Events
    "event RumorCreated(uint256 indexed rumorID, uint256 indexed authorID, string contentHash, int256 initialConfidence, uint256 timestamp)",
    "event ConfidenceUpdated(uint256 indexed rumorID, int256 newConfidence, uint256 timestamp)",
    "event RumorLocked(uint256 indexed rumorID, int256 finalConfidence, uint256 timestamp)",
    "event RumorDeleted(uint256 indexed rumorID, uint256 indexed authorID, int256 finalConfidence)",

    // Read functions
    "function getRumor(uint256 rumorID) view returns (tuple(uint256 rumorID, uint256 authorID, address authorWallet, string contentHash, string[] evidenceHashes, bool hasEvidence, int256 initialConfidence, int256 currentConfidence, int256 lockedConfidence, uint8 status, bool visible, uint256 createdAt, uint256 lockedAt, uint256 totalConfirmVotes, uint256 totalDisputeVotes, int256 weightedConfirmScore, int256 weightedDisputeScore, string[] keywords))",
    "function getTotalRumors() view returns (uint256)",
    "function isRumorActive(uint256 rumorID) view returns (bool)",

    // Write functions
    "function createRumor(string memory contentIPFSHash, string[] memory evidenceIPFSHashes, string[] memory keywords) external returns (uint256)",
    "function deleteRumor(uint256 rumorID) external",
];

export const VOTING_SYSTEM_ABI = [
    // Events
    "event VoteCast(uint256 indexed voteID, uint256 indexed rumorID, uint256 indexed voterID, uint8 voteType, uint256 weight, uint256 timestamp)",

    // Read functions
    "function getVote(uint256 voteID) view returns (tuple(uint256 voteID, uint256 rumorID, uint256 voterID, address voterWallet, uint8 voteType, uint256 voterWeight, uint256 voterCredibility, uint256 timestamp))",
    "function getVotesForRumor(uint256 rumorID) view returns (uint256[])",
    "function hasUserVoted(uint256 rumorID, address voter) view returns (bool)",
    "function totalVotes() view returns (uint256)",

    // Write functions  
    "function voteOnRumor(uint256 rumorID, uint8 voteType) external returns (uint256)",
];

export const CREDIBILITY_TOKEN_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
];

// Contract addresses from environment
export const CONTRACT_ADDRESSES = {
    IDENTITY_REGISTRY: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || '',
    CREDIBILITY_TOKEN: process.env.NEXT_PUBLIC_CREDIBILITY_TOKEN_ADDRESS || '',
    RUMOR_REGISTRY: process.env.NEXT_PUBLIC_RUMOR_REGISTRY_ADDRESS || '',
    VOTING_SYSTEM: process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS || '',
};
