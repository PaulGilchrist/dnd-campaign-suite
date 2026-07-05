// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { psionicHandlers } from './psionic.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── psychic_spells ───────────────────────────────────────────────────

describe('psionicHandlers – psychic_spells', () => {
    it('returns correct defaults', () => {
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

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'psychic_spells',
            damageType: 'Force',
            componentReduction: ['somatic', 'verbal'],
            spellSchools: ['enchantment'],
        })
        const result = psionicHandlers.psychic_spells(feature, BASE_STATS)
        expect(result.damageType).toBe('Force')
        expect(result.componentReduction).toEqual(['somatic', 'verbal'])
        expect(result.spellSchools).toEqual(['enchantment'])
    })

    it('throws when automation is null or undefined', () => {
        expect(() => psionicHandlers.psychic_spells({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => psionicHandlers.psychic_spells({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── psionic_sorcery ──────────────────────────────────────────────────

describe('psionicHandlers – psionic_sorcery', () => {
    it('returns correct defaults', () => {
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

    it('throws when automation is null or undefined', () => {
        expect(() => psionicHandlers.psionic_sorcery({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => psionicHandlers.psionic_sorcery({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── psionic_spells_list ──────────────────────────────────────────────

describe('psionicHandlers – psionic_spells_list', () => {
    it('returns correct defaults', () => {
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

    it('throws when automation is null or undefined', () => {
        expect(() => psionicHandlers.psionic_spells_list({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => psionicHandlers.psionic_spells_list({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── telekinetic_movement ─────────────────────────────────────────────

describe('psionicHandlers – telekinetic_movement', () => {
    it('returns correct defaults', () => {
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

    it('throws when automation is null or undefined', () => {
        expect(() => psionicHandlers.telekinetic_movement({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => psionicHandlers.telekinetic_movement({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── telekinetic_leap ─────────────────────────────────────────────────

describe('psionicHandlers – telekinetic_leap', () => {
    it('returns correct defaults', () => {
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

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'telekinetic_leap',
            action: 'action',
            duration: '1_round',
            flySpeed: '1.5x_speed',
        })
        const result = psionicHandlers.telekinetic_leap(feature, BASE_STATS)
        expect(result.action).toBe('action')
        expect(result.duration).toBe('1_round')
        expect(result.flySpeed).toBe('1.5x_speed')
    })

    it('throws when automation is null or undefined', () => {
        expect(() => psionicHandlers.telekinetic_leap({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => psionicHandlers.telekinetic_leap({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── telekinetic_thrust ───────────────────────────────────────────────

describe('psionicHandlers – telekinetic_thrust', () => {
    it('returns correct defaults', () => {
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

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'telekinetic_thrust',
            saveType: 'CON',
            saveDc: 15,
            saveAbility: 'WIS',
            trigger: 'on_hit',
            options: ['push 10ft', 'knock prone'],
        })
        const result = psionicHandlers.telekinetic_thrust(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('WIS')
        expect(result.trigger).toBe('on_hit')
        expect(result.options).toEqual(['push 10ft', 'knock prone'])
    })

    it('coerces oncePerTurn truthy/falsy values', () => {
        expect(psionicHandlers.telekinetic_thrust(makeFeature({ type: 'telekinetic_thrust', oncePerTurn: 1 }), BASE_STATS).oncePerTurn).toBe(true)
        expect(psionicHandlers.telekinetic_thrust(makeFeature({ type: 'telekinetic_thrust', oncePerTurn: 0 }), BASE_STATS).oncePerTurn).toBe(false)
    })

    it('throws when automation is null or undefined', () => {
        expect(() => psionicHandlers.telekinetic_thrust({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => psionicHandlers.telekinetic_thrust({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})
