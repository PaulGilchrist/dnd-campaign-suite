/**
 * Backlog 2026-11-22 (UI) — plain-English law for a FAILED confirmed apply.
 *
 * Every apply seam (world keeper, referee ruling, director intent) used to
 * compose `apply failed: ${String(e.message || e).slice(0, 160)}` — the raw
 * transport text interrupted the sentence, so a proxy HTML 500 page flooded
 * the small .ai-notice chrome (witnessed: `Not applied: apply failed: <err>`
 * echoed whatever the lane body was). One law, one source: the refusal opens
 * with a plain sentence in the referee's voice, and the raw error rides only
 * as a BOUNDED tail — whitespace-collapsed first so the cap buys readable
 * bytes, visibly truncated when it overflows. The full untruncated error is
 * console.error'd at each catch site for diagnostics. Mirrors the NPC
 * stale-form conflict plain-English law (plain cause — honest outcome —
 * what to do).
 */

// Short enough that the bounded tail never dominates the notice line.
export const RAW_DETAIL_MAX = 140

/**
 * Compose the refused-apply `detail` (the notice renders `Not applied: ` +
 * this, and the audit row carries the same shaped copy).
 * @param {unknown} error whatever the apply lane threw (Error | string | …)
 * @returns {string}
 */
export function applyFailureDetail(error) {
    const raw = String(error?.message || error || 'unknown error').replace(/\s+/g, ' ').trim()
    const bounded = raw.length > RAW_DETAIL_MAX
        ? `${raw.slice(0, RAW_DETAIL_MAX).trimEnd()} … [truncated — full error in the console]`
        : raw
    return `the save request failed — nothing was changed. (details: ${bounded})`
}
