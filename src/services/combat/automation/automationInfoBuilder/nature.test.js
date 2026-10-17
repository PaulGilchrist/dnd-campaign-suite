// @maintained-by-ai
// ── nature builder unit (automationInfoBuilder family #2110) ────────────────
// Canonical home for the two Druid nature-lane builder envelopes, verbatim on
// disk: nature_sanctuary + nature_sanctuary_move. Disks:
// public/data/2024/classes.json Druid Circle of the Land lv14 (BOTH rows) and
// public/data/classes.json Druid Land lv14 (activation row only — 5e disk
// carries no move row).
//
// Both handlers are whitelist copiers: every auto.* field rides its own `||`
// arm (NO ?? anywhere — falsy probes feed '' / 0 per the #2104 discriminator;
// cubeSize/moveRange/movesPerDuration 0 collapsing to defaults fails under
// ??). type/action/hasAutomation are hardcoded; playerStats is never read.
// casting_time (both lanes) and movesPerDuration (move lane) ride on disk but
// are NOT emitted — the exact toEqual envelopes pin those drops and every
// unknown junk key (toMatchObject banned, family canon).
//
// Disk values happen to EQUAL the builder defaults verbatim, so verbatim disk
// values cannot discriminate the || arms (blindness audit #2099): the
// passthrough rows feed synthetic values DISTINCT from every default, while
// the disk drill pins the verbatim copy + name passthrough.
// Constitution: duration '1_minute'/'10_minutes' ride as un-evaluated tokens,
// combat-scoped by the executor — no clocks here, ever.
//
// Cited, not re-pinned here (execution is a different lane):
//  • Facade delegation of both types through buildAttackInfo:
//    automationInfoBuilder.test.js registry table (natureHandlers rides in).
//  • Router dispatch: automationRouter.js:207/236.
//  • Executor lane (distinct module): wild_shape spend, already-active/
//    no-uses refusals, 10-round expiry, move cap + delta logging —
//    src/services/automation/handlers/class-ranger/naturesSanctuaryHandler
//    .test.js (serves both the 5e Druid and 2024 Druid rows).
import { describe, it, expect } from 'vitest'
import { natureHandlers } from './nature.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'
import classes5e from '../../../../../public/data/classes.json'
import classes2024 from '../../../../../public/data/2024/classes.json'

describe('natureHandlers', () => {
    it('registers exactly the two disk nature types (ledger pin)', () => {
        expect(Object.keys(natureHandlers).sort()).toEqual([
            'nature_sanctuary',
            'nature_sanctuary_move',
        ])
    })

    // Missing/falsy ('' / 0) arms collapse to the exact DEFAULT envelopes,
    // which are disk-anchored (2024 lv14 rows above). 0 → default pins `||`
    // over `??` per field; casting_time/movesPerDuration (move) drops are
    // pinned by the envelope's key set.
    it.each([
        { type: 'nature_sanctuary',
            auto: { type: 'nature_sanctuary', range: '', cubeSize: 0, duration: '', moveRange: 0, movesPerDuration: 0, resourceCost: '', casting_time: '' },
            exp: { type: 'nature_sanctuary', name: 'Test Feature', range: '120_ft', cubeSize: 15,
                duration: '1_minute', moveRange: 60, movesPerDuration: 1,
                resourceCost: 'wild_shape', hasAutomation: true } },
        { type: 'nature_sanctuary_move',
            auto: { type: 'nature_sanctuary_move', moveRange: 0, movesPerDuration: 0, casting_time: '' },
            exp: { type: 'nature_sanctuary_move', name: 'Test Feature', action: 'bonus_action',
                moveRange: 60, hasAutomation: true } },
    ])('%type: empty + falsy || arms collapse to exact default envelope', ({ type, auto, exp }) => {
        expect(natureHandlers[type](makeFeature(auto), BASE_STATS)).toEqual(exp)
    })

    // Every passthrough field fed a synthetic value DISTINCT from its default;
    // custom names flow through; the sanctuary row's hijacked auto.type and
    // 'notes' junk and the dropped casting_time pin hardcoded-type +
    // whitelist-drop; playerStats: undefined proves it is never read.
    it.each([
        { type: 'nature_sanctuary', name: 'Verdant Aegis',
            auto: { type: 'hijacked_type', range: '90_ft', cubeSize: 20, duration: '10_minutes',
                moveRange: 30, movesPerDuration: 2, resourceCost: 'hit_dice',
                casting_time: '1 bonus action', notes: 'not whitelisted — dropped' },
            exp: { type: 'nature_sanctuary', name: 'Verdant Aegis', range: '90_ft', cubeSize: 20,
                duration: '10_minutes', moveRange: 30, movesPerDuration: 2,
                resourceCost: 'hit_dice', hasAutomation: true } },
        { type: 'nature_sanctuary_move', name: 'Swift Shift',
            auto: { type: 'nature_sanctuary_move', moveRange: 30, movesPerDuration: 5,
                casting_time: '1 action', notes: 'not whitelisted — dropped' },
            exp: { type: 'nature_sanctuary_move', name: 'Swift Shift', action: 'bonus_action',
                moveRange: 30, hasAutomation: true } },
    ])('%type: %name — every passthrough field verbatim, exact envelope', ({ type, name, auto, exp }) => {
        expect(natureHandlers[type](makeFeature(auto, name), undefined)).toEqual(exp)
    })
})

