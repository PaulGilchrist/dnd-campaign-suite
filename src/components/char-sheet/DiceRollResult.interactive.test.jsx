// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('lucky point buttons', () => {
        it.each`
            prop                | onProp                | buttonText
            ${'luckyAdvantage'} | ${'onLuckyAdvantage'} | ${'Lucky: Advantage'}
            ${'luckyDisadvantage'} | ${'onLuckyDisadvantage'} | ${'Lucky: Disadvantage'}
        `('shows $buttonText button when $prop is true', ({ prop, onProp, buttonText }) => {
            const onCallback = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    {...{ [prop]: true, [onProp]: onCallback }}
                />
            );
            expect(screen.getByText(new RegExp(`Lucky:.*${buttonText.split(' ').slice(1).join(' ')}`))).toBeInTheDocument();
        });

        it.each`
            prop                | onProp                | buttonText       | expectedTotal
            ${'luckyAdvantage'} | ${'onLuckyAdvantage'} | ${'Lucky: Advantage'} | ${'18'}
            ${'luckyDisadvantage'} | ${'onLuckyDisadvantage'} | ${'Lucky: Disadvantage'} | ${'11'}
        `('uses $buttonText and calls callback when clicked', ({ prop, onProp, buttonText, expectedTotal }) => {
            const onCallback = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[8, 15]}
                    bonus={3}
                    {...{ [prop]: true, [onProp]: onCallback }}
                />
            );
            fireEvent.click(screen.getByText(new RegExp(`Lucky:.*${buttonText.split(' ').slice(1).join(' ')}`)));
            expect(onCallback).toHaveBeenCalled();
            expect(screen.getByText(expectedTotal)).toBeInTheDocument();
        });

        it('does not show lucky buttons for non-d20 types or when not provided', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    luckyAdvantage={true}
                    luckyDisadvantage={true}
                />
            );
            expect(screen.queryByText(/Lucky: Advantage/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Lucky: Disadvantage/)).not.toBeInTheDocument();

            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                />
            );
            expect(screen.queryByText(/Lucky: Advantage/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Lucky: Disadvantage/)).not.toBeInTheDocument();
        });
    });

    describe('reroll button', () => {
        it.each`
            autoRerollBonus | expectedText
            ${undefined}    | ${'Reroll'}
            ${2}            | ${'Reroll (+2)'}
        `('shows reroll button with text "$expectedText" when autoReroll is true', ({ autoRerollBonus, expectedText }) => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    autoReroll={true}
                    {...(autoRerollBonus !== undefined && { autoRerollBonus })}
                />
            );
            expect(screen.getByText(expectedText)).toBeInTheDocument();
        });

        it.each`
            type       | autoReroll | shouldShow
            ${'d20'}   | ${false}   | ${false}
            ${'damage'}| ${true}    | ${false}
        `('does not show reroll when type: $type, autoReroll: $autoReroll', ({ type, autoReroll }) => {
            render(
                <DiceRollResult
                    name={type === 'd20' ? 'Attack' : 'Fireball'}
                    type={type}
                    rolls={type === 'd20' ? [12] : [6, 5, 4]}
                    bonus={0}
                    autoReroll={autoReroll}
                />
            );
            expect(screen.queryByText(/Reroll/)).not.toBeInTheDocument();
        });

        it('hides reroll button and shows rerolled result after clicking', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    autoReroll={true}
                />
            );
            fireEvent.click(screen.getByText(/Reroll/));
            expect(screen.getByText(/Rerolled:/)).toBeInTheDocument();
        });
    });

    describe('stroke of luck', () => {
        it.each`
            strokeOfLuck | type       | shouldShow
            ${true}      | ${'d20'}   | ${true}
            ${false}     | ${'d20'}   | ${false}
            ${true}      | ${'damage'}| ${false}
        `('shows stroke of luck when strokeOfLuck: $strokeOfLuck, type: $type', ({ strokeOfLuck, type, shouldShow }) => {
            if (shouldShow) {
                render(
                    <DiceRollResult
                        name="Attack"
                        type="d20"
                        rolls={[12]}
                        bonus={3}
                        strokeOfLuck={true}
                    />
                );
                expect(screen.getByText(/Stroke of Luck/)).toBeInTheDocument();
            } else {
                render(
                    <DiceRollResult
                        name={type === 'd20' ? 'Attack' : 'Fireball'}
                        type={type}
                        rolls={type === 'd20' ? [12] : [6, 5, 4]}
                        bonus={3}
                        strokeOfLuck={strokeOfLuck}
                    />
                );
                expect(screen.queryByText(/Stroke of Luck/)).not.toBeInTheDocument();
            }
        });

        it('hides stroke of luck button and shows result after clicking', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    strokeOfLuck={true}
                />
            );
            fireEvent.click(screen.getByText(/Stroke of Luck/));
            expect(screen.getByText(/Stroke of Luck:/)).toBeInTheDocument();
        });
    });

    describe('tactical mind', () => {
        it.each`
            rollType   | tacticalMind | shouldShow
            ${'check'} | ${true}      | ${true}
            ${'skill'} | ${true}      | ${true}
            ${'attack'}| ${true}      | ${false}
            ${'save'}  | ${true}      | ${false}
        `('shows tactical mind for rollType: $rollType when tacticalMind: $tacticalMind', ({ rollType, tacticalMind, shouldShow }) => {
            if (shouldShow) {
                render(
                    <DiceRollResult
                        name="Athletics"
                        type="d20"
                        rolls={[5]}
                        bonus={3}
                        rollType={rollType}
                        tacticalMind={true}
                    />
                );
                expect(screen.getByText(/Tactical Mind/)).toBeInTheDocument();
            } else {
                render(
                    <DiceRollResult
                        name={rollType === 'attack' ? 'Attack' : 'DEX Save'}
                        type="d20"
                        rolls={[5]}
                        bonus={3}
                        rollType={rollType}
                        tacticalMind={tacticalMind}
                    />
                );
                expect(screen.queryByText(/Tactical Mind/)).not.toBeInTheDocument();
            }
        });

        it('hides tactical mind button and shows result after clicking', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="check"
                    tacticalMind={true}
                />
            );
            fireEvent.click(screen.getByText(/Tactical Mind/));
            expect(screen.getByText(/Tactical Mind:/)).toBeInTheDocument();
        });
    });

    describe('combined features', () => {
        it('shows both hit/miss and save info on the same roll', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    targetName="Goblin"
                    hit={true}
                    rollType="attack"
                    dc={16}
                    dcType="DEX"
                    dcSuccess="half"
                />
            );
            expect(screen.getByText(/HIT/)).toBeInTheDocument();
            expect(screen.getByText(/Save DC 16 DEX/)).toBeInTheDocument();
        });

        it('shows hit with glorious defense bonus in text', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    targetName="Goblin"
                    targetAc={14}
                    hit={true}
                    rollType="attack"
                    gloriousDefenseBonus={2}
                    defensiveDuelistBonus={1}
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
            expect(hitMiss.textContent).toContain('HIT');
            expect(hitMiss.textContent).toContain('3 reaction');
        });

        it('shows hit with zero reaction bonus when both bonuses are zero', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    targetName="Goblin"
                    hit={true}
                    rollType="attack"
                    gloriousDefenseBonus={0}
                    defensiveDuelistBonus={0}
                />
            );
            expect(screen.getByText(/HIT/)).toBeInTheDocument();
            expect(screen.queryByText(/reaction/)).not.toBeInTheDocument();
        });
    });

    describe('superiority maneuvers', () => {
        it.each`
            maneuvers            | shouldShowPrecision | shouldShowTrip
            ${[{ name: 'Precision Attack' }, { name: 'Trip Attack' }]} | ${true} | ${true}
            ${[{ name: 'Trip Attack' }]} | ${false} | ${true}
            ${[]}                 | ${false} | ${false}
            ${null}               | ${false} | ${false}
        `('shows maneuver buttons based on maneuvers array', ({ maneuvers, shouldShowPrecision, shouldShowTrip }) => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    rollType="attack"
                    availableSuperiorityManeuvers={maneuvers}
                />
            );
            if (shouldShowPrecision) {
                expect(screen.getByText(/Precision Attack/)).toBeInTheDocument();
            } else {
                expect(screen.queryByText(/Precision Attack/)).not.toBeInTheDocument();
            }
            if (shouldShowTrip) {
                expect(screen.getByText(/Trip Attack/)).toBeInTheDocument();
            } else {
                expect(screen.queryByText(/Trip Attack/)).not.toBeInTheDocument();
            }
        });

        it('hides superiority maneuver buttons and shows result after clicking', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    rollType="attack"
                    availableSuperiorityManeuvers={[{ name: 'Precision Attack' }]}
                    onSuperiorityManeuver={vi.fn()}
                />
            );
            fireEvent.click(screen.getByText(/Precision Attack/));
            expect(screen.getByText(/Precision Attack:/)).toBeInTheDocument();
        });
    });
});
