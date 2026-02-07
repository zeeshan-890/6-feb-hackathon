const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Campus Rumor Verification System...\n");

    const [deployer] = await ethers.getSigners();
    console.log("📍 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
    console.log("");

    // 1. Deploy CredibilityToken
    console.log("1️⃣  Deploying CredibilityToken...");
    const CredibilityToken = await ethers.getContractFactory("CredibilityToken");
    const credibilityToken = await CredibilityToken.deploy();
    await credibilityToken.waitForDeployment();
    const credibilityTokenAddress = await credibilityToken.getAddress();
    console.log("   ✅ CredibilityToken deployed to:", credibilityTokenAddress);

    // 2. Deploy IdentityRegistry
    console.log("2️⃣  Deploying IdentityRegistry...");
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identityRegistry = await IdentityRegistry.deploy(credibilityTokenAddress);
    await identityRegistry.waitForDeployment();
    const identityRegistryAddress = await identityRegistry.getAddress();
    console.log("   ✅ IdentityRegistry deployed to:", identityRegistryAddress);

    // 3. Deploy RumorRegistry
    console.log("3️⃣  Deploying RumorRegistry...");
    const RumorRegistry = await ethers.getContractFactory("RumorRegistry");
    const rumorRegistry = await RumorRegistry.deploy(identityRegistryAddress);
    await rumorRegistry.waitForDeployment();
    const rumorRegistryAddress = await rumorRegistry.getAddress();
    console.log("   ✅ RumorRegistry deployed to:", rumorRegistryAddress);

    // 4. Deploy VotingSystem
    console.log("4️⃣  Deploying VotingSystem...");
    const VotingSystem = await ethers.getContractFactory("VotingSystem");
    const votingSystem = await VotingSystem.deploy(identityRegistryAddress, rumorRegistryAddress);
    await votingSystem.waitForDeployment();
    const votingSystemAddress = await votingSystem.getAddress();
    console.log("   ✅ VotingSystem deployed to:", votingSystemAddress);

    // 5. Deploy CorrelationManager
    console.log("5️⃣  Deploying CorrelationManager...");
    const CorrelationManager = await ethers.getContractFactory("CorrelationManager");
    const correlationManager = await CorrelationManager.deploy(
        identityRegistryAddress,
        rumorRegistryAddress,
        deployer.address // Oracle address (initially deployer)
    );
    await correlationManager.waitForDeployment();
    const correlationManagerAddress = await correlationManager.getAddress();
    console.log("   ✅ CorrelationManager deployed to:", correlationManagerAddress);

    // 6. Deploy VerificationController
    console.log("6️⃣  Deploying VerificationController...");
    const VerificationController = await ethers.getContractFactory("VerificationController");
    const verificationController = await VerificationController.deploy(
        identityRegistryAddress,
        rumorRegistryAddress,
        votingSystemAddress,
        credibilityTokenAddress
    );
    await verificationController.waitForDeployment();
    const verificationControllerAddress = await verificationController.getAddress();
    console.log("   ✅ VerificationController deployed to:", verificationControllerAddress);

    // 7. Deploy AutomationKeeper
    console.log("7️⃣  Deploying AutomationKeeper...");
    const AutomationKeeper = await ethers.getContractFactory("AutomationKeeper");
    const automationKeeper = await AutomationKeeper.deploy(
        rumorRegistryAddress,
        correlationManagerAddress
    );
    await automationKeeper.waitForDeployment();
    const automationKeeperAddress = await automationKeeper.getAddress();
    console.log("   ✅ AutomationKeeper deployed to:", automationKeeperAddress);

    console.log("\n🔧 Setting up permissions...");

    // Grant minter/burner roles to IdentityRegistry
    console.log("   Granting MINTER_ROLE to IdentityRegistry...");
    await credibilityToken.grantMinterRole(identityRegistryAddress);
    console.log("   Granting BURNER_ROLE to IdentityRegistry...");
    await credibilityToken.grantBurnerRole(identityRegistryAddress);

    // Authorize RumorRegistry to call IdentityRegistry (incrementPostCount, etc.)
    console.log("   Authorizing RumorRegistry on IdentityRegistry...");
    await identityRegistry.addAuthorizedCaller(rumorRegistryAddress);

    // Authorize VotingSystem to call RumorRegistry (recordVote) and IdentityRegistry (incrementVoteCount)
    console.log("   Authorizing VotingSystem on RumorRegistry...");
    await rumorRegistry.addAuthorizedCaller(votingSystemAddress);
    console.log("   Authorizing VotingSystem on IdentityRegistry...");
    await identityRegistry.addAuthorizedCaller(votingSystemAddress);

    // Authorize VerificationController to call IdentityRegistry (addCredibility, removeCredibility) and RumorRegistry (setVerificationResult)
    console.log("   Authorizing VerificationController on IdentityRegistry...");
    await identityRegistry.addAuthorizedCaller(verificationControllerAddress);
    console.log("   Authorizing VerificationController on RumorRegistry...");
    await rumorRegistry.addAuthorizedCaller(verificationControllerAddress);

    // Authorize AutomationKeeper to call RumorRegistry (lockRumor)
    console.log("   Authorizing AutomationKeeper on RumorRegistry...");
    await rumorRegistry.addAuthorizedCaller(automationKeeperAddress);

    // Authorize CorrelationManager to call RumorRegistry (applyCorrelationBoost)
    console.log("   Authorizing CorrelationManager on RumorRegistry...");
    await rumorRegistry.addAuthorizedCaller(correlationManagerAddress);

    console.log("\n✅ Deployment complete!\n");

    // Print summary
    console.log("═══════════════════════════════════════════════════════════");
    console.log("                   CONTRACT ADDRESSES                       ");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`CredibilityToken:        ${credibilityTokenAddress}`);
    console.log(`IdentityRegistry:        ${identityRegistryAddress}`);
    console.log(`RumorRegistry:           ${rumorRegistryAddress}`);
    console.log(`VotingSystem:            ${votingSystemAddress}`);
    console.log(`CorrelationManager:      ${correlationManagerAddress}`);
    console.log(`VerificationController:  ${verificationControllerAddress}`);
    console.log(`AutomationKeeper:        ${automationKeeperAddress}`);
    console.log("═══════════════════════════════════════════════════════════");

    // Generate .env update
    console.log("\n📝 Add these to your .env file:");
    console.log("─────────────────────────────────────────────────────────────");
    console.log(`CREDIBILITY_TOKEN_ADDRESS=${credibilityTokenAddress}`);
    console.log(`IDENTITY_REGISTRY_ADDRESS=${identityRegistryAddress}`);
    console.log(`RUMOR_REGISTRY_ADDRESS=${rumorRegistryAddress}`);
    console.log(`VOTING_SYSTEM_ADDRESS=${votingSystemAddress}`);
    console.log(`CORRELATION_MANAGER_ADDRESS=${correlationManagerAddress}`);
    console.log(`VERIFICATION_CONTROLLER_ADDRESS=${verificationControllerAddress}`);
    console.log(`AUTOMATION_KEEPER_ADDRESS=${automationKeeperAddress}`);
    console.log("─────────────────────────────────────────────────────────────");

    // Return addresses for testing
    return {
        credibilityToken: credibilityTokenAddress,
        identityRegistry: identityRegistryAddress,
        rumorRegistry: rumorRegistryAddress,
        votingSystem: votingSystemAddress,
        correlationManager: correlationManagerAddress,
        verificationController: verificationControllerAddress,
        automationKeeper: automationKeeperAddress,
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
