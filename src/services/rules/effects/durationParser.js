/**
 * Parse duration strings into round counts for expiration.
 *
 * Supported formats:
 *   "N_round" / "N_rounds"  → N (e.g. "2_rounds" → 2)
 *   "1_minute_rounds"       → 0 (special marker: encounter-scoped, not round-based)
 *   Anything else           → undefined (unparseable, no expiration)
 *
 * A return value of 0 means "encounter-scoped" — callers should call
 * addExpiration with undefined rounds.  undefined means "don't set expiration".
 */
export function parseDurationRounds(duration) {
    if (!duration) return undefined;
    const lower = duration.toLowerCase();
    if (lower.includes('minute') || lower.includes('hour') || lower.includes('day')) {
        return 0; // encounter-scoped marker
    }
    const match = lower.match(/^(\d+)_rounds?$/);
    if (match) return parseInt(match[1], 10);
    return undefined;
}
