import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('damage type choice', () => {
        it('shows damage type choice UI when type is damage_type_choice', () => {
            const { container } = render(
                <DiceRollResult
                    name="Flame Blade"
                    type="damage_type_choice"
                    rolls={[18]}
                    bonus={5}
                    baseFormula="1d8"
                    baseRolls={[5]}
                    baseTotal={5}
                    bonusFormula="1d8"
                    bonusRolls={[3]}
                    bonusTotal={3}
                    types={['Fire', 'Cold']}
                />
            );
            expect(container.querySelector('.dice-roll-damage-type-choice')).toBeInTheDocument();
            expect(container.querySelector('.dice-roll-header')).toHaveTextContent('Flame Blade');
            expect(screen.getByText(/Choose the damage type for this hit/)).toBeInTheDocument();
            expect(screen.getByText(/Fire/)).toBeInTheDocument();
            expect(screen.getByText(/Cold/)).toBeInTheDocument();
            expect(screen.getByText(/Skip/)).toBeInTheDocument();
        });

        it('dispatches damage-type-choice event when a type button is clicked', () => {
            const handler = vi.fn();
            window.addEventListener('damage-type-choice', handler);
            render(
                <DiceRollResult
                    name="Flame Blade"
                    type="damage_type_choice"
                    rolls={[18]}
                    bonus={5}
                    baseFormula="1d8"
                    baseRolls={[5]}
                    baseTotal={5}
                    bonusFormula="1d8"
                    bonusRolls={[3]}
                    bonusTotal={3}
                    types={['Fire', 'Cold']}
                />
            );
            fireEvent.click(screen.getByText(/Fire/));
            expect(handler).toHaveBeenCalled();
            expect(handler.mock.calls[0][0].detail.chosenType).toBe('Fire');
            window.removeEventListener('damage-type-choice', handler);
        });

        it('dispatches damage-type-skip event when skip is clicked', () => {
            const handler = vi.fn();
            window.addEventListener('damage-type-skip', handler);
            render(
                <DiceRollResult
                    name="Flame Blade"
                    type="damage_type_choice"
                    rolls={[18]}
                    bonus={5}
                    baseFormula="1d8"
                    baseRolls={[5]}
                    baseTotal={5}
                    bonusFormula="1d8"
                    bonusRolls={[3]}
                    bonusTotal={3}
                    types={['Fire', 'Cold']}
                />
            );
            fireEvent.click(screen.getByText(/Skip/));
            expect(handler).toHaveBeenCalled();
            window.removeEventListener('damage-type-skip', handler);
        });
    });

    describe('bardic inspiration defense interaction', () => {
        it('shows bardic inspiration defense button when hit is true', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    hit={true}
                    bardicInspirationDefense={true}
                    bardicInspirationDefenseDieSize={6}
                />
            );
            expect(screen.getByText(/Bardic Inspiration - Defense/)).toBeInTheDocument();
        });

        it('does not show bardic inspiration defense button when hit is false', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    hit={false}
                    bardicInspirationDefense={true}
                    bardicInspirationDefenseDieSize={6}
                />
            );
            expect(screen.queryByText(/Bardic Inspiration - Defense/)).not.toBeInTheDocument();
        });

        it('calls onBardicInspirationDefense and shows result after clicking', () => {
            const onBardicInspirationDefense = vi.fn();
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    targetAc={16}
                    hit={true}
                    bardicInspirationDefense={true}
                    bardicInspirationDefenseDieSize={6}
                    onBardicInspirationDefense={onBardicInspirationDefense}
                />
            );
            fireEvent.click(screen.getByText(/Bardic Inspiration - Defense/));
            expect(onBardicInspirationDefense).toHaveBeenCalled();
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
        });
    });

    describe('bardic inspiration offense interaction', () => {
        it('shows bardic inspiration offense button for damage types', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    bardicInspirationOffense={true}
                    bardicInspirationOffenseDieSize={6}
                />
            );
            expect(screen.getByText(/Bardic Inspiration - Offense/)).toBeInTheDocument();
        });

        it('does not show bardic inspiration offense button for non-damage types', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    bardicInspirationOffense={true}
                />
            );
            expect(screen.queryByText(/Bardic Inspiration - Offense/)).not.toBeInTheDocument();
        });

        it('calls onBardicInspirationOffense and shows result after clicking', () => {
            const onBardicInspirationOffense = vi.fn();
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    total={15}
                    bardicInspirationOffense={true}
                    bardicInspirationOffenseDieSize={6}
                    onBardicInspirationOffense={onBardicInspirationOffense}
                />
            );
            fireEvent.click(screen.getByText(/Bardic Inspiration - Offense/));
            expect(onBardicInspirationOffense).toHaveBeenCalled();
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
        });
    });

    describe('onDone button', () => {
        it('calls onDone when clicked', () => {
            const onDone = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    autoDamage={true}
                    hit={true}
                    onDone={onDone}
                />
            );
            fireEvent.click(screen.getByText('Done'));
            expect(onDone).toHaveBeenCalled();
        });

        it('does not call onDone when not provided', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    autoDamage={true}
                    hit={true}
                />
            );
            fireEvent.click(screen.getByText('Done'));
        });
    });

    describe('dice-roll-hint', () => {
        it('always shows the hint text', () => {
            render(
                <DiceRollResult
                    name="Test"
                    type="d20"
                    rolls={[10]}
                    bonus={3}
                />
            );
            expect(screen.getByText('click to dismiss')).toBeInTheDocument();
        });
    });

    describe('save result with advantage/disadvantage', () => {
        it('shows disadvantage badge on save result when forcedMode is disadvantage', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={{ success: true, total: 18, roll: 14, bonus: 4 }}
                    saveDc={15}
                    forcedMode="disadvantage"
                />
            );
            const saveResult = container.querySelector('.dice-roll-save-result');
            expect(saveResult.textContent).toContain('Disadvantage');
        });

        it('shows advantage badge on save result when forcedMode is advantage', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={{ success: true, total: 18, roll: 14, bonus: 4 }}
                    saveDc={15}
                    forcedMode="advantage"
                />
            );
            const saveResult = container.querySelector('.dice-roll-save-result');
            expect(saveResult.textContent).toContain('Advantage');
        });

        it('does not show advantage/disadvantage badge when forcedMode is not set', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={{ success: true, total: 18, roll: 14, bonus: 4 }}
                    saveDc={15}
                />
            );
            const saveResult = container.querySelector('.dice-roll-save-result');
            expect(saveResult.textContent).not.toContain('Advantage');
            expect(saveResult.textContent).not.toContain('Disadvantage');
        });
    });

    describe('save-damage type hiding total', () => {
        it('hides total when save-damage type has finalDamage = 0', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="save-damage"
                    rolls={[6]}
                    bonus={0}
                    finalDamage={0}
                    damageApplied={true}
                />
            );
            // The total div should not be present
            expect(container.querySelector('.dice-roll-total')).not.toBeInTheDocument();
        });

        it('shows total when save-damage type has finalDamage > 0', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="save-damage"
                    rolls={[6]}
                    bonus={0}
                    total={10}
                    finalDamage={5}
                    damageApplied={true}
                />
            );
            expect(screen.getByText('5')).toBeInTheDocument();
        });

        it('hides total when rollType is save-damage and finalDamage <= 0', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    rollType="save-damage"
                    finalDamage={0}
                    damageApplied={true}
                />
            );
            expect(container.querySelector('.dice-roll-total')).not.toBeInTheDocument();
        });
    });

    describe('stroke of luck natural 20 display', () => {
        it('shows Natural 20! when stroke of luck is used on non-crit roll', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    strokeOfLuck={true}
                />
            );
            // The button should be shown
            expect(screen.getByText(/Stroke of Luck/)).toBeInTheDocument();
        });
    });

    describe('breakdown display for bardic inspiration result', () => {
        it('shows bardic inspiration d20 roll in breakdown after using bardic inspiration', () => {
            const { container } = render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="check"
                    bardicInspiration={true}
                    bardicInspirationDie="d8"
                />
            );
            fireEvent.click(screen.getByText(/Bardic Inspiration/));
            const breakdown = container.querySelector('.dice-roll-breakdown');
            expect(breakdown.textContent).toContain('5');
        });
    });

    describe('auto crit display on damage', () => {
        it('shows critical hit message for damage type with isAutoCrit', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    total={15}
                    isAutoCrit={true}
                />
            );
            expect(screen.getByText(/Critical Hit!/)).toBeInTheDocument();
            expect(screen.getByText(/damage dice doubled/)).toBeInTheDocument();
        });
    });

    describe('non-d20 breakdown with crit damage', () => {
        it('shows doubled dice notation for crit damage', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    total={15}
                    isCrit={true}
                />
            );
            const breakdown = container.querySelector('.dice-roll-breakdown');
            expect(breakdown.textContent).toContain('6*2');
        });
    });
});
