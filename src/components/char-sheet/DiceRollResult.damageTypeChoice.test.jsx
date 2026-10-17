// @maintained-by-ai
import { render, within } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

// Event dispatch on button clicks (damage-type-choice / damage-type-skip)
// is owned by DiceRollResult.interactive.test.jsx — this file owns the
// DamageTypeChoiceSection rendering contract only.

const choiceProps = {
    name: 'Flame Blade',
    type: 'damage_type_choice',
    rolls: [8],
    bonus: 0,
    baseFormula: '1d8',
    baseRolls: [5],
    baseTotal: 5,
    bonusFormula: '1d8',
    bonusRolls: [3],
    bonusTotal: 3,
    types: ['Fire', 'Cold'],
};

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

function renderChoice(overrides = {}) {
    const { container } = render(<DiceRollResult {...choiceProps} {...overrides} />);
    return container.querySelector('.dice-roll-damage-type-choice');
}

describe('DiceRollResult — damage type choice', () => {
    it.each(['damage', 'd20'])(
        'renders nothing when type is %s',
        (type) => {
            const { container } = render(
                <DiceRollResult
                    name={type === 'damage' ? 'Fireball' : 'Attack'}
                    type={type}
                    rolls={type === 'damage' ? [6, 5, 4] : [15]}
                    bonus={type === 'damage' ? 0 : 3}
                    types={['Fire']}
                />
            );
            expect(container.querySelector('.dice-roll-damage-type-choice')).not.toBeInTheDocument();
        }
    );

    it('renders header, prompts, and Skip when type is damage_type_choice', () => {
        const section = renderChoice();
        expect(section).toBeInTheDocument();

        const choices = within(section);
        expect(choices.getByText(/Flame Blade/)).toBeInTheDocument();
        expect(choices.getByText('Choose the damage type for this hit:')).toBeInTheDocument();
        expect(choices.getByText('Choose bonus damage type:')).toBeInTheDocument();
    });

    it.each([
        ['populated roll arrays', [5], [3], 5, 3,
            ['Weapon Damage: 1d8: 5 = 5', 'Divine Strike: 1d8: 3 = 3']],
        ['null roll arrays', null, null, 0, 0,
            ['Weapon Damage: 1d8: = 0', 'Divine Strike: 1d8: = 0']],
        ['undefined roll arrays', undefined, undefined, 0, 0,
            ['Weapon Damage: 1d8: = 0', 'Divine Strike: 1d8: = 0']],
    ])(
        'shows weapon and Divine Strike breakdown for %s',
        (_label, baseRolls, bonusRolls, baseTotal, bonusTotal, expectedLines) => {
            const section = renderChoice({ baseRolls, bonusRolls, baseTotal, bonusTotal });
            const lines = Array.from(section.querySelectorAll('.dice-roll-breakdown'))
                .map((el) => normalize(el.textContent));
            expect(lines).toEqual(expectedLines);
        }
    );

    it.each([
        [['Fire'], ['Fire', 'Skip']],
        [['Fire', 'Cold', 'Lightning'], ['Fire', 'Cold', 'Lightning', 'Skip']],
        [[], ['Skip']],
        [null, ['Skip']],
        [undefined, ['Skip']],
    ])(
        'renders one button per type plus Skip when types is %s',
        (types, expectedNames) => {
            const section = renderChoice({ types });
            const buttons = within(section).getAllByRole('button');
            expect(buttons.map((button) => button.textContent.trim())).toEqual(expectedNames);
        }
    );
});
