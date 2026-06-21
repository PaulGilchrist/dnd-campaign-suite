// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { psionicHandlers } from './psionic.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('psionicHandlers – psychic_spells', () => {
    it('returns psychic_spells info with defaults', () => {
        const feature = makeFeature({ type: 'psychic_spells' })
        const result = psionicHandlers.psychic_spells(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'psychic_spells',
            name: 'Test Feature',
            damageType: 'Psychic',
            componentReduction: [],
            spellSchools: [],
            hasAutomation: true,
        })
    })

    it('passes through custom damageType', () => {
        const feature = makeFeature({ type: 'psychic_spells', damageType: 'Force' })
        const result = psionicHandlers.psychic_spells(feature, BASE_STATS)
        expect(result.damageType).toBe('Force')
    })

    it('passes through custom componentReduction', () => {
        const feature = makeFeature({ type: 'psychic_spells', componentReduction: ['somatic', 'verbal'] })
        const result = psionicHandlers.psychic_spells(feature, BASE_STATS)
        expect(result.componentReduction).toEqual(['somatic', 'verbal'])
    })

    it('passes through custom spellSchools', () => {
        const feature = makeFeature({ type: 'psychic_spells', spellSchools: ['enchantment'] })
        const result = psionicHandlers.psychic_spells(feature, BASE_STATS)
        expect(result.spellSchools).toEqual(['enchantment'])
    })

    it('throws when automation is null', () => {
        const feature = { name: 'Test Feature', automation: null }
        expect(() => psionicHandlers.psychic_spells(feature, BASE_STATS)).toThrow(TypeError)
    })

    it('throws when automation is undefined', () => {
        const feature = { name: 'Test Feature' }
        expect(() => psionicHandlers.psychic_spells(feature, BASE_STATS)).toThrow(TypeError)
    })
})

describe('psionicHandlers – psionic_sorcery', () => {
    it('returns psionic_sorcery info with defaults', () => {
        const feature = makeFeature({ type: 'psionic_sorcery' })
        const result = psionicHandlers.psionic_sorcery(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'psionic_sorcery',
            name: 'Test Feature',
            psionicSpells: [],
            hasAutomation: true,
        })
    })

    it('passes through custom psionic_spells', () => {
        const feature = makeFeature({ type: 'psionic_sorcery', psionic_spells: ['psi blast', 'telekinetic grasp'] })
        const result = psionicHandlers.psionic_sorcery(feature, BASE_STATS)
        expect(result.psionicSpells).toEqual(['psi blast', 'telekinetic grasp'])
    })

    it('throws when automation is null', () => {
        const feature = { name: 'Test Feature', automation: null }
        expect(() => psionicHandlers.psionic_sorcery(feature, BASE_STATS)).toThrow(TypeError)
    })

    it('throws when automation is undefined', () => {
        const feature = { name: 'Test Feature' }
        expect(() => psionicHandlers.psionic_sorcery(feature, BASE_STATS)).toThrow(TypeError)
    })
})

describe('psionicHandlers – psionic_spells_list', () => {
    it('returns psionic_spells_list info with defaults', () => {
        const feature = makeFeature({ type: 'psionic_spells_list' })
        const result = psionicHandlers.psionic_spells_list(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'psionic_spells_list',
            name: 'Test Feature',
            psionicSpells: [],
            hasAutomation: true,
        })
    })

    it('passes through custom psionic_spells', () => {
        const feature = makeFeature({ type: 'psionic_spells_list', psionic_spells: ['mind sliver', 'detect thoughts'] })
        const result = psionicHandlers.psionic_spells_list(feature, BASE_STATS)
        expect(result.psionicSpells).toEqual(['mind sliver', 'detect thoughts'])
    })

    it('throws when automation is null', () => {
        const feature = { name: 'Test Feature', automation: null }
        expect(() => psionicHandlers.psionic_spells_list(feature, BASE_STATS)).toThrow(TypeError)
    })

    it('throws when automation is undefined', () => {
        const feature = { name: 'Test Feature' }
        expect(() => psionicHandlers.psionic_spells_list(feature, BASE_STATS)).toThrow(TypeError)
    })
})

