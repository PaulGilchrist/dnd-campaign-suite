// @maintained-by-ai
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BlindnessDeafnessModal from './BlindnessDeafnessModal.jsx';

// Ownership: this lane covers renderBody/renderActions display-state edges
// (result formatting, roll arithmetic copy, disabled/terminal buttons) and
// custom-prop passthrough. Cancel/overlay close → base lane; apply flows →
// handlers lane; save-result events → saveResult lane.

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin1', type: 'npc', saveBonuses: { con: 2 } },
        { name: 'Orc Warrior', type: 'npc', saveBonuses: { con: 4 } },
        { name: 'Elf Mage', type: 'player', saveBonuses: { con: 1 } },
    ],
};

// Base mock renders the real featureName header and wires onClose, then hands
// the captured renderBody/renderActions to tests via direct invocation.
vi.mock('./shared/AreaEffectTargetModalBase.jsx', () => ({
    default: vi.fn(({ renderBody, renderActions, featureName, icon, onClose, extraState, combatSummary }) => {
        const ctx = {
            selected: new Set(),
            processing: false,
            results: [],
            pendingPrompts: [],
            eligibleTargets: [],
            toggleTarget: vi.fn(),
            handleApply: vi.fn(),
            // Mirror the real base: selection lives in the component's extraState.
            selectedEffect: extraState?.selectedEffect ?? null,
            allResolved: false,
            setProcessing: vi.fn(),
            setResults: vi.fn(),
            setPendingPrompts: vi.fn(),
            combatSummary: combatSummary || baseCombatSummary,
        };

        return (
            <div data-testid="area-effect-modal-base" className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className={icon}></i> {featureName}
                    </div>
                    <div className="sp-body">
                        {renderBody ? renderBody(ctx) : null}
                    </div>
                    <div className="sp-actions" data-testid="sp-actions">
                        {renderActions ? renderActions(ctx) : null}
                    </div>
                </div>
            </div>
        );
    }),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: (name) => name,
        guid: vi.fn(() => 'test-guid-123'),
    },
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/spells/blindnessDeafnessHandler.js', () => ({
    handle: vi.fn(),
    getEffectOptions: vi.fn(() => [
        { key: 'blinded', label: 'Blinded', condition: 'blinded' },
        { key: 'deafened', label: 'Deafened', condition: 'deafened' },
    ]),
}));

import * as diceRoller from '../../../services/dice/diceRoller.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { addCondition } from '../../../services/combat/conditions/conditionSaveService.js';
import { addEntry } from '../../../services/ui/logService.js';
import { sendSavePrompt, sendSaveResult } from '../../../services/combat/conditions/savePromptService.js';
import AreaEffectTargetModalBase from './shared/AreaEffectTargetModalBase.jsx';

const BLENDED = { key: 'blinded', label: 'Blinded', condition: 'blinded' };

// Fresh props (and fresh onClose) per call — never a shared frozen fixture.
function makeProps(overrides = {}) {
    return {
        combatSummary: baseCombatSummary,
        attackerName: 'Witch1',
        attackerPos: { gridX: 10, gridY: 10 },
        saveDc: 14,
        campaignName: 'test-campaign',
        mapData: null,
        onClose: vi.fn(),
        characters: [],
        featureName: 'Blindness/Deafness',
        rangeFeet: 120,
        ...overrides,
    };
}

// Mounts the modal once and returns the render functions the component passed
// to the base, together with the props (for onClose/handleApply spies).
function capture(props = makeProps()) {
    render(<BlindnessDeafnessModal {...props} />);
    const passed = AreaEffectTargetModalBase.mock.calls.at(-1)[0];
    return { props, renderBody: passed.renderBody, renderActions: passed.renderActions };
}

function makeProcessingCtx(overrides = {}) {
    return {
        selectedEffect: BLENDED,
        processing: true,
        results: [],
        pendingPrompts: [],
        allResolved: false,
        selected: new Set(),
        eligibleTargets: [],
        toggleTarget: vi.fn(),
        handleApply: vi.fn(),
        setProcessing: vi.fn(),
        setResults: vi.fn(),
        setPendingPrompts: vi.fn(),
        combatSummary: baseCombatSummary,
        ...overrides,
    };
}

