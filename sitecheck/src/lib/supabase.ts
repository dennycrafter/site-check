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

export async function signedUrls(
  paths: string[],
  seconds = SIGNED_URL_SECONDS,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await getSupabase()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls(unique, seconds);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
