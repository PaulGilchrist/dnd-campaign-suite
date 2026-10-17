// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuiveringPalmModal from './QuiveringPalmModal.jsx';

// The component imports ONLY the handler + CSS — mock nothing else.
// Dispatch/result-template coverage lives in the sibling .shockwave and
// .release test files; this lane owns initial render, button visibility,
// close paths, and Done-after-shockwave-result.
vi.mock('../../../services/automation/handlers/class-monk/quiveringPalmHandler.js', () => ({
    applyShockwave: vi.fn(),
    applyRelease: vi.fn(),
}));

import * as quiveringPalmHandler from '../../../services/automation/handlers/class-monk/quiveringPalmHandler.js';

// ── Fixtures ──

const ACTION = {
    name: 'Quivering Palm',
    automation: { type: 'quivering_palm', damageExpression: '10d12', damageType: 'Force', saveDc: 15, saveAbility: 'WIS' },
};
const PLAYER_STATS = { name: 'Monk1' };

function renderModal(props = {}) {
    const onClose = vi.fn();
    render(
        <QuiveringPalmModal
            action={ACTION}
            playerStats={PLAYER_STATS}
            campaignName="test-campaign"
            targetName="Goblin1"
            isRelease={false}
            onClose={onClose}
            {...props}
        />
    );
    return { onClose };
}

// ── Tests ──

describe('QuiveringPalmModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        // isRelease, action name, target, exact set of buttons the mode must show
        [false, 'Quivering Palm', 'Goblin1', ['Trigger the Lethal Shockwave', 'Release the Harmless Vibrations', 'Cancel']],
        [true, 'My Quivering Palm', 'Dragon', ['Release the Harmless Vibrations', 'Cancel']],
    ])(
        'renders header, target prompt, and exactly the mode-appropriate buttons (isRelease: %s)',
        (isRelease, name, target, buttons) => {
            renderModal({ isRelease, action: { ...ACTION, name }, targetName: target });

            expect(screen.getByText(name)).toBeInTheDocument();
            expect(screen.getByText(/Vibrations are set in/)).toBeInTheDocument();
            expect(screen.getByText(target)).toBeInTheDocument();

            // Exact button set: each expected button is present and there are
            // no extras (guards the shockwave button's absence in release-only).
            buttons.forEach((label) => {
                expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
            });
            expect(screen.getAllByRole('button')).toHaveLength(buttons.length);
        }
    );

    it.each([false, true])(
        'Cancel closes the modal (isRelease: %s)',
        (isRelease) => {
            const { onClose } = renderModal({ isRelease });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        }
    );

    it.each(['.sp-overlay', '.sp-modal'])(
        'clicking the %s background never closes the modal',
        (selector) => {
            const { onClose } = renderModal();
            fireEvent.click(document.querySelector(selector));
            expect(onClose).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        }
    );

    it('Done closes the modal after a shockwave result screen', async () => {
        quiveringPalmHandler.applyShockwave.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                success: false,
                saveType: 'CON',
                saveDc: 15,
                rawDamage: 60,
                finalDamage: 60,
                damageExpression: '10d12',
                damageType: 'Force',
                diceDisplay: ' (3, 5, 7)',
            },
        });

        const { onClose } = renderModal();
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
        });

        // Result screen replaces the selection prompt without closing itself.
        await expect(screen.findByRole('button', { name: 'Done' })).resolves.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
