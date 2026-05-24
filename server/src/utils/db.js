import mongoose from "mongoose";

let cachedConnection = global.__mongooseConnection;

if (!cachedConnection) {
  cachedConnection = global.__mongooseConnection = { conn: null, promise: null };
}

export async function connectDatabase() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is missing. Set it in your environment (server/.env locally or Vercel env vars in production).");
  }

  if (cachedConnection.conn) {
    return cachedConnection.conn;
  }

  if (!cachedConnection.promise) {
    mongoose.set("strictQuery", true);
    cachedConnection.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((mongooseInstance) => {
        console.log("MongoDB connected");
        return mongooseInstance;
      });
  }

  cachedConnection.conn = await cachedConnection.promise;
  return cachedConnection.conn;
}
