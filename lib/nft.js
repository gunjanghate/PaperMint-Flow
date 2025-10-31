import { ethers } from 'ethers';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
const RPC = process.env.NEXT_PUBLIC_FVM_RPC;
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID);
// ABI aligned with NewDatasetNFT contract provided
const ABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "approve",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "initialOwner",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "ERC721IncorrectOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ERC721InsufficientApproval",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "approver",
				"type": "address"
			}
		],
		"name": "ERC721InvalidApprover",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			}
		],
		"name": "ERC721InvalidOperator",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "ERC721InvalidOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "receiver",
				"type": "address"
			}
		],
		"name": "ERC721InvalidReceiver",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "ERC721InvalidSender",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ERC721NonexistentToken",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "uri",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "cid",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "decryptionKey",
				"type": "string"
			}
		],
		"name": "mintDataset",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "OwnableInvalidOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "OwnableUnauthorizedAccount",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "approved",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Approval",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "approved",
				"type": "bool"
			}
		],
		"name": "ApprovalForAll",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "_fromTokenId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "_toTokenId",
				"type": "uint256"
			}
		],
		"name": "BatchMetadataUpdate",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "_tokenId",
				"type": "uint256"
			}
		],
		"name": "MetadataUpdate",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "previousOwner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			},
			{
				"internalType": "bytes",
				"name": "data",
				"type": "bytes"
			}
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "approved",
				"type": "bool"
			}
		],
		"name": "setApprovalForAll",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "transferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "getApproved",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "getDatasetCID",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "getDecryptionKey",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			}
		],
		"name": "isApprovedForAll",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "name",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ownerOf",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "symbol",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "tokenURI",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

export async function addNetworkIfNeeded() {
	if (!window?.ethereum) {
		console.warn('Debug: No Ethereum provider (MetaMask?)');
		return;
	}

	const toHex = (id) => `0x${Number(id).toString(16)}`;

	// Flow EVM Testnet only
	const flowEvmTestnet = {
		chainId: toHex(545),
		chainName: 'Flow EVM Testnet',
		rpcUrls: ['https://testnet.evm.nodes.onflow.org'],
		nativeCurrency: { name: 'FLOW', symbol: 'FLOW', decimals: 18 },
		blockExplorerUrls: ['https://evm-testnet.flowscan.io'],
	};

	try {
		console.log('Debug: Adding network:', flowEvmTestnet.chainName, flowEvmTestnet.chainId);
		await window.ethereum.request({
			method: 'wallet_addEthereumChain',
			params: [flowEvmTestnet],
		});
		console.log('Debug: Network added:', flowEvmTestnet.chainName);
	} catch (error) {
		console.warn(`Debug: Add ${flowEvmTestnet.chainName} failed (may already exist):`, error?.message || error);
	}
}

