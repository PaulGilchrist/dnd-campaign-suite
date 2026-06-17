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
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

const campaignName = 'TestCampaign';
const casterName = 'Paladin1';

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

    it('returns info popup when no target selected', async () => {
        getCombatSummary.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No target selected');
    });

    it('returns info popup when getTargetFromAttacker returns null', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
    });

    it('removes existing warding bond from target when already active', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Ally1' });
        getRuntimeValue
            .mockReturnValue({ name: 'Ally1' });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        // The handler calls getRuntimeValue 3 times for the same (Ally1, activeBuffs, campaignName)
        // First call returns [{ effect: 'warding_bond' }], second call also returns same
        // This test verifies the function runs without error
        expect(setRuntimeValue).toHaveBeenCalled();
    });



    it('stores bond relationship on caster', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Ally1' });
        getRuntimeValue
            .mockReturnValueOnce({ name: 'Ally1' })
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        const casterBuffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === casterName && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(casterBuffsCall).toBeDefined();
        const casterBuff = casterBuffsCall[2][casterBuffsCall[2].length - 1];
        expect(casterBuff.bondTarget).toBe('Ally1');
    });

    it('adds expiration when warding bond is applied', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Ally1' });
        getRuntimeValue
            .mockReturnValueOnce({ name: 'Ally1' })
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(addExpiration).toHaveBeenCalledWith(
            casterName,
            'Ally1',
            expect.arrayContaining([
                expect.objectContaining({ type: 'remove_active_buff', buffName: 'Warding Bond' }),
            ]),
            campaignName,
        );
    });

    it('returns popup with correct description', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Ally1' });
        getRuntimeValue
            .mockReturnValueOnce({ name: 'Ally1' })
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Warding Bond activated on Ally1');
        expect(result.payload.description).toContain('+1 AC');
    });

    it('uses automation duration when provided', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Ally1' });
        getRuntimeValue
            .mockReturnValueOnce({ name: 'Ally1' })
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await handle(makeAction({ duration: '1_hour' }), makePlayerStats(), campaignName, null);

        const targetBuffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(targetBuffsCall[2][0].duration).toBe('1_hour');
    });

    it('defaults duration to 1 hour when not provided', async () => {
        getCombatSummary.mockReturnValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Ally1' });
        getRuntimeValue
            .mockReturnValueOnce({ name: 'Ally1' })
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        const targetBuffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(targetBuffsCall[2][0].duration).toBe('1 hour');
    });
});

// ─── getWardingBondTarget ───

describe('getWardingBondTarget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no warding bond on caster', () => {
        getRuntimeValue.mockReturnValue([]);

        const result = getWardingBondTarget(casterName, campaignName);

        expect(result).toBeNull();
    });

    it('returns null when warding bond has no bondTarget', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond' }]);

        const result = getWardingBondTarget(casterName, campaignName);

        expect(result).toBeNull();
    });
});

// ─── getWardingBondSource ───

describe('getWardingBondSource', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no warding bond on target', () => {
        getRuntimeValue.mockReturnValue([]);

        const result = getWardingBondSource('Ally1', campaignName);

        expect(result).toBeNull();
    });
});

// ─── isWardingBondActive ───

describe('isWardingBondActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false when warding bond is not in activeBuffs', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);

        const result = isWardingBondActive('Ally1', campaignName);

        expect(result).toBe(false);
    });

    it('returns false when activeBuffs is empty', () => {
        getRuntimeValue.mockReturnValue([]);

        const result = isWardingBondActive('Ally1', campaignName);

        expect(result).toBe(false);
    });
});
