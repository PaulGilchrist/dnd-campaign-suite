import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyTargetChoice } from './vowOfEnmityHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

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

    it('activates vow with chosen target, storing target and cost flag', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2 });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Orc' }],
        });

        const result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Orc');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('activated against Orc');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityTarget',
            'Orc',
            campaignName,
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Paladin1',
            'vowOfEnmityCostPaid',
            true,
            campaignName,
        );
    });

    it('adds vow_of_enmity to target activeBuffs from applyTargetChoice', async () => {
        mockRuntimeValues({ channelDivinityCharges: 2, activeBuffs: [] });
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Orc' }],
        });

        await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Orc');

        const targetBuffsCall = vi.mocked(runtimeState.setRuntimeValue).mock.calls.find(
            (c) => c[0] === 'Orc' && c[1] === 'activeBuffs' && Array.isArray(c[2]),
        );
        expect(targetBuffsCall).toBeDefined();
        expect(targetBuffsCall[2][0].effect).toBe('vow_of_enmity');
        expect(targetBuffsCall[2][0].source).toBe('Paladin1');
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
