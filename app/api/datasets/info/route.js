import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("researchdb");
    const collection = db.collection("datasets");

    let dataset;
    if (id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) {
      dataset = await collection.findOne({ _id: new ObjectId(id) });
    } else {
      dataset = await collection.findOne({ _id: id });
    }

    if (!dataset) {
      return Response.json({ error: "Dataset not found" }, { status: 404 });
    }

    return Response.json({
      title: dataset.title || "Untitled",
      description: dataset.description || "",
      decryptionKey: dataset.decryptionKey || null, // ← MUST RETURN
      imageCid: dataset.imageCid || null,        // ← MUST RETURN
      metadataCid: dataset.metadataCid || null,
    });
  } catch (error) {
    console.error("API /datasets/info error:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}