// @maintained-by-ai 2026-11-26
// Handler-lane contract for psychic_teleportation: ledger math (spend, exact-key
// runtime pins, default max), dN×10 distance roll (stubbed random), popup + log
// composition pinned FULL-SHAPE with Date.now frozen, and the L5-003 §8.1
// token-move seam (full-args census; degrade vs. moved legs). Dispatch routing
// is owned by automation/index.psychicTeleportation.test.js; psionic_energy_die
// resolution is owned by automationExpressions.test.js — not re-pinned here.
// Log-lane defers nothing to warpingImplosion: that teleport lane owns its own
// feature-specific map/range matrix, not this ledger+prose handler.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle } from './psychicTeleportationHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as teleportService from '../../../combat/teleportService.js';
import * as combatData from '../../../encounters/combatData.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

// L5-003 §8.1: token-move seam — the degrade leg (moved:false) is the default;
// the moved:true case overrides per-test.
vi.mock('../../../combat/teleportService.js', () => ({
    applyTeleportTokenMove: vi.fn(),
}));
vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

const campaignName = 'test-campaign';
const playerName = 'TestSorcerer';
const FROZEN_NOW = 1764000000000;

function stubRandom(value) {
    Object.defineProperty(globalThis.Math, 'random', {
        value: () => value,
        writable: true,
        configurable: true,
    });
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 9,
        abilities: [
            { name: 'Dexterity', bonus: 4 },
            { name: 'Intelligence', bonus: 3 },
        ],
        proficiency: 3,
        _trackedResources: { psionicEnergy: { max: 8 } },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Soul Blades',
        automation: {
            type: 'auto_effect',
            effect: 'psychic_teleportation',
            trigger: 'psychic_teleportation',
            uses: '1',
            recharge: 'short_rest',
            ...overrides.automation,
        },
        ...overrides,
    };
}

// Prose template shared by every full-shape description pin (random 0 ⇒ roll 1
// ⇒ 10 feet unless the test re-stubs).
function expectedPopupDescription(distance, ledger) {
    return `Soul Blades: Expend 1 Psionic Energy to manifest a Psychic Blade, then throw it to an unoccupied space up to ${distance} feet away. Teleport to that space. Psionic Energy: ${ledger}.`;
}

