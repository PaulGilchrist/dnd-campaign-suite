// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
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
        describe('no secondary target', () => {
            it('returns an automation_info popup with default name and description', async () => {
                const result = await applyVersatileTrickster(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    null
                );

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Versatile Trickster');
                expect(result.payload.automationType).toBe('versatile_trickster');
                expect(result.payload.description).toBe(
                    'Versatile Trickster: No secondary target selected.'
                );
                expect(result.payload.automation).toEqual({
                    type: 'versatile_trickster',
                });
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
            });

            it('uses custom action name and automation type when provided', async () => {
                const result = await applyVersatileTrickster(
                    makeAction({
                        name: 'MyFeature',
                        automation: { type: 'custom_type', extra: 'data' },
                    }),
                    makePlayerStats(),
                    'test-campaign',
                    null
                );

                expect(result.payload.name).toBe('MyFeature');
                expect(result.payload.automationType).toBe('custom_type');
                expect(result.payload.automation).toEqual({
                    type: 'custom_type',
                    extra: 'data',
                });
            });
        });

        describe('size validation', () => {
            it('applies Trip to targets up to Large size', async () => {
                const sizes = [
                    { name: 'TinyCreature', size: 'Tiny' },
                    { name: 'SmallGoblin', size: 'Small' },
                    { name: 'HumanGuard', size: 'Medium' },
                    { name: 'Ogre', size: 'Large' },
                ];

                for (const creature of sizes) {
                    getCombatContext.mockResolvedValue(
                        makeCombatContext([creature])
                    );

                    const result = await applyVersatileTrickster(
                        makeAction(),
                        makePlayerStats(),
                        'test-campaign',
                        creature.name
                    );

                    expect(result.type).toBe('popup');
                    expect(result.payload.type).toBe('automation_info');
                    expect(result.payload.description).toContain(
                        `Trip also applied to ${creature.name}`
                    );
                    expect(result.payload.description).toContain('Dexterity');
                    expect(setRuntimeValue).toHaveBeenCalledWith(
                        'campaign',
                        'targetEffects',
                        expect.arrayContaining([
                            expect.objectContaining({
                                target: creature.name,
                                effect: 'prone',
                                sizeLimit: 'large_or_smaller',
                                saveType: 'DEX',
                            }),
                        ]),
                        'test-campaign'
                    );
                    expect(addEntry).toHaveBeenCalledWith(
                        'test-campaign',
                        expect.objectContaining({
                            type: 'ability_use',
                            abilityName: 'Versatile Trickster',
                            description: expect.stringContaining(
                                `Trip applied to ${creature.name}`
                            ),
                        })
                    );
                }
            });

            it.each([
                { name: 'T-Rex', size: 'Huge' },
                { name: 'Titan', size: 'Gargantuan' },
            ])('blocks Trip on $size targets ($name)', async ({ name, size }) => {
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
                expect(result.payload.description).toContain(
                    `<b>Trip</b> cannot be used on ${name}`
                );
                expect(result.payload.description).toContain(
                    `${size} (too large for Trip`
                );
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
            });
        });

        describe('missing or unknown target in combat context', () => {
            it('applies Trip when target is not found in creatures array', async () => {
                getCombatContext.mockResolvedValue(
                    makeCombatContext([
                        { name: 'OtherCreature', size: 'Small' },
                    ])
                );

                const result = await applyVersatileTrickster(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    'UnknownCreature'
                );

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain(
                    'Trip also applied to UnknownCreature'
                );
                expect(setRuntimeValue).toHaveBeenCalled();
            });

            it('applies Trip when combat context is null or creatures array is missing', async () => {
                getCombatContext.mockResolvedValue(null);

                const result = await applyVersatileTrickster(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    'UnknownTarget'
                );

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain(
                    'Trip also applied to UnknownTarget'
                );
                expect(setRuntimeValue).toHaveBeenCalled();
            });
        });

        describe('targetEffects persistence', () => {
            it('appends the Trip effect to existing targetEffects', async () => {
                const existingEffect = {
                    target: 'OldTarget',
                    effect: 'blinded',
                };
                getRuntimeValue.mockReturnValue([existingEffect]);
                getCombatContext.mockResolvedValue(
                    makeCombatContext([
                        { name: 'NewTarget', size: 'Medium' },
                    ])
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
                        effect: 'prone',
                    })
                );
            });

            it('uses custom source name from action in the effect', async () => {
                getCombatContext.mockResolvedValue(
                    makeCombatContext([
                        { name: 'Goblin', size: 'Small' },
                    ])
                );

                await applyVersatileTrickster(
                    makeAction({ name: 'Trickster Maneuver' }),
                    makePlayerStats(),
                    'test-campaign',
                    'Goblin'
                );

                const effectCalls = setRuntimeValue.mock.calls.filter(
                    (c) => c[1] === 'targetEffects'
                );
                expect(effectCalls[0][2][0].source).toBe('Trickster Maneuver');
            });
        });

        describe('logging', () => {
            it('logs ability_use entry with correct fields', async () => {
                getCombatContext.mockResolvedValue(
                    makeCombatContext([
                        { name: 'Goblin', size: 'Small' },
                    ])
                );

                await applyVersatileTrickster(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    'Goblin'
                );

                expect(addEntry).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        type: 'ability_use',
                        characterName: 'TestRogue',
                        abilityName: 'Versatile Trickster',
                        description: expect.stringContaining(
                            'Trip applied to Goblin'
                        ),
                    })
                );
            });

            it('gracefully handles log failure without throwing', async () => {
                addEntry.mockRejectedValueOnce(new Error('network error'));
                createSaveListener.mockReturnValue({
                    promptId: 'p-test',
                    promise: Promise.resolve({ success: true, roll: 20, saveBonus: 2, total: 22 }),
                });
                getCombatContext.mockResolvedValue(
                    makeCombatContext([
                        { name: 'Goblin', size: 'Small' },
                    ])
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

            it('applies prone condition to the secondary target on a failed save and logs the roll', async () => {
                createSaveListener.mockReturnValue({
                    promptId: 'p-test',
                    promise: Promise.resolve({ success: false, roll: 5, saveBonus: 2, total: 7 }),
                });
                getCombatContext.mockResolvedValue(
                    makeCombatContext([{ name: 'Thug 2', size: 'Medium' }])
                );
                getRuntimeValue.mockImplementation((key, prop) => {
                    if (prop === 'targetEffects') return [];
                    if (key === 'Thug 2' && prop === 'activeConditions') return [];
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
                expect(proneWrites[0][2]).toContain('prone');
                expect(result.payload.description).toContain('failed');
                expect(result.payload.description).toContain('Prone');
                expect(addEntry).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        type: 'ability_use',
                        abilityName: 'Versatile Trickster',
                        description: expect.stringContaining('rolled 5 on DEX save (DC 16)'),
                    })
                );
            });

            it('does NOT write prone condition on a succeeded save', async () => {
                getCombatContext.mockResolvedValue(
                    makeCombatContext([{ name: 'Thug 2', size: 'Medium' }])
                );

                const result = await applyVersatileTrickster(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    'Thug 2'
                );

                const proneWrites = setRuntimeValue.mock.calls.filter(
                    (c) => c[0] === 'Thug 2' && c[1] === 'activeConditions'
                );
                expect(proneWrites).toHaveLength(0);
                expect(result.payload.description).toContain('succeeded');
            });
        });
    });
});
