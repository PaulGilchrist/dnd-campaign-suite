// @improved-by-ai

import { describe, it, expect } from 'vitest'
import { tempHandlers } from './temp.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── temp_buff ────────────────────────────────────────────────────────

describe('tempHandlers – temp_buff', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'temp_buff' })
        const result = tempHandlers.temp_buff(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'temp_buff',
            name: 'Test Feature',
            effect: '',
            duration: '1_minute',
            action: 'bonus_action',
            recharge: 'long_rest',
            distance: '',
            extendedDistance: '',
            oncePerRage: false,
            bringAllies: false,
            allyCount: 0,
            teleportRange: '',
            enemiesDisadvantageSaves: [],
            triggerOnRage: false,
            distanceExpression: '',
            casting_time: '',
            uses: null,
            usesMax: null,
            hasAutomation: true,
        })
    })

    it('resolves uses to proficiency_bonus when string is proficiency_bonus', () => {
        const feature = makeFeature({ type: 'temp_buff', uses: 'proficiency_bonus' })
        const result = tempHandlers.temp_buff(feature, BASE_STATS)

        expect(result.uses).toBe('proficiency_bonus')
        expect(result.usesMax).toBe(3)
    })

    it('resolves uses to class.level when uses ends with _level and class name matches', () => {
        const stats = { ...BASE_STATS, class: { name: 'barbarian' } }
        const feature = makeFeature({ type: 'temp_buff', uses: 'barbarian_level' })
        const result = tempHandlers.temp_buff(feature, stats)

        expect(result.uses).toBe('barbarian_level')
        expect(result.usesMax).toBe(5)
    })

    it('resolves uses to class.levels fallback when class name does not match', () => {
        const stats = { ...BASE_STATS, class: { name: 'Wizard' } }
        const feature = makeFeature({ type: 'temp_buff', uses: 'barbarian_level' })
        const result = tempHandlers.temp_buff(feature, stats)

        expect(result.usesMax).toBe(5)
    })

    it('resolves uses to class.levels when class has levels property and name does not match', () => {
        const stats = { ...BASE_STATS, class: { name: 'Wizard', levels: 10 } }
        const feature = makeFeature({ type: 'temp_buff', uses: 'barbarian_level' })
        const result = tempHandlers.temp_buff(feature, stats)

        expect(result.usesMax).toBe(10)
    })

    it('coerces boolean fields with !!', () => {
        const feature = makeFeature({
            type: 'temp_buff',
            oncePerRage: 1,
            bringAllies: 'yes',
            triggerOnRage: 0,
        })
        const result = tempHandlers.temp_buff(feature, BASE_STATS)

        expect(result.oncePerRage).toBe(true)
        expect(result.bringAllies).toBe(true)
        expect(result.triggerOnRage).toBe(false)
    })

    it('coerces allyCount to 0 for falsy values', () => {
        const feature = makeFeature({ type: 'temp_buff', allyCount: 0 })
        const result = tempHandlers.temp_buff(feature, BASE_STATS)

        expect(result.allyCount).toBe(0)
    })

    it('passes through enemies_disadvantage_saves snake_case key', () => {
        const feature = makeFeature({
            type: 'temp_buff',
            enemies_disadvantage_saves: ['goblins', 'undead'],
        })
        const result = tempHandlers.temp_buff(feature, BASE_STATS)

        expect(result.enemiesDisadvantageSaves).toEqual(['goblins', 'undead'])
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'temp_buff',
            effect: 'haste',
            duration: '10_minutes',
            action: 'action',
            recharge: 'short_rest',
            distance: '30 ft',
            extendedDistance: '60 ft',
            oncePerRage: true,
            bringAllies: true,
            allyCount: 3,
            teleportRange: '30 ft',
            triggerOnRage: true,
        })
        const result = tempHandlers.temp_buff(feature, BASE_STATS)

        expect(result.type).toBe('temp_buff')
        expect(result.effect).toBe('haste')
        expect(result.duration).toBe('10_minutes')
        expect(result.action).toBe('action')
        expect(result.recharge).toBe('short_rest')
        expect(result.distance).toBe('30 ft')
        expect(result.extendedDistance).toBe('60 ft')
        expect(result.oncePerRage).toBe(true)
        expect(result.bringAllies).toBe(true)
        expect(result.allyCount).toBe(3)
        expect(result.teleportRange).toBe('30 ft')
        expect(result.triggerOnRage).toBe(true)
    })
})

// ── temp_hp_buff ─────────────────────────────────────────────────────

