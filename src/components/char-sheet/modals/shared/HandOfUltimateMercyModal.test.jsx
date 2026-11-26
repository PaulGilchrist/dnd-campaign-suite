// @maintained-by-ai 2026-11-14
// HandOfUltimateMercyModal — the in-sheet corpse chooser host (backlog
// 2026-11-14 NP improve). Pins the HoH-picker-parity contract: the SHARED
// SecondaryTargetModal renders inside the borrowed .short-rest-modal dialog
// tier (role/aria-modal/aria-labelledby → the chooser's own .sp-header title,
// same chrome as the Hand of Healing picker — no new modal/CSS family), the
// decline control is the zero-spend `Cancel` label law (never `Skip`, never
// a commit route; Escape rides the same dismiss), a refusal from
// confirmResurrect keeps the picker open with the inline note and NEVER
// resolves, and a success forwards the popup payload to onResolved so the
// host can close the chooser and surface the automation_info popup.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../services/maps/spellOverlayService.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, getTargetMapStatuses: vi.fn().mockResolvedValue(null) };
});

// The rows' liveHp tier subscribes through useRuntimeValue; the store seam is
// inert here (zero game-state writes are asserted against these mocks).
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(() => undefined),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import HandOfUltimateMercyModal from './HandOfUltimateMercyModal.jsx';

const CAMPAIGN = 'test-campaign';

const corpseTargets = [
    { name: 'CorpseAlly', type: 'player', currentHp: 0, maxHp: 90 },
    { name: 'DeadRug', type: 'npc', currentHp: 0, maxHp: 21 },
];

function makeProps(overrides = {}) {
    return {
        featureName: 'Hand of Ultimate Mercy',
        casterName: 'Disciplined_Monk',
        costAmount: 5,
        creatureTargets: corpseTargets,
        confirmResurrect: vi.fn().mockResolvedValue({
            popup: { type: 'automation_info', name: 'Hand of Ultimate Mercy', description: 'Returns to life with 31 HP. Expended 5 Focus Points.' },
        }),
        campaignName: CAMPAIGN,
        onResolved: vi.fn(),
        onClose: vi.fn(),
        ...overrides,
    };
}

const confirmButton = () => screen.getByRole('button', { name: /Revive/ });
const selectCorpse = () => fireEvent.click(document.querySelector('.secondary-target-row'));

describe('HandOfUltimateMercyModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    });

    it('renders the shared chooser in the HoH-parity dialog tier with corpse-only rows', () => {
        render(<HandOfUltimateMercyModal {...makeProps()} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog.querySelector('.sp-header')).toHaveAttribute('id', 'hand-of-ultimate-mercy-target-modal-title');
        expect(dialog).toHaveAttribute('aria-labelledby', 'hand-of-ultimate-mercy-target-modal-title');
        expect(dialog.querySelector('.sp-header').textContent).toContain('Choose corpse for Hand of Ultimate Mercy');

        const radios = document.querySelectorAll('input[name="secondaryTarget"]');
        expect(radios).toHaveLength(2);
        expect(radios[0]).toHaveAccessibleName('Select CorpseAlly, 0 of 90 HP');
        expect(radios[1]).toHaveAccessibleName('Select DeadRug, 0% HP');
        expect(screen.getByText(/Costs 5 Focus Points\./)).toBeInTheDocument();
    });

    it('Cancel is a pure zero-spend dismiss: onClose only, never confirm/onResolved, no store write', () => {
        const confirmResurrect = vi.fn();
        const props = makeProps({ confirmResurrect });
        render(<HandOfUltimateMercyModal {...props} />);

        selectCorpse(); // a selection must not change the dismiss semantics
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(confirmResurrect).not.toHaveBeenCalled();
        expect(props.onResolved).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
        // The shared chooser's Skip face is relabeled — no second decline route.
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    });

    it('Escape dismisses zero-spend through the same onClose lane', () => {
        const props = makeProps();
        render(<HandOfUltimateMercyModal {...props} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.confirmResurrect).not.toHaveBeenCalled();
        expect(props.onResolved).not.toHaveBeenCalled();
    });

    it('confirm commits the selected corpse once and forwards the success popup to onResolved', async () => {
        const props = makeProps();
        render(<HandOfUltimateMercyModal {...props} />);

        expect(confirmButton()).toBeDisabled();
        selectCorpse();
        expect(confirmButton()).not.toBeDisabled();
        fireEvent.click(confirmButton());

        await waitFor(() => expect(props.onResolved).toHaveBeenCalledTimes(1));
        expect(props.confirmResurrect).toHaveBeenCalledTimes(1);
        expect(props.confirmResurrect).toHaveBeenCalledWith('CorpseAlly');
        expect(props.onResolved).toHaveBeenCalledWith(expect.objectContaining({
            type: 'automation_info',
            description: 'Returns to life with 31 HP. Expended 5 Focus Points.',
        }));
    });

    it('a commit refusal keeps the picker open with the inline note and never resolves', async () => {
        const props = makeProps({ confirmResurrect: vi.fn().mockResolvedValue({ refusal: 'CorpseAlly is not at 0 Hit Points.' }) });
        render(<HandOfUltimateMercyModal {...props} />);

        selectCorpse();
        fireEvent.click(confirmButton());

        await waitFor(() => {
            expect(screen.getByText('CorpseAlly is not at 0 Hit Points.')).toHaveClass('healing-restriction-note');
        });
        expect(props.onResolved).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    });
});
