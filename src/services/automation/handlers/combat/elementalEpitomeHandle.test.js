import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './elementalEpitomeHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Elemental Epitome',
        automation: {
            type: 'elemental_epitome',
            ...overrides.automation,
        },
        ...overrides,
    };
}

// ── handle: attunement not active ──────────────────────────────

describe('elementalEpitomeHandler.handle — attunement not active', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with info message when elementalAttunementActive is false', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(false);

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Elemental Epitome',
                automationType: 'elemental_epitome',
                description: 'Elemental Attunement must be active to use Elemental Epitome.',
                automation: expect.objectContaining({ type: 'elemental_epitome' }),
            },
        });
    });

    it('returns popup when elementalAttunementActive is null', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(null);

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement must be active to use Elemental Epitome.',
        );
    });

    it('returns popup when elementalAttunementActive is undefined', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement must be active to use Elemental Epitome.',
        );
    });

    it('reads elementalAttunementActive from runtime using player name and campaign', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(false);

        await handle(
            makeAction(),
            makePlayerStats({ name: 'CustomSorcerer' }),
            'CustomCampaign',
        );

        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
            'CustomSorcerer',
            'elementalAttunementActive',
            'CustomCampaign',
        );
    });

    it('passes action name and automation type to the popup payload', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(false);

        const action = makeAction({
            name: 'Custom Epitome',
            automation: { type: 'custom_epitome' },
        });

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.name).toBe('Custom Epitome');
        expect(result.payload.automationType).toBe('custom_epitome');
    });
});

// ── handle: attunement active → modal ──────────────────────────

describe('elementalEpitomeHandler.handle — attunement active', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns modal with correct modalName when attunement is active', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return true;
            return null;
        });

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('elementalEpitome');
    });

    it('returns modal when elementalAttunementActive is truthy (1)', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return 1;
            return null;
        });

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('elementalEpitome');
    });

    it('returns modal when elementalAttunementActive is truthy (string)', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return 'fire';
            return null;
        });

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
        );

        expect(result.type).toBe('modal');
    });

    it('sets elementalEpitomeActive to true in runtime', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return true;
            return null;
        });

        await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'elementalEpitomeActive',
            true,
            campaignName,
        );
    });

    it('reads currentResistance from runtime and passes to modal payload', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return true;
            if (key === 'epitomeResistanceType') return 'Fire';
            return null;
        });

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
        );

        expect(result.payload.currentResistance).toBe('Fire');
    });

    it('passes currentResistance as null when not set', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return true;
            return null;
        });

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
        );

        expect(result.payload.currentResistance).toBeNull();
    });

    it('passes action object to modal payload', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return true;
            return null;
        });

        const action = makeAction({ name: 'Custom Name' });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.action).toBe(action);
    });

    it('passes playerStats to modal payload', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return true;
            return null;
        });

        const ps = makePlayerStats({ name: 'CustomChar', level: 5 });
        const result = await handle(makeAction(), ps, campaignName);

        expect(result.payload.playerStats).toBe(ps);
    });

    it('passes campaignName to modal payload', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return true;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), 'MyCampaign');

        expect(result.payload.campaignName).toBe('MyCampaign');
    });
});
