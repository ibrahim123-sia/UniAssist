// testApiKey.js
import { AssemblyAI } from "assemblyai";

async function testApiKey() {
  const apiKey = "9e4509064b38462d8bc964153f148a51";
  console.log("Testing AssemblyAI API key...");
  console.log("Key length:", apiKey.length);
  console.log("Key format:", apiKey.substring(0, 10) + "...");
  
  try {
    const client = new AssemblyAI({
      apiKey: apiKey,
    });
    
    // Try a simple request to verify the key
    console.log("\nMaking test request...");
    const response = await client.transcripts.transcribe({
      audio_url: "https://storage.googleapis.com/aai-web-samples/5_common_phrases.mp3",
    });
    
    console.log("✅ API Key is VALID!");
    console.log("Transcript ID:", response.id);
    
  } catch (error) {
    console.error("\n❌ API Key is INVALID or has issues!");
    console.error("Error:", error.message);
    
    if (error.message.includes("Authentication") || error.message.includes("401")) {
      console.error("\nPossible issues:");
      console.error("1. The API key might be expired");
      console.error("2. The API key might be incorrect");
      console.error("3. Your account might need activation");
      console.error("\nGo to: https://www.assemblyai.com/dashboard/");
      console.error("1. Check your API key in the dashboard");
      console.error("2. Make sure your account is active");
      console.error("3. Check if you have credits/usage available");
    }
  }
}

testApiKey();