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

// ── Re-import mocked modules ──

import * as quiveringPalmHandler from '../../../services/automation/handlers/class-monk/quiveringPalmHandler.js';

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

describe('QuiveringPalmModal - release flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls applyRelease (not applyShockwave) when release button is clicked', async () => {
        quiveringPalmHandler.applyRelease.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Quivering Palm',
                automationType: 'quivering_palm',
                description: 'Vibrations released harmlessly against Goblin1.',
                automation: { type: 'quivering_palm' },
                isRelease: true,
            },
        });

        renderModal();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Release the Harmless Vibrations/ }));
        });

        expect(quiveringPalmHandler.applyRelease).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Quivering Palm' }),
            expect.objectContaining({ name: 'Monk1' }),
            'test-campaign',
            'Goblin1'
        );
        expect(quiveringPalmHandler.applyShockwave).not.toHaveBeenCalled();
    });

    it('renders a simple info popup for a release result, not the shockwave save/damage template', async () => {
        quiveringPalmHandler.applyRelease.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Quivering Palm',
                automationType: 'quivering_palm',
                description: 'Vibrations released harmlessly against Goblin1.',
                automation: { type: 'quivering_palm' },
                isRelease: true,
            },
        });

        renderModal();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Release the Harmless Vibrations/ }));
        });

        await waitFor(() => {
            expect(screen.getByText('Vibrations released harmlessly against Goblin1.')).toBeInTheDocument();
        });
        expect(screen.queryByText(/rolled a .* save/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Full damage/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Half damage/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Failure/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
});
