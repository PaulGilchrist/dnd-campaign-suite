// @maintained-by-ai
// autoRerollHandler — attack-roll reroll seam (numeric-bonus lane).
//
// 5-way seam map for autoRerollHandler.test.js quint:
//   autoRerollHandler.test.js           — router dispatch, Guarded Mind, resource costs,
//                                           bardic/psionic die lanes, ally-range routing
//   autoRerollHandler.attackRoll.test.js (this file) — handleAttackRoll popup description
//                                           full-string composition + rerollAttackLeg
//                                           delegation (exactly-once miss→hit damage)
//   autoRerollHandler.damagePaths.test.js — applyMissTurnedHitDamage payload content
//                                           (own + ally: roll, context, apply, log entry)
//   autoRerollHandler.miscPaths.test.js   — handleAbilityCheck / handleSaveRoll /
//                                           consumeResourceCost / findAllyMissedAttack /
//                                           getBardicDieSize internals
//   autoRerollHandler.soul-blades.test.js — Homing Strikes (CLA-320) gates and economy
//
// Production traffic: numeric-bonus auto_reroll rows in classes/races/feats JSON
// (e.g. Lucky-style flat bonus features) dispatched via automation/index.js.
// Deterministic by construction: this lane never touches Math.random die lanes
// (bardic/psionic) — bonus is a fixed authored number. Turn-based only: no timers.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './autoRerollHandler.js';

// Re-import after mocking
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn((r) => {
        const m = String(r).match(/^(\d+)_?ft$/i);
        return m ? parseInt(m[1], 10) : null;
    }),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

function makeAction(overrides = {}) {
    return {
        name: 'Test Auto Reroll',
        description: 'Reroll ability.',
        automation: {
            type: 'auto_reroll',
            bonus: 2,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        class: { class_levels: [{ level: 1, bardic_inspiration_uses: 3 }] },
        level: 1,
        resources: {},
        ...overrides,
    };
}

function mockLastAttack(attack) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'lastAttack') return attack;
        return null;
    });
}

describe('autoRerollHandler - attack reroll seam (handleAttackRoll popup via rerollAttackLeg)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLastAttack(null);
    });

    it('pins the full popup description for own miss turned into a hit (no formula, no damage side-effects)', async () => {
        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 10 } });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Test Auto Reroll');
        expect(result.payload.description).toBe(
            '<b>Test Auto Reroll</b><br/>' +
            'Bonus: +10<br/>' +
            'Attack roll: d20(5) + 5 = 10 vs AC 15 → <b>MISS</b><br/>' +
            'Modified: d20(15) + 5 = 20 vs AC 15 → <b>HIT</b><br/>' +
            '<br/><i>Miss turned into a hit!</i>'
        );
        // No damageFormula: applyMissTurnedHitDamage must bail before any dice.
        expect(rollExpression).not.toHaveBeenCalled();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('delegates miss→hit damage exactly once through rerollAttackLeg (skipDamageRoll guard)', async () => {
        vi.mocked(rollExpression).mockReturnValue({ total: 8, rolls: [6, 2], modifier: 0 });
        vi.mocked(getCombatContext).mockResolvedValue({ creatures: [] });
        vi.mocked(applyDamageToTarget).mockReturnValue({ finalDamage: 8 });

        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d6', damageType: 'slashing', targetName: 'Goblin' });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 10 } });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Miss turned into a hit');
        // rerollAttackLeg applies damage itself, then calls handleAttackRoll with
        // skipDamageRoll:true — if that flag were dropped, each of these would fire twice.
        expect(rollExpression).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith('2d6');
        expect(getCombatContext).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        // Own-target ability_use log composition (rerollAttackLeg owns this string;
        // ally variants carry targetName and live in the damagePaths/main lanes).
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Test Auto Reroll',
                description: 'TestHero used Test Auto Reroll: +10 to own failed attack roll.',
            })
        );
    });

    it('pins the full popup description when the bonus total is still a miss', async () => {
        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 2, bonus: 5, targetAc: 20, hit: false });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 2 } });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            '<b>Test Auto Reroll</b><br/>' +
            'Bonus: +2<br/>' +
            'Attack roll: d20(2) + 5 = 7 vs AC 20 → <b>MISS</b><br/>' +
            'Modified: d20(4) + 5 = 9 vs AC 20 → <b>MISS</b><br/>' +
            '<br/><i>Still a miss.</i>'
        );
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('pins the full popup description with null AC (N/A verdict, em-dash label)', async () => {
        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, hit: false });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 10 } });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            '<b>Test Auto Reroll</b><br/>' +
            'Bonus: +10<br/>' +
            'Attack roll: d20(5) + 5 = 10 vs AC — → <b>MISS</b><br/>' +
            'Modified: d20(15) + 5 = 20 vs AC — → <b>N/A</b><br/>'
        );
        // With no AC, rerollAttackLeg falls back to attackEvent.hit (false) — no damage.
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});
