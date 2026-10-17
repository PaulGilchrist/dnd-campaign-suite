// @maintained-by-ai
// Lane: collectTurnStartEffects builder-row exhaustiveness + exact envelopes + gates
// (TURN_START_EFFECT_BUILDERS in ./turnStartEffects.js — both dispatch lanes:
// passive_rule→effect key and raw type→type key). Pure dispatch function: no mocks,
// no spies, no clocks — the turn seam is supplied by the caller, nothing here fires on
// wall-clock time. Fixtures are synthetic shapes pinning the dispatch map, not disk data
// from public/data — except the feature name 'Inner Radiance', which is load-bearing
// (it is the damage_aura name gate).
// Owned elsewhere — do NOT re-add here (automationCollector.coverage.test.js, #2084):
// temp_hp_buff+healingStartOfTurn (vitalityOfTheTree), passive_rule confusion_turn_start,
// bloodiedOnly:true → survivor_turn_start_heal, and temp_hp_buff-call-absence.
// Confusion d10-table semantics canonical: src/services/automation/handlers/spells/confusionTurnStartHandler.test.js.
import { describe, it, expect } from 'vitest'
import { collectTurnStartEffects } from './automationCollector.js'

const NAME = 'Test Feature'
const collect = automation => collectTurnStartEffects([{ name: NAME, automation }])

// ── Simple rows: exact { type, name } envelope (buildSimple + steady_aim_clear) ──

describe('simple rows — exact { type, name } envelope', () => {
    it.each([
        // passive_rule lane: dispatch keys on effect, ignores the passive_rule wrapper type
        ['supreme_sneak', { type: 'passive_rule', effect: 'supreme_sneak' }, 'supreme_sneak'],
        ['umbral_sight', { type: 'passive_rule', effect: 'umbral_sight' }, 'umbral_sight'],
        ['naturally_stealthy', { type: 'passive_rule', effect: 'naturally_stealthy' }, 'naturally_stealthy'],
        ['mage_hand_legerdemain', { type: 'passive_rule', effect: 'mage_hand_legerdemain' }, 'mage_hand_legerdemain'],
        ['divination_savant', { type: 'passive_rule', effect: 'divination_savant' }, 'divination_savant'],
        ['evocation_savant', { type: 'passive_rule', effect: 'evocation_savant' }, 'evocation_savant'],
        ['illusion_savant', { type: 'passive_rule', effect: 'illusion_savant' }, 'illusion_savant'],
        ['improved_illusions', { type: 'passive_rule', effect: 'improved_illusions' }, 'improved_illusions'],
        ['tavern_brawler_push', { type: 'passive_rule', effect: 'tavern_brawler_push' }, 'tavern_brawler_push'],
        ['grapple_damage', { type: 'passive_rule', effect: 'grapple_damage' }, 'grapple_damage'],
        ['no_melee_disadvantage_crossbows', { type: 'passive_rule', effect: 'no_melee_disadvantage_crossbows' }, 'no_melee_disadvantage_crossbows'],
        ['heroic_inspiration_turn_start remaps to heroic_inspiration', { type: 'passive_rule', effect: 'heroic_inspiration_turn_start' }, 'heroic_inspiration'],
        ['roving_aim normalizes to steady_aim_clear', { type: 'passive_rule', effect: 'roving_aim' }, 'steady_aim_clear'],
        // raw type lane: dispatch keys on automation.type
        ['steady_aim type also normalizes to steady_aim_clear', { type: 'steady_aim' }, 'steady_aim_clear'],
        ['living_legend remaps to living_legend_turn_start', { type: 'living_legend' }, 'living_legend_turn_start'],
        ['radiant_soul remaps to radiant_soul_turn_start', { type: 'radiant_soul' }, 'radiant_soul_turn_start'],
        ['precise_hunter', { type: 'precise_hunter' }, 'precise_hunter'],
        ['hunter_lore', { type: 'hunter_lore' }, 'hunter_lore'],
    ])('%s', (_label, automation, type) => {
        expect(collect(automation)).toEqual([{ type, name: NAME }])
    })
})

// ── Rows with expression/default fields: both arms of every `auto.X || default` ──
// One default row + one custom row per effect, full exact envelope each.

