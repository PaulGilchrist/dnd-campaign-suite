// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuiveringPalmModal from './QuiveringPalmModal.jsx';

// ── Mocks ──

vi.mock('../../../services/automation/handlers/class-monk/quiveringPalmHandler.js', () => ({
    applyShockwave: vi.fn(),
    applyRelease: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(() => ({
        promise: Promise.resolve({ success: true, roll: 12, saveBonus: 2, total: 14 }),
    })),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 60, rolls: [3, 5, 7, 9, 11, 13, 15, 7] })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 60 })),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({
        creatures: [{ name: 'Goblin1', type: 'npc', saveBonuses: { con: 2 } }],
    })),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        guid: vi.fn(() => 'test-guid-123'),
    },
}));

// ── Test fixtures ──

function makeAction(overrides = {}) {
    return {
        name: 'Quivering Palm',
        automation: {
            type: 'quivering_palm',
            damageExpression: '10d12',
            damageType: 'Force',
            saveDc: 15,
            saveAbility: 'WIS',
            ...overrides,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'Monk1',
        proficiency: 4,
        abilities: {
            str: 16,
            dex: 14,
            con: 12,
            int: 10,
            wis: 14,
            cha: 8,
        },
        class: {
            class_levels: [{ level: 7, focus_points: 7 }],
        },
        ...overrides,
    };
}

function makeProps(overrides = {}) {
    return {
        action: makeAction(),
        playerStats: makePlayerStats(),
        campaignName: 'test-campaign',
        targetName: 'Goblin1',
        isRelease: false,
        onClose: vi.fn(),
        ...overrides,
    };
}

// ── Helpers ──

function renderModal(props = {}) {
    const handleClose = vi.fn();
    return {
        ...render(<QuiveringPalmModal {...makeProps({ onClose: handleClose, ...props })} />),
        handleClose,
    };
}

// ── Tests ──

describe('QuiveringPalmModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initial render', () => {
        it('renders the modal with action name and target in both modes', () => {
            renderModal();
            expect(screen.getByText('Quivering Palm')).toBeInTheDocument();
            expect(screen.getByText(/Vibrations are set in/)).toBeInTheDocument();
            expect(screen.getByText('Goblin1')).toBeInTheDocument();
        });

        it('renders the modal with action name and target in release-only mode', () => {
            renderModal({ isRelease: true, targetName: 'Dragon' });
            expect(screen.getByText('Quivering Palm')).toBeInTheDocument();
            expect(screen.getByText(/Vibrations are set in/)).toBeInTheDocument();
            expect(screen.getByText('Dragon')).toBeInTheDocument();
        });

        it('renders with custom action name', () => {
            renderModal({ action: makeAction({ name: 'My Quivering Palm' }) });
            expect(screen.getByText('My Quivering Palm')).toBeInTheDocument();
        });

        it('shows both action buttons and no Cancel in default mode', () => {
            renderModal();
            expect(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Release the Harmless Vibrations/ })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        });

        it('shows only release and Cancel buttons in release-only mode', () => {
            renderModal({ isRelease: true });
            expect(screen.getByRole('button', { name: /Release the Harmless Vibrations/ })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Trigger the Lethal Shockwave/ })).not.toBeInTheDocument();
        });
    });

    describe('overlay click behavior', () => {
        it('calls onClose when overlay background is clicked in default mode', () => {
            const { handleClose } = renderModal();
            fireEvent.click(document.querySelector('.sp-overlay'));
            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose when overlay background is clicked in release-only mode', () => {
            document.body.innerHTML = '';
            const { handleClose } = renderModal({ isRelease: true });
            fireEvent.click(document.querySelector('.sp-overlay'));
            expect(handleClose).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });

        it('does not call onClose when modal content is clicked', () => {
            const { handleClose } = renderModal();
            fireEvent.click(document.querySelector('.sp-modal'));
            expect(handleClose).not.toHaveBeenCalled();
        });
    });

    describe('release-only mode close behaviors', () => {
        it('calls onClose when Cancel button is clicked', () => {
            const { handleClose } = renderModal({ isRelease: true });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(handleClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('result screen', () => {
        it('renders a Done button that closes the modal', async () => {
            const { handleClose } = renderModal();
            const { applyShockwave } = await import('../../../services/automation/handlers/class-monk/quiveringPalmHandler.js');
            applyShockwave.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Quivering Palm',
                    automationType: 'quivering_palm',
                    description: 'Test',
                    success: false,
                    saveType: 'CON',
                    saveDc: 15,
                    rawDamage: 60,
                    finalDamage: 60,
                    damageExpression: '10d12',
                    damageType: 'Force',
                    diceDisplay: ' (3, 5, 7, 9, 11, 13, 15, 7)',
                },
            });

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            });

            expect(handleClose).toHaveBeenCalledTimes(1);
        });
    });
});
