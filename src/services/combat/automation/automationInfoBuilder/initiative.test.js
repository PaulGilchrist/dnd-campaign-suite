// @maintained-by-ai
// ── initiative_action builder envelope (automationInfoBuilder family) ──────
// Canonical home for the initiative_action BUILDER envelope. The builder is a
// fixed 11-key copier: whitelisted auto.* fields ride `||` arms (except
// `uses`, which uses `??` so 0 survives), type/hasAutomation are hardcoded,
// resourceKey is DERIVED from feature.name (a disk resourceKey is ignored),
// and playerStats is unused entirely. Exact toEqual pins the emitted keys,
// the defaults, and the drops (minTarget/casting_time/bonusExpression/range)
// together — no toMatchObject.
//
// Cited, not re-pinned here (execution/ordering is a different lane):
//  • Manual initiative_action execution + effect dispatch
//    (bonus_initiative_allies, regain_focus_points_and_heal, …):
//    src/services/automation/handlers/combat/initiativeHandler.test.js.
//  • On-roll specialActions readers / initiative-roll routing (CLA-013):
//    useInitiativeEffects.*.test.js — these consume only type + effect of
//    this envelope, so the derived-vs-disk resourceKey divergence below is
//    tolerated insurance, flagged honestly in the Evergreen pin.
//  • Bucketing into specialActions: automationService.js type list.
//  • initiativeBonus collector pin: automationCollector.combatSuperiority
//    (#2099, verbatim-from-Ambush-disk) — builder side only here.
//  • Expression token semantics: automationExpressions.test.js (#2090) —
//    healExpression rides here as an UNevaluated verbatim string.
// Constitution: no wall-clock timers here; envelope carries tokens, never
// rolled values.
import { describe, it, expect } from 'vitest'
import { initiativeHandlers } from './initiative.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'
import classes5e from '../../../../../public/data/classes.json'
import classes2024 from '../../../../../public/data/2024/classes.json'

// ── synthetic fixtures (distinct from defaults, per #2099 blindness lesson) ─

describe('initiativeHandlers.initiative_action – envelope contract', () => {
    it('bare automation emits the exact default envelope; hardcoded/unknown fields cannot be overridden', () => {
        expect(initiativeHandlers.initiative_action(
            makeFeature({ type: 'initiative_action' }), BASE_STATS
        )).toEqual({
            type: 'initiative_action',
            name: 'Test Feature',
            effect: '',
            healExpression: '',
            trigger: 'roll_initiative',
            uses: 1,
            usesMax: 1,
            recharge: 'long_rest',
            resourceCost: '',
            resourceKey: 'testfeatureUses',
            hasAutomation: true,
        })

        // Decoy feature: type/hasAutomation stay hardcoded, usesMax is never
        // read from auto (derived from uses only), unknown keys dropped,
        // auto.resourceKey ignored, and playerStats is unused entirely.
        expect(initiativeHandlers.initiative_action(
            makeFeature({
                type: 'hijacked_type',
                hasAutomation: false,
                usesMax: 99,
                resourceKey: 'wrongKey',
                minTarget: 2,
                casting_time: 'passive',
            }, 'Test Feature'), undefined
        )).toEqual({
            type: 'initiative_action',
            name: 'Test Feature',
            effect: '',
            healExpression: '',
            trigger: 'roll_initiative',
            uses: 1,
            usesMax: 1,
            recharge: 'long_rest',
            resourceCost: '',
            resourceKey: 'testfeatureUses',
            hasAutomation: true,
        })
    })

    it('explicit distinct values pass through verbatim; uses:0 survives ?? and syncs usesMax', () => {
        // Every value distinct from its default; healExpression is a dice
        // STRING pinned as a token, never evaluated (#2090). uses:0 pins the
        // ?? discriminator — an exhaustible resource can reach zero and the
        // default-1 arm must not resurrect it (#2104 falsy table).
        const feature = makeFeature({
            type: 'initiative_action',
            effect: 'bonus_initiative_allies',
            healExpression: '2d8 + 1',
            trigger: 'turn_start',
            uses: 0,
            recharge: 'short_rest',
            resourceCost: 'luck_points',
        }, "Watcher's Dawn")
        expect(initiativeHandlers.initiative_action(feature, BASE_STATS)).toEqual({
            type: 'initiative_action',
            name: "Watcher's Dawn",
            effect: 'bonus_initiative_allies',
            healExpression: '2d8 + 1',
            trigger: 'turn_start',
            uses: 0,
            usesMax: 0,
            recharge: 'short_rest',
            resourceCost: 'luck_points',
            // derivation strips whitespace and lowercases only — punctuation
            // is preserved, so consumers must match exactly.
            resourceKey: "watcher'sdawnUses",
            hasAutomation: true,
        })
    })
})

