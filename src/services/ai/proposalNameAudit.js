/**
 * Backlog 2026-11-01 (AV) — world quest_draft accept-scrutiny, CLIENT side.
 *
 * The server validator intentionally stays prose-agnostic for quest_draft
 * (name/description/rewards shape only — see server/services/ai/schemas.js),
 * while rumor/npc_dialogue are fail-closed allow-listed. This helper closes
 * the consistency gap as a NON-BLOCKING advisory: it scrubs the proposal's
 * prose for proper-name candidates and reports which ones match nothing in
 * the campaign's npcs/settlements/factions ledgers, so the referee sees
 * "names not in the ledger — check spelling: …" BEFORE choosing to apply.
 * Nothing here can refuse a write — the apply lane is untouched.
 */

// A capitalised token, hyphenated parts included ("Nowhere-on-Sea").
const RUN_RE = /[A-Z][A-Za-z0-9'’]*(?:[-‑][A-Za-z0-9'’]+)*/g
const NEXT_TOKEN_RE = /^ +[A-Z][A-Za-z0-9'’]*(?:[-‑][A-Za-z0-9'’]+)*/
// Sentence boundaries — a lone capital after one is probably just a verb.
const SENTENCE_END = /[.!?;:]['"]?$/
// Roman numerals / acronyms riding the capitalised pattern (II, DC, GP).
const ALL_CAPS_RE = /^[A-Z0-9]+$/

// Lowercase word split; "McFakeface's" reduces to "mcfakeface" so a possessive
// still matches its ledger name.
function splitWords(text) {
    return String(text).toLowerCase().split(/[^a-z0-9'’]+/).filter(Boolean).map(w => w.replace(/['’]s$/, ''))
}

// A token can carry a proper name: not an acronym/Roman numeral (II, DC),
// not a lone letter (I, A).
function isNameToken(token) {
    return !ALL_CAPS_RE.test(token) && token.length >= 2
}

function isSentenceStart(text, index) {
    const before = text.slice(0, index).trimEnd()
    return before === '' || SENTENCE_END.test(before.slice(-2))
}

// A run is a name candidate unless its lead token is an acronym/lone letter,
// or it is a single word that merely opens a sentence (verbs capitalise
// there too; a multi-word sentence-initial run almost never does).
function isPlausibleName(run, sentenceStart) {
    if (!isNameToken(run[0])) return false
    return !(sentenceStart && run.length === 1 && !run[0].includes('-'))
}

// Collect consecutive capitalised name tokens as one candidate phrase; returns
// the phrase plus the exact end offset so the scan never re-reads absorbed
// tokens. An all-caps/lone-letter neighbour is NOT absorbed (verbs followed
// by Roman numerals must not fuse into a fake phrase).
function collectRun(text, start, firstToken) {
    const run = [firstToken]
    let cursor = start + firstToken.length
    for (;;) {
        const next = NEXT_TOKEN_RE.exec(text.slice(cursor))
        if (!next) break
        const token = next[0].trim()
        if (!isNameToken(token)) break
        run.push(token)
        cursor += next[0].length
    }
    return { run, end: cursor }
}

/**
 * Proper-name candidate phrases found in prose ("Nobody McFakeface",
 * "Nowhere-on-Sea"), each tagged sentenceStart when the run opens its
 * sentence. Heuristic scrub: sentence-initial single words and all-caps
 * tokens are skipped to keep the advisory quiet in honest prose.
 */
export function extractProperNameCandidates(text) {
    const runs = []
    if (typeof text !== 'string' || !text) return runs
    RUN_RE.lastIndex = 0
    let match
    while ((match = RUN_RE.exec(text))) {
        const sentenceStart = isSentenceStart(text, match.index)
        const { run, end } = collectRun(text, match.index, match[0])
        RUN_RE.lastIndex = end
        if (isPlausibleName(run, sentenceStart)) {
            runs.push({ run: run.join(' '), sentenceStart })
        }
    }
    return runs
}

export function extractProperNameRuns(text) {
    return extractProperNameCandidates(text).map(candidate => candidate.run)
}

/** Ledger GET payloads arrive as { npcs: [...] } / { settlements: [...] } / { factions: [...] }. */
export function ledgerNameList(payload, key) {
    const list = Array.isArray(payload) ? payload : payload?.[key]
    return (Array.isArray(list) ? list : []).map(entry => entry?.name).filter(Boolean)
}

// Whole-phrase normalisation for the stem-exact face of isLedgerAnchored
// (splitWords drops to single words; a phrase keeps its spaces collapsed).
function normalizePhrase(text) {
    return String(text).toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Is a candidate phrase grounded in the ledger? Two sanctioned faces:
 *  1. STEM-EXACT: the normalised phrase IS a ledger name, or becomes one by
 *     stripping a trailing possessive ('s / ’s) or a plain plural s. The
 *     de-s stem must be an EXACT ledger name — never fuzzy: with ledger
 *     "Iron Consortium", "Iron Consortiums" resolves but "Iron Consortiumii"
 *     and the typo "Iron Conshortium" do not (YB 2026-11-13: possessives of
 *     ledger names, e.g. "The Iron Consortium's", were surfaced as unknowns).
 *  2. EVERY WORD (partial-name grounding): every word appears in some ledger
 *     name — "Marta" still grounds to "Marta Copperkettle". A sentence-start
 *     run drops its LEAD token first: the scrubber fuses a capitalised verb
 *     into the phrase ("Repay Marta Copperkettle", "Deliver Marta's") and
 *     that verb is never part of a name. Tightened from ANY word: one shared
 *     stop-word ("the"/"iron") used to silently suppress whole typos.
 */
function isLedgerAnchored(candidate, knownWords, knownNames) {
    const phrase = normalizePhrase(candidate.run)
    if (knownNames.has(phrase) || knownNames.has(phrase.replace(/(?:['’]s|s)$/, ''))) return true
    let words = splitWords(candidate.run)
    if (candidate.sentenceStart && words.length > 1) words = words.slice(1)
    return words.length > 0 && words.every(word => knownWords.has(word))
}

/**
 * Unknown proper names referenced by a quest_draft proposal's prose
 * (description + rewards; the quest title itself is a title, not a
 * reference). A candidate is "known" when it is ledger-anchored (see
 * isLedgerAnchored). The ledgers are the full campaign world ledger:
 * NPCs, settlements AND factions.
 * @returns {string[]} unrecognised name phrases, in order, deduped — []
 *   for non-quest kinds, no checkable names, or an empty/unloaded ledger
 *   (nothing to check against: stay silent, never guess).
 */
export function findUnknownLedgerNames(proposal, ledgers) {
    if (!proposal || proposal.kind !== 'quest_draft') return []
    const ledgerNames = [...(ledgers?.npcNames || []), ...(ledgers?.settlementNames || []), ...(ledgers?.factionNames || [])]
        .map(name => String(name || '').trim()).filter(Boolean)
    if (!ledgerNames.length) return []
    const knownWords = new Set()
    const knownNames = new Set()
    for (const name of ledgerNames) {
        splitWords(name).forEach(word => knownWords.add(word))
        knownNames.add(normalizePhrase(name))
    }
    const prose = [proposal.description, proposal.rewards].filter(Boolean).join('\n')
    const unknown = []
    for (const candidate of extractProperNameCandidates(prose)) {
        if (isLedgerAnchored(candidate, knownWords, knownNames)) continue
        if (!unknown.includes(candidate.run)) unknown.push(candidate.run)
    }
    return unknown
}
