import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './psychicTeleportationHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as automationService from '../../../combat/automation/automationService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

// L5-003 §8.1: token-move seam — default OFF/moved:false keeps the legacy
// prose path byte-identical; the tokenMoving ON case overrides it.
vi.mock('../../../combat/teleportService.js', () => ({
    applyTeleportTokenMove: vi.fn(async () => ({ moved: false, reason: 'token-moving-off' })),
}));
vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

import * as teleportService from '../../../combat/teleportService.js';
import * as combatData from '../../../encounters/combatData.js';

const campaignName = 'test-campaign';
const playerName = 'TestSorcerer';

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

describe('psychicTeleportationHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockImplementation(() => undefined);
        automationService.evaluateAutoExpression.mockReturnValue(8);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        logService.addEntry.mockResolvedValue(undefined);
        stubRandom(0);
    });

    describe('when psionic energy is available', () => {
        beforeEach(() => {
            runtimeState.getRuntimeValue.mockImplementation((_player, _key, _campaign) => 5);
            automationService.evaluateAutoExpression.mockReturnValue(8);
        });

        it('returns popup with teleport description including distance and remaining energy', async () => {
            stubRandom(0.875);
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Soul Blades');
            expect(result.payload.description).toContain('Psionic Energy');
            expect(result.payload.description).toContain('Teleport');
            expect(result.payload.description).toContain('80 feet');
            expect(result.payload.description).toContain('4/8');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('uses action name fallback when action has no name', async () => {
            const action = { automation: makeAction().automation };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.name).toBe('Psychic Teleportation');
            expect(result.payload.description).toContain('Psychic Teleportation');
        });

        it('uses default max of 6 when runtime value is undefined and tracked resources config is missing', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_player, _key, _campaign) => undefined);
            automationService.evaluateAutoExpression.mockReturnValue(8);

            const playerStats = makePlayerStats({ _trackedResources: undefined });
            const result = await handle(makeAction(), playerStats, campaignName, null);

            expect(result.payload.description).toContain('5/6');
        });

        it.each([
            { dieSize: 8, random: 0.875, expectedDistance: '80 feet' },
            { dieSize: 6, random: 0.834, expectedDistance: '60 feet' },
            { dieSize: 1, random: 0, expectedDistance: '10 feet' },
        ])('uses correct teleport distance based on die size ($dieSize-sided die)', async ({ dieSize, random, expectedDistance }) => {
            automationService.evaluateAutoExpression.mockReturnValue(dieSize);
            stubRandom(random);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain(expectedDistance);
        });
    });

    describe('when psionic energy is zero', () => {
        beforeEach(() => {
            runtimeState.getRuntimeValue.mockImplementation((_player, _key, _campaign) => 0);
        });

        it('returns popup indicating no energy remaining', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(result.payload.description).toContain('Recharges on a Short or Long Rest');
        });
    });

    describe('token-moving seam (L5-003 §8.1)', () => {
        beforeEach(() => {
            runtimeState.getRuntimeValue.mockImplementation(() => 5);
            automationService.evaluateAutoExpression.mockReturnValue(8);
        });

        it('tokenMoving OFF ⇒ prose unchanged, no coordinate appended, seam called in degrade mode', async () => {
            teleportService.applyTeleportTokenMove.mockResolvedValue({ moved: false, reason: 'token-moving-off' });
            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'battle-arena');

            expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledWith(
                expect.objectContaining({ campaignName, creatureName: playerName }),
            );
            expect(result.payload.description).not.toContain('Token moved');
            expect(result.payload.description).toContain('10 feet');
        });

        it('tokenMoving ON + a real move ⇒ description + log carry the moved coordinates', async () => {
            combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: playerName, targetName: 'Goblin' }, { name: 'Goblin' }] });
            teleportService.applyTeleportTokenMove.mockResolvedValue({ moved: true, from: { gridX: 2, gridY: 3 }, to: { gridX: 5, gridY: 3 }, distanceFeet: 15 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'battle-arena');

            expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledWith(
                expect.objectContaining({ creatureName: playerName, anchorName: 'Goblin', maxFeet: 10 }),
            );
            expect(result.payload.description).toContain('Token moved (2,3) → (5,3)');
            const logged = logService.addEntry.mock.calls.at(-1)[1];
            expect(logged.description).toContain('Token moved (2,3) → (5,3)');
        });
    });
});
