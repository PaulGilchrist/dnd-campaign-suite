// @cleaned-by-ai
// @improved-by-ai

import { describe, it, expect } from 'vitest'
import { tempHandlers } from './temp.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── temp_buff ────────────────────────────────────────────────────────

describe('tempHandlers – temp_buff', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.temp_buff(makeFeature({ type: 'temp_buff' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'temp_buff', name: 'Test Feature', hasAutomation: true,
            effect: '', duration: '1_minute', action: 'bonus_action',
            recharge: 'long_rest', distance: '', extendedDistance: '',
            oncePerRage: false, bringAllies: false, allyCount: 0,
            teleportRange: '', enemiesDisadvantageSaves: [],
            triggerOnRage: false, distanceExpression: '', casting_time: '',
            uses: null, usesMax: null,
        })
    })

    it('resolves uses to proficiency_bonus when string is proficiency_bonus', () => {
        const result = tempHandlers.temp_buff(makeFeature({ type: 'temp_buff', uses: 'proficiency_bonus' }), BASE_STATS)
        expect(result.uses).toBe('proficiency_bonus')
        expect(result.usesMax).toBe(3)
    })

    it('resolves uses to class.level when uses ends with _level and class name matches', () => {
        const stats = { ...BASE_STATS, class: { name: 'barbarian' } }
        const result = tempHandlers.temp_buff(makeFeature({ type: 'temp_buff', uses: 'barbarian_level' }), stats)
        expect(result.uses).toBe('barbarian_level')
        expect(result.usesMax).toBe(5)
    })

    it('resolves uses to class.levels fallback when class name does not match', () => {
        const stats = { ...BASE_STATS, class: { name: 'Wizard' } }
        const result = tempHandlers.temp_buff(makeFeature({ type: 'temp_buff', uses: 'barbarian_level' }), stats)
        expect(result.usesMax).toBe(5)
    })

    it('coerces boolean fields with !!', () => {
        const result = tempHandlers.temp_buff(makeFeature({ type: 'temp_buff', oncePerRage: 1, bringAllies: 'yes', triggerOnRage: 0 }), BASE_STATS)
        expect(result.oncePerRage).toBe(true)
        expect(result.bringAllies).toBe(true)
        expect(result.triggerOnRage).toBe(false)
    })

    it('coerces allyCount to 0 for falsy values', () => {
        const result = tempHandlers.temp_buff(makeFeature({ type: 'temp_buff', allyCount: 0 }), BASE_STATS)
        expect(result.allyCount).toBe(0)
    })

    it('passes through enemies_disadvantage_saves snake_case key', () => {
        const result = tempHandlers.temp_buff(makeFeature({ type: 'temp_buff', enemies_disadvantage_saves: ['goblins', 'undead'] }), BASE_STATS)
        expect(result.enemiesDisadvantageSaves).toEqual(['goblins', 'undead'])
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.temp_buff(makeFeature({
            type: 'temp_buff', effect: 'haste', duration: '10_minutes', action: 'action',
            recharge: 'short_rest', distance: '30 ft', extendedDistance: '60 ft',
            oncePerRage: true, bringAllies: true, allyCount: 3, teleportRange: '30 ft', triggerOnRage: true,
        }), BASE_STATS)
        expect(result).toMatchObject({
            effect: 'haste', duration: '10_minutes', action: 'action',
            recharge: 'short_rest', distance: '30 ft', extendedDistance: '60 ft',
            oncePerRage: true, bringAllies: true, allyCount: 3, teleportRange: '30 ft', triggerOnRage: true,
        })
    })
})

// ── temp_hp_buff ─────────────────────────────────────────────────────

