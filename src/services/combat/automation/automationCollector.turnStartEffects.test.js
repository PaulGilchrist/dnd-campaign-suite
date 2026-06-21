// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { collectTurnStartEffects } from './automationCollector.js'

describe('collectTurnStartEffects', () => {
    describe('passive_rule effects with defaults', () => {
        const simpleEffects = [
            ['supreme_sneak', 'supreme_sneak'],
            ['umbral_sight', 'umbral_sight'],
            ['naturally_stealthy', 'naturally_stealthy'],
            ['mage_hand_legerdemain', 'mage_hand_legerdemain'],
            ['divination_savant', 'divination_savant'],
            ['evocation_savant', 'evocation_savant'],
            ['illusion_savant', 'illusion_savant'],
            ['improved_illusions', 'improved_illusions'],
            ['tavern_brawler_push', 'tavern_brawler_push'],
            ['grapple_damage', 'grapple_damage'],
        ]

        for (const [effect, expectedType] of simpleEffects) {
            it(`maps ${effect} to ${expectedType} with defaults`, () => {
                const features = [{
                    name: effect,
                    automation: { type: 'passive_rule', effect }
                }]
                const result = collectTurnStartEffects(features)
                expect(result).toHaveLength(1)
                expect(result[0]).toMatchObject({
                    type: expectedType,
                    name: effect,
                })
                expect(Object.keys(result[0])).toEqual(['type', 'name'])
            })
        }
    })

    describe('passive_rule effects with custom overrides', () => {
        const overridableEffects = [
            { effect: 'superior_defense', field: 'cost', value: 5, default: 3 },
            { effect: 'flurry_healing_harm', field: 'usesExpression', value: 'CHA modifier', default: 'WIS modifier minimum 1' },
            { effect: 'dread_ambush_speed', field: 'bonusExpression', value: '15', default: '10' },
            { effect: 'create_thrall_temp_hp', field: 'tempHpExpression', value: 'warlock level', default: 'warlock level + CHA modifier' },
            { effect: 'arcane_ward', field: 'wardHpExpression', value: 'wizard_level * 2', default: '' },
            { effect: 'projected_ward', field: 'range', value: 60, default: 30 },
        ]

        for (const { effect, field, value, default: defaultValue } of overridableEffects) {
            it(`uses custom ${field} when provided for ${effect}`, () => {
                const features = [{
                    name: effect,
                    automation: { type: 'passive_rule', effect, [field]: value }
                }]
                const result = collectTurnStartEffects(features)
                expect(result).toHaveLength(1)
                expect(result[0][field]).toBe(value)
            })

            it(`uses default ${field} for ${effect} when not provided`, () => {
                const features = [{
                    name: effect,
                    automation: { type: 'passive_rule', effect }
                }]
                const result = collectTurnStartEffects(features)
                expect(result).toHaveLength(1)
                expect(result[0][field]).toBe(defaultValue)
            })
        }
    })

    describe('arcane_ward full shape', () => {
        it('returns full object with all defaults', () => {
            const features = [{
                name: 'Arcane Ward',
                automation: { type: 'passive_rule', effect: 'arcane_ward' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'arcane_ward',
                name: 'Arcane Ward',
                wardHpExpression: '',
                wardRestoreExpression: '',
                bonusActionRestore: false,
            })
        })

        it('returns full object with custom values', () => {
            const features = [{
                name: 'Arcane Ward',
                automation: {
                    type: 'passive_rule', effect: 'arcane_ward',
                    wardHpExpression: 'wizard_level * 2 + INT modifier',
                    wardRestoreExpression: 'ward_max_hp',
                    bonusActionRestore: true,
                }
            }]
            const result = collectTurnStartEffects(features)
            expect(result[0]).toEqual({
                type: 'arcane_ward',
                name: 'Arcane Ward',
                wardHpExpression: 'wizard_level * 2 + INT modifier',
                wardRestoreExpression: 'ward_max_hp',
                bonusActionRestore: true,
            })
        })
    })

    describe('spell_breaker full shape', () => {
        it('returns full object with all defaults', () => {
            const features = [{
                name: 'Spell Breaker',
                automation: { type: 'passive_rule', effect: 'spell_breaker' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'spell_breaker',
                name: 'Spell Breaker',
                alwaysPreparedSpells: [],
                bonusActionSpells: [],
                dispelAbilityCheckBonus: '',
                slotRetentionSpells: [],
            })
        })

        it('returns full object with custom values', () => {
            const features = [{
                name: 'Spell Breaker',
                automation: {
                    type: 'passive_rule', effect: 'spell_breaker',
                    alwaysPreparedSpells: ['dispel_magic'],
                    bonusActionSpells: ['counterspell'],
                    dispelAbilityCheckBonus: 'proficiency_bonus',
                    slotRetentionSpells: ['counterspell'],
                }
            }]
            const result = collectTurnStartEffects(features)
            expect(result[0]).toEqual({
                type: 'spell_breaker',
                name: 'Spell Breaker',
                alwaysPreparedSpells: ['dispel_magic'],
                bonusActionSpells: ['counterspell'],
                dispelAbilityCheckBonus: 'proficiency_bonus',
                slotRetentionSpells: ['counterspell'],
            })
        })
    })

    describe('phantasmal_creatures full shape', () => {
        it('returns full object with all defaults', () => {
            const features = [{
                name: 'Phantasmal Creatures',
                automation: { type: 'phantasmal_creatures' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'phantasmal_creatures',
                name: 'Phantasmal Creatures',
                alwaysPreparedSpells: [],
                freeCastSpells: [],
                usesMax: 1,
                halvesHp: false,
            })
        })

        it('returns full object with custom values', () => {
            const features = [{
                name: 'Phantasmal Creatures',
                automation: {
                    type: 'phantasmal_creatures',
                    alwaysPreparedSpells: ['phantasmal_force'],
                    freeCastSpells: ['major_image'],
                    usesMax: 2,
                    halvesHp: true,
                }
            }]
            const result = collectTurnStartEffects(features)
            expect(result[0]).toEqual({
                type: 'phantasmal_creatures',
                name: 'Phantasmal Creatures',
                alwaysPreparedSpells: ['phantasmal_force'],
                freeCastSpells: ['major_image'],
                usesMax: 2,
                halvesHp: true,
            })
        })
    })

    describe('type-based effects (precise_hunter, hunter_lore)', () => {
        it('maps precise_hunter type', () => {
            const result = collectTurnStartEffects([{
                name: 'Precise Hunter',
                automation: { type: 'precise_hunter' }
            }])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'precise_hunter',
                name: 'Precise Hunter',
            })
        })

        it('maps hunter_lore type', () => {
            const result = collectTurnStartEffects([{
                name: 'Hunter Lore',
                automation: { type: 'hunter_lore' }
            }])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'hunter_lore',
                name: 'Hunter Lore',
            })
        })
    })

    describe('type-based effects', () => {
        it('maps holy_nimbus type to holy_nimbus_radiant_damage with fixed fields', () => {
            const features = [{
                name: 'Holy Nimbus',
                automation: { type: 'holy_nimbus' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'holy_nimbus_radiant_damage',
                name: 'Holy Nimbus',
                damageExpression: 'CHA modifier + proficiency_bonus',
                range: '10_ft',
            })
        })

        it('maps living_legend type to living_legend_turn_start', () => {
            const features = [{
                name: 'Living Legend',
                automation: { type: 'living_legend' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'living_legend_turn_start',
                name: 'Living Legend',
            })
        })

        it('maps radiant_soul type to radiant_soul_turn_start', () => {
            const features = [{
                name: 'Radiant Soul',
                automation: { type: 'radiant_soul' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'radiant_soul_turn_start',
                name: 'Radiant Soul',
            })
        })

        it('maps elder_champion type to elder_champion_regeneration with defaults', () => {
            const features = [{
                name: 'Elder Champion',
                automation: { type: 'elder_champion' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'elder_champion_regeneration',
                name: 'Elder Champion',
                healExpression: '10',
            })
        })

        it('maps use_magic_device type with default attunementLimit', () => {
            const features = [{
                name: 'Use Magic Device',
                automation: { type: 'use_magic_device' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'use_magic_device',
                name: 'Use Magic Device',
                attunementLimit: 4,
            })
        })

        it('maps use_magic_device type with custom attunementLimit', () => {
            const features = [{
                name: 'Use Magic Device',
                automation: { type: 'use_magic_device', attunementLimit: 6 }
            }]
            const result = collectTurnStartEffects(features)
            expect(result[0].attunementLimit).toBe(6)
        })

        it('maps third_eye type with default duration', () => {
            const features = [{
                name: 'Third Eye',
                automation: { type: 'third_eye' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'third_eye',
                name: 'Third Eye',
                duration: 'short_or_long_rest',
            })
        })

        it('maps third_eye type with custom duration', () => {
            const features = [{
                name: 'Third Eye',
                automation: { type: 'third_eye', duration: 'long_rest' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result[0].duration).toBe('long_rest')
        })

        it('maps healing_start_of_turn type with defaults', () => {
            const features = [{
                name: 'Regeneration',
                automation: { type: 'healing_start_of_turn' }
            }]
            const result = collectTurnStartEffects(features)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'regenerate_turn_start_heal',
                name: 'Regeneration',
                healExpression: '1',
                bodyPartRegrowMinutes: 2,
            })
        })

        it('maps healing_start_of_turn type with custom values', () => {
            const features = [{
                name: 'Greater Regeneration',
                automation: { type: 'healing_start_of_turn', healExpression: '10', bodyPartRegrowMinutes: 5 }
            }]
            const result = collectTurnStartEffects(features)
            expect(result[0]).toEqual({
                type: 'regenerate_turn_start_heal',
                name: 'Greater Regeneration',
                healExpression: '10',
                bodyPartRegrowMinutes: 5,
            })
        })
    })

    describe('damage_aura type gating', () => {
        it('collects damage_aura only when feature name is Inner Radiance', () => {
            const result = collectTurnStartEffects([{
                name: 'Inner Radiance',
                automation: { type: 'damage_aura' }
            }])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'inner_radiance_turn_start',
                name: 'Inner Radiance',
                damageExpression: 'proficiency_bonus',
                damageType: 'Radiant',
                range: '10_ft',
            })
        })

        it('skips damage_aura for any other feature name', () => {
            const result = collectTurnStartEffects([{
                name: 'Fire Aura',
                automation: { type: 'damage_aura' }
            }])
            expect(result).toHaveLength(0)
        })

        it('respects custom fields on Inner Radiance damage_aura', () => {
            const result = collectTurnStartEffects([{
                name: 'Inner Radiance',
                automation: {
                    type: 'damage_aura',
                    damageExpression: 'proficiency_bonus + 2',
                    damageType: 'Fire',
                    range: '20_ft',
                }
            }])
            expect(result[0]).toEqual({
                type: 'inner_radiance_turn_start',
                name: 'Inner Radiance',
                damageExpression: 'proficiency_bonus + 2',
                damageType: 'Fire',
                range: '20_ft',
            })
        })
    })

    describe('crossbow weapon effects', () => {
        it('collects ignore_loading_crossbows with explicit weapons', () => {
            const result = collectTurnStartEffects([{
                name: 'Crossbow Expert',
                automation: { type: 'passive_rule', effect: 'ignore_loading_crossbows', weapons: ['hand_crossbow', 'heavy_crossbow'] }
            }])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'ignore_loading_crossbows',
                name: 'Crossbow Expert',
                weapons: ['hand_crossbow', 'heavy_crossbow'],
            })
        })

        it('collects ignore_loading_crossbows with empty weapons array when not provided', () => {
            const result = collectTurnStartEffects([{
                name: 'Crossbow Expert',
                automation: { type: 'passive_rule', effect: 'ignore_loading_crossbows' }
            }])
            expect(result[0].weapons).toEqual([])
        })

        it('collects no_melee_disadvantage_crossbows effect', () => {
            const result = collectTurnStartEffects([{
                name: 'Crossbow Expert',
                automation: { type: 'passive_rule', effect: 'no_melee_disadvantage_crossbows' }
            }])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'no_melee_disadvantage_crossbows',
                name: 'Crossbow Expert',
            })
        })
    })

    describe('steady_aim_clear normalization', () => {
        it('maps roving_aim passive_rule effect to steady_aim_clear', () => {
            const result = collectTurnStartEffects([{
                name: 'Roving Aim',
                automation: { type: 'passive_rule', effect: 'roving_aim' }
            }])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'steady_aim_clear',
                name: 'Roving Aim',
            })
        })

        it('maps steady_aim type to steady_aim_clear', () => {
            const result = collectTurnStartEffects([{
                name: 'Steady Aim',
                automation: { type: 'steady_aim' }
            }])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'steady_aim_clear',
                name: 'Steady Aim',
            })
        })
    })

    describe('projected_ward defaults', () => {
        it('returns reaction: true and default range 30', () => {
            const result = collectTurnStartEffects([{
                name: 'Projected Ward',
                automation: { type: 'passive_rule', effect: 'projected_ward' }
            }])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'projected_ward',
                name: 'Projected Ward',
                range: 30,
                reaction: true,
            })
        })

        it('respects custom range value', () => {
            const result = collectTurnStartEffects([{
                name: 'Projected Ward',
                automation: { type: 'passive_rule', effect: 'projected_ward', range: 60 }
            }])
            expect(result[0].range).toBe(60)
        })
    })

    describe('heroic_inspiration_turn_start', () => {
        it('maps to heroic_inspiration type', () => {
            const result = collectTurnStartEffects([{
                name: 'Heroic Inspiration',
                automation: { type: 'passive_rule', effect: 'heroic_inspiration_turn_start' }
            }])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'heroic_inspiration',
                name: 'Heroic Inspiration',
            })
        })
    })

    describe('end_of_turn_condition_removal', () => {
        it('skips when conditions array is empty', () => {
            const result = collectTurnStartEffects([{
                name: 'Empty Conditions',
                automation: { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: [] }
            }])
            expect(result).toHaveLength(0)
        })

        it('skips when conditions is undefined', () => {
            const result = collectTurnStartEffects([{
                name: 'No Conditions',
                automation: { type: 'passive_rule', effect: 'end_of_turn_condition_removal' }
            }])
            expect(result).toHaveLength(0)
        })

        it('collects with condition names lowercased', () => {
            const result = collectTurnStartEffects([{
                name: 'Condition Remover',
                automation: { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: ['Frightened', 'Stunned'] }
            }])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                type: 'condition_removal',
                name: 'Condition Remover',
                conditions: ['frightened', 'stunned'],
            })
        })
    })

    describe('array automation', () => {
        it('processes multiple automation objects from a single feature', () => {
            const result = collectTurnStartEffects([{
                name: 'Multi Feature',
                automation: [
                    { type: 'passive_rule', effect: 'superior_defense' },
                    { type: 'passive_rule', effect: 'naturally_stealthy' },
                    { type: 'holy_nimbus' },
                ]
            }])
            expect(result).toHaveLength(3)
            expect(result[0].type).toBe('superior_defense')
            expect(result[1].type).toBe('naturally_stealthy')
            expect(result[2].type).toBe('holy_nimbus_radiant_damage')
        })

        it('merges effects from multiple features', () => {
            const result = collectTurnStartEffects([
                { name: 'Supreme Sneak', automation: { type: 'passive_rule', effect: 'supreme_sneak' } },
                { name: 'Holy Nimbus', automation: { type: 'holy_nimbus' } },
            ])
            expect(result).toHaveLength(2)
            expect(result[0].type).toBe('supreme_sneak')
            expect(result[1].type).toBe('holy_nimbus_radiant_damage')
        })
    })

    describe('null safety and edge cases', () => {
        it('returns empty array when features is null', () => {
            expect(collectTurnStartEffects(null)).toEqual([])
        })

        it('returns empty array when features is undefined', () => {
            expect(collectTurnStartEffects(undefined)).toEqual([])
        })

        it('returns empty array when features is an empty array', () => {
            expect(collectTurnStartEffects([])).toEqual([])
        })

        it('skips feature with null automation', () => {
            const result = collectTurnStartEffects([{ name: 'Null', automation: null }])
            expect(result).toEqual([])
        })

        it('skips feature with undefined automation', () => {
            const result = collectTurnStartEffects([{ name: 'Undefined', automation: undefined }])
            expect(result).toEqual([])
        })

        it('skips feature with no automation property', () => {
            const result = collectTurnStartEffects([{ name: 'No Automation' }])
            expect(result).toEqual([])
        })

        it('skips null entries in features array', () => {
            const result = collectTurnStartEffects([null, { name: 'Valid', automation: { type: 'holy_nimbus' } }])
            expect(result).toHaveLength(1)
        })

        it('skips undefined entries in features array', () => {
            const result = collectTurnStartEffects([undefined, { name: 'Valid', automation: { type: 'holy_nimbus' } }])
            expect(result).toHaveLength(1)
        })

        it('ignores unknown automation types', () => {
            const result = collectTurnStartEffects([{
                name: 'Unknown',
                automation: { type: 'unknown_type', effect: 'unknown' }
            }])
            expect(result).toEqual([])
        })

        it('ignores features with non-object automation values', () => {
            const result = collectTurnStartEffects([
                { name: 'String', automation: 'invalid' },
                { name: 'Number', automation: 42 },
                { name: 'Boolean', automation: true },
            ])
            expect(result).toEqual([])
        })

        it('handles automation with null type gracefully', () => {
            const result = collectTurnStartEffects([{
                name: 'Null Type',
                automation: { type: null, effect: 'superior_defense' }
            }])
            expect(result).toEqual([])
        })

        it('handles feature with empty name', () => {
            const result = collectTurnStartEffects([{
                name: '',
                automation: { type: 'holy_nimbus' }
            }])
            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('')
        })
    })
})
