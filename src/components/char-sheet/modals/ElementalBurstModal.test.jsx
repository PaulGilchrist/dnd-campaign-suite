// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElementalBurstModal from './ElementalBurstModal.jsx';

// ── Mocks ──

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./shared/SaveAttackAoeModal.jsx', () => ({
    default: vi.fn(({ action, damage, damageType, saveDc, saveType, onClose }) => (
        <div data-testid="save-attack-aoe-modal">
            <span data-testid="aoe-action">{action?.name}</span>
            <span data-testid="aoe-damage">{damage}</span>
            <span data-testid="aoe-damage-type">{damageType}</span>
            <span data-testid="aoe-save-type">{saveType}</span>
            <span data-testid="aoe-save-dc">{saveDc}</span>
            <button onClick={onClose}>Close AOE Modal</button>
        </div>
    )),
}));

// ── Re-import mocked modules ──

import * as logService from '../../../services/ui/logService.js';
import * as SaveAttackAoeModalMock from './shared/SaveAttackAoeModal.jsx';

// ── Test fixtures ──

const baseAction = {
    name: 'Elemental Burst',
};

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
    class: {
        class_levels: [
            { level: 1, martial_arts_die: 4 },
            { level: 2, martial_arts_die: 4 },
            { level: 3, martial_arts_die: 4 },
            { level: 4, martial_arts_die: 4 },
            { level: 5, martial_arts_die: 4 },
        ],
    },
};

const baseProps = {
    action: baseAction,
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
    onClose: vi.fn(),
};

function makeProps(overrides = {}) {
    return { ...baseProps, ...overrides };
}

function makePlayerStats(overrides = {}) {
    return { ...basePlayerStats, ...overrides };
}

// ── Helpers ──

function renderModal(props = {}) {
    const handleClose = vi.fn();
    return {
        ...render(<ElementalBurstModal {...makeProps({ onClose: handleClose, ...props })} />),
        handleClose,
    };
}

// ── Tests ──

