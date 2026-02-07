# 🔍 Decentralized Campus Rumor Verification System

> **A blockchain-powered, AI-enhanced platform for anonymous, trustworthy campus rumor verification — where truth is determined by community consensus, not central authority.**

---

## 📑 Table of Contents

- [Problem Statement](#-problem-statement)
- [Our Solution — Design Answers](#-our-solution--design-answers)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Smart Contract Architecture](#-smart-contract-architecture)
- [User Flow](#-user-flow)
- [Confidence Scoring Algorithm](#-confidence-scoring-algorithm)
- [Anti-Manipulation Mechanisms](#-anti-manipulation-mechanisms)
- [AI Test Rumor System](#-ai-test-rumor-system--credibility-trap)
- [Tombstone System — Deleted Rumor Handling](#-tombstone-system--deleted-rumor-handling)
- [AI Correlation Engine](#-ai-correlation-engine)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [API Reference](#-api-reference)
- [Security Model](#-security-model)

---

## 🎯 Problem Statement

Design a system where:

| # | Challenge | Status |
|---|-----------|--------|
| 1 | No central admin controlling truth | ✅ Solved |
| 2 | Students remain anonymous | ✅ Solved |
| 3 | Users cannot vote multiple times without revealing identity | ✅ Solved |
| 4 | Popular false rumors must not win automatically | ✅ Solved |
| 5 | Old verified facts must never change | ✅ Solved |
| 6 | Bot accounts attempt to manipulate votes | ✅ Solved |
| 7 | Deleted rumors still influence newer ones (known bug) | ✅ Solved |
| 8 | System must be provably resistant to coordinated lying | ✅ Solved |

---

## 💡 Our Solution — Design Answers

### 1. No Central Admin Controlling Truth

```
┌─────────────────────────────────────────────────────────┐
│                   TRUTH DETERMINATION                    │
│                                                         │
│   ❌ Central Admin        ✅ Our System                  │
│   ┌─────────┐            ┌─────────────────────┐        │
│   │  Admin   │            │ Community Consensus  │        │
│   │ decides  │            │ + Credibility Weight │        │
│   │  truth   │            │ + AI Correlation     │        │
│   └─────────┘            │ + Verification Proof  │        │
│                          └─────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

**Answer:** Truth is determined entirely by **credibility-weighted community voting**. Every vote is recorded on-chain in the `VotingSystem.sol` smart contract. The confidence score of a rumor is computed mathematically:

```
confidence = initialConfidence + Σ(weightedConfirmVotes) - Σ(weightedDisputeVotes)
```

No single entity — not even the contract deployer — can unilaterally declare a rumor true or false. The `VerificationController.sol` only finalizes outcomes when the 7-day voting window closes and distributes rewards/penalties based on the community's weighted vote.

---

### 2. Students Remain Anonymous

```
┌──────────────────────────────────────────────────────┐
│              ANONYMITY ARCHITECTURE                   │
│                                                      │
│  Student Email ──► HMAC-SHA256(email, secret)        │
│                         │                            │
│              ┌──────────▼──────────┐                 │
│              │   emailHMAC (hash)  │  ← stored       │
│              │   on blockchain     │    on-chain      │
│              └──────────┬──────────┘                 │
│                         │                            │
│          Cannot reverse to get email                 │
│                                                      │
│  Wallet ──► Randomly generated per user              │
│             (AES-256-CBC encrypted in backend DB)    │
│                                                      │
│  On-chain: Only studentID + walletAddress visible    │
│  No email, no name, no IP address stored on-chain    │
└──────────────────────────────────────────────────────┘
```

**Answer:** The `IdentityRegistry.sol` contract stores only:
- A **numeric studentID** (auto-incremented)
- A **wallet address** (randomly generated, not linked to any real identity)
- An **HMAC of the university email** (one-way hash — cannot be reversed)

The backend generates a fresh Ethereum wallet per user, encrypts the private key with AES-256-CBC, and funds it from a master wallet. The email is verified via OTP but **never stored** — only its HMAC goes on-chain. Even the system admin cannot link a studentID to a real person.

---

### 3. Users Cannot Vote Multiple Times Without Revealing Identity

```
┌───────────────────────────────────────────────────────┐
│            DUPLICATE VOTE PREVENTION                   │
│                                                       │
│  VotingSystem.sol:                                    │
│  mapping(rumorID => mapping(wallet => bool)) hasVoted │
│                                                       │
│  Vote attempt ──► Check hasVoted[rumorID][wallet]     │
│                         │                             │
│              ┌──────────┼──────────┐                  │
│              │          │          │                   │
│           false        true                           │
│              │          │                             │
│         Allow vote   REVERT                           │
│              │       "Already                         │
│         Set true      voted"                          │
│                                                       │
│  ALSO: emailHMAC uniqueness prevents                  │
│        registering multiple wallets                   │
│        with the same email                            │
└───────────────────────────────────────────────────────┘
```

**Answer:** Three layers of protection:

1. **On-chain mapping:** `hasVoted[rumorID][wallet]` in `VotingSystem.sol` — checked before every vote with `require(!hasVoted[rumorID][msg.sender])`. Immutable once set.
2. **Email HMAC uniqueness:** `emailHMACUsed[hash]` in `IdentityRegistry.sol` — one email = one wallet = one identity. A student cannot register a second wallet.
3. **Self-vote prevention:** `require(rumor.authorWallet != msg.sender)` — authors cannot vote on their own rumors.

Identity is never revealed because the check uses wallet addresses (pseudonymous), not emails.

---

### 4. Popular False Rumors Must Not Win Automatically

```
┌────────────────────────────────────────────────────────┐
│         CREDIBILITY-WEIGHTED VOTING                     │
│                                                        │
│  User Type        │ Voting Power │ Weight Multiplier    │
│  ─────────────────┼──────────────┼────────────────────  │
│  NEW_USER         │    25%       │  0.25x               │
│  CREDIBLE_USER    │   100%       │  1.00x               │
│  DISCREDITED      │    50%       │  0.50x               │
│                                                        │
│  Example: 10 new users confirm (10 × 0.25 = 2.5)      │
│           2 credible users dispute (2 × 1.0 = 2.0)     │
│                                                        │
│  Raw vote count: 10 vs 2 (confirm "wins")              │
│  Weighted score:  2.5 vs 2.0 (much closer!)            │
│                                                        │
│  + AI correlation analysis can further penalize         │
│    rumors contradicted by verified facts                │
└────────────────────────────────────────────────────────┘
```

**Answer:** Votes are **not equal**. Each vote is weighted by the voter's credibility:

- **New users** (< 30 CRED tokens): 25% voting power
- **Credible users** (≥ 30 CRED tokens): 100% voting power  
- **Discredited users**: 50% voting power

The confidence formula uses `weightedConfirmScore - weightedDisputeScore`, not raw counts. A mob of new accounts cannot outweigh trusted community members. Additionally, the **CorrelationManager** applies AI-detected boosts/penalties when related verified rumors contradict a claim.

---

### 5. Old Verified Facts Must Never Change

```
┌────────────────────────────────────────────────────────┐
│            IMMUTABILITY GUARANTEE                       │
│                                                        │
│  Rumor Lifecycle:                                      │
│                                                        │
│  ACTIVE ──7 days──► LOCKED ──verification──► VERIFIED  │
│     │                  │                    or DEBUNKED │
│     │                  │                               │
│     │            Score frozen at                       │
│     │            lockedConfidence                      │
│     │                  │                               │
│  Votes affect      Post-lock votes                     │
│  score normally    affect only 5%                      │
│                    (dampened)                           │
│                                                        │
│  VERIFIED/DEBUNKED status is FINAL                     │
│  No function exists to change it                       │
│  Stored immutably on blockchain                        │
└────────────────────────────────────────────────────────┘
```

**Answer:** The smart contract enforces a strict **state machine**:

1. Rumors are `ACTIVE` for 7 days (open for voting).
2. After 7 days, `AutomationKeeper.sol` automatically transitions them to `LOCKED` — the confidence score is frozen at `lockedConfidence`.
3. The `VerificationController` can then finalize to `VERIFIED` or `DEBUNKED`.
4. **There is no function to transition from VERIFIED/DEBUNKED back to any other state.** This is enforced by Solidity's state machine — the contract literally cannot change a verified fact.
5. Post-lock votes are dampened to only 5% influence: `newConfidence = (lockedConfidence × 95 + newVoteScore × 5) / 100`

---

### 6. Bot Accounts Attempt to Manipulate Votes

```
┌────────────────────────────────────────────────────────┐
│              ANTI-BOT DEFENSES                          │
│                                                        │
│  Layer 1: Email Verification (University email OTP)    │
│           ├── One email → one wallet → one identity    │
│           └── Must verify .edu email to register       │
│                                                        │
│  Layer 2: Credibility-Weighted Voting                  │
│           ├── New accounts get only 25% vote power     │
│           └── Must earn trust through accurate votes   │
│                                                        │
│  Layer 3: Rate Limiting                                │
│           ├── MAX_VOTES_PER_HOUR = 10 (on-chain)       │
│           ├── MAX_POSTS_PER_DAY = 3 (on-chain)         │
│           └── Enforced in smart contract, not backend   │
│                                                        │
│  Layer 4: Credibility Decay                            │
│           ├── Wrong votes → lose CRED tokens           │
│           ├── False rumors → author loses 10 CRED      │
│           └── Below threshold → DISCREDITED status     │
│                                                        │
│  Layer 5: AI Correlation Detection                     │
│           └── Contradictions with verified rumors       │
│               automatically penalize confidence         │
└────────────────────────────────────────────────────────┘
```

**Answer:** Five defense layers make bot manipulation economically infeasible:

1. **University email gating** — must verify via OTP. Bots need real `.edu` emails.
2. **Weighted voting** — even if bots register, they start at 25% power and cannot influence outcomes like trusted users can.
3. **On-chain rate limits** — 10 votes/hour, 3 posts/day, enforced in Solidity (cannot be bypassed).
4. **Credibility penalty loop** — bots voting on the wrong side lose CRED tokens → drop to DISCREDITED → 50% power → eventually their votes are near-meaningless.
5. **AI correlation** — coordinated false claims that contradict verified facts are auto-detected by Gemini embeddings and penalized.

---

### 7. Deleted Rumors Still Influence Newer Ones (Known Bug — Fixed)

```
┌────────────────────────────────────────────────────────┐
│           TOMBSTONE SYSTEM                              │
│                                                        │
│  When a rumor is deleted:                              │
│                                                        │
│  Rumor #5 (DELETED)                                    │
│     │                                                  │
│     ├── Status → DELETED, visible → false              │
│     │                                                  │
│     ├── Tombstone created:                             │
│     │   ┌─────────────────────────────────┐            │
│     │   │ originalRumorID: 5              │            │
│     │   │ finalConfidence: -42            │            │
│     │   │ voteCount: 37                   │            │
│     │   │ relatedRumorIDs: [3, 7, 12]     │            │
│     │   │ deletedAt: timestamp            │            │
│     │   │ trustRedistributed: false→true  │            │
│     │   └─────────────────────────────────┘            │
│     │                                                  │
│     └── CorrelationManager deactivates all             │
│         correlations involving Rumor #5                 │
│                                                        │
│  Result: Deleted rumors CANNOT boost/penalize          │
│          any active rumor after deletion                │
└────────────────────────────────────────────────────────┘
```

**Answer:** The `RumorRegistry.sol` implements a **Tombstone pattern**:

1. When a rumor is deleted, a `Tombstone` struct is permanently created on-chain with the rumor's final state.
2. The rumor's `visible` flag is set to `false` and status to `DELETED`.
3. The `CorrelationManager.deactivateCorrelations(rumorID)` is called — this sets `active = false` on all correlations involving that rumor.
4. The `applyCorrelationBoost` function checks `if (!corr.active) continue;` — so deleted rumors' correlations are skipped.
5. The `trustRedistributed` flag prevents double-processing of trust transfer.

**The bug is solved:** deleted rumors are tombstoned and their correlations are deactivated, so they can never influence active rumors.

---

### 8. System Must Be Provably Resistant to Coordinated Lying

```
┌────────────────────────────────────────────────────────┐
│       COORDINATED LYING RESISTANCE PROOF                │
│                                                        │
│  Attack scenario: 20 colluding users confirm a         │
│  false rumor to make it appear verified.               │
│                                                        │
│  Defense Chain:                                         │
│  ┌──────────────────────────────────────┐              │
│  │ 1. All 20 are NEW_USER (25% power)  │              │
│  │    Total weight: 20 × 0.25 = 5.0    │              │
│  └────────────────┬─────────────────────┘              │
│                   ▼                                    │
│  ┌──────────────────────────────────────┐              │
│  │ 2. Just 3 CREDIBLE_USER disputes     │              │
│  │    suffice: 3 × 1.0 = 3.0           │              │
│  │    Net: 5.0 - 3.0 = +2.0 (low)      │              │
│  └────────────────┬─────────────────────┘              │
│                   ▼                                    │
│  ┌──────────────────────────────────────┐              │
│  │ 3. AI detects contradiction with     │              │
│  │    verified Rumor #X → penalty boost │              │
│  │    Contradictions from credible       │              │
│  │    sources: -10 per contradiction     │              │
│  └────────────────┬─────────────────────┘              │
│                   ▼                                    │
│  ┌──────────────────────────────────────┐              │
│  │ 4. After verification, all 20        │              │
│  │    colluders lose CRED:              │              │
│  │    - Author: -10 CRED                │              │
│  │    - Each wrong voter: -1 to -2 CRED │              │
│  │    → Drop to DISCREDITED (50%)       │              │
│  │    → Future attacks even weaker       │              │
│  └──────────────────────────────────────┘              │
│                                                        │
│  PROOF: On-chain, transparent, mathematically           │
│  verifiable. Every vote, weight, and score is           │
│  stored immutably. Anyone can audit the math.           │
└────────────────────────────────────────────────────────┘
```

**Answer:** Provable resistance through four mathematical guarantees:

1. **Weighted inequality:** Credible users (who earned trust through accuracy) always outweigh coordinated new/discredited accounts. This is enforced in Solidity — the weights are hardcoded constants, not configurable.

2. **Economic penalty loop:** Coordinated liars lose CRED tokens when debunked, making each successive attack weaker. The `VerificationController.sol` distributes penalties:
   - Author of false rumor: **-20 CRED** (further decreased)
   - Each wrong voter: **-2 to -4 CRED** (doubled penalties)

3. **AI semantic analysis:** `CorrelationManager.sol` + Gemini AI detect when a new claim contradicts verified facts and automatically apply confidence penalties.

4. **Full on-chain auditability:** Every vote, every weight, every score change is an immutable blockchain event. Anyone can independently verify the math by reading the contract state.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **Anonymous Identity** | HMAC-based identity — no personal data on-chain |
| 📝 **Rumor Submission** | Post rumors with optional evidence files (IPFS) |
| 🗳️ **Credibility-Weighted Voting** | Votes weighted by user trust level |
| 📊 **Real-time Confidence Scores** | Dynamic scoring from -100 to +100 |
| 🤖 **AI Correlation Detection** | Gemini-powered semantic similarity analysis |
| 🔒 **Automatic Locking** | 7-day voting window via Chainlink Automation |
| ✅ **Verification & Rewards** | CRED token rewards for accuracy |
| 🪦 **Tombstone System** | Deleted rumors safely isolated |
| 📱 **Modern Web UI** | Next.js 14 responsive frontend |
| ⚙️ **Fully On-Chain** | 7 interconnected smart contracts |
| 🧪 **AI Test Rumors** | Weekly false rumor traps to test user credibility |

---

## 🛠 Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        TECH STACK                            │
├─────────────────┬───────────────────────────────────────────┤
│  LAYER          │  TECHNOLOGY                                │
├─────────────────┼───────────────────────────────────────────┤
│  Frontend       │  Next.js 14, TypeScript, Tailwind CSS     │
│  Backend API    │  Node.js, Express.js                       │
│  Database       │  SQLite (better-sqlite3) for auth tokens   │
│  Blockchain     │  Solidity ^0.8.20, Hardhat, ethers.js v6   │
│  Smart Contracts│  7 contracts (OpenZeppelin base)            │
│  Storage        │  IPFS via Pinata (rumor content/evidence)  │
│  AI Engine      │  Google Gemini (2.5-flash-lite + embeddings)│
│  Auth           │  Email OTP + HMAC + AES-256-CBC wallets    │
│  Token          │  ERC-20 CredibilityToken (CRED)            │
│  Automation     │  Chainlink Automation compatible Keeper     │
└─────────────────┴───────────────────────────────────────────┘
```

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │
│  │   Home    │ │  Submit   │ │  Rumor    │ │  Profile  │           │
│  │   Page    │ │  Rumor    │ │  Detail   │ │   Page    │           │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘           │
│        └──────────────┴──────────────┴──────────────┘               │
│                              │ REST API                             │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Node.js / Express)                    │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Auth Routes  │  │ Rumor Routes │  │  User Routes │               │
│  │  /api/auth/*  │  │ /api/rumors/*│  │ /api/users/* │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                        │
│  ┌──────▼─────────────────▼─────────────────▼───────┐               │
│  │              SERVICE LAYER                         │               │
│  │  ┌─────────────────┐  ┌─────────────────┐         │               │
│  │  │ blockchainService│  │  geminiService  │         │               │
│  │  │ (ethers.js v6)   │  │ (Gemini AI)     │         │               │
│  │  └────────┬─────────┘  └────────┬────────┘         │               │
│  │  ┌────────▼─────────┐  ┌────────▼────────┐         │               │
│  │  │  ipfsService     │  │  emailService   │         │               │
│  │  │  (Pinata IPFS)   │  │  (Nodemailer)   │         │               │
│  │  └──────────────────┘  └─────────────────┘         │               │
│  └────────────────────────────────────────────────────┘               │
│                              │                                        │
│  ┌───────────────┐  ┌───────▼──────┐                                 │
│  │ SQLite DB      │  │ Master Wallet│                                 │
│  │ (auth tokens,  │  │ (funds new   │                                 │
│  │  email HMACs)  │  │  user wallets)│                                │
│  └───────────────┘  └──────────────┘                                 │
└──────────────────────────────┼───────────────────────────────────────┘
                               │ JSON-RPC
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN (Hardhat / Ethereum)                    │
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐         │
│  │ Credibility  │     │  Identity    │     │    Rumor     │         │
│  │   Token      │◄────│  Registry    │────►│  Registry    │         │
│  │  (ERC-20)    │     │              │     │              │         │
│  └──────────────┘     └──────┬───────┘     └──────┬───────┘         │
│                              │                    │                  │
│                       ┌──────▼───────┐     ┌──────▼───────┐         │
│                       │   Voting     │     │ Correlation  │         │
│                       │   System     │────►│  Manager     │         │
│                       └──────┬───────┘     └──────┬───────┘         │
│                              │                    │                  │
│                       ┌──────▼───────┐     ┌──────▼───────┐         │
│                       │ Verification │     │  Automation  │         │
│                       │ Controller   │     │   Keeper     │         │
│                       └──────────────┘     └──────────────┘         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    IPFS (Pinata Gateway)                      │    │
│  │  Rumor content, evidence files — content-addressed storage    │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📜 Smart Contract Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  7 SMART CONTRACTS                            │
│                                                              │
│  ┌─────────────────────┐                                     │
│  │  CredibilityToken   │  ERC-20 token (CRED)               │
│  │  (Campus Credibility)│  decimals: 0 (whole numbers)       │
│  │                     │  Role-based mint/burn                │
│  └─────────┬───────────┘                                     │
│            │ MINTER_ROLE                                      │
│            ▼                                                  │
│  ┌─────────────────────┐  Registers students with:           │
│  │  IdentityRegistry   │  • HMAC'd email (anonymity)         │
│  │                     │  • Auto-incrementing studentID       │
│  │  Users:             │  • Credibility score tracking        │
│  │  NEW_USER (25%)     │  • Voting power calculation          │
│  │  CREDIBLE (100%)    │  • Rate limiting (posts/votes)       │
│  │  DISCREDITED (50%)  │                                      │
│  └─────────┬───────────┘                                     │
│            │ authorizedCallers                                │
│            ▼                                                  │
│  ┌─────────────────────┐  Manages rumor lifecycle:            │
│  │  RumorRegistry      │  • IPFS content hash storage         │
│  │                     │  • Evidence hash array                │
│  │  States:            │  • Confidence: -100 to +100          │
│  │  ACTIVE → LOCKED    │  • Tombstone on deletion             │
│  │  → VERIFIED/DEBUNKED│  • 7-day lock duration               │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│     ┌──────┴──────┐                                          │
│     ▼             ▼                                          │
│  ┌──────────┐ ┌──────────────┐                               │
│  │ Voting   │ │ Correlation  │  AI-detected relationships:    │
│  │ System   │ │ Manager      │  • SUPPORTIVE correlations     │
│  │          │ │              │  • CONTRADICTORY correlations   │
│  │ 1 vote   │ │ Oracle-fed   │  • Confidence boost/penalty    │
│  │ per user │ │ batch submit │  • 5-day validity window       │
│  │ per rumor│ │              │                                │
│  └──────┬───┘ └──────────────┘                               │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────┐  Post-lock verification:             │
│  │ Verification        │  • Author reward: +10 CRED (double!) │
│  │ Controller          │  • Author penalty: -20 CRED (further)│
│  │                     │  • Voter reward: +2/+4 CRED          │
│  │ Rewards & Penalties │  • Voter penalty: -2/-4 CRED         │
│  └─────────────────────┘                                     │
│                                                              │
│  ┌─────────────────────┐  Chainlink Automation compatible:    │
│  │ AutomationKeeper    │  • checkUpkeep() → finds expired     │
│  │                     │  • performUpkeep() → locks rumors    │
│  │ Auto-lock after     │  • Batch processing (50 at a time)  │
│  │ 7 days              │  • Manual triggerLocking() fallback  │
│  └─────────────────────┘                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        COMPLETE USER FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

 ① REGISTRATION
 ══════════════
 Student                    Backend                      Blockchain
   │                          │                              │
   │── Enter .edu email ──────►│                              │
   │                          │── Send OTP via email          │
   │◄── Receive OTP ──────────│                              │
   │── Submit OTP ────────────►│                              │
   │                          │── Generate Ethereum wallet    │
   │                          │── Encrypt private key (AES)   │
   │                          │── HMAC(email)                 │
   │                          │── Fund wallet from master ───►│
   │                          │── registerStudent(hmac) ─────►│
   │                          │                              │── Store student
   │                          │                              │── Mint 10 CRED
   │◄── Token + walletAddr ───│                              │── Emit event
   │                          │                              │

 ② SUBMIT RUMOR
 ══════════════
 Student                    Backend                      Blockchain
   │                          │                              │
   │── Title + Description ──►│                              │
   │   + Evidence files       │                              │
   │                          │── Upload to IPFS (Pinata) ──►│ IPFS
   │                          │◄── contentHash ──────────────│
   │                          │── AI: Extract keywords        │
   │                          │── AI: Generate embedding      │
   │                          │── AI: Find correlations       │
   │                          │── createRumor(hash, kw) ─────►│
   │                          │                              │── Create rumor
   │                          │                              │── Set confidence
   │◄── Rumor ID ─────────────│                              │── Emit event
   │                          │                              │

 ③ VOTE ON RUMOR
 ═══════════════
 Student                    Backend                      Blockchain
   │                          │                              │
   │── Confirm/Dispute ──────►│                              │
   │                          │── voteOnRumor(id, type) ─────►│
   │                          │                              │── Check: registered?
   │                          │                              │── Check: already voted?
   │                          │                              │── Check: not author?
   │                          │                              │── Check: rate limit?
   │                          │                              │── Calculate weight
   │                          │                              │── Record vote
   │                          │                              │── Update confidence
   │◄── Vote confirmed ───────│                              │── Emit event
   │                          │                              │

 ④ RUMOR LIFECYCLE
 ═════════════════
                    ┌──────────┐
                    │  ACTIVE  │ ◄── Rumor created
                    │ (7 days) │
                    └────┬─────┘
                         │ AutomationKeeper / time expires
                         ▼
                    ┌──────────┐
                    │  LOCKED  │ ◄── Confidence frozen
                    │          │     Post-lock votes: 5% effect
                    └────┬─────┘
                         │ VerificationController
                    ┌────┴─────┐
                    ▼          ▼
              ┌──────────┐ ┌──────────┐
              │ VERIFIED │ │ DEBUNKED │
              │          │ │          │
              │ +5 CRED  │ │ -10 CRED │
              │ to author│ │ to author│
              └──────────┘ └──────────┘
                    │          │
                    ▼          ▼
              Voter rewards/penalties distributed
              based on voting accuracy
```

---

## 📈 Confidence Scoring Algorithm

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONFIDENCE FORMULA                             │
│                                                                  │
│  Initial Confidence = f(author_status, has_evidence)             │
│                                                                  │
│  All rumors start with DECREASED confidence on submission.     │
│  Evidence reduces the penalty but never makes it positive.     │
│                                                                  │
│  ┌──────────────────────────────────────────────┐               │
│  │  Author Status    │ Base  │ With 1 Evidence   │               │
│  │───────────────────┼───────┼──────────────────│               │
│  │  CREDIBLE_USER    │  -10  │     -5            │               │
│  │  NEW_USER         │  -20  │     -15           │               │
│  │  DISCREDITED      │  -30  │     -25           │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  Evidence reduction: +5 per evidence file (never goes positive) │
│                                                                  │
│  Current Confidence (while ACTIVE):                              │
│  ═══════════════════════════════════                              │
│  confidence = initialConfidence                                  │
│             + Σ(confirm_weight_i / 100)                          │
│             - Σ(dispute_weight_i / 100)                          │
│                                                                  │
│  where weight_i = voter's votingPower in basis points            │
│    NEW_USER:      2500 (contributes 25 per vote)                 │
│    CREDIBLE_USER: 10000 (contributes 100 per vote)               │
│    DISCREDITED:   5000 (contributes 50 per vote)                 │
│                                                                  │
│  Clamped to: [-100, +100]                                        │
│                                                                  │
│  Post-Lock Dampening:                                            │
│  ═══════════════════                                              │
│  newConf = (lockedConfidence × 95 + voteScore × 5) / 100        │
│                                                                  │
│  Verification Rewards/Penalties (DOUBLED):                        │
│  ═════════════════════════════════════════                         │
│  If VERIFIED TRUE → Author gets DOUBLE reward: +10 CRED          │
│  If DEBUNKED FALSE → Author gets FURTHER penalty: -20 CRED       │
│                                                                  │
│  ┌──────────────────────────────────────────────┐               │
│  │  Outcome     │ Author  │ Correct  │ Wrong    │               │
│  │              │         │ Voter    │ Voter    │               │
│  │──────────────┼─────────┼──────────┼─────────│               │
│  │  TRUE        │ +10 CRED│ +2 CRED  │ -2 CRED │               │
│  │  FALSE       │ -20 CRED│ +4 CRED  │ -4 CRED │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  Correlation Boost:                                               │
│  ═════════════════                                                │
│  credibleSupport:    +5 per supporting rumor by credible user    │
│  newUserSupport:     +2 per supporting rumor by new user         │
│  contradiction:      -3 per contradicting rumor                  │
│  discreditedSupport: -1 per supporting rumor by discredited user │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛡 Anti-Manipulation Mechanisms

```
┌─────────────────────────────────────────────────────────────────┐
│                DEFENSE-IN-DEPTH MODEL                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 5: AI SEMANTIC ANALYSIS                           │    │
│  │  Gemini embeddings detect contradictions with verified    │    │
│  │  facts → automatic confidence penalty                    │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Layer 4: ECONOMIC PENALTIES                      │    │    │
│  │  │  Wrong votes cost CRED → attackers get weaker    │    │    │
│  │  │  ┌─────────────────────────────────────────┐    │    │    │
│  │  │  │  Layer 3: ON-CHAIN RATE LIMITING         │    │    │    │
│  │  │  │  10 votes/hour, 3 posts/day (Solidity)  │    │    │    │
│  │  │  │  ┌─────────────────────────────────┐    │    │    │    │
│  │  │  │  │  Layer 2: WEIGHTED VOTING        │    │    │    │    │
│  │  │  │  │  25% / 100% / 50% by status     │    │    │    │    │
│  │  │  │  │  ┌─────────────────────────┐    │    │    │    │    │
│  │  │  │  │  │  Layer 1: IDENTITY       │    │    │    │    │    │
│  │  │  │  │  │  Email OTP + HMAC        │    │    │    │    │    │
│  │  │  │  │  │  1 email = 1 wallet      │    │    │    │    │    │
│  │  │  │  │  └─────────────────────────┘    │    │    │    │    │
│  │  │  │  └─────────────────────────────────┘    │    │    │    │
│  │  │  └─────────────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## � AI Test Rumor System — Credibility Trap

```
┌─────────────────────────────────────────────────────────────────┐
│            AUTOMATED CREDIBILITY TESTING                          │
│                                                                  │
│  PURPOSE: Detect users who blindly confirm everything            │
│           by injecting KNOWN FALSE rumors into the feed          │
│                                                                  │
│  FLOW:                                                           │
│                                                                  │
│  ┌─────────────┐                                                │
│  │ Every 7 Days │   Gemini AI generates a realistic but          │
│  │  (Weekly)    │   COMPLETELY FALSE campus rumor                │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────┐               │
│  │ 1. Gemini AI → Generate false rumor           │               │
│  │    "University Library Closing Permanently"   │               │
│  │    (realistic, believable, but 100% false)    │               │
│  └──────────────────┬───────────────────────────┘               │
│                     ▼                                            │
│  ┌──────────────────────────────────────────────┐               │
│  │ 2. Upload to IPFS → Post on-chain             │               │
│  │    Looks like a NORMAL rumor to all users     │               │
│  │    Posted by system wallet (master)           │               │
│  └──────────────────┬───────────────────────────┘               │
│                     ▼                                            │
│  ┌──────────────────────────────────────────────┐               │
│  │ 3. Users see it on feed → Vote Confirm/Dispute│               │
│  │    Users don't know it's a test               │               │
│  └──────────────────┬───────────────────────────┘               │
│                     ▼  (After 3 days)                            │
│  ┌──────────────────────────────────────────────┐               │
│  │ 4. Auto-verify as FALSE (DEBUNKED)            │               │
│  │    ┌────────────────────────────────────┐     │               │
│  │    │ Users who CONFIRMED:               │     │               │
│  │    │   → Lose credibility (-20 CRED)    │     │               │
│  │    │   → Status may drop to DISCREDITED │     │               │
│  │    │                                    │     │               │
│  │    │ Users who DISPUTED:                │     │               │
│  │    │   → Gain credibility (+4 CRED)     │     │               │
│  │    │   → Rewarded for critical thinking │     │               │
│  │    └────────────────────────────────────┘     │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  SCHEDULE:                                                       │
│  📅 New test rumor: Every 7 days (automated)                    │
│  ⏰ Auto-verify check: Every 1 hour                             │
│  🎯 Auto-debunk after: 3 days of voting                         │
│  🔧 Manual trigger: POST /api/admin/test-rumor/generate         │
└─────────────────────────────────────────────────────────────────┘
```

**Why this matters:** Users who blindly confirm every rumor (without reading or thinking critically) get caught by these traps. Over time, their credibility drops and their voting power decreases — making the entire system more trustworthy.

---

## �🪦 Tombstone System — Deleted Rumor Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  PROBLEM: User deletes Rumor #5, but Rumor #8 was boosted       │
│           by a correlation with #5. Does #8 keep the boost?     │
│                                                                  │
│  SOLUTION:                                                       │
│                                                                  │
│  Step 1: deleteRumor(5)                                         │
│  ┌──────────────────────────────────────────┐                   │
│  │ rumor[5].status = DELETED                 │                   │
│  │ rumor[5].visible = false                  │                   │
│  │ tombstone[5] = {                          │                   │
│  │   finalConfidence: -42,                   │                   │
│  │   voteCount: 37,                          │                   │
│  │   relatedRumorIDs: [3, 8],                │                   │
│  │   trustRedistributed: false               │                   │
│  │ }                                         │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
│  Step 2: deactivateCorrelations(5)                              │
│  ┌──────────────────────────────────────────┐                   │
│  │ All correlations involving rumor 5:       │                   │
│  │   correlation[5↔3].active = false         │                   │
│  │   correlation[5↔8].active = false         │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
│  Step 3: Future applyCorrelationBoost(8)                        │
│  ┌──────────────────────────────────────────┐                   │
│  │ for each correlation of rumor 8:          │                   │
│  │   if (!corr.active) continue; ← SKIP #5  │                   │
│  │   // Only active correlations matter      │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
│  RESULT: Deleted rumor's influence is cleanly removed.           │
│          Tombstone preserves audit trail.                         │
│          No orphaned boosts remain.                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧠 AI Correlation Engine

```
┌─────────────────────────────────────────────────────────────────┐
│              GEMINI-POWERED CORRELATION PIPELINE                 │
│                                                                  │
│  New Rumor Created                                               │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────────┐                                       │
│  │ 1. Extract Keywords  │  Gemini 2.5-flash-lite                │
│  │    via Gemini AI     │  "Extract 3-5 keywords..."            │
│  └──────────┬───────────┘                                       │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 2. Generate Embedding│  gemini-embedding-001                 │
│  │    768-dim vector    │  "Embed this rumor text..."           │
│  └──────────┬───────────┘                                       │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 3. Compare with all  │  Cosine similarity                    │
│  │    existing rumors   │  against stored embeddings            │
│  └──────────┬───────────┘                                       │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 4. Filter matches    │  Threshold: similarity > 0.7          │
│  │    above threshold   │  + Created within 5 days              │
│  └──────────┬───────────┘                                       │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 5. Classify relation │  Gemini prompt:                       │
│  │    SUPPORTIVE or     │  "Are these rumors supporting         │
│  │    CONTRADICTORY     │   or contradicting each other?"       │
│  └──────────┬───────────┘                                       │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 6. Submit to chain   │  CorrelationManager                  │
│  │    via Oracle        │  .addCorrelations(...)                │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
6-feb-hackathon/
├── contracts/                          # Solidity Smart Contracts
│   ├── CredibilityToken.sol            # ERC-20 CRED token
│   ├── IdentityRegistry.sol            # Anonymous identity management
│   ├── RumorRegistry.sol               # Rumor CRUD + lifecycle
│   ├── VotingSystem.sol                # Credibility-weighted voting
│   ├── CorrelationManager.sol          # AI correlation tracking
│   ├── VerificationController.sol      # Rewards/penalties distribution
│   └── AutomationKeeper.sol            # Chainlink-compatible auto-lock
│
├── scripts/
│   └── deploy.js                       # Full deployment + authorization
│
├── backend/
│   ├── src/
│   │   ├── index.js                    # Express server entry point
│   │   ├── routes/
│   │   │   ├── auth.js                 # Registration, login, OTP
│   │   │   ├── rumors.js               # CRUD, voting, content fetch
│   │   │   ├── users.js                # Profile, stats, vote history
│   │   │   └── correlations.js         # AI correlation endpoints
│   │   └── services/
│   │       ├── blockchainService.js    # ethers.js v6 contract interface
│   │       ├── geminiService.js        # Gemini AI (keywords, embeddings)
│   │       ├── ipfsService.js          # Pinata IPFS upload/fetch
│   │       ├── emailService.js         # OTP email delivery
│   │       └── testRumorService.js     # AI test rumor generator + scheduler
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                # Home — rumor feed
│   │   │   ├── layout.tsx              # Root layout + providers
│   │   │   ├── login/page.tsx          # Email login
│   │   │   ├── register/page.tsx       # Email verification + registration
│   │   │   ├── submit/page.tsx         # Rumor submission form
│   │   │   ├── profile/page.tsx        # User dashboard
│   │   │   └── rumor/[id]/page.tsx     # Rumor detail + voting
│   │   ├── components/
│   │   │   ├── Navbar.tsx              # Navigation bar
│   │   │   ├── RumorCard.tsx           # Rumor list card
│   │   │   ├── VotingPanel.tsx         # Confirm/Dispute voting UI
│   │   │   └── WalletProvider.tsx      # Ethereum provider context
│   │   ├── hooks/
│   │   │   ├── useContracts.ts         # Contract interaction hooks
│   │   │   └── useWallet.ts            # Wallet connection hook
│   │   └── lib/
│   │       ├── api.ts                  # Backend API client
│   │       └── contracts.ts            # Contract ABIs + addresses
│   ├── tailwind.config.js
│   └── package.json
│
├── hardhat.config.js                   # Hardhat configuration
└── package.json                        # Root dependencies
```

---

## 🚀 Setup & Installation

### Prerequisites

- Node.js ≥ 18
- npm or yarn
- Git

### 1. Clone & Install

```bash
git clone <repository-url>
cd 6-feb-hackathon

# Install root dependencies (Hardhat, Solidity)
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Environment Variables

**Backend** (`backend/.env`):
```env
PORT=5000
MASTER_PRIVATE_KEY=<hardhat-account-0-private-key>
HMAC_SECRET=your-hmac-secret-key
JWT_SECRET=your-jwt-secret
GEMINI_API_KEY=your-google-gemini-api-key         # Optional
PINATA_API_KEY=your-pinata-api-key                 # Optional
PINATA_SECRET_KEY=your-pinata-secret-key           # Optional
EMAIL_HOST=smtp.gmail.com                          # Optional
EMAIL_USER=your-email@gmail.com                    # Optional
EMAIL_PASS=your-app-password                       # Optional
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=<deployed-address>
NEXT_PUBLIC_CREDIBILITY_TOKEN_ADDRESS=<deployed-address>
NEXT_PUBLIC_RUMOR_REGISTRY_ADDRESS=<deployed-address>
NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS=<deployed-address>
```

### 3. Start Local Blockchain

```bash
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy.js --network localhost
```

### 4. Start Backend

```bash
cd backend
node src/index.js
# Server running on http://localhost:5000
```

### 5. Start Frontend

```bash
cd frontend
npm run dev
# App running on http://localhost:3000
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-code` | Send OTP to university email |
| POST | `/api/auth/register` | Verify OTP + create wallet + register on-chain |
| POST | `/api/auth/login` | Login with token, returns user profile |

### Rumors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rumors` | List rumors (with pagination, filters) |
| GET | `/api/rumors/:id` | Get rumor detail (with embedded content) |
| POST | `/api/rumors/create` | Submit rumor (auth required, multipart) |
| GET | `/api/rumors/:id/content` | Fetch IPFS content by hash |

### Voting

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/votes` | Cast vote (auth required, `{ rumorId, voteType }`) |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:address` | Get full user profile from blockchain |
| GET | `/api/users/:address/stats` | Get computed user statistics |
| GET | `/api/users/:address/votes/:rumorId` | Check if user voted on rumor |

### Correlations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/correlations/:rumorId` | Get related rumors (supportive + contradictory) |

### Admin / Test Rumors

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/test-rumor/generate` | Manually trigger a test rumor generation |
| POST | `/api/admin/test-rumor/verify` | Manually trigger auto-verification of expired test rumors |
| GET | `/api/admin/test-rumors` | List all test rumors with status |

---

## 🔒 Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  IDENTITY LAYER                                          │    │
│  │  • HMAC-SHA256 email hashing (irreversible)              │    │
│  │  • AES-256-CBC wallet encryption at rest                 │    │
│  │  • One email → one wallet (enforced on-chain)            │    │
│  │  • No PII stored on blockchain                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  TRANSACTION LAYER                                       │    │
│  │  • Backend signs all transactions (users don't need ETH)  │    │
│  │  • Master wallet funds user wallets automatically         │    │
│  │  • authorizedCallers pattern for cross-contract calls     │    │
│  │  • Ownable + AccessControl (OpenZeppelin)                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  DATA LAYER                                              │    │
│  │  • Content stored on IPFS (immutable, content-addressed) │    │
│  │  • Smart contract state is append-only (blockchain)       │    │
│  │  • SQLite for ephemeral auth tokens only                  │    │
│  │  • No sensitive data in frontend (server-side wallets)    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  VOTING INTEGRITY                                        │    │
│  │  • On-chain duplicate vote prevention                     │    │
│  │  • Self-vote prevention (authors can't vote own rumors)   │    │
│  │  • Rate limiting enforced in Solidity (not backend)       │    │
│  │  • Weighted votes prevent Sybil attacks                   │    │
│  │  • Post-lock vote dampening (95/5 rule)                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏁 Conclusion

This project demonstrates how **truth can emerge without authority**. By combining cryptographic identity, credibility-weighted community voting, AI-assisted correlation detection, and immutable blockchain history, the system resists manipulation while preserving complete student anonymity.

Every design decision directly addresses a specific attack vector — from Sybil bots to coordinated lying to ghost influence from deleted rumors. The result is a **provably fair, mathematically verifiable trust protocol** for campus information.

---

## 📄 License

MIT License

