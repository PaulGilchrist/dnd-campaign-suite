// @maintained-by-ai
/* Lane: renderPopup's "Arm a target" deep-link footer (backlog 2026-11-24
 * run BA). The sheet's no-target refusal popup value carries
 * { html, armTargetName } — the host keeps the refusal copy byte-identical
 * and adds ONE affordance: an `Arm a target` button that closes the popup,
 * arms the per-client focus request for the ATTACKER's exact board row and
 * navigates via the same onViewInitiative callback lane Encounter Builder's
 * Join Encounter uses. The click writes NO game state — never targetName. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { renderPopup } from './CharSheet.modals.jsx';
import { consumePendingArmTarget } from '../../services/ui/armTargetSignal.js';

const REFUSAL_HTML = '<div class="mc-no-target-refusal"><h3>No Target</h3><p>Korgath cannot use Greataxe — no target is armed on Korgath\'s initiative card. Arm a target with the Target select on the initiative card. No attack rolled, nothing spent.</p></div>';

function renderArmPopup(overrides = {}) {
    const setPopupHtml = vi.fn();
    const onViewInitiative = vi.fn();
    render(<div>{renderPopup({
        popupHtml: { html: REFUSAL_HTML, armTargetName: 'Korgath' },
        setPopupHtml,
        isLocalhost: true,
        playerStats: { name: 'Korgath' },
        campaignName: 'test-campaign',
        characters: [],
        popupHandlers: {},
        onViewInitiative,
        ...overrides,
    })}</div>);
    return { setPopupHtml, onViewInitiative };
}

afterEach(() => {
    // Drain any armed focus request so module state never leaks across specs.
    consumePendingArmTarget('Korgath');
});

describe('renderPopup — unarmed-refusal "Arm a target" affordance', () => {
    it('the refusal popup shows the honest copy AND the Arm a target button', () => {
        renderArmPopup();
        expect(screen.getByText('No Target')).toBeInTheDocument();
        expect(screen.getByText(/no target is armed on Korgath's initiative card/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Arm a target' })).toBeInTheDocument();
        // The shared Done dismiss tier of the popup is untouched.
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('clicking arms the focus request, navigates, closes — writes no game state', () => {
        const { setPopupHtml, onViewInitiative } = renderArmPopup();

        fireEvent.click(screen.getByRole('button', { name: 'Arm a target' }));

        // Popup closed, Initiative view requested, and the ATTACKER's exact
        // board row holds the single-shot focus request…
        expect(setPopupHtml).toHaveBeenCalledWith(null);
        expect(onViewInitiative).toHaveBeenCalledTimes(1);
        expect(consumePendingArmTarget('Korgath')).toBe(true);
        expect(consumePendingArmTarget('Korgath')).toBe(false);
        // …and the only writers were the local popup state + the local view
        // callback: no target select, no fetch, no runtime store touched.
    });

    it('a plain {html} popup (no armTargetName) keeps its chrome byte-unchanged', () => {
        const { setPopupHtml, onViewInitiative } = renderArmPopup({
            popupHtml: { html: REFUSAL_HTML },
        });
        expect(screen.getByText('No Target')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Arm a target' })).toBeNull();

        // Dismissal law for the plain face still holds.
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(setPopupHtml).toHaveBeenCalledWith(null);
        expect(onViewInitiative).not.toHaveBeenCalled();
        expect(consumePendingArmTarget('Korgath')).toBe(false);
    });
});
