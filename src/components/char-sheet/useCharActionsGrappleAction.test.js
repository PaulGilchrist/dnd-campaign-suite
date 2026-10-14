import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import {
    createHooks,
    mockRollAbilityCheck,
    mockSetPopupHtml,
    mockAddEntry,
    mockLoadCombatSummary,
    campaignName,
    basePlayerStats,
} from './useCharActionsBaseActions.test-utils.js';

const defaultCs = {
    creatures: [
        { name: 'TestFighter', targetName: 'TargetCreature' },
        {
            name: 'TargetCreature',
            conditions: [],
            computedStats: { abilities: [{ name: 'Strength', bonus: 2 }] },
        },
    ],
};

const defaultGrv = vi.fn((charKey, key) => {
    if (key === 'lastAttack') return { total: 18, d20: 12 };
    return undefined;
});

function createDefaultHooks(overrides = {}) {
    return createHooks({
        loadCombatSummary: () => Promise.resolve(defaultCs),
        getRuntimeValue: defaultGrv,
        ...overrides,
    });
}

describe('useCharActionsBaseActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleGrappleAction', () => {
        it('returns early when cannotAct is true', async () => {
            const hooks = createHooks({ cannotAct: true });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockLoadCombatSummary).not.toHaveBeenCalled();
            expect(mockSetPopupHtml).not.toHaveBeenCalled();
        });

        it('shows popup when combat summary is null', async () => {
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(null),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Grapple',
                description: 'No target selected. Select a target in combat first.',
            });
        });

        it('shows popup when combat summary has no creatures', async () => {
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve({ creatures: [] }),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Grapple',
                description: 'No target selected. Select a target in combat first.',
            });
        });

        it('shows popup when attacker has no targetName', async () => {
            const cs = {
                creatures: [{ name: 'TestFighter', conditions: [] }],
            };
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Grapple',
                description: 'No target selected. Select a target in combat first.',
            });
        });

        it('shows popup when target is already grappled', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    { name: 'TargetCreature', conditions: ['grappled'], computedStats: { abilities: [] } },
                ],
            };
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Grapple',
                description: 'Target is already grappled.',
            });
        });

        it('performs grapple ability check and shows success popup when roll exceeds target STR', async () => {
            const hooks = createDefaultHooks({
                setRuntimeValue: vi.fn().mockResolvedValue(undefined),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockRollAbilityCheck).toHaveBeenCalledWith(
                'Strength',
                expect.any(Number),
                expect.any(Object),
            );
            expect(mockSetPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: expect.stringContaining('Grapple successful'),
                }),
            );
            expect(mockAddEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestFighter',
                    abilityName: 'Grapple',
                }),
            );
        });

        it('performs grapple ability check and shows failure popup when roll does not exceed target STR', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    {
                        name: 'TargetCreature',
                        conditions: [],
                        computedStats: { abilities: [{ name: 'Strength', bonus: 5 }] },
                    },
                ],
            };
            const grv = vi.fn((charKey, key) => {
                if (key === 'lastAttack') return { total: 4, d20: 0 };
                return undefined;
            });
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                getRuntimeValue: grv,
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: expect.stringContaining('Grapple failed'),
                }),
            );
        });

        it('uses Dexterity for monk instead of Strength', async () => {
            const monkStats = {
                ...basePlayerStats,
                class: { name: 'Monk' },
                abilities: [
                    { name: 'Strength', bonus: 2 },
                    { name: 'Dexterity', bonus: 5 },
                    { name: 'Wisdom', bonus: 1 },
                    { name: 'Constitution', bonus: 3 },
                    { name: 'Intelligence', bonus: 0 },
                    { name: 'Charisma', bonus: 0 },
                ],
            };
            const hooks = createDefaultHooks({ playerStats: monkStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockRollAbilityCheck).toHaveBeenCalledWith(
                'Dexterity',
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('applies Jack of All Trades half-proficiency bonus to grapple check', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: { passives: [{ type: 'jack_of_all_trades' }] },
            };
            const hooks = createDefaultHooks({ playerStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockRollAbilityCheck).toHaveBeenCalled();
        });

        it('applies peerlessAthleteAdvantageSkills for monk', async () => {
            const monkStats = {
                ...basePlayerStats,
                class: { name: 'Monk' },
                abilities: [
                    { name: 'Strength', bonus: 2 },
                    { name: 'Dexterity', bonus: 5 },
                    { name: 'Wisdom', bonus: 1 },
                    { name: 'Constitution', bonus: 3 },
                    { name: 'Intelligence', bonus: 0 },
                    { name: 'Charisma', bonus: 0 },
                ],
            };
            const hooks = createDefaultHooks({
                playerStats: monkStats,
                conditionEffects: { peerlessAthleteAdvantageSkills: ['Dexterity'] },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockRollAbilityCheck).toHaveBeenCalledWith(
                'Dexterity',
                expect.any(Number),
                { forcedMode: 'advantage' },
            );
        });

        it('applies strCheckDisadvantage condition', async () => {
            const hooks = createDefaultHooks({
                conditionEffects: { strCheckDisadvantage: true },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockRollAbilityCheck).toHaveBeenCalledWith(
                'Strength',
                expect.any(Number),
                { forcedMode: 'disadvantage' },
            );
        });

        it('applies hexAbilityCheckDisadvantage for matching ability', async () => {
            const hooks = createDefaultHooks({
                conditionEffects: {
                    hexAbilityCheckDisadvantage: true,
                    hexAbilityCheckDisadvantageAbility: 'Strength',
                },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockRollAbilityCheck).toHaveBeenCalledWith(
                'Strength',
                expect.any(Number),
                { forcedMode: 'disadvantage' },
            );
        });

        it('does not apply hexAbilityCheckDisadvantage for non-matching ability (monk)', async () => {
            const monkStats = {
                ...basePlayerStats,
                class: { name: 'Monk' },
                abilities: [
                    { name: 'Strength', bonus: 2 },
                    { name: 'Dexterity', bonus: 5 },
                    { name: 'Wisdom', bonus: 1 },
                    { name: 'Constitution', bonus: 3 },
                    { name: 'Intelligence', bonus: 0 },
                    { name: 'Charisma', bonus: 0 },
                ],
            };
            const hooks = createDefaultHooks({
                playerStats: monkStats,
                conditionEffects: {
                    hexAbilityCheckDisadvantage: true,
                    hexAbilityCheckDisadvantageAbility: 'Strength',
                },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockRollAbilityCheck).toHaveBeenCalledWith(
                'Dexterity',
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('overrides disadvantage with abilityCheckAdvantage', async () => {
            const hooks = createDefaultHooks({
                conditionEffects: {
                    strCheckDisadvantage: true,
                    abilityCheckAdvantage: true,
                },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockRollAbilityCheck).toHaveBeenCalledWith(
                'Strength',
                expect.any(Number),
                { forcedMode: undefined },
            );
        });

        it('gets target STR from computedStats.abilities', async () => {
            const hooks = createDefaultHooks({
                setRuntimeValue: vi.fn().mockResolvedValue(undefined),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: expect.stringContaining('+2'),
                }),
            );
        });

        it('gets target STR from target.abilities fallback', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    { name: 'TargetCreature', conditions: [], abilities: [{ name: 'Strength', bonus: 3 }] },
                ],
            };
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                getRuntimeValue: defaultGrv,
                setRuntimeValue: vi.fn().mockResolvedValue(undefined),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: expect.stringContaining('+3'),
                }),
            );
        });

        it('gets target STR from ability_score_modifiers.str fallback', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    { name: 'TargetCreature', conditions: [], type: 'npc', ability_score_modifiers: { str: 4 } },
                ],
            };
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                getRuntimeValue: defaultGrv,
                getMonsterData: vi.fn().mockResolvedValue(null),
                setRuntimeValue: vi.fn().mockResolvedValue(undefined),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: expect.stringContaining('+4'),
                }),
            );
        });

        it('gets target STR from monster data when all else fails', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    { name: 'TargetCreature', conditions: [], type: 'monster' },
                ],
            };
            const grv = vi.fn((charKey, key) => {
                if (key === 'lastAttack') return { total: 3, d20: 0 };
                return undefined;
            });
            const gmd = vi.fn().mockResolvedValue({ ability_score_modifiers: { str: 5 } });
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                getRuntimeValue: grv,
                getMonsterData: gmd,
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(gmd).toHaveBeenCalledWith('TargetCreature', expect.any(Array));
            expect(mockSetPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: expect.stringContaining('Grapple failed'),
                }),
            );
        });

        it('gets target STR from player creature in combat summary', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    { name: 'TargetCreature', type: 'player' },
                    {
                        name: 'TargetCreature',
                        computedStats: { abilities: [{ name: 'Strength', bonus: 6 }] },
                    },
                ],
            };
            const grv = vi.fn((charKey, key) => {
                if (key === 'lastAttack') return { total: 18, d20: 12 };
                if (charKey === 'TargetCreature') return [];
                return undefined;
            });
            const gmd = vi.fn().mockResolvedValue(null);
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                getRuntimeValue: grv,
                getMonsterData: gmd,
                setRuntimeValue: vi.fn().mockResolvedValue(undefined),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(gmd).not.toHaveBeenCalled();
        });

        it('sets grappled condition on target creature when grapple succeeds', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    { name: 'TargetCreature', conditions: [], computedStats: { abilities: [{ name: 'Strength', bonus: 1 }] } },
                ],
            };
            const srw = vi.fn().mockResolvedValue(undefined);
            const grv = vi.fn((charKey, key) => {
                if (key === 'lastAttack') return { total: 18, d20: 12 };
                if (charKey === 'TargetCreature') return [];
                return undefined;
            });
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                getRuntimeValue: grv,
                setRuntimeValue: srw,
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(srw).toHaveBeenCalledWith(
                'TargetCreature',
                'activeConditions',
                expect.arrayContaining(['grappled']),
                campaignName,
            );
        });

        it('filters out existing grappled condition before re-adding it', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    { name: 'TargetCreature', conditions: [], computedStats: { abilities: [{ name: 'Strength', bonus: 1 }] } },
                ],
            };
            const srw = vi.fn().mockResolvedValue(undefined);
            const grv = vi.fn((charKey, key) => {
                if (key === 'lastAttack') return { total: 18, d20: 12 };
                if (charKey === 'TargetCreature') return ['grappled', 'poisoned'];
                return undefined;
            });
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                getRuntimeValue: grv,
                setRuntimeValue: srw,
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(srw).toHaveBeenCalledWith(
                'TargetCreature',
                'activeConditions',
                ['poisoned', 'grappled'],
                campaignName,
            );
        });

        it('handles undefined target activeConditions gracefully', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    { name: 'TargetCreature', conditions: [], computedStats: { abilities: [{ name: 'Strength', bonus: 1 }] } },
                ],
            };
            const srw = vi.fn().mockResolvedValue(undefined);
            const grv = vi.fn((charKey, key) => {
                if (key === 'lastAttack') return { total: 18, d20: 12 };
                return undefined;
            });
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                getRuntimeValue: grv,
                setRuntimeValue: srw,
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(srw).toHaveBeenCalledWith(
                'TargetCreature',
                'activeConditions',
                ['grappled'],
                campaignName,
            );
        });

        it('applies exhaustionPenalty to grapple check bonus', async () => {
            const hooks = createDefaultHooks({ exhaustionPenalty: 2 });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockRollAbilityCheck).toHaveBeenCalled();
        });

        it('formats positive STR bonus with + sign in popup', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    { name: 'TargetCreature', conditions: [], computedStats: { abilities: [{ name: 'Strength', bonus: 3 }] } },
                ],
            };
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                getRuntimeValue: defaultGrv,
                setRuntimeValue: vi.fn().mockResolvedValue(undefined),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: expect.stringContaining('+3'),
                }),
            );
        });

        it('formats negative STR bonus with minus sign in popup', async () => {
            const cs = {
                creatures: [
                    { name: 'TestFighter', targetName: 'TargetCreature' },
                    { name: 'TargetCreature', conditions: [], computedStats: { abilities: [{ name: 'Strength', bonus: -2 }] } },
                ],
            };
            const hooks = createHooks({
                loadCombatSummary: () => Promise.resolve(cs),
                getRuntimeValue: defaultGrv,
                setRuntimeValue: vi.fn().mockResolvedValue(undefined),
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleGrappleAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: expect.stringContaining('-2'),
                }),
            );
        });

        it('returns the three action handlers', async () => {
            const hooks = createHooks();
            const actions = useCharActionsBaseActions(hooks);

            expect(typeof actions.handleHideAction).toBe('function');
            expect(typeof actions.handleDodgeAction).toBe('function');
            expect(typeof actions.handleGrappleAction).toBe('function');
        });
    });
});
