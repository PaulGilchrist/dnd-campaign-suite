// @maintained-by-ai 2026-11-21
/**
 * Campaign-lock DISCLOSURE (not gating) of the Delete Campaign affordance in
 * CampaignAdmin: when GET /api/server-config reports campaignLocked, the
 * delete lane renders a visible plain-English note (admin-lock-note, the
 * rename note's style) disclosing the typed-name delete as the intentional
 * escape hatch — while the button stays ENABLED (owner ruling 2026-11-22:
 * disclose, do NOT gate). Unlocked, the note renders nowhere.
 *
 * Mirrors CampaignAdmin.rename-lock.test.jsx (same config-fetch mocking).
 * The full delete-modal flow lives in CampaignAdmin.delete.test.jsx; this
 * file only pins the lock-note legs — the modal is opened and CANCELLED,
 * never confirmed (a delete must never complete in a test).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';
const NOTE = "Deletable while locked — typing the campaign's full name is the intentional escape hatch";

function mockServerConfig(config) {
    const fetchMock = vi.fn(async (url) => ({
        ok: true,
        status: 200,
        json: async () => {
            if (String(url).includes('/api/server-config')) return config;
            return { snapshots: [] };
        },
    }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);
    return fetchMock;
}

function renderAdmin(campaignName = CAMPAIGN) {
    render(<CampaignAdmin
        campaignName={campaignName}
        theme="dark"
        toggleTheme={vi.fn()}
        onRenameCampaign={vi.fn()}
    />);
}

const deleteButton = () => screen.getByRole('button', { name: 'Delete Campaign' });

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CampaignAdmin - Delete Campaign lock disclosure', () => {
    it('shows the escape-hatch note while locked and keeps the button enabled (modal opens, Cancel closes)', async () => {
        mockServerConfig({ campaignLocked: true, lockedCampaign: CAMPAIGN });
        renderAdmin();

        await waitFor(() => expect(screen.getByText(NOTE)).toBeInTheDocument());
        expect(deleteButton()).toBeEnabled();

        fireEvent.click(deleteButton());
        expect(screen.getByText(/Type the exact campaign name to confirm deletion/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByText(/Type the exact campaign name to confirm deletion/)).not.toBeInTheDocument();
    });

    it('renders no lock note when the server reports no lock, button stays enabled', async () => {
        mockServerConfig({ campaignLocked: false });
        renderAdmin();

        await waitFor(() => expect(deleteButton()).toBeEnabled());
        expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    });

    it('fails open: a failed config fetch renders no lock note', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
        renderAdmin();

        await waitFor(() => expect(deleteButton()).toBeEnabled());
        expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    });

    it('shows the note for a throwaway member under a set-form lock too', async () => {
        mockServerConfig({ campaignLocked: true, lockedCampaign: `${CAMPAIGN},qa-arena,qa-starter` });
        renderAdmin('qa-starter');

        await waitFor(() => expect(screen.getByText(NOTE)).toBeInTheDocument());
        expect(deleteButton()).toBeEnabled();
    });
});
