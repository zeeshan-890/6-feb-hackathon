// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IdentityRegistry.sol";
import "./RumorRegistry.sol";

/**
 * @title CorrelationManager
 * @dev Manages AI-detected correlations between rumors and applies trust boosts.
 * Correlations are submitted by an off-chain oracle service.
 */
contract CorrelationManager is Ownable {
    // Relationship type enum
    enum RelationshipType {
        SUPPORTIVE,
        CONTRADICTORY
    }

    // Correlation struct
    struct Correlation {
        uint256 rumorA;
        uint256 rumorB;
        RelationshipType relationshipType;
        uint256 aiConfidence;       // 0-100 scale
        bool active;
        uint256 createdAt;
    }

    // State variables
    IdentityRegistry public identityRegistry;
    RumorRegistry public rumorRegistry;
    address public oracleAddress;
    uint256 public constant CORRELATION_VALIDITY_DAYS = 5;

    // Mappings
    mapping(bytes32 => Correlation) public correlations;
    mapping(bytes32 => bool) public correlationExists;
    mapping(uint256 => bytes32[]) public correlationsByRumor;

    // Events
    event CorrelationAdded(
        uint256 indexed rumorA,
        uint256 indexed rumorB,
        RelationshipType relationshipType,
        uint256 aiConfidence
    );
    event CorrelationBoostApplied(
        uint256 indexed rumorID,
        int256 boost,
        uint256 credibleSupportCount
    );
    event OracleAddressUpdated(address indexed oldOracle, address indexed newOracle);

    modifier onlyOracle() {
        require(msg.sender == oracleAddress || msg.sender == owner(), "Only oracle or owner");
        _;
    }

    constructor(
        address _identityRegistry,
        address _rumorRegistry,
        address _oracleAddress
    ) Ownable(msg.sender) {
        identityRegistry = IdentityRegistry(_identityRegistry);
        rumorRegistry = RumorRegistry(_rumorRegistry);
        oracleAddress = _oracleAddress;
    }

    /**
     * @dev Set the oracle address (backend service that submits correlations)
     * @param _oracleAddress New oracle address
     */
    function setOracleAddress(address _oracleAddress) external onlyOwner {
        emit OracleAddressUpdated(oracleAddress, _oracleAddress);
        oracleAddress = _oracleAddress;
    }

    /**
     * @dev Add correlations in batch (called by oracle)
     * @param rumorAs Array of first rumor IDs
     * @param rumorBs Array of second rumor IDs
     * @param types Array of relationship types
     * @param confidences Array of AI confidence scores
     */
    function addCorrelations(
        uint256[] calldata rumorAs,
        uint256[] calldata rumorBs,
        RelationshipType[] calldata types,
        uint256[] calldata confidences
    ) external onlyOracle {
        require(
            rumorAs.length == rumorBs.length &&
            rumorBs.length == types.length &&
            types.length == confidences.length,
            "Array lengths must match"
        );

        for (uint256 i = 0; i < rumorAs.length; i++) {
            _addCorrelation(rumorAs[i], rumorBs[i], types[i], confidences[i]);
        }
    }

    /**
     * @dev Internal function to add a single correlation
     */
    function _addCorrelation(
        uint256 rumorA,
        uint256 rumorB,
        RelationshipType relationType,
        uint256 aiConfidence
    ) internal {
        // Validate rumors exist and are active
        RumorRegistry.Rumor memory rumorAData = rumorRegistry.getRumor(rumorA);
        RumorRegistry.Rumor memory rumorBData = rumorRegistry.getRumor(rumorB);
        
        require(rumorAData.rumorID != 0, "Rumor A does not exist");
        require(rumorBData.rumorID != 0, "Rumor B does not exist");
        require(
            rumorAData.status == RumorRegistry.RumorStatus.ACTIVE,
            "Rumor A not active"
        );
        require(
            rumorBData.status == RumorRegistry.RumorStatus.ACTIVE,
            "Rumor B not active"
        );

        // Check time constraint (within 5 days of each other)
        uint256 timeDiff;
        if (rumorBData.createdAt > rumorAData.createdAt) {
            timeDiff = rumorBData.createdAt - rumorAData.createdAt;
        } else {
            timeDiff = rumorAData.createdAt - rumorBData.createdAt;
        }
        require(timeDiff <= CORRELATION_VALIDITY_DAYS * 1 days, "Rumors too far apart");

        // Create unique hash for this correlation
        bytes32 correlationHash = keccak256(abi.encodePacked(rumorA, rumorB));
        bytes32 reverseHash = keccak256(abi.encodePacked(rumorB, rumorA));

        // Check if correlation already exists
        require(!correlationExists[correlationHash], "Correlation already exists");
        require(!correlationExists[reverseHash], "Reverse correlation exists");

        // Store correlation
        correlations[correlationHash] = Correlation({
            rumorA: rumorA,
            rumorB: rumorB,
            relationshipType: relationType,
            aiConfidence: aiConfidence,
            active: true,
            createdAt: block.timestamp
        });

        correlationExists[correlationHash] = true;
        correlationsByRumor[rumorA].push(correlationHash);
        correlationsByRumor[rumorB].push(correlationHash);

        emit CorrelationAdded(rumorA, rumorB, relationType, aiConfidence);
    }

    /**
     * @dev Apply correlation boost to a rumor
     * @param rumorID Rumor to boost
     */
    function applyCorrelationBoost(uint256 rumorID) external {
        bytes32[] storage rumorCorrelations = correlationsByRumor[rumorID];
        
        uint256 credibleSupport = 0;
        uint256 newUserSupport = 0;
        uint256 discreditedSupport = 0;
        uint256 contradictions = 0;

        for (uint256 i = 0; i < rumorCorrelations.length; i++) {
            Correlation storage corr = correlations[rumorCorrelations[i]];
            
            if (!corr.active) continue;

            // Get the related rumor (the one that isn't rumorID)
            uint256 relatedRumorID = corr.rumorA == rumorID ? corr.rumorB : corr.rumorA;
            RumorRegistry.Rumor memory relatedRumor = rumorRegistry.getRumor(relatedRumorID);
            
            // Get author status
            IdentityRegistry.Student memory author = identityRegistry.getStudentByID(relatedRumor.authorID);

            if (corr.relationshipType == RelationshipType.SUPPORTIVE) {
                if (author.status == IdentityRegistry.UserStatus.CREDIBLE_USER) {
                    credibleSupport++;
                } else if (author.status == IdentityRegistry.UserStatus.NEW_USER) {
                    newUserSupport++;
                } else if (author.status == IdentityRegistry.UserStatus.DISCREDITED) {
                    discreditedSupport++;
                }
            } else {
                contradictions++;
            }
        }

        // Calculate boost
        int256 boost = 0;

        if (credibleSupport >= 2) {
            boost = 30; // High confidence boost
        } else if (credibleSupport >= 1 && newUserSupport >= 1) {
            boost = 15; // Medium boost
        } else if (newUserSupport >= 2) {
            boost = 5; // Low boost
        }

        // Penalty for discredited support
        if (discreditedSupport >= 2) {
            boost -= 20;
        }

        // Penalty for contradictions
        if (contradictions >= 2) {
            boost -= 10;
        }

        if (boost != 0) {
            rumorRegistry.applyCorrelationBoost(rumorID, boost);
            emit CorrelationBoostApplied(rumorID, boost, credibleSupport);
        }
    }

    /**
     * @dev Get all correlations for a rumor
     * @param rumorID Rumor ID
     * @return Array of correlation hashes
     */
    function getCorrelations(uint256 rumorID) external view returns (bytes32[] memory) {
        return correlationsByRumor[rumorID];
    }

    /**
     * @dev Get correlation details
     * @param correlationHash Correlation hash
     * @return Correlation struct
     */
    function getCorrelation(bytes32 correlationHash) external view returns (Correlation memory) {
        return correlations[correlationHash];
    }

    /**
     * @dev Deactivate correlations when a rumor is locked/deleted
     * @param rumorID Rumor ID
     */
    function deactivateCorrelations(uint256 rumorID) external onlyOwner {
        bytes32[] storage rumorCorrelations = correlationsByRumor[rumorID];
        
        for (uint256 i = 0; i < rumorCorrelations.length; i++) {
            correlations[rumorCorrelations[i]].active = false;
        }
    }

    /**
     * @dev Get related rumors (for UI display)
     * @param rumorID Rumor ID
     * @return supportive Array of supportive rumor IDs
     * @return contradictory Array of contradictory rumor IDs
     */
    function getRelatedRumors(uint256 rumorID) external view returns (
        uint256[] memory supportive,
        uint256[] memory contradictory
    ) {
        bytes32[] storage rumorCorrelations = correlationsByRumor[rumorID];
        
        // Count first
        uint256 supportiveCount = 0;
        uint256 contradictoryCount = 0;
        
        for (uint256 i = 0; i < rumorCorrelations.length; i++) {
            Correlation storage corr = correlations[rumorCorrelations[i]];
            if (!corr.active) continue;
            
            if (corr.relationshipType == RelationshipType.SUPPORTIVE) {
                supportiveCount++;
            } else {
                contradictoryCount++;
            }
        }

        // Allocate arrays
        supportive = new uint256[](supportiveCount);
        contradictory = new uint256[](contradictoryCount);
        
        uint256 sIdx = 0;
        uint256 cIdx = 0;

        for (uint256 i = 0; i < rumorCorrelations.length; i++) {
            Correlation storage corr = correlations[rumorCorrelations[i]];
            if (!corr.active) continue;
            
            uint256 relatedID = corr.rumorA == rumorID ? corr.rumorB : corr.rumorA;
            
            if (corr.relationshipType == RelationshipType.SUPPORTIVE) {
                supportive[sIdx++] = relatedID;
            } else {
                contradictory[cIdx++] = relatedID;
            }
        }
    }
}
