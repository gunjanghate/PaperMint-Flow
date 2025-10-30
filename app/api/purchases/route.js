import clientPromise from "@/lib/mongodb";

// Store a purchase record with the purchaser's minted tokenId
export async function POST(request) {
  try {
    const { datasetId, purchaserAddress, purchaserTokenId, txHash } = await request.json();

    console.debug('API POST /api/purchases body:', { datasetId, purchaserAddress, purchaserTokenId, txHash });

    if (!datasetId || !purchaserAddress || !purchaserTokenId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'researchdb');
    const purchasesCollection = db.collection('purchases');

    // Normalize datasetId to string for consistent storage
    const normalizedDatasetId = typeof datasetId === 'object' && datasetId.$oid
      ? datasetId.$oid
      : String(datasetId);

    console.debug('API POST /api/purchases normalized datasetId:', normalizedDatasetId);

    // Check if purchase already exists (prevent duplicates)
    const existing = await purchasesCollection.findOne({
      datasetId: normalizedDatasetId,
      purchaserAddress: purchaserAddress.toLowerCase()
    });

    if (existing) {
      console.debug('API POST /api/purchases updating existing record');
      // Update with new token if different
      await purchasesCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            purchaserTokenId: parseInt(purchaserTokenId),
            txHash,
            updatedAt: new Date()
          }
        }
      );
      return Response.json({ ok: true, updated: true });
    }

    console.debug('API POST /api/purchases creating new record');
    // Create new purchase record
    const result = await purchasesCollection.insertOne({
      datasetId: normalizedDatasetId,
      purchaserAddress: purchaserAddress.toLowerCase(),
      purchaserTokenId: parseInt(purchaserTokenId),
      txHash,
      purchasedAt: new Date()
    });

    console.debug('API POST /api/purchases created with insertedId:', result.insertedId);
    return Response.json({ ok: true, insertedId: result.insertedId });
  } catch (error) {
    console.error('Store purchase error:', error);
    return Response.json({ error: 'Failed to store purchase' }, { status: 500 });
  }
}

// Get purchases for a specific address with their tokenIds
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    console.debug('API GET /api/purchases address:', address);

    if (!address) {
      return Response.json({ error: 'Address required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'researchdb');
    const purchasesCollection = db.collection('purchases');
    const datasetsCollection = db.collection('datasets');

    // Find all purchases for this address
    const purchases = await purchasesCollection.find({
      purchaserAddress: address.toLowerCase()
    }).toArray();

    console.debug('API GET /api/purchases found', purchases.length, 'purchase records');

    // Enrich with dataset details
    const enriched = await Promise.all(purchases.map(async (purchase) => {
      console.debug('API GET /api/purchases enriching purchase with datasetId:', purchase.datasetId, 'type:', typeof purchase.datasetId);

      // Handle both string and ObjectId datasetId
      let dataset = null;
      if (typeof purchase.datasetId === 'string') {
        // Try ObjectId match first
        if (purchase.datasetId.length === 24 && /^[0-9a-fA-F]{24}$/.test(purchase.datasetId)) {
          const { ObjectId } = await import('mongodb');
          dataset = await datasetsCollection.findOne({ _id: new ObjectId(purchase.datasetId) });
        }
        // Fallback to string match
        if (!dataset) {
          dataset = await datasetsCollection.findOne({ _id: purchase.datasetId });
        }
      } else {
        // datasetId is already an ObjectId
        dataset = await datasetsCollection.findOne({ _id: purchase.datasetId });
      }

      console.debug('API GET /api/purchases dataset found:', !!dataset, 'title:', dataset?.title);

      if (!dataset) return null;

      return {
        ...dataset,
        _id: dataset._id.toString(), // Serialize for frontend
        purchaserTokenId: purchase.purchaserTokenId, // This is the key field!
        purchaseTxHash: purchase.txHash,
        purchasedAt: purchase.purchasedAt
      };
    }));

    const filtered = enriched.filter(p => p !== null);
    console.debug('API GET /api/purchases returning', filtered.length, 'enriched purchases');
    return Response.json(filtered);
  } catch (error) {
    console.error('Fetch purchases error:', error);
    return Response.json({ error: 'Failed to fetch purchases' }, { status: 500 });
  }
}
