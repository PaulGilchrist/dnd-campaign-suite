// @maintained-by-ai
// Deterministic contract tests for auraOfLifeHandler: all external boundaries
// (runtime store, expirations, log, combat data, concentration) are mocked at
// module level, so these tests do not churn when unrelated app code moves.
// NB (flagged to owners): auraOfLifeHandler.js resolveAuraOfLifeParty is an
// inline ally-list implementation slated for consolidation with getAllyList;
// these tests pin the current behaviour of the exported contract via handle.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ─────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { handle, applyAuraOfLife, isAuraOfLifeActive } from './auraOfLifeHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Cleric',
        concentrationBonus: 2,
        ...overrides,
    };
}

function makeCombatSummary(creatureNames = []) {
    return {
        creatures: creatureNames.map((name) => ({ name, type: 'player' })),
    };
}

function makeAction() {
    return { name: 'Aura of Life', automation: { type: 'aura_of_life' } };
}

// ── Tests ────────────────────────────────────────────────────────

describe('auraOfLifeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        // SP-008: party-membership picker (selected allies + caster), NO
        // 5-target cap (Aura of Protection copy removed), honest 10-minute copy.
        it('returns popup with party targets including caster, no target cap', async () => {
            combatData.getCombatSummary.mockResolvedValue(
                makeCombatSummary(['Cleric', 'Ally1', 'Ally2', 'Enemy1'])
            );
            useRuntimeState.getRuntimeValue.mockImplementation((entity, key) => {
                if (entity === 'Cleric' && key === 'selectedAllies') return ['Ally1', 'Ally2'];
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Life',
                    creatureTargets: ['Cleric', 'Ally1', 'Ally2'],
                    automation: { type: 'aura_of_life' },
                }),
            });
            expect(result.payload).not.toHaveProperty('maxTargets');
            expect(result.payload.description).toMatch(/30-foot Emanation/);
            expect(result.payload.description).toMatch(/Concentration, up to 10 minutes/);
        });

        it('falls back leniently to player combatants when no allies are configured', async () => {
            const cs = makeCombatSummary(['Cleric', 'Ally1', 'Enemy1']);
            cs.creatures[2].type = 'monster';
            combatData.getCombatSummary.mockResolvedValue(cs);
            useRuntimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle({ name: 'Aura of Life' }, makePlayerStats(), campaignName, null);

            expect(result.payload.creatureTargets).toEqual(['Cleric', 'Ally1']);
        });

        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Life',
                    description: expect.stringContaining('No combat context found'),
                }),
            });
        });

        it('returns popup with empty creature list when combat has no creatures', async () => {
            combatData.getCombatSummary.mockResolvedValue(makeCombatSummary([]));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Life',
                    creatureTargets: [],
                }),
            });
        });

        it('passes automation through to the popup payload, defaulting to {}', async () => {
            combatData.getCombatSummary.mockResolvedValue(makeCombatSummary(['Cleric']));

            const customAutomation = { type: 'aura_of_life', duration: '1 minute' };
            const custom = await handle({ name: 'Aura of Life', automation: customAutomation }, makePlayerStats(), campaignName, null);
            expect(custom.payload.automation).toEqual(customAutomation);

            const bare = await handle({ name: 'Aura of Life' }, makePlayerStats(), campaignName, null);
            expect(bare.payload.automation).toEqual({});
        });
    });

    describe('applyAuraOfLife', () => {
        it('applies buffs, HP protection, targetEffects, and expirations for each target', async () => {
            const result = await applyAuraOfLife(makeAction(), makePlayerStats(), campaignName, null, ['Ally1', 'Ally2']);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Life',
                    description: expect.stringContaining('2 target(s)'),
                }),
            });

            // SP-008: ONE merged write per target — buff (with honest
            // 10-minute duration label), HP-max flag, and turn-start heal
            // land in a single setRuntimeObject snapshot.
            for (const ally of ['Ally1', 'Ally2']) {
                expect(vi.mocked(useRuntimeState.setRuntimeObject))
                    .toHaveBeenCalledWith(ally, expect.objectContaining({
                        activeBuffs: expect.arrayContaining([
                            expect.objectContaining({
                                name: 'Aura of Life',
                                effect: 'aura_of_life',
                                duration: 'Concentration, up to 10 minutes',
                                resistanceTypes: ['Necrotic'],
                                sourceCharacter: 'Cleric',
                            }),
                        ]),
                        auraOfLifeHpMaxProtected: true,
                        turnStartEffects: expect.arrayContaining([
                            expect.objectContaining({ type: 'aura_of_life_turn_start_heal' }),
                        ]),
                    }), campaignName);
            }

            // Verify targetEffects were set on campaign entity
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Ally1',
                        effect: 'aura_of_life',
                        source: 'Cleric',
                        duration: 'concentration',
                    }),
                ]), campaignName, true);

            // SP-008: explicit 10-minute clock (rounds 100) — the old
            // rounds:undefined + expireOnCreatureName:<caster> anchor expired
            // the aura at the caster's round-2 turn-start (~1 round).
            expect(vi.mocked(expirations.addExpiration)).toHaveBeenCalledTimes(2);
            for (const ally of ['Ally1', 'Ally2']) {
                const calls = vi.mocked(expirations.addExpiration).mock.calls.map(c => c[0]);
                const entry = calls.find(c => c.targetName === ally);
                expect(entry).toBeTruthy();
                expect(entry.rounds).toBe(100);
                expect(entry.expireOnCreatureName).toBeUndefined();
                expect(entry.effects).toEqual(expect.arrayContaining([
                    { type: 'remove_active_buff', buffName: 'Aura of Life' },
                    { type: 'aura_of_life_hp_protection_end' },
                ]));
            }

            // Verify concentration was set with correct parameters
            // Note: handler passes getCombatSummary result directly (Promise) without await
            expect(vi.mocked(concentrationService.addConcentration))
                .toHaveBeenCalledWith(
                    expect.any(Promise),
                    'Cleric',
                    'Aura of Life',
                    12
                );

            // Verify logging for each target
            expect(vi.mocked(logService.addEntry)).toHaveBeenCalledTimes(2);
            expect(vi.mocked(logService.addEntry))
                .toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    type: 'spell_effect',
                    characterName: 'Cleric',
                    spellName: 'Aura of Life',
                    targetName: 'Ally1',
                }));
        });

        it('does not duplicate buff if already active', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Aura of Life', effect: 'aura_of_life', sourceCharacter: 'Cleric' }];
                }
                return null;
            });

            await applyAuraOfLife(makeAction(), makePlayerStats(), campaignName, null, ['Ally1']);

            // Dedup check: the merged write must carry the existing buffs
            // array unchanged (no duplicate Aura of Life entry appended).
            const merged = vi.mocked(useRuntimeState.setRuntimeObject).mock.calls
                .find(call => call[0] === 'Ally1');
            expect(merged).toBeTruthy();
            expect(merged[1].activeBuffs).toHaveLength(1);
            expect(merged[1].activeBuffs[0].name).toBe('Aura of Life');
        });

        it('does not duplicate turnStartEffect if already present', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [];
                }
                if (entity === 'Ally1' && key === 'turnStartEffects') {
                    return [{ type: 'aura_of_life_turn_start_heal', name: 'Aura of Life' }];
                }
                return null;
            });

            await applyAuraOfLife(makeAction(), makePlayerStats(), campaignName, null, ['Ally1']);

            // Dedup check: merged write carries the existing turn-start heal
            // entry without appending a duplicate.
            const merged = vi.mocked(useRuntimeState.setRuntimeObject).mock.calls
                .find(call => call[0] === 'Ally1');
            expect(merged).toBeTruthy();
            expect(merged[1].turnStartEffects).toHaveLength(1);
            expect(merged[1].turnStartEffects[0].type).toBe('aura_of_life_turn_start_heal');
        });

        it('returns null without writing anything for a missing or non-array target list', async () => {
            // te-badge dedup/replace semantics live in registerTargetEffect
            // and are covered in targetEffectDefinitions.test.js — this
            // handler only needs to call it (asserted in the main test).
            for (const targets of [[], null, 'Ally1']) {
                const result = await applyAuraOfLife(makeAction(), makePlayerStats(), campaignName, null, targets);
                expect(result).toBeNull();
            }
            expect(vi.mocked(useRuntimeState.setRuntimeObject)).not.toHaveBeenCalled();
            expect(vi.mocked(useRuntimeState.setRuntimeValue)).not.toHaveBeenCalled();
            expect(vi.mocked(expirations.addExpiration)).not.toHaveBeenCalled();
        });

        it('threads custom caster name and concentration DC through all writes', async () => {
            // name flows into buff sourceCharacter + targetEffects source;
            // DC = 10 + floor(concentrationBonus) = 10 + 5 = 15
            const customStats = makePlayerStats({ name: 'HighPriest', concentrationBonus: 5 });
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation(() => null);

            await applyAuraOfLife(makeAction(), customStats, campaignName, null, ['Ally1']);

            expect(vi.mocked(useRuntimeState.setRuntimeObject))
                .toHaveBeenCalledWith('Ally1', expect.objectContaining({
                    activeBuffs: expect.arrayContaining([
                        expect.objectContaining({ sourceCharacter: 'HighPriest' }),
                    ]),
                }), campaignName);

            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                    expect.objectContaining({ source: 'HighPriest' }),
                ]), campaignName, true);

            expect(vi.mocked(concentrationService.addConcentration))
                .toHaveBeenCalledWith(
                    expect.any(Promise),
                    'HighPriest',
                    'Aura of Life',
                    15
                );
        });
    });

    describe('isAuraOfLifeActive', () => {
        it('returns true when aura buff is active', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Aura of Life', effect: 'aura_of_life', sourceCharacter: 'Cleric' }];
                }
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(true);
        });

        it('returns false when buff name matches but effect differs', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue(
                [{ name: 'Aura of Life', effect: 'some_other_effect', sourceCharacter: 'Cleric' }]
            );
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when effect matches but buff name differs', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue(
                [{ name: 'Circle of Power', effect: 'aura_of_life', sourceCharacter: 'Cleric' }]
            );
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when there are no buffs (empty, null, or undefined)', () => {
            for (const buffs of [[], null, undefined]) {
                vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue(buffs);
                expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
            }
        });
    });
});
