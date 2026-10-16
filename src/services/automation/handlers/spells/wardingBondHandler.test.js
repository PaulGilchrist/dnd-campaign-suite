import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => {
    // Mirrors the real KEY ('pendingExpirations', turnStartEffects.js:17)
    return { KEY: 'pendingExpirations' };
});

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

// Exact resistance list stamped by the handler's ALL_DAMAGES
const ALL_DAMAGES = [
    'acid', 'bludgeoning', 'cold', 'fire', 'lightning',
    'piercing', 'poison', 'slashing', 'thunder',
    'necrotic', 'psychic', 'radiant'
];

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

const makeMetaCtx = () => ({ wardingBondTargetName: targetName });

// Filter-first lookup of activeBuffs writes (never positional on the raw call list)
const buffWrites = (name) =>
    setRuntimeValue.mock.calls.filter(c => c[0] === name && c[1] === 'activeBuffs' && c[3] === campaignName);
const expirationWrites = () =>
    setRuntimeValue.mock.calls.filter(c => c[0] === casterName && c[1] === 'pendingExpirations' && c[3] === campaignName);

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
        expect(result.payload.name).toBe('Warding Bond');
        expect(result.payload.description).toBe('No target selected. Choose a willing creature within range.');
        // Refusal writes nothing
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('resolves target from metaCtx.wardingBondTargetName and returns the full success popup', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction({}, makeMetaCtx()), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.automationType).toBe('warding_bond');
        expect(result.payload.description).toBe(
            'Warding Bond activated on Ally1. While within 60 feet, they gain +1 AC, +1 to saving throws, and resistance to all damage. You take the same damage they take.'
        );
    });

    it('falls back to combat context target when no metaCtx', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Warding Bond activated on Ally1');
        // Fallback resolution still wrote both buff stores
        expect(buffWrites(targetName)).toHaveLength(1);
        expect(buffWrites(casterName)).toHaveLength(1);
    });

    it('removes existing warding bond from target before reapplying (siblings kept), logging the recast-break', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'pendingExpirations') return [
                { target: targetName, effects: [{ type: 'remove_active_buff', buffName: 'Warding Bond' }], appliedRound: 1, expiryRounds: 600, expireOnCreatureName: null },
            ];
            if (name === targetName) return [{ effect: 'warding_bond' }, { effect: 'bless' }];
            return [];
        });

        await handle(makeAction({}, makeMetaCtx()), makePlayerStats(), campaignName, null);

        // Exactly one bond buff on each creature after recast (stale bond replaced, sibling buffs kept)
        const targetFinal = buffWrites(targetName).pop();
        const casterFinal = buffWrites(casterName).pop();
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

        await handle(makeAction({}, makeMetaCtx()), makePlayerStats(), campaignName, null);

        const casterFinal = buffWrites(casterName).pop();
        expect(casterFinal[2]).toHaveLength(1);
        expect(casterFinal[2][0]).toEqual({
            name: 'Warding Bond',
            effect: 'warding_bond',
            duration: '1 hour',
            sourceCharacter: casterName,
            bondTarget: targetName,
        });
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

        await handle(makeAction({}, makeMetaCtx()), makePlayerStats(), campaignName, null);

        const keyWrites = expirationWrites();
        // ONE merged write — cleanup + fresh clocks together (§6-#18)
        expect(keyWrites).toHaveLength(1);
        const entries = keyWrites[0][2];
        expect(entries).toHaveLength(3);
        // stale ward clocks gone, foreign clock kept, two fresh 600-round clocks added
        expect(entries.filter(e => (e.effects || []).some(ef => ef.buffName === 'Warding Bond'))).toHaveLength(2);
        expect(entries.every(e => !(e.effects || []).some(ef => ef.buffName === 'Warding Bond' && e.appliedRound === 1))).toBe(true);
        expect(entries.some(e => e.target === 'Other')).toBe(true);
        expect(entries.filter(e => e.target === targetName || e.target === casterName).every(e => e.expiryRounds === 600 && e.appliedRound === 2)).toBe(true);
    });

    it('writes the exact linked buff payloads: target gets bonuses + sourceCharacter, caster gets bondTarget', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, makeMetaCtx()), makePlayerStats(), campaignName, null);

        // Target buff (written first), exact own-composition pin
        expect(buffWrites(targetName)).toHaveLength(1);
        expect(buffWrites(targetName)[0][2]).toEqual([{
            name: 'Warding Bond',
            effect: 'warding_bond',
            duration: '1 hour',
            resistanceTypes: ALL_DAMAGES,
            acBonus: 1,
            saveBonus: 1,
            sourceCharacter: casterName,
        }]);

        // Caster buff, exact own-composition pin (no acBonus on the caster side)
        expect(buffWrites(casterName)).toHaveLength(1);
        expect(buffWrites(casterName)[0][2]).toEqual([{
            name: 'Warding Bond',
            effect: 'warding_bond',
            duration: '1 hour',
            sourceCharacter: casterName,
            bondTarget: targetName,
        }]);
    });

    it('SP-125: registers 1-hour (600-round) clocks for target and caster WITHOUT a caster-turn anchor', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, makeMetaCtx()), makePlayerStats(), campaignName, null);

        const keyWrites = expirationWrites();
        expect(keyWrites).toHaveLength(1);
        expect(keyWrites[0][2]).toHaveLength(2);
        expect(keyWrites[0][2].map(e => e.target)).toEqual([targetName, casterName]);
        keyWrites[0][2].forEach(e => {
            expect(e.expiryRounds).toBe(600);
            expect(e.expireOnCreatureName).toBeNull();
            expect(e.appliedRound).toBe(1);
            expect(e.effects).toEqual([expect.objectContaining({ type: 'remove_active_buff', buffName: 'Warding Bond' })]);
        });
    });

    it('logs the ability use', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, makeMetaCtx()), makePlayerStats(), campaignName, null);

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Warding Bond',
            targetName,
            description: 'Paladin1 cast Warding Bond on Ally1.',
        }));
    });

    it.each([
        [{ duration: '1_hour' }, '1_hour'],
        [{}, '1 hour'],
    ])('uses duration %j => "%s" on both buffs', async (automation, expectedDuration) => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction(automation, makeMetaCtx()), makePlayerStats(), campaignName, null);

        expect(buffWrites(targetName)[0][2][0].duration).toBe(expectedDuration);
        expect(buffWrites(casterName)[0][2][0].duration).toBe(expectedDuration);
    });
});

// ─── getWardingBondTarget ───

describe('getWardingBondTarget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);

        expect(getWardingBondTarget(casterName, campaignName)).toBeNull();
    });

    it('returns the bondTarget when warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', bondTarget: targetName }]);

        expect(getWardingBondTarget(casterName, campaignName)).toBe(targetName);
    });
});

// ─── getWardingBondSource ───

describe('getWardingBondSource', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);

        expect(getWardingBondSource(targetName, campaignName)).toBeNull();
    });

    it('returns the sourceCharacter when warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', sourceCharacter: casterName }]);

        expect(getWardingBondSource(targetName, campaignName)).toBe(casterName);
    });
});

// ─── isWardingBondActive ───

describe('isWardingBondActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false when warding bond is not active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);

        expect(isWardingBondActive(targetName, campaignName)).toBe(false);
    });

    it('returns true when warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }, { effect: 'warding_bond' }]);

        expect(isWardingBondActive(targetName, campaignName)).toBe(true);
    });
});
