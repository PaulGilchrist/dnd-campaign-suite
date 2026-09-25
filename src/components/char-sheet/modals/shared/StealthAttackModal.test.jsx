// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StealthAttackModal from './StealthAttackModal.jsx';

vi.mock('../../../../services/automation/handlers/class-fighter-rogue/stealthAttackHandler.js', () => ({
    applyStealthAttack: vi.fn(),
}));

import * as stealthAttackHandler from '../../../../services/automation/handlers/class-fighter-rogue/stealthAttackHandler.js';

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

function makeProps(overrides = {}) {
    return {
        action: makeAction(overrides.action || {}),
        playerStats: {
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
        },
        campaignName: mockCampaignName,
        costD6: 1,
        availableDice: 5,
        onClose: vi.fn(),
        ...overrides,
    };
}

const defaultAppliedResult = {
    type: 'popup',
    payload: {
        type: 'automation_info',
        name: 'Stealth Attack',
        description: 'Stealth Attack active.',
    },
};

describe('StealthAttackModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stealthAttackHandler.applyStealthAttack.mockResolvedValue(defaultAppliedResult);
    });

    describe('initial render', () => {
        it('renders the modal with action name and eye-slash icon', () => {
            render(<StealthAttackModal {...makeProps()} />);
            expect(screen.getByText('Stealth Attack')).toBeInTheDocument();
            expect(document.querySelector('.fa-solid.fa-eye-slash')).toBeInTheDocument();
        });

        it('displays the confirmation prompt with cost and available dice', () => {
            render(<StealthAttackModal {...makeProps()} />);
            expect(screen.getByText(/Activate Stealth Attack\?/)).toBeInTheDocument();
            expect(screen.getByText(/This will cost/)).toBeInTheDocument();
            expect(screen.getByText(/5d6 available/)).toBeInTheDocument();
        });

        it('renders Activate and Cancel buttons', () => {
            render(<StealthAttackModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: /Activate Stealth Attack/ })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });

        it('renders with custom costD6 and availableDice values', () => {
            render(<StealthAttackModal {...makeProps({ costD6: 3, availableDice: 7 })} />);
            expect(screen.getByText(/3d6/)).toBeInTheDocument();
            expect(screen.getByText(/7d6 available/)).toBeInTheDocument();
        });

        it('renders with custom action name', () => {
            render(<StealthAttackModal {...makeProps({ action: makeAction({ name: 'My Stealth Attack' }) })} />);
            expect(screen.getByText('My Stealth Attack')).toBeInTheDocument();
        });

        it('renders with custom sneak attack dice value from playerStats', () => {
            const stats = {
                level: 3,
                class: {
                    class_levels: [
                        { level: 1, sneak_attack_num_d6: 1 },
                        { level: 2, sneak_attack_num_d6: 2 },
                        { level: 3, sneak_attack_num_d6: 3, sneak_attack_dice_value: 8 },
                    ],
                },
            };
            render(<StealthAttackModal {...makeProps({ playerStats: stats, costD6: 2, availableDice: 3 })} />);
            expect(screen.getByText(/3d8 available/)).toBeInTheDocument();
        });
    });

    describe('dismiss behavior', () => {
        it('does not call onClose when overlay background is clicked', () => {
            const onClose = vi.fn();
            render(<StealthAttackModal {...makeProps({ onClose })} />);
            fireEvent.click(document.querySelector('.sp-overlay'));
            expect(onClose).not.toHaveBeenCalled();
            expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        });

        it('calls onClose when Cancel button is clicked', () => {
            const onClose = vi.fn();
            render(<StealthAttackModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('apply behavior', () => {
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

        it('replaces confirmation UI with result and Done button', async () => {
            render(<StealthAttackModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.queryByText(/Activate Stealth Attack\?/)).not.toBeInTheDocument();
                expect(screen.queryByRole('button', { name: /Activate Stealth Attack/ })).not.toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
        });

        it('renders result description text content', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stealth Attack',
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

        it('calls onClose when Done button is clicked in applied state', async () => {
            const onClose = vi.fn();
            render(<StealthAttackModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose when overlay is clicked in applied state', async () => {
            const onClose = vi.fn();
            render(<StealthAttackModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });

            fireEvent.click(document.querySelector('.sp-overlay'));
            expect(onClose).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });
    });

    describe('error handling from applyStealthAttack', () => {
        it('shows error message from apply result', async () => {
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
    });

    describe('null/missing result handling', () => {
        it('does not show applied state when result is null', async () => {
            stealthAttackHandler.applyStealthAttack.mockResolvedValue(null);

            render(<StealthAttackModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

            await waitFor(() => {
                expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
                expect(screen.queryByText(/Stealth Attack active/)).not.toBeInTheDocument();
            });
        });
    });

    describe('playerStats edge cases', () => {
        it('defaults sneakAttackDiceValue to 6 when class is undefined', () => {
            render(<StealthAttackModal {...makeProps({ playerStats: { level: 5, class: undefined }, costD6: 1, availableDice: 2 })} />);
            expect(screen.getByText(/2d6 available/)).toBeInTheDocument();
        });

        it('defaults sneakAttackDiceValue to 6 when class_levels is empty', () => {
            render(<StealthAttackModal {...makeProps({ playerStats: { level: 5, class: { class_levels: [], sneak_attack_dice_value: 8 } }, costD6: 1, availableDice: 2 })} />);
            expect(screen.getByText(/2d6 available/)).toBeInTheDocument();
        });

        it('defaults sneakAttackDiceValue to 6 when level-1 index is out of range', () => {
            const stats = {
                level: 10,
                class: {
                    class_levels: [
                        { level: 1, sneak_attack_num_d6: 1 },
                    ],
                    sneak_attack_dice_value: 8,
                },
            };
            render(<StealthAttackModal {...makeProps({ playerStats: stats, costD6: 1, availableDice: 1 })} />);
            expect(screen.getByText(/1d6 available/)).toBeInTheDocument();
        });
    });
});