describe('BlindnessDeafnessModal edge cases', () => {
    beforeEach(() => {
        diceRoller.rollD20.mockReturnValue(15);
    });

    afterEach(() => {
        // mockReset (not clearAllMocks) so return stubs cannot leak across
        // tests. AreaEffectTargetModalBase is deliberately NOT reset — its
        // mock rendering lives in the vi.mock factory and must survive.
        diceRoller.rollD20.mockReset();
        addExpiration.mockReset();
        addCondition.mockReset();
        addEntry.mockReset();
        sendSavePrompt.mockReset();
        sendSaveResult.mockReset();
    });

    // ── renderBody — processing result row formatting ──

    describe('renderBody processing result formatting', () => {
        it('formats failed and saved rows with roll arithmetic; effect label comes from component state', () => {
            const { renderBody } = capture();
            const { container } = render(
                <div>{renderBody(makeProcessingCtx({
                    results: [
                        { targetName: 'Goblin1', success: false, roll: 1, total: 3, saveBonus: 2 },
                        { targetName: 'Orc Warrior', success: true, roll: 15, total: 19, saveBonus: 4 },
                    ],
                }))}</div>
            );

            // Edge: ctx.selectedEffect is set but the component's internal
            // selection is null, so the interpolated effectLabel is empty.
            expect(container).toHaveTextContent('Resolving CON saving throws (DC 14) for');
            expect(container).toHaveTextContent('Goblin1: Failed — ! (Roll: 1 +2 = 3)');
            expect(container).toHaveTextContent('Orc Warrior: Saved — unaffected (Roll: 15 +4 = 19)');
            expect(container.querySelectorAll('.abjure-result').length).toBe(2);
        });

        it('omits the +0 segment when save bonus is zero', () => {
            const { renderBody } = capture();
            const { container } = render(
                <div>{renderBody(makeProcessingCtx({
                    results: [{ targetName: 'Orc Warrior', success: true, roll: 15, total: 15, saveBonus: 0 }],
                }))}</div>
            );

            expect(container).toHaveTextContent('Orc Warrior: Saved — unaffected (Roll: 15 = 15)');
            expect(container.textContent).not.toContain('+0');
        });

        it('omits roll details entirely when roll is not a number', () => {
            const { renderBody } = capture();
            const { container } = render(
                <div>{renderBody(makeProcessingCtx({
                    results: [
                        { targetName: 'Goblin1', success: false, roll: null, total: 3, saveBonus: 2 },
                        { targetName: 'Orc Warrior', success: false, total: 4, saveBonus: 4 },
                    ],
                }))}</div>
            );

            expect(container).toHaveTextContent('Goblin1: Failed — !');
            expect(container).toHaveTextContent('Orc Warrior: Failed — !');
            expect(container.textContent).not.toContain('Roll:');
        });

        it('lists pending prompts while unresolved and withholds the resolved note', () => {
            const { renderBody } = capture();
            const { container } = render(
                <div>{renderBody(makeProcessingCtx({
                    results: [{ targetName: 'Goblin1', success: false, roll: 1, total: 3, saveBonus: 2 }],
                    pendingPrompts: [{ promptId: 'prompt-1', targetName: 'Elf Mage' }],
                    allResolved: false,
                }))}</div>
            );

            expect(container).toHaveTextContent('Elf Mage: Waiting for save roll...');
            expect(container.querySelector('.abjure-result-pending')).toBeInTheDocument();
            expect(container.textContent).not.toContain('All targets resolved');
        });

        it('shows the resolved note only when allResolved is true', () => {
            const { renderBody } = capture();
            const { container } = render(
                <div>{renderBody(makeProcessingCtx({
                    results: [{ targetName: 'Goblin1', success: false, roll: 1, total: 3, saveBonus: 2 }],
                    allResolved: true,
                }))}</div>
            );

            expect(container.querySelector('.sp-note')).toHaveTextContent('All targets resolved.');
            expect(container.textContent).not.toContain('Waiting for save roll');
        });
    });

    // ── renderBody — target selection copy (custom rangeFeet) ──

    describe('target selection copy uses rangeFeet prop', () => {
        const scenarios = [
            { rangeFeet: 120, expected: 'Select a creature within 120 feet' },
            { rangeFeet: 60, expected: 'Select a creature within 60 feet' },
        ];

        scenarios.forEach(({ rangeFeet, expected }) => {
            it(`renders the ${expected} instruction with selection counts`, () => {
                const { renderBody } = capture(makeProps({ rangeFeet }));
                const { container } = render(
                    <div>{renderBody(makeProcessingCtx({
                        processing: false,
                        selected: new Set(['Goblin1']),
                        eligibleTargets: baseCombatSummary.creatures,
                    }))}</div>
                );

                expect(container).toHaveTextContent(expected);
                expect(container).toHaveTextContent('CON');
                expect(container).toHaveTextContent('Targets selected: 1/3');
            });
        });
    });

    // ── renderActions — terminal and disabled states ──

    describe('renderActions processing/complete states', () => {
        it('renders no action buttons while processing with pending prompts', () => {
            const { renderActions } = capture();
            const { container } = render(<div>{renderActions(makeProcessingCtx({ allResolved: false }))}</div>);

            expect(container.querySelectorAll('button').length).toBe(0);
        });

        it('renders only an enabled Done button once all resolved, and Done closes the modal', () => {
            const { props, renderActions } = capture();
            const { container } = render(<div>{renderActions(makeProcessingCtx({ allResolved: true }))}</div>);

            const buttons = within(container).getAllByRole('button');
            expect(buttons.length).toBe(1);
            fireEvent.click(within(container).getByRole('button', { name: 'Done' }));
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        it('disables the roll button with zero targets selected and it stays inert', () => {
            const handleApply = vi.fn();
            const { renderActions } = capture();
            const { container } = render(
                <div>{renderActions(makeProcessingCtx({ processing: false, selected: new Set(), handleApply }))}</div>
            );

            const rollBtn = within(container).getByRole('button', { name: 'Blindness/Deafness (0 target)' });
            expect(rollBtn).toBeDisabled();
            fireEvent.click(rollBtn);
            expect(handleApply).not.toHaveBeenCalled();
        });

        it('renders exactly Cancel when no effect is selected, and Cancel closes the modal', () => {
            const { props } = capture(makeProps());
            // ctx.selectedEffect null → Cancel-only branch in the mounted base.
            const actions = within(screen.getByTestId('sp-actions'));
            expect(actions.queryAllByRole('button').map(b => b.textContent.trim())).toEqual(['Cancel']);

            fireEvent.click(actions.getByRole('button', { name: 'Cancel' }));
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        it('renders Roll, Back and Cancel after effect selection, and Back returns to effect choice', () => {
            capture();
            // Button accessible name is "Blinded Target is blinded" (strong + span).
            fireEvent.click(screen.getByRole('button', { name: /Blinded/ }));

            const actions = within(screen.getByTestId('sp-actions'));
            expect(actions.queryAllByRole('button').map(b => b.textContent.trim())).toEqual([
                'Blindness/Deafness (0 target)',
                'Back',
                'Cancel',
            ]);

            fireEvent.click(actions.getByRole('button', { name: 'Back' }));
            expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
            expect(screen.getByText('Choose an effect for the target:')).toBeInTheDocument();
        });
    });

    // ── custom featureName passthrough ──

    it('passes a custom featureName through to the header and roll button label', () => {
        capture(makeProps({ featureName: 'Custom Effect' }));

        expect(screen.getByTestId('area-effect-modal-base')).toHaveTextContent('Custom Effect');
        fireEvent.click(screen.getByRole('button', { name: /Deafened/ }));
        expect(within(screen.getByTestId('sp-actions')).getByRole('button', {
            name: 'Custom Effect (0 target)',
        })).toBeDisabled();
        expect(AreaEffectTargetModalBase.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({
            featureName: 'Custom Effect',
            saveType: 'CON',
            saveDc: 14,
            campaignName: 'test-campaign',
        }));
    });
});
