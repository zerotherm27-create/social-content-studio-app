export function schedulePosts(brand, posts) {
  const existingIds = new Set(brand.queue.map((post) => post.id));
  const scheduled = posts
    .filter((post) => !existingIds.has(post.id))
    .map((post) => ({ ...post, status: "scheduled" }));

  return {
    ...brand,
    queue: [...brand.queue, ...scheduled],
    posts: brand.posts.map((post) => (scheduled.some((item) => item.id === post.id) ? { ...post, status: "scheduled" } : post)),
  };
}

export function workspaceTotals(brands) {
  return brands.reduce(
    (totals, brand) => ({
      brands: totals.brands + 1,
      drafts: totals.drafts + brand.posts.length,
      scheduled: totals.scheduled + brand.queue.length,
    }),
    { brands: 0, drafts: 0, scheduled: 0 },
  );
}
