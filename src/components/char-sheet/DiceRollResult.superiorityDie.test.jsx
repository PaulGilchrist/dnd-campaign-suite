// DiceRollResult — superiority die-size selection rendering seam tests.
//
// Seam ownership map (consolidated per the DiceRollResult.handlers.test.js header):
//   - THIS file: die-size selection rendering — clicking a maneuver evaluates its
//     dieExpression (level-based 'superiority_die' AND explicit override) via
//     evaluateAutoExpression, rolls the resolved die, dispatches the exact
//     onSuperiorityManeuver payload, and renders the result row with the resolved
//     die label. Also the die-evaluation throw path: evaluateAutoExpression throws
//     → console.error, nothing dispatched, no result row, maneuver stays offered.
//   - handleSuperiorityManeuver guard payload (inert without a callback):
//     DiceRollResult.handlers.test.js — deferred, not duplicated here.
//   - superiority click dispatch ('Precision Attack', 5) and offer→result UI
//     transition: DiceRollResult.interactive.test.jsx — deferred, not duplicated here.
//   - console.error when the onSuperiorityManeuver callback rejects (result row
//     already rendered): DiceRollResult.toggles.test.jsx — the evaluate-throw path
//     above is the distinct pre-roll half of that seam.
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';
import * as automationExpressions from '../../services/combat/automation/automationExpressions.js';

// Deterministic dice: 0.5 → d8=5, d10=6, d12=7, d6=4. Spies restored in afterEach.
const DETERMINISTIC_RANDOM = 0.5;
const dieValueFor = (dieSize) => Math.floor(DETERMINISTIC_RANDOM * dieSize) + 1;
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

function renderManeuverPopup(maneuver, playerStats, onSuperiorityManeuver) {
    return render(
        <DiceRollResult
            name="Intimidation"
            type="d20"
            rolls={[14]}
            bonus={3}
            rollType="skill"
            availableSuperiorityManeuvers={[maneuver]}
            playerStats={playerStats}
            onSuperiorityManeuver={onSuperiorityManeuver}
        />
    );
}

describe('DiceRollResult — superiority die-size selection', () => {
    let evaluateSpy;
    let randomSpy;
    let consoleSpy;

    beforeEach(() => {
        evaluateSpy = vi.spyOn(automationExpressions, 'evaluateAutoExpression');
        randomSpy = vi.spyOn(Math, 'random').mockReturnValue(DETERMINISTIC_RANDOM);
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        evaluateSpy.mockRestore();
        randomSpy.mockRestore();
        consoleSpy.mockRestore();
    });

    it.each([
        // label, maneuver name, dieExpression, playerStats, die size from evaluateAutoExpression
        ['resolves a d8 superiority die for a level 3 Battle Master', 'Commanding Presence', 'superiority_die', { level: 3 }, 8],
        ['resolves a d10 superiority die for a level 10 Battle Master', 'Commanding Presence', 'superiority_die', { level: 10 }, 10],
        ['resolves a d12 superiority die for a level 18 Battle Master', 'Commanding Presence', 'superiority_die', { level: 18 }, 12],
        ['uses an explicit dieExpression instead of superiority_die', 'Test Maneuver', '1d6', { level: 3 }, 6],
    ])('%s', async (_label, name, dieExpression, playerStats, dieSize) => {
        evaluateSpy.mockReturnValue(dieSize);
        const onSuperiorityManeuver = vi.fn();
        const { container } = renderManeuverPopup(
            { name, dieExpression },
            playerStats,
            onSuperiorityManeuver,
        );

        fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));

        expect(evaluateSpy).toHaveBeenCalledWith(dieExpression, playerStats);
        const dieValue = dieValueFor(dieSize);
        expect(onSuperiorityManeuver).toHaveBeenCalledWith(name, dieValue);
        // d20 14 + bonus 3 + die → row labels the RESOLVED die size (not a hardcoded d12).
        expect(normalize(container.querySelector('.dice-roll-reroll-result').textContent))
            .toBe(`${name}: d${dieSize} ${dieValue} → ${14 + 3 + dieValue} (+${dieValue})`);
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('is inert when the die expression fails to evaluate — console.error, nothing dispatched, maneuver stays offered', () => {
        const failure = new Error('bad die expression');
        evaluateSpy.mockImplementation(() => { throw failure; });
        const onSuperiorityManeuver = vi.fn();
        const maneuver = { name: 'Commanding Presence', dieExpression: 'superiority_die' };
        const { container } = renderManeuverPopup(maneuver, { level: 3 }, onSuperiorityManeuver);

        fireEvent.click(screen.getByRole('button', { name: /Commanding Presence/ }));

        expect(consoleSpy).toHaveBeenCalledWith('[DiceRollResult] Superiority maneuver failed:', failure);
        expect(onSuperiorityManeuver).not.toHaveBeenCalled();
        expect(container.querySelector('.dice-roll-reroll-result')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Commanding Presence/ })).toBeInTheDocument();
    });
});
