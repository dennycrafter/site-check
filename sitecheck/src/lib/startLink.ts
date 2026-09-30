export type StartLink = {
  name: string;
  firstName: string;
  email: string;
  inAustin: boolean;
  hasSolar: boolean;
  /** Optional home address from the link. Null when missing or not usable as an address. */
  address: string | null;
  /** Any other URL parameters, carried through to the capture URL (for example demo). */
  extra: string;
};

type Params = Record<string, string | string[] | undefined>;

const KNOWN = ["name", "email", "austin", "solar", "address"];
/** Same limits as POST /api/homes. */
const ADDRESS_MIN = 5;
const ADDRESS_MAX = 300;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function single(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function yesNo(value: string | null): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

/** Base sends the customer a link with what it already knows. Returns null unless the four required values are present and valid. The address is optional. */
export function parseStartLink(params: Params): StartLink | null {
  const name = single(params.name);
  const email = single(params.email);
  const inAustin = yesNo(single(params.austin));
  const hasSolar = yesNo(single(params.solar));
  if (!name || name.length > 200 || !email || email.length > 320 || !EMAIL.test(email)) return null;
  if (inAustin === null || hasSolar === null) return null;

  const rawAddress = single(params.address);
  const address = rawAddress && rawAddress.length >= ADDRESS_MIN && rawAddress.length <= ADDRESS_MAX ? rawAddress : null;

  const extra = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (KNOWN.includes(key) || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) extra.append(key, item);
  }
  return { name, firstName: name.split(/\s+/)[0], email, inAustin, hasSolar, address, extra: extra.toString() };
}

/** Set in the tab when the customer taps Begin on the /start welcome, so the capture page does not welcome them twice. */
export const welcomedKey = (homeId: string) => `sc-welcomed:${homeId}`;