describe('tempHandlers – temp_hp_buff', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.temp_hp_buff(makeFeature({ type: 'temp_hp_buff' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'temp_hp_buff', name: 'Test Feature', hasAutomation: true,
            buffExpression: '', range: '60_ft', targets: 1, targetsExpression: '',
            bonusMovement: false, extraEffect: null, tempHpExpression: '',
            triggerOnRage: false, ongoingHealingExpression: '',
            healingStartOfTurn: false, healingRange: '', casting_time: '1 bonus action',
            includesSelf: false, multiTargetAlly: false,
        })
    })

    it('coerces boolean fields with !!', () => {
        const result = tempHandlers.temp_hp_buff(makeFeature({ type: 'temp_hp_buff', bonusMovement: 'yes', trigger_on_rage: 1, healingStartOfTurn: 0, includesSelf: '' }), BASE_STATS)
        expect(result.bonusMovement).toBe(true)
        expect(result.triggerOnRage).toBe(true)
        expect(result.healingStartOfTurn).toBe(false)
        expect(result.includesSelf).toBe(false)
    })

    it('coerces extraEffect to null for falsy values', () => {
        const result = tempHandlers.temp_hp_buff(makeFeature({ type: 'temp_hp_buff', extraEffect: '' }), BASE_STATS)
        expect(result.extraEffect).toBeNull()
    })

    it('maps trigger_on_rage snake_case to triggerOnRage camelCase', () => {
        const result = tempHandlers.temp_hp_buff(makeFeature({ type: 'temp_hp_buff', trigger_on_rage: true }), BASE_STATS)
        expect(result.triggerOnRage).toBe(true)
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.temp_hp_buff(makeFeature({
            type: 'temp_hp_buff', buffExpression: '2d8', range: '30_ft', targets: 5,
            targetsExpression: '3 + level', bonusMovement: true, extraEffect: 'speed_boost',
            tempHpExpression: '1d10', trigger_on_rage: true, ongoingHealingExpression: '1d6',
            healingStartOfTurn: true, healingRange: '10_ft', includesSelf: true, multiTargetAlly: true,
        }), BASE_STATS)
        expect(result).toMatchObject({
            buffExpression: '2d8', range: '30_ft', targets: 5, targetsExpression: '3 + level',
            bonusMovement: true, extraEffect: 'speed_boost', tempHpExpression: '1d10',
            triggerOnRage: true, ongoingHealingExpression: '1d6',
            healingStartOfTurn: true, healingRange: '10_ft', includesSelf: true, multiTargetAlly: true,
        })
    })
})

// ── sacred_weapon ────────────────────────────────────────────────────

describe('tempHandlers – sacred_weapon', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.sacred_weapon(makeFeature({ type: 'sacred_weapon' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'temp_buff', name: 'Test Feature', hasAutomation: true,
            effect: 'sacred_weapon', duration: '10_minutes', resourceCost: '', options: [], casting_time: '',
        })
    })

    it('does not mutate the options array from the feature', () => {
        const options = [{ name: 'Option A' }]
        const result = tempHandlers.sacred_weapon(makeFeature({ type: 'sacred_weapon', options }), BASE_STATS)
        expect(result.options).toBe(options)
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.sacred_weapon(makeFeature({
            type: 'sacred_weapon', duration: '1_minute', resourceCost: 'divine favor',
            options: [{ name: 'Option A' }],
        }), BASE_STATS)
        expect(result).toMatchObject({ duration: '1_minute', resourceCost: 'divine favor' })
    })
})

// ── avenging_angel ───────────────────────────────────────────────────

describe('tempHandlers – avenging_angel', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.avenging_angel(makeFeature({ type: 'avenging_angel' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'temp_buff', name: 'Test Feature', hasAutomation: true,
            effect: 'avenging_angel', duration: '10_minutes', action: 'bonus_action',
            flySpeed: 60, hover: false, auraRange: 'aura_of_protection',
            saveType: 'WIS', saveDc: 'ability',
        })
    })

    it('coerces hover with !!', () => {
        const result = tempHandlers.avenging_angel(makeFeature({ type: 'avenging_angel', hover: 1 }), BASE_STATS)
        expect(result.hover).toBe(true)
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.avenging_angel(makeFeature({
            type: 'avenging_angel', effect: 'custom_angel', duration: '1_minute',
            action: 'action', flySpeed: 30, hover: true, auraRange: '30_ft',
            saveType: 'CON', saveDc: 15,
        }), BASE_STATS)
        expect(result).toMatchObject({
            effect: 'custom_angel', duration: '1_minute', action: 'action',
            flySpeed: 30, hover: true, auraRange: '30_ft', saveType: 'CON', saveDc: 15,
        })
    })
})

