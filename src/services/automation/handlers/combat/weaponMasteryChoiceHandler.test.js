// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyMasterySelection, WEAPON_MASTER_KEY } from './weaponMasteryChoiceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
    return {
        name: 'Test Character',
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        automation: {
            type: 'weapon_mastery_choice',
            masteryProperties: ['Push', 'Topple', 'Sap'],
            ...automation,
        },
    };
}

const campaignName = 'test-campaign';

beforeEach(() => {
    vi.clearAllMocks();
});

// ── WEAPON_MASTER_KEY export ──────────────────────────────────

describe('WEAPON_MASTER_KEY', () => {
    it('is exported as a non-empty string', () => {
        expect(typeof WEAPON_MASTER_KEY).toBe('string');
        expect(WEAPON_MASTER_KEY.length).toBeGreaterThan(0);
    });
});

// ── handle ─────────────────────────────────────────────────────

describe('handle', () => {
    it('returns a modal when no existing selection', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(null);

        const action = makeAction();
        const ps = makePlayerStats();

        const result = await handle(action, ps, campaignName, null);

        expect(result).toEqual({
            type: 'modal',
            modalName: 'weaponMasteryChoice',
            payload: {
                action,
                playerStats: ps,
                campaignName,
                masteryProperties: ['Push', 'Topple', 'Sap'],
            },
        });
    });

    it('returns a modal when existing selection is not in masteryProperties', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue('Cleave');

        const action = makeAction();
        const ps = makePlayerStats();

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('weaponMasteryChoice');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns a popup when existing selection is in masteryProperties', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue('Push');

        const action = makeAction();
        const ps = makePlayerStats();

        const result = await handle(action, ps, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Push');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name,
            WEAPON_MASTER_KEY,
            'Push',
            campaignName,
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Weapon Master - Mastery Property',
            description: expect.stringContaining('Push'),
        });
    });

    it('throws when action.automation is missing', async () => {
        const action = { automation: undefined };
        const ps = makePlayerStats();

        await expect(handle(action, ps, campaignName)).rejects.toThrow(
            "Cannot read properties of undefined (reading 'masteryProperties')",
        );
    });
});

// ── applyMasterySelection ──────────────────────────────────────

describe('applyMasterySelection', () => {
    it('stores the chosen mastery and returns a popup', async () => {
        const ps = makePlayerStats();

        const result = await applyMasterySelection('Topple', ps, campaignName);

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name,
            WEAPON_MASTER_KEY,
            'Topple',
            campaignName,
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Weapon Master - Mastery Property',
            description: 'Selected mastery property: Topple',
        });
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Weapon Master',
                description: 'Mastery property set to: Topple. This will be applied to your next attack.',
            },
        });
    });

    it('returns null for any falsy masteryName', async () => {
        const ps = makePlayerStats();

        const falsyValues = ['', null, undefined, 0, false];

        for (const value of falsyValues) {
            vi.clearAllMocks();
            const result = await applyMasterySelection(value, ps, campaignName);
            expect(result).toBeNull();
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        }
    });
});