describe('psionicHandlers – telekinetic_movement', () => {
    it('returns telekinetic_movement info with defaults', () => {
        const feature = makeFeature({ type: 'telekinetic_movement' })
        const result = psionicHandlers.telekinetic_movement(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'telekinetic_movement',
            name: 'Test Feature',
            range: '30_ft',
            hasAutomation: true,
        })
    })

    it('passes through custom range', () => {
        const feature = makeFeature({ type: 'telekinetic_movement', range: '60_ft' })
        const result = psionicHandlers.telekinetic_movement(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
    })

    it('throws when automation is null', () => {
        const feature = { name: 'Test Feature', automation: null }
        expect(() => psionicHandlers.telekinetic_movement(feature, BASE_STATS)).toThrow(TypeError)
    })

    it('throws when automation is undefined', () => {
        const feature = { name: 'Test Feature' }
        expect(() => psionicHandlers.telekinetic_movement(feature, BASE_STATS)).toThrow(TypeError)
    })
})

describe('psionicHandlers – telekinetic_leap', () => {
    it('returns telekinetic_leap info with defaults', () => {
        const feature = makeFeature({ type: 'telekinetic_leap' })
        const result = psionicHandlers.telekinetic_leap(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'telekinetic_leap',
            name: 'Test Feature',
            action: 'bonus_action',
            duration: 'until_end_of_turn',
            flySpeed: '2x_speed',
            hasAutomation: true,
        })
    })

    it('passes through custom action', () => {
        const feature = makeFeature({ type: 'telekinetic_leap', action: 'action' })
        const result = psionicHandlers.telekinetic_leap(feature, BASE_STATS)
        expect(result.action).toBe('action')
    })

    it('passes through custom duration', () => {
        const feature = makeFeature({ type: 'telekinetic_leap', duration: '1_round' })
        const result = psionicHandlers.telekinetic_leap(feature, BASE_STATS)
        expect(result.duration).toBe('1_round')
    })

    it('passes through custom flySpeed', () => {
        const feature = makeFeature({ type: 'telekinetic_leap', flySpeed: '1.5x_speed' })
        const result = psionicHandlers.telekinetic_leap(feature, BASE_STATS)
        expect(result.flySpeed).toBe('1.5x_speed')
    })

    it('throws when automation is null', () => {
        const feature = { name: 'Test Feature', automation: null }
        expect(() => psionicHandlers.telekinetic_leap(feature, BASE_STATS)).toThrow(TypeError)
    })

    it('throws when automation is undefined', () => {
        const feature = { name: 'Test Feature' }
        expect(() => psionicHandlers.telekinetic_leap(feature, BASE_STATS)).toThrow(TypeError)
    })
})

describe('psionicHandlers – telekinetic_thrust', () => {
    it('returns telekinetic_thrust info with defaults', () => {
        const feature = makeFeature({ type: 'telekinetic_thrust' })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'telekinetic_thrust',
            name: 'Test Feature',
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'INT',
            options: [],
            trigger: 'after_attack_hit',
            oncePerTurn: false,
            hasAutomation: true,
        })
    })

    it('passes through custom saveType', () => {
        const feature = makeFeature({ type: 'telekinetic_thrust', saveType: 'CON' })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
    })

    it('passes through explicit numeric saveDc', () => {
        const feature = makeFeature({ type: 'telekinetic_thrust', saveDc: 15 })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('passes through custom saveAbility', () => {
        const feature = makeFeature({ type: 'telekinetic_thrust', saveAbility: 'WIS' })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result.saveAbility).toBe('WIS')
    })

    it('passes through custom trigger', () => {
        const feature = makeFeature({ type: 'telekinetic_thrust', trigger: 'on_hit' })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result.trigger).toBe('on_hit')
    })

    it('coerces oncePerTurn truthy values to true', () => {
        const feature = makeFeature({ type: 'telekinetic_thrust', oncePerTurn: 1 })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
    })

    it('coerces oncePerTurn falsy values to false', () => {
        const feature = makeFeature({ type: 'telekinetic_thrust', oncePerTurn: 0 })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(false)
    })

    it('passes through custom options array', () => {
        const feature = makeFeature({ type: 'telekinetic_thrust', options: ['push 10ft', 'knock prone'] })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result.options).toEqual(['push 10ft', 'knock prone'])
    })

    it('throws when automation is null', () => {
        const feature = { name: 'Test Feature', automation: null }
        expect(() => psionicHandlers.telekinetic_thrust(feature, BASE_STATS)).toThrow(TypeError)
    })

    it('throws when automation is undefined', () => {
        const feature = { name: 'Test Feature' }
        expect(() => psionicHandlers.telekinetic_thrust(feature, BASE_STATS)).toThrow(TypeError)
    })
})
