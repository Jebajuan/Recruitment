import { pipeline } from "@xenova/transformers";

let embedder = null;

export async function embedText(text) {
  if (!embedder) {
    console.log("⏳ Loading local embedding model (all-MiniLM-L6-v2)...");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("✅ Model loaded");
  }

  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}
