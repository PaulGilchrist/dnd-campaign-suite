import { describe, it, expect } from 'vitest'
import { coreHandlers } from './core-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// ── defensive_tactics ────────────────────────────────────────────────

describe('coreHandlers – defensive_tactics', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'defensive_tactics' })
        const result = coreHandlers.defensive_tactics(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'defensive_tactics',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── superior_hunter_prey ─────────────────────────────────────────────

describe('coreHandlers – superior_hunter_prey', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'superior_hunter_prey' })
        const result = coreHandlers.superior_hunter_prey(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'superior_hunter_prey',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── shadow_step_rider ────────────────────────────────────────────────

describe('coreHandlers – shadow_step_rider', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'shadow_step_rider' })
        const result = coreHandlers.shadow_step_rider(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'shadow_step_rider',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── moonlight_step_rider ─────────────────────────────────────────────

describe('coreHandlers – moonlight_step_rider', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'moonlight_step_rider' })
        const result = coreHandlers.moonlight_step_rider(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'moonlight_step_rider',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── illusory_reality ─────────────────────────────────────────────────

describe('coreHandlers – illusory_reality', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'illusory_reality' })
        const result = coreHandlers.illusory_reality(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'illusory_reality',
            effect: 'illusory_reality',
            casting_time: '1 bonus action',
            objectDuration: '1 minute',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── memorize_spell ───────────────────────────────────────────────────

describe('coreHandlers – memorize_spell', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'memorize_spell' })
        const result = coreHandlers.memorize_spell(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'memorize_spell',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── protection_from_poison ───────────────────────────────────────────

describe('coreHandlers – protection_from_poison', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'protection_from_poison' })
        const result = coreHandlers.protection_from_poison(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'protection_from_poison',
            range: 'Touch',
            duration: '1 hour',
            casting_time: '1 action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── remove_curse ─────────────────────────────────────────────────────

describe('coreHandlers – remove_curse', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'remove_curse' })
        const result = coreHandlers.remove_curse(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'remove_curse',
            range: 'Touch',
            casting_time: '1 action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── spare_the_dying ──────────────────────────────────────────────────

describe('coreHandlers – spare_the_dying', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'spare_the_dying' })
        const result = coreHandlers.spare_the_dying(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'spare_the_dying',
            range: '15 feet',
            casting_time: 'action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})
