// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

function triggerSaveResult(success, promptId = 'test-prompt-id') {
    window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId, success },
    }));
}

function flushTimers(count = 1) {
    return new Promise(r => setTimeout(r, count * 5));
}

// ── Tests ──────────────────────────────────────────────────────

describe('hurlThroughHellHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Clean up any event listeners registered by the handler
        window.removeEventListener('save-result', () => {});
    });

    describe('handle', () => {
        it('should return popup when already used this turn', async () => {
            mockRuntimeValues({ hurlThroughHellTurnUsed: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Already used this turn');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should return popup when no uses remaining without pact magic recharge', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ hurlThroughHellUses: 1 });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
            expect(result.payload.description).toContain('Long Rest');
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

        it('should return popup when no pact magic slots available', async () => {
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

        it('should set use counter and turn-used marker when executing', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellUses', 1, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellTurnUsed', 'turn1', CAMPAIGN);
        });

        it('should set targetEffects on the campaign', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            const expectedEffect = expect.objectContaining({
                target: 'Goblin',
                source: 'Hurl Through Hell',
                effect: 'incapacitated',
                saveType: 'CHA',
                saveDc: 15,
                damageType: 'Psychic',
                damageTotal: 44,
                damageExpression: '8d10',
                teleport: true,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                CAMPAIGN, 'targetEffects', expect.arrayContaining([expectedEffect]), CAMPAIGN
            );
        });

        it('should apply incapacitated condition on save failure for non-fiend', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Human', type: 'humanoid' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Human' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            triggerSaveResult(false);
            await flushTimers();

            expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeConditions', ['incapacitated'], CAMPAIGN);
        });

        it('should log damage entry for non-fiend on save failure', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Human', type: 'humanoid' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Human' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            triggerSaveResult(false);
            await flushTimers();

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'damage_roll',
                targetName: 'Human',
                damageType: 'Psychic',
                formula: '8d10',
            }));
        });

        it('should skip damage entry for fiend on save failure', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            triggerSaveResult(false);
            await flushTimers();

            const damageEntries = addEntry.mock.calls.filter(
                call => call[1]?.type === 'damage_roll'
            );
            expect(damageEntries).toHaveLength(0);
        });

        it('should log save failure entry for fiend with no-damage note', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            triggerSaveResult(false);
            await flushTimers();

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'save_result',
                targetName: 'Goblin',
                success: false,
                description: expect.stringContaining('Fiend'),
            }));
        });

        it('should log save success entry on save success', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            triggerSaveResult(true);
            await flushTimers();

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'save_result',
                success: true,
            }));
        });

        it('should include damage and save info in popup payload', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.saveType).toBe('CHA');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.damageTotal).toBe(44);
            expect(result.payload.targetName).toBe('Goblin');
        });

        it('should use default values when automation omits them', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction({
                name: 'Hurl Through Hell',
                automation: { type: 'hurl_through_hell', uses: 1 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.saveType).toBe('CHA');
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.damageTotal).toBe(44);
        });

        it('should ignore save result events with wrong promptId', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            triggerSaveResult(false, 'wrong-prompt-id');
            await flushTimers();

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['incapacitated']));
        });

        it('should use currentTurn value or fallback to unknown', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ currentTurn: null });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellTurnUsed', 'unknown', CAMPAIGN);
        });
    });
});
