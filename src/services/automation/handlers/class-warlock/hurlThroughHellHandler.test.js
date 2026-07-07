// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './hurlThroughHellHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 44, rolls: [10, 10, 10, 10, 4] })),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((_auto) => 15),
    createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({
        creatures: [{ name: 'Goblin', type: 'fiend' }],
    })),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Goblin' })),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN = 'campaign';
const MAP = 'map';

function makeAction(overrides = {}) {
    return {
        name: 'Hurl Through Hell',
        automation: {
            type: 'hurl_through_hell',
            uses: 1,
            damageExpression: '8d10',
            damageType: 'Psychic',
            saveType: 'CHA',
            saveAbility: 'CHA',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return { name: 'TestHero', proficiency: 3, ...overrides };
}

function mockRuntimeValues(values) {
    getRuntimeValue.mockImplementation((_playerName, key, _campaign) => {
        if (values[key] !== undefined) return values[key];
        return null;
    });
}

// ── Tests ──────────────────────────────────────────────────────

describe('hurlThroughHellHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return popup when already used this turn', async () => {
            mockRuntimeValues({ hurlThroughHellTurnUsed: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Already used this turn');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should spend pact magic slot to restore a use when available', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 2 });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'warlockPactMagic', 1, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellUses', 0, CAMPAIGN);
        });

        it('should return popup when no pact magic slots available to recharge', async () => {
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 0 });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Pact Magic slots available');
        });

        it('should return popup when no target found', async () => {
            getCombatContext.mockResolvedValue(null);
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should return popup with damage and save info when executing successfully', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.saveType).toBe('CHA');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.damageTotal).toBe(44);
            expect(result.payload.targetName).toBe('Goblin');
        });
    });
});
