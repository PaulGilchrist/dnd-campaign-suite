import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

import { handle, applyTargetChoice } from './vowOfEnmityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Paladin1',
        level: 7,
        class: {
            class_levels: [
                { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
                { level: 5 }, { level: 6 }, { level: 7 },
            ],
        },
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Vow of Enmity',
        automation: { type: 'vow_of_enmity', ...automation },
    };
}

// ─── handle ───

describe('vowOfEnmityHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup when vow is already active', async () => {
        getRuntimeValue.mockReturnValue('Goblin');

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('already active against Goblin');
    });

    it('returns no charges popup when channel divinity is depleted', async () => {
        getRuntimeValue.mockReturnValueOnce(null); // no existing vow
        getRuntimeValue.mockReturnValueOnce(0); // 0 charges

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    });

    it('returns modal when no combat target and no existing vow', async () => {
        getRuntimeValue.mockReturnValueOnce(null); // no existing vow
        getRuntimeValue.mockReturnValueOnce(2); // 2 charges
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('vowOfEnmityTarget');
    });

    it('activates vow when combat target exists', async () => {
        getRuntimeValue
            .mockReturnValueOnce(null) // no existing vow
            .mockReturnValueOnce(2); // 2 charges
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('activated against Goblin');
    });

    it('consumes a channel divinity charge on activation', async () => {
        getRuntimeValue
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(2);
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'channelDivinityCharges',
            1,
            campaignName,
        );
    });

    it('stores the vow target', async () => {
        getRuntimeValue
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(2);
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );
    });

    it('adds vow_of_enmity buff to activeBuffs', async () => {
        getRuntimeValue
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(2)
            .mockReturnValueOnce([]);
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        const buffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall).toBeDefined();
        expect(buffsCall[2][0].effect).toBe('vow_of_enmity');
        expect(buffsCall[2][0].target).toBe('Goblin');
    });

    it('uses automation duration when provided', async () => {
        getRuntimeValue
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(2)
            .mockReturnValueOnce([]);
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

        await handle(makeAction({ duration: '1_hour' }), makePlayerStats(), campaignName);

        const buffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall[2][0].duration).toBe('1_hour');
    });

    it('defaults duration to 1_minute when not provided', async () => {
        getRuntimeValue
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(2)
            .mockReturnValueOnce([]);
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        const buffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall[2][0].duration).toBe('1_minute');
    });

    it('uses class level from playerStats for channel divinity charges', async () => {
        getRuntimeValue
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(null); // null charges → defaults to maxCharges
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

        const ps = makePlayerStats({ level: 7 });

        await handle(makeAction(), ps, campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'channelDivinityCharges',
            1,
            campaignName,
        );
    });

    it('returns modal when targetName is null from combat context', async () => {
        getRuntimeValue.mockReturnValueOnce(null);
        getRuntimeValue.mockReturnValueOnce(2);
        getCombatContext.mockResolvedValue({
            creatures: [],
        });
        getTargetFromAttacker.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('vowOfEnmityTarget');
    });
});

// ─── applyTargetChoice ───

describe('vowOfEnmityHandler.applyTargetChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup when no chosenTargetName provided', async () => {
        const result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No target selected.');
    });

    it('activates vow with chosen target', async () => {
        getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        const result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Orc');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('activated against Orc');
    });

    it('stores the chosen target', async () => {
        getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Orc');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Orc',
            campaignName,
        );
    });

    it('adds vow_of_enmity buff with chosen target', async () => {
        getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Orc');

        const buffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall[2][0].target).toBe('Orc');
    });

    it('includes action.automation.type in info popup for null target', async () => {
        const result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.automationType).toBe('vow_of_enmity');
    });

    it('includes automation in info popup for null target', async () => {
        const result = await applyTargetChoice(makeAction({ custom: 'val' }), makePlayerStats(), campaignName, null);

        expect(result.payload.automation).toEqual({ type: 'vow_of_enmity', custom: 'val' });
    });
});
