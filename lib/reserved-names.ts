import 'server-only';

// Guard against display names / usernames that impersonate Orbit itself or a
// privileged "staff" identity (System, admins, moderators, support). We
// normalize aggressively before matching so cosmetic dodges collapse onto the
// same canonical form: lowercasing, mapping common leetspeak substitutions, and
// stripping every character that isn't a latin letter. That turns "0rb1t",
// "m0derat0r", "A-D-M-I-N", "Admin_01", and "Ⲟrbⁱt"-style padding into plain
// "orbit" / "moderator" / "admin" before we compare.

// Leetspeak / lookalike → letter. Applied per-character before non-letters are
// stripped, so "5upp0rt" → "support", "@dm1n" → "admin", "$y$tem" → "system".
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
  '£': 'e',
  '€': 'e',
};

// Distinctive terms — blocked if they appear ANYWHERE in the canonical form.
// These are long/specific enough that legitimate names almost never contain
// them ("orbitfan", "iamadmin", "real_support" are all impersonation attempts).
// "admin" also covers "administrator", "admins", "adm1n", etc.
const RESERVED_SUBSTRINGS = [
  'orbit',
  'system',
  'admin',
  'moderator',
  'support',
  'official',
];

// Short/ambiguous terms — blocked only when they are the WHOLE canonical value,
// so "mod" doesn't nuke "modern" and "staff" doesn't nuke a surname, while a
// bare "mod" / "staff" / "team" handle is still rejected.
const RESERVED_EXACT = new Set([
  'mod',
  'mods',
  'staff',
  'team',
  'root',
  'owner',
  'help',
  'helpdesk',
  'sysadmin',
  'orbitteam',
  'orbitstaff',
]);

// Collapse a name to the canonical, letters-only form we match against.
function canonicalize(value: string): string {
  let out = '';
  for (const ch of value.toLowerCase()) {
    const mapped = LEET[ch] ?? ch;
    if (mapped >= 'a' && mapped <= 'z') out += mapped;
  }
  return out;
}

// Whether a display name or username impersonates Orbit or a staff identity.
export function isReservedName(value: string | null | undefined): boolean {
  if (!value) return false;
  const c = canonicalize(value);
  if (!c) return false;
  if (RESERVED_EXACT.has(c)) return true;
  return RESERVED_SUBSTRINGS.some((term) => c.includes(term));
}
