import { describe, it, expect } from 'vitest'
import { elementalHandlers } from './elemental-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// ── fire_burn ────────────────────────────────────────────────────────

describe('elementalHandlers – fire_burn', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'fire_burn' })
        const result = elementalHandlers.fire_burn(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'fire_burn',
            damage: '1d10',
            damageType: 'Fire',
            trigger: 'hit',
            uses: null,
            recharge: 'long_rest',
            casting_time: '1 action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── frosts_chill ─────────────────────────────────────────────────────

describe('elementalHandlers – frosts_chill', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'frosts_chill' })
        const result = elementalHandlers.frosts_chill(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'frosts_chill',
            damage: '1d6',
            damageType: 'Cold',
            condition: 'speed_reduction',
            value: '10_ft',
            trigger: 'hit',
            uses: null,
            recharge: 'long_rest',
            casting_time: '1 action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── hills_tumble ─────────────────────────────────────────────────────

describe('elementalHandlers – hills_tumble', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'hills_tumble' })
        const result = elementalHandlers.hills_tumble(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'hills_tumble',
            trigger: 'melee_hit',
            effect: 'prone',
            uses: null,
            recharge: 'long_rest',
            casting_time: '1 action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── stones_endurance ─────────────────────────────────────────────────

describe('elementalHandlers – stones_endurance', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'stones_endurance' })
        const result = elementalHandlers.stones_endurance(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'stones_endurance',
            reductionExpression: '1d12 + CON modifier',
            trigger: 'damage_received',
            uses: null,
            recharge: 'long_rest',
            casting_time: '1 reaction',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── storms_thunder ───────────────────────────────────────────────────

describe('elementalHandlers – storms_thunder', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'storms_thunder' })
        const result = elementalHandlers.storms_thunder(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'storms_thunder',
            damage: '1d8',
            damageType: 'Thunder',
            range: '60_ft',
            trigger: 'damage_received_within_range',
            uses: null,
            recharge: 'long_rest',
            casting_time: '1 reaction',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})
