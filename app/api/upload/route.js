import clientPromise from "@/lib/mongodb";

// export async function POST(request) {
//   try {
//     const { title, description, cid, authorAddress } = await request.json();

//     if (!title || !cid || !authorAddress) {
//       return Response.json({ error: 'Title, CID, and authorAddress required' }, { status: 400 });
//     }

//     const dbClient = await clientPromise;
//     const db = dbClient.db('researchdb');
//     const collection = db.collection('datasets');

//     const latest = await collection.findOne({ title }, { sort: { version: -1 } });
//     const version = latest ? latest.version + 1 : 1;
//     const previousCID = latest ? latest.cid : null;

//     const doc = {
//       title,
//       description,
//       cid,
//       version,
//       previousCID,
//       views: 0,
//       authorAddress,  // For payments
//       uploadedAt: new Date(),
//     };
//     await collection.insertOne(doc);

//     return Response.json({ version });
//   } catch (error) {
//     console.error('Metadata error:', error);
//     return Response.json({ error: error.message }, { status: 500 });
//   }
// }

export async function POST(request) {
  try {
    const { title, description, cid, imageCid, metadataCid, authorAddress, decryptionKey, tokenId, txHash } = await request.json();

    if (!title || !cid || !authorAddress) {
      return Response.json({ error: 'Title, CID, and authorAddress required' }, { status: 400 });
    }

    const dbClient = await clientPromise;
    const db = dbClient.db(process.env.MONGODB_DB || 'researchdb');
    const collection = db.collection('datasets');

    const latest = await collection.findOne({ title }, { sort: { version: -1 } });
    const version = latest ? latest.version + 1 : 1;
    const previousCID = latest ? latest.cid : null;

    const numericTokenId = (typeof tokenId === 'string') ? (isNaN(parseInt(tokenId)) ? null : parseInt(tokenId)) : (typeof tokenId === 'number' ? tokenId : null);

    const doc = {
      title,
      description,
      cid,
      imageCid: imageCid || null, // Store the uploaded image CID
      metadataCid: metadataCid || null,
      version,
      previousCID,
      views: 0,
      purchasers: [],
      authorAddress,
      decryptionKey: decryptionKey || '',  // Hashed key for verification
      tokenId: numericTokenId,
      txHash: txHash || null,
      uploadedAt: new Date(),
    };
    await collection.insertOne(doc);

    return Response.json({ version, tokenId: numericTokenId, metadataCid: metadataCid || null });
  } catch (error) {
    console.error('Metadata error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}