import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET() {
  try {
    console.debug('API GET /api/datasets called');
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "researchdb");
    const collection = db.collection("datasets");

    const datasets = await collection
      .find({})
      .sort({ uploadedAt: -1 })
      .toArray();

    // Explicitly serialize ObjectId _id to string for consistent client-side handling
    const serialized = datasets.map(d => ({
      ...d,
      _id: d._id.toString()
    }));

    console.debug('API GET /api/datasets returning', serialized.length, 'datasets');
    return Response.json(serialized);
  } catch (error) {
    console.error("Database error:", error);
    return Response.json(
      { error: "Failed to fetch datasets" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
    console.debug('API PATCH /api/datasets body:', body);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, purchaser } = body || {};

  if (!id) {
    console.warn('API PATCH /api/datasets missing id in body');
    return Response.json({ error: "Missing id" }, { status: 400 });
  }
  if (!purchaser) {
    console.warn('API PATCH /api/datasets missing purchaser in body');
    return Response.json({ error: "Missing purchaser address" }, { status: 400 });
  }
  // Accept either ObjectId (24-hex) or string IDs. We'll try ObjectId first when valid,
  // then fall back to matching the raw string _id.

  // Normalize common serialized ObjectId shapes (e.g. { $oid: '...' })
  let normalizedId = id;
  try {
    if (typeof id === 'object' && id !== null) {
      if (id.$oid && typeof id.$oid === 'string') {
        normalizedId = id.$oid;
      } else if (id.$id && id.$id.$oid && typeof id.$id.$oid === 'string') {
        normalizedId = id.$id.$oid;
      } else if (id.toString && typeof id.toString === 'function') {
        const s = id.toString();
        // If the object serializes to the native ObjectId string, use it
        if (/^[0-9a-fA-F]{24}$/.test(s)) normalizedId = s;
      }
    }
  } catch (normErr) {
    console.warn('API PATCH id normalization error:', normErr, 'raw id:', id);
  }
  console.debug('API PATCH raw id:', id, 'normalized id:', normalizedId, 'type:', typeof normalizedId);

  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "researchdb");
    const collection = db.collection("datasets");

    const update = {
      $inc: { views: 1 },
      $addToSet: { purchasers: purchaser }
    };

    let result = null;
    if (typeof normalizedId === 'string' && ObjectId.isValid(normalizedId)) {
      const oid = new ObjectId(normalizedId);
      console.debug('API PATCH attempting ObjectId match for id', normalizedId, 'ObjectId instance:', oid);

      // Debug: check if document exists with this _id
      const exists = await collection.findOne({ _id: oid });
      console.debug('API PATCH findOne check result:', exists ? 'FOUND' : 'NOT FOUND');
      if (exists) {
        console.debug('API PATCH found doc _id:', exists._id, 'title:', exists.title);
      }

      result = await collection.findOneAndUpdate(
        { _id: oid },
        update,
        { returnDocument: "after" }
      );
      console.debug('API PATCH findOneAndUpdate raw result:', JSON.stringify(result));
      console.debug('API PATCH result keys:', result ? Object.keys(result) : 'null');

      // Handle different MongoDB driver return structures
      // Some versions return { value: doc }, others return doc directly, others { ok, value }
      const doc = result?.value || result;
      console.debug('API PATCH extracted doc:', doc ? 'EXISTS' : 'NULL');
      if (doc && doc._id) {
        // Success - wrap in expected structure
        result = { value: doc };
      }
    }

    if (!result || !result.value) {
      console.debug('API PATCH falling back to string _id match for id', normalizedId);
      // Fallback: try matching by raw string _id (in case documents were stored with string IDs)
      result = await collection.findOneAndUpdate(
        { _id: normalizedId },
        update,
        { returnDocument: "after" }
      );
      console.debug('API PATCH string _id match result:', !!(result && result.value));
    }

    if (!result || !result.value) {
      // Debug: fetch all _id values to see actual format in DB
      console.debug('API PATCH no match found; fetching sample docs to inspect _id format');
      const samples = await collection.find({}).limit(3).toArray();
      console.debug('API PATCH sample _id values:', samples.map(s => ({ _id: s._id, type: typeof s._id, str: String(s._id) })));
      console.warn('API PATCH dataset not found for id', normalizedId);
      return Response.json({ error: "Dataset not found" }, { status: 404 });
    }
    console.debug('API PATCH update succeeded for id', id, 'new views:', result.value.views);
    return Response.json({ ok: true, dataset: result.value });
  } catch (error) {
    console.error("PATCH /api/datasets error:", error);
    return Response.json({ error: "Failed to update dataset" }, { status: 500 });
  }
}
