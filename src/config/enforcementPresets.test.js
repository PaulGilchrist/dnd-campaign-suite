// @maintained-by-ai 2026-11-26
/**
 * Preset definitions: sub-flag derivation, preset completeness + documented
 * compositions, the derived matchPreset identity (all-off ⇒ Custom), and the
 * consequence-copy partition. EnforcementSection.test.jsx covers the UI
 * write-lane; nothing here duplicates it.
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
const presetById = (id) => ENFORCEMENT_PRESETS.find(p => p.id === id);
const onSet = (preset) => Object.keys(preset.flagMap).filter(k => preset.flagMap[k]).sort();

describe('enforcementPresets', () => {
    it('sub-flags are the ten ENFORCEMENT_DEFAULTS keys with mode excluded', () => {
        expect(ENFORCEMENT_SUB_FLAGS).toHaveLength(10);
        expect(ENFORCEMENT_SUB_FLAGS).not.toContain('mode');
        ENFORCEMENT_SUB_FLAGS.forEach(k => expect(ENFORCEMENT_DEFAULTS).toHaveProperty(k, false));
    });

    it('every preset is a complete boolean map over exactly the sub-flags, flipping its documented set', () => {
        ENFORCEMENT_PRESETS.forEach(p => {
            expect(Object.keys(p.flagMap).sort()).toEqual([...ENFORCEMENT_SUB_FLAGS].sort());
            Object.values(p.flagMap).forEach(v => expect(typeof v).toBe('boolean'));
        });
        // Gentle: the bookkeeping trio. Standard: everything but serverDice.
        // Strict: everything — the three presets must stay distinct.
        expect(onSet(presetById('gentle'))).toEqual(['actionEconomy', 'movementBudget', 'turnLock']);
        expect(onSet(presetById('standard'))).toEqual(
            ENFORCEMENT_SUB_FLAGS.filter(k => k !== 'serverDice').sort()
        );
        expect(onSet(presetById('strict'))).toEqual([...ENFORCEMENT_SUB_FLAGS].sort());
    });

    it('matchPreset identifies each preset and falls back to Custom', () => {
        ENFORCEMENT_PRESETS.forEach(p => expect(matchPreset(flagsFor(p)).id).toBe(p.id));
        // All-off (the default blob) is NOT a preset — it's Custom.
        expect(matchPreset({ ...ENFORCEMENT_DEFAULTS }).id).toBe(CUSTOM_PRESET.id);
        // One checkbox off from Standard ⇒ Custom (the auto-adopt law).
        const offOne = flagsFor(presetById('standard'));
        offOne.zones = false;
        expect(matchPreset(offOne).id).toBe(CUSTOM_PRESET.id);
        // mode is never consulted — the chip tracks the flags alone.
        expect(matchPreset({ ...presetById('gentle').flagMap, mode: 'off' }).id).toBe('gentle');
    });

    it('describeConsequences partitions every flag copy into will/willNot from the flags only', () => {
        const gentle = describeConsequences(flagsFor(presetById('gentle')));
        expect(gentle.will).toHaveLength(3);
        expect(gentle.will[0]).toBe('refuse off-turn actions');
        expect(gentle.willNot).toHaveLength(7);
        expect(gentle.willNot).toContain('roll AI dice server-side');
        const strict = describeConsequences(flagsFor(presetById('strict')));
        expect(strict.will).toHaveLength(10);
        expect(strict.willNot).toEqual([]);
        const off = describeConsequences({ ...ENFORCEMENT_DEFAULTS });
        expect(off.will).toEqual([]);
        expect(off.willNot).toHaveLength(10);
    });
});
