import { publishQueue } from "./_platforms.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { brand, posts = brand?.queue ?? [], dryRun = false } = req.body || {};
  if (!brand) {
    res.status(400).json({ error: "brand is required" });
    return;
  }

  const result = await publishQueue({ brand, posts, env: process.env, dryRun });
  res.status(200).json(result);
}
