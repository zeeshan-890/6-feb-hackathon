// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IdentityRegistry.sol";
import "./RumorRegistry.sol";

/**
 * @title VotingSystem
 * @dev Manages voting on rumors with credibility-weighted votes.
 * Prevents duplicate voting and rate limits votes.
 */
contract VotingSystem is Ownable {
    // Vote type enum
    enum VoteType {
        CONFIRM,
        DISPUTE
    }

    // Vote struct
    struct Vote {
        uint256 voteID;
        uint256 rumorID;
        uint256 voterID;
        address voterWallet;
        VoteType voteType;
        uint256 voterWeight;        // Basis points at time of vote
        uint256 voterCredibility;   // Credibility at time of vote
        uint256 timestamp;
    }

    // State variables
    IdentityRegistry public identityRegistry;
    RumorRegistry public rumorRegistry;
    uint256 public nextVoteID = 1;
    uint256 public constant MAX_VOTES_PER_HOUR = 10;

    // Mappings
    mapping(uint256 => Vote) public votes;
    mapping(uint256 => mapping(address => bool)) public hasVoted; // rumorID => wallet => voted
    mapping(uint256 => uint256[]) public votesByRumor;
    mapping(address => uint256[]) public votesByVoter;

    // Events
    event VoteCast(
        uint256 indexed voteID,
        uint256 indexed rumorID,
        uint256 indexed voterID,
        VoteType voteType,
        uint256 weight,
        uint256 timestamp
    );

    constructor(address _identityRegistry, address _rumorRegistry) Ownable(msg.sender) {
        identityRegistry = IdentityRegistry(_identityRegistry);
        rumorRegistry = RumorRegistry(_rumorRegistry);
    }

    /**
     * @dev Cast a vote on a rumor
     * @param rumorID Rumor to vote on
     * @param voteType Confirm or Dispute
     */
    function voteOnRumor(uint256 rumorID, VoteType voteType) external returns (uint256) {
        // Get voter info
        IdentityRegistry.Student memory voter = identityRegistry.getStudent(msg.sender);
        require(voter.studentID != 0, "Voter not registered");
        require(voter.status != IdentityRegistry.UserStatus.BLOCKED, "Voter is blocked");

        // Get rumor info
        RumorRegistry.Rumor memory rumor = rumorRegistry.getRumor(rumorID);
        require(rumor.rumorID != 0, "Rumor does not exist");
        require(rumor.status == RumorRegistry.RumorStatus.ACTIVE, "Rumor not active");

        // Check voting eligibility
        require(!hasVoted[rumorID][msg.sender], "Already voted on this rumor");
        require(rumor.authorWallet != msg.sender, "Cannot vote on own rumor");

        // Check rate limit
        require(_checkVoteRateLimit(msg.sender), "Vote rate limit exceeded");

        // Calculate voter weight
        uint256 weight = identityRegistry.getVotingWeight(msg.sender);
        require(weight > 0, "No voting power");

        // Create vote
        uint256 voteID = nextVoteID++;
        
        votes[voteID] = Vote({
            voteID: voteID,
            rumorID: rumorID,
            voterID: voter.studentID,
            voterWallet: msg.sender,
            voteType: voteType,
            voterWeight: weight,
            voterCredibility: voter.credibilityScore,
            timestamp: block.timestamp
        });

        hasVoted[rumorID][msg.sender] = true;
        votesByRumor[rumorID].push(voteID);
        votesByVoter[msg.sender].push(voteID);

        // Update rumor vote counts - convert weight to signed int for calculation
        // Weight is in basis points (10000 = 100%), normalize to simple score
        int256 weightedVote = int256(weight) / 100; // Convert to 100 = neutral, 150 = strong
        rumorRegistry.recordVote(rumorID, voteType == VoteType.CONFIRM, weightedVote);

        // Update voter's vote count
        identityRegistry.incrementVoteCount(msg.sender);

        emit VoteCast(voteID, rumorID, voter.studentID, voteType, weight, block.timestamp);

        return voteID;
    }

    /**
     * @dev Check if voter has exceeded hourly rate limit
     * @param voter Voter wallet address
     * @return True if under rate limit
     */
    function _checkVoteRateLimit(address voter) internal view returns (bool) {
        IdentityRegistry.Student memory student = identityRegistry.getStudent(voter);
        
        uint256 currentHour = block.timestamp / 1 hours;
        uint256 votesThisHour = student.lastVoteHour < currentHour ? 0 : student.votesThisHour;
        
        return votesThisHour < MAX_VOTES_PER_HOUR;
    }

    /**
     * @dev Get vote by ID
     * @param voteID Vote ID
     * @return Vote struct
     */
    function getVote(uint256 voteID) external view returns (Vote memory) {
        return votes[voteID];
    }

    /**
     * @dev Get all votes for a rumor
     * @param rumorID Rumor ID
     * @return Array of vote IDs
     */
    function getVotesForRumor(uint256 rumorID) external view returns (uint256[] memory) {
        return votesByRumor[rumorID];
    }

    /**
     * @dev Get all votes by a voter
     * @param voter Voter wallet address
     * @return Array of vote IDs
     */
    function getVotesByVoter(address voter) external view returns (uint256[] memory) {
        return votesByVoter[voter];
    }

    /**
     * @dev Check if user has voted on a rumor
     * @param rumorID Rumor ID
     * @param voter Voter wallet address
     * @return True if voted
     */
    function hasUserVoted(uint256 rumorID, address voter) external view returns (bool) {
        return hasVoted[rumorID][voter];
    }

    /**
     * @dev Get vote counts for a rumor
     * @param rumorID Rumor ID
     * @return confirmCount Number of confirm votes
     * @return disputeCount Number of dispute votes
     */
    function getVoteCounts(uint256 rumorID) external view returns (uint256 confirmCount, uint256 disputeCount) {
        uint256[] memory rumorVotes = votesByRumor[rumorID];
        
        for (uint256 i = 0; i < rumorVotes.length; i++) {
            Vote storage v = votes[rumorVotes[i]];
            if (v.voteType == VoteType.CONFIRM) {
                confirmCount++;
            } else {
                disputeCount++;
            }
        }
    }

    /**
     * @dev Get detailed vote analytics for a rumor
     * @param rumorID Rumor ID
     * @return totalVotes Total number of votes
     * @return weightedConfirm Total weighted confirm score
     * @return weightedDispute Total weighted dispute score
     */
    function getVoteAnalytics(uint256 rumorID) external view returns (
        uint256 totalVotes,
        uint256 weightedConfirm,
        uint256 weightedDispute
    ) {
        uint256[] memory rumorVotes = votesByRumor[rumorID];
        totalVotes = rumorVotes.length;
        
        for (uint256 i = 0; i < rumorVotes.length; i++) {
            Vote storage v = votes[rumorVotes[i]];
            if (v.voteType == VoteType.CONFIRM) {
                weightedConfirm += v.voterWeight;
            } else {
                weightedDispute += v.voterWeight;
            }
        }
    }

    /**
     * @dev Get total vote count
     * @return Total number of votes cast
     */
    function getTotalVotes() external view returns (uint256) {
        return nextVoteID - 1;
    }
}