describe('rows with defaulted fields — default and pass-through arms', () => {
    it.each([
        ['flurry_healing_harm defaults usesExpression',
            { type: 'passive_rule', effect: 'flurry_healing_harm' },
            { type: 'flurry_healing_harm', name: NAME, usesExpression: 'WIS modifier minimum 1' }],
        ['flurry_healing_harm passes through custom usesExpression',
            { type: 'passive_rule', effect: 'flurry_healing_harm', usesExpression: 'CHA modifier' },
            { type: 'flurry_healing_harm', name: NAME, usesExpression: 'CHA modifier' }],
        ['dread_ambush_speed defaults bonusExpression to 10',
            { type: 'passive_rule', effect: 'dread_ambush_speed' },
            { type: 'dread_ambush_speed', name: NAME, bonusExpression: '10' }],
        ['dread_ambush_speed passes through custom bonusExpression',
            { type: 'passive_rule', effect: 'dread_ambush_speed', bonusExpression: '15' },
            { type: 'dread_ambush_speed', name: NAME, bonusExpression: '15' }],
        ['create_thrall_temp_hp defaults tempHpExpression',
            { type: 'passive_rule', effect: 'create_thrall_temp_hp' },
            { type: 'create_thrall_temp_hp', name: NAME, tempHpExpression: 'warlock level + CHA modifier' }],
        ['create_thrall_temp_hp passes through custom tempHpExpression',
            { type: 'passive_rule', effect: 'create_thrall_temp_hp', tempHpExpression: 'warlock level' },
            { type: 'create_thrall_temp_hp', name: NAME, tempHpExpression: 'warlock level' }],
        ['use_magic_device defaults attunementLimit to 4',
            { type: 'use_magic_device' },
            { type: 'use_magic_device', name: NAME, attunementLimit: 4 }],
        ['use_magic_device passes through custom attunementLimit',
            { type: 'use_magic_device', attunementLimit: 6 },
            { type: 'use_magic_device', name: NAME, attunementLimit: 6 }],
        ['ignore_loading_crossbows defaults weapons to empty array',
            { type: 'passive_rule', effect: 'ignore_loading_crossbows' },
            { type: 'ignore_loading_crossbows', name: NAME, weapons: [] }],
        ['ignore_loading_crossbows passes through explicit weapons',
            { type: 'passive_rule', effect: 'ignore_loading_crossbows', weapons: ['hand_crossbow', 'heavy_crossbow'] },
            { type: 'ignore_loading_crossbows', name: NAME, weapons: ['hand_crossbow', 'heavy_crossbow'] }],
        // bloodiedOnly:true → survivor_turn_start_heal is owned by the coverage file;
        // both rows here pin the regenerate arm of the ternary.
        ['healing_start_of_turn defaults (regenerate arm)',
            { type: 'healing_start_of_turn' },
            { type: 'regenerate_turn_start_heal', name: NAME, healExpression: '1', bloodiedOnly: false, bodyPartRegrowMinutes: 2 }],
        ['healing_start_of_turn passes through custom heal and regrow (regenerate arm)',
            { type: 'healing_start_of_turn', healExpression: '10', bodyPartRegrowMinutes: 5 },
            { type: 'regenerate_turn_start_heal', name: NAME, healExpression: '10', bloodiedOnly: false, bodyPartRegrowMinutes: 5 }],
        ['arcane_ward full defaults',
            { type: 'passive_rule', effect: 'arcane_ward' },
            { type: 'arcane_ward', name: NAME, wardHpExpression: '', wardRestoreExpression: '', bonusActionRestore: false }],
        ['arcane_ward custom values pass through',
            { type: 'passive_rule', effect: 'arcane_ward', wardHpExpression: 'wizard_level * 2 + INT modifier', wardRestoreExpression: 'ward_max_hp', bonusActionRestore: true },
            { type: 'arcane_ward', name: NAME, wardHpExpression: 'wizard_level * 2 + INT modifier', wardRestoreExpression: 'ward_max_hp', bonusActionRestore: true }],
        ['projected_ward defaults range 30 and reaction true',
            { type: 'passive_rule', effect: 'projected_ward' },
            { type: 'projected_ward', name: NAME, range: 30, reaction: true }],
        ['projected_ward passes through custom range',
            { type: 'passive_rule', effect: 'projected_ward', range: 60 },
            { type: 'projected_ward', name: NAME, range: 60, reaction: true }],
        ['spell_breaker full defaults',
            { type: 'passive_rule', effect: 'spell_breaker' },
            { type: 'spell_breaker', name: NAME, alwaysPreparedSpells: [], bonusActionSpells: [], dispelAbilityCheckBonus: '', slotRetentionSpells: [] }],
        ['spell_breaker custom values pass through',
            { type: 'passive_rule', effect: 'spell_breaker', alwaysPreparedSpells: ['dispel_magic'], bonusActionSpells: ['counterspell'], dispelAbilityCheckBonus: 'proficiency_bonus', slotRetentionSpells: ['counterspell'] },
            { type: 'spell_breaker', name: NAME, alwaysPreparedSpells: ['dispel_magic'], bonusActionSpells: ['counterspell'], dispelAbilityCheckBonus: 'proficiency_bonus', slotRetentionSpells: ['counterspell'] }],
        ['phantasmal_creatures full defaults',
            { type: 'phantasmal_creatures' },
            { type: 'phantasmal_creatures', name: NAME, alwaysPreparedSpells: [], freeCastSpells: [], usesMax: 1, halvesHp: false }],
        ['phantasmal_creatures custom values pass through',
            { type: 'phantasmal_creatures', alwaysPreparedSpells: ['phantasmal_force'], freeCastSpells: ['major_image'], usesMax: 2, halvesHp: true },
            { type: 'phantasmal_creatures', name: NAME, alwaysPreparedSpells: ['phantasmal_force'], freeCastSpells: ['major_image'], usesMax: 2, halvesHp: true }],
    ])('%s', (_label, automation, expected) => {
        expect(collect(automation)).toEqual([expected])
    })
})

