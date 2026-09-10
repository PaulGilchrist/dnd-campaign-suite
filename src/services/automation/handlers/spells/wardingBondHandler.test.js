// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    KEY: 'pendingExpirations',
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
}));

import {
    handle,
    getWardingBondTarget,
    getWardingBondSource,
    isWardingBondActive,
} from './wardingBondHandler.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

const campaignName = 'TestCampaign';
const casterName = 'Paladin1';
const targetName = 'Ally1';

function makePlayerStats(overrides = {}) {
    return {
        name: casterName,
        level: 5,
        ...overrides,
    };
}

function makeAction(automation = {}, metaCtx = {}) {
    return {
        name: 'Warding Bond',
        automation: { type: 'warding_bond', ...automation },
        metaCtx,
    };
}

// ─── handle ───

describe('wardingBondHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentCombatRound.mockReturnValue(1);
    });

    it('returns info popup when no target is available (no metaCtx, no combat context)', async () => {
        getCombatSummary.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('No target selected. Choose a willing creature within range.');
    });

    it('uses metaCtx.wardingBondTargetName when provided', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction({}, { wardingBondTargetName: targetName }), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(`Warding Bond activated on ${targetName}`);
        expect(result.payload.description).toContain('+1 AC');
        expect(result.payload.description).toContain('+1 to saving throws');
        expect(result.payload.description).toContain('resistance to all damage');
    });

    it('falls back to combat context target when no metaCtx', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(`Warding Bond activated on ${targetName}`);
    });

    it('applies warding bond to target and caster when valid target exists', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction({}, { wardingBondTargetName: targetName }), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(`Warding Bond activated on ${targetName}`);
    });

    it('removes existing warding bond from target and caster before reapplying', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'pendingExpirations') return [
                { target: targetName, effects: [{ type: 'remove_active_buff', buffName: 'Warding Bond' }], appliedRound: 1, expiryRounds: 600, expireOnCreatureName: null },
            ];
            if (name === targetName) return [{ effect: 'warding_bond' }, { effect: 'bless' }];
            return [];
        });

        await handle(makeAction({}, { wardingBondTargetName: targetName }), makePlayerStats(), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        // Exactly one bond buff on each creature after recast (stale bond replaced, sibling buffs kept)
        const targetFinal = setCalls.filter(c => c[0] === targetName && c[1] === 'activeBuffs').pop();
        const casterFinal = setCalls.filter(c => c[0] === casterName && c[1] === 'activeBuffs').pop();
        expect(targetFinal[2].filter(b => b.effect === 'warding_bond')).toHaveLength(1);
        expect(targetFinal[2].some(b => b.effect === 'bless')).toBe(true);
        expect(casterFinal[2].filter(b => b.effect === 'warding_bond')).toHaveLength(1);
        // Recast-on-bonded logs the previous bond ending
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            description: expect.stringContaining('ends the previous Warding Bond'),
        }));
    });

    it('SP-125: detects an existing bond on the CASTER store and strips the stale caster bond (no stacking)', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'pendingExpirations') return [];
            if (name === casterName) return [{ effect: 'warding_bond', bondTarget: targetName }];
            return [];
        });

        await handle(makeAction({}, { wardingBondTargetName: targetName }), makePlayerStats(), campaignName, null);

        const casterFinal = setRuntimeValue.mock.calls.filter(c => c[0] === casterName && c[1] === 'activeBuffs').pop();
        expect(casterFinal[2]).toHaveLength(1);
        expect(casterFinal[2].filter(b => b.effect === 'warding_bond')).toHaveLength(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            description: expect.stringContaining('ends the previous Warding Bond'),
        }));
    });

    it('SP-125: clears stale warding-bond expirations and re-registers fresh clocks on recast (single merged write)', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'pendingExpirations') {
                return [
                    { target: targetName, effects: [{ type: 'remove_active_buff', buffName: 'Warding Bond' }], appliedRound: 1, expiryRounds: 600, expireOnCreatureName: null },
                    { target: casterName, effects: [{ type: 'remove_active_buff', buffName: 'Warding Bond' }], appliedRound: 1, expiryRounds: 600, expireOnCreatureName: null },
                    { target: 'Other', effects: [{ type: 'remove_active_buff', buffName: 'Bless' }], appliedRound: 1, expiryRounds: 10, expireOnCreatureName: null },
                ];
            }
            if (name === targetName) return [{ effect: 'warding_bond' }];
            return [];
        });
        getCurrentCombatRound.mockReturnValue(2);

        await handle(makeAction({}, { wardingBondTargetName: targetName }), makePlayerStats(), campaignName, null);

        const keyWrites = setRuntimeValue.mock.calls.filter(c => c[0] === casterName && c[1] === 'pendingExpirations');
        // ONE merged write — cleanup + fresh clocks together (§6-#18)
        expect(keyWrites).toHaveLength(1);
        const entries = keyWrites[0][2];
        expect(entries).toHaveLength(3);
        // stale ward clocks gone, foreign clock kept, two fresh 600-round clocks added
        expect(entries.filter(e => (e.effects || []).some(ef => ef.buffName === 'Warding Bond').valueOf())).toHaveLength(2);
        expect(entries.every(e => !(e.effects || []).some(ef => ef.buffName === 'Warding Bond' && e.appliedRound === 1))).toBe(true);
        expect(entries.some(e => e.target === 'Other')).toBe(true);
        expect(entries.filter(e => e.target === targetName || e.target === casterName).every(e => e.expiryRounds === 600 && e.appliedRound === 2)).toBe(true);
    });

    it('stores bondTarget on caster buff and sourceCharacter on target buff', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { wardingBondTargetName: targetName }), makePlayerStats(), campaignName, null);

        const buffWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeBuffs');
        expect(buffWrites).toHaveLength(2);
        const targetBuff = buffWrites[0][2][0];
        expect(targetBuff.sourceCharacter).toBe(casterName);
        expect(targetBuff.effect).toBe('warding_bond');

        const casterBuff = buffWrites[1][2][0];
        expect(casterBuff.bondTarget).toBe(targetName);
        expect(casterBuff.effect).toBe('warding_bond');
    });

    it('SP-125: registers 1-hour (600-round) clocks for target and caster WITHOUT a caster-turn anchor', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'pendingExpirations') return [];
            return [];
        });

        await handle(makeAction({}, { wardingBondTargetName: targetName }), makePlayerStats(), campaignName, null);

        const keyWrite = setRuntimeValue.mock.calls.find(c => c[0] === casterName && c[1] === 'pendingExpirations');
        expect(keyWrite).toBeDefined();
        expect(keyWrite[2]).toHaveLength(2);
        expect(keyWrite[2].map(e => e.target)).toEqual([targetName, casterName]);
        keyWrite[2].forEach(e => {
            expect(e.expiryRounds).toBe(600);
            expect(e.expireOnCreatureName).toBeNull();
            expect(e.appliedRound).toBe(1);
            expect(e.effects).toEqual([expect.objectContaining({ type: 'remove_active_buff', buffName: 'Warding Bond' })]);
        });
    });

    it('calls addEntry to log the ability use', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { wardingBondTargetName: targetName }), makePlayerStats(), campaignName, null);

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Warding Bond',
            targetName,
            description: expect.stringContaining(`cast Warding Bond on ${targetName}`),
        }));
    });

    it.each([
        [{ duration: '1_hour' }, '1_hour'],
        [{}, '1 hour'],
    ])('uses duration %j => "%s"', async (automation, expectedDuration) => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction(automation, { wardingBondTargetName: targetName }), makePlayerStats(), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const targetBuff = setCalls[0][2][0];
        expect(targetBuff.duration).toBe(expectedDuration);
        const casterBuff = setCalls[1][2][0];
        expect(casterBuff.duration).toBe(expectedDuration);
    });

    it('adds AC, save, and resistance bonuses to target buff', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { wardingBondTargetName: targetName }), makePlayerStats(), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const targetBuff = setCalls[0][2][0];
        expect(targetBuff.acBonus).toBe(1);
        expect(targetBuff.saveBonus).toBe(1);
        expect(targetBuff.resistanceTypes).toHaveLength(12);
        expect(targetBuff.resistanceTypes).toContain('fire');
        expect(targetBuff.resistanceTypes).toContain('necrotic');
        expect(targetBuff.resistanceTypes).toContain('radiant');
    });
});

// ─── getWardingBondTarget ───

describe('getWardingBondTarget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);

        const result = getWardingBondTarget(casterName, campaignName);

        expect(result).toBeNull();
    });

    it('returns the bondTarget when warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', bondTarget: targetName }]);

        const result = getWardingBondTarget(casterName, campaignName);

        expect(result).toBe(targetName);
    });
});

// ─── getWardingBondSource ───

describe('getWardingBondSource', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);

        const result = getWardingBondSource(targetName, campaignName);

        expect(result).toBeNull();
    });

    it('returns the sourceCharacter when warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', sourceCharacter: casterName }]);

        const result = getWardingBondSource(targetName, campaignName);

        expect(result).toBe(casterName);
    });
});

// ─── isWardingBondActive ───

describe('isWardingBondActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false when warding bond is not active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);

        const result = isWardingBondActive(targetName, campaignName);

        expect(result).toBe(false);
    });

    it('returns true when warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }, { effect: 'warding_bond' }]);

        const result = isWardingBondActive(targetName, campaignName);

        expect(result).toBe(true);
    });
});
