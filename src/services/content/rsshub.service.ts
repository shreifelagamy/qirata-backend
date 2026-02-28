import { isBlockedDomain } from '../../config/domain-blocklist';
import { fetchWithTimeout } from '../../utils/http.util';
import { logger } from '../../utils/logger';

const RSSHUB_BASE_URL =
    process.env.RSSHUB_BASE_URL || 'https://rsshub-production-b858.up.railway.app';

const RSSHUB_RADAR_CACHE_TTL =
    parseInt(process.env.RSSHUB_RADAR_CACHE_TTL || '86400', 10) * 1000; // convert to ms

// Shape of an individual radar rule entry
interface RadarRule {
    title?: string;
    docs?: string;
    source: string[];
    target: string;
}

// Shape of the full radar rules - keyed by domain
// The /api/radar/rules endpoint returns this object directly at the root (no wrapper).
// e.g. { "github.com": { _name: "GitHub", ".": [RadarRule, ...] } }
type RadarRulesData = Record<string, Record<string, RadarRule[] | string>>;

// Simple in-memory cache entry
interface CacheEntry {
    rules: RadarRulesData;
    fetchedAt: number;
}

/**
 * Converts an Express-style source pattern to a regex and extracts named param names.
 *
 * Example:
 *   pattern "/:user/:repo/issues"
 *   → regex /^\/([^/]+)\/([^/]+)\/issues(?:\/.*)?$/
 *   → params ["user", "repo"]
 */
function compileSourcePattern(source: string): { regex: RegExp; params: string[] } {
    const params: string[] = [];

    // Escape regex special chars except for the param placeholders we'll handle
    const escaped = source
        // Escape dots, question marks, etc. but NOT slashes or colons
        .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
        // Replace :paramName with a capture group and record the param name
        .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name) => {
            params.push(name);
            return '([^/]+)';
        });

    // Allow optional trailing content (the URL might have more path segments)
    const regex = new RegExp(`^${escaped}(?:/.*)?$`);

    return { regex, params };
}

/**
 * Resolves a target template string by replacing :paramName tokens with extracted values.
 *
 * Example:
 *   target "/github/release/:user/:repo"
 *   params { user: "nicehash", repo: "NiceHashQuickMiner" }
 *   → "/github/release/nicehash/NiceHashQuickMiner"
 */
function resolveTarget(target: string, params: Record<string, string>): string {
    return target.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name) => {
        return params[name] ?? `:${name}`;
    });
}

/**
 * Attempts to match a URL pathname against a single source pattern.
 * Returns extracted params on success, null on failure.
 */
function matchSource(
    source: string,
    pathname: string
): Record<string, string> | null {
    const { regex, params } = compileSourcePattern(source);
    const match = pathname.match(regex);
    if (!match) return null;

    const extracted: Record<string, string> = {};
    params.forEach((name, i) => {
        extracted[name] = match[i + 1];
    });
    return extracted;
}

/**
 * Builds an ordered list of domain keys to look up in the radar rules.
 * For "www.github.com" → ["www.github.com", "github.com"]
 * For "github.com"     → ["github.com"]
 */
function domainLookupCandidates(hostname: string): string[] {
    const normalized = hostname.replace(/^www\./i, '').toLowerCase();
    const candidates: string[] = [];

    if (hostname.toLowerCase() !== normalized) {
        candidates.push(hostname.toLowerCase());
    }
    candidates.push(normalized);

    // Also walk up: for "sub.example.com" add "example.com"
    const parts = normalized.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
        candidates.push(parts.slice(i).join('.'));
    }

    return candidates;
}

export class RSSHubService {
    private cache: CacheEntry | null = null;

    /**
     * Returns true if the RSSHUB_BASE_URL is configured and non-empty.
     */
    private get isEnabled(): boolean {
        return Boolean(RSSHUB_BASE_URL);
    }

