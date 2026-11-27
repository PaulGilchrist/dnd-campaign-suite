// @maintained-by-ai 2026-11-26
// @created-by-ai
// CLA-389 gate sub-lane: d20 nat-20 gate ordering before the Controlled Chaos branch.
// A lv14+ controlled-chaos caster must NOT see the double-roll chooser on a
// non-20 slot cast — the gate rolls first, the chooser opens only when a
// surge-table roll actually occurs.
import {
    handle,
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

// Canonical dice lane mock (fix#169 recipe): gate d20 via rollD20, surge-table
// d100 via rollDie. Lane bytes otherwise untouched — CLA-389 gate ordering,
// armed-flag consumption and chooser-vs-gate assertions stay verbatim; only
// the retired shared-Math.random rig becomes exact seed pins.
vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollDie: vi.fn(),
}));

import * as diceRoller from '../../../dice/diceRoller.js';

const surgeTable = [
    { min: 1, max: 50, effect: 'Surge effect A' },
    { min: 51, max: 100, effect: 'Surge effect B' },
];

function makeAction(auto = {}) {
    return {
        name: 'Wild Magic Surge',
        automation: { type: 'wild_magic_surge', ...auto },
    };
}

// lv14 Controlled Chaos: the double-roll passive on the character sheet. The
// surge table lives on playerStats — handle() reads it only from there.
function lv14PlayerStats() {
    return {
        name: 'TestSorcerer',
        wildMagicSurgeTable: surgeTable,
        automation: {
            passives: [
                { type: 'wild_magic_surge', name: 'Wild Magic Surge' },
                { type: 'auto_effect', effect: 'wild_magic_double_roll', name: 'Controlled Chaos' },
            ],
        },
    };
}

describe('wildMagicSurgeHandler CLA-389 gate ordering', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(null);
        damageUtils.getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestSorcerer' });
    });

    describe.each([
        {
            label: 'armed wildMagicDoubleRoll runtime flag',
            d20: 11,
            armRuntimeFlag: true,
            // The armed stamp is consumed at the gate — it never survives a
            // miss. That single write is the ONLY commit: no surgeUsedRound
            // mark on a gate miss (the latch stays re-usable).
            expectedWrites: [['TestSorcerer', 'wildMagicDoubleRoll', false, 'campaign', true]],
        },
        {
            label: 'lv14 wild_magic_double_roll passive',
            d20: 3,
            armRuntimeFlag: false,
            // Zero-spend census: a passive cannot arm the runtime stamp, so a
            // gate miss writes nothing at all — no chooser, no disarm, no latch.
            expectedWrites: [],
        },
    ])('gate MISS ($label): popup+log, no chooser, no surge-table d100', ({ d20, armRuntimeFlag, expectedWrites }) => {
        it('short-circuits before the Controlled Chaos chooser', async () => {
            // Gate d20 seed-pin (not a 20)
            diceRoller.rollD20.mockReturnValue(d20);
            if (armRuntimeFlag) {
                runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'wildMagicDoubleRoll') return true;
                    return null;
                });
            }

            const result = await handle(makeAction(), lv14PlayerStats(), 'campaign', 'map');

            // Full-shape popup pin: the gate miss is an info popup, never a
            // modal (no modalName key exists at all).
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Wild Magic Surge',
                    description: `Wild Magic Surge: Rolled ${d20} (not a 20). No surge occurs.`,
                    automation: { type: 'wild_magic_surge' },
                },
            });
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
                description: `Wild Magic Surge: Rolled ${d20} on d20 (not a 20). No surge occurs.`,
            }));
            // Exact ordered commit census of every runtime write the miss makes.
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual(expectedWrites);
            // Gate miss: exactly one gate d20, no surge-table d100 ever rolled.
            expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
            expect(diceRoller.rollDie).not.toHaveBeenCalled();
        });
    });

    it('gate HIT (nat-20) via lv14 controlled-chaos passive alone: opens controlledChaos chooser with both d100 faces', async () => {
        diceRoller.rollD20.mockReturnValue(20); // gate d20 = 20
        diceRoller.rollDie.mockReturnValue(100); // both d100 chooser faces = 100

        const playerStats = lv14PlayerStats();
        const result = await handle(makeAction(), playerStats, 'campaign', 'map');

        // Full-shape modal pin: passive-only (runtime stamp never armed) still
        // reaches the chooser once the gate passes, with table passthrough.
        expect(result).toEqual({
            type: 'modal',
            modalName: 'wildMagicSurge',
            payload: {
                featureName: 'Wild Magic Surge',
                surgeTable,
                campaignName: 'campaign',
                playerStats,
                mode: 'controlledChaos',
                roll1: 100,
                roll2: 100,
            },
        });
        // Ordered commit census: unconditional stamp-disarm write, then the
        // once-per-turn latch mark. Nothing else is written; the chooser-open
        // logs no campaign row.
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
            ['TestSorcerer', 'wildMagicDoubleRoll', false, 'campaign', true],
            ['TestSorcerer', 'surgeUsedRound', { round: 1, activeCreature: 'TestSorcerer' }, 'campaign'],
        ]);
        expect(logService.addEntry).not.toHaveBeenCalled();
        // Dice census: one gate d20, exactly two chooser d100s.
        expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
        expect(diceRoller.rollDie).toHaveBeenCalledTimes(2);
    });

    // Steady-state coverage lives in the sibling main lane
    // (wildMagicSurgeHandler.test.js): plain nat-20 roll-mode modal
    // ('open roll-mode modal on nat-20...'), once-per-turn latch ('refuse a
    // second activation once the surge is used this round...'), autoSurge
    // bypass, armed-flag nat-20 chooser, and roll-on-table rider bypass.
    // This gate lane pins only the orderings the main lane never exercises:
    // armed flag/passive meeting a gate MISS, and the passive-only affirmative.
});
