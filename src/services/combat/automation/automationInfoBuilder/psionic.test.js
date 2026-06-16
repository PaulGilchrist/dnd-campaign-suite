import { describe, it, expect } from 'vitest'
import { psionicHandlers } from './psionic.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('psionicHandlers – psychic_spells', () => {
    it('returns psychic_spells info with defaults', () => {
        const feature = makeFeature({ type: 'psychic_spells' })
        const result = psionicHandlers.psychic_spells(feature, BASE_STATS)
        expect(result.type).toBe('psychic_spells')
        expect(result.damageType).toBe('Psychic')
        expect(result.componentReduction).toEqual([])
        expect(result.spellSchools).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'psychic_spells',
            damageType: 'Force',
            componentReduction: ['somatic', 'verbal'],
            spellSchools: ['enchantment']
        })
        const result = psionicHandlers.psychic_spells(feature, BASE_STATS)
        expect(result.damageType).toBe('Force')
        expect(result.componentReduction).toEqual(['somatic', 'verbal'])
        expect(result.spellSchools).toEqual(['enchantment'])
    })
})

describe('psionicHandlers – psionic_sorcery', () => {
    it('returns psionic_sorcery info with defaults', () => {
        const feature = makeFeature({ type: 'psionic_sorcery' })
        const result = psionicHandlers.psionic_sorcery(feature, BASE_STATS)
        expect(result.type).toBe('psionic_sorcery')
        expect(result.psionicSpells).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'psionic_sorcery',
            psionic_spells: ['psi blast', 'telekinetic grasp']
        })
        const result = psionicHandlers.psionic_sorcery(feature, BASE_STATS)
        expect(result.psionicSpells).toEqual(['psi blast', 'telekinetic grasp'])
    })
})

describe('psionicHandlers – psionic_spells_list', () => {
    it('returns psionic_spells_list info with defaults', () => {
        const feature = makeFeature({ type: 'psionic_spells_list' })
        const result = psionicHandlers.psionic_spells_list(feature, BASE_STATS)
        expect(result.type).toBe('psionic_spells_list')
        expect(result.psionicSpells).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'psionic_spells_list',
            psionic_spells: ['mind sliver', 'detect thoughts']
        })
        const result = psionicHandlers.psionic_spells_list(feature, BASE_STATS)
        expect(result.psionicSpells).toEqual(['mind sliver', 'detect thoughts'])
    })
})

describe('psionicHandlers – telekinetic_movement', () => {
    it('returns telekinetic_movement info with defaults', () => {
        const feature = makeFeature({ type: 'telekinetic_movement' })
        const result = psionicHandlers.telekinetic_movement(feature, BASE_STATS)
        expect(result.type).toBe('telekinetic_movement')
        expect(result.range).toBe('30_ft')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'telekinetic_movement',
            range: '60_ft'
        })
        const result = psionicHandlers.telekinetic_movement(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
    })
})

describe('psionicHandlers – telekinetic_leap', () => {
    it('returns telekinetic_leap info with defaults', () => {
        const feature = makeFeature({ type: 'telekinetic_leap' })
        const result = psionicHandlers.telekinetic_leap(feature, BASE_STATS)
        expect(result.type).toBe('telekinetic_leap')
        expect(result.action).toBe('bonus_action')
        expect(result.duration).toBe('until_end_of_turn')
        expect(result.flySpeed).toBe('2x_speed')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'telekinetic_leap',
            action: 'action',
            duration: '1_round',
            flySpeed: '1.5x_speed'
        })
        const result = psionicHandlers.telekinetic_leap(feature, BASE_STATS)
        expect(result.action).toBe('action')
        expect(result.duration).toBe('1_round')
        expect(result.flySpeed).toBe('1.5x_speed')
    })
})

describe('psionicHandlers – telekinetic_thrust', () => {
    it('returns telekinetic_thrust info with defaults', () => {
        const feature = makeFeature({ type: 'telekinetic_thrust' })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result.type).toBe('telekinetic_thrust')
        expect(result.saveType).toBe('STR')
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('INT')
        expect(result.options).toEqual([])
        expect(result.trigger).toBe('after_attack_hit')
        expect(result.oncePerTurn).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'telekinetic_thrust',
            saveType: 'CON',
            saveDc: 15,
            saveAbility: 'WIS',
            trigger: 'on_hit',
            oncePerTurn: true
        })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('WIS')
        expect(result.trigger).toBe('on_hit')
        expect(result.oncePerTurn).toBe(true)
    })
})
