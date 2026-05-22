export async function fetchIntegrationStatus() {
  const response = await fetch("/api/integrations-status");
  if (!response.ok) throw new Error(`Integration status failed with ${response.status}`);
  return response.json();
}

export async function publishPost(brand, post, options = {}) {
  const response = await fetch("/api/publish-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand, post, dryRun: options.dryRun ?? false }),
  });

  if (!response.ok) throw new Error(`Publish failed with ${response.status}`);
  return response.json();
}

export async function publishQueue(brand, posts, options = {}) {
  const response = await fetch("/api/publish-queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand, posts, dryRun: options.dryRun ?? false }),
  });

  if (!response.ok) throw new Error(`Queue publish failed with ${response.status}`);
  return response.json();
}
