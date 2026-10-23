// @maintained-by-ai
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
                    { level: 2, sneak_attack_num_d6: 2 },
                    { level: 3, sneak_attack_num_d6: 3 },
                    { level: 4, sneak_attack_num_d6: 4 },
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

// Matches the real success description produced by applyStealthAttack.
function successDescription(costD6) {
    return `Stealth Attack active. Next attack will cost ${costD6}d6 Sneak Attack dice. If you have Invisible from Hide, it won't end when you attack or end turn behind 3/4 or Total Cover.`;
}

function successResult(costD6) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Stealth Attack',
            automationType: 'stealth_attack',
            description: successDescription(costD6),
        },
    };
}

describe('StealthAttackModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        applyStealthAttack.mockResolvedValue(successResult(1));
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

    it('renders available-dice suffix as d6 law, ignoring absent-key fantasy data', () => {
        // sneak_attack_dice_value is authored nowhere in public/data or public/campaigns
        // (census 2026-10-23: 0 producers). RAW sneak dice faces are d6 at every Rogue
        // level in both rulesets, and canonical accessors hardcode dice_value: 6
        // (classRules2024.js:269). Even hostile fake data must not change the label.
        const fakeD8 = makeProps({
            playerStats: {
                name: 'TestRogue',
                level: 3,
                class: {
                    class_levels: [
                        { level: 1, sneak_attack_num_d6: 1 },
                        { level: 2, sneak_attack_num_d6: 2 },
                        { level: 3, sneak_attack_num_d6: 3, sneak_attack_dice_value: 8 },
                    ],
                },
            },
            costD6: 2,
            availableDice: 3,
        });
        render(<StealthAttackModal {...fakeD8} />);
        expect(screen.getByText(/3d6 available/)).toBeInTheDocument();
        expect(screen.queryByText(/3d8 available/)).not.toBeInTheDocument();

        // Missing class data still renders d6.
        render(<StealthAttackModal {...makeProps({ playerStats: { name: 'TestRogue', level: 5, class: undefined }, availableDice: 2 })} />);
        expect(screen.getByText(/2d6 available/)).toBeInTheDocument();

        // Class-root fantasy key is likewise ignored.
        const outOfRange = makeProps({
            playerStats: {
                name: 'TestRogue',
                level: 10,
                class: {
                    class_levels: [{ level: 1, sneak_attack_num_d6: 1 }],
                    sneak_attack_dice_value: 8,
                },
            },
            availableDice: 1,
        });
        render(<StealthAttackModal {...outOfRange} />);
        expect(screen.getByText(/1d6 available/)).toBeInTheDocument();
        expect(screen.queryByText(/1d8 available/)).not.toBeInTheDocument();
    });

    it('ignores overlay clicks in both states and closes exactly once via Cancel', () => {
        const onClose = vi.fn();
        render(<StealthAttackModal {...makeProps({ onClose })} />);

        fireEvent.click(document.querySelector('.sp-overlay'));
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Activate calls applyStealthAttack with exact args and replaces confirmation with result and Done', async () => {
        const props = makeProps({ costD6: 2, availableDice: 4 });
        applyStealthAttack.mockResolvedValue(successResult(2));

        render(<StealthAttackModal {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

        expect(applyStealthAttack).toHaveBeenCalledWith(props.action, props.playerStats, mockCampaignName, 2);

        await waitFor(() => {
            expect(screen.getByText(successDescription(2))).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Activate Stealth Attack/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('applied view ignores overlay clicks and closes exactly once via Done', async () => {
        const onClose = vi.fn();
        render(<StealthAttackModal {...makeProps({ onClose })} />);
        fireEvent.click(screen.getByRole('button', { name: /Activate Stealth Attack/ }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        fireEvent.click(document.querySelector('.sp-overlay'));
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
