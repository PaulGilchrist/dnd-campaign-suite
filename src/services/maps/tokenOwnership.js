/**
 * Device-identity token ownership (learnability Item 5): the ONE ownership
 * law for "may THIS client personalize the token of <playerName>?".
 *
 * Extracted verbatim from Players.jsx (roadmap Item 6 tint) so the token
 * renderer and the token context menu share a single predicate — the same
 * gate the post-WW visitor target-select lane cites by name. Minimal honest
 * model: characters are shared campaign data, so the only "mine" signal a
 * device genuinely has is its OWN sidebar selection (App-level
 * activeCharacter, threaded as localCharacterName — pure per-client local
 * state, zero server writes). A visitor client owns exactly the token of
 * its locally-selected character; the GM (localhost) sees every token
 * neutral AND may edit every token's cosmetics. The server can never
 * verify device identity, so ownership gating lives client-side here —
 * exactly how the existing visitor write lanes (own-character runtime
 * buckets) are honestly gated.
 */
export function isTokenOwnedHere({ isLocalhost, localCharacterName, playerName }) {
    return !isLocalhost && !!localCharacterName && playerName === localCharacterName;
}
