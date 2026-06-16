import { describe, it, expect } from 'vitest'
import { tempHandlers } from './temp.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('tempHandlers – temp_buff', () => {
    it('returns temp_buff info with defaults', () => {
        const feature = makeFeature({ type: 'temp_buff' })
        const result = tempHandlers.temp_buff(feature, BASE_STATS)
        expect(result.type).toBe('temp_buff')
        expect(result.effect).toBe('')
        expect(result.duration).toBe('1_minute')
        expect(result.action).toBe('bonus_action')
        expect(result.recharge).toBe('long_rest')
        expect(result.distance).toBe('')
        expect(result.extendedDistance).toBe('')
        expect(result.oncePerRage).toBe(false)
        expect(result.bringAllies).toBe(false)
        expect(result.allyCount).toBe(0)
        expect(result.teleportRange).toBe('')
        expect(result.enemiesDisadvantageSaves).toEqual([])
        expect(result.triggerOnRage).toBe(false)
        expect(result.distanceExpression).toBe('')
        expect(result.casting_time).toBe('')
        expect(result.uses).toBeNull()
        expect(result.usesMax).toBeNull()
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves uses to proficiency_bonus when string is proficiency_bonus', () => {
        const feature = makeFeature({ type: 'temp_buff', uses: 'proficiency_bonus' })
        const result = tempHandlers.temp_buff(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })

    it('resolves uses to class name level when ends with _level and matches', () => {
        const feature = makeFeature({ type: 'temp_buff', uses: 'barbarian_level' })
        const result = tempHandlers.temp_buff(feature, BASE_STATS)
        expect(result.usesMax).toBe(5)
    })

    it('resolves uses to class.levels when _level but class name does not match', () => {
        const stats = { ...BASE_STATS, class: { name: 'Wizard' } }
        const feature = makeFeature({ type: 'temp_buff', uses: 'barbarian_level' })
        const result = tempHandlers.temp_buff(feature, stats)
        expect(result.usesMax).toBe(5) // BASE_STATS.level = 5
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
            triggerOnRage: true
        })
        const result = tempHandlers.temp_buff(feature, BASE_STATS)
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

describe('tempHandlers – temp_hp_buff', () => {
    it('returns temp_hp_buff info with defaults', () => {
        const feature = makeFeature({ type: 'temp_hp_buff' })
        const result = tempHandlers.temp_hp_buff(feature, BASE_STATS)
        expect(result.type).toBe('temp_hp_buff')
        expect(result.buffExpression).toBe('')
        expect(result.range).toBe('60_ft')
        expect(result.targets).toBe(1)
        expect(result.targetsExpression).toBe('')
        expect(result.bonusMovement).toBe(false)
        expect(result.extraEffect).toBeNull()
        expect(result.tempHpExpression).toBe('')
        expect(result.triggerOnRage).toBe(false)
        expect(result.ongoingHealingExpression).toBe('')
        expect(result.healingStartOfTurn).toBe(false)
        expect(result.healingRange).toBe('')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.includesSelf).toBe(false)
        expect(result.multiTargetAlly).toBe(false)
        expect(result.hasAutomation).toBe(true)
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
            multiTargetAlly: true
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

describe('tempHandlers – sacred_weapon', () => {
    it('returns temp_buff with sacred_weapon effect', () => {
        const feature = makeFeature({ type: 'sacred_weapon' })
        const result = tempHandlers.sacred_weapon(feature, BASE_STATS)
        expect(result.type).toBe('temp_buff')
        expect(result.effect).toBe('sacred_weapon')
        expect(result.duration).toBe('10_minutes')
        expect(result.resourceCost).toBe('')
        expect(result.options).toEqual([])
        expect(result.casting_time).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'sacred_weapon',
            duration: '1_minute',
            resourceCost: 'divine favor',
            options: [{ name: 'Option A' }]
        })
        const result = tempHandlers.sacred_weapon(feature, BASE_STATS)
        expect(result.duration).toBe('1_minute')
        expect(result.resourceCost).toBe('divine favor')
        expect(result.options).toEqual([{ name: 'Option A' }])
    })
})

describe('tempHandlers – avenging_angel', () => {
    it('returns temp_buff with avenging_angel effect', () => {
        const feature = makeFeature({ type: 'avenging_angel' })
        const result = tempHandlers.avenging_angel(feature, BASE_STATS)
        expect(result.type).toBe('temp_buff')
        expect(result.effect).toBe('avenging_angel')
        expect(result.duration).toBe('10_minutes')
        expect(result.action).toBe('bonus_action')
        expect(result.flySpeed).toBe(60)
        expect(result.hover).toBe(false)
        expect(result.auraRange).toBe('aura_of_protection')
        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe('ability')
        expect(result.hasAutomation).toBe(true)
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
            saveDc: 15
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

describe('tempHandlers – holy_nimbus', () => {
    it('returns holy_nimbus info with defaults', () => {
        const feature = makeFeature({ type: 'holy_nimbus' })
        const result = tempHandlers.holy_nimbus(feature, BASE_STATS)
        expect(result.type).toBe('holy_nimbus')
        expect(result.duration).toBe('10_minutes')
        expect(result.casting_time).toBe('1_bonus_action')
        expect(result.resourceCost).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'holy_nimbus',
            duration: '1_minute',
            casting_time: '1 bonus action',
            resourceCost: 'channel divinity'
        })
        const result = tempHandlers.holy_nimbus(feature, BASE_STATS)
        expect(result.duration).toBe('1_minute')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.resourceCost).toBe('channel divinity')
    })
})

describe('tempHandlers – cloak_of_shadows', () => {
    it('returns cloak_of_shadows info with defaults', () => {
        const feature = makeFeature({ type: 'cloak_of_shadows' })
        const result = tempHandlers.cloak_of_shadows(feature, BASE_STATS)
        expect(result.type).toBe('cloak_of_shadows')
        expect(result.effect).toBe('')
        expect(result.duration).toBe('1_minute')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'cloak_of_shadows',
            effect: 'invisibility',
            duration: '1_round'
        })
        const result = tempHandlers.cloak_of_shadows(feature, BASE_STATS)
        expect(result.effect).toBe('invisibility')
        expect(result.duration).toBe('1_round')
    })
})

describe('tempHandlers – peerless_athlete', () => {
    it('returns peerless_athlete info with defaults', () => {
        const feature = makeFeature({ type: 'peerless_athlete' })
        const result = tempHandlers.peerless_athlete(feature, BASE_STATS)
        expect(result.type).toBe('peerless_athlete')
        expect(result.duration).toBe('1_hour')
        expect(result.casting_time).toBe('1_bonus_action')
        expect(result.resourceCost).toBe('channel_divinity')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'peerless_athlete',
            duration: '10_minutes',
            casting_time: '1 bonus action',
            resourceCost: 'sorcery points'
        })
        const result = tempHandlers.peerless_athlete(feature, BASE_STATS)
        expect(result.duration).toBe('10_minutes')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.resourceCost).toBe('sorcery points')
    })
})