// ── holy_nimbus ──────────────────────────────────────────────────────

describe('tempHandlers – holy_nimbus', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.holy_nimbus(makeFeature({ type: 'holy_nimbus' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'holy_nimbus', name: 'Test Feature', hasAutomation: true,
            duration: '10_minutes', casting_time: '1_bonus_action', resourceCost: '',
        })
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.holy_nimbus(makeFeature({
            type: 'holy_nimbus', duration: '1_minute', casting_time: '1 bonus action',
            resourceCost: 'channel divinity',
        }), BASE_STATS)
        expect(result).toMatchObject({ duration: '1_minute', casting_time: '1 bonus action', resourceCost: 'channel divinity' })
    })
})

// ── cloak_of_shadows ─────────────────────────────────────────────────

describe('tempHandlers – cloak_of_shadows', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.cloak_of_shadows(makeFeature({ type: 'cloak_of_shadows' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'cloak_of_shadows', name: 'Test Feature', hasAutomation: true,
            effect: '', duration: '1_minute',
        })
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.cloak_of_shadows(makeFeature({
            type: 'cloak_of_shadows', effect: 'invisibility', duration: '1_round',
        }), BASE_STATS)
        expect(result).toMatchObject({ effect: 'invisibility', duration: '1_round' })
    })
})

// ── peerless_athlete ─────────────────────────────────────────────────

describe('tempHandlers – peerless_athlete', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.peerless_athlete(makeFeature({ type: 'peerless_athlete' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'peerless_athlete', name: 'Test Feature', hasAutomation: true,
            duration: '1_hour', casting_time: '1_bonus_action', resourceCost: 'channel_divinity',
        })
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.peerless_athlete(makeFeature({
            type: 'peerless_athlete', duration: '10_minutes', casting_time: '1 bonus action',
            resourceCost: 'sorcery points',
        }), BASE_STATS)
        expect(result).toMatchObject({ duration: '10_minutes', casting_time: '1 bonus action', resourceCost: 'sorcery points' })
    })
})

// ── dragon_wings ─────────────────────────────────────────────────────

describe('tempHandlers – dragon_wings', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.dragon_wings(makeFeature({ type: 'dragon_wings' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'dragon_wings', name: 'Test Feature', hasAutomation: true,
            action: 'bonus_action', duration: '1_hour', flySpeed: 60,
            hover: false, uses: 1, recharge: 'long_rest', resourceCost: '', restoreCost: 3,
        })
    })

    it('uses nullish coalescing for uses — 0 is preserved', () => {
        const result = tempHandlers.dragon_wings(makeFeature({ type: 'dragon_wings', uses: 0 }), BASE_STATS)
        expect(result.uses).toBe(0)
    })

    it('uses || for hover — non-boolean falsy values become false', () => {
        const result = tempHandlers.dragon_wings(makeFeature({ type: 'dragon_wings', hover: '' }), BASE_STATS)
        expect(result.hover).toBe(false)
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.dragon_wings(makeFeature({
            type: 'dragon_wings', action: 'action', duration: '10_minutes',
            flySpeed: 90, hover: true, uses: 2, recharge: 'short_rest',
            resourceCost: 'sorcery points', restoreCost: 5,
        }), BASE_STATS)
        expect(result).toMatchObject({
            action: 'action', duration: '10_minutes', flySpeed: 90,
            hover: true, uses: 2, recharge: 'short_rest',
            resourceCost: 'sorcery points', restoreCost: 5,
        })
    })
})

// ── revelation_in_flesh ──────────────────────────────────────────────

describe('tempHandlers – revelation_in_flesh', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.revelation_in_flesh(makeFeature({ type: 'revelation_in_flesh' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'revelation_in_flesh', name: 'Test Feature', hasAutomation: true,
            options: [], duration: '10_minutes', action: 'bonus_action', casting_time: '1 bonus action',
        })
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.revelation_in_flesh(makeFeature({
            type: 'revelation_in_flesh', options: [{ name: 'Option A' }],
            duration: '1_minute', action: 'action',
        }), BASE_STATS)
        expect(result).toMatchObject({ duration: '1_minute', action: 'action' })
    })
})

// ── living_legend ────────────────────────────────────────────────────

