// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./CredibilityToken.sol";

/**
 * @title IdentityRegistry
 * @dev Manages anonymous student identities with credibility tracking.
 * Students register with HMAC'd email and wallet, receiving initial credibility tokens.
 */
contract IdentityRegistry is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // User status enum
    enum UserStatus {
        NONE,           // Not registered
        NEW_USER,       // Just registered, limited privileges
        CREDIBLE_USER,  // Earned credibility, full privileges
        DISCREDITED,    // Temporary penalty status
        BLOCKED         // Permanently blocked
    }

    // Student identity struct
    struct Student {
        uint256 studentID;
        address walletAddress;
        bytes32 emailHMAC;
        uint256 credibilityScore;
        UserStatus status;
        uint256 votingPower;        // Basis points (10000 = 100%)
        uint256 registeredAt;
        uint256 totalPosts;
        uint256 totalVotes;
        uint256 accuratePredictions;
        uint256 inaccuratePredictions;
        uint256 discreditedUntil;
        uint256 postsToday;
        uint256 lastPostDate;
        uint256 votesThisHour;
        uint256 lastVoteHour;
    }

    // State variables
    CredibilityToken public credibilityToken;
    uint256 public nextStudentID = 1;
    uint256 public constant INITIAL_CREDIBILITY = 10;
    uint256 public constant NEW_USER_VOTING_POWER = 2500;      // 25%
    uint256 public constant CREDIBLE_USER_VOTING_POWER = 10000; // 100%
    uint256 public constant DISCREDITED_VOTING_POWER = 5000;    // 50%
    uint256 public constant CREDIBILITY_THRESHOLD = 30;
    uint256 public constant DISCREDIT_DURATION = 30 days;

    // Mappings
    mapping(address => Student) public students;
    mapping(bytes32 => bool) public emailHMACUsed;
    mapping(uint256 => address) public studentIDToWallet;

    // Events
    event StudentRegistered(uint256 indexed studentID, address indexed wallet, uint256 timestamp);
    event StatusChanged(uint256 indexed studentID, UserStatus oldStatus, UserStatus newStatus);
    event CredibilityUpdated(uint256 indexed studentID, uint256 oldScore, uint256 newScore);
    event PostCountUpdated(uint256 indexed studentID, uint256 totalPosts);
    event VoteCountUpdated(uint256 indexed studentID, uint256 totalVotes);

    constructor(address _credibilityToken) Ownable(msg.sender) {
        credibilityToken = CredibilityToken(_credibilityToken);
    }

    /**
     * @dev Register a new student identity
     * @param emailHMAC HMAC of the verified university email
     * @param signature Signature proving wallet ownership
     */
    function registerStudent(bytes32 emailHMAC, bytes calldata signature) external {
        require(students[msg.sender].studentID == 0, "Wallet already registered");
        require(!emailHMACUsed[emailHMAC], "Email already registered");

        // Verify signature (user signed their email HMAC with their wallet)
        bytes32 messageHash = keccak256(abi.encodePacked(emailHMAC, msg.sender));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        require(signer == msg.sender, "Invalid signature");

        // Create student record
        uint256 studentID = nextStudentID++;
        
        students[msg.sender] = Student({
            studentID: studentID,
            walletAddress: msg.sender,
            emailHMAC: emailHMAC,
            credibilityScore: INITIAL_CREDIBILITY,
            status: UserStatus.NEW_USER,
            votingPower: NEW_USER_VOTING_POWER,
            registeredAt: block.timestamp,
            totalPosts: 0,
            totalVotes: 0,
            accuratePredictions: 0,
            inaccuratePredictions: 0,
            discreditedUntil: 0,
            postsToday: 0,
            lastPostDate: 0,
            votesThisHour: 0,
            lastVoteHour: 0
        });

        emailHMACUsed[emailHMAC] = true;
        studentIDToWallet[studentID] = msg.sender;

        // Mint initial credibility tokens
        credibilityToken.mint(msg.sender, INITIAL_CREDIBILITY, "Initial registration");

        emit StudentRegistered(studentID, msg.sender, block.timestamp);
    }

    /**
     * @dev Get student by wallet address
     * @param wallet Wallet address to look up
     * @return Student struct
     */
    function getStudent(address wallet) external view returns (Student memory) {
        return students[wallet];
    }

    /**
     * @dev Get student by ID
     * @param studentID Student ID to look up
     * @return Student struct
     */
    function getStudentByID(uint256 studentID) external view returns (Student memory) {
        address wallet = studentIDToWallet[studentID];
        return students[wallet];
    }

    /**
     * @dev Check if a wallet is registered
     * @param wallet Wallet address to check
     * @return True if registered
     */
    function isRegistered(address wallet) external view returns (bool) {
        return students[wallet].studentID != 0;
    }

    /**
     * @dev Get voting weight for a user (used by VotingSystem)
     * @param wallet Wallet address
     * @return Voting weight in basis points
     */
    function getVotingWeight(address wallet) external view returns (uint256) {
        Student storage student = students[wallet];
        if (student.studentID == 0) return 0;
        if (student.status == UserStatus.BLOCKED) return 0;
        
        // Check if discredit period is over
        if (student.status == UserStatus.DISCREDITED && 
            block.timestamp > student.discreditedUntil) {
            // Would transition to CREDIBLE_USER, return full power
            if (student.credibilityScore >= CREDIBILITY_THRESHOLD) {
                return CREDIBLE_USER_VOTING_POWER;
            }
        }
        
        return student.votingPower;
    }

    /**
     * @dev Update credibility score and potentially change status
     * @param wallet Wallet address
     * @param newScore New credibility score
     */
    function updateCredibility(address wallet, uint256 newScore) external onlyOwner {
        Student storage student = students[wallet];
        require(student.studentID != 0, "Student not registered");

        uint256 oldScore = student.credibilityScore;
        student.credibilityScore = newScore;

        emit CredibilityUpdated(student.studentID, oldScore, newScore);

        // Update status based on new score
        _updateStatus(wallet);
    }

    /**
     * @dev Add credibility points
     * @param wallet Wallet address
     * @param points Points to add
     */
    function addCredibility(address wallet, uint256 points) external onlyOwner {
        Student storage student = students[wallet];
        require(student.studentID != 0, "Student not registered");

        uint256 oldScore = student.credibilityScore;
        student.credibilityScore += points;
        student.accuratePredictions++;

        credibilityToken.mint(wallet, points, "Accurate prediction");

        emit CredibilityUpdated(student.studentID, oldScore, student.credibilityScore);
        _updateStatus(wallet);
    }

    /**
     * @dev Remove credibility points
     * @param wallet Wallet address
     * @param points Points to remove
     */
    function removeCredibility(address wallet, uint256 points) external onlyOwner {
        Student storage student = students[wallet];
        require(student.studentID != 0, "Student not registered");

        uint256 oldScore = student.credibilityScore;
        
        if (points >= student.credibilityScore) {
            student.credibilityScore = 0;
        } else {
            student.credibilityScore -= points;
        }
        
        student.inaccuratePredictions++;

        credibilityToken.burn(wallet, points, "Inaccurate prediction");

        emit CredibilityUpdated(student.studentID, oldScore, student.credibilityScore);
        _updateStatus(wallet);
    }

    /**
     * @dev Increment post count for a user
     * @param wallet Wallet address
     */
    function incrementPostCount(address wallet) external onlyOwner {
        Student storage student = students[wallet];
        require(student.studentID != 0, "Student not registered");

        // Reset daily counter if new day
        uint256 today = block.timestamp / 1 days;
        if (student.lastPostDate < today) {
            student.postsToday = 0;
            student.lastPostDate = today;
        }

        student.totalPosts++;
        student.postsToday++;

        emit PostCountUpdated(student.studentID, student.totalPosts);
    }

    /**
     * @dev Increment vote count for a user
     * @param wallet Wallet address
     */
    function incrementVoteCount(address wallet) external onlyOwner {
        Student storage student = students[wallet];
        require(student.studentID != 0, "Student not registered");

        // Reset hourly counter if new hour
        uint256 currentHour = block.timestamp / 1 hours;
        if (student.lastVoteHour < currentHour) {
            student.votesThisHour = 0;
            student.lastVoteHour = currentHour;
        }

        student.totalVotes++;
        student.votesThisHour++;

        emit VoteCountUpdated(student.studentID, student.totalVotes);
    }

    /**
     * @dev Check if user can post (rate limiting)
     * @param wallet Wallet address
     * @return canPost Whether user can post
     * @return requiresEvidence Whether user must provide evidence
     */
    function canPost(address wallet) external view returns (bool canPost, bool requiresEvidence) {
        Student storage student = students[wallet];
        
        if (student.studentID == 0) return (false, false);
        if (student.status == UserStatus.BLOCKED) return (false, false);
        
        // Check daily limit for new users
        uint256 today = block.timestamp / 1 days;
        uint256 postsToday = student.lastPostDate < today ? 0 : student.postsToday;
        
        if (student.status == UserStatus.NEW_USER) {
            canPost = postsToday < 3;
            requiresEvidence = true;
        } else if (student.status == UserStatus.DISCREDITED) {
            canPost = postsToday < 2;
            requiresEvidence = true;
        } else {
            canPost = true;
            requiresEvidence = false;
        }
    }

    /**
     * @dev Internal function to update user status based on credibility
     * @param wallet Wallet address
     */
    function _updateStatus(address wallet) internal {
        Student storage student = students[wallet];
        UserStatus oldStatus = student.status;
        UserStatus newStatus = oldStatus;

        // Check for status transitions
        if (student.credibilityScore == 0) {
            newStatus = UserStatus.BLOCKED;
            student.votingPower = 0;
        } else if (student.credibilityScore < CREDIBILITY_THRESHOLD) {
            if (oldStatus != UserStatus.NEW_USER && oldStatus != UserStatus.DISCREDITED) {
                newStatus = UserStatus.DISCREDITED;
                student.votingPower = DISCREDITED_VOTING_POWER;
                student.discreditedUntil = block.timestamp + DISCREDIT_DURATION;
            }
        } else if (student.credibilityScore >= CREDIBILITY_THRESHOLD) {
            if (oldStatus == UserStatus.NEW_USER || 
                (oldStatus == UserStatus.DISCREDITED && block.timestamp > student.discreditedUntil)) {
                newStatus = UserStatus.CREDIBLE_USER;
                student.votingPower = CREDIBLE_USER_VOTING_POWER;
                student.discreditedUntil = 0;
            }
        }

        // Enhanced voting power for high credibility
        if (newStatus == UserStatus.CREDIBLE_USER) {
            if (student.credibilityScore >= 70) {
                student.votingPower = 15000; // 150%
            } else if (student.credibilityScore >= 50) {
                student.votingPower = 12000; // 120%
            }
        }

        if (newStatus != oldStatus) {
            student.status = newStatus;
            emit StatusChanged(student.studentID, oldStatus, newStatus);
        }
    }

    /**
     * @dev Transfer ownership of registry management to another contract
     * @param newOwner New owner address
     */
    function transferRegistryOwnership(address newOwner) external onlyOwner {
        transferOwnership(newOwner);
    }
}