// ── verbatim disk drill (every initiative_action row on disk) ───────────────

function findInitiativeFeatures(node, found = []) {
    if (Array.isArray(node)) {
        node.forEach(entry => findInitiativeFeatures(entry, found))
    } else if (node && typeof node === 'object') {
        if (node.automation?.type === 'initiative_action') found.push(node)
        Object.values(node).forEach(value => findInitiativeFeatures(value, found))
    }
    return found
}

const DISK_ROWS = [
    ...findInitiativeFeatures(classes5e),
    ...findInitiativeFeatures(classes2024),
]

// Expected envelopes anchored VERBATIM to public/data/[2024/]classes.json
// rows (5e Bard lv19 + 2024 Bard lv18 Superior Inspiration, 2024 Bard College
// Tandem Footwork, 2024 Druid lv20 Evergreen Wild Shape, 2024 Monk lv1
// Uncanny Metabolism). Unknown disk keys (minTarget, casting_time,
// bonusExpression, range) are DROPPED; absent keys take builder defaults —
// honestly marked per row.
const EXPECTED_DISK_ENVELOPES = {
    'Superior Inspiration': {
        type: 'initiative_action',
        name: 'Superior Inspiration',
        effect: 'regain_bardic_inspiration_on_initiative', // verbatim token (disk)
        healExpression: '',
        trigger: 'roll_initiative',                          // disk says the same — default-coincidence
        uses: 1,                                             // disk carries no uses — builder default
        usesMax: 1,
        recharge: 'long_rest',                             // disk silent — builder default
        resourceCost: 'bardic_inspiration',                // verbatim (disk)
        resourceKey: 'superiorinspirationUses',
        hasAutomation: true,
    },
    'Tandem Footwork': {
        type: 'initiative_action',
        name: 'Tandem Footwork',
        effect: 'bonus_initiative_allies',                 // verbatim (disk)
        healExpression: '',
        trigger: 'roll_initiative',                        // disk has NO trigger — builder-invented default
        uses: 1,                                           // disk silent — builder default
        usesMax: 1,
        recharge: 'long_rest',                           // disk silent — builder default
        resourceCost: 'bardic_inspiration',              // verbatim (disk)
        resourceKey: 'tandemfootworkUses',
        hasAutomation: true,
        // disk's bonusExpression:'bardic_inspiration_die' and range:'30 ft'
        // are deliberately DROPPED — execution re-derives them
        // (initiativeHandler lane, cited).
    },
    'Evergreen Wild Shape': {
        type: 'initiative_action',
        name: 'Evergreen Wild Shape',
        effect: 'wild_shape_regen_on_initiative',         // verbatim (disk)
        healExpression: '',
        trigger: 'roll_initiative',                       // disk silent — builder default
        uses: 1,                                          // disk silent — builder default
        usesMax: 1,
        recharge: 'long_rest',                          // disk silent — builder default
        resourceCost: '',                               // disk silent
        // ⚠ disk says resourceKey:'wildShapeUses' — the builder IGNORES it
        // and derives from the name. Consumers route by effect key
        // (useInitiativeEffects/initiativeHandler lanes), so this divergence
        // is tolerated insurance, pinned honestly.
        resourceKey: 'evergreenwildshapeUses',
        hasAutomation: true,
    },
    'Uncanny Metabolism': {
        type: 'initiative_action',
        name: 'Uncanny Metabolism',
        effect: 'regain_focus_points_and_heal',           // verbatim (disk)
        // verbatim token ladder, NOT evaluated here (#2090 canonical):
        healExpression: 'monk_level + martial_arts_die',
        trigger: 'roll_initiative',                       // disk says the same — default-coincidence
        uses: 1,                                          // disk says 1 too — default-coincidence
        usesMax: 1,
        recharge: 'long_rest',                          // disk says the same — default-coincidence
        resourceCost: '',                               // disk silent despite focus-point name
        resourceKey: 'uncannymetabolismUses',
        hasAutomation: true,
    },
}

describe('initiativeHandlers.initiative_action – verbatim disk drill', () => {
    it('disk still carries exactly these five initiative_action rows (anti-drift guard)', () => {
        expect(DISK_ROWS.map(f => f.name).sort()).toEqual([
            'Evergreen Wild Shape',
            'Superior Inspiration',
            'Superior Inspiration',
            'Tandem Footwork',
            'Uncanny Metabolism',
        ])
    })

    it.each(DISK_ROWS.map(f => [f.name, f]))(
        'disk row %s builds its exact envelope',
        (_name, feature) => {
            expect(initiativeHandlers.initiative_action(feature, BASE_STATS))
                .toEqual(EXPECTED_DISK_ENVELOPES[feature.name])
        }
    )
})