    /**
     * Fetches and caches the radar rules from the RSSHub instance.
     * Returns null if fetching fails or the service is disabled.
     */
    private async getRadarRules(): Promise<RadarRulesData | null> {
        if (!this.isEnabled) return null;

        const now = Date.now();

        if (this.cache && now - this.cache.fetchedAt < RSSHUB_RADAR_CACHE_TTL) {
            return this.cache.rules;
        }

        try {
            const rules = await fetchWithTimeout<RadarRulesData>(
                `${RSSHUB_BASE_URL}/api/radar/rules`,
                { timeout: 15000, retries: 1 }
            );

            if (!rules || typeof rules !== 'object' || Object.keys(rules).length === 0) {
                logger.warn('RSSHubService: radar rules response is empty or invalid');
                return null;
            }

            this.cache = { rules, fetchedAt: now };
            logger.info('RSSHubService: radar rules fetched and cached', {
                domainCount: Object.keys(rules).length,
            });

            return this.cache.rules;
        } catch (err) {
            logger.warn('RSSHubService: failed to fetch radar rules', {
                error: err instanceof Error ? err.message : String(err),
            });
            return null;
        }
    }

    /**
     * Resolves all matching RSSHub feed URLs for a given website URL.
     *
     * @param url - Arbitrary website URL, e.g. "https://github.com/nicehash/NiceHashQuickMiner/releases"
     * @returns Array of fully-qualified RSSHub feed URLs, may be empty.
     */
    async findRoutes(url: string): Promise<string[]> {
        if (!this.isEnabled) return [];

        // Block check on the input URL
        if (isBlockedDomain(url)) {
            logger.debug('RSSHubService: blocked domain, skipping', { url });
            return [];
        }

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            logger.warn('RSSHubService: invalid URL provided', { url });
            return [];
        }

        const hostname = parsedUrl.hostname.toLowerCase();
        const pathname = parsedUrl.pathname || '/';

        const rules = await this.getRadarRules();
        if (!rules) return [];

        const candidates = domainLookupCandidates(hostname);
        const feedUrls: string[] = [];

        for (const candidate of candidates) {
            const domainRules = rules[candidate];
            if (!domainRules) continue;

            // Iterate over all route groups within this domain.
            // Keys are path prefixes (e.g. ".", "/user/:user/repo") or "_name".
            for (const [key, value] of Object.entries(domainRules)) {
                // Skip metadata fields
                if (key === '_name' || typeof value === 'string') continue;

                const ruleList = value as RadarRule[];
                if (!Array.isArray(ruleList)) continue;

                for (const rule of ruleList) {
                    const sources = Array.isArray(rule.source) ? rule.source : [rule.source];

                    for (const source of sources) {
                        const params = matchSource(source, pathname);
                        if (params === null) continue;

                        const resolvedPath = resolveTarget(rule.target, params);
                        const feedUrl = `${RSSHUB_BASE_URL}${resolvedPath}`;

                        // Block check on the generated feed URL
                        if (isBlockedDomain(feedUrl)) continue;

                        if (!feedUrls.includes(feedUrl)) {
                            feedUrls.push(feedUrl);
                        }
                    }
                }
            }

            // If we found matches on this candidate, stop walking up the domain hierarchy
            if (feedUrls.length > 0) break;
        }

        logger.debug('RSSHubService: findRoutes result', { url, feedUrls });
        return feedUrls;
    }

    /**
     * Checks whether the self-hosted RSSHub instance is reachable.
     *
     * @returns true if the instance responded within 3 seconds, false otherwise.
     */
    async isAvailable(): Promise<boolean> {
        if (!this.isEnabled) return false;

        try {
            await fetchWithTimeout(RSSHUB_BASE_URL, { timeout: 3000, retries: 1 });
            return true;
        } catch {
            return false;
        }
    }
}

// Singleton instance
const rssHubService = new RSSHubService();
export default rssHubService;
