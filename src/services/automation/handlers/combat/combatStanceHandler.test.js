import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../buffs/tempHpBuffHandler.js', () => ({
    grantTempHpOnRage: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
    clearExtendedFlag: vi.fn(),
}));

import { handle } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestBarbarian',
        level: 5,
        speed: 30,
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Rage',
        automation: {
            type: 'combat_stance',
            ...automation,
        },
    };
}

// ─── handle - Rage bonus movement ───

describe('combatStanceHandler - Rage bonus movement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with instinctive pounce message when rage_bonus_movement feature exists', async () => {
        runtimeState.getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce(2)
            .mockReturnValueOnce([])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        const ps = makePlayerStats({
            automation: {
                specialActions: [{ name: 'Instinctive Pounce', effect: 'rage_bonus_movement' }],
            },
        });

        const action = makeAction({ effect: 'stance', options: [] });

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Instinctive Pounce');
        expect(result.payload.description).toContain('You can move up to');
        expect(result.payload.description).toContain('as part of entering your Rage');
    });

    it('does not return instinctive pounce popup when feature does not exist', async () => {
        runtimeState.getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce(2)
            .mockReturnValueOnce([])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([])
            .mockReturnValueOnce(30);

        const ps = makePlayerStats({
            automation: {
                specialActions: [{ name: 'Other Feature', effect: 'something_else' }],
            },
        });

        const action = makeAction({ effect: 'stance', options: [] });

        const result = await handle(action, ps, campaignName);

        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Rage');
    });

    it('handles missing automation gracefully', async () => {
        runtimeState.getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce(2)
            .mockReturnValueOnce([])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        const ps = makePlayerStats({ automation: null });

        const action = makeAction({ effect: 'stance', options: [] });

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
    });
});