describe('tempHandlers – dragon_wings', () => {
    it('returns dragon_wings info with defaults', () => {
        const feature = makeFeature({ type: 'dragon_wings' })
        const result = tempHandlers.dragon_wings(feature, BASE_STATS)
        expect(result.type).toBe('dragon_wings')
        expect(result.action).toBe('bonus_action')
        expect(result.duration).toBe('1_hour')
        expect(result.flySpeed).toBe(60)
        expect(result.hover).toBe(false)
        expect(result.uses).toBe(1)
        expect(result.recharge).toBe('long_rest')
        expect(result.resourceCost).toBe('')
        expect(result.restoreCost).toBe(3)
        expect(result.hasAutomation).toBe(true)
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
            restoreCost: 5
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

describe('tempHandlers – revelation_in_flesh', () => {
    it('returns revelation_in_flesh info with defaults', () => {
        const feature = makeFeature({ type: 'revelation_in_flesh' })
        const result = tempHandlers.revelation_in_flesh(feature, BASE_STATS)
        expect(result.type).toBe('revelation_in_flesh')
        expect(result.options).toEqual([])
        expect(result.duration).toBe('10_minutes')
        expect(result.action).toBe('bonus_action')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'revelation_in_flesh',
            options: [{ name: 'Option A' }],
            duration: '1_minute',
            action: 'action'
        })
        const result = tempHandlers.revelation_in_flesh(feature, BASE_STATS)
        expect(result.options).toEqual([{ name: 'Option A' }])
        expect(result.duration).toBe('1_minute')
        expect(result.action).toBe('action')
    })
})

describe('tempHandlers – living_legend', () => {
    it('returns living_legend info with defaults', () => {
        const feature = makeFeature({ type: 'living_legend' })
        const result = tempHandlers.living_legend(feature, BASE_STATS)
        expect(result.type).toBe('living_legend')
        expect(result.duration).toBe('10_minutes')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.unerringStrikeTrigger).toBe('attack_miss')
        expect(result.unerringStrikeOncePerTurn).toBe(false)
        expect(result.saveRerollTarget).toBe('saving_throw')
        expect(result.charismaCheckAdvantage).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'living_legend',
            duration: '1_minute',
            casting_time: '1 action',
            unerring_strike_trigger: 'spell_miss',
            unerring_strike_once_per_turn: true,
            save_reroll_target: 'ability_check',
            charisma_check_advantage: true
        })
        const result = tempHandlers.living_legend(feature, BASE_STATS)
        expect(result.duration).toBe('1_minute')
        expect(result.casting_time).toBe('1 action')
        expect(result.unerringStrikeTrigger).toBe('spell_miss')
        expect(result.unerringStrikeOncePerTurn).toBe(true)
        expect(result.saveRerollTarget).toBe('ability_check')
        expect(result.charismaCheckAdvantage).toBe(true)
    })
})

