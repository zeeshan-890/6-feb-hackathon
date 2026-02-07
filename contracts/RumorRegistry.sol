// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IdentityRegistry.sol";

/**
 * @title RumorRegistry
 * @dev Manages rumor creation, confidence scoring, locking, and deletion.
 * Works with IPFS for content storage and IdentityRegistry for author validation.
 */
contract RumorRegistry is Ownable {
    // Rumor status enum
    enum RumorStatus {
        ACTIVE,     // Open for voting
        LOCKED,     // Voting closed, score frozen
        VERIFIED,   // Confirmed true by verification
        DEBUNKED,   // Confirmed false by verification
        DELETED     // Soft deleted by author
    }

    // Rumor struct
    struct Rumor {
        uint256 rumorID;
        uint256 authorID;
        address authorWallet;
        string contentHash;          // IPFS hash of rumor content
        string[] evidenceHashes;     // IPFS hashes of evidence files
        bool hasEvidence;
        int256 initialConfidence;
        int256 currentConfidence;
        int256 lockedConfidence;
        RumorStatus status;
        bool visible;
        uint256 createdAt;
        uint256 lockedAt;
        uint256 totalConfirmVotes;
        uint256 totalDisputeVotes;
        int256 weightedConfirmScore;
        int256 weightedDisputeScore;
        string[] keywords;
    }

    // Tombstone for deleted rumors
    struct Tombstone {
        uint256 originalRumorID;
        int256 finalConfidence;
        uint256 voteCount;
        uint256[] relatedRumorIDs;
        uint256 deletedAt;
        uint256 deletedBy;
        bool trustRedistributed;
    }

    // State variables
    IdentityRegistry public identityRegistry;
    uint256 public nextRumorID = 1;
    uint256 public constant LOCK_DURATION = 7 days;
    int256 public constant MAX_CONFIDENCE = 100;
    int256 public constant MIN_CONFIDENCE = -100;

    // Mappings
    mapping(uint256 => Rumor) public rumors;
    mapping(uint256 => Tombstone) public tombstones;
    mapping(uint256 => uint256[]) public rumorsByAuthor;
    mapping(address => bool) public authorizedCallers;

    // Events
    event RumorCreated(
        uint256 indexed rumorID,
        uint256 indexed authorID,
        string contentHash,
        int256 initialConfidence,
        uint256 timestamp
    );
    event ConfidenceUpdated(uint256 indexed rumorID, int256 newConfidence, uint256 timestamp);
    event RumorLocked(uint256 indexed rumorID, int256 finalConfidence, uint256 timestamp);
    event RumorVerified(uint256 indexed rumorID, bool isTrue, uint256 timestamp);
    event RumorDeleted(uint256 indexed rumorID, uint256 indexed authorID, int256 finalConfidence);
    event TrustTransferred(uint256 indexed sourceRumorID, uint256 indexed targetRumorID, int256 amount);

    modifier onlyAuthorized() {
        require(msg.sender == owner() || authorizedCallers[msg.sender], "Not authorized");
        _;
    }

    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IdentityRegistry(_identityRegistry);
    }

    function addAuthorizedCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = true;
    }

    function removeAuthorizedCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
    }

    /**
     * @dev Create a new rumor
     * @param contentIPFSHash IPFS hash of the rumor content
     * @param evidenceIPFSHashes Array of IPFS hashes for evidence files
     * @param keywords Extracted keywords for correlation
     */
    function createRumor(
        string calldata contentIPFSHash,
        string[] calldata evidenceIPFSHashes,
        string[] calldata keywords
    ) external returns (uint256) {
        // Get author info from identity registry
        IdentityRegistry.Student memory author = identityRegistry.getStudent(msg.sender);
        require(author.studentID != 0, "Author not registered");
        require(author.status != IdentityRegistry.UserStatus.BLOCKED, "Author is blocked");

        // Check posting limits
        (bool canPost, ) = identityRegistry.canPost(msg.sender);
        require(canPost, "Posting limit reached");
        
        bool hasEvidence = evidenceIPFSHashes.length > 0;
        // Evidence is encouraged (affects confidence score) but not required

        // Calculate initial confidence
        int256 initialConfidence = _calculateInitialConfidence(
            author.status,
            hasEvidence,
            evidenceIPFSHashes.length
        );

        // Create rumor
        uint256 rumorID = nextRumorID++;
        
        rumors[rumorID] = Rumor({
            rumorID: rumorID,
            authorID: author.studentID,
            authorWallet: msg.sender,
            contentHash: contentIPFSHash,
            evidenceHashes: evidenceIPFSHashes,
            hasEvidence: hasEvidence,
            initialConfidence: initialConfidence,
            currentConfidence: initialConfidence,
            lockedConfidence: 0,
            status: RumorStatus.ACTIVE,
            visible: true,
            createdAt: block.timestamp,
            lockedAt: 0,
            totalConfirmVotes: 0,
            totalDisputeVotes: 0,
            weightedConfirmScore: 0,
            weightedDisputeScore: 0,
            keywords: keywords
        });

        rumorsByAuthor[author.studentID].push(rumorID);

        // Update author's post count
        identityRegistry.incrementPostCount(msg.sender);

        emit RumorCreated(rumorID, author.studentID, contentIPFSHash, initialConfidence, block.timestamp);

        return rumorID;
    }

    /**
     * @dev Calculate initial confidence based on author status and evidence
     */
    function _calculateInitialConfidence(
        IdentityRegistry.UserStatus status,
        bool hasEvidence,
        uint256 evidenceCount
    ) internal pure returns (int256) {
        // All rumors start with DECREASED confidence on submission.
        // Evidence reduces the penalty but never makes it positive.
        // If later verified true → author gets double reward.
        // If verified false → author gets further penalty.
        int256 evidenceReduction = hasEvidence ? int256(5 * evidenceCount) : int256(0);
        
        if (status == IdentityRegistry.UserStatus.NEW_USER) {
            // New user: starts very negative
            return -20 + evidenceReduction; // -20 without evidence, -15 with 1 evidence
        } else if (status == IdentityRegistry.UserStatus.CREDIBLE_USER) {
            // Credible user: starts moderately negative
            return -10 + evidenceReduction; // -10 without evidence, -5 with 1 evidence
        } else if (status == IdentityRegistry.UserStatus.DISCREDITED) {
            // Discredited user: starts heavily negative
            return -30 + evidenceReduction; // -30 without evidence, -25 with 1 evidence
        }
        
        return -15; // Default: negative
    }

    /**
     * @dev Record a vote on a rumor (called by VotingSystem)
     * @param rumorID Rumor being voted on
     * @param isConfirm True for confirm, false for dispute
     * @param weight Weighted vote value
     */
    function recordVote(uint256 rumorID, bool isConfirm, int256 weight) external onlyAuthorized {
        Rumor storage rumor = rumors[rumorID];
        require(rumor.rumorID != 0, "Rumor does not exist");
        require(rumor.status == RumorStatus.ACTIVE, "Rumor not active");

        if (isConfirm) {
            rumor.totalConfirmVotes++;
            rumor.weightedConfirmScore += weight;
        } else {
            rumor.totalDisputeVotes++;
            rumor.weightedDisputeScore += weight;
        }

        // Recalculate confidence
        _updateConfidence(rumorID);
    }

    /**
     * @dev Update rumor confidence based on votes
     */
    function _updateConfidence(uint256 rumorID) internal {
        Rumor storage rumor = rumors[rumorID];
        
        int256 voteScore = rumor.weightedConfirmScore - rumor.weightedDisputeScore;
        int256 newConfidence = rumor.initialConfidence + voteScore;

        // Check if should be locked
        if (block.timestamp >= rumor.createdAt + LOCK_DURATION && rumor.status == RumorStatus.ACTIVE) {
            rumor.status = RumorStatus.LOCKED;
            rumor.lockedConfidence = newConfidence;
            rumor.lockedAt = block.timestamp;
            rumor.visible = false;
            
            emit RumorLocked(rumorID, newConfidence, block.timestamp);
        } else if (rumor.status == RumorStatus.LOCKED) {
            // Already locked: new votes only affect 5%
            newConfidence = (rumor.lockedConfidence * 95 + newConfidence * 5) / 100;
        }

        // Clamp to range
        if (newConfidence > MAX_CONFIDENCE) newConfidence = MAX_CONFIDENCE;
        if (newConfidence < MIN_CONFIDENCE) newConfidence = MIN_CONFIDENCE;

        rumor.currentConfidence = newConfidence;

        emit ConfidenceUpdated(rumorID, newConfidence, block.timestamp);
    }

    /**
     * @dev Lock a rumor (called by AutomationKeeper or manually)
     * @param rumorID Rumor to lock
     */
    function lockRumor(uint256 rumorID) external {
        Rumor storage rumor = rumors[rumorID];
        require(rumor.rumorID != 0, "Rumor does not exist");
        require(rumor.status == RumorStatus.ACTIVE, "Rumor not active");
        require(block.timestamp >= rumor.createdAt + LOCK_DURATION, "Lock duration not reached");

        rumor.status = RumorStatus.LOCKED;
        rumor.lockedConfidence = rumor.currentConfidence;
        rumor.lockedAt = block.timestamp;
        rumor.visible = false;

        emit RumorLocked(rumorID, rumor.currentConfidence, block.timestamp);
    }

    /**
     * @dev Delete a rumor (soft delete with tombstone)
     * @param rumorID Rumor to delete
     */
    function deleteRumor(uint256 rumorID) external {
        Rumor storage rumor = rumors[rumorID];
        require(rumor.rumorID != 0, "Rumor does not exist");
        require(rumor.authorWallet == msg.sender, "Only author can delete");
        require(rumor.status != RumorStatus.LOCKED, "Cannot delete locked rumor");

        // Create tombstone
        tombstones[rumorID] = Tombstone({
            originalRumorID: rumorID,
            finalConfidence: rumor.currentConfidence,
            voteCount: rumor.totalConfirmVotes + rumor.totalDisputeVotes,
            relatedRumorIDs: new uint256[](0),
            deletedAt: block.timestamp,
            deletedBy: rumor.authorID,
            trustRedistributed: false
        });

        rumor.status = RumorStatus.DELETED;
        rumor.visible = false;

        emit RumorDeleted(rumorID, rumor.authorID, rumor.currentConfidence);
    }

    /**
     * @dev Set verification result (called by VerificationController)
     * @param rumorID Rumor to verify
     * @param isTrue True if verified, false if debunked
     */
    function setVerificationResult(uint256 rumorID, bool isTrue) external onlyAuthorized {
        Rumor storage rumor = rumors[rumorID];
        require(rumor.rumorID != 0, "Rumor does not exist");

        rumor.status = isTrue ? RumorStatus.VERIFIED : RumorStatus.DEBUNKED;
        rumor.lockedConfidence = rumor.currentConfidence;
        rumor.lockedAt = block.timestamp;

        emit RumorVerified(rumorID, isTrue, block.timestamp);
    }

    /**
     * @dev Apply correlation boost (called by CorrelationManager)
     * @param rumorID Rumor to boost
     * @param boost Boost amount
     */
    function applyCorrelationBoost(uint256 rumorID, int256 boost) external onlyAuthorized {
        Rumor storage rumor = rumors[rumorID];
        require(rumor.rumorID != 0, "Rumor does not exist");
        require(rumor.status == RumorStatus.ACTIVE, "Rumor not active");

        rumor.currentConfidence += boost;
        
        // Clamp
        if (rumor.currentConfidence > MAX_CONFIDENCE) rumor.currentConfidence = MAX_CONFIDENCE;
        if (rumor.currentConfidence < MIN_CONFIDENCE) rumor.currentConfidence = MIN_CONFIDENCE;

        emit ConfidenceUpdated(rumorID, rumor.currentConfidence, block.timestamp);
    }

    /**
     * @dev Add trust bonus from deleted rumor
     * @param rumorID Rumor to receive trust
     * @param bonus Trust bonus amount
     */
    function addTrustBonus(uint256 rumorID, int256 bonus) external onlyOwner {
        Rumor storage rumor = rumors[rumorID];
        require(rumor.rumorID != 0, "Rumor does not exist");
        require(rumor.status == RumorStatus.ACTIVE, "Rumor not active");

        rumor.currentConfidence += bonus;
        
        // Clamp
        if (rumor.currentConfidence > MAX_CONFIDENCE) rumor.currentConfidence = MAX_CONFIDENCE;
        if (rumor.currentConfidence < MIN_CONFIDENCE) rumor.currentConfidence = MIN_CONFIDENCE;
    }

    /**
     * @dev Get rumor by ID
     * @param rumorID Rumor ID
     * @return Rumor struct
     */
    function getRumor(uint256 rumorID) external view returns (Rumor memory) {
        return rumors[rumorID];
    }

    /**
     * @dev Get rumors by author
     * @param authorID Author's student ID
     * @return Array of rumor IDs
     */
    function getRumorsByAuthor(uint256 authorID) external view returns (uint256[] memory) {
        return rumorsByAuthor[authorID];
    }

    /**
     * @dev Check if rumor is eligible for locking
     * @param rumorID Rumor ID
     * @return True if can be locked
     */
    function isEligibleForLock(uint256 rumorID) external view returns (bool) {
        Rumor storage rumor = rumors[rumorID];
        return rumor.status == RumorStatus.ACTIVE && 
               block.timestamp >= rumor.createdAt + LOCK_DURATION;
    }

    /**
     * @dev Get total rumor count
     * @return Total rumor count
     */
    function getTotalRumors() external view returns (uint256) {
        return nextRumorID - 1;
    }
}
