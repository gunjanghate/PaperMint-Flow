<img width="1464" height="819" alt="image" src="https://github.com/user-attachments/assets/85c54c6c-908d-4333-bf5b-4261ee904803" />


# 📄 PaperMint — Research Paper NFT Marketplace

**PaperMint** is a web-based marketplace where authors can publish encrypted research papers, mint NFTs as proof of authorship, and earn revenue when others purchase access.
Buyers receive NFT access tokens and can securely decrypt/download purchased datasets.

The platform blends decentralized storage (IPFS via Lighthouse), blockchain proofs (NFT minting), and traditional metadata indexing (MongoDB) to provide a trust-preserving publishing experience.

> ✅ Built for researchers
> ✅ Fair monetization
> ✅ Secure gated access
> ✅ Transparent on-chain history

---

## 🚀 Core Features

✔ Publish research papers with metadata & IPFS CIDs
✔ AES-encrypted datasets for secure access control
✔ NFT minted to the author as proof of ownership
✔ Buyers pay authors & receive an access NFT
✔ All actions indexed in MongoDB
✔ NRC (dynamic pricing via view-based increase)
✔ Dataset access only if wallet + NFT validated
✔ Track purchases + access on-chain + off-chain
✔ Simple UI for browsing & purchasing papers

---

## 🧩 Tech Stack

**Frontend**

* Next.js 15 (App Router)
* React 19
* Tailwind CSS
* ShadCN UI

**Blockchain / Storage**

* Solidity smart contracts (DatasetNFT)
* Lighthouse for IPFS storage
* FVM / EVM provider

**Backend**

* MongoDB Atlas
* Next.js API Routes
* Ethers.js
* AES Encryption (CryptoJS)

---

## 🗂 Project Structure

```
app/
  api/
    datasets/route.js        # list + update (views, purchasers)
    purchases/route.js       # purchase store & fetch
    my-purchases/route.js    # list datasets bought by user
  ...
lib/
  mongodb.js                 # Mongo client
  nft.js                     # NFT minting + owner check
contract/
  DatasetNFT.sol
  NewDatasetNFT.sol
```

---

## 🔐 Data Model

### `datasets` collection

```
{
  _id: ObjectId,
  title: string,
  description: string,
  cid: string,              // encrypted paper
  imageCid?: string,
  metadataCid?: string,
  decryptionKey?: string,   // AES key (hex)
  authorAddress: string,
  tokenId?: number,         // author NFT
  txHash?: string,          // author mint tx
  version?: number,
  previousCID?: string,
  views: number,
  purchasers: string[],
  uploadedAt: Date
}
```

### `purchases` collection

```
{
  _id: ObjectId,
  datasetId: string,
  purchaserAddress: string,
  purchaserTokenId: number,
  txHash?: string,          // purchase/mint tx
  decryptionKey: string,    // copy for safety
  purchasedAt: Date,
  updatedAt?: Date
}
```

---

## 🔄 Core Flows

### 1) Upload → Mint → Publish

* Client encrypts dataset locally → uploads to Lighthouse
* Metadata stored in MongoDB
* Author NFT minted
* Dataset tokenId + txHash saved

### 2) View datasets

`GET /api/datasets`

* Lists all papers sorted by latest

### 3) Purchase + Mint Access Token

Payment flow:

* User pays author
* System checks if user already owns token
* If not → new NFT minted
* Purchase record saved w/ token + txHash
* AES key resolved via DB
* Paper downloaded + decrypted client-side
* Views + purchasers updated

### 4) Retrieve Purchases

`GET /api/my-purchases`

---

## 🔗 API Summary

| Route               | Method | Description                     |
| ------------------- | ------ | ------------------------------- |
| `/api/datasets`     | GET    | List all datasets               |
| `/api/datasets`     | PATCH  | Increment views + add purchaser |
| `/api/purchases`    | POST   | Record purchase                 |
| `/api/purchases`    | GET    | Get purchases for wallet        |
| `/api/my-purchases` | GET    | Shortcut → user-owned papers    |

---

## 🔧 Environment Variables

`.env`

```
MONGODB_URI=...

# IPFS
NEXT_PUBLIC_LIGHTHOUSE_API_KEY=...

# Contract
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x...

# RPC + Chain
NEXT_PUBLIC_FVM_RPC=https://api.calibration.node.glif.io/rpc/v1
NEXT_PUBLIC_CHAIN_ID=314159
```

> ⚠ If Mongo password contains special chars → URL-encode it.

---

## 🏁 Setup

```bash
npm install
npm run dev
```

Open → [http://localhost:3000](http://localhost:3000)

---

## ⚙ Development Details

✅ Hot reload works automatically
✅ MongoDB uses pooled client via global instance
✅ Server logs via `console.debug/error`
✅ Decryption uses AES-ECB + PKCS7
✅ NFT metadata stored on Lighthouse

---

## 🔐 Security Notes

* AES encryption applied client-side
* AES key stored in DB & purchase logs for redundancy
* Must match 64-hex signature or rejected
* NFT ownership checked before allowing decrypt access
* Payments directly to author wallet

> Reality check → Keys in DB are safe enough for this prototype but can be hardened via key-wrapping / remote KMS in future.

---

## ✅ Current Limitations / Roadmap

* ⏳ No royalties beyond initial purchase
* 🔜 Author dashboards
* 🔜 Multi-edition release model
* 🔜 Optional zero-knowledge pay-to-view
* 🔜 On-chain metadata synchronization

Forward scope is huge — especially around researcher reputation and indexing.

---

## 📝 License

MIT

---

# Why PaperMint?

Publishing is broken — paywalls and opaque journals dominate distribution.
PaperMint flips it:

* Direct author payments
* Ownership proof on-chain
* Instant access
* Open yet permissioned

Researchers deserve better.
This is step one.

Let’s build 🔥



Just say the word.