describe('tempHandlers – temp_hp_buff', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'temp_hp_buff' })
        const result = tempHandlers.temp_hp_buff(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'temp_hp_buff',
            name: 'Test Feature',
            buffExpression: '',
            range: '60_ft',
            targets: 1,
            targetsExpression: '',
            bonusMovement: false,
            extraEffect: null,
            tempHpExpression: '',
            triggerOnRage: false,
            ongoingHealingExpression: '',
            healingStartOfTurn: false,
            healingRange: '',
            casting_time: '1 bonus action',
            includesSelf: false,
            multiTargetAlly: false,
            hasAutomation: true,
        })
    })

    it('coerces boolean fields with !!', () => {
        const feature = makeFeature({
            type: 'temp_hp_buff',
            bonusMovement: 'yes',
            trigger_on_rage: 1,
            healingStartOfTurn: 0,
            includesSelf: '',
        })
        const result = tempHandlers.temp_hp_buff(feature, BASE_STATS)

        expect(result.bonusMovement).toBe(true)
        expect(result.triggerOnRage).toBe(true)
        expect(result.healingStartOfTurn).toBe(false)
        expect(result.includesSelf).toBe(false)
    })

    it('coerces extraEffect to null for falsy values', () => {
        const feature = makeFeature({ type: 'temp_hp_buff', extraEffect: '' })
        const result = tempHandlers.temp_hp_buff(feature, BASE_STATS)

        expect(result.extraEffect).toBeNull()
    })

    it('maps trigger_on_rage snake_case to triggerOnRage camelCase', () => {
        const feature = makeFeature({ type: 'temp_hp_buff', trigger_on_rage: true })
        const result = tempHandlers.temp_hp_buff(feature, BASE_STATS)

        expect(result.triggerOnRage).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'temp_hp_buff',
            buffExpression: '2d8',
            range: '30_ft',
            targets: 5,
            targetsExpression: '3 + level',
            bonusMovement: true,
            extraEffect: 'speed_boost',
            tempHpExpression: '1d10',
            trigger_on_rage: true,
            ongoingHealingExpression: '1d6',
            healingStartOfTurn: true,
            healingRange: '10_ft',
            includesSelf: true,
            multiTargetAlly: true,
        })
        const result = tempHandlers.temp_hp_buff(feature, BASE_STATS)

        expect(result.buffExpression).toBe('2d8')
        expect(result.range).toBe('30_ft')
        expect(result.targets).toBe(5)
        expect(result.targetsExpression).toBe('3 + level')
        expect(result.bonusMovement).toBe(true)
        expect(result.extraEffect).toBe('speed_boost')
        expect(result.tempHpExpression).toBe('1d10')
        expect(result.triggerOnRage).toBe(true)
        expect(result.ongoingHealingExpression).toBe('1d6')
        expect(result.healingStartOfTurn).toBe(true)
        expect(result.healingRange).toBe('10_ft')
        expect(result.includesSelf).toBe(true)
        expect(result.multiTargetAlly).toBe(true)
    })
})

// ── sacred_weapon ────────────────────────────────────────────────────

describe('tempHandlers – sacred_weapon', () => {
    it('returns correct defaults with type temp_buff and effect sacred_weapon', () => {
        const feature = makeFeature({ type: 'sacred_weapon' })
        const result = tempHandlers.sacred_weapon(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'temp_buff',
            name: 'Test Feature',
            effect: 'sacred_weapon',
            duration: '10_minutes',
            resourceCost: '',
            options: [],
            casting_time: '',
            hasAutomation: true,
        })
    })

    it('does not mutate the options array from the feature', () => {
        const options = [{ name: 'Option A' }]
        const feature = makeFeature({ type: 'sacred_weapon', options })
        const result = tempHandlers.sacred_weapon(feature, BASE_STATS)

        expect(result.options).toBe(options)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'sacred_weapon',
            duration: '1_minute',
            resourceCost: 'divine favor',
            options: [{ name: 'Option A' }],
        })
        const result = tempHandlers.sacred_weapon(feature, BASE_STATS)

        expect(result.duration).toBe('1_minute')
        expect(result.resourceCost).toBe('divine favor')
        expect(result.options).toEqual([{ name: 'Option A' }])
    })
})

// ── avenging_angel ───────────────────────────────────────────────────

