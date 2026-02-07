# Campus Rumors Backend

> **Decentralized Anonymous Rumor Verification System**
> Backend API for blockchain-powered campus rumor verification with AI-driven correlation analysis.

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Runtime** | Node.js | JavaScript runtime |
| **Framework** | Express.js | REST API framework |
| **Blockchain** | ethers.js v6 | Polygon/EVM smart contract interaction |
| **Storage** | SQLite (better-sqlite3) | Local user token database |
| **IPFS** | Pinata | Decentralized content storage |
| **AI** | Google Gemini 2.5 Flash | Keyword extraction & correlation analysis |
| **Email** | Nodemailer | SMTP email verification |
| **Auth** | Custom token-based | Permanent 64-char hex tokens |

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.js              # Entry point, Express app setup
│   ├── routes/
│   │   ├── auth.js           # Authentication (register, login, send-code)
│   │   ├── rumors.js         # Rumor CRUD operations
│   │   ├── users.js          # User profile & stats
│   │   ├── votes.js          # Voting on rumors
│   │   └── correlations.js   # AI-powered rumor correlation
│   └── services/
│       ├── tokenService.js   # Token generation, wallet creation, SQLite
│       ├── emailService.js   # Email verification codes, SMTP
│       ├── blockchainService.js # Smart contract interactions
│       ├── geminiService.js  # Google Gemini AI integration
│       ├── ipfsService.js    # Pinata IPFS upload/fetch
│       └── authService.js    # Authentication helpers
├── data/
│   └── tokens.db             # SQLite database (auto-created)
└── package.json
```

---

## 🔗 Smart Contracts

The backend interacts with the following deployed smart contracts:

| Contract | Purpose |
|----------|---------|
| **IdentityRegistry** | Student registration, credibility scores, status management |
| **RumorRegistry** | Rumor creation, content hash storage, confidence tracking |
| **VotingSystem** | Vote casting, weighted voting based on credibility |
| **CredibilityToken** | ERC-20 token representing user credibility |
| **CorrelationManager** | Rumor relationship tracking (supportive/contradictory) |
| **VerificationController** | Backend signature verification for gasless transactions |

---

## 🔄 Architecture Flow

### User Registration Flow

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend   │────▶│  /send-code │────▶│ EmailService │────▶│  SMTP/Gmail │
└──────────────┘     └─────────────┘     └──────────────┘     └─────────────┘
       │                                                              │
       │  Enter code                                      6-digit code
       ▼                                                              │
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend   │────▶│  /register  │────▶│ TokenService │────▶│   SQLite    │
└──────────────┘     └─────────────┘     │  - Create wallet   └─────────────┘
                                         │  - Generate token
                                         │  - Hash email
                                         └───────┬──────┘
                                                 │
                                                 ▼
                                         ┌──────────────┐
                                         │  Blockchain  │
                                         │  - Fund wallet
                                         │  - Register student
                                         └──────────────┘
```

### Rumor Creation Flow

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend   │────▶│  /rumors    │────▶│  IPFSService │
│  (with auth) │     │  /create    │     │  - Upload JSON
└──────────────┘     └─────────────┘     │  - Upload files
                                         └───────┬──────┘
                                                 │
                                                 ▼
                                         ┌──────────────┐
                                         │ GeminiService│
                                         │  - Extract keywords
                                         │  - Generate embedding
                                         └───────┬──────┘
                                                 │
                                                 ▼
                                         ┌──────────────┐
                                         │  Blockchain  │
                                         │  - createRumor()
                                         │  - Emit RumorCreated
                                         └──────────────┘
```

### Voting Flow

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend   │────▶│  /votes     │────▶│  Blockchain  │
│  (with auth) │     │  POST       │     │  - voteOnRumor()
└──────────────┘     └─────────────┘     │  - Update confidence
                                         │  - Update credibility
                                         └──────────────┘
```

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/send-code` | Send 6-digit verification code to .edu.pk email |
| `POST` | `/api/auth/register` | Verify code, create account, generate permanent token |
| `POST` | `/api/auth/login` | Login with permanent token |
| `GET` | `/api/auth/me` | Get current user info (requires Bearer token) |

### Rumors

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rumors` | List rumors (with pagination, status filter) |
| `GET` | `/api/rumors/:id` | Get single rumor with content |
| `POST` | `/api/rumors/create` | Create new rumor (auth required) |
| `GET` | `/api/rumors/:id/content` | Fetch rumor content from IPFS |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/:address` | Get user profile by wallet |
| `GET` | `/api/users/:address/stats` | Get user statistics |
| `GET` | `/api/users/:address/votes/:rumorId` | Check if user voted on rumor |

### Votes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/votes` | Cast vote on rumor (auth required) |

