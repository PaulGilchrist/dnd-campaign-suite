// @maintained-by-ai 2026-11-27
// Main lane: steady-state wild magic surge behaviour — roll-mode modals, autoSurge
// bypass, once-per-turn latch, and use-marking/consumption happy paths.
// CLA-389 gate-vs-chooser orderings (armed flag/passive meeting a gate MISS, the
// lv14 controlledChaos affirmative pin) live in wildMagicSurgeHandler.cla389-gate.test.js
// and are deliberately NOT re-pinned here.
//
// SHAPES (2026-11-27 trim, 28 → 20 tests): every popup/modal is pinned FULL-SHAPE
// (toEqual, so an added/renamed payload key is a failure) and every handler makes an
// EXACT ORDERED COMMIT CENSUS (`setRuntimeValue.mock.calls` toEqual) plus a log-row
// census. Date.now is frozen so recorded surge rows carry a pin-able timestamp.
// Negative/garbage use-counts were folded away where they hit the SAME `<= 0` branch
// as zero, and the empty-table default is pinned ONCE for both surge modals instead
// of once per lane. The double-roll PASSIVE arming lane and the gate-MISS cells are
// the gate sibling's; not restated here.
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

const NOW = 1700000000000;

const surgeTable = [
    { min: 1, max: 50, effect: 'Surge effect A' },
    { min: 51, max: 100, effect: 'Surge effect B' },
];

// Exact-face seed pins (fix#169 idiom): gate d20 plus one face per requested
// table die. Faces are handed out in order (and repeat after the last one) so
// a two-die chooser lane can prove roll1 and roll2 are SEPARATE rolls.
function mockDice(d20, ...faces) {
    diceRoller.rollD20.mockReturnValue(d20);
    let index = 0;
    diceRoller.rollDie.mockImplementation(() => faces[Math.min(index++, faces.length - 1)]);
}

// Argument-keyed runtime store fake: reads answer only from the seeded keys,
// everything else is null. Re-seeding (never clearing) between calls in a
// composite test keeps the write census cumulative.
function seedRuntime(values = {}) {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => values[key] ?? null);
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

