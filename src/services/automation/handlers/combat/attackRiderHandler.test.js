// @improved-by-ai
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
    getCombatContext: vi.fn(async () => ({
        creatures: [{ name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } }],
    })),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Goblin' })),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => 5),
}));

vi.mock('../../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Cunning Strike',
        description: 'Apply a rider effect on a hit.',
        automation: {
            type: 'attack_rider',
            options: [
                { name: 'Trip', effect: 'prone' },
                { name: 'Poison', effect: 'poisoned', requires: "Poisoner's Kit" },
                { name: 'Daze', effect: 'daze' },
                { name: 'Push 15ft', effect: 'push_15ft', value: 15 },
                { name: 'Disadvantage on Save', effect: 'disadvantage_on_next_save' },
                { name: 'No Opportunity Attacks', effect: 'no_opportunity_attacks', movement: true },
                { name: 'Withdraw', effect: 'no_opportunity_attacks', movement: 'half_speed', noOAs: true },
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
        it('should return modal when chooseOne is true', async () => {
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    chooseOne: true,
                    options: [{ name: 'Trip', effect: 'prone' }, { name: 'Daze', effect: 'daze' }],
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('attackRider');
            expect(result.payload.action).toBe(action);
            expect(result.payload.targetName).toBe('Goblin');
        });

        it('should return modal when maxEffects > 1', async () => {
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    maxEffects: 3,
                    options: [{ name: 'Trip', effect: 'prone' }, { name: 'Daze', effect: 'daze' }],
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('attackRider');
        });

        it('should apply immediately when single option and no modal triggers', async () => {
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Trip', effect: 'prone' }],
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
            expect(result.payload.description).toContain('Goblin');
        });

        it('should return ready info when multiple options without chooseOne/maxEffects', async () => {
            const action = makeAction({
                automation: { type: 'attack_rider', options: [{ name: 'Trip', effect: 'prone' }, { name: 'Daze', effect: 'daze' }] },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('ready');
            expect(result.payload.automationType).toBe('attack_rider');
        });

        it('should return ready info when no options', async () => {
            const action = makeAction({
                automation: { type: 'attack_rider', options: [] },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('ready');
        });

        it('should log ability use via addEntry', async () => {
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Trip', effect: 'prone' }],
                },
            });
            await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(addEntry).toHaveBeenCalledWith('campaign', {
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Cunning Strike',
                description: 'Cunning Strike used against Goblin',
            });
        });

        it('should log ability use without target when no target found', async () => {
            vi.mocked(getTargetFromAttacker).mockReturnValue(null);
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Trip', effect: 'prone' }],
                },
            });
            await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(addEntry).toHaveBeenCalledWith('campaign', {
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Cunning Strike',
                description: 'Cunning Strike used',
            });
        });

        it('should handle missing combat context gracefully', async () => {
            vi.mocked(getCombatContext).mockResolvedValue(null);
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Trip', effect: 'prone' }],
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalledWith('campaign', {
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Cunning Strike',
                description: 'Cunning Strike used',
            });
        });
    });

    describe('applyRiderOption', () => {
        it('should return null when no matching options found', async () => {
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Nonexistent']);

            expect(result).toBe(null);
        });

        it('should accept optionNames as a string', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', 'Trip');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
        });

        it('should apply Trip effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
            expect(result.payload.description).toContain('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'campaign');
        });

        it('should allow Trip when sizeLimit specified but size cannot be determined', async () => {
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [{ name: 'Goblin', size: 'Gargantuan' }],
            });
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Trip', effect: 'prone', sizeLimit: 'large_or_smaller' }],
                },
            });
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
        });

        it('should allow Trip when target size cannot be determined (fallback allows)', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
            });
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Trip', effect: 'prone', sizeLimit: 'large_or_smaller' }],
                },
            });
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
        });

        it('should reject Poison without Poisoner\'s Kit', async () => {
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Poison']);

            expect(result.payload.description).toContain("Poisoner's Kit");
            expect(result.payload.description).toContain('cannot be used');
        });

        it('should allow Poison with Poisoner\'s Kit', async () => {
            getRuntimeValue.mockReturnValue([]);
            const stats = makePlayerStats({
                toolProficiencies: ["Poisoner's Kit"],
            });
            const action = makeAction();
            const result = await applyRiderOption(action, stats, 'campaign', 'Goblin', ['Poison']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Poison');
        });

        it('should apply Sudden Strike effect and set runtime value', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Sudden Strike']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Sudden Strike enabled');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'pendingSuddenStrike', true, 'campaign');
        });

        it('should apply Mass Fear effect and set targetEffects', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Mass Fear']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Mass Fear');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'campaign');
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
            expect(result.payload.description).toContain('Disadvantage');
        });

        it('should apply No Opportunity Attacks effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['No Opportunity Attacks']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Opportunity Attacks');
        });

        it('should log Withdraw to campaign log', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Withdraw']);

            expect(addEntry).toHaveBeenCalledWith('campaign', {
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Cunning Strike',
                description: 'Withdraw — TestHero can move up to half Speed without provoking Opportunity Attacks.',
            });
        });

        it('should apply Damage Bonus effect with expression', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Damage Bonus']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('2d6');
        });

        it('should deduct Cunning Strike cost via setRuntimeValue', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Costly Strike', effect: 'poisoned', cost: '2d6' }],
                },
            });
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Costly Strike']);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_cunningStrikeCostUsed', 2, 'campaign');
        });

        it('should return info popup when no target (not null)', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', null, ['Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should handle multiple options with combined description', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip', 'Daze']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
            expect(result.payload.description).toContain('Daze');
        });

        it('should reject oncePerTurn when already used this round', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    oncePerTurn: true,
                    options: [{ name: 'Cunning Strike', effect: 'cleave' }],
                },
            });
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Cunning Strike']);

            expect(result.payload.description).toContain('once per turn');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', '_Cunning_Strike_usedRound', expect.any(Number), 'campaign');
        });

        it('should allow oncePerTurn when not used this round', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    oncePerTurn: true,
                    options: [{ name: 'Cunning Strike', effect: 'cleave' }],
                },
            });
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Cunning Strike']);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_CunningStrike_usedRound', 1, 'campaign');
        });

        it('should clear pendingRiderChoice on apply', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'pendingRiderChoice', null, 'campaign');
        });

        it('should log Cunning Strike cost deduction via addEntry', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Costly Strike', effect: 'poisoned', cost: '2d6' }],
                },
            });
            await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Costly Strike']);

            expect(addEntry).toHaveBeenCalledWith('campaign', {
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Cunning Strike',
                description: 'Forgoing 2d6 Sneak Attack damage dice for Cunning Strike cost.',
            });
        });

        it('should handle Versatile Trickster secondary targets when Trip applied', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [
                    { name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } },
                    { name: 'Skeleton', size: 'Medium', position: { x: 2, y: 1 } },
                ],
            });
            const stats = makePlayerStats({
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'versatile_trickster' }],
                },
            });
            const action = makeAction();
            await applyRiderOption(action, stats, 'campaign', 'Goblin', ['Trip']);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterSecondaryTargets', expect.any(Array), 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterPrimaryTarget', 'Goblin', 'campaign');
        });

        it('should not set Versatile Trickster targets when no passives', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = makeAction();
            await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'versatileTricksterSecondaryTargets', expect.any(Array), 'campaign');
        });

        it('should sum costs for multiple Cunning Strike options', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = {
                name: 'Improved Cunning Strike',
                automation: {
                    type: 'attack_rider',
                    oncePerTurn: true,
                    maxEffects: 2,
                    options: [
                        { name: 'Poison', cost: '1d6', effect: 'poisoned' },
                        { name: 'Trip', cost: '1d6', effect: 'prone' },
                    ],
                },
            };
            await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Poison', 'Trip']);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_cunningStrikeCostUsed', 2, 'campaign');
        });

        it('should use unified _CunningStrike_usedRound key for Improved Cunning Strike', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = {
                name: 'Improved Cunning Strike',
                automation: {
                    type: 'attack_rider',
                    oncePerTurn: true,
                    maxEffects: 2,
                    options: [
                        { name: 'Poison', cost: '1d6', effect: 'poisoned' },
                    ],
                },
            };
            await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Poison']);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_CunningStrike_usedRound', expect.any(Number), 'campaign');
        });

        it('should use unified _CunningStrike_usedRound key for Devious Strikes', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = {
                name: 'Devious Strikes',
                automation: {
                    type: 'attack_rider',
                    oncePerTurn: true,
                    maxEffects: 2,
                    options: [
                        { name: 'Poison', cost: '1d6', effect: 'poisoned' },
                        { name: 'Daze', cost: '2d6', effect: 'daze' },
                    ],
                },
            };
            await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Poison', 'Daze']);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_CunningStrike_usedRound', expect.any(Number), 'campaign');
        });

        it('should reject Improved Cunning Strike once per turn using unified key', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = {
                name: 'Improved Cunning Strike',
                automation: {
                    type: 'attack_rider',
                    oncePerTurn: true,
                    maxEffects: 2,
                    options: [
                        { name: 'Trip', cost: '1d6', effect: 'prone' },
                    ],
                },
            };
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(result.payload.description).toContain('once per turn');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', '_CunningStrike_usedRound', expect.any(Number), 'campaign');
        });

        it('should apply multiple effects and return combined description', async () => {
            getRuntimeValue.mockReturnValue([]);
            const action = {
                name: 'Improved Cunning Strike',
                automation: {
                    type: 'attack_rider',
                    oncePerTurn: true,
                    maxEffects: 2,
                    options: [
                        { name: 'Poison', cost: '1d6', effect: 'poisoned' },
                        { name: 'Trip', cost: '1d6', effect: 'prone' },
                    ],
                },
            };
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Poison', 'Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Poison');
            expect(result.payload.description).toContain('Trip');
            expect(result.payload.description).toContain('Forgoing 2d6 Sneak Attack damage dice');
        });
    });
});
