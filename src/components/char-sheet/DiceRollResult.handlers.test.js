// Unit tests for createDiceRollHandlers (DiceRollResult.handlers.js).
//
// Seam ownership map:
//   - handlePuncture, handleReroll, handleTacticalMind/Declare, handleDarkOnesLuck,
//     handleBardicInspiration (all three), handleEmpoweredSpell,
//     handleSuperiorityManeuver guard — THIS file.
//   - handleSavageAttacker + handleSavageAttackerKeep — DiceRollResult.handlers.savageAttacker.test.js.
//   - handleSuperiorityManeuver die-size selection — DiceRollResult.superiorityDie.test.jsx;
//     its console.error throw path — DiceRollResult.toggles.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createDiceRollHandlers } from './DiceRollResult.handlers';
import * as automationExpressions from '../../services/combat/automation/automationExpressions.js';

// Deterministic dice: a constant high Math.random makes every die land its max face.
const rollMax = () => vi.spyOn(Math, 'random').mockReturnValue(0.999);

describe('createDiceRollHandlers - handlePuncture', () => {
    let state;
    let props;
    let randomSpy;

    beforeEach(() => {
        state = {
            setPunctureResult: vi.fn(),
            setPunctureUsed: vi.fn(),
        };
        props = {
            rolls: [4, 6],
            formula: '1d8-1 [piercing] + 1d6 [force]',
            total: 9,
            modifier: -1,
            targetName: 'Zombie 1',
            damageType: 'Piercing',
            onPuncture: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        randomSpy?.mockRestore();
    });

    it.each([
        // label, rolls, formula, expected new rolls, index of the rerolled die
        ['rerolls the lowest die using its own die size from the formula, not rolls[0] value',
            [4, 6], '1d8-1 [piercing] + 1d6 [force]', [8, 6], 0],
        ['maps the reroll index to the matching die term in a multi-die formula',
            [5, 5, 1], '1d8 + 1d6 + 1d6', [5, 5, 6], 2],
        ['falls back to a d6 when the formula has no dice term',
            [3], '', [6], 0],
        ['falls back to the first dice term when the formula lists fewer dice than were rolled',
            [7, 2, 5], '1d8', [7, 8, 5], 1],
    ])('%s', async (_label, rolls, formula, newRolls, rerolledIndex) => {
        randomSpy = rollMax();
        props.rolls = rolls;
        props.formula = formula;

        const handlers = createDiceRollHandlers(props, state);
        await handlers.handlePuncture();

        const originalValue = rolls[rerolledIndex];
        const newValue = newRolls[rerolledIndex];

        expect(state.setPunctureResult).toHaveBeenCalledWith({
            originalDice: rolls,
            newDice: newRolls,
            rerolledIndex,
            originalValue,
            newValue,
        });
        expect(state.setPunctureUsed).toHaveBeenCalledWith(true);
        expect(props.onPuncture).toHaveBeenCalledWith({
            damageFormula: formula,
            rolls: newRolls,
            rawDamage: props.total,
            targetName: 'Zombie 1',
            damageTypes: ['Piercing'],
            originalRolls: rolls,
            newRolls,
            rerolledIndex,
            originalValue,
            newValue,
        });
    });

    it.each([
        ['no rolls', (props) => { props.rolls = []; }],
        ['no onPuncture callback', (props) => { delete props.onPuncture; }],
    ])('puncture click is inert when %s — no state change and no dice rolled', async (_label, mutate) => {
        mutate(props);
        randomSpy = vi.spyOn(Math, 'random');

        const handlers = createDiceRollHandlers(props, state);
        await handlers.handlePuncture();

        expect(state.setPunctureResult).not.toHaveBeenCalled();
        expect(state.setPunctureUsed).not.toHaveBeenCalled();
        expect(randomSpy).not.toHaveBeenCalled();
    });
});

describe('createDiceRollHandlers - handleReroll', () => {
    let state;
    let props;
    let randomSpy;

    beforeEach(() => {
        state = {
            setRerollResult: vi.fn(),
            setRerollUsed: vi.fn(),
        };
        props = {
            bonus: 5,
            onReroll: vi.fn(),
        };
    });

    afterEach(() => {
        randomSpy?.mockRestore();
    });

    it.each([
        ['with autoRerollBonus added to the total', { autoRerollBonus: 2 }, { roll: 20, total: 27 }],
        ['without autoRerollBonus the bonus alone is applied', {}, { roll: 20, total: 25 }],
    ])('d20 reroll reports the fresh roll %s', (_label, override, expected) => {
        randomSpy = rollMax();
        Object.assign(props, override);

        const handlers = createDiceRollHandlers(props, state);
        handlers.handleReroll();

        expect(state.setRerollResult).toHaveBeenCalledWith(expected);
        expect(state.setRerollUsed).toHaveBeenCalledWith(true);
        expect(props.onReroll).toHaveBeenCalledWith(expected);
    });

    it('still updates state when no onReroll callback is provided', () => {
        randomSpy = rollMax();
        delete props.onReroll;

        const handlers = createDiceRollHandlers(props, state);
        handlers.handleReroll();

        expect(state.setRerollResult).toHaveBeenCalledWith({ roll: 20, total: 25 });
        expect(state.setRerollUsed).toHaveBeenCalledWith(true);
    });
});

describe('createDiceRollHandlers - handleTacticalMind / handleTacticalDeclare', () => {
    let state;
    let props;
    let randomSpy;

    beforeEach(() => {
        state = {
            setTacticalResult: vi.fn(),
            setTacticalUsed: vi.fn(),
            setTacticalDeclared: vi.fn(),
            tacticalResult: null,
            tacticalDeclared: null,
            finalRoll: 8,
        };
        props = {
            bonus: 2,
            modifier: 1,
            onTacticalMind: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        randomSpy?.mockRestore();
    });

    it('rolls the d10 and boosts the total, but defers the spend — no adjudication sent yet (CLA-352)', () => {
        randomSpy = rollMax();

        const handlers = createDiceRollHandlers(props, state);
        handlers.handleTacticalMind();

        expect(state.setTacticalResult).toHaveBeenCalledWith({ bonus: 10, total: 21 });
        expect(state.setTacticalUsed).toHaveBeenCalledWith(true);
        expect(props.onTacticalMind).not.toHaveBeenCalled();
    });

    it.each([
        ['succeeded', true],
        ['failed', false],
    ])('declare(%s) reports the die value and outcome once', async (_label, success) => {
        state.tacticalResult = { bonus: 10, total: 21 };

        const handlers = createDiceRollHandlers(props, state);
        await handlers.handleTacticalDeclare(success);

        expect(state.setTacticalDeclared).toHaveBeenCalledWith(success);
        expect(props.onTacticalMind).toHaveBeenCalledWith({ dieValue: 10, success });
    });

    it('declaration is inert before any roll and once the outcome is known', async () => {
        // Nothing rolled yet.
        const beforeRoll = createDiceRollHandlers(props, state);
        await beforeRoll.handleTacticalDeclare(true);

        // Outcome already declared.
        state.tacticalResult = { bonus: 10, total: 21 };
        state.tacticalDeclared = false;
        const settled = createDiceRollHandlers(props, state);
        await settled.handleTacticalDeclare(true);

        expect(state.setTacticalDeclared).not.toHaveBeenCalled();
        expect(props.onTacticalMind).not.toHaveBeenCalled();
    });
});

describe('createDiceRollHandlers - handleDarkOnesLuck', () => {
    let state;
    let props;
    let randomSpy;

    beforeEach(() => {
        state = {
            setDarkOnesLuckResult: vi.fn(),
            setDarkOnesLuckUsed: vi.fn(),
            finalRoll: 5,
        };
        props = {
            bonus: 2,
            modifier: -1,
            onDarkOnesLuck: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        randomSpy?.mockRestore();
    });

    it('rolls a d10, reports the boosted total, and forwards the die value', async () => {
        randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // d10 → 6

        const handlers = createDiceRollHandlers(props, state);
        await handlers.handleDarkOnesLuck();

        expect(state.setDarkOnesLuckResult).toHaveBeenCalledWith({ dieValue: 6, total: 12 });
        expect(state.setDarkOnesLuckUsed).toHaveBeenCalledWith(true);
        expect(props.onDarkOnesLuck).toHaveBeenCalledWith(6);
    });
});

describe('createDiceRollHandlers - handleBardicInspiration', () => {
    let state;
    let props;
    let randomSpy;

    beforeEach(() => {
        state = {
            setBardicInspirationResult: vi.fn(),
            setBardicInspirationUsed: vi.fn(),
            finalRoll: 12,
        };
        props = {
            bonus: 3,
            modifier: 2,
            bardicInspirationDie: '10',
            onBardicInspiration: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        randomSpy?.mockRestore();
    });

    it.each([
        ['a numeric die string rolls that die size', '10', 10],
        ['a non-numeric die string falls back to a d6', 'd8', 6],
        ['a missing die falls back to a d6', undefined, 6],
    ])('%s', async (_label, dieProp, dieSize) => {
        randomSpy = rollMax();
        props.bardicInspirationDie = dieProp;

        const handlers = createDiceRollHandlers(props, state);
        await handlers.handleBardicInspiration();

        expect(state.setBardicInspirationResult).toHaveBeenCalledWith({
            d20Roll: 12,
            dieValue: dieSize,
            dieSize,
            total: 17 + dieSize,
        });
        expect(state.setBardicInspirationUsed).toHaveBeenCalledWith(true);
        expect(props.onBardicInspiration).toHaveBeenCalledWith(dieSize, dieSize);
    });
});

describe('createDiceRollHandlers - handleBardicInspirationDefense', () => {
    let state;
    let props;
    let randomSpy;

    beforeEach(() => {
        state = {
            setBardicInspirationDefenseResult: vi.fn(),
            setBardicInspirationDefenseUsed: vi.fn(),
            finalTotal: 15,
        };
        props = {
            targetAc: 12,
            bardicInspirationDefenseDieSize: 8,
            onBardicInspirationDefense: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        randomSpy?.mockRestore();
    });

    it.each([
        ['the boosted AC still beats the attack — it will miss', 15, true],
        ['the boosted AC cannot catch the attack — it still hits', 25, false],
    ])('%s', async (_label, attackTotal, willMiss) => {
        randomSpy = rollMax();
        state.finalTotal = attackTotal;

        const handlers = createDiceRollHandlers(props, state);
        await handlers.handleBardicInspirationDefense();

        expect(state.setBardicInspirationDefenseResult).toHaveBeenCalledWith({
            dieValue: 8,
            dieSize: 8,
            newAc: 20,
            willMiss,
            attackTotal,
        });
        expect(state.setBardicInspirationDefenseUsed).toHaveBeenCalledWith(true);
        expect(props.onBardicInspirationDefense).toHaveBeenCalledWith(8, 8, 20, willMiss);
    });
});

describe('createDiceRollHandlers - handleBardicInspirationOffense', () => {
    let state;
    let props;
    let randomSpy;

    beforeEach(() => {
        state = {
            setBardicInspirationOffenseResult: vi.fn(),
            setBardicInspirationOffenseUsed: vi.fn(),
        };
        props = {
            total: 14,
            onBardicInspirationOffense: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        randomSpy?.mockRestore();
    });

    it.each([
        ['die size comes from the direct prop', { bardicInspirationOffenseDieSize: 8 }, 8],
        ['die size falls back to autoDamage', { autoDamage: { bardicInspirationOffenseDieSize: 10 } }, 10],
        ['die size defaults to a d6', {}, 6],
    ])('%s', async (_label, override, dieSize) => {
        randomSpy = rollMax();
        Object.assign(props, override);

        const handlers = createDiceRollHandlers(props, state);
        await handlers.handleBardicInspirationOffense();

        expect(state.setBardicInspirationOffenseResult).toHaveBeenCalledWith({
            dieValue: dieSize,
            dieSize,
            bonusTotal: 14 + dieSize,
        });
        expect(state.setBardicInspirationOffenseUsed).toHaveBeenCalledWith(true);
        expect(props.onBardicInspirationOffense).toHaveBeenCalledWith(dieSize, dieSize);
    });
});

describe('createDiceRollHandlers - handleEmpoweredSpell', () => {
    let state;
    let props;

    beforeEach(() => {
        state = {
            setEmpoweredSpellResult: vi.fn(),
            setEmpoweredSpellUsed: vi.fn(),
        };
        props = {
            rolls: [3, 5],
            formula: '2d6',
            total: 8,
            targetName: 'Orc',
            spellName: 'Fireball',
            damageType: 'Fire',
            onEmpoweredSpell: vi.fn().mockResolvedValue({ damage: 12 }),
        };
    });

    it('forwards the last damage event and stores the re-rolled result', async () => {
        const handlers = createDiceRollHandlers(props, state);
        await handlers.handleEmpoweredSpell();

        expect(props.onEmpoweredSpell).toHaveBeenCalledWith({
            damageFormula: '2d6',
            rolls: [3, 5],
            rawDamage: 8,
            targetName: 'Orc',
            spellName: 'Fireball',
            damageTypes: ['Fire'],
        });
        expect(state.setEmpoweredSpellResult).toHaveBeenCalledWith({ damage: 12 });
        expect(state.setEmpoweredSpellUsed).toHaveBeenCalledWith(true);
    });

    it('is inert without an onEmpoweredSpell callback', async () => {
        delete props.onEmpoweredSpell;

        const handlers = createDiceRollHandlers(props, state);
        await handlers.handleEmpoweredSpell();

        expect(state.setEmpoweredSpellResult).not.toHaveBeenCalled();
        expect(state.setEmpoweredSpellUsed).not.toHaveBeenCalled();
    });
});

describe('createDiceRollHandlers - handleSuperiorityManeuver guard', () => {
    let state;
    let evaluateSpy;

    beforeEach(() => {
        state = {
            setSuperiorityResult: vi.fn(),
            setSuperiorityUsed: vi.fn(),
            finalRoll: 11,
            bonus: 0,
            modifier: 0,
        };
        evaluateSpy = vi.spyOn(automationExpressions, 'evaluateAutoExpression');
    });

    afterEach(() => {
        evaluateSpy.mockRestore();
    });

    it('is inert without an onSuperiorityManeuver callback — no superiority die evaluated', async () => {
        const handlers = createDiceRollHandlers(
            { finalRoll: 11, bonus: 0, modifier: 0 },
            state,
        );
        await handlers.handleSuperiorityManeuver({ name: 'Riposte', dieExpression: 'superiority_die' });

        expect(evaluateSpy).not.toHaveBeenCalled();
        expect(state.setSuperiorityResult).not.toHaveBeenCalled();
        expect(state.setSuperiorityUsed).not.toHaveBeenCalled();
    });
});
