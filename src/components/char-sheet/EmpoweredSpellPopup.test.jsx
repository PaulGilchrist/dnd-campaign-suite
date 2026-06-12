import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmpoweredSpellPopup from './EmpoweredSpellPopup.jsx';

// ── Test fixtures ──

const baseState = {
    name: 'Empowered Spell',
    currentSP: 5,
    maxSP: 10,
    chaMod: 3,
};

const baseLastEvent = {
    spellName: 'Fire Bolt',
    targetName: 'Goblin',
    damageFormula: '1d10',
    rawDamage: 7,
    rolls: [7],
};

function makeState(overrides) {
    return { ...baseState, ...overrides };
}

// ── Tests ──

describe('EmpoweredSpellPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default / no event ──

    it('renders the popup with spell name and wand icon', () => {
        render(<EmpoweredSpellPopup state={makeState()} onReroll={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText('Empowered Spell')).toBeInTheDocument();
        const icon = document.querySelector('.fa-wand-magic-sparkles');
        expect(icon).toBeInTheDocument();
    });

    it('displays sorcery points', () => {
        render(<EmpoweredSpellPopup state={makeState()} onReroll={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText(/Sorcery Points:/)).toBeInTheDocument();
        const spDisplay = document.querySelector('.metamagic-sp-display');
        expect(spDisplay.textContent).toContain('5');
        expect(spDisplay.textContent).toContain('10');
    });

    it('shows "no recent damage" message when no lastEvent and no error', () => {
        render(<EmpoweredSpellPopup state={makeState()} onReroll={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText(/No recent damage event found/)).toBeInTheDocument();
    });

    it('does not show "no recent damage" message when there is a lastEvent', () => {
        render(
            <EmpoweredSpellPopup
                state={makeState({ lastEvent: baseLastEvent })}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.queryByText(/No recent damage event found/)).not.toBeInTheDocument();
    });

    // ── Error display ──

    it('renders error message when state.error is set', () => {
        render(
            <EmpoweredSpellPopup
                state={makeState({ error: 'Not enough SP' })}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText('Not enough SP')).toBeInTheDocument();
    });

    it('does not render error message when state.error is falsy', () => {
        render(
            <EmpoweredSpellPopup
                state={makeState({ error: null })}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.queryByText(/Not enough SP/)).not.toBeInTheDocument();
    });

    // ── Active event (not completed, has rolls) ──

    it('shows spell name, target, formula, and raw damage when lastEvent has rolls', () => {
        render(
            <EmpoweredSpellPopup
                state={makeState({ lastEvent: baseLastEvent })}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('1d10')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('shows CHA modifier and reroll capacity', () => {
        render(
            <EmpoweredSpellPopup
                state={makeState({ lastEvent: baseLastEvent, chaMod: 3 })}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/CHA Modifier:/)).toBeInTheDocument();
        expect(screen.getByText(/can reroll up to 3 dice/)).toBeInTheDocument();
    });

    it('shows Reroll button when lastEvent has rolls and not completed', () => {
        render(
            <EmpoweredSpellPopup
                state={makeState({ lastEvent: baseLastEvent })}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/Reroll \(1 SP\)/)).toBeInTheDocument();
    });

    it('shows Cancel button when lastEvent has rolls and not completed', () => {
        render(
            <EmpoweredSpellPopup
                state={makeState({ lastEvent: baseLastEvent })}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls onReroll with lastEvent and chaMod when Reroll button is clicked', () => {
        const onReroll = vi.fn();
        render(
            <EmpoweredSpellPopup
                state={makeState({ lastEvent: baseLastEvent, chaMod: 4 })}
                onReroll={onReroll}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByText(/Reroll \(1 SP\)/));
        expect(onReroll).toHaveBeenCalledTimes(1);
        expect(onReroll).toHaveBeenCalledWith(baseLastEvent, 4);
    });

    it('calls onClose when Cancel button is clicked', () => {
        const onClose = vi.fn();
        render(
            <EmpoweredSpellPopup
                state={makeState({ lastEvent: baseLastEvent })}
                onReroll={vi.fn()}
                onClose={onClose}
            />
        );
        fireEvent.click(screen.getByText('Cancel'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // ── Active event without rolls ──

    it('shows "click to dismiss" hint when lastEvent exists but has no rolls and not completed', () => {
        const stateWithoutRolls = makeState({ lastEvent: { ...baseLastEvent, rolls: null } });
        render(
            <EmpoweredSpellPopup
                state={stateWithoutRolls}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/click to dismiss/)).toBeInTheDocument();
    });

    it('does not show Reroll button when lastEvent has no rolls', () => {
        const stateWithoutRolls = makeState({ lastEvent: { ...baseLastEvent, rolls: null } });
        render(
            <EmpoweredSpellPopup
                state={stateWithoutRolls}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.queryByText(/Reroll \(1 SP\)/)).not.toBeInTheDocument();
    });

    // ── Completed state with result message ──

    it('shows completed result with message when state.completed and result.message exist', () => {
        const completedState = makeState({
            completed: true,
            result: {
                message: 'Empowered Spell applied!',
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText('Empowered Spell applied!')).toBeInTheDocument();
    });

    it('does not show damage breakdown when result has a message', () => {
        const completedState = makeState({
            completed: true,
            result: {
                message: 'Empowered Spell applied!',
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.queryByText(/Original Damage/)).not.toBeInTheDocument();
    });

    // ── Completed state with damage breakdown ──

    it('shows damage breakdown when result has no message', () => {
        const completedState = makeState({
            completed: true,
            result: {
                oldTotal: 7,
                newTotal: 12,
                damageDifference: 5,
                rerollCount: 2,
                originalDice: [3, 4],
                newDice: [6, 6],
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/Original Damage:/)).toBeInTheDocument();
        expect(screen.getByText(/New Damage:/)).toBeInTheDocument();
        expect(screen.getByText(/Difference:/)).toBeInTheDocument();
        expect(screen.getByText(/Dice Rerolled:/)).toBeInTheDocument();
    });

    it('shows positive damage difference with plus sign', () => {
        const completedState = makeState({
            completed: true,
            result: {
                oldTotal: 5,
                newTotal: 10,
                damageDifference: 5,
                rerollCount: 1,
                originalDice: [5],
                newDice: [10],
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/\+5/)).toBeInTheDocument();
    });

    it('shows negative damage difference without plus sign', () => {
        const completedState = makeState({
            completed: true,
            result: {
                oldTotal: 10,
                newTotal: 5,
                damageDifference: -5,
                rerollCount: 1,
                originalDice: [10],
                newDice: [5],
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/-5/)).toBeInTheDocument();
        expect(screen.queryByText(/\+5/)).not.toBeInTheDocument();
    });

    it('shows original and new dice lists in result', () => {
        const completedState = makeState({
            completed: true,
            result: {
                oldTotal: 7,
                newTotal: 12,
                damageDifference: 5,
                rerollCount: 2,
                originalDice: [3, 4],
                newDice: [6, 6],
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/Original dice: \(3, 4\)/)).toBeInTheDocument();
        expect(screen.getByText(/New dice: \(6, 6\)/)).toBeInTheDocument();
    });

    it('shows target HP when result.targetCurrentHp is set', () => {
        const completedState = makeState({
            completed: true,
            result: {
                oldTotal: 7,
                newTotal: 12,
                damageDifference: 5,
                rerollCount: 2,
                originalDice: [3, 4],
                newDice: [6, 6],
                targetCurrentHp: 15,
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/Target HP:/)).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('does not show target HP when result.targetCurrentHp is null', () => {
        const completedState = makeState({
            completed: true,
            result: {
                oldTotal: 7,
                newTotal: 12,
                damageDifference: 5,
                rerollCount: 2,
                originalDice: [3, 4],
                newDice: [6, 6],
                targetCurrentHp: null,
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.queryByText(/Target HP:/)).not.toBeInTheDocument();
    });

    it('shows "Spent 1 Sorcery Point" in completed state', () => {
        const completedState = makeState({
            completed: true,
            result: {
                oldTotal: 7,
                newTotal: 12,
                damageDifference: 5,
                rerollCount: 2,
                originalDice: [3, 4],
                newDice: [6, 6],
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/Spent 1 Sorcery Point/)).toBeInTheDocument();
    });

    it('shows "click to dismiss" hint in completed state', () => {
        const completedState = makeState({
            completed: true,
            result: {
                oldTotal: 7,
                newTotal: 12,
                damageDifference: 5,
                rerollCount: 2,
                originalDice: [3, 4],
                newDice: [6, 6],
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/click to dismiss/)).toBeInTheDocument();
    });

    it('shows completed result block when state.completed is true', () => {
        const completedState = makeState({
            completed: true,
            result: {
                oldTotal: 7,
                newTotal: 12,
                damageDifference: 5,
                rerollCount: 2,
                originalDice: [3, 4],
                newDice: [6, 6],
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/New Damage:/)).toBeInTheDocument();
        expect(screen.getByText(/Spent 1 Sorcery Point/)).toBeInTheDocument();
    });

    // ── Zero difference ──

    it('shows zero damage difference without plus sign', () => {
        const completedState = makeState({
            completed: true,
            result: {
                oldTotal: 7,
                newTotal: 7,
                damageDifference: 0,
                rerollCount: 1,
                originalDice: [7],
                newDice: [7],
            },
        });
        render(
            <EmpoweredSpellPopup
                state={completedState}
                onReroll={vi.fn()}
                onClose={vi.fn()}
            />
        );
        // Verify the difference line shows 0 (not +0)
        const diffLines = screen.getAllByText(/Difference:/);
        expect(diffLines[0].parentElement.textContent).toContain('0');
        expect(diffLines[0].parentElement.textContent).not.toMatch(/\+0/);
    });

    // ── CSS class presence ──

    it('renders with dice-roll-result class', () => {
        render(<EmpoweredSpellPopup state={makeState()} onReroll={vi.fn()} onClose={vi.fn()} />);
        const resultDiv = document.querySelector('.dice-roll-result');
        expect(resultDiv).toBeInTheDocument();
    });

    it('renders with dice-roll-header class', () => {
        render(<EmpoweredSpellPopup state={makeState()} onReroll={vi.fn()} onClose={vi.fn()} />);
        const headerDiv = document.querySelector('.dice-roll-header');
        expect(headerDiv).toBeInTheDocument();
    });

    it('renders with metamagic-sp-display class', () => {
        render(<EmpoweredSpellPopup state={makeState()} onReroll={vi.fn()} onClose={vi.fn()} />);
        const spDiv = document.querySelector('.metamagic-sp-display');
        expect(spDiv).toBeInTheDocument();
    });
});
