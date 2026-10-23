// @maintained-by-ai
// Main lane: steady-state wild magic surge behaviour — roll-mode modals, autoSurge
// bypass, once-per-turn latch, and use-marking/consumption happy paths.
// CLA-389 gate-vs-chooser orderings (armed flag/passive meeting a gate MISS, the
// lv14 controlledChaos affirmative pin) live in wildMagicSurgeHandler.cla389-gate.test.js
// and are deliberately NOT re-pinned here.
import {
    handle,
    handleTamedSurge,
    onTamedSurgeSelected,
    handleFeatsOfChaos,
    onDoubleRollSelected,
    onSurgeSelected,
    onFeatsOfChaosConsume,
} from './wildMagicSurgeHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ round: 1, activeCreatureName: 'TestSorcerer' })),
}));

// Canonical dice lane mock (fix#169 recipe): the nat-20 surge gate die arrives
// via rollD20 and the d100 surge-table dice via rollDie — mockDice is now an
// exact-face seed pin; the old shared-Math.random rigs (one raw value driving
// both dice through floor algebra) are retired.
vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollDie: vi.fn(),
}));

import * as diceRoller from '../../../dice/diceRoller.js';

const surgeTable = [
    { min: 1, max: 50, effect: 'Surge effect A' },
    { min: 51, max: 100, effect: 'Surge effect B' },
];

function mockDice(d20, d100) {
    // Exact-face seed pins (fix#169 idiom): gate d20 and table d100 faces
    // set independently on the canonical diceRoller lane.
    diceRoller.rollD20.mockReturnValue(d20);
    diceRoller.rollDie.mockReturnValue(d100);
}

function makeAction(auto = {}) {
    return {
        name: 'Wild Magic Surge',
        automation: { type: 'wild_magic_surge', ...auto },
    };
}

function makeFoCAction(auto = {}) {
    return {
        name: 'Feats of Chaos',
        automation: { type: 'feats_of_chaos', ...auto },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        ...overrides,
    };
}

function resetRuntimeMocks() {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestSorcerer' });
}

