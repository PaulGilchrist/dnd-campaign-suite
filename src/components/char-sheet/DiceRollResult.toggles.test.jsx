// @maintained-by-ai
// DiceRollResult — advantage/disadvantage toggle lane + psi-knack + console.error paths.
//
// Seam ownership map (consolidated per the DiceRollResult.rendering.test.jsx and
// DiceRollResult.interactive.test.jsx headers):
//   - THIS file owns the adv/dis checkbox toggles (RollModeToggles): d20-only
//     mount, click on/off, mutual-exclusivity switching, total recomputation
//     (max/min of the two d20 rolls via computeFinalRoll), forcedMode initial
//     marking with click-to-override, and the non-d20 suppression deferred here
//     by the rendering lane (~line 13).
//   - saveResult adv/dis suffix display: claimed here (was untested app-wide)
//     because the suffix is driven by the same `mode` state the toggles own.
//     The save-result base line / DC-vs-total semantics stay in
//     DiceRollResult.combatDisplay.test.jsx — only the mode suffix is asserted here.
//   - Psi-Bolstered Knack panel offer / adjudication clicks: owned here per the
//     DiceRollResult.interactive.test.jsx header ("Psi-Bolstered Knack panel/offer").
//   - console.error paths: missing onBardicInspirationDefense callback and
//     onSuperiorityManeuver callback rejection (result row already rendered) —
//     the pre-roll evaluateAutoExpression-throw half lives in
//     DiceRollResult.superiorityDie.test.jsx, together with die-size selection.
//   - forced-mode badge text/title: DiceRollResult.rendering.test.jsx.
//   - click-dispatch of prop callbacks generally: DiceRollResult.interactive.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';
import * as automationExpressions from '../../services/combat/automation/automationExpressions.js';

// Deterministic dice: 0.5 → d20=11, d10=6, d8=5, d6=4. Spies restored in afterEach.
const RANDOM = 0.5;
let randomSpy;
let consoleSpy;
beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(RANDOM);
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    randomSpy.mockRestore();
    consoleSpy.mockRestore();
});

const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const totalText = (container) => container.querySelector('.dice-roll-total').textContent;
// Mode state values are lowercase; the visible checkbox labels are capitalized.
const getModeCheckbox = (mode) => screen.getByLabelText(new RegExp(`^${mode}$`, 'i'));

describe('DiceRollResult — adv/dis toggles', () => {
    it.each([
        // mode, rolls (ordered so the mode-selected die differs from the
        // normal-mode first die), baseline total, mode total
        ['advantage', [8, 15], '11', '18'],
        ['disadvantage', [15, 8], '18', '11'],
    ])('%s checkbox clicks toggle the mode on then off, recomputing the total %s → %s → %s', (mode, rolls, baseline, modeTotal) => {
        const { container } = render(
            <DiceRollResult name="Attack" type="d20" rolls={rolls} bonus={3} />
        );
        const checkbox = getModeCheckbox(mode);
        expect(checkbox.checked).toBe(false);
        expect(totalText(container)).toBe(baseline);

        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(true);
        expect(totalText(container)).toBe(modeTotal);

        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(false);
        expect(totalText(container)).toBe(baseline);
    });

    it('switching directly from advantage to disadvantage updates both checkboxes and the total', () => {
        const { container } = render(
            <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={3} />
        );
        fireEvent.click(getModeCheckbox('advantage'));
        expect(totalText(container)).toBe('18');

        fireEvent.click(getModeCheckbox('disadvantage'));
        expect(getModeCheckbox('advantage').checked).toBe(false);
        expect(getModeCheckbox('disadvantage').checked).toBe(true);
        expect(totalText(container)).toBe('11');
    });

    it.each([
        ['damage', { name: 'Fireball', type: 'damage', rolls: [6, 5, 4] }],
        ['attack', { name: 'Longsword', type: 'attack', rolls: [18] }],
    ])('renders no adv/dis checkboxes for non-d20 type %s', (_label, props) => {
        render(<DiceRollResult {...props} bonus={0} />);
        expect(screen.queryByRole('checkbox', { name: 'Advantage' })).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: 'Disadvantage' })).not.toBeInTheDocument();
    });

    it.each([
        // forcedMode marks its checkbox active at mount; one click overrides back to normal
        ['advantage', [8, 15], '18', '11'],
        ['disadvantage', [15, 8], '11', '18'],
    ])('forcedMode %s starts the matching checkbox active (%s) and one click overrides to normal (%s)', (forcedMode, rolls, forcedTotal, normalTotal) => {
        const { container } = render(
            <DiceRollResult name="Attack" type="d20" rolls={rolls} bonus={3} forcedMode={forcedMode} />
        );
        const forcedCheckbox = getModeCheckbox(forcedMode);
        const otherCheckbox = getModeCheckbox(forcedMode === 'advantage' ? 'disadvantage' : 'advantage');
        expect(forcedCheckbox.checked).toBe(true);
        expect(otherCheckbox.checked).toBe(false);
        expect(totalText(container)).toBe(forcedTotal);

        fireEvent.click(forcedCheckbox);
        expect(forcedCheckbox.checked).toBe(false);
        expect(totalText(container)).toBe(normalTotal);
    });
});