describe('psychicTeleportationHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
        runtimeState.getRuntimeValue.mockImplementation(() => 5);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        automationService.evaluateAutoExpression.mockReturnValue(8);
        logService.addEntry.mockResolvedValue(undefined);
        teleportService.applyTeleportTokenMove.mockResolvedValue({ moved: false, reason: 'token-moving-off' });
        combatData.getCombatSummary.mockReturnValue(null);
        stubRandom(0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        stubRandom(0.5);
    });

    it('happy path: popup, ledger decrement, and ability_use log composed full-shape', async () => {
        stubRandom(0.875); // d8 ⇒ top roll 8 ⇒ 80 feet
        const playerStats = makePlayerStats();

        const result = await handle(makeAction(), playerStats, campaignName, null);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Soul Blades',
                description: expectedPopupDescription(80, '4/8'),
                automation: makeAction().automation,
            },
        });
        // Exact-key runtime pins, one call each.
        expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
            [playerName, 'psionicEnergy', campaignName],
        ]);
        expect(automationService.evaluateAutoExpression.mock.calls).toEqual([
            ['psionic_energy_die', playerStats],
        ]);
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
            [playerName, 'psionicEnergy', 4, campaignName],
        ]);
        expect(logService.addEntry.mock.calls).toEqual([
            [campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Soul Blades',
                description: 'TestSorcerer used Soul Blades: Teleported up to 80 feet (Rolled 8 for 8 × 10). Psionic Energy: 4/8.',
                timestamp: FROZEN_NOW,
            }],
        ]);
        expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledTimes(1);
    });

    it.each([
        {
            label: 'falls back to "Psychic Teleportation" when the action has no name',
            action: { automation: makeAction().automation },
            playerStats: makePlayerStats(),
            runtimeValue: 5,
            expectedName: 'Psychic Teleportation',
            expectedDescription: expectedPopupDescription(10, '4/8').replace('Soul Blades:', 'Psychic Teleportation:'),
        },
        {
            label: 'defaults max to 6 when runtime value is undefined and tracked resources are missing',
            action: makeAction(),
            playerStats: makePlayerStats({ _trackedResources: undefined }),
            runtimeValue: undefined,
            expectedName: 'Soul Blades',
            expectedDescription: expectedPopupDescription(10, '5/6'),
        },
    ])('popup composition: $label', async ({ action, playerStats, runtimeValue, expectedName, expectedDescription }) => {
        runtimeState.getRuntimeValue.mockReturnValue(runtimeValue);
        const result = await handle(action, playerStats, campaignName, null);

        expect(result.payload.name).toBe(expectedName);
        expect(result.payload.description).toBe(expectedDescription);
    });

    it.each([
        { dieSize: 6, random: 0.834, dieRoll: 6, distance: 60 },
        { dieSize: 1, random: 0, dieRoll: 1, distance: 10 },
    ])('distance roll: d$dieSize at random $random ⇒ $distance feet (log pins the roll)', async ({ dieSize, random, dieRoll, distance }) => {
        automationService.evaluateAutoExpression.mockReturnValue(dieSize);
        stubRandom(random);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toBe(expectedPopupDescription(distance, '4/8'));
        expect(logService.addEntry.mock.calls[0][1].description).toBe(
            `TestSorcerer used Soul Blades: Teleported up to ${distance} feet (Rolled ${dieSize} for ${dieRoll} × 10). Psionic Energy: 4/8.`,
        );
    });

    it('depleted energy: informative popup and zero side effects', async () => {
        runtimeState.getRuntimeValue.mockReturnValue(0);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'battle-arena');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Soul Blades',
                description: 'Soul Blades: No Psionic Energy remaining. Recharges on a Short or Long Rest.',
                automation: makeAction().automation,
            },
        });
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
        expect(teleportService.applyTeleportTokenMove).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('tokenMoving OFF (degrade leg): seam called with full args and null anchor, prose carries no coordinates', async () => {
        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'battle-arena');

        expect(teleportService.applyTeleportTokenMove.mock.calls).toEqual([
            [{
                campaignName,
                mapName: 'battle-arena',
                creatureName: playerName,
                anchorName: null,
                maxFeet: 10,
            }],
        ]);
        expect(result.payload.description).toBe(expectedPopupDescription(10, '4/8'));
    });

    it('tokenMoving ON + real move (moved leg): coordinates reach popup and log, seam anchors on selected target', async () => {
        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: playerName, targetName: 'Goblin' }, { name: 'Goblin' }],
        });
        teleportService.applyTeleportTokenMove.mockResolvedValue({
            moved: true, from: { gridX: 2, gridY: 3 }, to: { gridX: 5, gridY: 3 }, distanceFeet: 15,
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'battle-arena');

        expect(teleportService.applyTeleportTokenMove.mock.calls).toEqual([
            [{
                campaignName,
                mapName: 'battle-arena',
                creatureName: playerName,
                anchorName: 'Goblin',
                maxFeet: 10,
            }],
        ]);
        expect(result.payload.description).toBe(`${expectedPopupDescription(10, '4/8')} Token moved (2,3) → (5,3) — 15 ft.`);
        expect(logService.addEntry.mock.calls[0][1].description).toBe(
            'TestSorcerer used Soul Blades: Teleported up to 10 feet (Rolled 8 for 1 × 10). Psionic Energy: 4/8. Token moved (2,3) → (5,3).',
        );
    });

    it('log failure never breaks the automation: rejected addEntry still returns the popup', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        logService.addEntry.mockRejectedValue(new Error('disk full'));

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(expectedPopupDescription(10, '4/8'));
        expect(consoleError).toHaveBeenCalledTimes(1);
    });
});