describe('wildMagicSurgeHandler', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(null);
        damageUtils.getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestSorcerer' });
    });

    describe('handle', () => {
        it('should open roll-mode modal on nat-20 with surge-table passthrough and mark surgeUsedRound', async () => {
            mockDice(20, 100); // gate d20 = 20, table d100 = 100

            const result = await handle(
                makeAction(),
                makePlayerStats({ wildMagicSurgeTable: surgeTable }),
                'campaign',
                'map',
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicSurge');
            expect(result.payload.mode).toBe('roll');
            expect(result.payload.roll).toBe(100);
            expect(result.payload.surgeTable).toEqual(surgeTable);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                { round: 1, activeCreature: 'TestSorcerer' },
                'campaign',
            );

            // No table on playerStats → modal still opens with empty surgeTable
            resetRuntimeMocks();
            mockDice(20, 100);

            const emptyResult = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(emptyResult.type).toBe('modal');
            expect(emptyResult.payload.mode).toBe('roll');
            expect(emptyResult.payload.surgeTable).toEqual([]);
        });

        it('should open controlledChaos chooser on nat-20 with armed double-roll flag, disarm it and mark surgeUsedRound', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicDoubleRoll') return true;
                return null;
            });
            mockDice(20, 100); // d20 = 20, d100 rolls = 100

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicSurge');
            expect(result.payload.mode).toBe('controlledChaos');
            expect(result.payload.roll1).toBe(100);
            expect(result.payload.roll2).toBe(100);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicDoubleRoll',
                false,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                { round: 1, activeCreature: 'TestSorcerer' },
                'campaign',
            );
        });

        it('should refuse a second activation once the surge is used this round, logging the refusal (CLA-389)', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestSorcerer' });
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'surgeUsedRound') return { round: 3, activeCreature: 'TestSorcerer' };
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('once per turn');
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
                description: expect.stringContaining('already used this turn'),
            }));
            // refusal short-circuits before any roll or stamp
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(diceRoller.rollD20).not.toHaveBeenCalled();
            expect(diceRoller.rollDie).not.toHaveBeenCalled();
        });

        it('should bypass latch and nat-20 gate when autoSurge is true, without marking surgeUsedRound', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestSorcerer' });
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'surgeUsedRound') return { round: 3, activeCreature: 'TestSorcerer' };
                return null;
            });
            mockDice(11, 51) // gate d20 = 11 (gate would normally refuse), table d100 = 51

            const result = await handle(makeAction({ autoSurge: true }), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('roll');
            expect(result.payload.roll).toBe(51);
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                expect.anything(),
                'campaign',
            );
        });

        it('should open the chooser but never mark surgeUsedRound when autoSurge with armed double-roll', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicDoubleRoll') return true;
                return null;
            });
            mockDice(20, 100);

            const result = await handle(makeAction({ autoSurge: true }), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('controlledChaos');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicDoubleRoll',
                false,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                expect.anything(),
                'campaign',
            );
        });

        it('should bypass the nat-20 gate via roll-on-table rider effect and mark surgeUsedRound', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicSurgeEffects') {
                    return [{ effect: 'Roll on the surge table at the start of each turn' }];
                }
                return null;
            });
            mockDice(11, 51) // gate d20 = 11 — gate bypassed by the rider, table d100 = 51

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('roll');
            expect(result.payload.roll).toBe(51);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                { round: 1, activeCreature: 'TestSorcerer' },
                'campaign',
            );
        });
    });

    describe('handleTamedSurge', () => {
        it('should return info popup and write nothing when uses are exhausted (zero or negative)', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 0;
                return null;
            });

            const result = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');

            resetRuntimeMocks();
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return -1;
                return null;
            });

            const negResult = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(negResult.type).toBe('popup');
            expect(negResult.payload.description).toContain('no uses remaining');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should open tamedSurge modal with table passthrough, defaulting to empty when no table', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const playerStats = makePlayerStats({ wildMagicSurgeTable: surgeTable });
            const result = await handleTamedSurge(makeAction(), playerStats, 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicSurge');
            expect(result.payload.mode).toBe('tamedSurge');
            expect(result.payload.surgeTable).toEqual(surgeTable);

            // No table on playerStats → empty surgeTable
            resetRuntimeMocks();
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const emptyResult = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(emptyResult.type).toBe('modal');
            expect(emptyResult.payload.surgeTable).toEqual([]);
        });

        it('should default to 1 use when runtime value is null/undefined', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('tamedSurge');
        });
    });

    describe('onTamedSurgeSelected', () => {
        it('should return null and write nothing when uses are zero or negative', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 0;
                return null;
            });

            const result = await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(result).toBeNull();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();

            resetRuntimeMocks();
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return -3;
                return null;
            });

            const negResult = await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(negResult).toBeNull();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should decrement uses, record the tamed surge effect, log, and return popup', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const result = await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('<b>Wild Magic Surge: Tamed Surge!</b><br/><br/>Test effect');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'tamedSurgeUses',
                0,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        roll: 'tamed',
                        effect: 'Test effect',
                        duration: null,
                    }),
                ]),
                'campaign',
                true,
            );
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
                description: expect.stringContaining('used Tamed Surge to select: Test effect'),
            }));

            // duration from selectedSurge passes through onto the surge effect
            resetRuntimeMocks();
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Test effect', duration: '1 round' });

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        roll: 'tamed',
                        effect: 'Test effect',
                        duration: '1 round',
                    }),
                ]),
                'campaign',
                true,
            );
        });

        it('should use default automation when action.automation is null', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const action = { name: 'Tamed Surge', automation: null };
            const result = await onTamedSurgeSelected(action, makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(result.type).toBe('popup');
            expect(result.payload.automation.type).toBe('wild_magic_tamed');
        });
    });

    describe('onSurgeSelected', () => {
        it('should store last surge and log to campaign log', async () => {
            const result = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'Test surge effect' }
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('<b>Wild Magic Surge: SURGE! (Rolled 42)</b><br/><br/>Test surge effect');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        roll: 42,
                        effect: 'Test surge effect',
                    }),
                ]),
                'campaign',
                true,
            );
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
                description: expect.stringContaining('Wild Magic Surge (42): Test surge effect'),
            }));
        });

        it('should return null when surge already applied with same roll and effect', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicSurgeEffects') {
                    return [
                        { roll: 42, effect: 'Test surge effect', duration: null, timestamp: 1000 },
                    ];
                }
                return null;
            });

            const result = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'Test surge effect' }
            );

            expect(result).toBeNull();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should allow same roll with different effect', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicSurgeEffects') {
                    return [
                        { roll: 42, effect: 'Different effect', duration: null, timestamp: 1000 },
                    ];
                }
                return null;
            });

            const result = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'New effect' }
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('New effect');
        });

        it('should use default auto type when featureName is falsy', async () => {
            const result = await onSurgeSelected(
                null,
                makePlayerStats(),
                'campaign',
                50,
                { min: 49, max: 52, effect: 'Another effect' }
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('SURGE');
            expect(result.payload.automation.type).toBe('wild_magic_surge');
        });

        it('should include duration from surgeEntry when present or null when absent', async () => {
            const result = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'Test surge effect', duration: '2 rounds' }
            );

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        duration: '2 rounds',
                    }),
                ]),
                'campaign',
                true,
            );

            resetRuntimeMocks();

            await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'Test surge effect' }
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        duration: null,
                    }),
                ]),
                'campaign',
                true,
            );
        });
    });

    describe('handleFeatsOfChaos', () => {
        it('should return info popup and write nothing when uses are exhausted (zero or negative)', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 0;
                return null;
            });

            const result = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();

            resetRuntimeMocks();
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return -2;
                return null;
            });

            const negResult = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(negResult.type).toBe('popup');
            expect(negResult.payload.description).toContain('no uses remaining');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should activate FoC when using dedicated FoC action', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 1;
                return null;
            });

            const result = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Feats of Chaos');
            expect(result.payload.description).toContain('Advantage on next D20 test.');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                0,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosActive',
                true,
                'campaign',
                true,
            );
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Feats of Chaos',
                description: expect.stringContaining('activated Feats of Chaos: Advantage on next D20 test.'),
            }));
        });

        it('should default uses to 1 when runtime value is null/undefined', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Advantage');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                0,
                'campaign',
                true,
            );
        });

        it('should decrement from higher use counts rather than zeroing', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 2;
                return null;
            });

            const result = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                1,
                'campaign',
                true,
            );
        });
    });

    describe('onFeatsOfChaosConsume', () => {
        it('should deactivate FoC and return true flag when uses are 0', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 0;
                return null;
            });

            const result = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.featsOfChaosConsumed).toBe(true);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosActive',
                false,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                expect.anything(),
                'campaign',
                true,
            );
        });

        it('should decrement uses when > 0 and deactivate FoC', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 2;
                return null;
            });

            const result = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.featsOfChaosConsumed).toBe(true);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                1,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosActive',
                false,
                'campaign',
                true,
            );
        });

        it('should default uses to 0 when runtime value is null/non-numeric', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.featsOfChaosConsumed).toBe(true);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosActive',
                false,
                'campaign',
                true,
            );

            resetRuntimeMocks();
            runtimeState.getRuntimeValue.mockReturnValue('not-a-number');

            const nanResult = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(nanResult.featsOfChaosConsumed).toBe(true);
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                expect.anything(),
                'campaign',
                true,
            );
        });
    });

    describe('onDoubleRollSelected', () => {
        it('should return info popup when no surge table', async () => {
            const action = { name: 'Wild Magic Surge', featureName: 'Wild Magic Surge', surgeTable: [] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No Wild Magic Surge table');
        });

        it('should return info popup when no matching surge entry', async () => {
            const action = { name: 'Wild Magic Surge', featureName: 'Wild Magic Surge', surgeTable: [{ min: 1, max: 5, effect: 'Surge 1' }] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no matching surge effect');
        });

        it('should return surge popup when matching entry found, record the effect, and reset runtime state', async () => {
            const action = { name: 'Wild Magic Surge', featureName: 'Wild Magic Surge', surgeTable: [{ min: 18, max: 20, effect: 'Big surge!', duration: '1 round' }] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('<b>Wild Magic Surge: SURGE! (Rolled 20)</b><br/><br/>Big surge!');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        roll: 20,
                        effect: 'Big surge!',
                        duration: '1 round',
                    }),
                ]),
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicDoubleRoll',
                false,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                { round: 1, activeCreature: 'TestSorcerer' },
                'campaign',
            );
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
                description: expect.stringContaining('Wild Magic Surge (rolled 20)'),
            }));
        });

        it('should fall back to default automation when action.automation is null', async () => {
            const action = { name: 'Wild Magic Surge', featureName: 'Wild Magic Surge', surgeTable: [{ min: 18, max: 20, effect: 'Surge!' }], automation: null };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.payload.automation.type).toBe('wild_magic_surge');
        });
    });
});
