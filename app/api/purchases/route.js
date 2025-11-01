import clientPromise from "@/lib/mongodb";
import { uploadText } from "@lighthouse-web3/sdk";
import { ObjectId } from "mongodb";

export async function POST(request) {
  let client;
  try {
    const body = await request.json();
    console.log("POST /api/purchases raw body:", body);

    const { datasetId, purchaserAddress, purchaserTokenId, txHash, decryptionKey } = body;

    client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "researchdb");
    const purchasesCollection = db.collection("purchases");
    const datasetsCollection = db.collection("datasets");

    // Normalize datasetId
    const normalizedDatasetId =
      typeof datasetId === "object" && datasetId.$oid
        ? datasetId.$oid
        : String(datasetId);

    console.log("Normalized datasetId:", normalizedDatasetId);

    // --- Handle duplicate purchase ---
    const existing = await purchasesCollection.findOne({
      datasetId: normalizedDatasetId,
      purchaserAddress: purchaserAddress.toLowerCase(),
    });

    if (existing) {
      console.log("Duplicate purchase found, updating...");

      await purchasesCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            purchaserTokenId: parseInt(purchaserTokenId),
            txHash,
            updatedAt: new Date(),
          },
        }
      );

      return Response.json({ ok: true, updated: true });
    }


    // --- Insert purchase record ---
    const result = await purchasesCollection.insertOne({
      datasetId: normalizedDatasetId,
      purchaserAddress: purchaserAddress.toLowerCase(),
      purchaserTokenId: parseInt(purchaserTokenId),
      txHash,
      // cid: dataset.cid,
      // decryptionKey: dataset.decryptionKey || decryptionKey,
      // fileType: dataset.fileType,
      // title: dataset.title,
      // imageCid: dataset.imageCid,
      // metadataCid: dataset.metadataCid,
      purchasedAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("Purchase saved:", result.insertedId);

    return Response.json({ ok: true, insertedId: result.insertedId });

  } catch (error) {
    console.error("FATAL ERROR in /api/purchases:", error);
    return Response.json(
      { error: "Failed to store purchase", details: error.message },
      { status: 500 }
    );
  }
}


// GET: Return enriched purchases with decryption key + fileType

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const tokenId = searchParams.get("tokenId");

    if (!address) {
      return Response.json({ error: "Address required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("researchdb");
    const purchases = db.collection("purchases");

    const query = { purchaserAddress: address.toLowerCase() };
    if (tokenId) query.purchaserTokenId = parseInt(tokenId);

    const results = await purchases.find(query).toArray();

    // RETURN FULL DATA FOR MY PURCHASES
    const enriched = results.map((p) => ({
      _id: p._id.toString(),
      datasetId: p.datasetId,
      purchaserTokenId: p.purchaserTokenId,
      txHash: p.txHash,
      cid: p.cid,
      decryptionKey: p.decryptionKey,
      fileType: p.fileType,
      title: p.title,
      imageCid: p.imageCid,
      metadataCid: p.metadataCid,
      purchasedAt: p.purchasedAt,
    }));

    return Response.json(enriched);

  } catch (error) {
    console.error("GET /api/purchases error:", error);
    return Response.json(
      { error: "Failed to fetch purchases", details: error.message },
      { status: 500 }
    );
  }
}