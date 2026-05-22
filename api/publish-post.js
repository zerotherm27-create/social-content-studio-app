import { publishPostToPlatform } from "./_platforms.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { brand, post, dryRun = false } = req.body || {};
  if (!brand || !post) {
    res.status(400).json({ error: "brand and post are required" });
    return;
  }

  const result = await publishPostToPlatform({ brand, post, env: process.env, dryRun });
  res.status(200).json(result);
}
