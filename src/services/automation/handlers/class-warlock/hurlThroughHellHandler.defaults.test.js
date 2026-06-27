// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './hurlThroughHellHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 44, rolls: [10, 10, 10, 10, 4] })),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

// ── Re-import after mocking ────────────────────────────────────

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../../rules/combat/damageUtils.js');

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

describe('hurlThroughHellHandler.defaults', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'fiend' }],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
        mockRuntimeValues({ currentTurn: 'turn1' });
    });

    describe('automation config defaults', () => {
        it('should use default saveType CHA when automation omits saveType', async () => {
            const result = await handle(makeAction({
                automation: { type: 'hurl_through_hell', uses: 1 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.saveType).toBe('CHA');
        });

        it('should use default damageType Psychic when automation omits damageType', async () => {
            const result = await handle(makeAction({
                automation: { type: 'hurl_through_hell', uses: 1 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.damageType).toBe('Psychic');
        });

        it('should use default damageExpression 8d10 when automation omits damageExpression', async () => {
            const result = await handle(makeAction({
                automation: { type: 'hurl_through_hell', uses: 1 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.damageTotal).toBe(44);
        });

        it('should use default saveAbility CHA when automation omits saveAbility', async () => {
            const result = await handle(makeAction({
                automation: { type: 'hurl_through_hell', uses: 1 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.saveType).toBe('CHA');
        });

        it('should use default uses of 1 when automation omits uses', async () => {
            const result = await handle(makeAction({
                automation: { type: 'hurl_through_hell' },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('44 Psychic damage');
        });
    });

    describe('feature name', () => {
        it('should use action.name as featureName when provided', async () => {
            const result = await handle(makeAction({
                name: 'My Custom Hurl',
                automation: { type: 'hurl_through_hell', uses: 1 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.name).toBe('My Custom Hurl');
            expect(result.payload.description).toContain('My Custom Hurl');
        });

        it('should use default feature name when action.name is undefined', async () => {
            const action = {
                automation: { type: 'hurl_through_hell', uses: 1 },
            };
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.name).toBe('Hurl Through Hell');
        });
    });

    describe('uses with explicit zero', () => {
        it('should allow activation when uses is explicitly 0', async () => {
            mockRuntimeValues({ hurlThroughHellUses: 0 });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellUses', 1, CAMPAIGN);
        });

        it('should block activation when uses equals max uses', async () => {
            mockRuntimeValues({ hurlThroughHellUses: 1 });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
        });
    });

    describe('pact magic recharge edge cases', () => {
        it('should not attempt pact magic recharge when pactMagicRecharge is false', async () => {
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 1 });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: false },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'warlockPactMagic', expect.anything());
        });

        it('should not attempt pact magic recharge when pactMagicRecharge is absent', async () => {
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 1 });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });

        it('should decrement pact magic by 1 when spending to restore', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 3 });

            await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'warlockPactMagic', 2, CAMPAIGN);
        });

        it('should reset uses to 0 after pact magic recharge', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 1 });

            await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hurlThroughHellUses', 0, CAMPAIGN);
        });

        it('should log pact magic recharge entry in campaign log', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ hurlThroughHellUses: 1, warlockPactMagic: 1 });

            await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                description: expect.stringContaining('Pact Magic'),
            }));
        });
    });

    describe('target resolution', () => {
        it('should return popup when getCombatContext returns null', async () => {
            getCombatContext.mockResolvedValue(null);
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should return popup when getTargetFromAttacker returns null', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });
            getTargetFromAttacker.mockReturnValue(null);
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should return popup when getTargetFromAttacker returns object without name', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });
            getTargetFromAttacker.mockReturnValue({});
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should use target name from getTargetFromAttacker result', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });
            getTargetFromAttacker.mockReturnValue({ name: 'Dragon' });
            mockRuntimeValues({ currentTurn: 'turn1' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.targetName).toBe('Dragon');
            expect(result.payload.description).toContain('Dragon');
        });
    });
});
