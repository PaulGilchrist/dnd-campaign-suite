// @improved-by-ai
// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BlindnessDeafnessModal from './BlindnessDeafnessModal.jsx';

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin1', type: 'npc', saveBonuses: { con: 2 } },
        { name: 'Orc Warrior', type: 'npc', saveBonuses: { con: 4 } },
        { name: 'Elf Mage', type: 'player', saveBonuses: { con: 1 } },
    ],
};

// Shared mock state for the AreaEffectTargetModalBase mock
const mockState = {
    selectedEffect: null,
    processing: false,
    results: [],
    pendingPrompts: [],
    setSelectedEffect: null,
    setProcessing: null,
    setResults: null,
    setPendingPrompts: null,
};

vi.mock('./shared/AreaEffectTargetModalBase.jsx', () => {
    return {
        default: vi.fn(({ renderBody, renderActions, featureName, icon, onClose, extraState, combatSummary }) => {
            if (extraState?.setSelectedEffect) {
                mockState.setSelectedEffect = extraState.setSelectedEffect;
            }

            const ctx = {
                selected: new Set(),
                processing: mockState.processing,
                results: mockState.results,
                pendingPrompts: mockState.pendingPrompts,
                eligibleTargets: [],
                toggleTarget: vi.fn(),
                handleApply: vi.fn(),
                selectedEffect: mockState.selectedEffect,
                allResolved: false,
                setProcessing: mockState.setProcessing || vi.fn(),
                setResults: mockState.setResults || vi.fn(),
                setPendingPrompts: mockState.setPendingPrompts || vi.fn(),
                setSelectedEffect: mockState.setSelectedEffect || vi.fn(),
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
                        <div className="sp-actions">
                            {renderActions ? renderActions(ctx) : null}
                        </div>
                    </div>
                </div>
            );
        }),
    };
});

export { mockState };

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
import AreaEffectTargetModalBase from './shared/AreaEffectTargetModalBase.jsx';

