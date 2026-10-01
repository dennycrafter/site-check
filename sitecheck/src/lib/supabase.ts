import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "photos";
export const SIGNED_URL_SECONDS = 3600;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

const LIST_PAGE = 1000;

async function listFolder(prefix: string): Promise<{ name: string; isFolder: boolean }[]> {
  const out: { name: string; isFolder: boolean }[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await getSupabase()
      .storage.from(PHOTO_BUCKET)
      .list(prefix, { limit: LIST_PAGE, offset });
    if (error) throw new Error(`List ${prefix} failed: ${error.message}`);
    // Folders come back with a null id.
    out.push(...(data ?? []).map((item) => ({ name: item.name, isFolder: item.id === null })));
    if (!data || data.length < LIST_PAGE) return out;
  }
}

/** Every file under a home's folder. The list call is not recursive, so step folders are listed one by one. */
export async function listHomeFiles(homeId: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await listFolder(homeId)) {
    const path = `${homeId}/${entry.name}`;
    if (!entry.isFolder) paths.push(path);
    else for (const file of await listFolder(path)) if (!file.isFolder) paths.push(`${path}/${file.name}`);
  }
  return paths;
}

export async function removeFiles(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await getSupabase().storage.from(PHOTO_BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`Remove photos failed: ${error.message}`);
  }
}

/**
 * Signed URLs are reused while at least half their lifetime is left. Live review pages refresh
 * every 2 seconds, and a new URL each time would make the browser download every photo again.
 */
const urlCache = new Map<string, { url: string; expires: number }>();
const URL_CACHE_MAX = 5000;

export async function signedUrls(
  paths: string[],
  seconds = SIGNED_URL_SECONDS,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const path of unique) {
    const hit = urlCache.get(`${seconds}:${path}`);
    if (hit && hit.expires - now > (seconds * 1000) / 2) out[path] = hit.url;
    else missing.push(path);
  }
  if (missing.length === 0) return out;
  const { data, error } = await getSupabase()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls(missing, seconds);
  if (error || !data) return out;
  if (urlCache.size > URL_CACHE_MAX) {
    for (const [key, entry] of urlCache) if (entry.expires <= now) urlCache.delete(key);
    if (urlCache.size > URL_CACHE_MAX) urlCache.clear();
  }
  for (const item of data) {
    if (!item.path || !item.signedUrl) continue;
    out[item.path] = item.signedUrl;
    urlCache.set(`${seconds}:${item.path}`, { url: item.signedUrl, expires: now + seconds * 1000 });
  }
  return out;
}
