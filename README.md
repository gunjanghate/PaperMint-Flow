# Filecoin HBD - On‑Chain Research Publishing with NFT Rewards

Filecoin HBD is a Next.js app for publishing research datasets and papers on‑chain. Authors are rewarded and receive an NFT minted as proof of ownership. Buyers can purchase access, and all activity is tracked via MongoDB and smart contract events.

## Highlights

- Publish datasets with metadata and IPFS/Lighthouse CIDs
- Mint an NFT to the author as proof of ownership
- Reward authors when datasets are purchased
- Track purchases and token IDs on‑chain and in the database
- Next.js App Router, Tailwind CSS, MongoDB Atlas

## Tech stack

- Next.js 15 (App Router)
- React 19
- MongoDB (Atlas)
- Lighthouse SDK for IPFS/Filecoin storage
- Smart contracts (Solidity) in `contract/` (DatasetNFT)

## Project structure

```
app/
	api/
		datasets/route.js      # list datasets, increment views/purchasers
		purchases/route.js     # store and fetch purchases with tokenIds
		my-purchases/route.js  # list datasets bought by an address
	...pages
lib/
	mongodb.js               # MongoDB client (uses MONGODB_URI)
	nft.js                   # NFT interactions (minting, etc.)
contract/
	DatasetNFT.sol, NewDatasetNFT.sol
```

## Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster (recommended) or MongoDB instance
- An RPC endpoint for Filecoin Calibration (default provided)

## Environment variables

Create a `.env` file in the project root with:

```
# MongoDB Atlas SRV URI (use your real values)
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.<abcde>.mongodb.net/researchdb?retryWrites=true&w=majority&appName=<appName>

# Lighthouse API key (client-side use enabled)
NEXT_PUBLIC_LIGHTHOUSE_API_KEY=<your_lighthouse_key>

# Deployed DatasetNFT address
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=<0x...>

# Filecoin Calibration RPC + chain id
NEXT_PUBLIC_FVM_RPC=https://api.calibration.node.glif.io/rpc/v1
NEXT_PUBLIC_CHAIN_ID=314159
```

Notes:
- Keep `/researchdb` at the end of your Mongo URI so it matches the code (`client.db('researchdb')`).
- If your Mongo password has special characters (e.g., `@` or `/`), URL‑encode it.
- For development, in Atlas set Network Access to your IP or 0.0.0.0/0 (temporary) and create a database user.

## Install and run (Windows PowerShell)

```powershell
# From the project root
npm install

# Start the dev server
npm run dev

# Open the app
Start-Process http://localhost:3000
```

## Core flows

1) Upload dataset (app UI → `app/api/upload/route.js`)
- Stores metadata (title, description, CIDs, tokenId, txHash) into MongoDB

2) List datasets (`GET /api/datasets`)
- Returns datasets ordered by `uploadedAt`, serializes `_id` to string

3) View/purchase update (`PATCH /api/datasets`)
- Body: `{ id, purchaser }`
- Increments `views` and adds `purchasers` entry

4) Record a purchase (`POST /api/purchases`)
- Body: `{ datasetId, purchaserAddress, purchaserTokenId, txHash }`
- Upserts a record keyed by `datasetId + purchaserAddress`

5) Fetch purchases (`GET /api/purchases?address=0x...`)
- Returns purchased datasets enriched with `purchaserTokenId`

## API reference (summary)

- `GET /api/datasets` → `[{ ...dataset, _id: string }]`
- `PATCH /api/datasets` → `{ ok: true, dataset }` (requires `{ id, purchaser }`)
- `POST /api/purchases` → `{ ok: true, insertedId } | { ok: true, updated: true }`
- `GET /api/purchases?address=0x...` → enriched dataset list for an address

## Data model (MongoDB)

Collection `datasets` (example):
```
{
	_id: ObjectId,
	title: string,
	description: string,
	cid: string,             # data CID
	imageCid?: string,
	metadataCid?: string,
	version: number,
	previousCID?: string,
	views: number,
	purchasers: string[],    # wallet addresses
	authorAddress: string,
	decryptionKey?: string,  # hashed/derived if used
	tokenId?: number,        # author’s minted NFT token id
	txHash?: string,
	uploadedAt: Date
}
```

Collection `purchases` (example):
```
{
	_id: ObjectId,
	datasetId: string,       # dataset _id as string
	purchaserAddress: string,
	purchaserTokenId: number,
	txHash?: string,
	purchasedAt: Date,
	updatedAt?: Date
}
```

## Development tips

- Hot reload: files under `app/` update automatically.
- Logs: API routes log to the server console with `console.debug/console.error`.
- Mongo connection: configured in `lib/mongodb.js`, reuses a global client in development.

## Troubleshooting

- Mongo connection fails
	- Ensure `MONGODB_URI` is set and valid in `.env`.
	- Atlas Network Access allows your IP; a DB user is created with proper roles.
	- If you see auth errors, URL‑encode your password.

- Dataset not found on PATCH
	- IDs can be ObjectId strings or raw strings in older data. The route tries both.

- NFT/tokenId missing
	- Confirm contract deployment address and RPC are set via `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` and `NEXT_PUBLIC_FVM_RPC`.

## License

MIT
