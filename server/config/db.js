import mongoose from "mongoose";

const connectDB = async () => {
    try {
        mongoose.connection.on("connected", () => console.log("Database Connected"));
        await mongoose.connect(process.env.MONGODB_URI);
    } catch (error) {
        // Without a database every request would just hang on Mongoose's
        // command buffering, so refuse to start instead.
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
}

export default connectDB;