describe('tempHandlers – avenging_angel', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'avenging_angel' })
        const result = tempHandlers.avenging_angel(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'temp_buff',
            name: 'Test Feature',
            effect: 'avenging_angel',
            duration: '10_minutes',
            action: 'bonus_action',
            flySpeed: 60,
            hover: false,
            auraRange: 'aura_of_protection',
            saveType: 'WIS',
            saveDc: 'ability',
            hasAutomation: true,
        })
    })

    it('coerces hover with !!', () => {
        const feature = makeFeature({ type: 'avenging_angel', hover: 1 })
        const result = tempHandlers.avenging_angel(feature, BASE_STATS)

        expect(result.hover).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'avenging_angel',
            effect: 'custom_angel',
            duration: '1_minute',
            action: 'action',
            flySpeed: 30,
            hover: true,
            auraRange: '30_ft',
            saveType: 'CON',
            saveDc: 15,
        })
        const result = tempHandlers.avenging_angel(feature, BASE_STATS)

        expect(result.effect).toBe('custom_angel')
        expect(result.duration).toBe('1_minute')
        expect(result.action).toBe('action')
        expect(result.flySpeed).toBe(30)
        expect(result.hover).toBe(true)
        expect(result.auraRange).toBe('30_ft')
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
    })
})

// ── holy_nimbus ──────────────────────────────────────────────────────

describe('tempHandlers – holy_nimbus', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'holy_nimbus' })
        const result = tempHandlers.holy_nimbus(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'holy_nimbus',
            name: 'Test Feature',
            duration: '10_minutes',
            casting_time: '1_bonus_action',
            resourceCost: '',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'holy_nimbus',
            duration: '1_minute',
            casting_time: '1 bonus action',
            resourceCost: 'channel divinity',
        })
        const result = tempHandlers.holy_nimbus(feature, BASE_STATS)

        expect(result.duration).toBe('1_minute')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.resourceCost).toBe('channel divinity')
    })
})

// ── cloak_of_shadows ─────────────────────────────────────────────────

describe('tempHandlers – cloak_of_shadows', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'cloak_of_shadows' })
        const result = tempHandlers.cloak_of_shadows(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'cloak_of_shadows',
            name: 'Test Feature',
            effect: '',
            duration: '1_minute',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'cloak_of_shadows',
            effect: 'invisibility',
            duration: '1_round',
        })
        const result = tempHandlers.cloak_of_shadows(feature, BASE_STATS)

        expect(result.effect).toBe('invisibility')
        expect(result.duration).toBe('1_round')
    })
})

// ── peerless_athlete ─────────────────────────────────────────────────

describe('tempHandlers – peerless_athlete', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'peerless_athlete' })
        const result = tempHandlers.peerless_athlete(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'peerless_athlete',
            name: 'Test Feature',
            duration: '1_hour',
            casting_time: '1_bonus_action',
            resourceCost: 'channel_divinity',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'peerless_athlete',
            duration: '10_minutes',
            casting_time: '1 bonus action',
            resourceCost: 'sorcery points',
        })
        const result = tempHandlers.peerless_athlete(feature, BASE_STATS)

        expect(result.duration).toBe('10_minutes')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.resourceCost).toBe('sorcery points')
    })
})

// ── dragon_wings ─────────────────────────────────────────────────────

describe('tempHandlers – dragon_wings', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'dragon_wings' })
        const result = tempHandlers.dragon_wings(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'dragon_wings',
            name: 'Test Feature',
            action: 'bonus_action',
            duration: '1_hour',
            flySpeed: 60,
            hover: false,
            uses: 1,
            recharge: 'long_rest',
            resourceCost: '',
            restoreCost: 3,
            hasAutomation: true,
        })
    })

    it('uses nullish coalescing for uses — 0 is preserved', () => {
        const feature = makeFeature({ type: 'dragon_wings', uses: 0 })
        const result = tempHandlers.dragon_wings(feature, BASE_STATS)

        expect(result.uses).toBe(0)
    })

    it('uses || for hover — non-boolean falsy values become false', () => {
        const feature = makeFeature({ type: 'dragon_wings', hover: '' })
        const result = tempHandlers.dragon_wings(feature, BASE_STATS)

        expect(result.hover).toBe(false)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'dragon_wings',
            action: 'action',
            duration: '10_minutes',
            flySpeed: 90,
            hover: true,
            uses: 2,
            recharge: 'short_rest',
            resourceCost: 'sorcery points',
            restoreCost: 5,
        })
        const result = tempHandlers.dragon_wings(feature, BASE_STATS)

        expect(result.action).toBe('action')
        expect(result.duration).toBe('10_minutes')
        expect(result.flySpeed).toBe(90)
        expect(result.hover).toBe(true)
        expect(result.uses).toBe(2)
        expect(result.recharge).toBe('short_rest')
        expect(result.resourceCost).toBe('sorcery points')
        expect(result.restoreCost).toBe(5)
    })
})

// ── revelation_in_flesh ──────────────────────────────────────────────

