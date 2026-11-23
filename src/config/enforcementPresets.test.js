/**
 * Deferred plan A — preset definitions: flag-map completeness, the derived
 * matchPreset identity (including the all-off ⇒ Custom law), and the
 * consequence-copy derivation. The component test covers the write lane.
 */
import { describe, it, expect } from 'vitest';
import { ENFORCEMENT_DEFAULTS } from '../services/combat/canTakeAction.js';
import {
    ENFORCEMENT_SUB_FLAGS,
    ENFORCEMENT_PRESETS,
    CUSTOM_PRESET,
    matchPreset,
    describeConsequences,
} from './enforcementPresets.js';

const flagsFor = (preset) => ({ ...ENFORCEMENT_DEFAULTS, mode: 'on', ...preset.flagMap });

describe('enforcementPresets (plan A)', () => {
    it('lists the ten sub-flags, mode excluded, matching ENFORCEMENT_DEFAULTS', () => {
        expect(ENFORCEMENT_SUB_FLAGS).toHaveLength(10);
        expect(ENFORCEMENT_SUB_FLAGS).not.toContain('mode');
        ENFORCEMENT_SUB_FLAGS.forEach(k => expect(ENFORCEMENT_DEFAULTS).toHaveProperty(k, false));
    });

    it('every preset defines a complete boolean map over exactly the sub-flags', () => {
        ENFORCEMENT_PRESETS.forEach(p => {
            expect(Object.keys(p.flagMap).sort()).toEqual([...ENFORCEMENT_SUB_FLAGS].sort());
            Object.values(p.flagMap).forEach(v => expect(typeof v).toBe('boolean'));
        });
    });

    it('Gentle is the bookkeeping trio only', () => {
        const gentle = ENFORCEMENT_PRESETS.find(p => p.id === 'gentle').flagMap;
        expect(Object.keys(gentle).filter(k => gentle[k])).toEqual(['turnLock', 'actionEconomy', 'movementBudget']);
    });

    it('Standard is everything except serverDice; Strict is everything', () => {
        const standard = ENFORCEMENT_PRESETS.find(p => p.id === 'standard').flagMap;
        const strict = ENFORCEMENT_PRESETS.find(p => p.id === 'strict').flagMap;
        ENFORCEMENT_SUB_FLAGS.forEach(k => {
            expect(standard[k], k).toBe(k !== 'serverDice');
            expect(strict[k], k).toBe(true);
        });
    });

    it('matchPreset identifies each preset and falls back to Custom', () => {
        ENFORCEMENT_PRESETS.forEach(p => expect(matchPreset(flagsFor(p)).id).toBe(p.id));
        // All-off (the default blob) is NOT a preset — it's Custom.
        expect(matchPreset({ ...ENFORCEMENT_DEFAULTS }).id).toBe(CUSTOM_PRESET.id);
        // One checkbox off from Standard ⇒ Custom (the auto-adopt law).
        const offOne = flagsFor(ENFORCEMENT_PRESETS.find(p => p.id === 'standard'));
        offOne.zones = false;
        expect(matchPreset(offOne).id).toBe(CUSTOM_PRESET.id);
        // mode is never consulted — the chip tracks the flags alone.
        expect(matchPreset({ ...ENFORCEMENT_PRESETS[0].flagMap, mode: 'off' }).id).toBe('gentle');
    });

    it('describeConsequences splits will/willNot from the flags only', () => {
        const gentle = describeConsequences(flagsFor(ENFORCEMENT_PRESETS.find(p => p.id === 'gentle')));
        expect(gentle.will).toHaveLength(3);
        expect(gentle.will[0]).toBe('refuse off-turn actions');
        expect(gentle.willNot).toHaveLength(7);
        expect(gentle.willNot).toContain('roll AI dice server-side');
        const strict = describeConsequences(flagsFor(ENFORCEMENT_PRESETS.find(p => p.id === 'strict')));
        expect(strict.willNot).toEqual([]);
        const off = describeConsequences({ ...ENFORCEMENT_DEFAULTS });
        expect(off.will).toEqual([]);
        expect(off.willNot).toHaveLength(10);
    });
});
