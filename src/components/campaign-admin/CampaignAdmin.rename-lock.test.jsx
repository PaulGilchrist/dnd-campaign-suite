// @maintained-by-ai
/**
 * Campaign-lock gating of the Rename Campaign affordance in CampaignAdmin:
 * when GET /api/server-config reports campaignLocked (dev:locked mode), the
 * button renders disabled with a visible note and the modal cannot open —
 * otherwise a rename strands mid-flow (the revert PUT targets the renamed
 * folder and the server's CAMPAIGN_LOCK middleware 403s it opaquely).
 * Unlocked, the button behaves exactly as before (modal opens on click).
 *
 * The full rename-modal flow lives in CampaignAdmin.rename.test.jsx; this
 * file only pins the lock legs. fetch is inert globally (src/test/setup.js)
 * so the default fail-open leg needs no override beyond the explicit mock.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';

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
    const props = {
        campaignName,
        theme: 'dark',
        toggleTheme: vi.fn(),
        onRenameCampaign: vi.fn(),
    };
    render(<CampaignAdmin {...props} />);
    return props;
}

const renameButton = () => screen.getByRole('button', { name: 'Rename Campaign' });

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CampaignAdmin - Rename Campaign lock gating', () => {
    it('disables Rename Campaign with a visible note and blocks the modal while the campaign is locked', async () => {
        mockServerConfig({ campaignLocked: true, lockedCampaign: CAMPAIGN });
        const props = renderAdmin();

        await waitFor(() => expect(renameButton()).toBeDisabled());
        expect(screen.getByText('Disabled while campaign is locked')).toBeInTheDocument();

        fireEvent.click(renameButton());
        expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
        expect(props.onRenameCampaign).not.toHaveBeenCalled();
    });

    it('keeps Rename Campaign enabled and opens the modal when the server reports no lock', async () => {
        mockServerConfig({ campaignLocked: false });
        renderAdmin();

        await waitFor(() => expect(renameButton()).toBeEnabled());
        expect(screen.queryByText('Disabled while campaign is locked')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();

        fireEvent.click(renameButton());
        expect(screen.getByLabelText('New Campaign Name')).toBeInTheDocument();
    });

    it('fails open: a failed config fetch leaves Rename Campaign enabled (unlocked behavior)', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
        renderAdmin();

        // Fail-open default: enabled immediately, and still enabled after the
        // failed config request settles.
        expect(renameButton()).toBeEnabled();
        await waitFor(() => expect(renameButton()).toBeEnabled());
        expect(screen.queryByText('Disabled while campaign is locked')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();

        fireEvent.click(renameButton());
        expect(screen.getByLabelText('New Campaign Name')).toBeInTheDocument();
    });
});

// Owner ruling 2026-11-02 (rename-QA unblock): a set-form CAMPAIGN_LOCK lets a
// THROWAWAY member (any member but the primary/first entry) rename onto
// another allowlisted name — client mirror of createCampaignRenameGuard. The
// primary stays disabled and off-allowlist destinations are refused in-modal
// with honest copy instead of an opaque 403.
describe('CampaignAdmin - Rename lock gating under a set-form lock', () => {
    const SET_LOCK = 'test-campaign,qa-arena,qa-starter,qa-renamed';

    it('enables Rename for a throwaway member and names the allowlisted destinations', async () => {
        mockServerConfig({ campaignLocked: true, lockedCampaign: SET_LOCK });
        renderAdmin('qa-starter');

        await waitFor(() => expect(renameButton()).toBeEnabled());
        expect(screen.queryByText('Disabled while campaign is locked')).not.toBeInTheDocument();
        expect(screen.getByText(/renames allowed only between the allowlisted campaigns/)).toBeInTheDocument();

        fireEvent.click(renameButton());
        expect(screen.getByLabelText('New Campaign Name')).toBeInTheDocument();
    });

    it('keeps Rename disabled for the PRIMARY lock entry', async () => {
        mockServerConfig({ campaignLocked: true, lockedCampaign: SET_LOCK });
        renderAdmin(CAMPAIGN);

        await waitFor(() => expect(renameButton()).toBeDisabled());
        expect(screen.getByText('Disabled while campaign is locked')).toBeInTheDocument();
    });

    it('refuses an off-allowlist destination in-modal without calling the rename handler', async () => {
        mockServerConfig({ campaignLocked: true, lockedCampaign: SET_LOCK });
        const props = renderAdmin('qa-starter');
        await waitFor(() => expect(renameButton()).toBeEnabled());
        fireEvent.click(renameButton());

        fireEvent.change(screen.getByLabelText('New Campaign Name'), { target: { value: 'Frostfall II' } });
        fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

        expect(await screen.findByText(/you can only rename to an allowlisted name/)).toBeInTheDocument();
        expect(props.onRenameCampaign).not.toHaveBeenCalled();
    });

    it('submits an allowlisted destination through to the rename handler', async () => {
        mockServerConfig({ campaignLocked: true, lockedCampaign: SET_LOCK });
        const props = renderAdmin('qa-starter');
        await waitFor(() => expect(renameButton()).toBeEnabled());
        fireEvent.click(renameButton());

        fireEvent.change(screen.getByLabelText('New Campaign Name'), { target: { value: 'qa-renamed' } });
        fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

        await waitFor(() => expect(props.onRenameCampaign).toHaveBeenCalledWith('qa-renamed'));
    });
});
