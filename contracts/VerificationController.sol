// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IdentityRegistry.sol";
import "./RumorRegistry.sol";
import "./VotingSystem.sol";
import "./CredibilityToken.sol";

/**
 * @title VerificationController
 * @dev Handles rumor verification (true/false) and distributes rewards/penalties
 * to authors and voters based on accuracy.
 */
contract VerificationController is Ownable {
    // Reward/penalty constants
    uint256 public constant AUTHOR_REWARD_TRUE = 5;
    uint256 public constant AUTHOR_PENALTY_FALSE = 10;
    uint256 public constant VOTER_REWARD_CORRECT = 1;
    uint256 public constant VOTER_PENALTY_WRONG_CONFIRM = 1;
    uint256 public constant VOTER_REWARD_CORRECT_DISPUTE = 2;
    uint256 public constant VOTER_PENALTY_WRONG_DISPUTE = 2;

    // State variables
    IdentityRegistry public identityRegistry;
    RumorRegistry public rumorRegistry;
    VotingSystem public votingSystem;
    CredibilityToken public credibilityToken;

    // Verification records
    mapping(uint256 => bool) public verifiedRumors;
    mapping(uint256 => bool) public verificationResult;

    // Events
    event RumorVerificationCompleted(
        uint256 indexed rumorID,
        bool isTrue,
        uint256 totalRewardsDistributed,
        uint256 totalPenaltiesApplied
    );
    event AuthorRewarded(uint256 indexed rumorID, uint256 indexed authorID, uint256 amount);
    event AuthorPenalized(uint256 indexed rumorID, uint256 indexed authorID, uint256 amount);
    event VoterRewarded(uint256 indexed rumorID, address indexed voter, uint256 amount);
    event VoterPenalized(uint256 indexed rumorID, address indexed voter, uint256 amount);

    constructor(
        address _identityRegistry,
        address _rumorRegistry,
        address _votingSystem,
        address _credibilityToken
    ) Ownable(msg.sender) {
        identityRegistry = IdentityRegistry(_identityRegistry);
        rumorRegistry = RumorRegistry(_rumorRegistry);
        votingSystem = VotingSystem(_votingSystem);
        credibilityToken = CredibilityToken(_credibilityToken);
    }

    /**
     * @dev Verify a rumor as true or false and distribute rewards/penalties
     * @param rumorID Rumor to verify
     * @param isTrue Whether the rumor is verified as true
     */
    function verifyRumor(uint256 rumorID, bool isTrue) external onlyOwner {
        require(!verifiedRumors[rumorID], "Rumor already verified");

        RumorRegistry.Rumor memory rumor = rumorRegistry.getRumor(rumorID);
        require(rumor.rumorID != 0, "Rumor does not exist");

        // Mark as verified
        verifiedRumors[rumorID] = true;
        verificationResult[rumorID] = isTrue;

        // Update rumor status in registry
        rumorRegistry.setVerificationResult(rumorID, isTrue);

        uint256 totalRewards = 0;
        uint256 totalPenalties = 0;

        // Handle author reward/penalty
        if (isTrue) {
            identityRegistry.addCredibility(rumor.authorWallet, AUTHOR_REWARD_TRUE);
            totalRewards += AUTHOR_REWARD_TRUE;
            emit AuthorRewarded(rumorID, rumor.authorID, AUTHOR_REWARD_TRUE);
        } else {
            identityRegistry.removeCredibility(rumor.authorWallet, AUTHOR_PENALTY_FALSE);
            totalPenalties += AUTHOR_PENALTY_FALSE;
            emit AuthorPenalized(rumorID, rumor.authorID, AUTHOR_PENALTY_FALSE);
        }

        // Handle voter rewards/penalties
        uint256[] memory voteIDs = votingSystem.getVotesForRumor(rumorID);
        
        for (uint256 i = 0; i < voteIDs.length; i++) {
            VotingSystem.Vote memory vote = votingSystem.getVote(voteIDs[i]);
            
            bool votedConfirm = vote.voteType == VotingSystem.VoteType.CONFIRM;
            bool votedCorrectly = (isTrue && votedConfirm) || (!isTrue && !votedConfirm);

            if (votedCorrectly) {
                uint256 reward = votedConfirm ? VOTER_REWARD_CORRECT : VOTER_REWARD_CORRECT_DISPUTE;
                identityRegistry.addCredibility(vote.voterWallet, reward);
                totalRewards += reward;
                emit VoterRewarded(rumorID, vote.voterWallet, reward);
            } else {
                uint256 penalty = votedConfirm ? VOTER_PENALTY_WRONG_CONFIRM : VOTER_PENALTY_WRONG_DISPUTE;
                identityRegistry.removeCredibility(vote.voterWallet, penalty);
                totalPenalties += penalty;
                emit VoterPenalized(rumorID, vote.voterWallet, penalty);
            }
        }

        emit RumorVerificationCompleted(rumorID, isTrue, totalRewards, totalPenalties);
    }

    /**
     * @dev Batch verify multiple rumors
     * @param rumorIDs Array of rumor IDs
     * @param results Array of verification results (true/false)
     */
    function batchVerify(uint256[] calldata rumorIDs, bool[] calldata results) external onlyOwner {
        require(rumorIDs.length == results.length, "Array lengths must match");
        
        for (uint256 i = 0; i < rumorIDs.length; i++) {
            if (!verifiedRumors[rumorIDs[i]]) {
                // We can't call this.verifyRumor because it's external
                // Instead, inline the logic or make an internal function
                _verifyRumorInternal(rumorIDs[i], results[i]);
            }
        }
    }

    /**
     * @dev Internal verification logic
     */
    function _verifyRumorInternal(uint256 rumorID, bool isTrue) internal {
        RumorRegistry.Rumor memory rumor = rumorRegistry.getRumor(rumorID);
        if (rumor.rumorID == 0) return;

        verifiedRumors[rumorID] = true;
        verificationResult[rumorID] = isTrue;
        rumorRegistry.setVerificationResult(rumorID, isTrue);

        uint256 totalRewards = 0;
        uint256 totalPenalties = 0;

        // Author
        if (isTrue) {
            identityRegistry.addCredibility(rumor.authorWallet, AUTHOR_REWARD_TRUE);
            totalRewards += AUTHOR_REWARD_TRUE;
            emit AuthorRewarded(rumorID, rumor.authorID, AUTHOR_REWARD_TRUE);
        } else {
            identityRegistry.removeCredibility(rumor.authorWallet, AUTHOR_PENALTY_FALSE);
            totalPenalties += AUTHOR_PENALTY_FALSE;
            emit AuthorPenalized(rumorID, rumor.authorID, AUTHOR_PENALTY_FALSE);
        }

        // Voters
        uint256[] memory voteIDs = votingSystem.getVotesForRumor(rumorID);
        
        for (uint256 i = 0; i < voteIDs.length; i++) {
            VotingSystem.Vote memory vote = votingSystem.getVote(voteIDs[i]);
            
            bool votedConfirm = vote.voteType == VotingSystem.VoteType.CONFIRM;
            bool votedCorrectly = (isTrue && votedConfirm) || (!isTrue && !votedConfirm);

            if (votedCorrectly) {
                uint256 reward = votedConfirm ? VOTER_REWARD_CORRECT : VOTER_REWARD_CORRECT_DISPUTE;
                identityRegistry.addCredibility(vote.voterWallet, reward);
                totalRewards += reward;
                emit VoterRewarded(rumorID, vote.voterWallet, reward);
            } else {
                uint256 penalty = votedConfirm ? VOTER_PENALTY_WRONG_CONFIRM : VOTER_PENALTY_WRONG_DISPUTE;
                identityRegistry.removeCredibility(vote.voterWallet, penalty);
                totalPenalties += penalty;
                emit VoterPenalized(rumorID, vote.voterWallet, penalty);
            }
        }

        emit RumorVerificationCompleted(rumorID, isTrue, totalRewards, totalPenalties);
    }

    /**
     * @dev Check if a rumor has been verified
     * @param rumorID Rumor ID
     * @return isVerified Whether verified
     * @return result Verification result (only valid if verified)
     */
    function getVerificationStatus(uint256 rumorID) external view returns (
        bool isVerified,
        bool result
    ) {
        isVerified = verifiedRumors[rumorID];
        result = verificationResult[rumorID];
    }

    /**
     * @dev Calculate potential rewards/penalties for a rumor before verification
     * @param rumorID Rumor ID
     * @param isTrue Hypothetical verification result
     * @return totalRewards Total rewards that would be distributed
     * @return totalPenalties Total penalties that would be applied
     */
    function previewVerification(uint256 rumorID, bool isTrue) external view returns (
        uint256 totalRewards,
        uint256 totalPenalties
    ) {
        RumorRegistry.Rumor memory rumor = rumorRegistry.getRumor(rumorID);
        if (rumor.rumorID == 0) return (0, 0);

        // Author
        if (isTrue) {
            totalRewards += AUTHOR_REWARD_TRUE;
        } else {
            totalPenalties += AUTHOR_PENALTY_FALSE;
        }

        // Voters
        uint256[] memory voteIDs = votingSystem.getVotesForRumor(rumorID);
        
        for (uint256 i = 0; i < voteIDs.length; i++) {
            VotingSystem.Vote memory vote = votingSystem.getVote(voteIDs[i]);
            
            bool votedConfirm = vote.voteType == VotingSystem.VoteType.CONFIRM;
            bool votedCorrectly = (isTrue && votedConfirm) || (!isTrue && !votedConfirm);

            if (votedCorrectly) {
                totalRewards += votedConfirm ? VOTER_REWARD_CORRECT : VOTER_REWARD_CORRECT_DISPUTE;
            } else {
                totalPenalties += votedConfirm ? VOTER_PENALTY_WRONG_CONFIRM : VOTER_PENALTY_WRONG_DISPUTE;
            }
        }
    }
}
