// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NewDatasetNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    mapping(uint256 => string) private _datasetCIDs;    // Token ID → CID
    mapping(uint256 => string) private _decryptionKeys; // Token ID → Decryption Key (optional)

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

    /// @dev Burn NFT and clear data

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