// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CredibilityToken
 * @dev ERC-20 token representing user credibility in the Campus Rumor Verification System.
 * Only authorized contracts (MINTER_ROLE) can mint/burn tokens.
 */
contract CredibilityToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    event CredibilityMinted(address indexed to, uint256 amount, string reason);
    event CredibilityBurned(address indexed from, uint256 amount, string reason);

    constructor() ERC20("Campus Credibility", "CRED") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }

    /**
     * @dev Mint credibility tokens to a user (reward)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * @param reason Reason for minting (for event logging)
     */
    function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit CredibilityMinted(to, amount, reason);
    }

    /**
     * @dev Burn credibility tokens from a user (penalty)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     * @param reason Reason for burning (for event logging)
     */
    function burn(address from, uint256 amount, string calldata reason) external onlyRole(BURNER_ROLE) {
        // If user doesn't have enough, burn what they have
        uint256 balance = balanceOf(from);
        uint256 burnAmount = amount > balance ? balance : amount;
        
        if (burnAmount > 0) {
            _burn(from, burnAmount);
            emit CredibilityBurned(from, burnAmount, reason);
        }
    }

    /**
     * @dev Grant minter role to a contract (e.g., IdentityRegistry, VerificationController)
     * @param account Address to grant minter role to
     */
    function grantMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(MINTER_ROLE, account);
    }

    /**
     * @dev Grant burner role to a contract
     * @param account Address to grant burner role to
     */
    function grantBurnerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(BURNER_ROLE, account);
    }

    /**
     * @dev Get the credibility score of a user
     * @param user Address to check
     * @return Credibility score (token balance)
     */
    function getCredibility(address user) external view returns (uint256) {
        return balanceOf(user);
    }

    /**
     * @dev Decimals override - credibility uses whole numbers
     */
    function decimals() public pure override returns (uint8) {
        return 0;
    }
}
