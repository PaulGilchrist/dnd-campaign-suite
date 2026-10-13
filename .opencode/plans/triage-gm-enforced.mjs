/**
 * Level 5 (L5-003) — §8.0 catalog triage script.
 *
 * "Converting GM-enforced markers serially is a thousand-tasks trap." This
 * script turns the raw marker sprawl into a ranked, decidable work queue:
 *
 *   1. grep every `GM-enforced` marker in src/ (advisory prose with no
 *      engine consumer today — the raw material Phase 2 converts);
 *   2. classify each occurrence by MECHANIC into the plan's six categories
 *      (economy | movement | spatial | zone | duration | narrative);
 *   3. rank each mechanic by TABLE-FREQUENCY — how often it bites at the
 *      table — by joining its signal to docs/monster-actions-manifest.json
 *      (distinct monsters × matching action entries);
 *   4. emit docs/gm-enforced-triage.csv, marking the top ENFORCE_CUT
 *      deterministic mechanics `enforce` and parking the rest (§8.0
 *      commitment: engine-enforce ~top 50, explicitly park the remainder).
 *
 * Purely static + deterministic — no runtime, no network, no state writes.
 * Run: node .opencode/plans/triage-gm-enforced.mjs
 */
import fs from 'fs'
import path from 'path'

const SRC = 'src'
const MANIFEST = 'docs/monster-actions-manifest.json'
const OUT_CSV = 'docs/gm-enforced-triage.csv'
const ENFORCE_CUT = 50

// Mechanic taxonomy: deterministic engine categories, each with a marker
// matcher (what the advisory prose says) and a manifest signal (the rules
// text in the monster manifest that proves how often it bites at the table).
// Ordered most-deterministic-first so the enforce cut favours engine-clean
// conversions over fuzzy narrative ones.
const MECHANICS = [
    { key: 'spatial/gridless-teleport', category: 'spatial', enforceable: true,
        marker: /gridless|token[- ]position|no token[- ]movement|token movement consumer/i,
        manifest: (e) => /\bteleport|misty step|thunder step|blink\b/i.test(`${e.actionName} ${e.description}`) },
    { key: 'spatial/line-of-sight', category: 'spatial', enforceable: true,
        marker: /no vision|line of sight|\blos\b|unseen|invisible|can(’|')? ?not (see|target)/i,
        manifest: (e) => /you can see|visible|invisible|unseen|line of sight/i.test(e.description) },
    { key: 'spatial/cover', category: 'spatial', enforceable: true,
        marker: /\bcover\b|three[- ]quarters|half cover/i,
        manifest: (e) => /\bcover\b/i.test(e.description) },
    { key: 'movement/distance-consumer', category: 'movement', enforceable: true,
        marker: /movement[- ]distance|no[- ].*movement.*consumer|moved this turn|movement budget/i,
        manifest: (e) => /\bmove\b|burrow|climb|swim|flying speed|speed/i.test(e.description) },
    { key: 'movement/midpath-trigger', category: 'movement', enforceable: true,
        marker: /mid[- ]path|opportunity attack|opportunity|when .*moves|leaves.*reach/i,
        manifest: (e) => e.category === 'reactions' || /when (a|another) .*moves?|leaves/i.test(e.description) },
    { key: 'zone/aura-persistent', category: 'zone', enforceable: true,
        marker: /\baura\b|no.*area.*consumer|emanation/i,
        manifest: (e) => /\baura\b|emanation/i.test(e.description) },
    { key: 'zone/aoe-persistent', category: 'zone', enforceable: true,
        marker: /cylinder|sphere|\bcone\b|\bsquare\b|\bcube\b|no.*cylinder[- ]zone/i,
        manifest: (e) => e.actionType === 'aoe-save' || /cylinder|sphere|cone|cube|\bsquare\b/i.test(e.description) },
    { key: 'zone/lair-regional', category: 'zone', enforceable: true,
        marker: /lair|regional|initiative[- ]20|initiative 20/i,
        manifest: (e) => e.category === 'lair_actions' || /\blair\b|regional/i.test(e.description) },
    { key: 'economy/recharge', category: 'economy', enforceable: true,
        marker: /recharge/i,
        manifest: (e) => /recharge/i.test(`${e.actionName} ${e.description}`) },
    { key: 'economy/legendary-cap', category: 'economy', enforceable: true,
        marker: /legendary/i,
        manifest: (e) => e.category === 'legendary_actions' || /legendary/i.test(e.description) },
    { key: 'economy/reaction-cap', category: 'economy', enforceable: true,
        marker: /reaction|opportunity attack consumer|once per round/i,
        manifest: (e) => e.category === 'reactions' || /\breaction\b/i.test(e.description) },
    { key: 'economy/bonus-cap', category: 'economy', enforceable: true,
        marker: /bonus action/i,
        manifest: (e) => /bonus action/i.test(`${e.actionName} ${e.description}`) },
    { key: 'duration/concentration', category: 'duration', enforceable: true,
        marker: /concentration/i,
        manifest: (e) => /concentration/i.test(e.description) },
    { key: 'duration/expiry-clock', category: 'duration', enforceable: true,
        marker: /expir|duration clock|no.*duration.*consumer|until (the end of|next)/i,
        manifest: (e) => /duration|until|rounds?\b/i.test(e.description) },
    // Non-deterministic buckets (parked by default — narrative table feel).
    { key: 'narrative/attitude', category: 'narrative', enforceable: false,
        marker: /attitude|friendly|hostile|indifferent|friendly\b/i,
        manifest: (e) => /attitude|friendly|hostile|indifferent/i.test(e.description) },
    { key: 'narrative/advisory-generic', category: 'narrative', enforceable: false,
        marker: /GM[- ]enforced/i, // catch-all — anything GM-enforced with no stronger signal
        manifest: () => false },
]

// --- 1. grep markers ---
function walk(dir, acc = []) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name)
        const stat = fs.statSync(full)
        if (stat.isDirectory()) walk(full, acc)
        else if (/\.(js|jsx)$/.test(name)) acc.push(full)
    }
    return acc
}