describe('wildMagicSurgeHandler', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        // Frozen clock: the recorded surge rows and log rows carry this stamp.
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
        seedRuntime();
        damageUtils.getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestSorcerer' });
    });

    describe('handle', () => {
        it('should open roll-mode modal on nat-20 with surge-table passthrough and mark surgeUsedRound', async () => {
            mockDice(20, 51); // gate d20 = 20, table d100 = 51
            const playerStats = makePlayerStats({ wildMagicSurgeTable: surgeTable });

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'wildMagicSurge',
                payload: {
                    featureName: 'Wild Magic Surge',
                    surgeTable,
                    campaignName: 'campaign',
                    playerStats,
                    mode: 'roll',
                    roll: 51,
                },
            });
            // The latch mark is the ONLY commit; opening the modal logs no row.
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'surgeUsedRound', { round: 1, activeCreature: 'TestSorcerer' }, 'campaign'],
            ]);
            expect(logService.addEntry).not.toHaveBeenCalled();
            // Dice census: one gate d20, exactly one d100 table die.
            expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
            expect(diceRoller.rollDie).toHaveBeenCalledTimes(1);
            expect(diceRoller.rollDie).toHaveBeenCalledWith(100);
        });

        it('should default surgeTable to an empty array on the roll-mode and tamed modals when the sheet carries no table', async () => {
            mockDice(20, 51);
            const playerStats = makePlayerStats();

            const rollMode = await handle(makeAction(), playerStats, 'campaign', 'map');
            const tamed = await handleTamedSurge(makeAction(), playerStats, 'campaign', 'map');

            expect(rollMode.payload.surgeTable).toEqual([]);
            expect(tamed.payload.surgeTable).toEqual([]);
        });

        it('should open controlledChaos chooser on nat-20 with armed double-roll flag, disarm it and mark surgeUsedRound', async () => {
            seedRuntime({ wildMagicDoubleRoll: true });
            mockDice(20, 33, 77); // gate d20 = 20, chooser d100 faces = 33 and 77
            const playerStats = makePlayerStats({ wildMagicSurgeTable: surgeTable });

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'wildMagicSurge',
                payload: {
                    featureName: 'Wild Magic Surge',
                    surgeTable,
                    campaignName: 'campaign',
                    playerStats,
                    mode: 'controlledChaos',
                    roll1: 33,
                    roll2: 77,
                },
            });
            // Ordered census: stamp consumed, THEN the latch mark. Nothing else.
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'wildMagicDoubleRoll', false, 'campaign', true],
                ['TestSorcerer', 'surgeUsedRound', { round: 1, activeCreature: 'TestSorcerer' }, 'campaign'],
            ]);
            expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
            expect(diceRoller.rollDie).toHaveBeenCalledTimes(2);
        });

        it('should refuse a second activation once the surge is used this round, logging the refusal (CLA-389)', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestSorcerer' });
            seedRuntime({ surgeUsedRound: { round: 3, activeCreature: 'TestSorcerer' } });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Wild Magic Surge',
                    description: 'Wild Magic Surge can only be used once per turn.',
                },
            });
            expect(logService.addEntry.mock.calls).toEqual([['campaign', {
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
                description: 'Wild Magic Surge: already used this turn — no surge roll.',
                timestamp: NOW,
            }]]);
            // refusal short-circuits before any roll or stamp
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
            expect(diceRoller.rollD20).not.toHaveBeenCalled();
            expect(diceRoller.rollDie).not.toHaveBeenCalled();
        });

        it('should bypass latch and nat-20 gate when autoSurge is true, without marking surgeUsedRound', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestSorcerer' });
            // A stamp that WOULD refuse a normal activation, plus a gate die that
            // would normally miss — autoSurge must ignore both and write nothing.
            seedRuntime({ surgeUsedRound: { round: 3, activeCreature: 'TestSorcerer' } });
            mockDice(11, 51);
            const playerStats = makePlayerStats({ wildMagicSurgeTable: surgeTable });

            const result = await handle(makeAction({ autoSurge: true }), playerStats, 'campaign', 'map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'wildMagicSurge',
                payload: {
                    featureName: 'Wild Magic Surge',
                    surgeTable,
                    campaignName: 'campaign',
                    playerStats,
                    mode: 'roll',
                    roll: 51,
                },
            });
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
            expect(diceRoller.rollDie).toHaveBeenCalledTimes(1);
        });

        it('should open the chooser but never mark surgeUsedRound when autoSurge with armed double-roll', async () => {
            seedRuntime({ wildMagicDoubleRoll: true });
            mockDice(4, 33, 77); // gate die deliberately not a 20 — autoSurge ignores it
            const playerStats = makePlayerStats({ wildMagicSurgeTable: surgeTable });

            const result = await handle(makeAction({ autoSurge: true }), playerStats, 'campaign', 'map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'wildMagicSurge',
                payload: {
                    featureName: 'Wild Magic Surge',
                    surgeTable,
                    campaignName: 'campaign',
                    playerStats,
                    mode: 'controlledChaos',
                    roll1: 33,
                    roll2: 77,
                },
            });
            // The stamp is still consumed; the latch is still left alone.
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'wildMagicDoubleRoll', false, 'campaign', true],
            ]);
        });

        it('should bypass the nat-20 gate via roll-on-table rider effect and mark surgeUsedRound', async () => {
            seedRuntime({
                wildMagicSurgeEffects: [{ effect: 'Roll on the surge table at the start of each turn' }],
            });
            mockDice(11, 51); // gate d20 = 11 — gate bypassed by the rider, table d100 = 51
            const playerStats = makePlayerStats({ wildMagicSurgeTable: surgeTable });

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'wildMagicSurge',
                payload: {
                    featureName: 'Wild Magic Surge',
                    surgeTable,
                    campaignName: 'campaign',
                    playerStats,
                    mode: 'roll',
                    roll: 51,
                },
            });
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'surgeUsedRound', { round: 1, activeCreature: 'TestSorcerer' }, 'campaign'],
            ]);
            expect(diceRoller.rollDie).toHaveBeenCalledTimes(1);
        });

        it('should not treat an unrelated active surge effect as the roll-on-table rider', async () => {
            // Near-miss guard: effect bytes that do not name the rider must leave
            // the nat-20 gate in force — a non-surge cast writes nothing at all.
            seedRuntime({ wildMagicSurgeEffects: [{ effect: 'You glow with wild magic' }] });
            mockDice(11);

            const result = await handle(makeAction(), makePlayerStats({ wildMagicSurgeTable: surgeTable }), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.modalName).toBeUndefined();
            expect(result.payload.description).toBe('Wild Magic Surge: Rolled 11 (not a 20). No surge occurs.');
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
            expect(diceRoller.rollDie).not.toHaveBeenCalled();
        });
    });

    describe('handleTamedSurge', () => {
        it('should return the exhausted info popup and write nothing when uses are exhausted', async () => {
            seedRuntime({ tamedSurgeUses: 0 });

            const result = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Wild Magic Surge',
                    description: 'Wild Magic Surge has no uses remaining. Recharges after a Long Rest.',
                    automation: { type: 'wild_magic_surge' },
                },
            });
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should open the tamedSurge modal with table passthrough, defaulting to one use when none is recorded', async () => {
            // Nothing recorded for tamedSurgeUses: the default is one use, so the
            // chooser opens rather than the exhausted popup.
            seedRuntime();
            const playerStats = makePlayerStats({ wildMagicSurgeTable: surgeTable });

            const result = await handleTamedSurge(makeAction(), playerStats, 'campaign', 'map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'wildMagicSurge',
                payload: {
                    featureName: 'Wild Magic Surge',
                    surgeTable,
                    campaignName: 'campaign',
                    playerStats,
                    mode: 'tamedSurge',
                },
            });
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
        });
    });

    describe('onTamedSurgeSelected', () => {
        it('should return null and write nothing when uses are exhausted', async () => {
            seedRuntime({ tamedSurgeUses: 0 });

            const result = await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(result).toBeNull();
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should append the tamed effect before decrementing uses, log, and fall back to the tamed automation type', async () => {
            const earlier = { roll: 9, effect: 'Earlier surge', duration: null, timestamp: NOW };
            seedRuntime({ tamedSurgeUses: 2, wildMagicSurgeEffects: [earlier] });

            const first = await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Chosen tamed effect' });

            expect(first).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Wild Magic Surge',
                    description: '<b>Wild Magic Surge: Tamed Surge!</b><br/><br/>Chosen tamed effect',
                    automation: { type: 'wild_magic_surge' },
                },
            });

            // Second spend reads the state the first wrote (uses 2 → 1, effect
            // appended) and carries a duration plus a null action.automation.
            const chosen = { roll: 'tamed', effect: 'Chosen tamed effect', duration: null, timestamp: NOW };
            seedRuntime({ tamedSurgeUses: 1, wildMagicSurgeEffects: [earlier, chosen] });

            const second = await onTamedSurgeSelected(
                { name: 'Tamed Surge', automation: null },
                makePlayerStats(),
                'campaign',
                { effect: 'Second tamed effect', duration: '1 round' },
            );

            expect(second).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Tamed Surge',
                    description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>Second tamed effect',
                    automation: { type: 'wild_magic_tamed' },
                },
            });

            // Cumulative ordered census: append-then-decrement, twice.
            const secondRecord = { roll: 'tamed', effect: 'Second tamed effect', duration: '1 round', timestamp: NOW };
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'wildMagicSurgeEffects', [earlier, chosen], 'campaign', true],
                ['TestSorcerer', 'tamedSurgeUses', 1, 'campaign', true],
                ['TestSorcerer', 'wildMagicSurgeEffects', [earlier, chosen, secondRecord], 'campaign', true],
                ['TestSorcerer', 'tamedSurgeUses', 0, 'campaign', true],
            ]);
            expect(logService.addEntry.mock.calls).toEqual([
                ['campaign', {
                    type: 'ability_use',
                    characterName: 'TestSorcerer',
                    abilityName: 'Wild Magic Surge',
                    description: 'TestSorcerer used Tamed Surge to select: Chosen tamed effect...',
                    timestamp: NOW,
                }],
                ['campaign', {
                    type: 'ability_use',
                    characterName: 'TestSorcerer',
                    abilityName: 'Tamed Surge',
                    description: 'TestSorcerer used Tamed Surge to select: Second tamed effect...',
                    timestamp: NOW,
                }],
            ]);
        });
    });

    describe('onSurgeSelected', () => {
        it('should append the surge effect, log, and pass duration through (null when the entry has none)', async () => {
            const result = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'First surge effect', duration: '2 rounds' },
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Wild Magic Surge',
                    description: '<b>Wild Magic Surge: SURGE! (Rolled 42)</b><br/><br/>First surge effect',
                    automation: { type: 'wild_magic_surge' },
                },
            });

            // Re-seed as the first write left it, then re-apply the SAME roll with
            // a different effect: the dedup guard is roll AND effect, so this one
            // appends (and a missing duration normalises to null).
            const firstRecord = { roll: 42, effect: 'First surge effect', duration: '2 rounds', timestamp: NOW };
            seedRuntime({ wildMagicSurgeEffects: [firstRecord] });

            const second = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'Second surge effect' },
            );

            expect(second).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Wild Magic Surge',
                    description: '<b>Wild Magic Surge: SURGE! (Rolled 42)</b><br/><br/>Second surge effect',
                    automation: { type: 'wild_magic_surge' },
                },
            });

            const secondRecord = { roll: 42, effect: 'Second surge effect', duration: null, timestamp: NOW };
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'wildMagicSurgeEffects', [firstRecord], 'campaign', true],
                ['TestSorcerer', 'wildMagicSurgeEffects', [firstRecord, secondRecord], 'campaign', true],
            ]);
            expect(logService.addEntry.mock.calls).toEqual([
                ['campaign', {
                    type: 'ability_use',
                    characterName: 'TestSorcerer',
                    abilityName: 'Wild Magic Surge',
                    description: 'TestSorcerer triggered Wild Magic Surge (42): First surge effect',
                    timestamp: NOW,
                }],
                ['campaign', {
                    type: 'ability_use',
                    characterName: 'TestSorcerer',
                    abilityName: 'Wild Magic Surge',
                    description: 'TestSorcerer triggered Wild Magic Surge (42): Second surge effect',
                    timestamp: NOW,
                }],
            ]);
        });

        it('should return null and write nothing when the same roll and effect are already applied', async () => {
            seedRuntime({
                wildMagicSurgeEffects: [{ roll: 42, effect: 'Test surge effect', duration: null, timestamp: NOW }],
            });

            const result = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'Test surge effect' },
            );

            expect(result).toBeNull();
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
            expect(logService.addEntry).not.toHaveBeenCalled();
        });
    });

    describe('handleFeatsOfChaos', () => {
        it('should return the exhausted info popup and write nothing when uses are exhausted', async () => {
            seedRuntime({ featsOfChaosUses: 0 });

            const result = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Feats of Chaos',
                    description: 'Feats of Chaos has no uses remaining. Must cast Sorcerer spell with spell slot or finish Long Rest to recharge.',
                    automation: { type: 'feats_of_chaos' },
                },
            });
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should decrement a recorded use and arm the feature, defaulting to one use when none is recorded', async () => {
            seedRuntime({ featsOfChaosUses: 2 });

            const first = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(first).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Feats of Chaos',
                    description: '<b>Advantage on next D20 test.</b><br/>Next Sorcerer spell cast with spell slot will trigger a Wild Magic Surge and recharge this feature.',
                    automation: { type: 'feats_of_chaos' },
                },
            });

            // Fresh sheet (nothing recorded): the default is one use, spent to 0.
            seedRuntime();

            const second = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            // The popup is state-independent — same full shape on the default lane.
            expect(second).toEqual(first);

            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'featsOfChaosUses', 1, 'campaign', true],
                ['TestSorcerer', 'featsOfChaosActive', true, 'campaign', true],
                ['TestSorcerer', 'featsOfChaosUses', 0, 'campaign', true],
                ['TestSorcerer', 'featsOfChaosActive', true, 'campaign', true],
            ]);
            expect(logService.addEntry.mock.calls).toEqual([
                ['campaign', {
                    type: 'ability_use',
                    characterName: 'TestSorcerer',
                    abilityName: 'Feats of Chaos',
                    description: 'TestSorcerer activated Feats of Chaos: Advantage on next D20 test.',
                    timestamp: NOW,
                }],
                ['campaign', {
                    type: 'ability_use',
                    characterName: 'TestSorcerer',
                    abilityName: 'Feats of Chaos',
                    description: 'TestSorcerer activated Feats of Chaos: Advantage on next D20 test.',
                    timestamp: NOW,
                }],
            ]);
        });
    });

    describe('onFeatsOfChaosConsume', () => {
        it('should consume one remaining use and deactivate the feature', async () => {
            seedRuntime({ featsOfChaosUses: 2 });

            const result = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result).toEqual({ featsOfChaosConsumed: true });
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'featsOfChaosUses', 1, 'campaign', true],
                ['TestSorcerer', 'featsOfChaosActive', false, 'campaign', true],
            ]);
        });

        it('should deactivate without touching uses when the stored count is exhausted or non-numeric', async () => {
            // 0 and a garbage string both fail the `> 0` spend guard, so the only
            // commit each time is the deactivation — never a negative use count.
            seedRuntime({ featsOfChaosUses: 0 });
            const exhausted = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            seedRuntime({ featsOfChaosUses: 'not-a-number' });
            const garbage = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(exhausted).toEqual({ featsOfChaosConsumed: true });
            expect(garbage).toEqual({ featsOfChaosConsumed: true });
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'featsOfChaosActive', false, 'campaign', true],
                ['TestSorcerer', 'featsOfChaosActive', false, 'campaign', true],
            ]);
        });
    });

    describe('onDoubleRollSelected', () => {
        it('should clear the armed stamp and return an info popup when the table is missing or the roll matches no entry', async () => {
            // A null automation on a miss still yields the default surge type.
            const noTable = { name: 'Wild Magic Surge', featureName: 'Wild Magic Surge', surgeTable: [], automation: null };
            const first = await onDoubleRollSelected(noTable, makePlayerStats(), 'campaign', 20);

            expect(first).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Wild Magic Surge',
                    description: 'Wild Magic Surge: No Wild Magic Surge table data available.',
                    automation: { type: 'wild_magic_surge' },
                },
            });

            const noEntry = {
                name: 'Wild Magic Surge',
                featureName: 'Wild Magic Surge',
                surgeTable: [{ min: 1, max: 5, effect: 'Surge 1' }],
            };
            const second = await onDoubleRollSelected(noEntry, makePlayerStats(), 'campaign', 20);

            expect(second).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Wild Magic Surge',
                    description: 'Wild Magic Surge: Selected roll 20 has no matching surge effect.',
                    automation: { type: 'wild_magic_surge' },
                },
            });

            // Both misses still consume the armed stamp (the chooser is over), and
            // nothing else is written: no latch mark, no surge effect, no log row.
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'wildMagicDoubleRoll', false, 'campaign', true],
                ['TestSorcerer', 'wildMagicDoubleRoll', false, 'campaign', true],
            ]);
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should record the matched surge, consume the stamp, mark the latch and log', async () => {
            const action = {
                name: 'Wild Magic Surge',
                featureName: 'Wild Magic Surge',
                automation: { type: 'wild_magic_surge' },
                surgeTable: [{ min: 18, max: 20, effect: 'Big surge!', duration: '1 round' }],
            };

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Wild Magic Surge',
                    description: '<b>Wild Magic Surge: SURGE! (Rolled 20)</b><br/><br/>Big surge!',
                    automation: { type: 'wild_magic_surge' },
                },
            });
            // Ordered census: stamp consumed, latch marked, then the effect appended.
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'wildMagicDoubleRoll', false, 'campaign', true],
                ['TestSorcerer', 'surgeUsedRound', { round: 1, activeCreature: 'TestSorcerer' }, 'campaign'],
                ['TestSorcerer', 'wildMagicSurgeEffects', [
                    { roll: 20, effect: 'Big surge!', duration: '1 round', timestamp: NOW },
                ], 'campaign', true],
            ]);
            expect(logService.addEntry.mock.calls).toEqual([['campaign', {
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
                description: 'TestSorcerer triggered Wild Magic Surge (rolled 20): Big surge!...',
                timestamp: NOW,
            }]]);
        });
    });
});
