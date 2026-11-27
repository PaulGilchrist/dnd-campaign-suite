// @maintained-by-ai 2026-11-26
// Canonical home for versatileTricksterHandler.applyVersatileTrickster's own
// behaviour: popup/log composition, inline size-order guard (this handler does
// NOT call the shared validateSizeLimit validator — that lives in
// validateSizeLimit.mn015.test.js), Trip descriptor append to an existing
// targetEffects store, save-success descriptor eviction, CLA-376 secondary
// target DEX save dispatch + fail-face prone application, and zero-spend
// refusal censuses. The modal wiring (which mocks this handler) lives in
// AttackRiderModal.versatileTrickster.test.jsx; the primary leg lives in
// attackRiderHandler.vt-primary-save.test.js — neither belongs in this suite.
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

// Store-backed campaign.targetEffects mirror so the save-success eviction is
// observable: the append write lands in the store, and the eviction re-read
// (getRuntimeValue('campaign', 'targetEffects')) sees it. Seeded effects
// exercise the append-preserves-existing and eviction-does-not-collateral
// semantics in one pass.
function installTargetEffectsStore(seed = []) {
    const teStore = { effects: [...seed] };
    getRuntimeValue.mockImplementation((scope, key) =>
        scope === 'campaign' && key === 'targetEffects' ? teStore.effects : null
    );
    setRuntimeValue.mockImplementation(async (scope, key, value) => {
        if (scope === 'campaign' && key === 'targetEffects') {
            teStore.effects = value;
        }
    });
    return teStore;
}

const TRIP_DESCRIPTOR = {
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
};

