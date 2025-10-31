// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NewDatasetNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    mapping(uint256 => string) private _datasetCIDs;    // Token ID → CID
    mapping(uint256 => string) private _decryptionKeys; // Token ID → Decryption Key (optional)

    // Marketplace Features
    struct Listing {
        bool active;
        uint256 price; // In wei
        address seller; // Original owner
    }
    mapping(uint256 => Listing) public listings; // tokenId → Listing

    event NFTListed(uint256 indexed tokenId, address seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event PriceUpdated(uint256 indexed tokenId, uint256 newPrice);
    event SaleCancelled(uint256 indexed tokenId, address seller);

    constructor(address initialOwner)
        ERC721("NewDatasetNFT", "DSNFT")
        Ownable(initialOwner)
    {}

    /// @dev Mint a new dataset NFT
    function mintDataset(
        address to,
        string memory uri,
        string memory cid,
        string memory decryptionKey
    ) public {
        require(bytes(uri).length > 0, "URI required");
        require(bytes(cid).length > 0, "CID required");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        _datasetCIDs[tokenId] = cid;
        if (bytes(decryptionKey).length > 0) {
            _decryptionKeys[tokenId] = decryptionKey;
        }
    }

    /// @notice View CID of dataset
    function getDatasetCID(uint256 tokenId) external view returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Invalid token");
        return _datasetCIDs[tokenId];
    }

    /// @notice Get decryption key (only for owner)
    function getDecryptionKey(uint256 tokenId) external view returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Invalid token");
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        return _decryptionKeys[tokenId];
    }

    /// @notice List NFT for sale (approves contract for transfer)
function listForSale(uint256 tokenId, uint256 price) external {
    require(ownerOf(tokenId) == msg.sender, "Not owner");
    require(price > 0, "Price must be > 0");
    require(!listings[tokenId].active, "Already listed");

    // Updated: Add msg.sender as auth
    _approve(address(this), tokenId, msg.sender);

    listings[tokenId] = Listing({
        active: true,
        price: price,
        seller: msg.sender
    });

    emit NFTListed(tokenId, msg.sender, price);
}

    /// @notice Update listing price (only seller)
    function updatePrice(uint256 tokenId, uint256 newPrice) external {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(listing.seller == msg.sender, "Not seller");
        require(newPrice > 0, "Price must be > 0");

        listing.price = newPrice;
        emit PriceUpdated(tokenId, newPrice);
    }

    /// @notice Buy listed NFT (automatic transfer on payment)
    function buy(uint256 tokenId) external payable {
        Listing memory listing = listings[tokenId];
        require(listing.active, "Not for sale");
        require(msg.value >= listing.price, "Insufficient payment");

        address seller = listing.seller;
        address buyer = msg.sender;

        // Transfer NFT to buyer
        _transfer(seller, buyer, tokenId);

        // Deactivate listing
        listings[tokenId].active = false;

        // Refund overpayment
        if (msg.value > listing.price) {
            payable(buyer).transfer(msg.value - listing.price);
        }

        // Send payment to seller
        payable(seller).transfer(listing.price);

        emit NFTSold(tokenId, seller, buyer, listing.price);
    }

    /// @notice Cancel listing (only seller)
function cancelSale(uint256 tokenId) external {
    Listing storage listing = listings[tokenId];
    require(listing.active, "Not listed");
    require(listing.seller == msg.sender, "Not seller");

    // Revoke self-approval (now requires `msg.sender` as auth)
    _approve(address(0), tokenId, msg.sender);

    listing.active = false;
    emit SaleCancelled(tokenId, msg.sender);
}

function burn(uint256 tokenId) external {
    require(ownerOf(tokenId) == msg.sender, "Not owner");
    _burn(tokenId);
    delete _datasetCIDs[tokenId];
    delete _decryptionKeys[tokenId];
    // Also clear listing if active
    if (listings[tokenId].active) {
        _approve(address(0), tokenId, msg.sender); // ✅ Fixed
        listings[tokenId].active = false;
    }
}

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}