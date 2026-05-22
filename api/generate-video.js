import { generateVideoForProvider } from "./_ai-media.js";
import { writeJson } from "./_shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const { brand, post } = req.body;
  writeJson(res, 200, await generateVideoForProvider({ brand, post, env: process.env }));
}
