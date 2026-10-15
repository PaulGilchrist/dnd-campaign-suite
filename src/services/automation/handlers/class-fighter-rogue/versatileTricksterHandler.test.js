// @maintained-by-ai
// Canonical home for versatileTricksterHandler.applyVersatileTrickster's own
// behaviour: popup/log composition, inline size-order guard, targetEffects
// append, CLA-376 secondary-target DEX save, and no-side-effect guards.
// Full-string pins here are this handler's own composition — the shared
// validateSizeLimit validator lives in validateSizeLimit.mn015.test.js and the
// modal wiring (which mocks this handler) lives in
// AttackRiderModal.versatileTrickster.test.jsx; neither belongs in this suite.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 16),
    createSaveListener: vi.fn(() => ({
        promptId: 'p-test',
        promise: Promise.resolve({ success: true, roll: 20, saveBonus: 2, total: 22 }),
    })),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { buildSaveDc, createSaveListener } = await import(
    '../../../automation/common/savePrompt.js'
);
const { getCombatContext } = await import(
    '../../../rules/combat/damageUtils.js'
);
const { addEntry } = await import('../../../ui/logService.js');

import { applyVersatileTrickster } from './versatileTricksterHandler.js';

beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    buildSaveDc.mockReturnValue(16);
    createSaveListener.mockReturnValue({
        promptId: 'p-test',
        promise: Promise.resolve({ success: true, roll: 20, saveBonus: 2, total: 22 }),
    });
});

function makeAction(overrides = {}) {
    return {
        name: 'Versatile Trickster',
        automation: { type: 'versatile_trickster', ...overrides.automation },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestRogue',
        ...overrides,
    };
}

function makeCombatContext(creatures) {
    return { creatures };
}

