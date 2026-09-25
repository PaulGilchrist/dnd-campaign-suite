// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

// ── Mocks ──

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((damage, success, dcSuccess) => {
        if (dcSuccess === 'half') return success ? Math.floor(damage / 2) : damage;
        return damage;
    }),
    computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./shared/AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
    default: vi.fn(({ title, icon, targets, description, note, confirmLabel, confirmIcon: _ci, onConfirm, onSkip }) => (
        <div className="sp-overlay" onClick={onSkip}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div data-testid="creature-selection-modal">
                    <span data-testid="cs-modal-title">{title}</span>
                    <span data-testid="cs-modal-icon">{icon}</span>
                    <span data-testid="cs-modal-target-count">{targets.length}</span>
                    {description && <div data-testid="cs-modal-description" dangerouslySetInnerHTML={{ __html: description }} />}
                    {note && <div data-testid="cs-modal-note" dangerouslySetInnerHTML={{ __html: note }} />}
                    <button data-testid="cs-confirm-btn" onClick={() => onConfirm(targets.map(t => t.name))} disabled={targets.length === 0}>
                        {confirmLabel || 'Confirm'}
                    </button>
                    <button data-testid="cs-skip-btn" onClick={onSkip}>Skip</button>
                </div>
            </div>
        </div>
    )),
}));

// ── Re-import mocked modules ──

import * as combatData from '../../../services/encounters/combatData.js';

// ── Test fixtures ──

const baseAction = { name: 'Elemental Attunement' };
const basePlayerStats = {
    name: 'Monk1',
    level: 5,
    proficiency: 3,
    abilities: [
        { name: 'Strength', bonus: 2 },
        { name: 'Dexterity', bonus: 4 },
        { name: 'Constitution', bonus: 1 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Wisdom', bonus: 1 },
        { name: 'Charisma', bonus: 0 },
    ],
};
const baseProps = { action: baseAction, playerStats: basePlayerStats, campaignName: 'test-campaign', onClose: vi.fn() };

function makeProps(overrides = {}) { return { ...baseProps, ...overrides }; }
function makeCombatSummary(creatures) { return { creatures }; }

function renderModal(props = {}) {
    const handleClose = vi.fn();
    return { ...render(<ElementalAttunementModal {...makeProps({ onClose: handleClose, ...props })} />), handleClose };
}

// ── Tests ──

describe('ElementalAttunementModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Element selection phase ──

    describe('element selection phase', () => {
        it('renders the modal header with title and instruction text', () => {
            renderModal();
            expect(screen.getByText('Elemental Attunement')).toBeInTheDocument();
            expect(screen.getByText('Choose the element for your manifestation:')).toBeInTheDocument();
        });

        it('renders all four elemental buttons with their descriptions', () => {
            renderModal();
            expect(screen.getByText('Cold')).toBeInTheDocument();
            expect(screen.getByText('Fire')).toBeInTheDocument();
            expect(screen.getByText('Lightning')).toBeInTheDocument();
            expect(screen.getByText('Thunder')).toBeInTheDocument();
            expect(screen.getByText(/5-ft radius area of extreme cold/)).toBeInTheDocument();
            expect(screen.getByText(/5-ft radius flames/)).toBeInTheDocument();
            expect(screen.getByText(/60-ft line of lightning/)).toBeInTheDocument();
            expect(screen.getByText(/5-ft radius burst of sonic energy/)).toBeInTheDocument();
        });

        it('renders the Cancel button', () => {
            renderModal();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });
    });

    // ── Skip / Cancel behavior ──

    describe('skip and cancel', () => {
        it('calls onClose when Cancel is clicked', () => {
            const { handleClose } = renderModal();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose when overlay is clicked (element phase)', () => {
            const { handleClose } = renderModal();
            fireEvent.click(document.querySelector('.sp-overlay'));
            expect(handleClose).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });

        it('does not call onClose when modal content is clicked', () => {
            const { handleClose } = renderModal();
            fireEvent.click(document.querySelector('.sp-modal'));
            expect(handleClose).not.toHaveBeenCalled();
        });

        it('calls onClose when Skip is clicked in CreatureSelectionModal', async () => {
            const { handleClose } = renderModal();
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([]));
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => fireEvent.click(screen.getByTestId('cs-skip-btn')));
            expect(handleClose).toHaveBeenCalledTimes(1);
        });
    });
});
