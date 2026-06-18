import { describe, it, expect } from 'vitest'
import { collectTurnStartEffects } from './automationCollector.js'

describe('collectTurnStartEffects – superior_defense', () => {
    it('collects superior_defense effect with default cost', () => {
        const features = [{
            name: 'Superior Defense',
            automation: { type: 'passive_rule', effect: 'superior_defense' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'superior_defense',
            name: 'Superior Defense',
            cost: 3,
        })
    })

    it('collects superior_defense effect with custom cost', () => {
        const features = [{
            name: 'Superior Defense',
            automation: { type: 'passive_rule', effect: 'superior_defense', cost: 5 }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].cost).toBe(5)
    })
})

describe('collectTurnStartEffects – flurry_healing_harm', () => {
    it('collects flurry_healing_harm effect with default usesExpression', () => {
        const features = [{
            name: 'Flurry of Healing & Harm',
            automation: { type: 'passive_rule', effect: 'flurry_healing_harm' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'flurry_healing_harm',
            name: 'Flurry of Healing & Harm',
            usesExpression: 'WIS modifier minimum 1',
        })
    })

    it('collects flurry_healing_harm effect with custom usesExpression', () => {
        const features = [{
            name: 'Flurry of Healing & Harm',
            automation: { type: 'passive_rule', effect: 'flurry_healing_harm', usesExpression: 'WIS modifier' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].usesExpression).toBe('WIS modifier')
    })
})

describe('collectTurnStartEffects – dread_ambush_speed', () => {
    it('collects dread_ambush_speed effect with default bonusExpression', () => {
        const features = [{
            name: 'Dread Ambush',
            automation: { type: 'passive_rule', effect: 'dread_ambush_speed' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'dread_ambush_speed',
            name: 'Dread Ambush',
            bonusExpression: '10',
        })
    })

    it('collects dread_ambush_speed effect with custom bonusExpression', () => {
        const features = [{
            name: 'Dread Ambush',
            automation: { type: 'passive_rule', effect: 'dread_ambush_speed', bonusExpression: '15' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].bonusExpression).toBe('15')
    })
})

describe('collectTurnStartEffects – supreme_sneak', () => {
    it('collects supreme_sneak effect', () => {
        const features = [{
            name: 'Supreme Sneak',
            automation: { type: 'passive_rule', effect: 'supreme_sneak' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'supreme_sneak',
            name: 'Supreme Sneak',
        })
    })
})

describe('collectTurnStartEffects – naturally_stealthy', () => {
    it('collects naturally_stealthy effect', () => {
        const features = [{
            name: 'Naturally Stealthy',
            automation: { type: 'passive_rule', effect: 'naturally_stealthy' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'naturally_stealthy',
            name: 'Naturally Stealthy',
        })
    })
})

describe('collectTurnStartEffects – create_thrall_temp_hp', () => {
    it('collects create_thrall_temp_hp effect with default tempHpExpression', () => {
        const features = [{
            name: 'Create Thrall',
            automation: { type: 'passive_rule', effect: 'create_thrall_temp_hp' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'create_thrall_temp_hp',
            name: 'Create Thrall',
            tempHpExpression: 'warlock level + CHA modifier',
        })
    })

    it('collects create_thrall_temp_hp effect with custom tempHpExpression', () => {
        const features = [{
            name: 'Create Thrall',
            automation: { type: 'passive_rule', effect: 'create_thrall_temp_hp', tempHpExpression: 'warlock level' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].tempHpExpression).toBe('warlock level')
    })
})

describe('collectTurnStartEffects – mage_hand_legerdemain', () => {
    it('collects mage_hand_legerdemain effect', () => {
        const features = [{
            name: 'Mage Hand Legerdemain',
            automation: { type: 'passive_rule', effect: 'mage_hand_legerdemain' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'mage_hand_legerdemain',
            name: 'Mage Hand Legerdemain',
        })
    })
})

describe('collectTurnStartEffects – roving_aim / steady_aim', () => {
    it('collects roving_aim as steady_aim_clear', () => {
        const features = [{
            name: 'Roving Aim',
            automation: { type: 'passive_rule', effect: 'roving_aim' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'steady_aim_clear',
            name: 'Roving Aim',
        })
    })

    it('collects steady_aim type as steady_aim_clear', () => {
        const features = [{
            name: 'Steady Aim',
            automation: { type: 'steady_aim' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'steady_aim_clear',
            name: 'Steady Aim',
        })
    })
})

describe('collectTurnStartEffects – holy_nimbus', () => {
    it('collects holy_nimbus effect', () => {
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
})

describe('collectTurnStartEffects – living_legend', () => {
    it('collects living_legend effect', () => {
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
})

describe('collectTurnStartEffects – radiant_soul', () => {
    it('collects radiant_soul effect', () => {
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
})

describe('collectTurnStartEffects – Inner Radiance (damage_aura)', () => {
    it('collects damage_aura with feature name Inner Radiance', () => {
        const features = [{
            name: 'Inner Radiance',
            automation: { type: 'damage_aura' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'inner_radiance_turn_start',
            name: 'Inner Radiance',
            damageExpression: 'proficiency_bonus',
            damageType: 'Radiant',
            range: '10_ft',
        })
    })

    it('does not collect damage_aura with different feature name', () => {
        const features = [{
            name: 'Other Aura',
            automation: { type: 'damage_aura' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(0)
    })

    it('collects damage_aura Inner Radiance with custom fields', () => {
        const features = [{
            name: 'Inner Radiance',
            automation: {
                type: 'damage_aura',
                damageExpression: 'proficiency_bonus + 2',
                damageType: 'Fire',
                range: '20_ft',
            }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].damageExpression).toBe('proficiency_bonus + 2')
        expect(result[0].damageType).toBe('Fire')
        expect(result[0].range).toBe('20_ft')
    })
})

describe('collectTurnStartEffects – precise_hunter', () => {
    it('collects precise_hunter effect', () => {
        const features = [{
            name: 'Precise Hunter',
            automation: { type: 'precise_hunter' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'precise_hunter',
            name: 'Precise Hunter',
        })
    })
})

describe('collectTurnStartEffects – hunter_lore', () => {
    it('collects hunter_lore effect', () => {
        const features = [{
            name: 'Hunter Lore',
            automation: { type: 'hunter_lore' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'hunter_lore',
            name: 'Hunter Lore',
        })
    })
})

describe('collectTurnStartEffects – use_magic_device', () => {
    it('collects use_magic_device effect with default attunementLimit', () => {
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

    it('collects use_magic_device with custom attunementLimit', () => {
        const features = [{
            name: 'Use Magic Device',
            automation: { type: 'use_magic_device', attunementLimit: 6 }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].attunementLimit).toBe(6)
    })
})

describe('collectTurnStartEffects – savant effects', () => {
    it('collects abjuration_savant effect', () => {
        const features = [{
            name: 'Abjuration Savant',
            automation: { type: 'passive_rule', effect: 'abjuration_savant' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ type: 'abjuration_savant', name: 'Abjuration Savant' })
    })

    it('collects divination_savant effect', () => {
        const features = [{
            name: 'Divination Savant',
            automation: { type: 'passive_rule', effect: 'divination_savant' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ type: 'divination_savant', name: 'Divination Savant' })
    })

    it('collects evocation_savant effect', () => {
        const features = [{
            name: 'Evocation Savant',
            automation: { type: 'passive_rule', effect: 'evocation_savant' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ type: 'evocation_savant', name: 'Evocation Savant' })
    })

    it('collects illusion_savant effect', () => {
        const features = [{
            name: 'Illusion Savant',
            automation: { type: 'passive_rule', effect: 'illusion_savant' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ type: 'illusion_savant', name: 'Illusion Savant' })
    })
})

describe('collectTurnStartEffects – improved_illusions', () => {
    it('collects improved_illusions effect', () => {
        const features = [{
            name: 'Improved Illusions',
            automation: { type: 'passive_rule', effect: 'improved_illusions' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'improved_illusions',
            name: 'Improved Illusions',
        })
    })
})

describe('collectTurnStartEffects – tavern_brawler_push', () => {
    it('collects tavern_brawler_push effect', () => {
        const features = [{
            name: 'Tavern Brawler',
            automation: { type: 'passive_rule', effect: 'tavern_brawler_push' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'tavern_brawler_push',
            name: 'Tavern Brawler',
        })
    })
})

describe('collectTurnStartEffects – crossbow weapon effects', () => {
    it('collects ignore_loading_crossbows with weapons', () => {
        const features = [{
            name: 'Crossbow Expert',
            automation: { type: 'passive_rule', effect: 'ignore_loading_crossbows', weapons: ['hand_crossbow', 'heavy_crossbow'] }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'ignore_loading_crossbows',
            name: 'Crossbow Expert',
            weapons: ['hand_crossbow', 'heavy_crossbow'],
        })
    })

    it('collects ignore_loading_crossbows with default weapons', () => {
        const features = [{
            name: 'Crossbow Expert',
            automation: { type: 'passive_rule', effect: 'ignore_loading_crossbows' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].weapons).toEqual([])
    })

    it('collects no_melee_disadvantage_crossbows effect', () => {
        const features = [{
            name: 'Crossbow Expert',
            automation: { type: 'passive_rule', effect: 'no_melee_disadvantage_crossbows' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'no_melee_disadvantage_crossbows',
            name: 'Crossbow Expert',
        })
    })
})

describe('collectTurnStartEffects – grapple_damage', () => {
    it('collects grapple_damage effect', () => {
        const features = [{
            name: 'Grapple Damage',
            automation: { type: 'passive_rule', effect: 'grapple_damage' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'grapple_damage',
            name: 'Grapple Damage',
        })
    })
})

describe('collectTurnStartEffects – healing_start_of_turn', () => {
    it('collects healing_start_of_turn effect with defaults', () => {
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

    it('collects healing_start_of_turn with custom values', () => {
        const features = [{
            name: 'Greater Regeneration',
            automation: { type: 'healing_start_of_turn', healExpression: '10', bodyPartRegrowMinutes: 5 }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].healExpression).toBe('10')
        expect(result[0].bodyPartRegrowMinutes).toBe(5)
    })
})

describe('collectTurnStartEffects – third_eye', () => {
    it('collects third_eye effect with default duration', () => {
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

    it('collects third_eye effect with custom duration', () => {
        const features = [{
            name: 'Third Eye',
            automation: { type: 'third_eye', duration: 'long_rest' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].duration).toBe('long_rest')
    })
})

describe('collectTurnStartEffects – arcane_ward', () => {
    it('collects arcane_ward effect with defaults', () => {
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

    it('collects arcane_ward effect with custom values', () => {
        const features = [{
            name: 'Arcane Ward',
            automation: {
                type: 'passive_rule',
                effect: 'arcane_ward',
                wardHpExpression: 'wizard_level * 2 + INT modifier',
                wardRestoreExpression: 'ward_max_hp',
                bonusActionRestore: true,
            }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].wardHpExpression).toBe('wizard_level * 2 + INT modifier')
        expect(result[0].wardRestoreExpression).toBe('ward_max_hp')
        expect(result[0].bonusActionRestore).toBe(true)
    })
})

describe('collectTurnStartEffects – projected_ward', () => {
    it('collects projected_ward effect with defaults', () => {
        const features = [{
            name: 'Projected Ward',
            automation: { type: 'passive_rule', effect: 'projected_ward' }
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'projected_ward',
            name: 'Projected Ward',
            range: 30,
            reaction: true,
        })
    })

    it('collects projected_ward effect with custom range', () => {
        const features = [{
            name: 'Projected Ward',
            automation: { type: 'passive_rule', effect: 'projected_ward', range: 60 }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].range).toBe(60)
    })
})

describe('collectTurnStartEffects – spell_breaker', () => {
    it('collects spell_breaker effect with defaults', () => {
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

    it('collects spell_breaker effect with custom values', () => {
        const features = [{
            name: 'Spell Breaker',
            automation: {
                type: 'passive_rule',
                effect: 'spell_breaker',
                alwaysPreparedSpells: ['dispel_magic'],
                bonusActionSpells: ['counterspell'],
                dispelAbilityCheckBonus: 'proficiency_bonus',
                slotRetentionSpells: ['counterspell'],
            }
        }]
        const result = collectTurnStartEffects(features)
        expect(result[0].alwaysPreparedSpells).toEqual(['dispel_magic'])
        expect(result[0].bonusActionSpells).toEqual(['counterspell'])
        expect(result[0].dispelAbilityCheckBonus).toBe('proficiency_bonus')
        expect(result[0].slotRetentionSpells).toEqual(['counterspell'])
    })
})

describe('collectTurnStartEffects – phantasmal_creatures', () => {
    it('collects phantasmal_creatures effect with defaults', () => {
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

    it('collects phantasmal_creatures with custom values', () => {
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
        expect(result[0].alwaysPreparedSpells).toEqual(['phantasmal_force'])
        expect(result[0].freeCastSpells).toEqual(['major_image'])
        expect(result[0].usesMax).toBe(2)
        expect(result[0].halvesHp).toBe(true)
    })
})

describe('collectTurnStartEffects – edge cases', () => {
    it('collects multiple effects from a single feature with array automation', () => {
        const features = [{
            name: 'Multi Feature',
            automation: [
                { type: 'passive_rule', effect: 'superior_defense' },
                { type: 'passive_rule', effect: 'naturally_stealthy' },
                { type: 'holy_nimbus' },
            ]
        }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(3)
        expect(result[0].type).toBe('superior_defense')
        expect(result[1].type).toBe('naturally_stealthy')
        expect(result[2].type).toBe('holy_nimbus_radiant_damage')
    })

    it('skips features with null automation', () => {
        const features = [{ name: 'Null', automation: null }]
        expect(collectTurnStartEffects(features)).toEqual([])
    })

    it('skips features with undefined automation', () => {
        const features = [{ name: 'Undefined', automation: undefined }]
        expect(collectTurnStartEffects(features)).toEqual([])
    })

    it('handles non-passive_rule type gracefully', () => {
        const features = [{
            name: 'Some Feature',
            automation: { type: 'unknown_type', effect: 'unknown' }
        }]
        expect(collectTurnStartEffects(features)).toEqual([])
    })

    it('collects nothing when conditions array is empty for condition_removal', () => {
        const features = [{
            name: 'Empty Conditions',
            automation: {
                type: 'passive_rule',
                effect: 'end_of_turn_condition_removal',
                conditions: []
            }
        }]
        expect(collectTurnStartEffects(features)).toEqual([])
    })

    it('collects multiple effects from multiple features', () => {
        const features = [
            { name: 'Supreme Sneak', automation: { type: 'passive_rule', effect: 'supreme_sneak' } },
            { name: 'Holy Nimbus', automation: { type: 'holy_nimbus' } },
        ]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(2)
        expect(result[0].type).toBe('supreme_sneak')
        expect(result[1].type).toBe('holy_nimbus_radiant_damage')
    })

    it('handles features array with null entries', () => {
        const features = [null, { name: 'Valid', automation: { type: 'holy_nimbus' } }]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
    })
})
