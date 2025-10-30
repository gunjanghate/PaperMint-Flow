import { MongoClient, ServerApiVersion } from 'mongodb';

// Use an Atlas connection string in MONGODB_URI, e.g.:
// mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority&appName=<app-name>
const uri = process.env.MONGODB_URI;

// Options tuned for Atlas' Stable API; safe to use with local too
const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

let client;
let clientPromise;

if (!uri) {
  // Don't throw at import time to avoid breaking builds.
  // Consumers awaiting this will receive a clear error at runtime.
  clientPromise = Promise.reject(
    new Error(
      'Missing MONGODB_URI. Set it to your MongoDB Atlas connection string in .env.local (or environment).\n' +
      'Example: mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority&appName=<app-name>'
    )
  );
} else if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;