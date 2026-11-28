// @maintained-by-ai 2026-11-28
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StealthAttackModal from './StealthAttackModal.jsx';

vi.mock('../../../../services/automation/handlers/class-fighter-rogue/stealthAttackHandler.js', () => ({
    applyStealthAttack: vi.fn(),
}));

import { applyStealthAttack } from '../../../../services/automation/handlers/class-fighter-rogue/stealthAttackHandler.js';

const mockCampaignName = 'test-campaign';

function makeProps(overrides = {}) {
    return {
        action: { name: 'Stealth Attack', automation: { type: 'stealth_attack', cost: '1d6' } },
        playerStats: {
            name: 'TestRogue',
            level: 5,
            class: {
                class_levels: [
                    { level: 1, sneak_attack_num_d6: 1 },
                    { level: 5, sneak_attack_num_d6: 5 },
                ],
            },
        },
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
        // Argument-derived mock: the modal must display whatever description the
        // handler resolves with, keyed off the costD6 argument it forwards.
        applyStealthAttack.mockImplementation((action, _stats, _campaign, costD6) =>
            Promise.resolve({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: 'stealth_attack',
                    description: `${action.name} applied with ${costD6}d6 cost.`,
                },
            })
        );
    });

    it('renders confirmation prompt with action name, cost, available dice, and Activate/Cancel actions', () => {
        render(<StealthAttackModal {...makeProps()} />);

        expect(screen.getByText('Stealth Attack')).toBeInTheDocument();
        expect(screen.getByText(/Activate Stealth Attack\?/)).toBeInTheDocument();
        expect(screen.getByText('1d6')).toBeInTheDocument();
        expect(screen.getByText(/5d6 available/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Activate Stealth Attack/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('Activate forwards action, stats, campaign and costD6 to the handler, then replaces the confirmation with the returned description and Done', async () => {
        const props = makeProps({ costD6: 2, availableDice: 4 });

        render(<StealthAttackModal {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

        expect(applyStealthAttack).toHaveBeenCalledWith(props.action, props.playerStats, mockCampaignName, 2);

        await waitFor(() => {
            expect(screen.getByText('Stealth Attack applied with 2d6 cost.')).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Activate Stealth Attack/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('ignores backdrop clicks in both states and closes exactly once via Cancel (pre-apply) and Done (applied)', async () => {
        const onClose = vi.fn();
        const { container } = render(<StealthAttackModal {...makeProps({ onClose })} />);

        // Pre-apply: clicking the overlay backdrop must not close.
        fireEvent.click(container.firstChild);
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

        // Move to the applied view and confirm its backdrop is likewise inert.
        fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });
        fireEvent.click(container.firstChild);
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps the available-dice label on d6 faces even when fake sneak_attack_dice_value keys are present', () => {
        // Regression pin (census 2026-10-23): sneak dice faces are RAW-d6 in both
        // rulesets and no disk source authors a dice-value key; the component must
        // never re-introduce a fantasy-key read to change the label.
        render(<StealthAttackModal {...makeProps({
            playerStats: {
                name: 'TestRogue',
                level: 3,
                class: {
                    class_levels: [{ level: 1, sneak_attack_num_d6: 1 }],
                    sneak_attack_dice_value: 8,
                },
            },
            availableDice: 3,
        })} />);
        expect(screen.getByText(/3d6 available/)).toBeInTheDocument();
        expect(screen.queryByText(/3d8 available/)).not.toBeInTheDocument();
    });
});
