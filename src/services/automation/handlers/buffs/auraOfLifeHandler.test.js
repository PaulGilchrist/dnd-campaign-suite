// @improved-by-ai
// @cleaned-by-ai
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

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

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

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

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

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload:                 expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Life',
                    creatureTargets: [],
                }),
            });
        });

        it('includes automation object in popup payload', async () => {
            combatData.getCombatSummary.mockResolvedValue(
                makeCombatSummary(['Cleric'])
            );

            const customAutomation = { type: 'aura_of_life', duration: '1 minute' };
            const action = {
                name: 'Aura of Life',
                automation: customAutomation,
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.automation).toEqual(customAutomation);
        });

        it('uses empty object when action has no automation property', async () => {
            combatData.getCombatSummary.mockResolvedValue(
                makeCombatSummary(['Cleric'])
            );

            const action = { name: 'Aura of Life' };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.automation).toEqual({});
        });
    });

    describe('applyAuraOfLife', () => {
        it('applies buffs, HP protection, targetEffects, and expirations for each target', async () => {
            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await applyAuraOfLife(action, makePlayerStats(), campaignName, null, ['Ally1', 'Ally2']);

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

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            await applyAuraOfLife(action, makePlayerStats(), campaignName, null, ['Ally1']);

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

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            await applyAuraOfLife(action, makePlayerStats(), campaignName, null, ['Ally1']);

            // Dedup check: merged write carries the existing turn-start heal
            // entry without appending a duplicate.
            const merged = vi.mocked(useRuntimeState.setRuntimeObject).mock.calls
                .find(call => call[0] === 'Ally1');
            expect(merged).toBeTruthy();
            expect(merged[1].turnStartEffects).toHaveLength(1);
            expect(merged[1].turnStartEffects[0].type).toBe('aura_of_life_turn_start_heal');
        });

        it('replaces existing targetEffect entry instead of duplicating', async () => {
            const existingEffect = {
                target: 'Ally1',
                effect: 'aura_of_life',
                source: 'Cleric',
                duration: 'concentration',
            };
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') return [];
                if (entity === 'Ally1' && key === 'turnStartEffects') return [];
                if (entity === 'campaign' && key === 'targetEffects') return [existingEffect];
                return null;
            });

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            await applyAuraOfLife(action, makePlayerStats(), campaignName, null, ['Ally1']);

            // Verify targetEffects was set (replacing the existing entry)
            const teCalls = vi.mocked(useRuntimeState.setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(teCalls).toHaveLength(1);
            // The replacement should contain the same effect (not a duplicate)
            expect(teCalls[0][2]).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    target: 'Ally1',
                    effect: 'aura_of_life',
                    source: 'Cleric',
                }),
            ]));
        });

        it('returns null for empty target list', async () => {
            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await applyAuraOfLife(action, makePlayerStats(), campaignName, null, []);
            expect(result).toBeNull();
        });

        it('returns null for undefined target list', async () => {
            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await applyAuraOfLife(action, makePlayerStats(), campaignName, null, null);
            expect(result).toBeNull();
        });

        it('returns null for non-array target list', async () => {
            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await applyAuraOfLife(action, makePlayerStats(), campaignName, null, 'Ally1');
            expect(result).toBeNull();
        });

        it('uses playerStats.name as caster and source', async () => {
            const customStats = makePlayerStats({ name: 'HighPriest' });
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation(() => null);

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            await applyAuraOfLife(action, customStats, campaignName, null, ['Ally1']);

            // Verify caster name used in buff sourceCharacter
            expect(vi.mocked(useRuntimeState.setRuntimeObject))
                .toHaveBeenCalledWith('Ally1', expect.objectContaining({
                    activeBuffs: expect.arrayContaining([
                        expect.objectContaining({ sourceCharacter: 'HighPriest' }),
                    ]),
                }), campaignName);

            // Verify caster name used in targetEffects source
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                    expect.objectContaining({ source: 'HighPriest' }),
                ]), campaignName, true);
        });

        it('calculates concentration DC from concentrationBonus', async () => {
            const statsWithBonus = makePlayerStats({ name: 'Cleric', concentrationBonus: 5 });
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation(() => null);

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            await applyAuraOfLife(action, statsWithBonus, campaignName, null, ['Ally1']);

            // DC = 10 + floor(concentrationBonus) = 10 + 5 = 15
            expect(vi.mocked(concentrationService.addConcentration))
                .toHaveBeenCalledWith(
                    expect.any(Promise),
                    expect.anything(),
                    expect.anything(),
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

        it('returns false when aura buff is not active', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Haste', effect: 'haste', sourceCharacter: 'Cleric' }];
                }
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when no buffs', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [];
                }
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when activeBuffs is null', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((_entity, key) => {
                if (key === 'activeBuffs') return null;
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when activeBuffs is undefined', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((_entity, key) => {
                if (key === 'activeBuffs') return undefined;
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when buff has different effect', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Aura of Life', effect: 'some_other_effect', sourceCharacter: 'Cleric' }];
                }
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when buff has different name', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Circle of Power', effect: 'aura_of_life', sourceCharacter: 'Cleric' }];
                }
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });
    });
});