describe('versatileTricksterHandler', () => {
    describe('applyVersatileTrickster', () => {
        it('returns an automation_info popup and spends nothing at all when no secondary target is selected', async () => {
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
            // Early return: no combat lookup, no store read/write, no save,
            // no log.
            expect(getCombatContext).not.toHaveBeenCalled();
            expect(getRuntimeValue).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(buildSaveDc).not.toHaveBeenCalled();
            expect(createSaveListener).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('propagates a custom action name to the popup fields and the effect source', async () => {
            getCombatContext.mockResolvedValue(
                makeCombatMediumContext('Goblin')
            );
            installTargetEffectsStore();

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
            // Source stamps the descriptor row AND the log line.
            const teWrites = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(teWrites[0][2][0].source).toBe('MyFeature');
            expect(addEntry.mock.calls[0][1].characterName).toBe('TestRogue');
        });

        it('applies Trip at the inclusive Large boundary: append after existing effects, full descriptor/popup/log shape, then evicts the row on save success leaving no prone residue', async () => {
            const existingEffect = { target: 'OldTarget', effect: 'blinded' };
            const teStore = installTargetEffectsStore([existingEffect]);
            getCombatContext.mockResolvedValue(
                makeCombatMediumContext('Ogre', 'Large')
            );

            const result = await applyVersatileTrickster(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                'Ogre'
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Versatile Trickster',
                    automationType: 'versatile_trickster',
                    description: 'Versatile Trickster: Trip attempted on Ogre but Ogre succeeded its Dexterity save (DC 16) — no trip.',
                    automation: { type: 'versatile_trickster' },
                },
            });

            // DG 2026-11-06 improve: the success popup must state the save
            // succeeded and no condition landed — never the old
            // self-contradictory "also applied … no effect" pairing.
            expect(result.payload.description).toContain(
                'succeeded its Dexterity save'
            );
            expect(result.payload.description).not.toMatch(
                /also applied.*no effect/
            );

            // Success face (DG 2026-11-06 improve), ordered commit census:
            // append (existing effect preserved first), then eviction of ONLY
            // the matching Trip row — the unrelated seeded row survives.
            const teWrites = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(teWrites).toEqual([
                [
                    'campaign',
                    'targetEffects',
                    [{ target: 'OldTarget', effect: 'blinded' }, { target: 'Ogre', ...TRIP_DESCRIPTOR }],
                    'test-campaign',
                ],
                [
                    'campaign',
                    'targetEffects',
                    [{ target: 'OldTarget', effect: 'blinded' }],
                    'test-campaign',
                ],
            ]);
            expect(teStore.effects).toEqual([existingEffect]);

            // No activeConditions write on a succeeded save.
            expect(
                setRuntimeValue.mock.calls.some(
                    (c) => c[1] === 'activeConditions'
                )
            ).toBe(false);

            // Success-face log copy says "attempted", never "applied".
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign',
                {
                    type: 'ability_use',
                    characterName: 'TestRogue',
                    abilityName: 'Versatile Trickster',
                    description: 'Trip attempted on Ogre (secondary target via Versatile Trickster) — Ogre rolled 20 on DEX save (DC 16), succeeded — no effect',
                }
            );
        });

        it.each([
            { name: 'T-Rex', size: 'Huge' },
            { name: 'Titan', size: 'Gargantuan' },
        ])('blocks Trip on $size targets ($name) with a zero-spend census', async ({ name, size }) => {
            getCombatContext.mockResolvedValue(
                makeCombatContext([{ name, size }])
            );

            const result = await applyVersatileTrickster(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                name
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Versatile Trickster',
                    automationType: 'versatile_trickster',
                    description: `<b>Trip</b> cannot be used on ${name}: Target is ${size} (too large for Trip — only Large or smaller affected).`,
                    automation: { type: 'versatile_trickster' },
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            // The refusal short-circuits before any save or store read.
            expect(getRuntimeValue).not.toHaveBeenCalled();
            expect(buildSaveDc).not.toHaveBeenCalled();
            expect(createSaveListener).not.toHaveBeenCalled();
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
                    `Versatile Trickster: Trip attempted on ${target} but ${target} succeeded its Dexterity save (DC 16) — no trip.`
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

        it('still returns the popup when the log write rejects', async () => {
            // Persistent (not *Once): beforeEach resetAllMocks restores the
            // factory's resolving implementation for the next test.
            addEntry.mockRejectedValue(new Error('network error'));
            getCombatContext.mockResolvedValue(
                makeCombatMediumContext('Goblin')
            );
            installTargetEffectsStore();

            const result = await applyVersatileTrickster(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                'Goblin'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            // The grant itself completed before the log seam failed.
            expect(
                setRuntimeValue.mock.calls.some((c) => c[1] === 'targetEffects')
            ).toBe(true);
        });

        describe('CLA-376 secondary-target save', () => {
            it('dispatches a real DEX save via buildSaveDc + createSaveListener mirroring the primary leg', async () => {
                getCombatContext.mockResolvedValue(
                    makeCombatMediumContext('Thug 2')
                );
                installTargetEffectsStore();

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

            it('applies prone on a failed save, deduping existing conditions case-insensitively, and logs the full roll line', async () => {
                createSaveListener.mockReturnValue({
                    promptId: 'p-test',
                    promise: Promise.resolve({ success: false, roll: 5, saveBonus: 2, total: 7 }),
                });
                getCombatContext.mockResolvedValue(
                    makeCombatContext([{ name: 'Thug 2', size: 'Medium' }])
                );
                getRuntimeValue.mockImplementation((scope, key) => {
                    if (scope === 'campaign' && key === 'targetEffects') return [];
                    if (scope === 'Thug 2' && key === 'activeConditions') return ['restrained', 'Prone'];
                    return null;
                });

                const result = await applyVersatileTrickster(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    'Thug 2'
                );

                // Ordered commit census on the fail face: descriptor append
                // first (no eviction — save failed), then deduped condition
                // write ('Prone' dropped, lowercase 'prone' appended).
                expect(setRuntimeValue.mock.calls).toEqual([
                    [
                        'campaign',
                        'targetEffects',
                        [{ target: 'Thug 2', ...TRIP_DESCRIPTOR }],
                        'test-campaign',
                    ],
                    [
                        'Thug 2',
                        'activeConditions',
                        ['restrained', 'prone'],
                        'test-campaign',
                    ],
                ]);
                expect(result.payload.description).toBe(
                    'Versatile Trickster: Trip also applied to Thug 2 — failed its Dexterity save (DC 16) and gained the Prone condition.'
                );
                expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                    type: 'ability_use',
                    characterName: 'TestRogue',
                    abilityName: 'Versatile Trickster',
                    description: 'Trip applied to Thug 2 (secondary target via Versatile Trickster) — Thug 2 rolled 5 on DEX save (DC 16), failed — prone condition applied',
                });
            });
        });
    });
});

function makeCombatContext(creatures) {
    return { creatures };
}

function makeCombatMediumContext(name, size = 'Medium') {
    return makeCombatContext([{ name, size }]);
}
