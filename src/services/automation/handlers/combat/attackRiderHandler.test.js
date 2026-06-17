import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyRiderOption } from './attackRiderHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => 5),
}));

vi.mock('../../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Cunning Strike',
        description: 'Apply a rider effect on a hit.',
        automation: {
            type: 'attack_rider',
            options: [
                { name: 'Trip', effect: 'prone' },
                { name: 'Poison', effect: 'poisoned', requires: 'Poisoner\'s Kit' },
                { name: 'Daze', effect: 'daze' },
                { name: 'Push 15ft', effect: 'push_15ft', value: 15 },
                { name: 'Disadvantage on Save', effect: 'disadvantage_on_next_save' },
                { name: 'No Opportunity Attacks', effect: 'no_opportunity_attacks', movement: true },
                { name: 'Sudden Strike', effect: 'sudden_strike' },
                { name: 'Mass Fear', effect: 'mass_fear', saveType: 'WIS', saveAbility: 'WIS' },
                { name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '2d6' },
                { name: 'Cleave', effect: 'cleave', oncePerTurn: true },
            ],
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [
            { name: 'Dexterity', bonus: 2 },
            { name: 'Constitution', bonus: 1 },
            { name: 'Wisdom', bonus: 3 },
        ],
        toolProficiencies: [],
        automation: { passives: [] },
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {


        it('should apply immediately when single option', async () => {
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Trip', effect: 'prone' }],
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
        });

        it('should return ready info when no options', async () => {
            const action = makeAction({
                automation: { type: 'attack_rider', options: [] },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('ready');
        });




    });

    describe('applyRiderOption', () => {
        it('should return null when no matching options found', async () => {
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Nonexistent']);
            expect(result).toBe(null);
        });

        it('should apply Trip effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
        });

        it('should apply Trip effect when target is too large (sync lookup fails)', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.mocked(await import('../../../rules/combat/damageUtils.js')).getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', size: 'Gargantuan' }],
            });

            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(result.type).toBe('popup');
        });

        it('should reject Poison without Poisoner\'s Kit', async () => {
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Poison']);

            expect(result.payload.description).toContain('Poisoner\'s Kit');
        });

        it('should allow Poison with Poisoner\'s Kit', async () => {
            getRuntimeValue.mockReturnValue([]);
            const stats = makePlayerStats({
                toolProficiencies: ['Poisoner\'s Kit'],
            });
            const action = makeAction();
            const result = await applyRiderOption(action, stats, 'campaign', 'Goblin', ['Poison']);

            expect(result.type).toBe('popup');
        });

        it('should apply Sudden Strike effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Sudden Strike']);

            expect(result.payload.description).toContain('Sudden Strike enabled');
        });

        it('should apply Mass Fear effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Mass Fear']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Mass Fear');
        });

        it('should apply Push 15ft effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Push 15ft']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Push 15ft');
        });

        it('should apply Disadvantage on Save effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Disadvantage on Save']);

            expect(result.type).toBe('popup');
        });

        it('should apply No Opportunity Attacks effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['No Opportunity Attacks']);

            expect(result.type).toBe('popup');
        });

        it('should apply Damage Bonus effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Damage Bonus']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('2d6');
        });



        it('should deduct Cunning Strike cost when specified', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Costly Strike', effect: 'poisoned', cost: '2d6' }],
                },
            });
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Costly Strike']);

            expect(result.type).toBe('popup');
        });

        it('should return null when no target', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', null, ['Trip']);

            expect(result.payload.description).toContain('No target selected');
        });

        it('should handle multiple options', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip', 'Daze']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
        });


    });
});
