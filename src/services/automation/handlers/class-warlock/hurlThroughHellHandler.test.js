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
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

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

// ── Tests ──────────────────────────────────────────────────────

describe('hurlThroughHellHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return popup when already used this turn', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'hurlThroughHellTurnUsed') return 'turn1';
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Already used this turn');
        });

        it('should return popup when no uses remaining and no pact magic', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'hurlThroughHellUses') return 1;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
        });

        it('should spend pact magic slot to restore a use when available', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'hurlThroughHellUses') return 1;
                if (key === 'warlockPactMagic') return 2;
                return null;
            });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'warlockPactMagic', 1, 'campaign');
        });

        it('should return popup for no pact magic slots when recharge needed', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'hurlThroughHellUses') return 1;
                if (key === 'warlockPactMagic') return 0;
                return null;
            });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Pact Magic slots available');
        });

        it('should return popup when no target found', async () => {
            vi.mocked(await import('../../../rules/combat/damageUtils.js')).getCombatContext.mockResolvedValue(null);
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should increment use counter', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellUses', 1, 'campaign');
        });

        it('should mark the turn as used', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellTurnUsed', 'turn1', 'campaign');
        });

        it('should apply incapacitated condition on save failure', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'currentTurn') return 'turn1';
                if (key === 'targetEffects') return [];
                if (key === 'activeConditions') return [];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['incapacitated'], 'campaign');
        });

        it('should log damage entry for non-fiend on save failure', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'currentTurn') return 'turn1';
                if (key === 'targetEffects') return [];
                if (key === 'activeConditions') return [];
                return null;
            });

            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Human', type: 'humanoid' }],
            });
            const { getTargetFromAttacker } = await import('../../../rules/combat/damageUtils.js');
            getTargetFromAttacker.mockReturnValue({ name: 'Human' });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'damage_roll',
                targetName: 'Human',
            }));
        });

        it('should skip damage entry for fiend on save failure', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'currentTurn') return 'turn1';
                if (key === 'targetEffects') return [];
                if (key === 'activeConditions') return [];
                return null;
            });

            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            const { getTargetFromAttacker } = await import('../../../rules/combat/damageUtils.js');
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            const damageEntries = addEntry.mock.calls.filter(
                call => call[1]?.type === 'damage_roll'
            );
            expect(damageEntries).toHaveLength(0);
        });

        it('should log save success entry on save success', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-prompt-id', success: true },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'save_result',
                success: true,
            }));
        });

        it('should include damage info in popup payload', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.saveType).toBe('CHA');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.targetName).toBe('Goblin');
        });

        it('should ignore save result events with wrong promptId', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'wrong-prompt-id', success: false },
            }));

            await new Promise(r => setTimeout(r, 10));

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['incapacitated']));
        });
    });
});