describe('tempHandlers – revelation_in_flesh', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'revelation_in_flesh' })
        const result = tempHandlers.revelation_in_flesh(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'revelation_in_flesh',
            name: 'Test Feature',
            options: [],
            duration: '10_minutes',
            action: 'bonus_action',
            casting_time: '1 bonus action',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'revelation_in_flesh',
            options: [{ name: 'Option A' }],
            duration: '1_minute',
            action: 'action',
        })
        const result = tempHandlers.revelation_in_flesh(feature, BASE_STATS)

        expect(result.options).toEqual([{ name: 'Option A' }])
        expect(result.duration).toBe('1_minute')
        expect(result.action).toBe('action')
    })
})

// ── living_legend ────────────────────────────────────────────────────

describe('tempHandlers – living_legend', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'living_legend' })
        const result = tempHandlers.living_legend(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'living_legend',
            name: 'Test Feature',
            duration: '10_minutes',
            casting_time: '1 bonus action',
            unerringStrikeTrigger: 'attack_miss',
            unerringStrikeOncePerTurn: false,
            saveRerollTarget: 'saving_throw',
            charismaCheckAdvantage: false,
            hasAutomation: true,
        })
    })

    it('coerces boolean fields with !!', () => {
        const feature = makeFeature({
            type: 'living_legend',
            unerring_strike_once_per_turn: 1,
            charisma_check_advantage: 0,
        })
        const result = tempHandlers.living_legend(feature, BASE_STATS)

        expect(result.unerringStrikeOncePerTurn).toBe(true)
        expect(result.charismaCheckAdvantage).toBe(false)
    })

    it('maps snake_case keys to camelCase output fields', () => {
        const feature = makeFeature({
            type: 'living_legend',
            unerring_strike_trigger: 'spell_miss',
            unerring_strike_once_per_turn: true,
            save_reroll_target: 'ability_check',
            charisma_check_advantage: true,
        })
        const result = tempHandlers.living_legend(feature, BASE_STATS)

        expect(result.unerringStrikeTrigger).toBe('spell_miss')
        expect(result.unerringStrikeOncePerTurn).toBe(true)
        expect(result.saveRerollTarget).toBe('ability_check')
        expect(result.charismaCheckAdvantage).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'living_legend',
            duration: '1_minute',
            casting_time: '1 action',
        })
        const result = tempHandlers.living_legend(feature, BASE_STATS)

        expect(result.duration).toBe('1_minute')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── holy_aura ────────────────────────────────────────────────────────

describe('tempHandlers – holy_aura', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'holy_aura' })
        const result = tempHandlers.holy_aura(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'holy_aura',
            name: 'Test Feature',
            duration: '1_minute',
            auraRange: 30,
            casting_time: '1 action',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'holy_aura',
            duration: '10_minutes',
            auraRange: 60,
            casting_time: '1 bonus action',
        })
        const result = tempHandlers.holy_aura(feature, BASE_STATS)

        expect(result.duration).toBe('10_minutes')
        expect(result.auraRange).toBe(60)
        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── elder_champion ───────────────────────────────────────────────────

describe('tempHandlers – elder_champion', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'elder_champion' })
        const result = tempHandlers.elder_champion(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'elder_champion',
            name: 'Test Feature',
            duration: '1_minute',
            casting_time: '1 bonus action',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'elder_champion',
            duration: '10_minutes',
            casting_time: '1 action',
        })
        const result = tempHandlers.elder_champion(feature, BASE_STATS)

        expect(result.duration).toBe('10_minutes')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── dark_ones_blessing ───────────────────────────────────────────────

describe('tempHandlers – dark_ones_blessing', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'dark_ones_blessing' })
        const result = tempHandlers.dark_ones_blessing(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'dark_ones_blessing',
            name: 'Test Feature',
            tempHpExpression: '',
            range: '10_ft',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'dark_ones_blessing',
            tempHpExpression: '2d8',
            range: '15_ft',
        })
        const result = tempHandlers.dark_ones_blessing(feature, BASE_STATS)

        expect(result.tempHpExpression).toBe('2d8')
        expect(result.range).toBe('15_ft')
    })
})

// ── large_form ───────────────────────────────────────────────────────

describe('tempHandlers – large_form', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'large_form' })
        const result = tempHandlers.large_form(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'large_form',
            name: 'Test Feature',
            duration: '10_minutes',
            casting_time: '1_bonus_action',
            resourceCost: 'long_rest',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'large_form',
            duration: '1_minute',
            casting_time: '1 action',
            resourceCost: 'wild shape',
        })
        const result = tempHandlers.large_form(feature, BASE_STATS)

        expect(result.duration).toBe('1_minute')
        expect(result.casting_time).toBe('1 action')
        expect(result.resourceCost).toBe('wild shape')
    })
})
