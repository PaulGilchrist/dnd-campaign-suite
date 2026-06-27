// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('lucky point buttons', () => {
        it('shows Lucky Advantage button when luckyAdvantage is true', () => {
            const onLuckyAdv = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    luckyAdvantage={true}
                    onLuckyAdvantage={onLuckyAdv}
                />
            );
            expect(screen.getByText(/Lucky: Advantage/)).toBeInTheDocument();
        });

        it('shows Lucky Disadvantage button when luckyDisadvantage is true', () => {
            const onLuckyDisadv = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    luckyDisadvantage={true}
                    onLuckyDisadvantage={onLuckyDisadv}
                />
            );
            expect(screen.getByText(/Lucky: Disadvantage/)).toBeInTheDocument();
        });

        it('shows Lucky buttons text with LP cost', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    luckyAdvantage={true}
                    luckyDisadvantage={true}
                />
            );
            expect(screen.getByText(/Lucky: Advantage \(1 LP\)/)).toBeInTheDocument();
            expect(screen.getByText(/Lucky: Disadvantage \(1 LP\)/)).toBeInTheDocument();
        });

        it('does not show Lucky buttons for non-d20 types', () => {
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

        it('does not show Lucky buttons when not provided', () => {
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

        it('calls onLuckyAdvantage and sets advantage mode when Lucky Advantage is clicked', () => {
            const onLuckyAdv = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[8, 15]}
                    bonus={3}
                    luckyAdvantage={true}
                    onLuckyAdvantage={onLuckyAdv}
                />
            );
            expect(screen.getByText('11')).toBeInTheDocument();
            fireEvent.click(screen.getByText(/Lucky: Advantage/));
            expect(onLuckyAdv).toHaveBeenCalled();
            expect(screen.getByText('18')).toBeInTheDocument();
        });

        it('does not show Lucky button again after Lucky Advantage is used', () => {
            const onLuckyAdv = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[8, 15]}
                    bonus={3}
                    luckyAdvantage={true}
                    onLuckyAdvantage={onLuckyAdv}
                />
            );
            fireEvent.click(screen.getByText(/Lucky: Advantage/));
            expect(screen.queryByText(/Lucky: Advantage/)).not.toBeInTheDocument();
        });

        it('calls onLuckyDisadvantage and sets disadvantage mode when Lucky Disadvantage is clicked', () => {
            const onLuckyDisadv = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[8, 15]}
                    bonus={3}
                    luckyDisadvantage={true}
                    onLuckyDisadvantage={onLuckyDisadv}
                />
            );
            expect(screen.getByText('11')).toBeInTheDocument();
            fireEvent.click(screen.getByText(/Lucky: Disadvantage/));
            expect(onLuckyDisadv).toHaveBeenCalled();
            expect(screen.getByText('11')).toBeInTheDocument();
        });

        it('does not show Lucky Disadvantage button again after Lucky Disadvantage is used', () => {
            const onLuckyDisadv = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[8, 15]}
                    bonus={3}
                    luckyDisadvantage={true}
                    onLuckyDisadvantage={onLuckyDisadv}
                />
            );
            fireEvent.click(screen.getByText(/Lucky: Disadvantage/));
            expect(screen.queryByText(/Lucky: Disadvantage/)).not.toBeInTheDocument();
        });

        it('both Lucky buttons can be shown simultaneously and used independently', () => {
            const onLuckyAdv = vi.fn();
            const onLuckyDisadv = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[8, 15]}
                    bonus={3}
                    luckyAdvantage={true}
                    luckyDisadvantage={true}
                    onLuckyAdvantage={onLuckyAdv}
                    onLuckyDisadvantage={onLuckyDisadv}
                />
            );
            expect(screen.getByText(/Lucky: Advantage/)).toBeInTheDocument();
            expect(screen.getByText(/Lucky: Disadvantage/)).toBeInTheDocument();

            fireEvent.click(screen.getByText(/Lucky: Advantage/));
            expect(onLuckyAdv).toHaveBeenCalled();
            expect(onLuckyDisadv).not.toHaveBeenCalled();
            expect(screen.queryByText(/Lucky: Advantage/)).not.toBeInTheDocument();
            expect(screen.getByText(/Lucky: Disadvantage/)).toBeInTheDocument();
        });
    });

    describe('reroll button', () => {
        it('shows reroll button when autoReroll is true and not used', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    autoReroll={true}
                />
            );
            expect(screen.getByText(/Reroll/)).toBeInTheDocument();
        });

        it('shows reroll button with bonus when autoRerollBonus is provided', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    autoReroll={true}
                    autoRerollBonus={2}
                />
            );
            expect(screen.getByText(/Reroll \(\+2\)/)).toBeInTheDocument();
        });

        it('does not show reroll button when autoReroll is false', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    autoReroll={false}
                />
            );
            expect(screen.queryByText(/Reroll/)).not.toBeInTheDocument();
        });

        it('does not show reroll button for non-d20 types', () => {
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

        it('hides reroll button after it has been used', () => {
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
            const rerollContainer = container.querySelector('.dice-roll-reroll');
            expect(rerollContainer).not.toBeInTheDocument();
        });

        it('shows reroll result after clicking reroll', () => {
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

        it('calls onReroll callback when reroll is used', () => {
            const onReroll = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    autoReroll={true}
                    onReroll={onReroll}
                />
            );
            fireEvent.click(screen.getByText(/Reroll/));
            expect(onReroll).toHaveBeenCalled();
        });
    });

    describe('stroke of luck', () => {
        it('shows stroke of luck button when strokeOfLuck is true and not used', () => {
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

        it('does not show stroke of luck button when strokeOfLuck is false', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    strokeOfLuck={false}
                />
            );
            expect(screen.queryByText(/Stroke of Luck/)).not.toBeInTheDocument();
        });

        it('does not show stroke of luck button for non-d20 types', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    strokeOfLuck={true}
                />
            );
            expect(screen.queryByText(/Stroke of Luck/)).not.toBeInTheDocument();
        });

        it('hides stroke of luck button after it has been used', () => {
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
            const strokeContainer = container.querySelector('.dice-roll-reroll');
            expect(strokeContainer).not.toBeInTheDocument();
        });

        it('shows stroke of luck result after clicking stroke of luck', () => {
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

        it('sets total to 20 + bonus + modifier after stroke of luck', () => {
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    modifier={2}
                    strokeOfLuck={true}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('10');
            fireEvent.click(screen.getByText(/Stroke of Luck/));
            expect(container.querySelector('.dice-roll-total').textContent).toBe('25');
        });

        it('calls onStrokeOfLuck callback when stroke of luck is used', () => {
            const onStroke = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    strokeOfLuck={true}
                    onStrokeOfLuck={onStroke}
                />
            );
            fireEvent.click(screen.getByText(/Stroke of Luck/));
            expect(onStroke).toHaveBeenCalled();
        });
    });

    describe('tactical mind', () => {
        it('shows tactical mind button when conditions met', () => {
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
            expect(screen.getByText(/Tactical Mind/)).toBeInTheDocument();
        });

        it('shows tactical mind bonus when provided', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="check"
                    tacticalMind={true}
                    tacticalMindBonus={2}
                />
            );
            expect(screen.getByText(/Tactical Mind \(\+2\)/)).toBeInTheDocument();
        });

        it('does not show tactical mind button when rollType is attack', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="attack"
                    tacticalMind={true}
                />
            );
            expect(screen.queryByText(/Tactical Mind/)).not.toBeInTheDocument();
        });

        it('does not show tactical mind button when rollType is save', () => {
            render(
                <DiceRollResult
                    name="DEX Save"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="save"
                    tacticalMind={true}
                />
            );
            expect(screen.queryByText(/Tactical Mind/)).not.toBeInTheDocument();
        });

        it('hides tactical mind button after it has been used', () => {
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
            const tacticalContainer = container.querySelector('.dice-roll-reroll');
            expect(tacticalContainer).not.toBeInTheDocument();
        });

        it('shows tactical mind result after clicking', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="check"
                    tacticalMind={true}
                    tacticalMindBonus={2}
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

        it('shows hit with max reaction bonus when both glorious defense and defensive duelist are present', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    targetName="Goblin"
                    hit={true}
                    rollType="attack"
                    gloriousDefenseBonus={2}
                    defensiveDuelistBonus={1}
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
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

    describe('stroke of luck display roll', () => {
        it('shows 20 (Stroke of Luck) in breakdown after stroke is used', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    strokeOfLuck={true}
                />
            );
            fireEvent.click(screen.getByText(/Stroke of Luck/));
            expect(screen.getByText(/20 \(Stroke of Luck\)/)).toBeInTheDocument();
        });

        it('shows reroll in breakdown after reroll is used', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    autoReroll={true}
                />
            );
            fireEvent.click(screen.getByText(/Reroll/));
            expect(screen.getByText(/\(reroll\)/)).toBeInTheDocument();
        });
    });

    describe('stroke of luck shows critical hit', () => {
        it('shows critical hit after stroke of luck is used', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    strokeOfLuck={true}
                />
            );
            expect(screen.queryByText(/Critical Hit!/)).not.toBeInTheDocument();
            fireEvent.click(screen.getByText(/Stroke of Luck/));
            expect(screen.getByText(/Critical Hit!/)).toBeInTheDocument();
        });
    });

    describe('superiority maneuvers', () => {
        it('shows superiority maneuver buttons when availableSuperiorityManeuvers is provided', () => {
            const maneuvers = [{ name: 'Precision Attack' }, { name: 'Trip Attack' }];
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
            expect(screen.getByText(/Precision Attack/)).toBeInTheDocument();
            expect(screen.getByText(/Trip Attack/)).toBeInTheDocument();
        });

        it('shows superiority maneuver buttons for non-d20 types too', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    availableSuperiorityManeuvers={[{ name: 'Trip Attack' }]}
                />
            );
            expect(screen.getByText(/Trip Attack/)).toBeInTheDocument();
        });

        it('hides superiority maneuver buttons after one is used', () => {
            const onSuperiority = vi.fn();
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    rollType="attack"
                    availableSuperiorityManeuvers={[{ name: 'Precision Attack' }]}
                    onSuperiorityManeuver={onSuperiority}
                />
            );
            fireEvent.click(screen.getByText(/Precision Attack/));
            // After use, the button container is hidden and result is shown
            expect(container.querySelector('.dice-roll-reroll')).not.toBeInTheDocument();
            expect(screen.getByText(/Precision Attack:/)).toBeInTheDocument();
        });

        it('shows superiority result after clicking', () => {
            const onSuperiority = vi.fn();
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    rollType="attack"
                    availableSuperiorityManeuvers={[{ name: 'Precision Attack' }]}
                    onSuperiorityManeuver={onSuperiority}
                />
            );
            fireEvent.click(screen.getByText(/Precision Attack/));
            expect(screen.getByText(/Precision Attack:/)).toBeInTheDocument();
        });

        it('calls onSuperiorityManeuver when a maneuver is selected with maneuver name and die value', () => {
            const onSuperiority = vi.fn();
            vi.spyOn(Math, 'random').mockReturnValue(0);
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    rollType="attack"
                    availableSuperiorityManeuvers={[{ name: 'Trip Attack' }]}
                    onSuperiorityManeuver={onSuperiority}
                />
            );
            fireEvent.click(screen.getByText(/Trip Attack/));
            expect(onSuperiority).toHaveBeenCalledWith('Trip Attack', 1);
            vi.restoreAllMocks();
        });

        it('does not call onSuperiorityManeuver and does nothing visible when it is not provided', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    rollType="attack"
                    availableSuperiorityManeuvers={[{ name: 'Trip Attack' }]}
                />
            );
            fireEvent.click(screen.getByText(/Trip Attack/));
            // Without onSuperiorityManeuver, handleSuperiorityManeuver returns early
            // The button stays and nothing changes
            expect(screen.getByText(/Trip Attack/)).toBeInTheDocument();
            expect(screen.queryByText(/Trip Attack:/)).not.toBeInTheDocument();
        });

        it('does not show superiority buttons when array is empty', () => {
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
            expect(screen.queryByText(/Superiority Die/)).not.toBeInTheDocument();
        });

        it('does not show superiority buttons when array is null', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    rollType="attack"
                    availableSuperiorityManeuvers={null}
                />
            );
            expect(screen.queryByText(/Superiority Die/)).not.toBeInTheDocument();
        });
    });
});
