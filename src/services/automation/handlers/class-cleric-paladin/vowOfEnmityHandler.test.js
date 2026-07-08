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
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns no-charges popup when channel divinity is depleted', async () => {
        mockRuntimeValues({ channelDivinityCharges: 0 });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('uses channel_divinity_charges fallback when channel_divinity is 0', async () => {
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

    it('returns modal when combat target is unavailable', async () => {
        // null combat context
        mockRuntimeValues({});
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue(null);
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue(null);
        let result = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('vowOfEnmityTarget');

        vi.clearAllMocks();
        mockRuntimeValues({});

        // empty creatures list
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({ creatures: [] });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue(null);
        result = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('vowOfEnmityTarget');

        vi.clearAllMocks();
        mockRuntimeValues({});

        // getTargetFromAttacker returns null
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue(null);
        result = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('vowOfEnmityTarget');
    });

    it('returns modal payload with action, playerStats, and campaignName', async () => {
        mockRuntimeValues({});
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.payload.action.automation.type).toBe('vow_of_enmity');
        expect(result.payload.playerStats.name).toBe('Paladin1');
        expect(result.payload.campaignName).toBe('TestCampaign');
    });

    it('activates vow with combat target, consuming one charge and setting up state', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2, activeBuffs: [] });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });
        vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue({ name: 'Goblin' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('activated against Goblin');
        expect(result.payload.automation).toEqual({ type: 'vow_of_enmity' });
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'channelDivinityCharges',
            1,
            campaignName,
        );
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
        expect(buffsCall[2]).toHaveLength(1);
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

    it('uses custom duration from automation when provided', async () => {
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
});

// ─── applyTargetChoice ───

describe('vowOfEnmityHandler.applyTargetChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup with "No target selected" for null or empty target', async () => {
        let result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Vow of Enmity');
        expect(result.payload.description).toBe('No target selected.');
        expect(result.payload.automationType).toBe('vow_of_enmity');
        expect(result.payload.automation).toEqual({ type: 'vow_of_enmity' });

        vi.clearAllMocks();
        result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, '');
        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No target selected.');
    });

    it('activates vow with chosen target, storing target and adding buff', async () => {
        mockRuntimeValues({ activeBuffs: [] });

        const result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Orc');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('activated against Orc');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Orc',
            campaignName,
        );
        const buffsCall = vi.mocked(runtimeState.setRuntimeValue).mock.calls.find(
            (c) => c[0] === 'Paladin1' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(buffsCall[2][0].target).toBe('Orc');
        expect(buffsCall[2][0].effect).toBe('vow_of_enmity');
        expect(buffsCall[2][0].duration).toBe('1_minute');
    });

    it('passes custom automation fields through to the payload', async () => {
        const result = await applyTargetChoice(
            makeAction({ automation: { customField: 'customVal' } }),
            makePlayerStats(),
            campaignName,
            null,
        );

        expect(result.payload.automation).toEqual({ type: 'vow_of_enmity', customField: 'customVal' });
    });
});
