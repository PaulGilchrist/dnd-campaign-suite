// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createDiceRollHandlers } from './DiceRollResult.handlers';

describe('createDiceRollHandlers - handleSavageAttacker', () => {
    let state;
    let props;
    let randomSpy;

    beforeEach(() => {
        state = {
            setSavageAttackerResult: vi.fn(),
            setSavageAttackerUsed: vi.fn(),
            savageAttackerResult: null,
        };
        props = {
            rolls: [2, 3],
            formula: '2d6',
            total: 5,
            modifier: 0,
            targetName: 'Orc',
            damageType: 'Slashing',
            onSavageAttacker: vi.fn().mockResolvedValue(undefined),
            onSavageAttackerChoice: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        randomSpy?.mockRestore();
    });

    // Deterministic dice: a constant Math.random makes every d6 roll the same face.
    const rollMax = () => { randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999); }; // d6 → 6
    const rollMin = () => { randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.001); }; // d6 → 1

    it('higher reroll offers a choice while the engine still sees the original damage untouched', () => {
        rollMax();

        const handlers = createDiceRollHandlers(props, state);
        handlers.handleSavageAttacker();

        expect(state.setSavageAttackerResult).toHaveBeenCalledWith({
            original: '2, 3',
            rerolled: '6, 6',
            originalRolls: [2, 3],
            newRolls: [6, 6],
            originalTotal: 5,
            newTotal: 12,
            better: true,
            awaitingChoice: true,
        });
        expect(state.setSavageAttackerUsed).toHaveBeenCalledWith(true);
        // The reroll click alone never changes damage: rolls/rawDamage stay original.
        expect(props.onSavageAttacker).toHaveBeenCalledWith({
            damageFormula: '2d6',
            rolls: [2, 3],
            rawDamage: 5,
            targetName: 'Orc',
            damageTypes: ['Slashing'],
            originalRolls: [2, 3],
            newRolls: [6, 6],
        });
    });

    it('lower reroll auto-keeps the original, requests no choice, and moves no damage', () => {
        rollMin();

        const handlers = createDiceRollHandlers(props, state);
        handlers.handleSavageAttacker();

        expect(state.setSavageAttackerResult).toHaveBeenCalledWith({
            original: '2, 3',
            rerolled: '1, 1',
            originalRolls: [2, 3],
            newRolls: [1, 1],
            originalTotal: 5,
            newTotal: 2,
            better: false,
            awaitingChoice: false,
        });
        expect(state.setSavageAttackerUsed).toHaveBeenCalledWith(true);
        expect(props.onSavageAttacker).toHaveBeenCalledWith({
            damageFormula: '2d6',
            rolls: [2, 3],
            rawDamage: 5,
            targetName: 'Orc',
            damageTypes: ['Slashing'],
            originalRolls: [2, 3],
            newRolls: [1, 1],
        });
    });

    it('equal reroll total is not better — original kept, no choice offered', () => {
        props.rolls = [6, 6];
        props.total = 12;
        rollMax();

        const handlers = createDiceRollHandlers(props, state);
        handlers.handleSavageAttacker();

        expect(state.setSavageAttackerResult).toHaveBeenCalledWith({
            original: '6, 6',
            rerolled: '6, 6',
            originalRolls: [6, 6],
            newRolls: [6, 6],
            originalTotal: 12,
            newTotal: 12,
            better: false,
            awaitingChoice: false,
        });
    });

    it.each([
        ['empty rolls', { rolls: [] }],
        ['missing formula', { formula: '' }],
        ['formula without a dice term', { formula: 'modifier only' }],
        ['formula dice count mismatching the rolls', { formula: '3d6' }],
    ])('reroll click is inert when %s', (_label, override) => {
        Object.assign(props, override);

        const handlers = createDiceRollHandlers(props, state);
        handlers.handleSavageAttacker();

        expect(props.onSavageAttacker).not.toHaveBeenCalled();
        expect(state.setSavageAttackerResult).not.toHaveBeenCalled();
        expect(state.setSavageAttackerUsed).not.toHaveBeenCalled();
    });

    it('reroll click is inert without an onSavageAttacker callback', () => {
        delete props.onSavageAttacker;

        const handlers = createDiceRollHandlers(props, state);
        handlers.handleSavageAttacker();

        expect(state.setSavageAttackerResult).not.toHaveBeenCalled();
        expect(state.setSavageAttackerUsed).not.toHaveBeenCalled();
    });

    // Bug: the guard once compared the FIRST formula group's dice count against
    // the whole roll pool, so every multi-group popup (any sneak-attack damage,
    // `1d6+3 [slashing] + 9d6 [Sneak Attack]`) was a silent no-op. The feat is
    // RAW the weapon's damage dice (feats.json both rulesets), so the reroll
    // covers the first group only — bonus groups keep their original rolls.
    describe('multi-group (weapon + bonus pool) rerolls', () => {
        it('rerolls only the weapon group, keeps bonus rolls, and offers the choice on the weapon totals', () => {
            props.rolls = [3, 4, 5, 5, 5, 5, 6, 4, 4, 2, 3];
            props.formula = '1d6+3 [slashing] + 10d6 [Sneak Attack]';
            props.total = 49;
            props.modifier = 3;
            randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999); // every die → max face

            const handlers = createDiceRollHandlers(props, state);
            handlers.handleSavageAttacker();

            expect(state.setSavageAttackerResult).toHaveBeenCalledWith({
                original: '3',
                rerolled: '6',
                originalRolls: [3, 4, 5, 5, 5, 5, 6, 4, 4, 2, 3],
                newRolls: [6, 4, 5, 5, 5, 5, 6, 4, 4, 2, 3],
                originalTotal: 3,
                newTotal: 6,
                better: true,
                awaitingChoice: true,
            });
            expect(state.setSavageAttackerUsed).toHaveBeenCalledWith(true);
            // Audit payload carries only the rerolled weapon dice.
            expect(props.onSavageAttacker).toHaveBeenCalledWith({
                damageFormula: '1d6+3 [slashing] + 10d6 [Sneak Attack]',
                rolls: [3],
                rawDamage: 49,
                targetName: 'Orc',
                damageTypes: ['Slashing'],
                originalRolls: [3],
                newRolls: [6],
            });
        });

        it('multi-dice weapons reroll their whole first group (2d6 base + 6d6 sneak)', () => {
            props.rolls = [2, 2, 1, 1, 1, 1, 1, 1];
            props.formula = '2d6+3 [slashing] + 6d6 [Sneak Attack]';
            props.total = 15;
            randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999);

            const handlers = createDiceRollHandlers(props, state);
            handlers.handleSavageAttacker();

            expect(state.setSavageAttackerResult).toHaveBeenCalledWith({
                original: '2, 2',
                rerolled: '6, 6',
                originalRolls: [2, 2, 1, 1, 1, 1, 1, 1],
                newRolls: [6, 6, 1, 1, 1, 1, 1, 1],
                originalTotal: 4,
                newTotal: 12,
                better: true,
                awaitingChoice: true,
            });
            expect(props.onSavageAttacker).toHaveBeenCalledWith(
                expect.objectContaining({ originalRolls: [2, 2], newRolls: [6, 6] })
            );
        });

        it('per-die sizes come from the formula (d8 weapon rerolls a d8, not a d6)', () => {
            props.rolls = [3, 2, 2, 2, 2];
            props.formula = '1d8+2 [piercing] + 4d6 [Sneak Attack]';
            props.total = 13;
            randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999); // d8 → 8

            const handlers = createDiceRollHandlers(props, state);
            handlers.handleSavageAttacker();

            expect(state.setSavageAttackerResult).toHaveBeenCalledWith(
                expect.objectContaining({
                    original: '3',
                    rerolled: '8',
                    newRolls: [8, 2, 2, 2, 2],
                    originalTotal: 3,
                    newTotal: 8,
                })
            );
        });

        it('crit "*2" popups reroll the single displayed weapon die (pool stays a single set)', () => {
            props.rolls = [2, 6, 6, 6, 6, 6, 6, 6, 6, 6];
            props.formula = '1d6*2+3 [slashing] + 9d6*2 [Sneak Attack]';
            props.total = 94;
            randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.001); // every die → 1

            const handlers = createDiceRollHandlers(props, state);
            handlers.handleSavageAttacker();

            expect(state.setSavageAttackerResult).toHaveBeenCalledWith({
                original: '2',
                rerolled: '1',
                originalRolls: [2, 6, 6, 6, 6, 6, 6, 6, 6, 6],
                newRolls: [1, 6, 6, 6, 6, 6, 6, 6, 6, 6],
                originalTotal: 2,
                newTotal: 1,
                better: false,
                awaitingChoice: false,
            });
        });

        it('keep choice forwards the full merged pool so bonus dice survive the popup update', () => {
            props.rolls = [3, 4, 5];
            props.formula = '1d6+3 [slashing] + 2d6 [Sneak Attack]';
            props.total = 18;
            randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999); // d6 → 6

            const handlers = createDiceRollHandlers(props, state);
            handlers.handleSavageAttacker();

            // Feed the reroll result back exactly as the state setter received it.
            state.savageAttackerResult = state.setSavageAttackerResult.mock.calls[0][0];
            createDiceRollHandlers(props, state).handleSavageAttackerKeep('reroll');

            expect(props.onSavageAttackerChoice).toHaveBeenCalledWith(
                expect.objectContaining({
                    keep: 'reroll',
                    originalRolls: [3, 4, 5],
                    newRolls: [6, 4, 5],
                })
            );
        });

        it('a roll pool that does not match the formula dice is refused LOUDLY, not silently', () => {
            props.formula = '3d6'; // 3 dice vs 2 rolls
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const handlers = createDiceRollHandlers(props, state);
            handlers.handleSavageAttacker();

            expect(props.onSavageAttacker).not.toHaveBeenCalled();
            expect(state.setSavageAttackerResult).not.toHaveBeenCalled();
            expect(errSpy).toHaveBeenCalledWith(
                '[SavageAttacker] roll pool size', 2, 'does not match the formula dice —', '3d6'
            );
            errSpy.mockRestore();
        });
    });

    it.each(['reroll', 'original'])('keep("%s") locks the decision and forwards the full choice payload', (keep) => {
        state.savageAttackerResult = {
            original: '2, 3',
            rerolled: '6, 6',
            originalRolls: [2, 3],
            newRolls: [6, 6],
            originalTotal: 5,
            newTotal: 12,
            better: true,
            awaitingChoice: true,
        };

        const handlers = createDiceRollHandlers(props, state);
        handlers.handleSavageAttackerKeep(keep);

        expect(state.setSavageAttackerResult).toHaveBeenCalledWith({
            ...state.savageAttackerResult,
            awaitingChoice: false,
            kept: keep,
        });
        expect(props.onSavageAttackerChoice).toHaveBeenCalledWith({
            keep,
            originalRolls: [2, 3],
            newRolls: [6, 6],
            originalTotal: 5,
            newTotal: 12,
            rawDamage: 5,
            modifier: 0,
            targetName: 'Orc',
            damageTypes: ['Slashing'],
        });
    });

    it('keep choice is inert before any reroll and once the decision is made', () => {
        // Nothing rolled yet.
        const handlers = createDiceRollHandlers(props, state);
        handlers.handleSavageAttackerKeep('reroll');

        // Decision already settled.
        state.savageAttackerResult = {
            originalRolls: [2, 3],
            newRolls: [6, 6],
            originalTotal: 5,
            newTotal: 12,
            awaitingChoice: false,
            kept: 'reroll',
        };
        handlers.handleSavageAttackerKeep('reroll');

        expect(props.onSavageAttackerChoice).not.toHaveBeenCalled();
        expect(state.setSavageAttackerResult).not.toHaveBeenCalled();
    });
});
