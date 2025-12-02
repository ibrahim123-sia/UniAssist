import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "./config/db.js";

const app=express()
await connectDB();
app.use(cors())
app.use(express.json())

app.get("/", (req, res) => res.send("Server is Live"));

const PORT = process.env.PORT || 6000;

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});