// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('interactive button visibility', () => {
        describe('lucky buttons', () => {
            it.each`
                prop                | buttonText
                ${'luckyAdvantage'} | ${/Lucky: Advantage/}
                ${'luckyDisadvantage'} | ${/Lucky: Disadvantage/}
            `('renders "$buttonText" when $prop is true', ({ prop, buttonText }) => {
                render(
                    <DiceRollResult
                        name="Attack"
                        type="d20"
                        rolls={[8, 15]}
                        bonus={3}
                        {...{ [prop]: true }}
                    />
                );
                expect(screen.getByText(buttonText)).toBeInTheDocument();
            });

            it('hides lucky buttons for non-d20 types', () => {
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
            });

            it('hides lucky buttons when props are not provided', () => {
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
            `('renders "$expectedText" when autoReroll is true', ({ autoRerollBonus, expectedText }) => {
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

            it('hides reroll button for non-d20 types', () => {
                render(
                    <DiceRollResult
                        name="Fireball"
                        type="damage"
                        rolls={[6, 5, 4]}
                        bonus={0}
                        autoReroll={true}
                    />
                );
                expect(screen.queryByText(/Reroll/)).not.toBeInTheDocument();
            });

            it('hides reroll button when autoRerollCondition is roll_equals_1', () => {
                render(
                    <DiceRollResult
                        name="Attack"
                        type="d20"
                        rolls={[12]}
                        bonus={3}
                        autoReroll={true}
                        autoRerollCondition="roll_equals_1"
                    />
                );
                expect(screen.queryByText(/Reroll/)).not.toBeInTheDocument();
            });
        });

        describe('stroke of luck button', () => {
            it('renders stroke of luck button for d20 types', () => {
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
            });

            it('hides stroke of luck for non-d20 types', () => {
                render(
                    <DiceRollResult
                        name="Fireball"
                        type="damage"
                        rolls={[6, 5, 4]}
                        bonus={3}
                        strokeOfLuck={true}
                    />
                );
                expect(screen.queryByText(/Stroke of Luck/)).not.toBeInTheDocument();
            });
        });

        describe('tactical mind button', () => {
            it.each`
                rollType   | shouldShow
                ${'check'} | ${true}
                ${'skill'} | ${true}
                ${'attack'}| ${false}
                ${'save'}  | ${false}
            `('renders tactical mind for rollType "$rollType"', ({ rollType, shouldShow }) => {
                const name = rollType === 'attack' ? 'Attack' : rollType === 'save' ? 'DEX Save' : 'Athletics';
                render(
                    <DiceRollResult
                        name={name}
                        type="d20"
                        rolls={[5]}
                        bonus={3}
                        rollType={rollType}
                        tacticalMind={true}
                    />
                );
                if (shouldShow) {
                    expect(screen.getByText(/Tactical Mind/)).toBeInTheDocument();
                } else {
                    expect(screen.queryByText(/Tactical Mind/)).not.toBeInTheDocument();
                }
            });
        });

        describe('superiority maneuver buttons', () => {
            it('renders buttons for multiple maneuvers', () => {
                render(
                    <DiceRollResult
                        name="Attack"
                        type="d20"
                        rolls={[12]}
                        bonus={3}
                        rollType="attack"
                        availableSuperiorityManeuvers={[{ name: 'Precision Attack' }, { name: 'Trip Attack' }]}
                    />
                );
                expect(screen.getByText(/Precision Attack/)).toBeInTheDocument();
                expect(screen.getByText(/Trip Attack/)).toBeInTheDocument();
            });

            it('does not render when maneuvers array is empty', () => {
                render(
                    <DiceRollResult
                        name="Attack"
                        type="d20"
                        rolls={[12]}
                        bonus={3}
                        rollType="attack"
                        availableSuperiorityManeuvers={[]}
                    />
                );
                expect(screen.queryByText(/Precision Attack/)).not.toBeInTheDocument();
                expect(screen.queryByText(/Trip Attack/)).not.toBeInTheDocument();
            });

        });

        describe('lucky reroll (Halfling trait)', () => {
            it('renders lucky reroll message when luckyRerolled is true', () => {
                render(
                    <DiceRollResult
                        name="DEX Save"
                        type="d20"
                        rolls={[1, 19]}
                        bonus={2}
                        luckyRerolled={true}
                        luckyRerollValue={14}
                    />
                );
                expect(screen.getByText(/Lucky \(Halfling\): rerolled natural 1 → 14/)).toBeInTheDocument();
                expect(screen.getByText(/14 \(Lucky reroll\)/)).toBeInTheDocument();
            });

            it('hides lucky reroll message when luckyRerolled is false', () => {
                render(
                    <DiceRollResult
                        name="Attack"
                        type="d20"
                        rolls={[12]}
                        bonus={3}
                        luckyRerolled={false}
                    />
                );
                expect(screen.queryByText(/Lucky \(Halfling\)/)).not.toBeInTheDocument();
            });
        });
    });

    describe('interactive button click results', () => {
        it('hides reroll button and shows rerolled result after clicking', () => {
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    autoReroll={true}
                />
            );
            fireEvent.click(screen.getByText(/Reroll/));
            expect(screen.getByText(/Rerolled/)).toBeInTheDocument();
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
        });

        it('hides stroke of luck button and shows result after clicking', () => {
            const { container } = render(
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
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
        });

        it('hides tactical mind button and shows adjudication panel after clicking', () => {
            const { container } = render(
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
            expect(screen.getByText(/Succeeded/)).toBeInTheDocument();
            expect(screen.getByText(/Still Failed/)).toBeInTheDocument();
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
        });

        it('CLA-352: defers the spend — declares via Succeeded / Still Failed callbacks', async () => {
            const onTacticalMind = vi.fn();
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="check"
                    tacticalMind={true}
                    onTacticalMind={onTacticalMind}
                />
            );
            fireEvent.click(screen.getByRole('button', { name: /Tactical Mind/ }));
            expect(onTacticalMind).not.toHaveBeenCalled();
            fireEvent.click(screen.getByRole('button', { name: /Still Failed/ }));
            expect(onTacticalMind).toHaveBeenCalledWith({ dieValue: expect.any(Number), success: false });
            expect(screen.getByText(/Second Wind use not expended/)).toBeInTheDocument();
        });

        it('CLA-352: hides offer on a known-successful check', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[19]}
                    bonus={3}
                    rollType="check"
                    success={true}
                    tacticalMind={true}
                />
            );
            expect(screen.queryByText(/Tactical Mind/)).not.toBeInTheDocument();
        });

        it('CLA-352: hides offer on a natural 20 check', () => {
            render(
                <DiceRollResult
                    name="Arcana"
                    type="d20"
                    rolls={[20]}
                    bonus={3}
                    rollType="check"
                    tacticalMind={true}
                />
            );
            expect(screen.queryByText(/Tactical Mind/)).not.toBeInTheDocument();
        });

        it('CLA-352: popup total is numeric when modifier prop is undefined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Arcana"
                    type="d20"
                    rolls={[8]}
                    bonus={3}
                    rollType="check"
                    tacticalMind={true}
                />
            );
            fireEvent.click(screen.getByRole('button', { name: /Tactical Mind/ }));
            const resultText = container.querySelector('.dice-roll-reroll-result').textContent;
            expect(resultText).not.toContain('NaN');
            expect(resultText).toMatch(/Tactical Mind: \+\d+ → \d+/);
        });

        it('hides superiority maneuver button and shows result after clicking', () => {
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    rollType="attack"
                    availableSuperiorityManeuvers={[{ name: 'Precision Attack' }]}
                    playerStats={{ level: 3 }}
                    onSuperiorityManeuver={vi.fn()}
                />
            );
            fireEvent.click(screen.getByText(/Precision Attack/));
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
        });
    });

    describe('combined hit/miss and save info', () => {
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

        it('shows hit with reaction bonus in hit/miss text', () => {
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
                    defensiveDuelistBonus={1}
                    baitAndSwitchBonus={2}
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
            expect(hitMiss.textContent).toContain('HIT');
            expect(hitMiss.textContent).toContain('3 reaction');
        });
    });

    describe('damage type choice events', () => {
        it('dispatches damage-type-choice event with chosen type on button click', () => {
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
            fireEvent.click(screen.getByText('Fire'));
            expect(handler).toHaveBeenCalledTimes(1);
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
            fireEvent.click(screen.getByText('Skip'));
            expect(handler).toHaveBeenCalledTimes(1);
            window.removeEventListener('damage-type-skip', handler);
        });
    });

    describe('bardic inspiration defense interaction', () => {
        it('calls onBardicInspirationDefense and shows result div after clicking', () => {
            const onBardicInspirationDefense = vi.fn();
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    targetName="Goblin"
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
        it('calls onBardicInspirationOffense and shows result div after clicking', () => {
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

    describe('done button interaction', () => {
        it('calls onDone with computedHit when clicked', () => {
            const onDone = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    targetName="Goblin"
                    targetAc={14}
                    hit={true}
                    rollType="attack"
                    autoDamage={true}
                    onDone={onDone}
                />
            );
            fireEvent.click(screen.getByText('Done'));
            expect(onDone).toHaveBeenCalledWith(true);
        });
    });

    describe('save-damage total hiding', () => {
        it('hides total when type is save-damage and finalDamage is 0', () => {
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
            expect(container.querySelector('.dice-roll-total')).not.toBeInTheDocument();
        });

        it('hides total when rollType is save-damage and finalDamage is 0', () => {
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

        it('shows total when save-damage has finalDamage > 0', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="save-damage"
                    rolls={[6]}
                    bonus={0}
                    finalDamage={5}
                    damageApplied={true}
                />
            );
            expect(container.querySelector('.dice-roll-total')).toBeInTheDocument();
        });
    });

    describe('auto crit display', () => {
        it('shows critical hit message for auto crit damage', () => {
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
});
