// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('basic rendering', () => {
        it('renders name and total for a basic d20 roll', () => {
            render(
                <DiceRollResult
                    name="Attack Roll"
                    type="d20"
                    rolls={[12, 8]}
                    bonus={3}
                    modifier={0}
                />
            );

            expect(screen.getByText('Attack Roll')).toBeInTheDocument();
            expect(screen.getByText('15')).toBeInTheDocument();
        });

        it('renders correct icon class for attack type', () => {
            const { container } = render(
                <DiceRollResult name="Sword" type="attack" rolls={[15]} bonus={2} />
            );
            expect(container.querySelector('.fa-crosshairs')).toBeInTheDocument();
        });

        it('renders correct icon class for save type', () => {
            const { container } = render(
                <DiceRollResult name="DEX Save" type="save" rolls={[14]} bonus={1} />
            );
            expect(container.querySelector('.fa-shield-halved')).toBeInTheDocument();
        });

        it('renders correct icon class for initiative type', () => {
            const { container } = render(
                <DiceRollResult name="Initiative" type="initiative" rolls={[18]} bonus={2} />
            );
            expect(container.querySelector('.fa-gavel')).toBeInTheDocument();
        });

        it('renders correct icon class for damage type', () => {
            const { container } = render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 6, 6]} bonus={0} />
            );
            expect(container.querySelector('.fa-bolt')).toBeInTheDocument();
        });

        it('renders correct icon class for save-damage type', () => {
            const { container } = render(
                <DiceRollResult name="Poison Cloud" type="save-damage" rolls={[5]} bonus={0} />
            );
            expect(container.querySelector('.fa-shield-halved')).toBeInTheDocument();
        });

        it('renders default icon class for unknown type', () => {
            const { container } = render(
                <DiceRollResult name="Weird" type="custom" rolls={[5]} bonus={0} />
            );
            expect(container.querySelector('.fa-bolt')).toBeInTheDocument();
        });
    });

    describe('totals', () => {
        it('shows correct total with bonus', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={5} modifier={0} />
            );
            expect(screen.getByText('15')).toBeInTheDocument();
        });

        it('shows correct total with modifier', () => {
            render(
                <DiceRollResult name="Test" type="damage" rolls={[6, 4]} bonus={0} modifier={3} />
            );
            expect(screen.getByText('13')).toBeInTheDocument();
        });

        it('shows correct total with both bonus and modifier', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[12]} bonus={2} modifier={3} />
            );
            expect(screen.getByText('17')).toBeInTheDocument();
        });

        it('shows correct total with negative modifier', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={0} modifier={-3} />
            );
            expect(screen.getByText('7')).toBeInTheDocument();
        });

        it('shows correct total with negative bonus', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={-2} modifier={0} />
            );
            expect(screen.getByText('8')).toBeInTheDocument();
        });

        it('handles null rolls gracefully', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="d20" rolls={null} bonus={0} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('0');
        });

        it('handles undefined rolls gracefully', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="d20" rolls={undefined} bonus={5} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('5');
        });

        it('handles empty rolls array for d20', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="d20" rolls={[]} bonus={3} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('3');
        });

        it('handles empty rolls array for non-d20', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="damage" rolls={[]} bonus={5} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('5');
        });
    });

    describe('advantage and disadvantage', () => {
        it('uses first roll in normal mode', () => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('10');
        });

        it('uses max of two rolls when advantage is toggled', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            fireEvent.click(screen.getByLabelText(/Advantage/));
            expect(screen.getByText('17')).toBeInTheDocument();
        });

        it('uses min of two rolls when disadvantage is toggled', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            fireEvent.click(screen.getByLabelText(/Disadvantage/));
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('toggles advantage off when clicked again', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            const advButton = screen.getByLabelText(/Advantage/);
            fireEvent.click(advButton);
            expect(screen.getByText('17')).toBeInTheDocument();

            fireEvent.click(advButton);
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('switches from advantage to disadvantage', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            fireEvent.click(screen.getByLabelText(/Advantage/));
            expect(screen.getByText('17')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText(/Disadvantage/));
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('uses first roll when both rolls are provided in normal mode', () => {
            const { container } = render(
                <DiceRollResult name="Check" type="d20" rolls={[3, 17]} bonus={0} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('3');
        });

        it('shows advantage badge as active when forcedMode is advantage', () => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} forcedMode="advantage" />
            );
            expect(container.querySelector('.badge-toggle.active')).toBeInTheDocument();
        });

        it('shows disadvantage badge as active when forcedMode is disadvantage', () => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} forcedMode="disadvantage" />
            );
            expect(container.querySelector('.badge-toggle.active')).toBeInTheDocument();
        });

        it('shows forced mode badge with reason text', () => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} forcedMode="advantage" rangeReason="Ranged disadvantage" />
            );
            expect(container.querySelector('.forced-mode-badge')).toBeInTheDocument();
            expect(container.querySelector('.forced-mode-badge').textContent).toContain('Ranged disadvantage');
        });

        it('shows forced mode badge with default message when no reason', () => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} forcedMode="advantage" />
            );
            const badge = container.querySelector('.forced-mode-badge');
            expect(badge).toBeInTheDocument();
            expect(badge.getAttribute('title')).toBe('Automatically set by active conditions');
        });
    });

    describe('non-d20 types', () => {
        it('does NOT show advantage/disadvantage toggles for non-d20 types', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4, 3, 2, 1]} bonus={0} />
            );
            expect(screen.queryByLabelText(/Advantage/)).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/Disadvantage/)).not.toBeInTheDocument();
        });

        it('shows sum of all rolls for non-d20 type', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} />
            );
            expect(screen.getByText('15')).toBeInTheDocument();
        });

        it('shows rolls separated by commas in breakdown for non-d20 type', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} />
            );
            expect(screen.getByText(/6, 5, 4/)).toBeInTheDocument();
        });
    });

    describe('critical hit', () => {
        it('shows "Critical Hit!" when display roll is 20', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[20, 5]} bonus={3} />
            );
            expect(screen.getByText(/Critical Hit!/)).toBeInTheDocument();
        });

        it('shows "AUTO-CRIT" text when isAutoCrit is true', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[5, 3]} bonus={3} isAutoCrit={true} />
            );
            expect(screen.getByText(/AUTO-CRIT/)).toBeInTheDocument();
        });

        it('shows "target condition" text when isAutoCrit is true', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[5, 3]} bonus={3} isAutoCrit={true} />
            );
            expect(screen.getByText(/target condition/)).toBeInTheDocument();
        });

        it('does NOT show "Critical Hit!" when roll is not 20', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[19, 5]} bonus={3} />
            );
            expect(screen.queryByText(/Critical Hit!/)).not.toBeInTheDocument();
        });

        it('does NOT show "Critical Hit!" for non-d20 types', () => {
            render(
                <DiceRollResult name="Damage" type="damage" rolls={[20]} bonus={0} />
            );
            expect(screen.queryByText(/Critical Hit!/)).not.toBeInTheDocument();
        });

        it('does NOT show critical hit text for save or initiative types', () => {
            render(
                <DiceRollResult name="DEX Save" type="save" rolls={[20]} bonus={2} />
            );
            expect(screen.queryByText(/Critical Hit!/)).not.toBeInTheDocument();
        });
    });

    describe('critical miss', () => {
        it('shows "Critical Miss!" when isNatural1 is true and rollType is attack', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[1, 15]} bonus={3} rollType="attack" isNatural1={true} />
            );
            expect(screen.getByText('Critical Miss!')).toBeInTheDocument();
        });

        it('does NOT show "Critical Miss!" when isNatural1 is false', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[15, 8]} bonus={3} rollType="attack" isNatural1={false} />
            );
            expect(screen.queryByText('Critical Miss!')).not.toBeInTheDocument();
        });

        it.each`
            rollType       | name
            ${'initiative'}| ${'Initiative'}
            ${'check'}     | ${'Athletics'}
            ${'skill'}     | ${'Stealth'}
            ${'save'}      | ${'DEX Save'}
        `('does NOT show "Critical Miss!" for rollType: $name', ({ rollType }) => {
            render(
                <DiceRollResult name={rollType} type="d20" rolls={[1, 10]} bonus={2} rollType={rollType} isNatural1={true} />
            );
            expect(screen.queryByText('Critical Miss!')).not.toBeInTheDocument();
        });
    });

    describe('breakdown display', () => {
        it('shows formula in breakdown when provided', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} formula="8d6" />
            );
            expect(screen.getByText(/8d6/)).toBeInTheDocument();
        });

        it('shows d20 label in breakdown for d20 type without formula', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={0} />
            );
            expect(screen.getByText(/d20/)).toBeInTheDocument();
        });

        it('shows formula with colon when formula is provided for d20 type', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={0} formula="d20" />
            );
            const breakdown = screen.getByText(/d20/);
            expect(breakdown.textContent).toMatch(/^d20:/);
        });

        it('shows click to dismiss hint', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={0} />
            );
            expect(screen.getByText('click to dismiss')).toBeInTheDocument();
        });

        it('shows bonus in breakdown when positive', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={3} />
            );
            const breakdown = container.querySelector('.dice-roll-breakdown');
            expect(breakdown.textContent).toContain('+3');
        });

        it('shows bonus with detail when bonusDetail is provided', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={3} bonusDetail="proficient" />
            );
            const breakdown = container.querySelector('.dice-roll-breakdown');
            expect(breakdown.textContent).toContain('+3 proficient');
        });

        it('shows negative bonus in breakdown when negative', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={-2} />
            );
            const breakdown = container.querySelector('.dice-roll-breakdown');
            expect(breakdown.textContent).toContain('-2');
        });

        it('shows advantage/disadvantage arrow notation in breakdown', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            fireEvent.click(screen.getByLabelText(/Advantage/));
            expect(screen.getByText(/8, 15 → 15/)).toBeInTheDocument();
        });
    });

    describe('save info display', () => {
        it('shows save info when dc and dcType are provided without success', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    dc={16}
                    dcType="DEX"
                    dcSuccess="half"
                />
            );
            expect(screen.getByText(/Save DC 16 DEX/)).toBeInTheDocument();
            expect(screen.getByText(/half damage on save/)).toBeInTheDocument();
        });

        it('shows no damage on save for dcSuccess "none"', () => {
            render(
                <DiceRollResult
                    name="Sacred Flame"
                    type="damage"
                    rolls={[4]}
                    bonus={0}
                    dc={14}
                    dcType="DEX"
                    dcSuccess="none"
                />
            );
            expect(screen.getByText(/no damage on save/)).toBeInTheDocument();
        });

        it('does not show save info when dc is undefined', () => {
            render(
                <DiceRollResult
                    name="Fire Bolt"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                />
            );
            expect(screen.queryByText(/Save DC/)).not.toBeInTheDocument();
        });

        it('does not show save info when success is provided (resolved save)', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    dc={16}
                    success={true}
                />
            );
            expect(screen.queryByText(/Save DC/)).not.toBeInTheDocument();
        });

        it('does not show save info when waitingForPlayerSave is true', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    dc={16}
                    dcType="DEX"
                    waitingForPlayerSave={true}
                    saveDc={16}
                    saveType="DEX"
                />
            );
            expect(screen.queryByText(/Save DC/)).not.toBeInTheDocument();
        });

        it('does not show save info for save-damage type', () => {
            render(
                <DiceRollResult
                    name="Poison Cloud"
                    type="save-damage"
                    rolls={[6]}
                    bonus={0}
                    dc={16}
                    dcType="CON"
                    dcSuccess="half"
                />
            );
            expect(screen.queryByText(/Save DC/)).not.toBeInTheDocument();
        });
    });

    describe('hit/miss display', () => {
        it('shows hit when hit is true with target info', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    targetName="Goblin"
                    targetAc={14}
                    hit={true}
                    rollType="attack"
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
            expect(hitMiss.textContent).toContain('HIT');
            expect(hitMiss.textContent).toContain('23 vs AC 14');
        });

        it('shows miss when hit is false with target info', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Orc"
                    targetAc={15}
                    hit={false}
                    rollType="attack"
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.miss');
            expect(hitMiss.textContent).toContain('MISS');
            expect(hitMiss.textContent).toContain('11 vs AC 15');
        });

        it('does not show hit/miss when hit is undefined', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    targetName="Goblin"
                    targetAc={14}
                    rollType="attack"
                />
            );
            expect(screen.queryByText(/HIT/)).not.toBeInTheDocument();
            expect(screen.queryByText(/MISS/)).not.toBeInTheDocument();
        });

        it('does not show hit/miss for non-attack rollType', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    targetName="Goblin"
                    hit={true}
                />
            );
            expect(screen.queryByText(/HIT/)).not.toBeInTheDocument();
        });

        it('does not show hit/miss for save-damage type', () => {
            render(
                <DiceRollResult
                    name="Poison Cloud"
                    type="save-damage"
                    rolls={[6]}
                    bonus={0}
                    targetName="Goblin"
                    hit={true}
                    rollType="attack"
                />
            );
            expect(screen.queryByText(/HIT/)).not.toBeInTheDocument();
        });

        it('shows auto-miss with cover reason', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longbow"
                    type="attack"
                    rolls={[12]}
                    bonus={4}
                    targetName="Goblin"
                    targetAc={14}
                    hit={false}
                    rollType="attack"
                    isAutoMiss={true}
                    coverReason="Half cover"
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.miss');
            expect(hitMiss.textContent).toContain('AUTO-MISS');
            expect(hitMiss.textContent).toContain('Half cover');
        });

        it('shows auto-miss with default out of range when no reason', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longbow"
                    type="attack"
                    rolls={[12]}
                    bonus={4}
                    targetName="Goblin"
                    hit={false}
                    rollType="attack"
                    isAutoMiss={true}
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.miss');
            expect(hitMiss.textContent).toContain('AUTO-MISS');
            expect(hitMiss.textContent).toContain('out of range');
        });
    });

    describe('glorious defense counter-attack', () => {
        it('shows counter-attack button when conditions met', () => {
            const onCounter = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Goblin"
                    hit={false}
                    rollType="attack"
                    gloriousDefenseBonus={2}
                    onCounterAttack={onCounter}
                />
            );
            expect(screen.getByText(/Glorious Defense Counter-Attack/)).toBeInTheDocument();
        });

        it('does not show counter-attack button when hit is true', () => {
            const onCounter = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    targetName="Goblin"
                    hit={true}
                    rollType="attack"
                    gloriousDefenseBonus={2}
                    onCounterAttack={onCounter}
                />
            );
            expect(screen.queryByText(/Glorious Defense/)).not.toBeInTheDocument();
        });

        it('does not show counter-attack button when isAutoMiss is true', () => {
            const onCounter = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Goblin"
                    hit={false}
                    rollType="attack"
                    isAutoMiss={true}
                    gloriousDefenseBonus={2}
                    onCounterAttack={onCounter}
                />
            );
            expect(screen.queryByText(/Glorious Defense/)).not.toBeInTheDocument();
        });

        it('does not show counter-attack button when gloriousDefenseBonus is 0', () => {
            const onCounter = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Goblin"
                    hit={false}
                    rollType="attack"
                    gloriousDefenseBonus={0}
                    onCounterAttack={onCounter}
                />
            );
            expect(screen.queryByText(/Glorious Defense/)).not.toBeInTheDocument();
        });

        it('calls onCounterAttack when counter-attack button is clicked', () => {
            const onCounter = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Goblin"
                    hit={false}
                    rollType="attack"
                    gloriousDefenseBonus={2}
                    onCounterAttack={onCounter}
                />
            );
            fireEvent.click(screen.getByText(/Glorious Defense Counter-Attack/));
            expect(onCounter).toHaveBeenCalled();
        });
    });

    describe('cover display', () => {
        it('shows 3/4 cover when coverLevel is threeQuarter', () => {
            render(
                <DiceRollResult
                    name="Longbow"
                    type="attack"
                    rolls={[12]}
                    bonus={4}
                    coverLevel="threeQuarter"
                    coverAcBonus={2}
                />
            );
            expect(screen.getByText(/3\/4 Cover \(\+2 AC\)/)).toBeInTheDocument();
        });

        it('shows 1/2 cover when coverLevel is half', () => {
            render(
                <DiceRollResult
                    name="Longbow"
                    type="attack"
                    rolls={[12]}
                    bonus={4}
                    coverLevel="half"
                    coverAcBonus={2}
                />
            );
            expect(screen.getByText(/1\/2 Cover \(\+2 AC\)/)).toBeInTheDocument();
        });

        it('does not show cover when coverAcBonus is 0', () => {
            render(
                <DiceRollResult
                    name="Longbow"
                    type="attack"
                    rolls={[12]}
                    bonus={4}
                    coverLevel="threeQuarter"
                    coverAcBonus={0}
                />
            );
            expect(screen.queryByText(/Cover/)).not.toBeInTheDocument();
        });
    });

    describe('auto damage rolling', () => {
        it('shows auto damage indicator when autoDamage and hit are true', () => {
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
            expect(screen.getByText(/Rolling damage/)).toBeInTheDocument();
        });

        it('does not show auto damage when hit is false', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    autoDamage={true}
                    hit={false}
                />
            );
            expect(screen.queryByText(/Rolling damage/)).not.toBeInTheDocument();
        });

        it('does not show auto damage when autoDamage is false', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    autoDamage={false}
                    hit={true}
                />
            );
            expect(screen.queryByText(/Rolling damage/)).not.toBeInTheDocument();
        });
    });

    describe('waiting for player save', () => {
        it('shows waiting message with target name and save type', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    waitingForPlayerSave={true}
                    targetName="Goblin"
                    saveDc={14}
                    saveType="DEX"
                />
            );
            const waiting = container.querySelector('.dice-roll-save-waiting');
            expect(waiting.textContent).toContain('Goblin');
            expect(waiting.textContent).toContain('DEX');
            expect(waiting.textContent).toContain('DC 14');
        });

        it('shows quick roll button when onQuickRoll is provided', () => {
            const onQuickRoll = vi.fn();
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    waitingForPlayerSave={true}
                    targetName="Goblin"
                    saveDc={14}
                    saveType="DEX"
                    onQuickRoll={onQuickRoll}
                />
            );
            expect(screen.getByText(/Quick Roll/)).toBeInTheDocument();
        });

        it('calls onQuickRoll when quick roll button is clicked', () => {
            const onQuickRoll = vi.fn();
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    waitingForPlayerSave={true}
                    targetName="Goblin"
                    saveDc={14}
                    saveType="DEX"
                    onQuickRoll={onQuickRoll}
                />
            );
            fireEvent.click(screen.getByText(/Quick Roll/));
            expect(onQuickRoll).toHaveBeenCalled();
        });

        it('does not show waiting message when waitingForPlayerSave is false', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    waitingForPlayerSave={false}
                    targetName="Goblin"
                    saveDc={14}
                    saveType="DEX"
                />
            );
            expect(screen.queryByText(/Waiting for/)).not.toBeInTheDocument();
        });
    });

    describe('save result display', () => {
        it('shows save success when saveResult.success is true', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={{ success: true, total: 18, roll: 14, bonus: 4 }}
                    saveDc={15}
                />
            );
            expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
            expect(screen.getByText(/18 vs DC 15/)).toBeInTheDocument();
        });

        it('shows save failure when saveResult.success is false', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={{ success: false, total: 12, roll: 8, bonus: 4 }}
                    saveDc={15}
                />
            );
            expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
        });

        it('shows save roll detail when bonus is non-zero', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={{ success: true, total: 18, roll: 14, bonus: 4 }}
                    saveDc={15}
                />
            );
            expect(screen.getByText(/d20 14 \+ 4/)).toBeInTheDocument();
        });

        it('does not show save roll detail when bonus is zero', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={{ success: true, total: 14, roll: 14, bonus: 0 }}
                    saveDc={15}
                />
            );
            expect(screen.queryByText(/d20 14/)).not.toBeInTheDocument();
        });

        it('does not show save result when saveResult is null', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={null}
                    saveDc={15}
                />
            );
            expect(screen.queryByText(/SAVE SUCCESS/)).not.toBeInTheDocument();
            expect(screen.queryByText(/SAVE FAILURE/)).not.toBeInTheDocument();
        });

        it('does not show save result when saveResult is undefined', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveDc={15}
                />
            );
            expect(screen.queryByText(/SAVE SUCCESS/)).not.toBeInTheDocument();
        });
    });

    describe('resistance notice', () => {
        it('shows resistance notice when provided', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    resistanceNotice="Target resistant to fire damage"
                />
            );
            expect(screen.getByText(/Target resistant to fire damage/)).toBeInTheDocument();
        });

        it('does not show resistance notice when not provided', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                />
            );
            expect(screen.queryByText(/resistant/)).not.toBeInTheDocument();
        });
    });

    describe('hunter lore notice', () => {
        it('shows hunter lore notice when provided', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    hunterLoreNotice="Favored Enemy: Beast"
                />
            );
            expect(screen.getByText(/Favored Enemy: Beast/)).toBeInTheDocument();
        });

        it('shows hunter lore notice with multiple lines', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    hunterLoreNotice="Favored Enemy: Beast\nSense Motive: +5"
                />
            );
            expect(screen.getByText(/Favored Enemy: Beast/)).toBeInTheDocument();
            expect(screen.getByText(/Sense Motive: \+5/)).toBeInTheDocument();
        });

        it('does not show hunter lore notice when not provided', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                />
            );
            expect(screen.queryByText(/Favored Enemy/)).not.toBeInTheDocument();
        });
    });

    describe('damage applied display', () => {
        it('shows damage applied without reduction', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    finalDamage={15}
                    damageApplied={true}
                    targetName="Goblin"
                    originalTotal={15}
                />
            );
            const damageEl = container.querySelector('.dice-roll-damage-applied');
            expect(damageEl.textContent).toContain('15');
            expect(damageEl.textContent).toContain('damage applied');
            expect(damageEl.textContent).toContain('Goblin');
        });

        it('shows damage applied with reduction', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    finalDamage={8}
                    damageApplied={true}
                    damageReduced={true}
                    targetName="Orc"
                    originalTotal={15}
                />
            );
            const damageEl = container.querySelector('.dice-roll-damage-applied');
            expect(damageEl.textContent).toContain('8');
            expect(damageEl.textContent).toContain('damage applied');
            expect(damageEl.textContent).toContain('Orc');
            expect(damageEl.textContent).toContain('reduced from 15');
        });

        it('shows HP change when targetCurrentHp is provided', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    finalDamage={10}
                    damageApplied={true}
                    targetName="Goblin"
                    targetCurrentHp={5}
                />
            );
            const damageEl = container.querySelector('.dice-roll-damage-applied');
            expect(damageEl.textContent).toContain('HP: 15 → 5');
        });

        it('does not show damage applied when damageApplied is false', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    finalDamage={15}
                    damageApplied={false}
                    targetName="Goblin"
                />
            );
            expect(screen.queryByText(/damage applied/)).not.toBeInTheDocument();
        });

        it('does not show damage applied when finalDamage is undefined', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    damageApplied={true}
                    targetName="Goblin"
                />
            );
            expect(screen.queryByText(/damage applied/)).not.toBeInTheDocument();
        });
    });

    describe('potent cantrip', () => {
        it('shows potent cantrip notice when isPotentCantrip is true', () => {
            render(
                <DiceRollResult
                    name="Ray of Frost"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    isPotentCantrip={true}
                />
            );
            expect(screen.getByText(/Potent Cantrip/)).toBeInTheDocument();
            expect(screen.getByText(/half damage on miss/)).toBeInTheDocument();
        });

        it('does not show potent cantrip when not provided', () => {
            render(
                <DiceRollResult
                    name="Ray of Frost"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                />
            );
            expect(screen.queryByText(/Potent Cantrip/)).not.toBeInTheDocument();
        });
    });

    describe('reliable talent', () => {
        it('shows reliable talent message when conditions met', () => {
            render(
                <DiceRollResult
                    name="Persuasion"
                    type="d20"
                    rolls={[5]}
                    bonus={4}
                    rollType="check"
                    reliableTalent={true}
                />
            );
            expect(screen.getByText(/Reliable Talent/)).toBeInTheDocument();
            expect(screen.getByText(/d20 5 → 10/)).toBeInTheDocument();
        });

        it('does not show reliable talent when roll is above 9', () => {
            render(
                <DiceRollResult
                    name="Persuasion"
                    type="d20"
                    rolls={[12]}
                    bonus={4}
                    rollType="check"
                    reliableTalent={true}
                />
            );
            expect(screen.queryByText(/Reliable Talent/)).not.toBeInTheDocument();
        });

        it('does not show reliable talent for non-check/skill roll types', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={4}
                    rollType="attack"
                    reliableTalent={true}
                />
            );
            expect(screen.queryByText(/Reliable Talent/)).not.toBeInTheDocument();
        });

        it('does not show reliable talent when reliableTalent is false', () => {
            render(
                <DiceRollResult
                    name="Persuasion"
                    type="d20"
                    rolls={[5]}
                    bonus={4}
                    rollType="check"
                    reliableTalent={false}
                />
            );
            expect(screen.queryByText(/Reliable Talent/)).not.toBeInTheDocument();
        });
    });

    describe('str check/replace', () => {
        it('uses strScore when it exceeds display total for strSaveReplace on save', () => {
            const { container } = render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[3]}
                    bonus={1}
                    rollType="save"
                    strSaveReplace={true}
                    strScore={15}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('15');
        });

        it('uses strScore when it exceeds display total for strCheckReplace on check', () => {
            const { container } = render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[3]}
                    bonus={1}
                    rollType="check"
                    strCheckReplace={true}
                    strScore={15}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('15');
        });

        it('uses display total when strScore is lower', () => {
            const { container } = render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[8]}
                    bonus={4}
                    rollType="check"
                    strCheckReplace={true}
                    strScore={10}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('12');
        });
    });

    describe('wis check replace', () => {
        it('uses wis bonus when wisCheckReplace is true for check', () => {
            const { container } = render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={2}
                    modifier={1}
                    rollType="check"
                    wisCheckReplace={true}
                    wisCheckMinBonus={4}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('10');
        });

        it('does not use wis replace for non-check/skill roll types', () => {
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={2}
                    modifier={1}
                    rollType="attack"
                    wisCheckReplace={true}
                    wisCheckMinBonus={4}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('8');
        });
    });

    describe('reliable talent total calculation', () => {
        it('uses reliable talent total when roll is 9 or below', () => {
            const { container } = render(
                <DiceRollResult
                    name="Stealth"
                    type="d20"
                    rolls={[7]}
                    bonus={3}
                    rollType="skill"
                    reliableTalent={true}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('13');
        });

        it('uses normal total when roll is above 9', () => {
            const { container } = render(
                <DiceRollResult
                    name="Stealth"
                    type="d20"
                    rolls={[12]}
                    bonus={3}
                    rollType="skill"
                    reliableTalent={true}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('15');
        });
    });

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

    describe('target AC display', () => {
        it('shows "—" when targetAc is undefined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    targetName="Goblin"
                    hit={true}
                    rollType="attack"
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
            expect(hitMiss.textContent).toContain('—');
        });

        it('shows numeric AC when provided', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    targetName="Goblin"
                    targetAc={16}
                    hit={true}
                    rollType="attack"
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
            expect(hitMiss.textContent).toContain('AC 16');
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
});
