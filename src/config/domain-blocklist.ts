export const BLOCKED_DOMAINS = new Set<string>([
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'tube8.com',
  'spankbang.com',
  'eporner.com',
  'hentaihaven.xxx',
  'nhentai.net',
  'e-hentai.org',
  'exhentai.org',
  'hanime.tv',
  'rule34.xxx',
  'gelbooru.com',
  'danbooru.donmai.us',
  'furaffinity.net',
  'e621.net',
  'literotica.com',
  'chaturbate.com',
  'stripchat.com',
  'bongacams.com',
  'cam4.com',
  'myfreecams.com',
  'onlyfans.com',
  'fansly.com',
  'manyvids.com',
  'clips4sale.com',
  'iwara.tv',
]);

/**
 * Checks whether a given URL belongs to a blocked domain.
 *
 * Handles full URLs by extracting the hostname, stripping the `www.` prefix,
 * and checking both the exact domain and any parent domain (subdomain match).
 *
 * @example
 * isBlockedDomain('https://pornhub.com/some-page')       // true
 * isBlockedDomain('https://video.pornhub.com/page')      // true  (subdomain)
 * isBlockedDomain('https://github.com/repo')             // false
 */
export function isBlockedDomain(url: string): boolean {
  let hostname: string;

  try {
    hostname = new URL(url).hostname;
  } catch {
    // If the input is not a valid URL, treat it as a bare hostname/domain.
    hostname = url;
  }

  // Normalize: strip leading "www." prefix.
  const normalized = hostname.replace(/^www\./i, '').toLowerCase();

  // Exact match.
  if (BLOCKED_DOMAINS.has(normalized)) {
    return true;
  }

  // Subdomain match: walk up the domain hierarchy.
  // e.g. "video.pornhub.com" → check "pornhub.com"
  const parts = normalized.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (BLOCKED_DOMAINS.has(parent)) {
      return true;
    }
  }

  return false;
}
