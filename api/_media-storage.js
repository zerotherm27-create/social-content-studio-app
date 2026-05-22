import { put } from "@vercel/blob";

function extensionFromType(contentType) {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

function slug(text) {
  return String(text || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "asset";
}

export function bufferFromDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export async function fetchRemoteMedia(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch generated media: ${response.status}`);

  const contentType = response.headers.get("content-type") || "image/png";
  return {
    contentType,
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

export async function uploadMediaAsset({ brand, post, sourceUrl, dataUrl, contentType, env }) {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    return {
      provider: "inline",
      skipped: true,
      reason: "BLOB_READ_WRITE_TOKEN is not configured",
      url: sourceUrl || dataUrl,
    };
  }

  const media = dataUrl ? bufferFromDataUrl(dataUrl) : await fetchRemoteMedia(sourceUrl);
  if (!media) {
    return {
      provider: "inline",
      skipped: true,
      reason: "Media is not a supported data URL",
      url: sourceUrl || dataUrl,
    };
  }

  const finalContentType = contentType || media.contentType || "image/png";
  const ext = extensionFromType(finalContentType);
  const pathname = [
    "brands",
    slug(brand.id || brand.name),
    "posts",
    `${slug(post.id || post.platformId)}-${Date.now()}.${ext}`,
  ].join("/");

  const blob = await put(pathname, media.buffer, {
    access: "public",
    contentType: finalContentType,
    token: env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  });

  return {
    id: blob.pathname,
    provider: "vercel_blob",
    url: blob.url,
    pathname: blob.pathname,
    contentType: finalContentType,
    size: media.buffer.byteLength,
    createdAt: new Date().toISOString(),
  };
}

export async function storeGeneratedArtCard({ brand, post, result, env }) {
  const imageUrl = result.imageUrl;
  if (!imageUrl) return result;

  const isDataUrl = imageUrl.startsWith("data:");
  const asset = await uploadMediaAsset({
    brand,
    post,
    dataUrl: isDataUrl ? imageUrl : undefined,
    sourceUrl: isDataUrl ? undefined : imageUrl,
    env,
  });

  return {
    ...result,
    imageUrl: asset.url || imageUrl,
    asset,
  };
}
