import { AssemblyAI } from 'assemblyai';

const assemblyai = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

export default assemblyai;