describe('versatileTricksterHandler', () => {
    describe('applyVersatileTrickster', () => {
        it('returns an automation_info popup with default name and no side effects when no secondary target is selected', async () => {
            const result = await applyVersatileTrickster(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Versatile Trickster',
                    automationType: 'versatile_trickster',
                    description: 'Versatile Trickster: No secondary target selected.',
                    automation: { type: 'versatile_trickster' },
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('propagates a custom action name to the popup fields and the effect source', async () => {
            getCombatContext.mockResolvedValue(
                makeCombatContext([{ name: 'Goblin', size: 'Small' }])
            );

            const result = await applyVersatileTrickster(
                makeAction({
                    name: 'MyFeature',
                    automation: { type: 'custom_type', extra: 'data' },
                }),
                makePlayerStats(),
                'test-campaign',
                'Goblin'
            );

            expect(result.payload.name).toBe('MyFeature');
            expect(result.payload.automationType).toBe('custom_type');
            expect(result.payload.automation).toEqual({
                type: 'custom_type',
                extra: 'data',
            });
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue.mock.calls[0][2][0].source).toBe('MyFeature');
        });

        describe('size validation', () => {
            it('applies Trip to Tiny–Large targets: full popup, effect, and log composition; succeeds; writes no conditions', async () => {
                const sizes = [
                    { name: 'TinyCreature', size: 'Tiny' },
                    { name: 'SmallGoblin', size: 'Small' },
                    { name: 'HumanGuard', size: 'Medium' },
                    { name: 'Ogre', size: 'Large' },
                ];

                for (const creature of sizes) {
                    setRuntimeValue.mockClear();
                    addEntry.mockClear();
                    getCombatContext.mockResolvedValue(
                        makeCombatContext([creature])
                    );

                    const result = await applyVersatileTrickster(
                        makeAction(),
                        makePlayerStats(),
                        'test-campaign',
                        creature.name
                    );

                    expect(result).toEqual({
                        type: 'popup',
                        payload: {
                            type: 'automation_info',
                            name: 'Versatile Trickster',
                            automationType: 'versatile_trickster',
                            description: `Versatile Trickster: Trip also applied to ${creature.name} — succeeded its Dexterity save (DC 16) — no effect.`,
                            automation: { type: 'versatile_trickster' },
                        },
                    });

                    // Exactly one write: the targetEffects append. No
                    // activeConditions write on a succeeded save.
                    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
                    expect(setRuntimeValue).toHaveBeenCalledWith(
                        'campaign',
                        'targetEffects',
                        [
                            {
                                target: creature.name,
                                source: 'Versatile Trickster',
                                option: 'Trip',
                                effect: 'prone',
                                value: null,
                                noOpportunityAttacks: false,
                                duration: 'until_start_of_next_turn',
                                saveType: 'DEX',
                                saveDc: 'ability',
                                saveAbility: 'DEX',
                                condition: 'prone',
                                repeatingSave: false,
                                requires: null,
                                sizeLimit: 'large_or_smaller',
                                movement: null,
                                cost: null,
                                ignoreResistance: false,
                                restoreCost: null,
                            },
                        ],
                        'test-campaign'
                    );

                    expect(addEntry).toHaveBeenCalledTimes(1);
                    expect(addEntry).toHaveBeenCalledWith(
                        'test-campaign',
                        expect.objectContaining({
                            type: 'ability_use',
                            characterName: 'TestRogue',
                            abilityName: 'Versatile Trickster',
                            description: `Trip applied to ${creature.name} (secondary target via Versatile Trickster) — ${creature.name} rolled 20 on DEX save (DC 16), succeeded — no effect`,
                        })
                    );
                }
            });

            it.each([
                { name: 'T-Rex', size: 'Huge' },
                { name: 'Titan', size: 'Gargantuan' },
            ])('blocks Trip on $size targets ($name) with no writes and no log', async ({ name, size }) => {
                getCombatContext.mockResolvedValue(
                    makeCombatContext([{ name, size }])
                );

                const result = await applyVersatileTrickster(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    name
                );

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toBe(
                    `<b>Trip</b> cannot be used on ${name}: Target is ${size} (too large for Trip — only Large or smaller affected).`
                );
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
            });
        });

        describe('target lookup fallbacks', () => {
            it.each([
                {
                    label: 'target is not found in creatures array',
                    context: makeCombatContext([{ name: 'OtherCreature', size: 'Small' }]),
                    target: 'UnknownCreature',
                },
                {
                    label: 'combat context is null',
                    context: null,
                    target: 'UnknownTarget',
                },
                {
                    label: 'target has an unrecognised size string',
                    context: makeCombatContext([{ name: 'MysteryBlob', size: 'Medium-ish' }]),
                    target: 'MysteryBlob',
                },
            ])('applies Trip when $label', async ({ context, target }) => {
                getCombatContext.mockResolvedValue(context);

                const result = await applyVersatileTrickster(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    target
                );

                expect(result.payload.description).toBe(
                    `Versatile Trickster: Trip also applied to ${target} — succeeded its Dexterity save (DC 16) — no effect.`
                );
                expect(setRuntimeValue).toHaveBeenCalledTimes(1);
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'campaign',
                    'targetEffects',
                    expect.arrayContaining([
                        expect.objectContaining({ target, effect: 'prone' }),
                    ]),
                    'test-campaign'
                );
            });
        });

        it('appends the Trip effect after existing targetEffects', async () => {
            const existingEffect = {
                target: 'OldTarget',
                effect: 'blinded',
            };
            getRuntimeValue.mockReturnValue([existingEffect]);
            getCombatContext.mockResolvedValue(
                makeCombatContext([{ name: 'NewTarget', size: 'Medium' }])
            );

            await applyVersatileTrickster(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                'NewTarget'
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(effectCalls).toHaveLength(1);
            const newEffects = effectCalls[0][2];
            expect(newEffects).toHaveLength(2);
            expect(newEffects[0]).toEqual(existingEffect);
            expect(newEffects[1]).toEqual(
                expect.objectContaining({
                    target: 'NewTarget',
                    option: 'Trip',
                    effect: 'prone',
                })
            );
        });

        it('gracefully handles log failure without throwing', async () => {
            addEntry.mockRejectedValueOnce(new Error('network error'));
            getCombatContext.mockResolvedValue(
                makeCombatContext([{ name: 'Goblin', size: 'Small' }])
            );

            const result = await applyVersatileTrickster(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                'Goblin'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });

        describe('CLA-376 secondary-target save', () => {
            it('runs a real DEX save via createSaveListener mirroring the primary leg', async () => {
                getCombatContext.mockResolvedValue(
                    makeCombatContext([{ name: 'Thug 2', size: 'Medium' }])
                );

                await applyVersatileTrickster(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    'Thug 2'
                );

                expect(buildSaveDc).toHaveBeenCalledWith(
                    expect.objectContaining({ saveDc: 'ability', saveAbility: 'DEX' }),
                    expect.objectContaining({ name: 'TestRogue' })
                );
                expect(createSaveListener).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        targetName: 'Thug 2',
                        saveType: 'DEX',
                        saveDc: 16,
                        dcSuccess: false,
                        saveAbility: 'DEX',
                        attackerName: 'TestRogue',
                        condition: 'prone',
                    })
                );
            });

            it('applies prone on a failed save, deduping existing conditions case-insensitively, and logs the roll', async () => {
                createSaveListener.mockReturnValue({
                    promptId: 'p-test',
                    promise: Promise.resolve({ success: false, roll: 5, saveBonus: 2, total: 7 }),
                });
                getCombatContext.mockResolvedValue(
                    makeCombatContext([{ name: 'Thug 2', size: 'Medium' }])
                );
                getRuntimeValue.mockImplementation((key, prop) => {
                    if (prop === 'targetEffects') return [];
                    if (key === 'Thug 2' && prop === 'activeConditions') return ['restrained', 'Prone'];
                    return null;
                });

                const result = await applyVersatileTrickster(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    'Thug 2'
                );

                const proneWrites = setRuntimeValue.mock.calls.filter(
                    (c) => c[0] === 'Thug 2' && c[1] === 'activeConditions'
                );
                expect(proneWrites).toHaveLength(1);
                expect(proneWrites[0][2]).toEqual(['restrained', 'prone']);
                expect(result.payload.description).toBe(
                    'Versatile Trickster: Trip also applied to Thug 2 — failed its Dexterity save (DC 16) and gained the Prone condition.'
                );
                expect(addEntry).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        type: 'ability_use',
                        abilityName: 'Versatile Trickster',
                        description: expect.stringContaining('rolled 5 on DEX save (DC 16)'),
                    })
                );
            });
        });
    });
});
