// @maintained-by-ai
/**
 * Regenerate-Adventure gate of CampaignAdmin (starter lane).
 *
 * Migrated off the native window.confirm onto the shared DeleteConfirmModal
 * role="dialog" tier (backlog 2026-11-04 CS) — mirrors the campaign-delete
 * (CO) and friendly-fire (CQ) precedents. OWNED here: open → honest copy →
 * Cancel fully inert / Confirm runs the existing orchestrator once and shows
 * the pre-existing success/error status. The dialog chrome/focus trap itself
 * stays pinned by common/DeleteConfirmModal.test.jsx.
 *
 * The starter-seed/regenerate services are mocked at the module boundary, so
 * no regeneration can ever reach a live server; only test-campaign is passed.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';
import FirstSessionChecklist from '../campaign-starter/FirstSessionChecklist.jsx';
import { loadStarterSeed } from '../../services/campaign/starterSeedService.js';
import { regenerateAdventure } from '../../services/campaign/seededCampaign.js';

// Non-null seed by default so the Regenerate card mounts (starter campaign);
// the modal tests need the trigger button to exist.
vi.mock('../../services/campaign/starterSeedService.js', () => ({
    loadStarterSeed: vi.fn(async () => ({ entities: { dungeonTitle: 'Old Dungeon' } })),
}));
vi.mock('../../services/campaign/seededCampaign.js', () => ({
    regenerateAdventure: vi.fn(async () => ({ dungeonTitle: 'New Dungeon' })),
}));
// The checklist rides the ONE shared SSE client — inert here (no EventSource
// in jsdom), the sync lane is pinned in FirstSessionChecklist.sse-sync.test.jsx.
vi.mock('../../services/ui/sseClient.js', () => ({
    subscribeToSSE: vi.fn(() => () => {}),
}));

const CAMPAIGN = 'test-campaign';

// The retired native confirm copy, VERBATIM minus the "Continue?" tail the
// modal's explicit buttons answer (pinned so a paraphrase fails).
const REGEN_COPY = `Regenerate the adventure in "${CAMPAIGN}"? A brand-new dungeon with fresh monsters and treasure replaces the current one, and the portal and main quest are re-pointed at it. The settlement, party, and log stay.`;

const WAIT_OPTIONS = { timeout: 2000 };

const renderAdmin = (overrides = {}) =>
    render(
        <CampaignAdmin
            campaignName={CAMPAIGN}
            theme="dark"
            toggleTheme={vi.fn()}
            onRenameCampaign={vi.fn()}
            isLocalhost
            {...overrides}
        />
    );

describe('CampaignAdmin - Regenerate Adventure confirm modal', () => {
    beforeEach(() => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        vi.spyOn(window, 'alert').mockReturnValue(false);
        loadStarterSeed.mockClear();
        regenerateAdventure.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // The seed probe resolves async, so the card/button appear after mount.
    const openRegenerateModal = async () => {
        renderAdmin();
        fireEvent.click(
            await screen.findByRole('button', { name: 'Regenerate Adventure' }, WAIT_OPTIONS)
        );
        return screen.getByRole('dialog', { name: 'Regenerate Adventure' });
    };

    it('opens a labelled role=dialog with the honest copy and no native confirm', async () => {
        const dialog = await openRegenerateModal();

        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveTextContent(REGEN_COPY);
        expect(
            within(dialog).getAllByRole('button').map((b) => b.textContent.trim())
        ).toEqual(['Cancel', 'Yes, Regenerate']);
        // The whole point of the migration: zero native dialogs on this path.
        expect(window.confirm).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
        // Merely opening the gate mutates nothing.
        expect(regenerateAdventure).not.toHaveBeenCalled();
        expect(document.querySelector('.admin-status')).toBeNull();
    });

    it('Cancel closes the dialog and fires no regenerate request', async () => {
        const dialog = await openRegenerateModal();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog', { name: 'Regenerate Adventure' })).not.toBeInTheDocument();
        expect(regenerateAdventure).not.toHaveBeenCalled();
        expect(document.querySelector('.admin-status')).toBeNull();
        expect(window.confirm).not.toHaveBeenCalled();
    });

    it('Confirm closes the dialog, regenerates once, and shows the success status', async () => {
        const dialog = await openRegenerateModal();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Regenerate' }));

        expect(screen.queryByRole('dialog', { name: 'Regenerate Adventure' })).not.toBeInTheDocument();
        const status = await screen.findByText(/New adventure rolled: New Dungeon/, {}, WAIT_OPTIONS);
        expect(status.closest('.admin-status')).toHaveClass('admin-status--success');
        // The generic StatusDisplay must be announced by assistive tech
        // (backlog 2026-11-04 CU: it rendered visually only, unlike the
        // sibling post-import banner).
        expect(status).toHaveAttribute('role', 'status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        // Exactly one orchestrator call for this campaign (same API lane as
        // the retired native-confirm flow — the service owns the requests).
        expect(regenerateAdventure).toHaveBeenCalledTimes(1);
        expect(regenerateAdventure).toHaveBeenCalledWith(CAMPAIGN);
        // The success branch re-reads the seed (mount probe + post-regen
        // refresh) so the card names the new dungeon.
        expect(loadStarterSeed.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(window.confirm).not.toHaveBeenCalled();
    });

    it('shows the error status when the regeneration rejects', async () => {
        regenerateAdventure.mockRejectedValueOnce(new Error('Regen refused by server'));
        const dialog = await openRegenerateModal();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Regenerate' }));

        const status = await screen.findByText('Regen refused by server', {}, WAIT_OPTIONS);
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(status).toHaveAttribute('role', 'status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        expect(regenerateAdventure).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Regenerate Adventure' })).toBeEnabled();
        expect(window.confirm).not.toHaveBeenCalled();
    });

    it('is GM-only: non-localhost visitors never get a trigger to click', async () => {
        renderAdmin({ isLocalhost: false });

        // Card copy still renders (starter info) but with no button to arm.
        expect(
            await screen.findByRole('heading', { level: 3, name: 'Regenerate Adventure' }, WAIT_OPTIONS)
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Regenerate Adventure' })).not.toBeInTheDocument();
    });

    // Backlog 2026-11-04 CU: on the live starter Admin page the persistent
    // checklist aside renders UNDER the Admin view, and its "Admin → Regenerate"
    // deep-link step used to share the /Regenerate/i accessible-name token with
    // the primary ct-btn — a `.first()` role query could silently land on the
    // step (a confusing no-op view switch). These tests pin the disambiguation.
    describe('query disambiguation vs the first-session checklist', () => {
        const FULL_SEED = {
            entities: {
                settlement: 'Thornhollow',
                dungeonTitle: 'Old Dungeon',
                quests: ['Starter — Into the Ruins', 'Starter — Trouble in Town', 'Starter — The Spoils'],
                encounters: ['Dungeon Wave 1', 'Dungeon Wave 2', 'Dungeon Wave 3'],
            },
        };

        const renderAdminWithChecklist = async () => {
            loadStarterSeed.mockResolvedValue(FULL_SEED);
            const onNavigate = vi.fn();
            render(
                <>
                    <CampaignAdmin
                        campaignName={CAMPAIGN}
                        theme="dark"
                        toggleTheme={vi.fn()}
                        onRenameCampaign={vi.fn()}
                        isLocalhost
                    />
                    <FirstSessionChecklist campaignName={CAMPAIGN} onNavigate={onNavigate} isLocalhost />
                </>
            );
            // Both the Admin card AND the checklist step resolve from the seed.
            await screen.findByTestId('regenerate-adventure-btn', {}, WAIT_OPTIONS);
            await screen.findByTestId('starter-step-regenerate', {}, WAIT_OPTIONS);
            return onNavigate;
        };

        it('a /Regenerate Adventure/ role query resolves UNAMBIGUOUSLY to the ct-btn', async () => {
            await renderAdminWithChecklist();

            const matches = screen.getAllByRole('button', { name: /Regenerate Adventure/i });
            expect(matches).toHaveLength(1);
            expect(matches[0]).toHaveClass('ct-btn');
            expect(matches[0]).toHaveAttribute('data-testid', 'regenerate-adventure-btn');
            // A .first()-style query therefore lands on the primary action, and
            // clicking it opens the modal (role=dialog, labelledby pinned below).
            fireEvent.click(matches[0]);
            expect(await screen.findByRole('dialog', { name: 'Regenerate Adventure' }, WAIT_OPTIONS)).toBeInTheDocument();
        });

        it('no /Regenerate/i role query can land on the checklist step', async () => {
            await renderAdminWithChecklist();

            // The deep-link step's accessible name no longer carries the
            // "Regenerate" token at all…
            const step = screen.getByTestId('starter-step-regenerate');
            expect(step.getAttribute('aria-label')).not.toMatch(/Regenerate/i);
            expect(step.getAttribute('aria-label')).toMatch(/Open Campaign Admin to re-roll the adventure/);
            // …so /Regenerate/i matches ONLY the primary ct-btn (+ the modal's
            // own "Yes, Regenerate" once open, which lives inside the dialog).
            expect(screen.getAllByRole('button', { name: /Regenerate/i })).toEqual([
                screen.getByTestId('regenerate-adventure-btn'),
            ]);
            // Visible label is unchanged for sighted users.
            expect(step).toHaveTextContent(/Admin → Regenerate \(keeps Thornhollow\)/);
        });

        it('the checklist step still deep-links the Admin view', async () => {
            const onNavigate = await renderAdminWithChecklist();

            fireEvent.click(screen.getByTestId('starter-step-regenerate'));
            expect(onNavigate).toHaveBeenCalledWith('campaignRepair');
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(regenerateAdventure).not.toHaveBeenCalled();
        });
    });
});
