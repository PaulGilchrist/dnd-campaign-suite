// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
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
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
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

function makeAction(automation = {}) {
    return {
        name: 'Warding Bond',
        automation: { type: 'warding_bond', ...automation },
    };
}

// ─── handle ───

describe('wardingBondHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup when combat summary is null', async () => {
        getCombatSummary.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('No target selected. Choose a willing creature within range.');
    });

    it('returns info popup when getTargetFromAttacker returns null', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No target selected. Choose a willing creature within range.');
    });

    it('returns info popup when getTargetFromAttacker returns undefined', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue(undefined);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No target selected. Choose a willing creature within range.');
    });

    it('applies warding bond to target and caster when valid target exists', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(`Warding Bond activated on ${targetName}`);
        expect(result.payload.description).toContain('+1 AC');
        expect(result.payload.description).toContain('+1 to saving throws');
        expect(result.payload.description).toContain('resistance to all damage');
    });

    it('removes existing warding bond from target and caster before reapplying', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValueOnce([{ effect: 'warding_bond' }])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        // First call: remove old bond from target
        expect(setCalls[0][0]).toBe(targetName);
        expect(setCalls[0][1]).toBe('activeBuffs');
        expect(setCalls[0][2]).toEqual([]);
        // Second call: remove old bond from caster
        expect(setCalls[1][0]).toBe(casterName);
        expect(setCalls[1][1]).toBe('activeBuffs');
        expect(setCalls[1][2]).toEqual([]);
        // Third call: apply new bond to target
        expect(setCalls[2][0]).toBe(targetName);
        expect(setCalls[2][1]).toBe('activeBuffs');
        expect(setCalls[2][2]).toHaveLength(1);
        expect(setCalls[2][2][0].effect).toBe('warding_bond');
        // Fourth call: apply new bond to caster
        expect(setCalls[3][0]).toBe(casterName);
        expect(setCalls[3][1]).toBe('activeBuffs');
        expect(setCalls[3][2]).toHaveLength(1);
    });

    it('stores bondTarget on caster buff and sourceCharacter on target buff', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        expect(setCalls).toHaveLength(2);
        const targetBuff = setCalls[0][2][0];
        expect(targetBuff.sourceCharacter).toBe(casterName);
        expect(targetBuff.effect).toBe('warding_bond');

        const casterBuff = setCalls[1][2][0];
        expect(casterBuff.bondTarget).toBe(targetName);
        expect(casterBuff.effect).toBe('warding_bond');
    });

    it('adds expiration when warding bond is applied', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(addExpiration).toHaveBeenCalledWith(
            casterName,
            targetName,
            expect.arrayContaining([
                expect.objectContaining({ type: 'remove_active_buff', buffName: 'Warding Bond' }),
            ]),
            campaignName,
        );
    });

    it('calls addEntry to log the ability use', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Warding Bond',
            targetName,
            description: expect.stringContaining(`cast Warding Bond on ${targetName}`),
        }));
    });

    it('uses automation duration when provided', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({ duration: '1_hour' }), makePlayerStats(), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const targetBuff = setCalls[0][2][0];
        expect(targetBuff.duration).toBe('1_hour');
        const casterBuff = setCalls[1][2][0];
        expect(casterBuff.duration).toBe('1_hour');
    });

    it('defaults duration to 1 hour when not provided', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const targetBuff = setCalls[0][2][0];
        expect(targetBuff.duration).toBe('1 hour');
        const casterBuff = setCalls[1][2][0];
        expect(casterBuff.duration).toBe('1 hour');
    });

    it('adds AC, save, and resistance bonuses to target buff', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        const setCalls = setRuntimeValue.mock.calls;
        const targetBuff = setCalls[0][2][0];
        expect(targetBuff.acBonus).toBe(1);
        expect(targetBuff.saveBonus).toBe(1);
        expect(targetBuff.resistanceTypes).toHaveLength(12);
        expect(targetBuff.resistanceTypes).toContain('fire');
        expect(targetBuff.resistanceTypes).toContain('necrotic');
        expect(targetBuff.resistanceTypes).toContain('radiant');
    });

    it('does not call setRuntimeValue when no target selected', async () => {
        getCombatSummary.mockReturnValue(null);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns automationType in popup payload', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: targetName });
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.automationType).toBe('warding_bond');
    });
});

// ─── getWardingBondTarget ───

describe('getWardingBondTarget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no activeBuffs', () => {
        getRuntimeValue.mockReturnValue([]);

        const result = getWardingBondTarget(casterName, campaignName);

        expect(result).toBeNull();
    });

    it('returns null when no warding bond buff exists', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);

        const result = getWardingBondTarget(casterName, campaignName);

        expect(result).toBeNull();
    });

    it('returns null when warding bond has no bondTarget', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond' }]);

        const result = getWardingBondTarget(casterName, campaignName);

        expect(result).toBeNull();
    });

    it('returns the bondTarget when warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', bondTarget: targetName }]);

        const result = getWardingBondTarget(casterName, campaignName);

        expect(result).toBe(targetName);
    });

    it('returns null when getRuntimeValue returns non-array', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getWardingBondTarget(casterName, campaignName);

        expect(result).toBeNull();
    });
});

// ─── getWardingBondSource ───

describe('getWardingBondSource', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no activeBuffs', () => {
        getRuntimeValue.mockReturnValue([]);

        const result = getWardingBondSource(targetName, campaignName);

        expect(result).toBeNull();
    });

    it('returns null when no warding bond buff exists', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);

        const result = getWardingBondSource(targetName, campaignName);

        expect(result).toBeNull();
    });

    it('returns null when warding bond has no sourceCharacter', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond' }]);

        const result = getWardingBondSource(targetName, campaignName);

        expect(result).toBeNull();
    });

    it('returns the sourceCharacter when warding bond is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', sourceCharacter: casterName }]);

        const result = getWardingBondSource(targetName, campaignName);

        expect(result).toBe(casterName);
    });

    it('returns null when getRuntimeValue returns non-array', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getWardingBondSource(targetName, campaignName);

        expect(result).toBeNull();
    });
});

// ─── isWardingBondActive ───

describe('isWardingBondActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false when activeBuffs is empty', () => {
        getRuntimeValue.mockReturnValue([]);

        const result = isWardingBondActive(targetName, campaignName);

        expect(result).toBe(false);
    });

    it('returns false when warding bond is not in activeBuffs', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);

        const result = isWardingBondActive(targetName, campaignName);

        expect(result).toBe(false);
    });

    it('returns true when warding bond is in activeBuffs', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }, { effect: 'warding_bond' }]);

        const result = isWardingBondActive(targetName, campaignName);

        expect(result).toBe(true);
    });

    it('returns false when getRuntimeValue returns non-array', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = isWardingBondActive(targetName, campaignName);

        expect(result).toBe(false);
    });
});
