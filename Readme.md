# Decentralized Campus Rumor Verification System

> A fully decentralized, privacy‑preserving system where students anonymously verify campus rumors using community voting, cryptographic identities, and AI assistance powered by **Google Gemini API** — with **no central authority controlling truth**.

---

## 1. Motivation

University campuses are fertile ground for rumors: class cancellations, security alerts, event changes, or administrative decisions. Today, students rely on WhatsApp groups, Facebook pages, or word of mouth — all of which suffer from misinformation, manipulation, and lack of accountability.

Centralized platforms fail because:

* moderators can censor or bias outcomes,
* popularity often beats correctness,
* anonymity enables bots and fake accounts,
* historical facts can be silently altered.

This project proposes a **trust protocol**, not just an app.

---

## 2. Problem Statement

We are asked to design a system where:

* there is **no central admin** controlling truth,
* students remain **anonymous**,
* users cannot vote multiple times without revealing identity,
* popular false rumors must not win automatically,
* old verified facts must never change,
* bot accounts attempt to manipulate votes,
* deleted rumors still influence newer ones (a known bug),
* and the system must be **provably resistant** to coordinated lying.

---

## 3. Core Design Principles

1. **Truth is computed, not decided**
2. **Anonymity with accountability**
3. **History must be immutable**
4. **Influence must be earned**
5. **AI assists, humans decide**

---

## 4. High‑Level Architecture (Hybrid)

The system deliberately uses a **hybrid on‑chain + off‑chain model**.

### On‑Chain (Blockchain)

* anonymous student identities
* rumor metadata
* votes and voting weights
* trust / credibility scores
* time‑based locking
* audit trail

### Off‑Chain (Traditional Services)

* university email verification
* AI analysis (Gemini API)
* IPFS storage
* indexing and search

### Storage Layers

| Layer      | Purpose                  |
| ---------- | ------------------------ |
| Blockchain | immutable truth & voting |
| IPFS       | rumor text & evidence    |
| Database   | fast queries & AI data   |

### Architecture Flow Diagram

```text
Student Browser + Wallet
        |
        |  (email verify + sign wallet)
        v
Backend API (Node.js)
        |
        |  events / API calls
        v
Blockchain (Smart Contracts)
        |
        |  store hashes & votes
        v
IPFS (Rumor Content & Evidence)
        |
        v
PostgreSQL + Redis (Index & Cache)
```

The blockchain is the **source of truth**, while off‑chain services provide speed, AI, and usability.

---

## 5. Identity Without Identity

### The Problem

Anonymity allows abuse, but identity collection violates privacy.

### The Solution

* students verify university email **once**
* backend stores **HMAC(email)** only
* student connects a crypto wallet
* smart contract enforces:

  * one wallet → one studentID
  * one vote per rumor

No real‑world identity is stored or visible.

---

## 6. Rumor Lifecycle

1. student submits rumor text
2. evidence uploaded to IPFS
3. Gemini API generates:

   * semantic embeddings
   * extracted entities
4. rumor metadata stored on blockchain
5. initial trust score calculated

Rumors remain **ACTIVE** for a fixed voting window (e.g., 7 days).

### Rumor Lifecycle Flow

```text
Student
  |
  | submit rumor + evidence
  v
IPFS (store content)
  |
  | return content hash
  v
Backend
  |
  | Gemini embedding + similarity
  v
Blockchain
  |
  | create rumor + initial trust
  v
ACTIVE RUMOR
```

---

## 7. Voting & Trust Scores

### Voting Rules

* confirm or dispute
* one vote per rumor per student
* votes are permanently recorded

### Weighted Voting

Votes are weighted by credibility:

* new users → very low impact
* accurate users → higher weight
* discredited users → minimal or zero impact

Popularity alone cannot dominate correctness.

### Voting Flow Diagram

```text
Student
  |
  | confirm / dispute
  v
Blockchain
  |
  | check: not voted before
  | apply credibility weight
  v
Blockchain
  |
  | update trust score
```

---

## 8. AI Assistance Using Gemini API

### Why AI Is Needed

Humans are slow at detecting relationships between rumors.

### Gemini API Usage (Off‑Chain)

* generate text embeddings
* detect similar rumors
* classify relationships:

  * supportive
  * contradictory

### Important Constraint

AI **never decides truth**.
It only suggests correlations.

Final trust changes are applied **on‑chain** using deterministic rules.

---

## 9. Preventing Bot & Sybil Attacks

Bots fail because:

* each account needs a verified university email
* wallets are expensive to manage at scale
* credibility grows slowly
* penalties are immediate

A coordinated liar group experiences **net negative influence over time**.

---

## 10. Time Locking & Immutability

After the voting window:

* rumor is locked
* trust score is frozen
* further votes have no effect

This prevents historical facts from changing.

---

## 11. Deletion & the "Ghost Influence" Bug

### Observed Issue

Deleted rumors were still affecting newer ones.

### Designed Fix

* rumors are never hard‑deleted
* a **tombstone record** preserves final trust
* only a fixed fraction (e.g., 30%) can be redistributed
* redistribution happens once and is auditable

This converts a bug into a controlled feature.

---

## 12. Mathematical Resistance to Coordinated Lying

Let:

* ( w_i ) = vote weight of user ( i )
* ( C_i ) = credibility score

Total influence:

[
I = \sum w_i(C_i)
]

Properties:

* credibility increases slowly
* credibility decreases rapidly when wrong
* new accounts start near zero weight

As time increases, dishonest coalitions lose influence faster than they can gain it.

This makes large‑scale lying **unsustainable**.

---

## 13. Tech Stack (Free & Practical)

### Frontend

* Next.js
* TypeScript
* Tailwind CSS
* ethers.js

### Backend

* Node.js + Express
* PostgreSQL
* Redis
* Docker

### Blockchain

* Polygon testnet
* Solidity 0.8+
* Hardhat

### Storage

* IPFS
* Pinata (free tier)

### AI

* **Google Gemini API (free tier)**

### Wallet

* MetaMask
* WalletConnect

---


## 14. Conclusion

This project demonstrates how **truth can emerge without authority**.

By combining:

* cryptographic identity,
* community voting,
* AI‑assisted correlation,
* and immutable history,

the system resists manipulation while preserving anonymity.


