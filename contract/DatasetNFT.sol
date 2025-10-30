// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DatasetNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    mapping(uint256 => string) private _datasetCIDs;  // Token ID → CID

    constructor(address initialOwner)
        ERC721("DatasetNFT", "DSNFT")
        Ownable(initialOwner)
    {}

    /// @dev Mints an NFT with a metadata URI and linked dataset CID.
    /// @param to Recipient address.
    /// @param uri Metadata URI (e.g., IPFS link).
    /// @param cid Dataset CID (e.g., IPFS hash).
    function safeMint(
        address to,
        string memory uri,
        string memory cid
    )
        public
        onlyOwner
    {
        require(bytes(uri).length > 0, "URI cannot be empty");
        require(bytes(cid).length > 0, "CID cannot be empty");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        _datasetCIDs[tokenId] = cid;
    }

    /// @dev Returns the dataset CID for a given token ID.
    function getDatasetCID(uint256 tokenId)
        public
        view
        returns (string memory)
    {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return _datasetCIDs[tokenId];
    }

    // Required override for multiple inheritance
    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721URIStorage)  // <-- Remove "Ownable"
    returns (bool)
{
    return super.supportsInterface(interfaceId);
}
}