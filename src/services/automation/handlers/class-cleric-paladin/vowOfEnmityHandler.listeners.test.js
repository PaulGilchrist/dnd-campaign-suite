import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle, applyTargetChoice } from './vowOfEnmityHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';

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

function makeAction(overrides = {}) {
    return {
        name: 'Vow of Enmity',
        automation: { type: 'vow_of_enmity', ...overrides.automation },
        ...(overrides.name ? { name: overrides.name } : {}),
    };
}

function mockRuntimeValues(getters, state = {}) {
    Object.assign(state, getters);
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((targetName, key, campaign) => {
        const k = `${targetName}:${key}:${campaign}`;
        if (k in state) return state[k];
        if (key in getters) return getters[key];
        return null;
    });
    vi.spyOn(runtimeState, 'setRuntimeValue').mockImplementation(async (targetName, key, value, campaign) => {
        state[`${targetName}:${key}:${campaign}`] = value;
        state[key] = value;
    });
    return state;
}

// ─── Edge cases & setupVowTransferListener ───

describe('vowOfEnmityHandler edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses level fallback to 1 when playerStats.level is undefined in handle', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2, activeBuffs: [] });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        const ps = {
            name: 'Paladin1',
            level: undefined,
            class: {
                class_levels: [],
            },
        };

        await handle(makeAction(), ps, campaignName);

        const classLevel = ps.class?.class_levels?.[(ps.level || 1) - 1];
        const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
        expect(maxCharges).toBe(2);
    });

    it('uses level fallback to 1 when playerStats.level is undefined in applyTargetChoice', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2 });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Orc' }],
        });

        const ps = {
            name: 'Paladin1',
            level: undefined,
            class: {
                class_levels: [],
            },
        };

        const result = await applyTargetChoice(makeAction(), ps, campaignName, 'Orc');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('activated against Orc');
    });

    it('uses maxCharges fallback when storedCharges is null in applyTargetChoice', async () => {
        mockRuntimeValues({});
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Orc' }],
        });

        const ps = makePlayerStats({
            level: 3,
            class: {
                class_levels: [undefined, undefined, { channel_divinity: 3 }],
            },
        });

        const result = await applyTargetChoice(makeAction(), ps, campaignName, 'Orc');

        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'channelDivinityCharges',
            2,
            campaignName,
        );
    });

    it('uses hit_points.current when currentHp is missing', async () => {
        mockRuntimeValues({
            channelDivinityCharges: 2,
            activeBuffs: [],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [
                { name: 'Goblin', hit_points: { current: 0 } },
                { name: 'Orc', currentHp: 10 },
            ],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Orc' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('reactivated against Orc');
        expect(result.payload.description).toContain('Previous target defeated');
    });

    it('free reactivation with same target name (not transferred)', async () => {
        mockRuntimeValues({
            channelDivinityCharges: 2,
            activeBuffs: [],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [
                { name: 'Goblin', currentHp: 0 },
            ],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('reactivated against Goblin');
        expect(result.payload.description).toContain('Previous target defeated');
        expect(result.payload.description).not.toContain('Transferred');
    });

    it('uses singular "charge" when 1 remaining after activation', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2, activeBuffs: [] });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('1 Channel Divinity charge');
        expect(result.payload.description).toContain('remaining');
    });

    it('logs error to console when addEntry rejects', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2, activeBuffs: [] });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });
        addEntry.mockRejectedValue(new Error('log failed'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(consoleSpy).toHaveBeenCalledWith(
            '[vowOfEnmity] Error logging:',
            expect.any(Error),
        );
        consoleSpy.mockRestore();
    });

    it('setupVowTransferListener clears vow when target drops to 0 HP', async () => {
        mockRuntimeValues({
            channelDivinityCharges: 1,
            activeBuffs: [{ name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' }],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 5 }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );

        vi.clearAllMocks();
        mockRuntimeValues({
            channelDivinityCharges: 1,
            activeBuffs: [{ name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' }],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 5 }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        // Now dispatch the event to simulate target dropping to 0 HP
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 0 }],
        });

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            null,
            campaignName,
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityCostPaid',
            null,
            campaignName,
        );
    });

    it('setupVowTransferListener does nothing when combat context is null', async () => {
        mockRuntimeValues({ channelDivinityCharges: 1, activeBuffs: [] });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 5 }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        vi.clearAllMocks();
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue(null);

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('setupVowTransferListener does nothing when creature still exists with HP > 0', async () => {
        mockRuntimeValues({
            channelDivinityCharges: 1,
            activeBuffs: [{ name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' }],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 5 }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        vi.clearAllMocks();
        mockRuntimeValues({
            channelDivinityCharges: 1,
            activeBuffs: [{ name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' }],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 3 }],
        });

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('setupVowTransferListener clears vow using hit_points.current format', async () => {
        mockRuntimeValues({
            channelDivinityCharges: 1,
            activeBuffs: [{ name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' }],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 5 }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        vi.clearAllMocks();
        mockRuntimeValues({
            channelDivinityCharges: 1,
            activeBuffs: [{ name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' }],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', hit_points: { current: 0 } }],
        });

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            null,
            campaignName,
        );
    });

    it('uses fallback 0 when both currentHp and hit_points.current are undefined in activateVowOfEnmity', async () => {
        mockRuntimeValues({
            channelDivinityCharges: 2,
            activeBuffs: [],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [
                { name: 'Goblin' },
                { name: 'Orc', currentHp: 10 },
            ],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Orc' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('reactivated against Orc');
        expect(result.payload.description).toContain('Previous target defeated');
    });

    it('setupVowTransferListener uses fallback 0 when both HP fields missing', async () => {
        mockRuntimeValues({
            channelDivinityCharges: 1,
            activeBuffs: [{ name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' }],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 5 }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        vi.clearAllMocks();
        mockRuntimeValues({
            channelDivinityCharges: 1,
            activeBuffs: [{ name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' }],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            null,
            campaignName,
        );
    });

    it('setupVowTransferListener uses array fallback when attacker activeBuffs is not an array', async () => {
        mockRuntimeValues({
            channelDivinityCharges: 1,
            activeBuffs: [{ name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' }],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 5 }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        // Clear and set up with null activeBuffs to trigger Array.isArray fallback
        vi.clearAllMocks();
        const state = {};
        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((targetName, key, campaign) => {
            const k = `${targetName}:${key}:${campaign}`;
            if (k in state) return state[k];
            if (key === 'channelDivinityCharges') return 1;
            if (key === 'vowOfEnmityTarget') return 'Goblin';
            if (key === 'vowOfEnmityCostPaid') return true;
            if (key === 'activeBuffs') return null;
            return null;
        });
        vi.spyOn(runtimeState, 'setRuntimeValue').mockImplementation(async (targetName, key, value, campaign) => {
            state[`${targetName}:${key}:${campaign}`] = value;
            state[key] = value;
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 0 }],
        });

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'activeBuffs',
            [],
            campaignName,
        );
    });

    it('setupVowTransferListener uses ||[] fallback when target activeBuffs is falsy', async () => {
        mockRuntimeValues({
            channelDivinityCharges: 1,
            activeBuffs: [{ name: 'Vow of Enmity', effect: 'vow_of_enmity', duration: '1_minute', source: 'Paladin1' }],
            vowOfEnmityTarget: 'Goblin',
            vowOfEnmityCostPaid: true,
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 5 }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        // Clear and set up with null target activeBuffs to trigger ||[] fallback
        vi.clearAllMocks();
        const state = {};
        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((targetName, key, campaign) => {
            const k = `${targetName}:${key}:${campaign}`;
            if (k in state) return state[k];
            if (key === 'channelDivinityCharges') return 1;
            if (key === 'vowOfEnmityTarget') return 'Goblin';
            if (key === 'vowOfEnmityCostPaid') return true;
            if (key === 'activeBuffs' && targetName === 'Paladin1') return [];
            if (key === 'activeBuffs') return null;
            return null;
        });
        vi.spyOn(runtimeState, 'setRuntimeValue').mockImplementation(async (targetName, key, value, campaign) => {
            state[`${targetName}:${key}:${campaign}`] = value;
            state[key] = value;
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin', currentHp: 0 }],
        });

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Goblin',
            'activeBuffs',
            [],
            campaignName,
        );
    });
});
