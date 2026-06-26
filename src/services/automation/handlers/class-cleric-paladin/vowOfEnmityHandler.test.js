// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyTargetChoice } from './vowOfEnmityHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

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

function makeAction(overrides = {}) {
    return {
        name: 'Vow of Enmity',
        automation: { type: 'vow_of_enmity', ...overrides.automation },
        ...(overrides.name ? { name: overrides.name } : {}),
    };
}

function mockRuntimeValues(getters, state = {}) {
    Object.assign(state, getters);
    vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((target, key, campaign) => {
        const k = `${target}:${key}:${campaign}`;
        if (k in state) return state[k];
        if (key in getters) return getters[key];
        return null;
    });
    vi.spyOn(runtimeState, 'setRuntimeValue').mockImplementation(async (target, key, value, campaign) => {
        state[`${target}:${key}:${campaign}`] = value;
        state[key] = value;
    });
    return state;
}

// ─── handle ───

describe('vowOfEnmityHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup when vow is already active against a target', async () => {
        mockRuntimeValues({ vowOfEnmityTarget: 'Goblin' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Vow of Enmity');
        expect(result.payload.automationType).toBe('vow_of_enmity');
        expect(result.payload.description).toContain('already active against Goblin');
        expect(result.payload.automation).toEqual({ type: 'vow_of_enmity' });
    });

    it('does not consume charges or mutate state when vow is already active', async () => {
        mockRuntimeValues({ vowOfEnmityTarget: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns info popup when vow is already active with no charges remaining', async () => {
        mockRuntimeValues({
            vowOfEnmityTarget: 'Goblin',
            channelDivinityCharges: 0,
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already active against Goblin');
    });

    it('returns no-charges popup when channel divinity is depleted', async () => {
        mockRuntimeValues({ channelDivinityCharges: 0 });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('defaults to max charges when stored charges is null', async () => {
        mockRuntimeValues({});
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('activated against Goblin');
    });

    it('uses class_specific.channel_divinity_charges fallback for max charges', async () => {
        mockRuntimeValues({});
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        const ps = makePlayerStats({
            level: 3,
            class: {
                class_levels: [
                    undefined, undefined, { channel_divinity: 0, class_specific: { channel_divinity_charges: 3 } },
                ],
            },
        });

        await handle(makeAction(), ps, campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'channelDivinityCharges',
            2,
            campaignName,
        );
    });

    it('defaults to 2 charges when no channel_divinity metadata exists', async () => {
        mockRuntimeValues({});
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        const ps = makePlayerStats({
            level: 3,
            class: {
                class_levels: [undefined, undefined, {}],
            },
        });

        await handle(makeAction(), ps, campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'channelDivinityCharges',
            1,
            campaignName,
        );
    });

    it('returns modal when combat context is null', async () => {
        mockRuntimeValues({});
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('vowOfEnmityTarget');
    });

    it('returns modal when combat has no creatures', async () => {
        mockRuntimeValues({});
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('vowOfEnmityTarget');
    });

    it('returns modal when getTargetFromAttacker returns null', async () => {
        mockRuntimeValues({});
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('vowOfEnmityTarget');
    });

    it('activates vow with combat target, consuming one charge', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2 });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('activated against Goblin');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'channelDivinityCharges',
            1,
            campaignName,
        );
    });

    it('stores the vow target and adds the buff', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2, activeBuffs: [] });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );
        const buffsCall = vi.mocked(runtimeState.setRuntimeValue).mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall).toBeDefined();
        expect(buffsCall[2][0]).toEqual({
            name: 'Vow of Enmity',
            effect: 'vow_of_enmity',
            duration: '1_minute',
            target: 'Goblin',
        });
    });

    it('preserves existing buffs when adding vow_of_enmity', async () => {
        mockRuntimeValues({
            channelDivinityCharges: 2,
            activeBuffs: [{ effect: 'divine_shield', target: 'Paladin1' }],
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        const buffsCall = vi.mocked(runtimeState.setRuntimeValue).mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall[2]).toHaveLength(2);
        expect(buffsCall[2][0].effect).toBe('divine_shield');
        expect(buffsCall[2][1].effect).toBe('vow_of_enmity');
    });

    it('uses automation duration when provided', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2, activeBuffs: [] });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction({ automation: { duration: '1_hour' } }), makePlayerStats(), campaignName);

        const buffsCall = vi.mocked(runtimeState.setRuntimeValue).mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall[2][0].duration).toBe('1_hour');
    });

    it('defaults duration to 1_minute when not provided', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2, activeBuffs: [] });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        const buffsCall = vi.mocked(runtimeState.setRuntimeValue).mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall[2][0].duration).toBe('1_minute');
    });

    it('includes automation object in activation popup payload', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2, activeBuffs: [] });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        const result = await handle(makeAction({ automation: { duration: '1_hour' } }), makePlayerStats(), campaignName);

        expect(result.payload.automation).toEqual({ type: 'vow_of_enmity', duration: '1_hour' });
    });

    it('passes action, playerStats, and campaignName in modal payload', async () => {
        mockRuntimeValues({});
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.payload.action.automation.type).toBe('vow_of_enmity');
        expect(result.payload.playerStats.name).toBe('Paladin1');
        expect(result.payload.campaignName).toBe('TestCampaign');
    });
});

