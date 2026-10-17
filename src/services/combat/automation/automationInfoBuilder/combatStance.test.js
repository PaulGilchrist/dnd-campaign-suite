// @maintained-by-ai
// ── combatStance builder unit (automationInfoBuilder family) ────────────────
// Canonical home for the combat_stance builder ENVELOPE (flat per-type pins
// were deleted at #2093; the facade automationInfoBuilder.test.js routes this
// type but pins no values — everything value-level lives here).
//
// The builder is a whitelist copier: each auto.* field rides its own `||`
// arm into a fixed 15-key envelope and NOTHING is evaluated — expression
// tokens ('rage_damage'), speed tokens ('speed'), object shapes (reactionSave)
// and nested option rows pass through verbatim for consumers to interpret.
// Unknown disk keys (maxRages, recharge, recharge_short_rest, casting_time,
// resourceCost, range, action) are deliberately dropped — exact toEqual
// envelopes pin both the emitted keys and that drop.
//
// Cited, not re-pinned here (stance runtime is a different lane):
//  • Enter/exit/toggle execution + consumption of the resourceKey/uses this
//    envelope carries: combatStanceHandler sextet
//    (src/services/automation/handlers/combat/combatStanceHandler.*.test.js);
//    assertCanAct gate pair stays closed there.
//  • Row-activation/modal consumer liveness: CombatStanceModal.test.jsx and
//    the CharSpecialActions modal lanes (#2001-era).
//  • Collection categorization: automationService.collection.test.js
//    ('categorizes combat_stance as a special action').
import { describe, it, expect } from 'vitest'
import { combatStanceHandlers } from './combatStance.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// Full default envelope: bare and falsy automations must emit this EXACT
// 15-key object (pins every `||` default arm and the key whitelist at once).
const DEFAULT_ENVELOPE = {
    type: 'combat_stance',
    name: 'Test Feature',
    effect: '',
    damageBonusExpression: '',
    resistanceTypes: [],
    advantages: [],
    options: [],
    duration: '',
    resourceKey: 'ragePoints',
    uses: 0,
    flySpeed: null,
    reactionSave: null,
    blocksSpellcasting: false,
    hasAutomation: true,
}

describe('combatStanceHandlers – combat_stance', () => {
    it('bare automation emits the exact default envelope (undefined → defaults, ragePoints fallback)', () => {
        const result = combatStanceHandlers.combat_stance(
            makeFeature({ type: 'combat_stance' }), BASE_STATS)

        expect(result).toEqual(DEFAULT_ENVELOPE)
    })

    it('falsy automation values never leak past the || defaults', () => {
        // Discriminates || from ??: empty resourceKey/flySpeed/reactionSave
        // and non-array resistanceTypes/advantages/options must collapse to
        // the defaults, not surface as '' | 0 | ''.
        const feature = makeFeature({
            type: 'combat_stance',
            effect: '',
            damageBonusExpression: '',
            resistanceTypes: '',
            advantages: '',
            options: '',
            duration: '',
            resourceKey: '',
            uses: 0,
            flySpeed: 0,
            reactionSave: '',
            blocksSpellcasting: false
        })

        expect(combatStanceHandlers.combat_stance(feature, BASE_STATS))
            .toEqual(DEFAULT_ENVELOPE)
    })

    it('barbarian Rage (verbatim disk) emits unevaluated tokens, drops unknown keys, defaults resourceKey to ragePoints', () => {
        // Verbatim automation from public/data/2024/classes.json → 'Rage'.
        const feature = makeFeature({
            type: 'combat_stance',
            damageBonusExpression: 'rage_damage',
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
            advantages: ['STR checks', 'STR saves'],
            duration: 'until_next_turn_extendable',
            maxRages: 'class_level_scaling',
            recharge_short_rest: '1_use',
            recharge_long_rest: 'all',
            blocksSpellcasting: true,
            casting_time: '1 bonus action'
        }, 'Rage')

        // 'rage_damage' stays a token (never rolled); maxRages/recharge_*/
        // casting_time must be absent from the envelope; disk Rage declares
        // no resourceKey — ragePoints fallback is the Barbarian contract.
        expect(combatStanceHandlers.combat_stance(feature, BASE_STATS)).toEqual({
            ...DEFAULT_ENVELOPE,
            name: 'Rage',
            damageBonusExpression: 'rage_damage',
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
            advantages: ['STR checks', 'STR saves'],
            duration: 'until_next_turn_extendable',
            blocksSpellcasting: true
        })
    })

    it('every populated field passes through verbatim — strings, tokens, objects and deep option rows stay unevaluated', () => {
        // Synthetic composite; field fragments copied verbatim from
        // public/data/2024/classes.json ('Rage of the Wilds' options,
        // 'Rage of the Gods' flySpeed/reactionSave/resourceKey/uses,
        // 'Rage' damage/resistance/advantages).
        const feature = makeFeature({
            type: 'combat_stance',
            effect: 'animal_rage_option',
            damageBonusExpression: 'rage_damage',
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
            advantages: ['STR checks', 'STR saves'],
            options: [
                { name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] },
                { name: 'Eagle', effect: 'disengage_and_dash' },
                { name: 'Wolf', effect: 'ally_advantage_on_nearby_enemies', range: '5 ft' }
            ],
            duration: '1_minute',
            resourceKey: 'rageOfTheGodsUses',
            uses: 1,
            flySpeed: 'speed',
            reactionSave: { range: '30 ft', healTo: 'barbarian_level' },
            blocksSpellcasting: true
        }, 'Rage of the Wilds')

        // flySpeed is a 'speed' token (not a number) and reactionSave an
        // object on disk — the builder must hand both to the stance-handler
        // sextet untouched, options deep-equal, name forwarded.
        expect(combatStanceHandlers.combat_stance(feature, BASE_STATS)).toEqual({
            type: 'combat_stance',
            name: 'Rage of the Wilds',
            effect: 'animal_rage_option',
            damageBonusExpression: 'rage_damage',
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
            advantages: ['STR checks', 'STR saves'],
            options: [
                { name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] },
                { name: 'Eagle', effect: 'disengage_and_dash' },
                { name: 'Wolf', effect: 'ally_advantage_on_nearby_enemies', range: '5 ft' }
            ],
            duration: '1_minute',
            resourceKey: 'rageOfTheGodsUses',
            uses: 1,
            flySpeed: 'speed',
            reactionSave: { range: '30 ft', healTo: 'barbarian_level' },
            blocksSpellcasting: true,
            hasAutomation: true
        })
    })
})
