// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./RumorRegistry.sol";
import "./CorrelationManager.sol";

/**
 * @title AutomationKeeper
 * @dev Chainlink Automation compatible contract for automatic rumor locking
 * after the 7-day voting window expires.
 */
contract AutomationKeeper is Ownable {
    // State variables
    RumorRegistry public rumorRegistry;
    CorrelationManager public correlationManager;
    
    uint256 public lastCheckedRumorID = 0;
    uint256 public batchSize = 50;

    // Events
    event RumorsLocked(uint256[] rumorIDs, uint256 timestamp);
    event BatchSizeUpdated(uint256 oldSize, uint256 newSize);

    constructor(
        address _rumorRegistry,
        address _correlationManager
    ) Ownable(msg.sender) {
        rumorRegistry = RumorRegistry(_rumorRegistry);
        correlationManager = CorrelationManager(_correlationManager);
    }

    /**
     * @dev Chainlink Automation checkUpkeep function
     * Checks if there are rumors that need to be locked
     */
    function checkUpkeep(bytes calldata /* checkData */) 
        external 
        view 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        uint256[] memory rumorsToLock = _findRumorsToLock();
        upkeepNeeded = rumorsToLock.length > 0;
        performData = abi.encode(rumorsToLock);
    }

    /**
     * @dev Chainlink Automation performUpkeep function
     * Locks the rumors that have passed their voting window
     */
    function performUpkeep(bytes calldata performData) external {
        uint256[] memory rumorIDs = abi.decode(performData, (uint256[]));
        
        for (uint256 i = 0; i < rumorIDs.length; i++) {
            uint256 rumorID = rumorIDs[i];
            
            // Verify still eligible (state might have changed)
            if (rumorRegistry.isEligibleForLock(rumorID)) {
                // Lock the rumor
                rumorRegistry.lockRumor(rumorID);
                
                // Deactivate correlations
                correlationManager.deactivateCorrelations(rumorID);
            }
        }

        if (rumorIDs.length > 0) {
            emit RumorsLocked(rumorIDs, block.timestamp);
        }
    }

    /**
     * @dev Manual trigger for locking (can be called by anyone)
     */
    function triggerLocking() external {
        uint256[] memory rumorsToLock = _findRumorsToLock();
        
        for (uint256 i = 0; i < rumorsToLock.length; i++) {
            uint256 rumorID = rumorsToLock[i];
            
            if (rumorRegistry.isEligibleForLock(rumorID)) {
                rumorRegistry.lockRumor(rumorID);
                correlationManager.deactivateCorrelations(rumorID);
            }
        }

        if (rumorsToLock.length > 0) {
            emit RumorsLocked(rumorsToLock, block.timestamp);
        }
    }

    /**
     * @dev Find rumors that need to be locked
     * @return Array of rumor IDs to lock
     */
    function _findRumorsToLock() internal view returns (uint256[] memory) {
        uint256 totalRumors = rumorRegistry.getTotalRumors();
        
        // Temporary array (will resize)
        uint256[] memory tempArray = new uint256[](batchSize);
        uint256 count = 0;

        // Start from where we left off, wrap around if needed
        uint256 startID = lastCheckedRumorID + 1;
        if (startID > totalRumors) {
            startID = 1;
        }

        uint256 checked = 0;
        uint256 currentID = startID;

        while (checked < totalRumors && count < batchSize) {
            if (rumorRegistry.isEligibleForLock(currentID)) {
                tempArray[count] = currentID;
                count++;
            }

            currentID++;
            if (currentID > totalRumors) {
                currentID = 1;
            }
            checked++;
        }

        // Resize to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tempArray[i];
        }

        return result;
    }

    /**
     * @dev Lock a specific rumor (convenience function)
     * @param rumorID Rumor ID to lock
     */
    function lockSpecificRumor(uint256 rumorID) external {
        require(rumorRegistry.isEligibleForLock(rumorID), "Rumor not eligible for locking");
        
        rumorRegistry.lockRumor(rumorID);
        correlationManager.deactivateCorrelations(rumorID);

        uint256[] memory rumorIDs = new uint256[](1);
        rumorIDs[0] = rumorID;
        emit RumorsLocked(rumorIDs, block.timestamp);
    }

    /**
     * @dev Update batch size for processing
     * @param newBatchSize New batch size
     */
    function setBatchSize(uint256 newBatchSize) external onlyOwner {
        require(newBatchSize > 0 && newBatchSize <= 100, "Invalid batch size");
        emit BatchSizeUpdated(batchSize, newBatchSize);
        batchSize = newBatchSize;
    }

    /**
     * @dev Get count of rumors eligible for locking
     * @return Count of eligible rumors
     */
    function getEligibleLockCount() external view returns (uint256) {
        uint256 totalRumors = rumorRegistry.getTotalRumors();
        uint256 count = 0;

        for (uint256 i = 1; i <= totalRumors && count < 100; i++) {
            if (rumorRegistry.isEligibleForLock(i)) {
                count++;
            }
        }

        return count;
    }

    /**
     * @dev Update contract references
     */
    function updateContracts(
        address _rumorRegistry,
        address _correlationManager
    ) external onlyOwner {
        rumorRegistry = RumorRegistry(_rumorRegistry);
        correlationManager = CorrelationManager(_correlationManager);
    }
}