describe('tempHandlers – holy_aura', () => {
    it('returns holy_aura info with defaults', () => {
        const feature = makeFeature({ type: 'holy_aura' })
        const result = tempHandlers.holy_aura(feature, BASE_STATS)
        expect(result.type).toBe('holy_aura')
        expect(result.duration).toBe('1_minute')
        expect(result.auraRange).toBe(30)
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'holy_aura',
            duration: '10_minutes',
            auraRange: 60,
            casting_time: '1 bonus action'
        })
        const result = tempHandlers.holy_aura(feature, BASE_STATS)
        expect(result.duration).toBe('10_minutes')
        expect(result.auraRange).toBe(60)
        expect(result.casting_time).toBe('1 bonus action')
    })
})

describe('tempHandlers – elder_champion', () => {
    it('returns elder_champion info with defaults', () => {
        const feature = makeFeature({ type: 'elder_champion' })
        const result = tempHandlers.elder_champion(feature, BASE_STATS)
        expect(result.type).toBe('elder_champion')
        expect(result.duration).toBe('1_minute')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'elder_champion',
            duration: '10_minutes',
            casting_time: '1 action'
        })
        const result = tempHandlers.elder_champion(feature, BASE_STATS)
        expect(result.duration).toBe('10_minutes')
        expect(result.casting_time).toBe('1 action')
    })
})

describe('tempHandlers – dark_ones_blessing', () => {
    it('returns dark_ones_blessing info with defaults', () => {
        const feature = makeFeature({ type: 'dark_ones_blessing' })
        const result = tempHandlers.dark_ones_blessing(feature, BASE_STATS)
        expect(result.type).toBe('dark_ones_blessing')
        expect(result.tempHpExpression).toBe('')
        expect(result.range).toBe('10_ft')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'dark_ones_blessing',
            tempHpExpression: '2d8',
            range: '15_ft'
        })
        const result = tempHandlers.dark_ones_blessing(feature, BASE_STATS)
        expect(result.tempHpExpression).toBe('2d8')
        expect(result.range).toBe('15_ft')
    })
})

describe('tempHandlers – large_form', () => {
    it('returns large_form info with defaults', () => {
        const feature = makeFeature({ type: 'large_form' })
        const result = tempHandlers.large_form(feature, BASE_STATS)
        expect(result.type).toBe('large_form')
        expect(result.duration).toBe('10_minutes')
        expect(result.casting_time).toBe('1_bonus_action')
        expect(result.resourceCost).toBe('long_rest')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'large_form',
            duration: '1_minute',
            casting_time: '1 action',
            resourceCost: 'wild shape'
        })
        const result = tempHandlers.large_form(feature, BASE_STATS)
        expect(result.duration).toBe('1_minute')
        expect(result.casting_time).toBe('1 action')
        expect(result.resourceCost).toBe('wild shape')
    })
})
