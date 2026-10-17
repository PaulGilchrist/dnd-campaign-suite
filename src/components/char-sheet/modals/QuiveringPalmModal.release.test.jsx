// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuiveringPalmModal from './QuiveringPalmModal.jsx';

// ── Mocks (component only imports the handler + CSS) ──

vi.mock('../../../services/automation/handlers/class-monk/quiveringPalmHandler.js', () => ({
    applyShockwave: vi.fn(),
    applyRelease: vi.fn(),
}));

import * as quiveringPalmHandler from '../../../services/automation/handlers/class-monk/quiveringPalmHandler.js';

// ── Fixtures ──

const RELEASE_RESULT = {
    type: 'popup',
    payload: {
        type: 'automation_info',
        name: 'Quivering Palm',
        automationType: 'quivering_palm',
        description: 'Vibrations released harmlessly against Goblin1.',
        automation: { type: 'quivering_palm' },
        isRelease: true,
    },
};

function makeProps(overrides = {}) {
    return {
        action: { name: 'Quivering Palm', automation: { type: 'quivering_palm', damageExpression: '10d12', damageType: 'Force', saveDc: 15, saveAbility: 'CON' } },
        playerStats: { name: 'Monk1' },
        campaignName: 'test-campaign',
        targetName: 'Goblin1',
        isRelease: false,
        onClose: vi.fn(),
        ...overrides,
    };
}

// ── Tests ──

describe('QuiveringPalmModal - release flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([false, true])(
        'clicking Release dispatches applyRelease (not applyShockwave) with action, stats, campaign and target (isRelease mode: %s)',
        async (isRelease) => {
            quiveringPalmHandler.applyRelease.mockResolvedValue(RELEASE_RESULT);

            render(<QuiveringPalmModal {...makeProps({ isRelease })} />);

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
        }
    );

    it('shows a simple release popup instead of the shockwave save/damage template, closed via Done', async () => {
        quiveringPalmHandler.applyRelease.mockResolvedValue(RELEASE_RESULT);

        const handleClose = vi.fn();
        render(<QuiveringPalmModal {...makeProps({ onClose: handleClose })} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Release the Harmless Vibrations/ }));
        });

        // Release branch: plain description popup, no save/damage content,
        // and the selection prompt is gone.
        await expect(screen.findByText('Vibrations released harmlessly against Goblin1.')).resolves.toBeInTheDocument();
        expect(screen.queryByText(/rolled a .* save/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Full damage/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Half damage/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Vibrations are set in/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(handleClose).toHaveBeenCalledTimes(1);
    });
});
