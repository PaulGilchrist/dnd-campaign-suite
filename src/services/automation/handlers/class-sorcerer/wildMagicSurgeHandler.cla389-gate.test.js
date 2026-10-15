// @created-by-ai
// @maintained-by-ai
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

const surgeTable = [
    { min: 1, max: 50, effect: 'Surge effect A' },
    { min: 51, max: 100, effect: 'Surge effect B' },
];

function mockMathRandom(value) {
    vi.spyOn(global.Math, 'random').mockReturnValue(value);
}

function makeAction(auto = {}) {
    return {
        name: 'Wild Magic Surge',
        automation: { type: 'wild_magic_surge', ...auto },
        wildMagicSurgeTable: surgeTable,
    };
}

function lv14PlayerStats() {
    return {
        name: 'TestSorcerer',
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

    it('non-20 with armed wildMagicDoubleRoll flag: popup+log, no chooser modal', async () => {
        // Math.floor(0.5 * 20) + 1 = 11 (not a 20)
        mockMathRandom(0.5);
        runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'wildMagicDoubleRoll') return true;
            return null;
        });

        const result = await handle(makeAction(), lv14PlayerStats(), 'campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.modalName).toBeUndefined();
        expect(result.payload.description).toContain('Rolled 11');
        expect(result.payload.description).toContain('not a 20');
        expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestSorcerer',
            abilityName: 'Wild Magic Surge',
            description: expect.stringContaining('not a 20'),
        }));
        // armed double-roll stamp is consumed at the gate — it never survives a miss
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer', 'wildMagicDoubleRoll', false, 'campaign', true,
        );
    });

    it('non-20 with lv14 wild_magic_double_roll passive: still no chooser modal', async () => {
        mockMathRandom(0.1); // d20 = 3

        const result = await handle(makeAction(), lv14PlayerStats(), 'campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.modalName).toBeUndefined();
    });

    it('nat-20 with lv14 controlled chaos: opens controlledChaos chooser modal', async () => {
        mockMathRandom(0.99); // d20 = 20, d100 rolls = 100

        const result = await handle(makeAction(), lv14PlayerStats(), 'campaign', 'map');

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('wildMagicSurge');
        expect(result.payload.mode).toBe('controlledChaos');
        expect(result.payload.roll1).toBe(100);
        expect(result.payload.roll2).toBe(100);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer', 'surgeUsedRound',
            { round: 1, activeCreature: 'TestSorcerer' }, 'campaign',
        );
    });

    // Steady-state coverage lives in the sibling main lane
    // (wildMagicSurgeHandler.test.js): plain nat-20 roll modal
    // ('should return modal with roll mode when d20 roll is exactly 20 and
    // table exists'), once-per-turn latch ('should log once-per-turn refusal
    // to campaign log (CLA-389)'), and autoSurge bypass ('should skip
    // once-per-turn check when autoSurge is true'). This gate lane pins only
    // the gate-vs-chooser orderings the main lane never exercises: armed
    // flag/passive meeting a gate MISS, and the exact-rolls affirmative pin.
});
