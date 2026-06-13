import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyBonusActionChoice } from './bonusActionChoiceHandler.js';
import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as combatData from '../../../services/encounters/combatData.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestRogue',
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Cunning Action',
        description: 'On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide.',
        automation: {
            type: 'bonus_action_choice',
            options: [
                { name: 'Dash', description: 'Double your movement speed until the end of the turn' },
                { name: 'Disengage', description: 'Your movement doesn\'t provoke opportunity attacks until the end of the turn' },
                { name: 'Hide', description: 'Attempt to hide from creatures until the end of the turn' },
            ],
            ...automation,
        },
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('bonusActionChoiceHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return modal result with options when options are available', async () => {
        const ps = makePlayerStats();
        const action = makeAction();

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('bonusActionChoice');
        expect(result.payload.action).toBe(action);
        expect(result.payload.options).toHaveLength(3);
    });

    it('should return info popup when no options are available', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ options: [] });

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('no options available');
    });

    it('should return once-per-turn error when already used this turn', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: true });
        combatData.getCurrentCombatRound.mockReturnValue(1);
        useRuntimeState.getRuntimeValue.mockReturnValue(1);

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('once per turn');
    });

    it('should not block if oncePerTurn is false', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: false });
        useRuntimeState.getRuntimeValue.mockReturnValue(1);

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('bonusActionChoice');
    });
});

describe('applyBonusActionChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return popup with Dash description when Dash is selected', () => {
        const ps = makePlayerStats();
        const action = makeAction();

        const result = applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Cunning Action');
        expect(result.payload.description).toContain('Dash');
        expect(result.payload.description).toContain('movement speed is doubled');
    });

    it('should return popup with Disengage description when Disengage is selected', () => {
        const ps = makePlayerStats();
        const action = makeAction();

        const result = applyBonusActionChoice(action, ps, campaignName, 'Disengage');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Disengage');
        expect(result.payload.description).toContain('opportunity attacks');
    });

    it('should return popup with Hide description when Hide is selected', () => {
        const ps = makePlayerStats();
        const action = makeAction();

        const result = applyBonusActionChoice(action, ps, campaignName, 'Hide');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Hide');
        expect(result.payload.description).toContain('Stealth');
    });

    it('should return unknown option popup for unrecognized option', () => {
        const ps = makePlayerStats();
        const action = makeAction();

        const result = applyBonusActionChoice(action, ps, campaignName, 'Foo');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Unknown option');
    });

    it('should track once-per-turn usage when set', () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: true });

        applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name,
            '_CunningAction_usedRound',
            1,
            campaignName,
            true,
        );
    });

    it('should not track once-per-turn when not set', () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: false });

        applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            ps.name,
            '_CunningAction_usedRound',
            expect.anything(),
            expect.anything(),
            expect.anything(),
        );
    });
});