export async function mintNFT(to, uri, cid, decryptionKey) {
	console.log('Debug: Starting mintNFT...');
	console.log('Debug: Params - to:', to, 'uri:', uri, 'cid:', cid, 'key.len:', decryptionKey?.length);
	if (!to || !ethers.isAddress(to)) throw new Error('Invalid recipient address');
	if (!uri) throw new Error('Missing metadata URI');
	if (!cid) throw new Error('Missing dataset CID');

	await addNetworkIfNeeded();
	const provider = new ethers.BrowserProvider(window.ethereum);
	await provider.send('wallet_switchEthereumChain', [{ chainId: `0x${CHAIN_ID.toString(16)}` }]);
	const signer = await provider.getSigner();
	const signerAddress = await signer.getAddress();
	console.log('Debug: Signer address:', signerAddress);
	const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
	console.log('Debug: Contract address:', CONTRACT_ADDRESS, 'ABI length:', ABI.length);

	// Simulation (staticCall) to surface early reverts
	try {
		await contract.mintDataset.staticCall(to, uri, cid, decryptionKey || '');
		console.log('Debug: staticCall mintDataset passed.');
	} catch (simErr) {
		console.warn('Debug: staticCall mintDataset reverted:', simErr?.message || simErr);
		const data = simErr?.data || simErr?.error?.data;
		if (data) console.warn('Debug: staticCall revert data:', data);
		throw simErr; // Abort early; sending would also fail.
	}

	// Gas estimate with buffer
	let gasLimit = 500000n;
	try {
		const gasEst = await contract.mintDataset.estimateGas(to, uri, cid, decryptionKey || '');
		gasLimit = (gasEst * 120n) / 100n; // +20%
		console.log('Debug: Gas estimate:', gasEst.toString(), 'Buffered gasLimit:', gasLimit.toString());
	} catch (gErr) {
		console.warn('Debug: Gas estimation failed, using fallback 500000:', gErr?.message || gErr);
	}

	try {
		const txPromise = contract.mintDataset(to, uri, cid, decryptionKey || '', { gasLimit });
		if (!txPromise || typeof txPromise.then !== 'function') {
			throw new Error('mintDataset did not return a transaction promise. ABI/address mismatch?');
		}
		const tx = await txPromise;
		console.log('Debug: Tx sent! Hash:', tx.hash, 'Gas limit:', tx.gasLimit?.toString?.());
		const receipt = await tx.wait();
		console.log('Debug: Tx confirmed! Block:', receipt.blockNumber, 'Gas used:', receipt.gasUsed.toString());

		// Parse Transfer event to extract tokenId
		let tokenId = null;
		try {
			const transferTopic = ethers.id('Transfer(address,address,uint256)');
			for (const log of receipt.logs) {
				if (log.address?.toLowerCase() === CONTRACT_ADDRESS?.toLowerCase() && log.topics?.[0] === transferTopic) {
					try {
						const parsed = contract.interface.parseLog(log);
						if (parsed?.args?.tokenId != null) {
							tokenId = parsed.args.tokenId.toString();
							break;
						}
					} catch (inner) {
						// Fallback: tokenId is indexed third topic (topics[3]) in ERC721 Transfer
						if (log.topics.length >= 4) {
							try {
								const raw = log.topics[3];
								if (raw) {
									// BigInt parse
									const bn = BigInt(raw);
									tokenId = bn.toString();
									break;
								}
							} catch {/* ignore */}
						}
					}
				}
			}
		} catch (e) {
			console.warn('Debug: Transfer event scan failed:', e);
		}
		if (tokenId) console.log('Debug: Minted tokenId:', tokenId);
		return { txHash: tx.hash, tokenId };
	} catch (error) {
		console.error('Debug: Mint tx failed:', error);
		if (error.reason) console.error('Debug: Revert reason:', error.reason);
		if (error.data) console.error('Debug: Error data:', error.data);
		throw error;
	}
}

export async function getDatasetCID(tokenId) {
  console.log('Debug: Fetching CID for tokenId:', tokenId);
  const provider = new ethers.JsonRpcProvider(RPC);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  try {
    const cid = await contract.getDatasetCID(tokenId);
    console.log('Debug: Retrieved CID:', cid);
    return cid;
  } catch (error) {
    console.error('Debug: getDatasetCID failed:', error);
    throw error;
  }
}

export async function getDecryptionKey(tokenId) {
  console.log('Debug: Fetching decryption key for tokenId:', tokenId);
	if (!window || !window.ethereum) {
		throw new Error('No Ethereum provider available in window');
	}
	try {
		const provider = new ethers.BrowserProvider(window.ethereum);
		// Use a signer so the call includes msg.sender (required by contract getter)
		const signer = await provider.getSigner();
		const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
		const key = await contract.getDecryptionKey(tokenId);
		console.log('Debug: Retrieved key:', key);
		return key;
	} catch (error) {
		console.error('Debug: getDecryptionKey failed:', error);
		throw error;
	}
}

export async function ownerOfToken(tokenId) {
	const provider = new ethers.JsonRpcProvider(RPC);
	const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
	try {
		return await contract.ownerOf(tokenId);
	} catch (e) {
		console.warn('Debug: ownerOfToken failed:', e?.message || e);
		return null;
	}
}