// ── Gated rows: builder-level early-return branches ──

describe('gated rows — name gate and conditions-length gate', () => {
    it.each([
        ['damage_aura collects as Inner Radiance with default fields',
            [{ name: 'Inner Radiance', automation: { type: 'damage_aura' } }],
            [{ type: 'inner_radiance_turn_start', name: 'Inner Radiance', damageExpression: 'proficiency_bonus', damageType: 'Radiant', range: '10_ft' }]],
        ['damage_aura Inner Radiance custom fields pass through',
            [{ name: 'Inner Radiance', automation: { type: 'damage_aura', damageExpression: 'proficiency_bonus + 2', damageType: 'Fire', range: '20_ft' } }],
            [{ type: 'inner_radiance_turn_start', name: 'Inner Radiance', damageExpression: 'proficiency_bonus + 2', damageType: 'Fire', range: '20_ft' }]],
        ['damage_aura skipped for any other feature name (name gate)',
            [{ name: 'Fire Aura', automation: { type: 'damage_aura' } }],
            []],
        ['end_of_turn_condition_removal lowercases condition names',
            [{ name: 'Condition Remover', automation: { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: ['Frightened', 'Stunned'] } }],
            [{ type: 'condition_removal', name: 'Condition Remover', conditions: ['frightened', 'stunned'] }]],
        ['end_of_turn_condition_removal skipped when conditions is empty',
            [{ name: 'Condition Remover', automation: { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: [] } }],
            []],
        ['end_of_turn_condition_removal skipped when conditions is missing',
            [{ name: 'Condition Remover', automation: { type: 'passive_rule', effect: 'end_of_turn_condition_removal' } }],
            []],
    ])('%s', (_label, features, expected) => {
        expect(collectTurnStartEffects(features)).toEqual(expected)
    })
})

// ── Iteration: automation arrays and multi-feature order (no sort/dedup — input order) ──

describe('iteration — automation arrays and multi-feature ordering', () => {
    it('expands an automation array on one feature into one row per builder, in input order', () => {
        // Two DISTINCT builders — proves the array is expanded, not just the first entry read.
        const result = collectTurnStartEffects([{
            name: 'Multi Feature',
            automation: [
                { type: 'passive_rule', effect: 'naturally_stealthy' },
                { type: 'precise_hunter' },
            ],
        }])
        expect(result).toEqual([
            { type: 'naturally_stealthy', name: 'Multi Feature' },
            { type: 'precise_hunter', name: 'Multi Feature' },
        ])
    })

    it('merges rows from multiple features in feature order, dropping null entries', () => {
        const result = collectTurnStartEffects([
            null,
            { name: 'Supreme Sneak', automation: { type: 'passive_rule', effect: 'supreme_sneak' } },
            undefined,
            { name: 'Naturally Stealthy', automation: { type: 'passive_rule', effect: 'naturally_stealthy' } },
        ])
        expect(result).toEqual([
            { type: 'supreme_sneak', name: 'Supreme Sneak' },
            { type: 'naturally_stealthy', name: 'Naturally Stealthy' },
        ])
    })
})

// ── Resilience ──

describe('resilience — invalid inputs produce no rows', () => {
    it('returns [] for null, undefined, or empty features', () => {
        expect(collectTurnStartEffects(null)).toEqual([])
        expect(collectTurnStartEffects(undefined)).toEqual([])
        expect(collectTurnStartEffects([])).toEqual([])
    })

    it('drops every feature entry that cannot match a builder, without throwing', () => {
        expect(collectTurnStartEffects([
            null,
            undefined,
            { name: 'No automation' },
            { name: 'Null automation', automation: null },
            { name: 'Non-object automation', automation: 'invalid' },
            { name: 'Unknown type', automation: { type: 'unknown_type', effect: 'unknown' } },
            // dispatch keys on type, never effect — a valid effect with a null type must not leak
            { name: 'Null type', automation: { type: null, effect: 'naturally_stealthy' } },
        ])).toEqual([])
    })
})
