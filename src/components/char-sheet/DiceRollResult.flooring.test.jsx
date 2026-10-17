// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

// Trance of Order (d20Floor10) lane of the DiceRollResult family: the floored
// total (10 + bonus + modifier via computeFloorTotals/computeBaseTotal) and the
// floor notice presence/absence across rollTypes and feature interactions
// (Stroke of Luck, auto-reroll, Bardic Inspiration). Verbatim notice text for
// other features is owned by DiceRollResult.displayFeatures.test.jsx; hit/save
// lines by DiceRollResult.combatDisplay.test.jsx; Starry Form flooring by
// DiceRollResult.rendering.test.jsx.

let randomSpy = null;

afterEach(() => {
    randomSpy?.mockRestore();
    randomSpy = null;
});

const renderRoll = (props) => render(
    <DiceRollResult name="Test Roll" type="d20" {...props} />
);

// The popup's authoritative total lives in the .dice-roll-total slot; feature
// result rows repeat numbers in their own rows, so target the slot directly.
const totalText = (container) => container.querySelector('.dice-roll-total').textContent;

describe('DiceRollResult — Trance of Order d20 floor', () => {
    it.each`
        rollType           | rolls   | bonus | modifier | roll  | expectedTotal
        ${'check'}         | ${[7]}  | ${4}  | ${0}     | ${7}  | ${'14'}
        ${'save'}          | ${[3]}  | ${2}  | ${0}     | ${3}  | ${'12'}
        ${'attack'}        | ${[5]}  | ${3}  | ${0}     | ${5}  | ${'13'}
        ${'skill'}         | ${[9]}  | ${2}  | ${0}     | ${9}  | ${'12'}
        ${'condition-save'}| ${[4]}  | ${2}  | ${0}     | ${4}  | ${'12'}
        ${'check'}         | ${[2]}  | ${3}  | ${2}     | ${2}  | ${'15'}
    `(
        'floors d20 $roll to 10 for rollType $rollType — total is 10 + $bonus + $modifier = $expectedTotal',
        ({ rollType, rolls, bonus, modifier, roll, expectedTotal }) => {
            const { container } = renderRoll({ rollType, rolls, bonus, modifier, d20Floor10: true });

            expect(totalText(container)).toBe(expectedTotal);
            expect(screen.getByText(new RegExp(`Trance of Order: d20 ${roll} → 10`))).toBeInTheDocument();
        }
    );

    it.each`
        scenario              | d20Floor10  | rolls   | bonus | expectedTotal
        ${'boundary roll 10'} | ${true}     | ${[10]} | ${4}  | ${'14'}
        ${'roll above 9'}     | ${true}     | ${[14]} | ${4}  | ${'18'}
        ${'flag false'}       | ${false}    | ${[7]}  | ${4}  | ${'11'}
        ${'flag undefined'}   | ${undefined} | ${[7]}  | ${4}  | ${'11'}
    `(
        'does not floor when $scenario — natural roll stands in the total',
        ({ d20Floor10, rolls, bonus, expectedTotal }) => {
            const { container } = renderRoll({ rollType: 'check', rolls, bonus, d20Floor10 });

            expect(totalText(container)).toBe(expectedTotal);
            expect(screen.queryByText(/Trance of Order/)).not.toBeInTheDocument();
        }
    );

    it('keeps the floor notice after Stroke of Luck converts the d20 to 20 and consumes the offer', () => {
        const onStrokeOfLuck = vi.fn();
        const { container } = renderRoll({
            rollType: 'attack',
            rolls: [5],
            bonus: 3,
            d20Floor10: true,
            strokeOfLuck: true,
            onStrokeOfLuck,
        });

        fireEvent.click(screen.getByRole('button', { name: /Stroke of Luck/ }));

        expect(onStrokeOfLuck).toHaveBeenCalledWith('strokeOfLuck');
        // Stroke total (20 + 3) replaces the floored total on the main line.
        expect(totalText(container)).toBe('23');
        // The offer is consumed — the trigger button is gone.
        expect(screen.queryByRole('button', { name: /Stroke of Luck/ })).not.toBeInTheDocument();
        // Notice keys off the originally rolled die, not the stroke total.
        expect(screen.getByText(/Trance of Order: d20 5 → 10/)).toBeInTheDocument();
    });

    it('re-floors the total when an auto-reroll still lands on 9 or lower', () => {
        randomSpy = vi.spyOn(Math, 'random');
        randomSpy.mockReturnValue(0.4); // new d20 = Math.floor(0.4 * 20) + 1 = 9
        const onReroll = vi.fn();
        const { container } = renderRoll({
            rollType: 'attack',
            rolls: [5],
            bonus: 3,
            d20Floor10: true,
            autoReroll: true,
            onReroll,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Reroll' }));

        expect(onReroll).toHaveBeenCalledWith({ roll: 9, total: 12 });
        expect(screen.getByText(/Rerolled: 9/)).toBeInTheDocument();
        // Floor re-applies to the rerolled die: 10 + 3.
        expect(totalText(container)).toBe('13');
        expect(screen.getByText(/Trance of Order: d20 5 → 10/)).toBeInTheDocument();
    });

    it('does not floor the total when an auto-reroll lands above 9', () => {
        randomSpy = vi.spyOn(Math, 'random');
        randomSpy.mockReturnValue(0.95); // new d20 = Math.floor(0.95 * 20) + 1 = 20
        const { container } = renderRoll({
            rollType: 'attack',
            rolls: [5],
            bonus: 3,
            d20Floor10: true,
            autoReroll: true,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Reroll' }));

        expect(totalText(container)).toBe('23');
    });

    it('keeps the floor notice and reports the bardic die when inspiration is added to a floored check', () => {
        randomSpy = vi.spyOn(Math, 'random');
        randomSpy.mockReturnValue(0.5); // d6 = Math.floor(0.5 * 6) + 1 = 4
        const onBardicInspiration = vi.fn();
        const { container } = renderRoll({
            rollType: 'check',
            rolls: [5],
            bonus: 3,
            d20Floor10: true,
            bardicInspiration: true,
            bardicInspirationDie: 'd6',
            onBardicInspiration,
        });

        fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration/ }));

        expect(onBardicInspiration).toHaveBeenCalledWith(4, 6);
        expect(screen.getByText(/Bardic Inspiration: 1d6 → 4/)).toBeInTheDocument();
        // The offer is consumed — the trigger button is gone.
        expect(screen.queryByRole('button', { name: /Bardic Inspiration/ })).not.toBeInTheDocument();
        expect(screen.getByText(/Trance of Order: d20 5 → 10/)).toBeInTheDocument();
        // Known collision (see report): computeBaseTotal prefers the floored
        // total (10 + 3) over the bardic-enhanced display total (5 + 3 + 4 = 12).
        expect(totalText(container)).toBe('13');
    });
});