describe('tempHandlers – living_legend', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.living_legend(makeFeature({ type: 'living_legend' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'living_legend', name: 'Test Feature', hasAutomation: true,
            duration: '10_minutes', casting_time: '1 bonus action',
            unerringStrikeTrigger: 'attack_miss', unerringStrikeOncePerTurn: false,
            saveRerollTarget: 'saving_throw', charismaCheckAdvantage: false,
        })
    })

    it('coerces boolean fields with !!', () => {
        const result = tempHandlers.living_legend(makeFeature({
            type: 'living_legend', unerring_strike_once_per_turn: 1, charisma_check_advantage: 0,
        }), BASE_STATS)
        expect(result.unerringStrikeOncePerTurn).toBe(true)
        expect(result.charismaCheckAdvantage).toBe(false)
    })

    it('maps snake_case keys to camelCase output fields', () => {
        const result = tempHandlers.living_legend(makeFeature({
            type: 'living_legend', unerring_strike_trigger: 'spell_miss',
            unerring_strike_once_per_turn: true, save_reroll_target: 'ability_check',
            charisma_check_advantage: true,
        }), BASE_STATS)
        expect(result).toMatchObject({
            unerringStrikeTrigger: 'spell_miss', unerringStrikeOncePerTurn: true,
            saveRerollTarget: 'ability_check', charismaCheckAdvantage: true,
        })
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.living_legend(makeFeature({
            type: 'living_legend', duration: '1_minute', casting_time: '1 action',
        }), BASE_STATS)
        expect(result).toMatchObject({ duration: '1_minute', casting_time: '1 action' })
    })
})

// ── holy_aura ────────────────────────────────────────────────────────

describe('tempHandlers – holy_aura', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.holy_aura(makeFeature({ type: 'holy_aura' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'holy_aura', name: 'Test Feature', hasAutomation: true,
            duration: '1_minute', auraRange: 30, casting_time: '1 action',
        })
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.holy_aura(makeFeature({
            type: 'holy_aura', duration: '10_minutes', auraRange: 60, casting_time: '1 bonus action',
        }), BASE_STATS)
        expect(result).toMatchObject({ duration: '10_minutes', auraRange: 60, casting_time: '1 bonus action' })
    })
})

// ── elder_champion ───────────────────────────────────────────────────

describe('tempHandlers – elder_champion', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.elder_champion(makeFeature({ type: 'elder_champion' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'elder_champion', name: 'Test Feature', hasAutomation: true,
            duration: '1_minute', casting_time: '1 bonus action',
        })
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.elder_champion(makeFeature({
            type: 'elder_champion', duration: '10_minutes', casting_time: '1 action',
        }), BASE_STATS)
        expect(result).toMatchObject({ duration: '10_minutes', casting_time: '1 action' })
    })
})

// ── dark_ones_blessing ───────────────────────────────────────────────

describe('tempHandlers – dark_ones_blessing', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.dark_ones_blessing(makeFeature({ type: 'dark_ones_blessing' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'dark_ones_blessing', name: 'Test Feature', hasAutomation: true,
            tempHpExpression: '', range: '10_ft',
        })
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.dark_ones_blessing(makeFeature({
            type: 'dark_ones_blessing', tempHpExpression: '2d8', range: '15_ft',
        }), BASE_STATS)
        expect(result).toMatchObject({ tempHpExpression: '2d8', range: '15_ft' })
    })
})

// ── large_form ───────────────────────────────────────────────────────

describe('tempHandlers – large_form', () => {
    it('returns correct structure with defaults', () => {
        const result = tempHandlers.large_form(makeFeature({ type: 'large_form' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'large_form', name: 'Test Feature', hasAutomation: true,
            duration: '10_minutes', casting_time: '1_bonus_action', resourceCost: 'long_rest',
        })
    })

    it('passes through custom fields', () => {
        const result = tempHandlers.large_form(makeFeature({
            type: 'large_form', duration: '1_minute', casting_time: '1 action',
            resourceCost: 'wild shape',
        }), BASE_STATS)
        expect(result).toMatchObject({ duration: '1_minute', casting_time: '1 action', resourceCost: 'wild shape' })
    })
})
