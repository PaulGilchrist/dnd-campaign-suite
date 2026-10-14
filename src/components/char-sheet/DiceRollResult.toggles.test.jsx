import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('advantage/disadvantage toggles', () => {
        it('toggles advantage mode on when clicking the advantage checkbox, updating the total', () => {
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[8, 15]}
                    bonus={3}
                />
            );
            const advCheckbox = screen.getByLabelText(/Advantage/);
            expect(advCheckbox.checked).toBe(false);

            fireEvent.click(advCheckbox);
            expect(advCheckbox.checked).toBe(true);
            // advantage mode: max(8, 15) = 15, total = 15 + 3 = 18
            expect(container.querySelector('.dice-roll-total').textContent).toBe('18');
        });

        it('toggles disadvantage mode on when clicking the disadvantage checkbox, updating the total', () => {
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[8, 15]}
                    bonus={3}
                />
            );
            const disCheckbox = screen.getByLabelText(/Disadvantage/);
            expect(disCheckbox.checked).toBe(false);

            fireEvent.click(disCheckbox);
            expect(disCheckbox.checked).toBe(true);
            // disadvantage mode: min(8, 15) = 8, total = 8 + 3 = 11
            expect(container.querySelector('.dice-roll-total').textContent).toBe('11');
        });

        it('does not show advantage/disadvantage checkboxes for non-d20 types', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                />
            );
            expect(screen.queryByRole('checkbox', { name: /Advantage/ })).not.toBeInTheDocument();
            expect(screen.queryByRole('checkbox', { name: /Disadvantage/ })).not.toBeInTheDocument();
        });

        it('marks the advantage toggle as active when forcedMode is advantage', () => {
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[8, 15]}
                    bonus={3}
                    forcedMode="advantage"
                />
            );
            const advCheckbox = container.querySelector('input[type="checkbox"]');
            expect(advCheckbox.checked).toBe(true);
            const advLabel = container.querySelector('.badge-toggle.active');
            expect(advLabel).toHaveTextContent('Advantage');
        });

        it('marks the disadvantage toggle as active when forcedMode is disadvantage', () => {
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[8, 15]}
                    bonus={3}
                    forcedMode="disadvantage"
                />
            );
            const labels = container.querySelectorAll('label.badge-toggle');
            const activeLabel = Array.from(labels).find(l => l.classList.contains('active'));
            expect(activeLabel).toHaveTextContent('Disadvantage');
        });
    });

    describe('psi-bolstered knack still failed path', () => {
        it('calls onPsiBolsteredKnack with success: false when still failed button is clicked', async () => {
            const onPsiBolsteredKnack = vi.fn();
            render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="skill"
                    psiBolsteredKnack={true}
                    psiBolsteredKnackDieSize={6}
                    onPsiBolsteredKnack={onPsiBolsteredKnack}
                />
            );
            fireEvent.click(screen.getByText(/Psi-Bolstered Knack/));
            fireEvent.click(screen.getByText(/Still Failed/));
            expect(onPsiBolsteredKnack).toHaveBeenCalledWith(
                expect.objectContaining({
                    dieSize: 6,
                    success: false,
                })
            );
        });

        it('shows consumed state with reroll result div after clicking still failed', () => {
            const { container } = render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="skill"
                    psiBolsteredKnack={true}
                    psiBolsteredKnackDieSize={6}
                />
            );
            fireEvent.click(screen.getByText(/Psi-Bolstered Knack/));
            fireEvent.click(screen.getByText(/Still Failed/));
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
        });
    });

    describe('psi-bolstered knack offer gates (CLA-270)', () => {
        it('offers the Knack labeled as a failed-check boost', () => {
            render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="skill"
                    psiBolsteredKnack={true}
                    psiBolsteredKnackDieSize={10}
                />
            );
            const btn = screen.getByRole('button', { name: /Psi-Bolstered Knack/ });
            expect(btn.textContent).toContain('failed proficient check');
        });

        it('does NOT offer the Knack when the popup records an explicit success', () => {
            render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[15]}
                    bonus={3}
                    rollType="skill"
                    success={true}
                    psiBolsteredKnack={true}
                    psiBolsteredKnackDieSize={10}
                />
            );
            expect(screen.queryByRole('button', { name: /Psi-Bolstered Knack/ })).not.toBeInTheDocument();
        });

        it('shows the failed-check declaration note after clicking the Knack', () => {
            render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="skill"
                    psiBolsteredKnack={true}
                    psiBolsteredKnackDieSize={10}
                />
            );
            fireEvent.click(screen.getByRole('button', { name: /Psi-Bolstered Knack/ }));
            expect(screen.getByText(/expended only if the boosted total succeeds/)).toBeInTheDocument();
        });
    });

    describe('error paths', () => {
        it('logs console.error when onBardicInspirationDefense is falsy after clicking the defense button', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    targetName="Goblin"
                    targetAc={14}
                    hit={true}
                    bardicInspirationDefense={true}
                    bardicInspirationDefenseDieSize={6}
                />
            );
            fireEvent.click(screen.getByText(/Bardic Inspiration - Defense/));
            expect(consoleSpy).toHaveBeenCalledWith('[BI Defense] onBardicInspirationDefense is falsy!');
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
            consoleSpy.mockRestore();
        });

        it('logs console.error when superiority maneuver callback throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            const onSuperiorityManeuver = vi.fn().mockRejectedValue(new Error('test error'));
            const { container } = render(
                <DiceRollResult
                    name="Sword"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    availableSuperiorityManeuvers={[{ name: 'Pushing Attack' }]}
                    playerStats={{ level: 3 }}
                    onSuperiorityManeuver={onSuperiorityManeuver}
                />
            );
            fireEvent.click(screen.getByText(/Pushing Attack/));
            await new Promise(r => setTimeout(r, 0));
            expect(consoleSpy).toHaveBeenCalledWith('[DiceRollResult] Superiority maneuver failed:', expect.any(Error));
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
            consoleSpy.mockRestore();
        });
    });
});
