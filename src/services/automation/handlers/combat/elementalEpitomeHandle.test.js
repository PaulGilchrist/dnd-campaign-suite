// @maintained-by-ai
// elementalEpitomeHandler.handle — attunement gate + modal-open lane
// (sibling elementalEpitomeApplyResistanceChoice.test.js owns the applyResistanceChoice
// writer lane — activeBuffs / epitomeResistanceType stamp shapes; do NOT re-pin those here).
// Contracts pinned here are consumed downstream and must stay exact-key:
//   - modalName 'elementalEpitome' routes the modal open (CharSpecialActions setEpitomeModal,
//     useCharActionsAutomation epitomeModal)
//   - payload {action, playerStats, campaignName, currentResistance} feeds ElementalEpitomeModal
//     so the picker can show/re-pick the current resistance
//   - elementalEpitomeActive=true stamp is read by destructiveStrideHandler, stepOfTheWindHandler,
//     epitomeEmpoweredStrikes, CharClassFeatures; cleared by rest rules and attunement deactivation
//   - gate refusal must NOT stamp elementalEpitomeActive (no writes, no log on refusal)
// Dispatched from automation/index.js as 'elemental_epitome'. Writes via runtime only — turn-based,
// no game timers.
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
import * as logService from '../../../ui/logService.js';

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

// ── handle: attunement gate — refusal popup lane ───────────────

describe('elementalEpitomeHandler.handle — attunement not active', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Any falsy gate value (unset or explicitly false) must produce the exact refusal
    // popup shape and touch nothing else — no epitomeActive stamp, no log.
    it.each([
        ['false', false],
        ['null', null],
        ['undefined', undefined],
    ])('returns exact automation_info popup with zero writes when elementalAttunementActive is %s', async (_label, attunement) => {
        useRuntimeState.getRuntimeValue.mockReturnValue(attunement);

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
                automation: { type: 'elemental_epitome' },
            },
        });
        // Refusal lane: gate read only — no resistance read, no writes, no log.
        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledTimes(1);
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('threads custom player, campaign, action name, and automation through the gate read and popup', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(false);

        const action = makeAction({
            name: 'Custom Epitome',
            automation: { type: 'custom_epitome' },
        });

        const result = await handle(action, makePlayerStats({ name: 'CustomSorcerer' }), 'CustomCampaign');

        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
            'CustomSorcerer',
            'elementalAttunementActive',
            'CustomCampaign',
        );
        expect(result.payload).toEqual({
            type: 'automation_info',
            name: 'Custom Epitome',
            automationType: 'custom_epitome',
            description: 'Elemental Attunement must be active to use Elemental Epitome.',
            automation: { type: 'custom_epitome' },
        });
    });
});

// ── handle: attunement active → modal lane ─────────────────────

describe('elementalEpitomeHandler.handle — attunement active', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Truthy gate values (any truthy, incl. stored element strings) open the modal
    // and stamp elementalEpitomeActive — the sole write of this lane.
    it.each([
        ['true', true],
        ['the number 1', 1],
        ['a truthy string', 'fire'],
    ])('returns elementalEpitome modal and stamps elementalEpitomeActive when attunement is %s', async (_label, attunement) => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return attunement;
            return null;
        });

        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName);

        expect(result).toEqual({
            type: 'modal',
            modalName: 'elementalEpitome',
            payload: { action, playerStats, campaignName, currentResistance: null },
        });
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'elementalEpitomeActive',
            true,
            campaignName,
        );
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('threads custom player, campaign, action identity, and currentResistance through the modal payload', async () => {
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'elementalAttunementActive') return true;
            if (key === 'epitomeResistanceType') return 'Lightning';
            return null;
        });

        const action = makeAction({ name: 'Custom Epitome' });
        const playerStats = makePlayerStats({ name: 'DragonSorcerer' });
        const result = await handle(action, playerStats, 'MyCampaign');

        // Gate read first, then resistance re-pick read — same identity on both.
        expect(useRuntimeState.getRuntimeValue).toHaveBeenNthCalledWith(
            1, 'DragonSorcerer', 'elementalAttunementActive', 'MyCampaign',
        );
        expect(useRuntimeState.getRuntimeValue).toHaveBeenNthCalledWith(
            2, 'DragonSorcerer', 'epitomeResistanceType', 'MyCampaign',
        );
        expect(result.payload.action).toBe(action);
        expect(result.payload.playerStats).toBe(playerStats);
        expect(result.payload).toEqual({
            action,
            playerStats,
            campaignName: 'MyCampaign',
            currentResistance: 'Lightning',
        });
    });
});
