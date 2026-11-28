// @maintained-by-ai 2026-11-27
// Ownership of the Savage Attacker seam:
//  - This file — handler seam (createDiceRollHandlers): reroll/keep payload
//    contracts, group-aware reroll scoping, and inertness. Source of truth for
//    the full result/audit/choice payload shapes.
//  - CharSheet.handlers4 — service lane: once-per-turn spend gate
//    (_Savage_Attacker_usedRound), log entries, rider deltas. The handler here
//    has NO use-gate by design, so no double-spend detector belongs in this lane.
//  - savageAttackerChoice — rendered chooser UI wiring; rerollResults — result
//    row copy; infoDisplay — dice-breakdown copy. Not restated here.
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

    // Deterministic dice: a constant Math.random makes every die land its max/min face.
    const rollMax = () => { randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999); };
    const rollMin = () => { randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.001); };

    it('higher reroll offers a choice while the engine still sees the original damage untouched', () => {
        rollMax(); // d6 → 6

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
        rollMin(); // d6 → 1

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
        ['no onSavageAttacker callback', { onSavageAttacker: undefined }],
    ])('reroll click is inert when %s', (_label, override) => {
        Object.assign(props, override);

        const handlers = createDiceRollHandlers(props, state);
        handlers.handleSavageAttacker();

        if (props.onSavageAttacker) {
            expect(props.onSavageAttacker).not.toHaveBeenCalled();
        }
        expect(state.setSavageAttackerResult).not.toHaveBeenCalled();
        expect(state.setSavageAttackerUsed).not.toHaveBeenCalled();
    });

    // Bug: the guard once compared the FIRST formula group's dice count against
    // the whole roll pool, so every multi-group popup (any sneak-attack damage,
    // `1d6+3 [slashing] + 9d6 [Sneak Attack]`) was a silent no-op. The feat is
    // RAW the weapon's damage dice (feats.json both rulesets), so the reroll
    // covers the first group only — bonus groups keep their original rolls.
    describe('multi-group (weapon + bonus pool) rerolls', () => {
        it('single-die weapon rerolls only its group, keeps bonus rolls, and offers the choice on the weapon totals', () => {
            props.rolls = [3, 4, 5, 5, 5, 5, 6, 4, 4, 2, 3];
            props.formula = '1d6+3 [slashing] + 10d6 [Sneak Attack]';
            props.total = 49;
            props.modifier = 3;
            rollMax();

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

        it('multi-dice weapons reroll their whole first group at per-die formula sizes (2d8 base + 4d6 sneak)', () => {
            props.rolls = [3, 5, 2, 2, 2, 2];
            props.formula = '2d8+3 [slashing] + 4d6 [Sneak Attack]';
            props.total = 19;
            props.modifier = 3;
            rollMax(); // d8 → 8, d6 → 6

            const handlers = createDiceRollHandlers(props, state);
            handlers.handleSavageAttacker();

            expect(state.setSavageAttackerResult).toHaveBeenCalledWith({
                original: '3, 5',
                rerolled: '8, 8',
                originalRolls: [3, 5, 2, 2, 2, 2],
                newRolls: [8, 8, 2, 2, 2, 2],
                originalTotal: 8,
                newTotal: 16,
                better: true,
                awaitingChoice: true,
            });
            expect(props.onSavageAttacker).toHaveBeenCalledWith({
                damageFormula: '2d8+3 [slashing] + 4d6 [Sneak Attack]',
                rolls: [3, 5],
                rawDamage: 19,
                targetName: 'Orc',
                damageTypes: ['Slashing'],
                originalRolls: [3, 5],
                newRolls: [8, 8],
            });
        });

        it('crit "*2" popups reroll the single displayed weapon die (pool stays a single set)', () => {
            props.rolls = [2, 6, 6, 6, 6, 6, 6, 6, 6, 6];
            props.formula = '1d6*2+3 [slashing] + 9d6*2 [Sneak Attack]';
            props.total = 94;
            rollMin();

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
            rollMax();

            const handlers = createDiceRollHandlers(props, state);
            handlers.handleSavageAttacker();

            // Feed the reroll result back exactly as the state setter received it.
            state.savageAttackerResult = state.setSavageAttackerResult.mock.calls[0][0];
            createDiceRollHandlers(props, state).handleSavageAttackerKeep('reroll');

            expect(props.onSavageAttackerChoice).toHaveBeenCalledWith({
                keep: 'reroll',
                originalRolls: [3, 4, 5],
                newRolls: [6, 4, 5],
                originalTotal: 3,
                newTotal: 6,
                rawDamage: 18,
                modifier: 0,
                targetName: 'Orc',
                damageTypes: ['Slashing'],
            });
        });

        it.each([
            ['a formula without a dice term', 'modifier only'],
            ['a formula whose dice count mismatches the rolls', '3d6'],
        ])('reroll on %s is refused LOUDLY, not silently', (_label, formula) => {
            props.formula = formula; // 2-roll pool in the fixture
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const handlers = createDiceRollHandlers(props, state);
            handlers.handleSavageAttacker();

            expect(props.onSavageAttacker).not.toHaveBeenCalled();
            expect(state.setSavageAttackerResult).not.toHaveBeenCalled();
            expect(state.setSavageAttackerUsed).not.toHaveBeenCalled();
            expect(errSpy).toHaveBeenCalledWith(
                '[SavageAttacker] roll pool size', 2, 'does not match the formula dice —', formula
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
        createDiceRollHandlers(props, state).handleSavageAttackerKeep('reroll');

        // Decision already settled — a FRESH handler so the closure reads the
        // settled result (handlers capture state at creation).
        state.savageAttackerResult = {
            originalRolls: [2, 3],
            newRolls: [6, 6],
            originalTotal: 5,
            newTotal: 12,
            awaitingChoice: false,
            kept: 'reroll',
        };
        createDiceRollHandlers(props, state).handleSavageAttackerKeep('reroll');

        expect(props.onSavageAttackerChoice).not.toHaveBeenCalled();
        expect(state.setSavageAttackerResult).not.toHaveBeenCalled();
    });
});
