#!/usr/bin/env node
/**
 * no-timers-guard — permanent enforcement of AGENTS.md "No Game Timers".
 *
 * This game is strictly turn-based: NO setTimeout/setInterval may resolve,
 * advance, expire, or penalize GAME state. Adjudication (rounds, expirations,
 * prompts) moves ONLY on player/GM actions.
 *
 * Every setTimeout/setInterval occurrence in src/ (excluding *.test.*) must
 * match one of the benign UI categories below, evaluated against a small
 * window of code around the call. Anything else FAILS with file:line so a
 * reviewer can classify it: extend BENIGN with a genuine new UI category, or
 * fix the code. Never add GAME-state timers.
 *
 * Run: node .opencode/plans/no-timers-guard.mjs   (npm run guard:no-timers)
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'src'

// Benign categories (see .opencode/plans/no-timers.md §1c). Each entry is
// { why, re } tested against the timer call plus a few lines after it.
const BENIGN = [
    { why: 'drag-ghost / DOM cleanup', re: /removeChild|ghost/i },
    { why: 'toast or feedback auto-hide (display only)', re: /setToast|setCopied|setLastRoll|setPointsFeedback|setShowExpertiseFeedback|setRollResult|setShowSuggestions|toast/i },
    { why: 'close animation after a selection was already made', re: /onClose\(\)/ },
    { why: 'network/save debounce', re: /debounce|flushSave|autosave|AUTOSAVE/i },
    { why: 'event-loop yield (sub-second, no state decision)', re: /setTimeout\(\s*(\(\)\s*=>\s*)?resolve\s*,\s*\d{1,3}\s*\)/ },
    { why: 'post-action page reload (UI navigation)', re: /location\.reload/ },
    { why: 'popup-visibility DOM poll (state is event-driven)', re: /checkPopupVisible|checkAndHandlePending/ },
    { why: 'network fetch timeout (failed request, not a game decision)', re: /loadMapData timeout|fetch timeout/i },
    { why: 'deferred popup render (adjudication already decided; display only)', re: /setPopupHtml/ },
    { why: 'dice tray result popup auto-hide, UI feedback only', re: /setDiceResult/ },
    { why: 'focus/blur UI nicety', re: /focus|blur/i },
]

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(p, out)
        else if (/\.jsx?$/.test(entry.name) && ! /\.test\.jsx?$/.test(entry.name)) out.push(p)
    }
    return out
}

const offenders = []
let total = 0
for (const file of walk(SRC)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
        if (!/\bsetTimeout\s*\(|\bsetInterval\s*\(/.test(line) || line.trim().startsWith('//')) return
        total++
        const window = lines.slice(i, Math.min(i + 4, lines.length)).join('\n')
        if (!BENIGN.some((b) => b.re.test(window))) {
            offenders.push({ loc: `${file}:${i + 1}`, snippet: line.trim().slice(0, 90) })
        }
    })
}

if (offenders.length) {
    console.error(`no-timers-guard: ${offenders.length} unclassified timer(s) — classify as a benign UI category or remove:\n`)
    offenders.forEach((o) => console.error(`  ${o.loc}  ${o.snippet}`))
    console.error('\nGame-state timers (auto-resolve, countdown expiry, auto-advance) are FORBIDDEN — see AGENTS.md "No Game Timers".')
    process.exit(1)
}
console.log(`no-timers-guard: OK — ${total} timer sites, all benign UI categories (turn-based adjudication unaffected).`)
