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
