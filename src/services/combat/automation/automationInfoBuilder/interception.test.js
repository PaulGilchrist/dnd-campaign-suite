// @maintained-by-ai
// Interception builder lane. The partial-key defaults/name/passthrough/throw
// matrix lives in reaction.test.js (registerStandardTests('interception')) and
// the executor behavior lives in automation/handlers/interceptionHandler.*.test.js —
// cited, not re-pinned here. This file owns the EXACT full-envelope shape pins
// (toEqual catches added/dropped keys the sibling's property loop cannot) and the
// falsy-operator discriminators ('' fallbacks, !! coercion, proficiency || 0).
import { describe, it, expect } from 'vitest';
import { reactionHandlers } from './reaction.js';
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js';

describe('reactionHandlers.interception – envelope shape & operators', () => {
    // Synthetic stats distinct from BASE_STATS defaults (prof 2 ≠ 3) so pins
    // are not disk/default coincidences.
    const SYNTH_STATS = { ...BASE_STATS, proficiency: 2 }

    it('emits the exact default envelope (toEqual pins full key set, no extras/drops)', () => {
        const result = reactionHandlers.interception(
            makeFeature({ type: 'interception' }, 'Interception (synthetic)'),
            SYNTH_STATS
        )

        expect(result).toEqual({
            type: 'interception',
            name: 'Interception (synthetic)',
            trigger: 'ally_within_5ft_attacked',
            range: '5_ft',
            damageExpression: '1d10',
            damageType: '',
            damageBonusExpression: 'proficiency_bonus',
            damageBonus: 2,
            requiresShield: false,
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('emits the exact envelope for fully custom automation without evaluating expressions', () => {
        const result = reactionHandlers.interception(
            makeFeature({
                type: 'interception',
                trigger: 'ally_hit_by_melee',
                range: '10_ft',
                damageExpression: '2d8',
                damageType: 'Force',
                damageBonusExpression: 'strength_modifier',
                requiresShield: true,
                casting_time: '1 bonus reaction',
            }, 'Guarding Strike (synthetic)'),
            SYNTH_STATS
        )

        // damageBonus stays proficiency-based even though the expression says
        // strength_modifier — the builder labels, the executor evaluates.
        // STR bonus is 4, proficiency 2, so 2 ≠ 4 discriminates mis-wiring.
        expect(result).toEqual({
            type: 'interception',
            name: 'Guarding Strike (synthetic)',
            trigger: 'ally_hit_by_melee',
            range: '10_ft',
            damageExpression: '2d8',
            damageType: 'Force',
            damageBonusExpression: 'strength_modifier',
            damageBonus: 2,
            requiresShield: true,
            casting_time: '1 bonus reaction',
            hasAutomation: true,
        })
    })

    it('falls back to defaults only on falsy inputs (|| operators)', () => {
        const result = reactionHandlers.interception(
            makeFeature({
                type: 'interception',
                trigger: '',
                range: '',
                damageExpression: '',
                damageType: '',
                damageBonusExpression: '',
                casting_time: '',
            }),
            BASE_STATS
        )

        expect(result.trigger).toBe('ally_within_5ft_attacked')
        expect(result.range).toBe('5_ft')
        expect(result.damageExpression).toBe('1d10')
        expect(result.damageBonusExpression).toBe('proficiency_bonus')
        expect(result.casting_time).toBe('1 reaction')
        // damageType's fallback IS '' — an explicit '' stays ''
        expect(result.damageType).toBe('')
    })

    it('coerces requiresShield through !! to a strict boolean', () => {
        const shieldFor = (requiresShield) =>
            reactionHandlers.interception(
                makeFeature({ type: 'interception', requiresShield }),
                BASE_STATS
            ).requiresShield

        expect(shieldFor(0)).toBe(false)   // not 0 — pins !! not ??
        expect(shieldFor(1)).toBe(true)
        expect(shieldFor('yes')).toBe(true)
    })

    it('resolves damageBonus to 0 (not 1/undefined) when proficiency is missing', () => {
        const noProf = { ...BASE_STATS }
        delete noProf.proficiency
        expect(reactionHandlers.interception(makeFeature({ type: 'interception' }), noProf).damageBonus).toBe(0)
        expect(reactionHandlers.interception(makeFeature({ type: 'interception' }), { ...BASE_STATS, proficiency: 0 }).damageBonus).toBe(0)
    })
})
