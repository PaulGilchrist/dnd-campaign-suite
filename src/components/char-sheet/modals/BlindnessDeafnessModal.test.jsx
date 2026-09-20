// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
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

// ── Initial render ──

describe('BlindnessDeafnessModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockState.selectedEffect = null;
        mockState.processing = false;
        mockState.results = [];
        mockState.pendingPrompts = [];
    });

    describe('initial render', () => {
        it('renders the modal wrapper with the feature name header', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            expect(screen.getByText('Blindness/Deafness')).toBeInTheDocument();
        });

        it('renders the effect selection prompt text', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            expect(screen.getByText('Choose an effect for the target:')).toBeInTheDocument();
        });

        it('renders both effect buttons: Blinded and Deafened', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: /Blinded/ })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Deafened/ })).toBeInTheDocument();
        });

        it('renders a Cancel button', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });
    });

    // ── Effect selection UI ──
    // Note: Full effect selection behavior (target list, apply, save resolution)
    // is tested in BlindnessDeafnessModal.handlers.test.jsx and
    // BlindnessDeafnessModal.edge-cases.test.jsx. These tests only verify
    // the UI state change on the effect buttons themselves.

    describe('effect selection UI', () => {
        it('applies selected class and switches selection between effects', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const blindedBtn = screen.getByRole('button', { name: /Blinded/ });
            const deafenedBtn = screen.getByRole('button', { name: /Deafened/ });

            fireEvent.click(blindedBtn);
            expect(blindedBtn).toHaveClass('blindness-deafness-effect-selected');
            expect(deafenedBtn).not.toHaveClass('blindness-deafness-effect-selected');

            fireEvent.click(deafenedBtn);
            expect(deafenedBtn).toHaveClass('blindness-deafness-effect-selected');
            expect(blindedBtn).not.toHaveClass('blindness-deafness-effect-selected');
        });
    });

    // ── Cancel / Close ──

    describe('cancel / close', () => {
        it('calls onClose when Cancel button is clicked', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when clicking the overlay outside the modal', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            fireEvent.click(document.querySelector('.sp-overlay'));
            expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        });
    });
});