describe('ElementalBurstModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Initial render / display ──

    describe('initial render', () => {
        it('renders the description with DC calculation', () => {
            // DC = 8 + Dex bonus (4) + proficiency (3) = 15
            renderModal();
            expect(screen.getByText(/must make a Dexterity saving throw \(DC 15\)/)).toBeInTheDocument();
        });

        it('renders the damage dice in the note', () => {
            // martial_arts_die is 4 at level 5
            const { container } = renderModal();
            const body = container.querySelector('.sp-body');
            expect(body.textContent).toContain('3d4 damage');
            expect(body.textContent).toContain('half as much damage');
        });

        it('renders all five damage type buttons', () => {
            renderModal();
            expect(screen.getByText('Acid')).toBeInTheDocument();
            expect(screen.getByText('Cold')).toBeInTheDocument();
            expect(screen.getByText('Fire')).toBeInTheDocument();
            expect(screen.getByText('Lightning')).toBeInTheDocument();
            expect(screen.getByText('Thunder')).toBeInTheDocument();
        });
    });

    // ── DC calculation ──

    describe('DC calculation', () => {
        it('calculates DC with different dex bonus', () => {
            const stats = makePlayerStats({
                abilities: [
                    { name: 'Dexterity', bonus: 6 },
                ],
                proficiency: 4,
            });
            renderModal({ playerStats: stats });
            // DC = 8 + 6 + 4 = 18
            expect(screen.getByText(/DC 18/)).toBeInTheDocument();
        });

        it('calculates DC with different proficiency', () => {
            const stats = makePlayerStats({
                proficiency: 6,
            });
            renderModal({ playerStats: stats });
            // DC = 8 + 4 + 6 = 18
            expect(screen.getByText(/DC 18/)).toBeInTheDocument();
        });

        it.each([
            { abilities: [{ name: 'Strength', bonus: 2 }], name: 'not found' },
            { abilities: undefined, name: 'undefined' },
            { abilities: [], name: 'empty' },
        ])('defaults dex bonus to 0 when abilities $name', ({ abilities }) => {
            const stats = makePlayerStats({ abilities });
            renderModal({ playerStats: stats });
            // DC = 8 + 0 + 3 = 11
            expect(screen.getByText(/DC 11/)).toBeInTheDocument();
        });
    });

    // ── Martial arts die resolution ──

    describe('martial arts die resolution', () => {
        it('uses martial_arts_die from the current class level', () => {
            const stats = makePlayerStats({
                level: 17,
                class: {
                    class_levels: [
                        { level: 17, martial_arts_die: 8 },
                    ],
                },
            });
            renderModal({ playerStats: stats });
            expect(screen.getByText(/3d8 damage/)).toBeInTheDocument();
        });

        it('defaults to d4 when no matching class level found', () => {
            const stats = makePlayerStats({
                level: 99,
                class: {
                    class_levels: [],
                },
            });
            renderModal({ playerStats: stats });
            expect(screen.getByText(/3d4 damage/)).toBeInTheDocument();
        });
    });

    // ── Overlay interaction ──

    describe('overlay interaction', () => {
        it('does not call onClose when the overlay background is clicked', () => {
            const { handleClose } = renderModal();
            const overlay = document.querySelector('.sp-overlay');
            fireEvent.click(overlay);
            expect(handleClose).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });

        it('does not call onClose when modal content is clicked', () => {
            const { handleClose } = renderModal();
            const modal = document.querySelector('.sp-modal');
            fireEvent.click(modal);
            expect(handleClose).not.toHaveBeenCalled();
        });
    });

    // ── Cancel button ──

    describe('cancel button', () => {
        it('calls onClose when Cancel is clicked', () => {
            const { handleClose } = renderModal();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(handleClose).toHaveBeenCalledTimes(1);
        });
    });

    // ── Damage type selection ──

    describe('damage type selection', () => {
        it('logs an ability_use entry when a damage type is chosen', async () => {
            renderModal();
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(logService.addEntry).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        type: 'ability_use',
                        characterName: 'Monk1',
                        abilityName: 'Elemental Burst',
                        description: 'Elemental Burst: Chose Fire damage type.',
                    })
                );
            });
        });

        it('transitions to AOE phase after choosing a damage type', async () => {
            renderModal();
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(screen.getByTestId('save-attack-aoe-modal')).toBeInTheDocument();
            });
        });

        it('passes correct data to the AOE modal', async () => {
            renderModal();
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(screen.getByTestId('aoe-action')).toHaveTextContent('Elemental Burst');
                expect(screen.getByTestId('aoe-damage')).toHaveTextContent('3d4');
                expect(screen.getByTestId('aoe-damage-type')).toHaveTextContent('fire');
                expect(screen.getByTestId('aoe-save-type')).toHaveTextContent('DEX');
                expect(screen.getByTestId('aoe-save-dc')).toHaveTextContent('15');
            });
        });

        it('passes correct AOE payload fields (shape, range, dcSuccess)', async () => {
            renderModal();
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(screen.getByTestId('save-attack-aoe-modal')).toBeInTheDocument();
            });
            // Verify the mock was called with the expected payload fields
            const mockCall = SaveAttackAoeModalMock.default.mock.calls[0][0];
            expect(mockCall).toMatchObject({
                shape: 'sphere',
                range: 20,
                dcSuccess: 'half',
            });
        });
    });

    // ── AOE modal close behavior ──

    describe('AOE modal close behavior', () => {
        it('calls onClose when Close button in AOE modal is clicked', async () => {
            const { handleClose } = renderModal();
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                fireEvent.click(screen.getByRole('button', { name: 'Close AOE Modal' }));
            });
            expect(handleClose).toHaveBeenCalledTimes(1);
        });
    });

    // ── Processing phase ──

    describe('processing phase', () => {
        it('transitions to AOE phase and hides initial phase UI', async () => {
            renderModal();
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(screen.queryByText(/Choose a damage type/)).not.toBeInTheDocument();
                expect(screen.queryByText('Fire')).not.toBeInTheDocument();
                expect(screen.getByTestId('save-attack-aoe-modal')).toBeInTheDocument();
            });
        });
    });

    // ── Custom action name ──

    describe('custom action name', () => {
        it('uses the action name in the log description', async () => {
            const action = { name: 'My Elemental Burst' };
            renderModal({ action });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(logService.addEntry).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        description: 'My Elemental Burst: Chose Fire damage type.',
                    })
                );
            });
        });

        it('passes custom action name to AOE modal', async () => {
            const action = { name: 'My Elemental Burst' };
            renderModal({ action });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(screen.getByTestId('aoe-action')).toHaveTextContent('My Elemental Burst');
            });
        });
    });

    // ── Error handling in logging ──

    describe('logging error handling', () => {
        it('does not throw when addEntry rejects', async () => {
            logService.addEntry.mockRejectedValue(new Error('network error'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            renderModal();
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith(
                    '[ElementalBurstModal] Error logging type choice:',
                    expect.any(Error)
                );
            });
            consoleSpy.mockRestore();
        });
    });

    // ── Edge cases ──

    describe('edge cases', () => {
        it('renders with undefined action', () => {
            renderModal({ action: undefined });
            expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });

        it.each([
            { value: null, name: 'null' },
            { value: 0, name: 'zero' },
        ])('handles proficiency $name (DC uses 0)', ({ value }) => {
            const stats = makePlayerStats({ proficiency: value });
            renderModal({ playerStats: stats });
            // null: DC = 8 + 4 + null = 12; 0: DC = 8 + 4 + 0 = 12
            expect(screen.getByText(/DC 12/)).toBeInTheDocument();
        });
    });
});
