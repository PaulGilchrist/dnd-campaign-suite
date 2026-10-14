import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('boon of combat prowess', () => {
        it('shows boon button when autoRerollForAttack is true, not hit, and isD20', () => {
            const onStrokeOfLuck = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="d20"
                    rolls={[8]}
                    bonus={3}
                    rollType="attack"
                    hit={false}
                    autoRerollForAttack={true}
                    onStrokeOfLuck={onStrokeOfLuck}
                />
            );
            expect(screen.getByText(/Boon of Combat Prowess/)).toBeInTheDocument();
        });

        it('does not show boon button when hit is true', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="d20"
                    rolls={[18]}
                    bonus={3}
                    rollType="attack"
                    hit={true}
                    autoRerollForAttack={true}
                />
            );
            expect(screen.queryByText(/Boon of Combat Prowess/)).not.toBeInTheDocument();
        });

        it('does not show boon button when isAutoMiss is true', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="d20"
                    rolls={[8]}
                    bonus={3}
                    rollType="attack"
                    hit={false}
                    isAutoMiss={true}
                    autoRerollForAttack={true}
                />
            );
            expect(screen.queryByText(/Boon of Combat Prowess/)).not.toBeInTheDocument();
        });

        it('shows boon result after clicking, calling onStrokeOfLuck callback and displaying result text', () => {
            const onStrokeOfLuck = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="d20"
                    rolls={[8]}
                    bonus={3}
                    rollType="attack"
                    hit={false}
                    autoRerollForAttack={true}
                    onStrokeOfLuck={onStrokeOfLuck}
                />
            );
            fireEvent.click(screen.getByText(/Boon of Combat Prowess/));
            expect(onStrokeOfLuck).toHaveBeenCalled();
            expect(screen.getByText(/Miss converted to Hit/)).toBeInTheDocument();
        });
    });

    describe('empowered spell result display', () => {
        it('shows empowered spell button for damage types', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    empoweredSpell={true}
                />
            );
            expect(screen.getByText(/Empowered Spell/)).toBeInTheDocument();
        });

        it('shows empowered spell result after clicking with dice diff info', () => {
            const mockResult = {
                rerollCount: 2,
                originalDice: [3, 2],
                newDice: [6, 5],
                newTotal: 11,
                damageDifference: 1,
            };
            const onEmpoweredSpell = vi.fn().mockResolvedValue(mockResult);
            const { container } = render(
                <DiceRollResult
                    name="Fire Bolt"
                    type="damage"
                    rolls={[3, 2]}
                    bonus={0}
                    total={5}
                    formula="2d6"
                    empoweredSpell={true}
                    onEmpoweredSpell={onEmpoweredSpell}
                />
            );
            fireEvent.click(screen.getByText(/Empowered Spell/));
            return vi.waitFor(() => {
                expect(onEmpoweredSpell).toHaveBeenCalled();
                const resultEl = container.querySelector('.dice-roll-reroll-result');
                expect(resultEl).toBeInTheDocument();
                expect(resultEl.textContent).toContain('Empowered Spell');
                expect(resultEl.textContent).toContain('2 dice');
                expect(resultEl.textContent).toContain('3, 2 → 6, 5');
                expect(resultEl.textContent).toContain('+1');
            });
        });

        it('shows empowered spell result with negative damage difference', () => {
            const mockResult = {
                rerollCount: 1,
                originalDice: [5],
                newDice: [2],
                newTotal: 2,
                damageDifference: -3,
            };
            const onEmpoweredSpell = vi.fn().mockResolvedValue(mockResult);
            const { container } = render(
                <DiceRollResult
                    name="Fire Bolt"
                    type="damage"
                    rolls={[5]}
                    bonus={0}
                    total={5}
                    formula="1d6"
                    empoweredSpell={true}
                    onEmpoweredSpell={onEmpoweredSpell}
                />
            );
            fireEvent.click(screen.getByText(/Empowered Spell/));
            return vi.waitFor(() => {
                expect(onEmpoweredSpell).toHaveBeenCalled();
                const resultEl = container.querySelector('.dice-roll-reroll-result');
                expect(resultEl.textContent).toContain('-3');
            });
        });

        it('shows empowered spell result with zero damage difference and message', () => {
            const mockResult = {
                rerollCount: 1,
                originalDice: [4],
                newDice: [4],
                newTotal: 4,
                damageDifference: 0,
                message: 'No change in damage',
            };
            const onEmpoweredSpell = vi.fn().mockResolvedValue(mockResult);
            const { container } = render(
                <DiceRollResult
                    name="Fire Bolt"
                    type="damage"
                    rolls={[4]}
                    bonus={0}
                    total={4}
                    formula="1d6"
                    empoweredSpell={true}
                    onEmpoweredSpell={onEmpoweredSpell}
                />
            );
            fireEvent.click(screen.getByText(/Empowered Spell/));
            return vi.waitFor(() => {
                expect(onEmpoweredSpell).toHaveBeenCalled();
                const resultEl = container.querySelector('.dice-roll-reroll-result');
                expect(resultEl.textContent).toContain('No change in damage');
            });
        });

        it('does not show empowered spell result when callback returns no result', () => {
            const onEmpoweredSpell = vi.fn().mockResolvedValue(null);
            const { container } = render(
                <DiceRollResult
                    name="Fire Bolt"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    total={6}
                    formula="1d6"
                    empoweredSpell={true}
                    onEmpoweredSpell={onEmpoweredSpell}
                />
            );
            fireEvent.click(screen.getByText(/Empowered Spell/));
            return vi.waitFor(() => {
                expect(onEmpoweredSpell).toHaveBeenCalled();
                const resultEl = container.querySelector('.dice-roll-reroll-result');
                expect(resultEl).not.toBeInTheDocument();
            });
        });
    });

    describe('piercer puncture result display', () => {
        it('shows piercer puncture button for damage types', () => {
            render(
                <DiceRollResult
                    name="Hand Crossbow"
                    type="damage"
                    rolls={[3, 2]}
                    bonus={0}
                    piercerPuncture={true}
                />
            );
            expect(screen.getByText(/Piercer - Puncture/)).toBeInTheDocument();
        });

        it('shows puncture result after clicking with dice info and calls onPuncture callback', () => {
            const mockPuncture = vi.fn().mockResolvedValue(undefined);
            const { container } = render(
                <DiceRollResult
                    name="Hand Crossbow"
                    type="damage"
                    rolls={[3, 5]}
                    bonus={0}
                    total={8}
                    formula="1d6"
                    piercerPuncture={true}
                    onPuncture={mockPuncture}
                />
            );
            fireEvent.click(screen.getByText(/Piercer - Puncture/));
            expect(mockPuncture).toHaveBeenCalled();
            const resultEl = container.querySelector('.dice-roll-reroll-result');
            expect(resultEl.textContent).toContain('Piercer - Puncture');
            expect(resultEl.textContent).toContain('3, 5');
        });
    });

    describe('savage attacker result display', () => {
        it('shows savage attacker button for damage types', () => {
            render(
                <DiceRollResult
                    name="Greatsword"
                    type="damage"
                    rolls={[5, 3]}
                    bonus={0}
                    formula="2d6"
                    savageAttacker={true}
                />
            );
            expect(screen.getByText(/Savage Attacker/)).toBeInTheDocument();
        });

        it('shows savage attacker result display after clicking and calls onSavageAttacker callback', () => {
            const mockSavage = vi.fn().mockResolvedValue(undefined);
            const { container } = render(
                <DiceRollResult
                    name="Greatsword"
                    type="damage"
                    rolls={[2, 3]}
                    bonus={0}
                    formula="2d6"
                    savageAttacker={true}
                    onSavageAttacker={mockSavage}
                />
            );
            fireEvent.click(screen.getByText(/Savage Attacker/));
            expect(mockSavage).toHaveBeenCalled();
            const resultEl = container.querySelector('.dice-roll-reroll-result');
            expect(resultEl.textContent).toContain('Savage Attacker');
            expect(resultEl.textContent).toContain('2, 3');
        });
    });
});
