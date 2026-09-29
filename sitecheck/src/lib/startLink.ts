export type StartLink = {
  name: string;
  firstName: string;
  email: string;
  inAustin: boolean;
  hasSolar: boolean;
  /** Any other URL parameters, carried through to the capture URL (for example demo). */
  extra: string;
};

type Params = Record<string, string | string[] | undefined>;

const KNOWN = ["name", "email", "austin", "solar"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function single(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function yesNo(value: string | null): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

/** Base sends the customer a link with what it already knows. Returns null unless all four values are present and valid. */
export function parseStartLink(params: Params): StartLink | null {
  const name = single(params.name);
  const email = single(params.email);
  const inAustin = yesNo(single(params.austin));
  const hasSolar = yesNo(single(params.solar));
  if (!name || name.length > 200 || !email || email.length > 320 || !EMAIL.test(email)) return null;
  if (inAustin === null || hasSolar === null) return null;

  const extra = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (KNOWN.includes(key) || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) extra.append(key, item);
  }
  return { name, firstName: name.split(/\s+/)[0], email, inAustin, hasSolar, extra: extra.toString() };
}
