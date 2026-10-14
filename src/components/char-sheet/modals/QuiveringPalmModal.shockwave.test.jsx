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

// ── Helpers: result payload factory ──

function makeResultPayload(overrides = {}) {
    return {
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
            ...overrides,
        },
    };
}

// ── Tests ──

describe('QuiveringPalmModal - shockwave flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('trigger shockwave flow', () => {
        it('calls applyShockwave with correct arguments when shockwave button is clicked', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload());

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            expect(quiveringPalmHandler.applyShockwave).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Quivering Palm' }),
                expect.objectContaining({ name: 'Monk1' }),
                'test-campaign',
                'Goblin1'
            );
        });

        it('disables buttons while shockwave is loading', async () => {
            let resolveShockwave;
            quiveringPalmHandler.applyShockwave.mockReturnValue(
                new Promise((resolve) => { resolveShockwave = resolve; })
            );

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            const shockwaveBtn = screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ });
            const releaseBtn = screen.getByRole('button', { name: /Release the Harmless Vibrations/ });
            expect(shockwaveBtn.disabled).toBe(true);
            expect(releaseBtn.disabled).toBe(true);

            await act(async () => {
                resolveShockwave(makeResultPayload({
                    payload: { ...makeResultPayload().payload, success: true, rawDamage: 45, finalDamage: 22, diceDisplay: ' (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)' },
                }));
            });
        });

        it('shows Failure result screen when save fails', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ success: false }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText('Failure')).toBeInTheDocument();
            });
        });

        it('shows Success result screen when save succeeds', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ success: true }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText('Success')).toBeInTheDocument();
            });
        });

        it('shows "Half damage" in result text when save succeeds', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ success: true }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText(/Half damage/)).toBeInTheDocument();
            });
        });

        it('shows "Full damage" in result text when save fails', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ success: false }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText(/Full damage/)).toBeInTheDocument();
            });
        });

        it('displays the save DC in result text', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ saveDc: 16 }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText(/DC 16/)).toBeInTheDocument();
            });
        });

        it('displays the damage type in result text', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ damageType: 'Psychic' }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText(/Psychic damage/)).toBeInTheDocument();
            });
        });

        it('displays the final damage number in result text', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ finalDamage: 42 }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                const strongs = screen.getAllByRole('strong');
                expect(strongs[1]).toHaveTextContent('42');
            });
        });

        it('shows a "Done" button in the result screen', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload());

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
        });

        it('calls onClose when Done button is clicked in result screen', async () => {
            const { handleClose } = renderModal();

            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ success: true }));

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

    // ── Custom action name ──

    describe('custom action name', () => {
        it('displays the custom action name in the header', () => {
            renderModal({ action: makeAction({ name: 'My Quivering Palm' }) });
            expect(screen.getByText('My Quivering Palm')).toBeInTheDocument();
        });

        it('displays the custom action name in the result screen', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({
                payload: { ...makeResultPayload().payload, name: 'My Quivering Palm' },
            }));

            renderModal({ action: makeAction({ name: 'My Quivering Palm' }) });

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText('My Quivering Palm')).toBeInTheDocument();
            });
        });
    });

    // ── Different save types ──

    describe('save type display', () => {
        it('uses saveType from result payload when available', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ saveType: 'WIS' }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText(/WIS/)).toBeInTheDocument();
            });
        });

        it('defaults to CON when saveType is not in result payload', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ saveType: undefined }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText(/CON/)).toBeInTheDocument();
            });
        });
    });

    // ── Dice display ──

    describe('dice display', () => {
        it('displays dice rolls in the result', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload());

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText(/3, 5, 7, 9, 11, 13, 15, 7/)).toBeInTheDocument();
            });
        });

        it.each([
            ['', 'empty string'],
            [undefined, 'undefined'],
        ])('shows "?" when diceDisplay is %s (%s)', async (diceDisplayVal) => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ diceDisplay: diceDisplayVal }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText(/\?/)).toBeInTheDocument();
            });
        });

        it('strips outer parentheses from diceDisplay when rendering', async () => {
            quiveringPalmHandler.applyShockwave.mockResolvedValue(makeResultPayload({ diceDisplay: '(1, 2, 3)' }));

            renderModal();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Trigger the Lethal Shockwave/ }));
            });

            await waitFor(() => {
                expect(screen.getByText(/1, 2, 3/)).toBeInTheDocument();
            });
        });
    });
});
