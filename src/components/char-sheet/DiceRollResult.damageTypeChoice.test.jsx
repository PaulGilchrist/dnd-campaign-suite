import { render, screen } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('damage type choice', () => {
        it('renders base and bonus damage breakdown with null/undefined roll data', () => {
            const { container } = render(
                <DiceRollResult
                    name="Test"
                    type="damage_type_choice"
                    rolls={[]}
                    bonus={0}
                    baseFormula="1d8"
                    baseRolls={null}
                    baseTotal={0}
                    bonusFormula="1d8"
                    bonusRolls={null}
                    bonusTotal={0}
                    types={['Fire']}
                />
            );
            expect(container.querySelector('.dice-roll-damage-type-choice')).toBeInTheDocument();
            const weaponLine = container.querySelector('.dice-roll-breakdown');
            expect(weaponLine.textContent).toContain('Weapon Damage:');
            expect(weaponLine.textContent).toContain('1d8:');
            expect(weaponLine.textContent).toContain('0');
        });

        it.each`
            types
            ${null}
            ${undefined}
            ${[]}
        `('renders no type buttons and shows skip when types is $types', ({ types }) => {
            const { container } = render(
                <DiceRollResult
                    name="Test"
                    type="damage_type_choice"
                    rolls={[10]}
                    bonus={0}
                    types={types}
                />
            );
            expect(container.querySelector('.dice-roll-damage-type-choice')).toBeInTheDocument();
            expect(screen.queryByText(/Skip/)).toBeInTheDocument();
        });

        it.each`
            type
            ${'damage'}
            ${'d20'}
        `('does not render the damage type choice container when type is $type', ({ type }) => {
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
        });
    });
});
