// @maintained-by-ai
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuiveringPalmModal from './QuiveringPalmModal.jsx';

// The component imports ONLY the handler + CSS — mock nothing else.
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

// Shockwave result payload — only fields the result template consumes.
function shockwaveResult(overrides = {}) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Quivering Palm',
            automationType: 'quivering_palm',
            success: false,
            saveType: 'CON',
            saveDc: 15,
            rawDamage: 60,
            finalDamage: 60,
            damageExpression: '10d12',
            damageType: 'Force',
            diceDisplay: ' (3, 5, 7, 9, 11, 13, 15, 7)',
            ...overrides,
        },
    };
}

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

async function clickShockwave() {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
    });
}

// ── Tests ──

describe('QuiveringPalmModal - shockwave flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('dispatches applyShockwave with the action, monk stats, campaign and target', async () => {
        quiveringPalmHandler.applyShockwave.mockResolvedValue(shockwaveResult());

        renderModal();
        await clickShockwave();

        expect(quiveringPalmHandler.applyShockwave).toHaveBeenCalledWith(
            ACTION,
            PLAYER_STATS,
            'test-campaign',
            'Goblin1'
        );
    });

    it('disables both action buttons while the shockwave roll is in flight', async () => {
        let resolveShockwave;
        quiveringPalmHandler.applyShockwave.mockReturnValue(
            new Promise((resolve) => { resolveShockwave = resolve; })
        );

        renderModal();
        await clickShockwave();

        expect(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }).disabled).toBe(true);
        expect(screen.getByRole('button', { name: /Release the Harmless Vibrations/ }).disabled).toBe(true);

        // Let the component settle so its post-await state updates land cleanly.
        await act(async () => {
            resolveShockwave(shockwaveResult({ success: true }));
        });
    });

    it.each([
        // success, payload saveType, expected word, expected damage label
        [true, 'WIS', 'Success', 'Half damage'],
        [false, undefined, 'Failure', 'Full damage'],
    ])(
        'result screen: success=%s shows "%s" save word and "%s" label (saveType %s)',
        async (success, saveType, saveWord, damageLabel) => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(shockwaveResult({
                success,
                saveType,
                saveDc: 16,
                damageType: 'Psychic',
                finalDamage: 42,
            }));

            renderModal();
            await clickShockwave();

            // Save line, including the CON default when saveType is missing.
            const expectedSaveType = saveType || 'CON';
            await waitFor(() => {
                expect(screen.getByText(new RegExp(`Goblin1 rolled a ${expectedSaveType} save \\(DC 16\\)`))).toBeInTheDocument();
            });
            expect(screen.getByText(saveWord)).toBeInTheDocument();
            // Damage line: expression, raw damage, half/full label, final damage, type.
            expect(screen.getByText(/10d12: 60/)).toBeInTheDocument();
            expect(screen.getByText(new RegExp(`${damageLabel}: Psychic damage`))).toBeInTheDocument();
            expect(screen.getByText('42')).toBeInTheDocument();
            // Negative: the opposite outcome's label never appears.
            expect(screen.queryByText(success ? /Full damage/ : /Half damage/)).not.toBeInTheDocument();
        }
    );

    // The span renders its content wrapped in literal parentheses; input
    // parens are stripped first (no double-parens), missing rolls show "?".
    it.each([
        [' (3, 5, 7)', '(3, 5, 7)'],
        ['(1, 2, 3)', '(1, 2, 3)'],
        ['', '(?)'],
        [undefined, '(?)'],
    ])('renders diceDisplay "%s" as "%s"', async (diceDisplay, expected) => {
        quiveringPalmHandler.applyShockwave.mockResolvedValue(shockwaveResult({ diceDisplay }));

        renderModal();
        await clickShockwave();

        await waitFor(() => {
            expect(screen.getByText(expected)).toBeInTheDocument();
        });
    });
});
