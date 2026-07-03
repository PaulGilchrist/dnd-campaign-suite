// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyMasteryEffect, MASTERY_EFFECTS } from './weaponMasteryHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as combatData from '../../../../services/encounters/combatData.js';

// ── Mocks (hoisted — these replace the real modules) ────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Weapon Mastery',
        description: 'Apply a weapon mastery effect.',
        automation: {
            type: 'mastery_rider',
            masteries: ['Vex', 'Push', 'Topple', 'Sap', 'Slow', 'Cleave', 'Nick', 'Graze'],
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        size: 'Medium',
        abilities: [
            { name: 'Constitution', bonus: 2 },
            { name: 'Strength', bonus: 3 },
        ],
        ...overrides,
    };
}

function makeCombatContext(creatures = [{ name: 'Goblin' }]) {
    return { creatures };
}

// ── Tests ────────────────────────────────────────────────────────

describe('weaponMasteryHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(combatData.getCurrentCombatRound).mockReturnValue(1);
    });

    describe('MASTERY_EFFECTS', () => {
        it('should define all 8 mastery effects', () => {
            const expectedKeys = ['Push', 'Topple', 'Sap', 'Slow', 'Vex', 'Cleave', 'Nick', 'Graze'];
            expect(Object.keys(MASTERY_EFFECTS)).toEqual(expectedKeys);
        });
    });

    describe('handle', () => {
        it('should return a modal with available masteries and target info', async () => {
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue(
                makeCombatContext([{ name: 'Ogre', size: 'Huge' }])
            );
            vi.mocked(damageUtils.getTargetFromAttacker).mockReturnValue({ name: 'Ogre' });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'weaponMastery',
                payload: expect.objectContaining({
                    action,
                    playerStats: expect.any(Object),
                    campaignName: 'campaign',
                    targetName: 'Ogre',
                    availableMasteries: ['Vex', 'Push', 'Topple', 'Sap', 'Slow', 'Cleave', 'Nick', 'Graze'],
                }),
            });
        });

        it('should set targetName to null when combat context or target is unavailable', async () => {
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBeNull();
        });

        it('should log an ability_use entry via addEntry', async () => {
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue(makeCombatContext());
            vi.mocked(damageUtils.getTargetFromAttacker).mockReturnValue({ name: 'Goblin' });

            const action = makeAction();
            await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Weapon Mastery',
                description: 'Weapon Mastery available against Goblin',
            }));
        });

        it('should omit target from log description when no target exists', async () => {
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null);

            const action = makeAction();
            await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                description: 'Weapon Mastery available',
            }));
        });

        it('should pass through custom masteries from action.automation', async () => {
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue(makeCombatContext());
            vi.mocked(damageUtils.getTargetFromAttacker).mockReturnValue(null);

            const action = makeAction({ automation: { masteries: ['Vex', 'Graze'] } });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.availableMasteries).toEqual(['Vex', 'Graze']);
        });
    });

    describe('applyMasteryEffect', () => {
        it('should return null for an unknown mastery name', async () => {
            const result = await applyMasteryEffect('Bash', makePlayerStats(), 'campaign', 'Goblin');
            expect(result).toBeNull();
        });

        // ── Push ────────────────────────────────────────────────────

        it('should apply Push for targets within size limit', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue(makeCombatContext([{ name: 'Goblin', size: 'Medium' }]));

            const result = await applyMasteryEffect('Push', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Push');
            expect(result.payload.description).toContain('Push applied');
        });

        it('should reject Push when target is too large', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue(
                makeCombatContext([{ name: 'Ogre', size: 'Huge' }])
            );

            const result = await applyMasteryEffect('Push', makePlayerStats(), 'campaign', 'Ogre');

            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('too large');
            expect(result.payload.description).toContain('Huge');
        });

        // ── Slow ──────────────────────────────────────────────────────

        it('should apply Slow effect', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);

            const result = await applyMasteryEffect('Slow', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Slow applied');
        });

        it('should reject Slow when target already has a Speed reduction from Slow', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([
                { target: 'Goblin', effect: 'speed_reduction', source: 'Slow' },
            ]);

            const result = await applyMasteryEffect('Slow', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.payload.description).toContain('already has Speed reduction from Slow');
        });

        it('should allow Slow on a different target even if one target already has it', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([
                { target: 'Goblin', effect: 'speed_reduction', source: 'Slow' },
            ]);

            const result = await applyMasteryEffect('Slow', makePlayerStats(), 'campaign', 'Ogre');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Slow applied');
        });

        // ── Cleave / Nick (shared once-per-turn pattern) ─────────────

        for (const mastery of ['Cleave', 'Nick']) {
            it(`should apply ${mastery} effect`, async () => {
                vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);

                const result = await applyMasteryEffect(mastery, makePlayerStats(), 'campaign', 'Goblin');

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain(mastery);
            });

            it(`should reject ${mastery} if already used this turn`, async () => {
                vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue(1);

                const result = await applyMasteryEffect(mastery, makePlayerStats(), 'campaign', 'Goblin');

                expect(result.payload.description).toContain('once per turn');
            });

            it(`should allow ${mastery} in a different round`, async () => {
                vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((key, prop) => {
                    if (prop === 'targetEffects') return [];
                    if (prop === `_${mastery}_UsedRound`) return 2;
                    return null;
                });

                const result = await applyMasteryEffect(mastery, makePlayerStats(), 'campaign', 'Goblin');

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain(mastery);
            });
        }

        // ── Topple ────────────────────────────────────────────────────

        it('should apply Topple effect as a passive target effect', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);

            const result = await applyMasteryEffect('Topple', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Topple: ready');
        });

        // ── Vex ───────────────────────────────────────────────────────

        it('should apply Vex effect', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);

            const result = await applyMasteryEffect('Vex', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Vex applied');
        });

        // ── Sap ───────────────────────────────────────────────────────

        it('should apply Sap effect', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);

            const result = await applyMasteryEffect('Sap', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Sap applied');
        });

        // ── Graze ─────────────────────────────────────────────────────

        it('should apply Graze effect', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);

            const result = await applyMasteryEffect('Graze', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Graze');
        });

        it('should default to Strength abilityName when no automation passives define Graze', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);

            await applyMasteryEffect('Graze', makePlayerStats(), 'campaign', 'Goblin');

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        abilityName: 'Strength',
                        abilityMod: 3,
                        duration: 'until_end_of_turn',
                    }),
                ]),
                'campaign',
            );
        });

        it('should use custom abilityName and abilityMod when Graze passive is defined', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);

            const ps = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'weapon_mastery_choice', name: 'Graze', abilityName: 'Dexterity' },
                    ],
                },
            });

            await applyMasteryEffect('Graze', ps, 'campaign', 'Goblin');

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        abilityName: 'Dexterity',
                        abilityMod: 0,
                    }),
                ]),
                'campaign',
            );
        });

        it('should default abilityMod to 0 when the Graze ability is not found', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);

            const ps = makePlayerStats({
                abilities: [{ name: 'Intelligence', bonus: 4 }],
                automation: {
                    passives: [
                        { type: 'weapon_mastery_choice', name: 'Graze', abilityName: 'Dexterity' },
                    ],
                },
            });

            await applyMasteryEffect('Graze', ps, 'campaign', 'Goblin');

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        abilityName: 'Dexterity',
                        abilityMod: 0,
                    }),
                ]),
                'campaign',
            );
        });
    });
});