const baseProps = {
    combatSummary: {
        creatures: [
            { name: 'Goblin1', type: 'npc', saveBonuses: { con: 2 } },
            { name: 'Orc Warrior', type: 'npc', saveBonuses: { con: 4 } },
            { name: 'Elf Mage', type: 'player', saveBonuses: { con: 1 } },
        ],
    },
    attackerName: 'Witch1',
    attackerPos: { gridX: 10, gridY: 10 },
    saveDc: 14,
    campaignName: 'test-campaign',
    mapData: null,
    onClose: vi.fn(),
    characters: [],
    featureName: 'Blindness/Deafness',
    rangeFeet: 120,
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

function getLastCtx() {
    const lastCall = AreaEffectTargetModalBase.mock.calls[AreaEffectTargetModalBase.mock.calls.length - 1];
    return lastCall?.[0] || {};
}

function makeProcessingCtx(overrides = {}) {
    return {
        selectedEffect: { key: 'blinded', label: 'Blinded', condition: 'blinded' },
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
        vi.clearAllMocks();
        diceRoller.rollD20.mockReturnValue(15);
        mockState.selectedEffect = null;
        mockState.processing = false;
        mockState.results = [];
        mockState.pendingPrompts = [];
    });

    // ── renderBody processing state ──

    describe('renderBody processing state', () => {
        const scenarios = [
            {
                name: 'renders processing message with effect label and DC',
                ctx: makeProcessingCtx({
                    results: [
                        { targetName: 'Goblin1', success: false, roll: 1, total: 3, saveBonus: 2 },
                        { targetName: 'Orc Warrior', success: true, roll: 15, total: 19, saveBonus: 4 },
                    ],
                    pendingPrompts: [{ promptId: 'prompt-1', targetName: 'Elf Mage' }],
                    allResolved: false,
                }),
                expectedTexts: ['Resolving CON saving throws', 'DC 14', 'Goblin1', 'Orc Warrior', 'Elf Mage', 'Waiting for save roll'],
            },
            {
                name: 'renders "All targets resolved" when allResolved is true',
                ctx: makeProcessingCtx({
                    results: [{ targetName: 'Goblin1', success: false, roll: 1, total: 3, saveBonus: 2 }],
                    allResolved: true,
                }),
                expectedTexts: ['All targets resolved'],
            },
            {
                name: 'renders result text with roll details including bonus',
                ctx: makeProcessingCtx({
                    results: [
                        { targetName: 'Goblin1', success: false, roll: 1, total: 3, saveBonus: 2 },
                        { targetName: 'Orc Warrior', success: true, roll: 15, total: 15, saveBonus: 0 },
                    ],
                }),
                expectedTexts: ['Roll: 1 +2', 'Roll: 15'],
            },
            {
                name: 'renders failed result text with empty effect label when component has no selection',
                ctx: makeProcessingCtx({
                    results: [{ targetName: 'Goblin1', success: false, roll: 1, total: 3, saveBonus: 2 }],
                    allResolved: true,
                }),
                expectedTexts: ['Failed — !', 'Goblin1', 'All targets resolved'],
            },
        ];

        scenarios.forEach(({ name, ctx, expectedTexts }) => {
            it(name, () => {
                render(<BlindnessDeafnessModal {...makeProps()} />);
                const { renderBody } = getLastCtx();

                const { container } = render(
                    <div data-testid="processing-body">
                        {renderBody(ctx)}
                    </div>
                );

                expectedTexts.forEach(text => expect(container.textContent).toContain(text));
            });
        });
    });

    // ── renderActions processing/complete state ──

    describe('renderActions processing/complete state', () => {
        it('renders Done button when processing is true and allResolved is true', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const { renderActions } = getLastCtx();

            const ctx = makeProcessingCtx({ allResolved: true });

            const { container } = render(
                <div data-testid="actions-complete">
                    {renderActions(ctx)}
                </div>
            );

            expect(container.querySelector('.sp-roll-btn')).toBeInTheDocument();
            expect(container.textContent).toContain('Done');
        });

        it('returns null when processing is true but not allResolved', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const { renderActions } = getLastCtx();

            const ctx = makeProcessingCtx({ allResolved: false });

            const { container } = render(
                <div data-testid="actions-processing">
                    {renderActions(ctx)}
                </div>
            );

            const buttons = container.querySelectorAll('button');
            expect(buttons.length).toBe(0);
        });

        it('renders Back and Cancel buttons after effect selection', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const { renderActions } = getLastCtx();

            const ctx = {
                ...makeProcessingCtx(),
                processing: false,
                selected: new Set(['Goblin1']),
            };

            const { container } = render(
                <div data-testid="actions-select">
                    {renderActions(ctx)}
                </div>
            );

            const rollButton = container.querySelector('.sp-roll-btn');
            expect(rollButton).toBeInTheDocument();
            expect(rollButton.textContent).toContain('Blindness/Deafness');
            const backBtn = container.querySelector('.sp-dismiss-btn');
            expect(backBtn).toBeInTheDocument();
            expect(backBtn.textContent).toContain('Back');
        });

        it('renders only Cancel button when no effect is selected', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const { renderActions } = getLastCtx();

            const ctx = {
                ...makeProcessingCtx(),
                selectedEffect: null,
                processing: false,
            };

            const { container } = render(
                <div data-testid="actions-no-effect">
                    {renderActions(ctx)}
                </div>
            );

            const dismissBtns = container.querySelectorAll('.sp-dismiss-btn');
            expect(dismissBtns.length).toBe(1);
            expect(dismissBtns[0].textContent).toContain('Cancel');

            const rollBtn = container.querySelector('.sp-roll-btn');
            expect(rollBtn).not.toBeInTheDocument();
        });
    });

    // ── Custom featureName and rangeFeet ──

    describe('custom featureName and rangeFeet', () => {
        it('renders with custom featureName', () => {
            render(<BlindnessDeafnessModal {...makeProps({ featureName: 'Custom Effect' })} />);
            expect(screen.getByText('Custom Effect')).toBeInTheDocument();
        });

        it('displays the configured rangeFeet value in target selection message', () => {
            render(<BlindnessDeafnessModal {...makeProps({ rangeFeet: 60 })} />);
            const { renderBody } = getLastCtx();

            const ctx = {
                selectedEffect: { key: 'blinded', label: 'Blinded', condition: 'blinded' },
                processing: false,
                results: [],
                pendingPrompts: [],
                allResolved: false,
                selected: new Set(['Goblin1']),
                eligibleTargets: baseCombatSummary.creatures,
                toggleTarget: vi.fn(),
                handleApply: vi.fn(),
                setProcessing: vi.fn(),
                setResults: vi.fn(),
                setPendingPrompts: vi.fn(),
                combatSummary: baseCombatSummary,
            };

            const { container } = render(
                <div data-testid="range-body">
                    {renderBody(ctx)}
                </div>
            );

            expect(container.textContent).toContain('60 feet');
        });
    });
});