// ─── applyTargetChoice ───

describe('vowOfEnmityHandler.applyTargetChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup with "No target selected" when chosenTargetName is null', async () => {
        const result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Vow of Enmity');
        expect(result.payload.description).toBe('No target selected.');
        expect(result.payload.automationType).toBe('vow_of_enmity');
        expect(result.payload.automation).toEqual({ type: 'vow_of_enmity' });
    });

    it('returns info popup when chosenTargetName is empty string', async () => {
        const result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, '');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No target selected.');
    });

    it('activates vow with chosen target', async () => {
        mockRuntimeValues({ activeBuffs: [] });

        const result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Orc');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('activated against Orc');
    });

    it('stores the chosen target', async () => {
        mockRuntimeValues({ activeBuffs: [] });

        await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Orc');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Orc',
            campaignName,
        );
    });

    it('adds vow_of_enmity buff with chosen target', async () => {
        mockRuntimeValues({ activeBuffs: [] });

        await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Orc');

        const buffsCall = vi.mocked(runtimeState.setRuntimeValue).mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall[2][0].target).toBe('Orc');
        expect(buffsCall[2][0].effect).toBe('vow_of_enmity');
    });

    it('uses default duration when no automation duration provided', async () => {
        mockRuntimeValues({ activeBuffs: [] });

        await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Orc');

        const buffsCall = vi.mocked(runtimeState.setRuntimeValue).mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall[2][0].duration).toBe('1_minute');
    });

    it('includes custom automation fields in the null-target popup', async () => {
        const result = await applyTargetChoice(
            makeAction({ automation: { customField: 'customVal' } }),
            makePlayerStats(),
            campaignName,
            null,
        );

        expect(result.payload.automation).toEqual({ type: 'vow_of_enmity', customField: 'customVal' });
    });
});

// ─── setupVowTransferListener ───