### Correlations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/correlations/:rumorId` | Get related rumors (supportive/contradictory) |
| `POST` | `/api/correlations/analyze` | AI analysis of two rumor texts |

---

## 🔐 Security Features

- **Email HMAC**: Emails are hashed with HMAC-SHA256 before storage (privacy-preserving)
- **Token Hashing**: User tokens are SHA256 hashed in database (tokens never stored raw)
- **Private Key Encryption**: Wallet private keys are AES-256-CBC encrypted
- **University Validation**: Only `.edu.pk` emails are accepted for registration
- **Rate Limiting**: Verification codes have 5 attempt limit and 10-minute expiry

---

## 🧠 AI Features (Gemini Integration)

1. **Keyword Extraction**: Automatically extracts 5-10 relevant keywords from rumor text
2. **Text Embeddings**: Generates 768-dimension embeddings for semantic similarity
3. **Correlation Analysis**: Determines if two rumors describe the same event
4. **Relationship Classification**: Labels rumors as `supportive`, `contradictory`, or `unrelated`

---

## ⚙️ Environment Variables

```env
# Blockchain
POLYGON_AMOY_RPC_URL=http://127.0.0.1:8545
MASTER_PRIVATE_KEY=<funded wallet private key>

# Contract Addresses
IDENTITY_REGISTRY_ADDRESS=0x...
RUMOR_REGISTRY_ADDRESS=0x...
VOTING_SYSTEM_ADDRESS=0x...
CREDIBILITY_TOKEN_ADDRESS=0x...
CORRELATION_MANAGER_ADDRESS=0x...

# Backend
PORT=5000
NODE_ENV=development

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<app-password>

# Security
HMAC_SECRET=<random-secret-for-email-hashing>

# IPFS (Pinata)
PINATA_API_KEY=<api-key>
PINATA_SECRET_KEY=<secret-key>

# AI
GEMINI_API_KEY=<google-ai-api-key>
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Local Hardhat node running (or Polygon Amoy testnet)
- Deployed smart contracts

### Installation

```bash
cd backend
npm install
```

### Run Development Server

```bash
# Start Hardhat node first (from project root)
npx hardhat node

# Deploy contracts (from project root)
npx hardhat run scripts/deploy.js --network localhost

# Start backend
cd backend
npm run dev
```

### Production

```bash
npm start
```

---

## 📊 Database Schema

**SQLite Table: `users`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment primary key |
| `token_hash` | TEXT | SHA256 hash of user's permanent token |
| `email_hash` | TEXT | HMAC-SHA256 of email address |
| `wallet_address` | TEXT | Ethereum wallet address |
| `private_key_enc` | TEXT | AES-256-CBC encrypted private key |
| `created_at` | TEXT | Registration timestamp |

---

## 🔌 Service Dependencies

```
Express App
    │
    ├── Routes
    │   ├── auth.js ─────────▶ tokenService, emailService, blockchainService
    │   ├── rumors.js ───────▶ ipfsService, geminiService, blockchainService
    │   ├── users.js ────────▶ blockchainService
    │   ├── votes.js ────────▶ blockchainService, tokenService
    │   └── correlations.js ─▶ geminiService, blockchainService, ipfsService
    │
    └── Services
        ├── tokenService ────▶ SQLite, ethers (wallet generation)
        ├── emailService ────▶ Nodemailer (SMTP)
        ├── blockchainService ▶ ethers (contract calls)
        ├── geminiService ───▶ @google/generative-ai
        └── ipfsService ─────▶ Pinata API
```

---

## 🧪 Health Check

```bash
curl http://localhost:5000/health
# Response: {"status":"ok","timestamp":"2024-..."}
```

---

## 📝 License

MIT License - Built for hackathon demonstration purposes.
