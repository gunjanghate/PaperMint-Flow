"use server"
import clientPromise from "@/lib/mongodb";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    console.log('Debug: Fetching purchases for address', address);
    if (!address) {
      return Response.json({ error: 'Address required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'researchdb');
    const collection = db.collection('datasets');

    const purchases = await collection.find({ purchasers: { $in: [address] } }).sort({ uploadedAt: -1 }).toArray();
    console.log('Debug: Fetched purchases for address', purchases);

    return Response.json(purchases);
  } catch (error) {
    console.error('Fetch purchases error:', error);
    return Response.json({ error: 'Failed to fetch purchases' }, { status: 500 });
  }
}