// ── verbatim disk drill (every nature_sanctuary* row on disk) ───────────────

function findNatureRows(node, found = []) {
    if (Array.isArray(node)) {
        node.forEach(entry => findNatureRows(entry, found))
    } else if (node && typeof node === 'object') {
        if (node.automation?.type === 'nature_sanctuary' ||
            node.automation?.type === 'nature_sanctuary_move') found.push(node)
        Object.values(node).forEach(value => findNatureRows(value, found))
    }
    return found
}

const DISK_ROWS = [
    ...findNatureRows(classes5e),
    ...findNatureRows(classes2024),
]

describe('natureHandlers – verbatim disk drill', () => {
    it('every disk row drills through verbatim with a stable row-count ledger', () => {
        // Ledger: 2 activation rows (5e Druid Land lv14 + 2024 Druid Circle of
        // the Land lv14) and 1 move row (2024 only — 5e disk carries none).
        // New disk rows must be pinned here, not silently absorbed.
        expect(DISK_ROWS.filter(r => r.automation.type === 'nature_sanctuary')).toHaveLength(2)
        expect(DISK_ROWS.filter(r => r.automation.type === 'nature_sanctuary_move')).toHaveLength(1)

        for (const row of DISK_ROWS) {
            const env = natureHandlers[row.automation.type](
                makeFeature(row.automation, row.name), BASE_STATS)
            if (row.automation.type === 'nature_sanctuary') {
                // Disk supplies every whitelisted field verbatim
                // (120_ft/15/1_minute/60/1/wild_shape — default-coincidence
                // vs the || arms above, honestly labelled); casting_time
                // '1 action' rides disk but is NOT emitted.
                expect(env, row.name).toEqual({
                    type: 'nature_sanctuary',
                    name: row.name,
                    range: '120_ft',
                    cubeSize: 15,
                    duration: '1_minute',
                    moveRange: 60,
                    movesPerDuration: 1,
                    resourceCost: 'wild_shape',
                    hasAutomation: true,
                })
            } else {
                // 2024 move row: moveRange 60 verbatim; disk's casting_time
                // '1 bonus action' dropped; move envelope never carries
                // movesPerDuration/cube geometry.
                expect(env, row.name).toEqual({
                    type: 'nature_sanctuary_move',
                    name: row.name,
                    action: 'bonus_action',
                    moveRange: 60,
                    hasAutomation: true,
                })
            }
        }
    })
})