describe('vowOfEnmityHandler.vowTransferListener', () => {
    let setSpy;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    function setupSpots(runtimeValues, combatCtx, target) {
        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((targetName, key, campaign) => {
            const k = `${targetName}:${key}:${campaign}`;
            if (k in runtimeValues) return runtimeValues[k];
            if (key in runtimeValues) return runtimeValues[key];
            return null;
        });
        setSpy = vi.spyOn(runtimeState, 'setRuntimeValue');
        setSpy.mockImplementation(async (targetName, key, value, campaign) => {
            runtimeValues[`${targetName}:${key}:${campaign}`] = value;
            runtimeValues[key] = value;
        });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue(combatCtx);
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue(target);
    }

    it('clears vowOfEnmityTarget and removes buff when target creature drops to 0 HP', async () => {
        const runtimeValues = {
            'Paladin1:vowOfEnmityTarget:TestCampaign': null,
            'Paladin1:channelDivinityCharges:TestCampaign': 2,
            'Paladin1:activeBuffs:TestCampaign': [],
        };
        setupSpots(runtimeValues, { creatures: [{ name: 'Goblin', currentHp: 0 }] }, { name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );

        const buffsCall = setSpy.mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall[2]).toHaveLength(1);
        expect(buffsCall[2][0].effect).toBe('vow_of_enmity');
        expect(buffsCall[2][0].target).toBe('Goblin');

        const event = new CustomEvent('combat-summary-updated');
        window.dispatchEvent(event);

        await new Promise(r => setTimeout(r, 0));

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            null,
            campaignName,
        );
        const allBuffsCalls = setSpy.mock.calls.filter(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        const lastBuffsCall = allBuffsCalls[allBuffsCalls.length - 1];
        expect(lastBuffsCall[2]).toHaveLength(0);
    });

    it('clears vow when target HP uses hit_points.current format', async () => {
        const runtimeValues = {
            'Paladin1:channelDivinityCharges:TestCampaign': 2,
            'Paladin1:activeBuffs:TestCampaign': [],
        };
        setupSpots(runtimeValues, { creatures: [{ name: 'Orc', hit_points: { current: 0 } }] }, { name: 'Orc' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Orc',
            campaignName,
        );

        const event = new CustomEvent('combat-summary-updated');
        window.dispatchEvent(event);

        await new Promise(r => setTimeout(r, 0));

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            null,
            campaignName,
        );
    });

    it('does not clear vow when target creature has positive HP', async () => {
        const runtimeValues = {
            'Paladin1:channelDivinityCharges:TestCampaign': 2,
            'Paladin1:activeBuffs:TestCampaign': [],
        };
        setupSpots(runtimeValues, { creatures: [{ name: 'Goblin', currentHp: 5 }] }, { name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );

        const event = new CustomEvent('combat-summary-updated');
        window.dispatchEvent(event);

        await new Promise(r => setTimeout(r, 0));

        const clearCalls = setSpy.mock.calls.filter(
            (c) => c[0] === 'Paladin1' && c[1] === 'vowOfEnmityTarget' && c[2] === null,
        );
        expect(clearCalls).toHaveLength(0);
    });

    it('does not clear vow when combat context is null during event', async () => {
        const runtimeValues = {
            'Paladin1:channelDivinityCharges:TestCampaign': 2,
            'Paladin1:activeBuffs:TestCampaign': [],
        };
        setupSpots(runtimeValues, { creatures: [{ name: 'Goblin', currentHp: 10 }] }, { name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );

        vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null);

        const event = new CustomEvent('combat-summary-updated');
        window.dispatchEvent(event);

        await new Promise(r => setTimeout(r, 0));

        const clearCalls = setSpy.mock.calls.filter(
            (c) => c[0] === 'Paladin1' && c[1] === 'vowOfEnmityTarget' && c[2] === null,
        );
        expect(clearCalls).toHaveLength(0);
    });

    it('does not clear vow when target creature not found in combat context', async () => {
        const runtimeValues = {
            'Paladin1:channelDivinityCharges:TestCampaign': 2,
            'Paladin1:activeBuffs:TestCampaign': [],
        };
        setupSpots(runtimeValues, { creatures: [{ name: 'Orc', currentHp: 10 }] }, { name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );

        const event = new CustomEvent('combat-summary-updated');
        window.dispatchEvent(event);

        await new Promise(r => setTimeout(r, 0));

        const clearCalls = setSpy.mock.calls.filter(
            (c) => c[0] === 'Paladin1' && c[1] === 'vowOfEnmityTarget' && c[2] === null,
        );
        expect(clearCalls).toHaveLength(0);
    });

    it('preserves other buffs when clearing vow_of_enmity', async () => {
        const runtimeValues = {
            'Paladin1:channelDivinityCharges:TestCampaign': 2,
            'Paladin1:activeBuffs:TestCampaign': [
                { name: 'Divine Shield', effect: 'divine_shield' },
            ],
        };
        setupSpots(runtimeValues, { creatures: [{ name: 'Goblin', currentHp: 0 }] }, { name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );

        const event = new CustomEvent('combat-summary-updated');
        window.dispatchEvent(event);

        await new Promise(r => setTimeout(r, 0));

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            null,
            campaignName,
        );
        const allBuffsCalls = setSpy.mock.calls.filter(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        const lastBuffsCall = allBuffsCalls[allBuffsCalls.length - 1];
        expect(lastBuffsCall[2]).toHaveLength(1);
        expect(lastBuffsCall[2][0].effect).toBe('divine_shield');
    });

    it('clears vow when target creature HP is exactly 0 using hit_points.current', async () => {
        const runtimeValues = {
            'Paladin1:channelDivinityCharges:TestCampaign': 2,
            'Paladin1:activeBuffs:TestCampaign': [],
        };
        setupSpots(runtimeValues, { creatures: [{ name: 'Goblin', hit_points: { current: 0 } }] }, { name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );

        const event = new CustomEvent('combat-summary-updated');
        window.dispatchEvent(event);

        await new Promise(r => setTimeout(r, 0));

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            null,
            campaignName,
        );
    });

    it('clears vow when target creature HP is negative', async () => {
        const runtimeValues = {
            'Paladin1:channelDivinityCharges:TestCampaign': 2,
            'Paladin1:activeBuffs:TestCampaign': [],
        };
        setupSpots(runtimeValues, { creatures: [{ name: 'Goblin', currentHp: -1 }] }, { name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );

        const event = new CustomEvent('combat-summary-updated');
        window.dispatchEvent(event);

        await new Promise(r => setTimeout(r, 0));

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            null,
            campaignName,
        );
    });

    it('handles missing currentHp/hit_points by defaulting to 0', async () => {
        const runtimeValues = {
            'Paladin1:channelDivinityCharges:TestCampaign': 2,
            'Paladin1:activeBuffs:TestCampaign': [],
        };
        setupSpots(runtimeValues, { creatures: [{ name: 'Goblin' }] }, { name: 'Goblin' });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Goblin',
            campaignName,
        );

        const event = new CustomEvent('combat-summary-updated');
        window.dispatchEvent(event);

        await new Promise(r => setTimeout(r, 0));

        expect(setSpy).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            null,
            campaignName,
        );
    });
});
