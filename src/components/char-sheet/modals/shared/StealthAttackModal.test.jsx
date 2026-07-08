// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StealthAttackModal from './StealthAttackModal.jsx';

vi.mock('../../../../services/automation/handlers/class-fighter-rogue/stealthAttackHandler.js', () => ({
    applyStealthAttack: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import * as stealthAttackHandler from '../../../../services/automation/handlers/class-fighter-rogue/stealthAttackHandler.js';

const mockPlayerStats = {
    name: 'TestRogue',
    level: 5,
    class: {
        class_levels: [
            { level: 1, sneak_attack_num_d6: 1 },
            { level: 2, sneak_attack_num_d6: 2 },
            { level: 3, sneak_attack_num_d6: 3 },
            { level: 4, sneak_attack_num_d6: 4 },
            { level: 5, sneak_attack_num_d6: 5 },
        ],
        sneak_attack_dice_value: 6,
    },
};

const mockCampaignName = 'test-campaign';

const defaultAction = {
    name: 'Stealth Attack',
    automation: {
        type: 'stealth_attack',
        cost: '1d6',
    },
};

function makeAction(overrides = {}) {
    return { ...defaultAction, ...overrides };
}

function makePlayerStats(overrides = {}) {
    return { ...mockPlayerStats, ...overrides };
}

function makeProps(overrides = {}) {
    return {
        action: makeAction(overrides.action || {}),
        playerStats: makePlayerStats(overrides.playerStats || {}),
        campaignName: mockCampaignName,
        costD6: 1,
        availableDice: 5,
        onClose: vi.fn(),
        ...overrides,
    };
}

describe('StealthAttackModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initial render', () => {
        it('renders the modal with action name and eye-slash icon', () => {
            render(<StealthAttackModal {...makeProps()} />);
            expect(screen.getByText('Stealth Attack')).toBeInTheDocument();
            const icon = document.querySelector('.fa-solid.fa-eye-slash');
            expect(icon).toBeInTheDocument();
        });

        it('displays the confirmation prompt text', () => {
            render(<StealthAttackModal {...makeProps()} />);
            expect(screen.getByText(/Activate Stealth Attack\?/)).toBeInTheDocument();
            expect(screen.getByText(/This will cost/)).toBeInTheDocument();
            expect(screen.getByText(/5d6 available/)).toBeInTheDocument();
        });

        it('shows the sneak attack dice value from playerStats', () => {
            render(<StealthAttackModal {...makeProps()} />);
            expect(screen.getByText(/5d6 available\)/)).toBeInTheDocument();
        });

        it('renders Activate and Cancel buttons', () => {
            render(<StealthAttackModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: /Activate Stealth Attack/ })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });

        it('renders with custom costD6 value', () => {
            render(<StealthAttackModal {...makeProps({ costD6: 3, availableDice: 7, playerStats: { ...mockPlayerStats, class: { class_levels: [{ level: 1, sneak_attack_num_d6: 1 }] } } })} />);
            const p = document.querySelector('.sp-body p');
            expect(p.textContent).toContain('cost');
            expect(p.textContent).toContain('3d6');
            expect(p.textContent).toContain('7d6 available');
        });

        it('renders with custom action name', () => {
            render(<StealthAttackModal {...makeProps({ action: makeAction({ name: 'My Stealth Attack' }) })} />);
            expect(screen.getByText('My Stealth Attack')).toBeInTheDocument();
        });

        it('renders with custom sneak attack dice value from playerStats', () => {
            const stats = makePlayerStats({
                level: 3,
                class: {
                    class_levels: [
                        { level: 1, sneak_attack_num_d6: 1 },
                        { level: 2, sneak_attack_num_d6: 2 },
                        { level: 3, sneak_attack_num_d6: 3, sneak_attack_dice_value: 8 },
                    ],
                },
            });
            render(<StealthAttackModal {...makeProps({ playerStats: stats, costD6: 2, availableDice: 3 })} />);
            expect(screen.getByText(/3d8 available/)).toBeInTheDocument();
        });
    });

    describe('overlay dismiss behavior', () => {
        it('calls onClose when overlay background is clicked', () => {
            const onClose = vi.fn();
            render(<StealthAttackModal {...makeProps({ onClose })} />);
            const overlay = document.querySelector('.sp-overlay');
            fireEvent.click(overlay);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose when modal content is clicked', () => {
            const onClose = vi.fn();
            render(<StealthAttackModal {...makeProps({ onClose })} />);
            const modal = document.querySelector('.sp-modal');
            fireEvent.click(modal);
            expect(onClose).not.toHaveBeenCalled();
        });

        it('calls onClose when Cancel button is clicked', () => {
            const onClose = vi.fn();
            render(<StealthAttackModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('apply behavior', () => {
        it('calls applyStealthAttack with correct arguments', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: 'Stealth Attack active.',
                },
            });

            render(<StealthAttackModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(stealthAttackHandler.applyStealthAttack).toHaveBeenCalledWith(
                    expect.objectContaining({ name: 'Stealth Attack' }),
                    mockPlayerStats,
                    mockCampaignName,
                    1,
                );
            });
        });

        it('transitions to applied state after successful apply', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: 'Stealth Attack active. Next attack will cost 1d6 Sneak Attack dice.',
                },
            });

            render(<StealthAttackModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.getByText('Stealth Attack active. Next attack will cost 1d6 Sneak Attack dice.')).toBeInTheDocument();
            });
        });

        it('hides confirmation UI after apply', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: 'Stealth Attack active.',
                },
            });

            render(<StealthAttackModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.queryByText(/Activate Stealth Attack\?/)).not.toBeInTheDocument();
                expect(screen.queryByRole('button', { name: /Activate Stealth Attack/ })).not.toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
            });
        });

        it('shows Done button in applied state', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: 'Stealth Attack active.',
                },
            });

            render(<StealthAttackModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
        });

        it('renders the result description as HTML', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: '<strong>Stealth Attack</strong> active.',
                },
            });

            render(<StealthAttackModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                const bodyDiv = document.querySelector('.sp-body');
                expect(bodyDiv.innerHTML).toContain('<strong>Stealth Attack</strong>');
            });
        });

        it('calls onClose when Done button is clicked in applied state', async () => {
            const onClose = vi.fn();
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: 'Stealth Attack active.',
                },
            });

            render(<StealthAttackModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when overlay is clicked in applied state', async () => {
            const onClose = vi.fn();
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: 'Stealth Attack active.',
                },
            });

            render(<StealthAttackModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });

            const overlay = document.querySelector('.sp-overlay');
            fireEvent.click(overlay);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose when modal content is clicked in applied state', async () => {
            const onClose = vi.fn();
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: 'Stealth Attack active.',
                },
            });

            render(<StealthAttackModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });

            const modal = document.querySelector('.sp-modal');
            fireEvent.click(modal);
            expect(onClose).not.toHaveBeenCalled();
        });

        it('handles applyStealthAttack returning a popup with automation info', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    automationType: 'stealth_attack',
                    description: 'Stealth Attack active. Next attack will cost 2d6 Sneak Attack dice. If you have Invisible from Hide, it won\'t end when you attack or end turn behind 3/4 or Total Cover.',
                },
            });

            render(<StealthAttackModal {...makeProps({ costD6: 2, availableDice: 4 })} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.getByText(/Stealth Attack active/)).toBeInTheDocument();
                expect(screen.getByText(/2d6 Sneak Attack dice/)).toBeInTheDocument();
            });
        });

        it('does not show applied state when result is null', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue(null);

            render(<StealthAttackModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
                expect(screen.queryByText(/Stealth Attack active/)).not.toBeInTheDocument();
            });
        });

        it('does not show applied state when result exists but applied is false', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: 'Some result.',
                },
            });

            render(<StealthAttackModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            // applied is set to true after setResult, so both should appear together
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
        });
    });

    describe('error handling from applyStealthAttack', () => {
        it('shows error popup result when apply returns insufficient dice error', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: 'Not enough Sneak Attack dice. Need 3d6, have 1d6.',
                },
            });

            render(<StealthAttackModal {...makeProps({ costD6: 3, availableDice: 1 })} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.getByText(/Not enough Sneak Attack dice/)).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
        });

        it('renders error description as HTML from apply result', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
                    description: '<b>Not enough</b> Sneak Attack dice.',
                },
            });

            render(<StealthAttackModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                const bodyDiv = document.querySelector('.sp-body');
                expect(bodyDiv.innerHTML).toContain('<b>Not enough</b>');
            });
        });
    });

    describe('playerStats edge cases', () => {
        it('defaults sneakAttackDiceValue to 6 when class_levels lookup returns undefined', () => {
            const stats = makePlayerStats({
                class: undefined,
            });
            render(<StealthAttackModal {...makeProps({ playerStats: stats, costD6: 1, availableDice: 2 })} />);
            expect(screen.getByText(/2d6 available\)/)).toBeInTheDocument();
        });

        it('defaults sneakAttackDiceValue to 6 when class_levels is empty', () => {
            const stats = makePlayerStats({
                class: { class_levels: [], sneak_attack_dice_value: 8 },
            });
            render(<StealthAttackModal {...makeProps({ playerStats: stats, costD6: 1, availableDice: 2 })} />);
            expect(screen.getByText(/2d6 available\)/)).toBeInTheDocument();
        });

        it('defaults sneakAttackDiceValue to 6 when level-1 index is out of range', () => {
            const stats = makePlayerStats({
                level: 10,
                class: {
                    class_levels: [
                        { level: 1, sneak_attack_num_d6: 1 },
                    ],
                    sneak_attack_dice_value: 8,
                },
            });
            render(<StealthAttackModal {...makeProps({ playerStats: stats, costD6: 1, availableDice: 1 })} />);
            expect(screen.getByText(/1d6 available\)/)).toBeInTheDocument();
        });
    });
});