describe('DiceRollResult — saveResult adv/dis suffix', () => {
    // Base line owned by combatDisplay.test.jsx; only the mode-driven suffix is claimed here.
    const renderSave = (props = {}) => render(
        <DiceRollResult
            name="Constitution"
            type="d20"
            rollType="save"
            rolls={[15]}
            bonus={3}
            saveDc={19}
            saveResult={{ success: false, total: 18, roll: 15, bonus: 3 }}
            {...props}
        />
    );
    const BASE_LINE = '✗ SAVE FAILURE (18 vs DC 19) (d20 15 + 3)';

    it.each([
        ['advantage', ' [Advantage]'],
        ['disadvantage', ' [Disadvantage]'],
        [undefined, ''],
    ])('forcedMode %s renders the full save line without suffix tampering', (forcedMode, suffix) => {
        const { container } = renderSave({ forcedMode });
        expect(normalize(container.querySelector('.dice-roll-save-result').textContent)).toBe(`${BASE_LINE}${suffix}`);
    });

    it('toggling advantage live adds and removes the [Advantage] suffix on the save line', () => {
        const { container } = renderSave();
        expect(normalize(container.querySelector('.dice-roll-save-result').textContent)).toBe(BASE_LINE);

        fireEvent.click(getModeCheckbox('advantage'));
        expect(normalize(container.querySelector('.dice-roll-save-result').textContent)).toBe(`${BASE_LINE} [Advantage]`);

        fireEvent.click(getModeCheckbox('advantage'));
        expect(normalize(container.querySelector('.dice-roll-save-result').textContent)).toBe(BASE_LINE);
    });
});

describe('DiceRollResult — psi-bolstered knack offer gates (CLA-270)', () => {
    it.each([
        // label, extra props, expected exact offer label (or null when hidden)
        ['failed skill check offers d10 knack', { psiBolsteredKnackDieSize: 10 }, 'Psi-Bolstered Knack (d10) — failed proficient check?'],
        ['missing die size falls back to d6', { psiBolsteredKnackDieSize: undefined }, 'Psi-Bolstered Knack (d6) — failed proficient check?'],
        ['explicit success hides the offer', { success: true }, null],
        ['non-check rollType hides the offer', { rollType: 'attack' }, null],
    ])('%s', (_label, extraProps, expectedLabel) => {
        render(
            <DiceRollResult
                name="Insight"
                type="d20"
                rolls={[5]}
                bonus={3}
                rollType="skill"
                psiBolsteredKnack={true}
                {...extraProps}
            />
        );
        const btn = screen.queryByRole('button', { name: /Psi-Bolstered Knack/ });
        if (expectedLabel === null) {
            expect(btn).not.toBeInTheDocument();
        } else {
            expect(normalize(btn.textContent)).toBe(expectedLabel);
        }
    });

    it.each([
        ['Succeeded', true],
        ['Still Failed', false],
    ])('%s click dispatches the exact { dieValue, dieSize, success } payload and consumes the offer', async (buttonText, success) => {
        const onPsiBolsteredKnack = vi.fn();
        const { container } = render(
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
        fireEvent.click(screen.getByRole('button', { name: /Psi-Bolstered Knack/ }));

        // d6 rolled with random=0.5 → 4; boosted total = (5 + 3) + 4 = 12
        const row = await screen.findByText(/Psi-Bolstered Knack/);
        expect(normalize(row.textContent).startsWith('Psi-Bolstered Knack: +4 (d6) → 12')).toBe(true);
        expect(screen.getByText(/expended only if the boosted total succeeds/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: buttonText }));

        expect(onPsiBolsteredKnack).toHaveBeenCalledWith({ dieValue: 4, dieSize: 6, success });
        // Consumed: adjudication buttons and declaration note are gone, result row stays
        expect(screen.queryByRole('button', { name: /Succeeded|Still Failed/ })).not.toBeInTheDocument();
        expect(screen.queryByText(/expended only if the boosted total succeeds/)).not.toBeInTheDocument();
        expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
    });
});

describe('DiceRollResult — callback error paths', () => {
    it('logs the exact-console error and still renders the result row when the BI Defense callback is missing', () => {
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
        fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/ }));
        expect(consoleSpy).toHaveBeenCalledWith('[BI Defense] onBardicInspirationDefense is falsy!');
        // d6 with random=0.5 → 4; newAc 14+4=18; attack total 23 still hits
        expect(normalize(container.querySelector('.dice-roll-reroll-result').textContent))
            .toBe('Bardic Inspiration - Defense: 1d6 → 4 → AC 18 (Attack still hits)');
    });

    describe('superiority maneuver callback rejects (deferred by superiorityDie.test.jsx)', () => {
        let evaluateSpy;
        beforeEach(() => {
            // Die-size selection is owned by superiorityDie.test.jsx — pinned here
            // only for determinism of the reject-path row.
            evaluateSpy = vi.spyOn(automationExpressions, 'evaluateAutoExpression').mockReturnValue(8);
        });
        afterEach(() => {
            evaluateSpy.mockRestore();
        });

        it('logs console.error with the exact rejection and keeps the already-rendered result row', async () => {
            const error = new Error('test error');
            const onSuperiorityManeuver = vi.fn().mockRejectedValue(error);
            render(
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
            fireEvent.click(screen.getByRole('button', { name: /Pushing Attack/ }));

            // Result row is set before the awaited callback, so it survives the rejection
            const row = await screen.findByText(/Pushing Attack/);
            expect(normalize(row.textContent)).toBe('Pushing Attack: d8 5 → 23 (+5)');
            await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('[DiceRollResult] Superiority maneuver failed:', error));
            expect(onSuperiorityManeuver).toHaveBeenCalledWith('Pushing Attack', 5);

            expect(screen.queryByRole('button', { name: /Pushing Attack/ })).not.toBeInTheDocument();
        });
    });
});