function grepMarkers() {
    const hits = []
    for (const file of walk(SRC)) {
        const lines = fs.readFileSync(file, 'utf8').split('\n')
        lines.forEach((line, i) => {
            if (line.includes('GM-enforced')) hits.push({ file, line: i + 1, text: line.trim() })
        })
    }
    return hits
}

// --- 2. classify each marker occurrence by mechanic ---
function classify(hits) {
    const byMechanic = new Map()
    for (const h of hits) {
        // first matching mechanic wins; narrative/advisory-generic is last.
        const mech = MECHANICS.find((m) => m.marker.test(h.text)) || MECHANICS[MECHANICS.length - 1]
        if (!byMechanic.has(mech.key)) byMechanic.set(mech.key, { mech, occurrences: [], files: new Set() })
        const b = byMechanic.get(mech.key)
        b.occurrences.push(h)
        b.files.add(h.file)
    }
    return byMechanic
}

// --- 3. join to manifest for table frequency ---
function manifestFrequency(mech, manifest) {
    let actionRefs = 0
    const monsters = new Set()
    for (const e of manifest) {
        if (mech.manifest(e)) { actionRefs++; monsters.add(e.monsterIndex) }
    }
    return { actionRefs, monsterAppearances: monsters.size }
}

// --- 4. emit ranked CSV ---
function main() {
    if (!fs.existsSync(MANIFEST)) { console.error(`missing manifest: ${MANIFEST}`); process.exit(1) }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).monsterActionEntries
    const hits = grepMarkers()
    const byMechanic = classify(hits)

    const rows = []
    for (const { mech, occurrences, files } of byMechanic.values()) {
        const { actionRefs, monsterAppearances } = manifestFrequency(mech, manifest)
        // Table frequency: prefer manifest evidence; fall back to marker files
        // when the mechanic has no reliable rules-text signal.
        const frequency = actionRefs > 0 ? actionRefs : files.size
        rows.push({
            mechanic: mech.key,
            category: mech.category,
            enforceable: mech.enforceable,
            markerOccurrences: occurrences.length,
            markerFiles: files.size,
            sampleFile: occurrences[0]?.file || '',
            monsterAppearances,
            actionRefs,
            tableFrequency: frequency,
        })
    }

    // Rank: enforceable first (deterministic over narrative), then frequency,
    // then marker count, then key for full determinism.
    rows.sort((a, b) =>
        (b.enforceable - a.enforceable)
        || (b.tableFrequency - a.tableFrequency)
        || (b.markerOccurrences - a.markerOccurrences)
        || a.mechanic.localeCompare(b.mechanic))

    // L5 §8.5 exit criteria: mechanics whose marker category was CONVERTED
    // by a delivered slice — engine consumer + tests + live verification (see
    // plan §8 notes / Appendix B). Keyed by mechanic so flips survive re-scan.
    const VERIFIED_MECHANICS = new Set([
        // §8 verified rows (see plan Appendix B for the live proofs).
        // H1/H2 hardening pass (§17, 2026-10-13): legendary-cap, recharge and
        // concentration were already engine-clean — audit evidence: MA engine
        // suites (232 tests) + live chokepoint refusals of forged monster
        // economy shapes at POST /:campaign/:storeName (used>max, threshold∉1..6).
        'economy/legendary-cap',
        'economy/recharge',
        'duration/concentration',
        'duration/expiry-clock',       // §8.3#1 zoneDurationClock producers + consumer
        'zone/aoe-persistent',         // §8.3 armed zone tes + duration clocks
        'zone/lair-regional',          // §8.3 initiative-20 drainRoundWrapClocks
        'zone/aura-persistent',        // §8.3 self-aura clocks (parseable authored durations)
        'movement/distance-consumer',  // Phase 1 movementBudget clamp (both drag paths)
        'economy/reaction-cap',        // Phase 1 reactions + §8.4 OA charge/deny
        'movement/midpath-trigger',    // §8.4 opportunityTrigger leaving-reach legs
        'spatial/line-of-sight',       // §8.2 lineOfSightGate (attack + cast seams)
        'spatial/gridless-teleport',   // §8.1 teleportService token moves
        'economy/bonus-cap',           // Phase 1 bonusAction bucket charge/cap (classifyBucket + turnState)
    ])

    rows.forEach((r, i) => {
        r.rank = i + 1
        const wasVerified = VERIFIED_MECHANICS.has(r.mechanic)
        r.decision = wasVerified ? 'verified' : (r.enforceable && i < ENFORCE_CUT) ? 'enforce' : 'park'
        r.rationale = wasVerified
            ? 'VERIFIED — engine consumer + tests + live-checked (§8/Appendix B)'
            : (r.enforceable
                ? (r.decision === 'enforce'
                    ? `engine-clean (table bites ${r.tableFrequency}×: ${r.monsterAppearances} monsters, ${r.markerOccurrences} markers)`
                    : `deterministic but below top-${ENFORCE_CUT} cut`)
                : 'narrative / table-feel — park (GM judgment, no numeric answer)')
    })

    const header = ['rank', 'mechanic', 'category', 'decision', 'tableFrequency', 'monsterAppearances', 'actionRefs', 'markerOccurrences', 'markerFiles', 'enforceable', 'sampleFile', 'rationale']
    const csv = [header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\n') + '\n'
    fs.writeFileSync(OUT_CSV, csv)

    const enforce = rows.filter((r) => r.decision === 'enforce')
    const verified = rows.filter((r) => r.decision === 'verified')
    const parked = rows.filter((r) => r.decision === 'park')
    console.log(`triage: ${rows.length} mechanics | ${verified.length} verified | ${enforce.length} enforce | ${parked.length} park`)
    console.log(`markers: ${hits.length} GM-enforced lines\n`)
    console.log('rank  category     freq  monsters  markers  decision  mechanic')
    rows.slice(0, 24).forEach((r) => {
        console.log(
            String(r.rank).padStart(4), '',
            r.category.padEnd(12),
            String(r.tableFrequency).padStart(4), '',
            String(r.monsterAppearances).padStart(7), '',
            String(r.markerOccurrences).padStart(7), '',
            r.decision.padEnd(8), '',
            r.mechanic,
        )
    })
    console.log(`\nwrote ${OUT_CSV}`)
}

function csvCell(v) {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

main()
