// @maintained-by-ai
/**
 * Toolbar "Rollback to Snapshot" modal affordance lane (improvement
 * admin-rollback-zero-count-blind-confirm): opening the modal REFRESHES
 * GET /admin/snapshots, the warning copy then names the LATEST snapshot's
 * exact filename + a human relative age (no more anonymous "the latest
 * snapshot" — a stale 2-day-old zip once silently replaced fresher data),
 * and Confirm is natively DISABLED — with a visible note — while the list
 * loads, when it fails to load, and at ZERO snapshots, so no destructive
 * POST can be fired blind. The legacy body-less POST semantics and the
 * per-row Restore lane are pinned in the sibling files.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';
const ROLLBACK_BTN = 'Rollback to Snapshot';
const ROLLBACK_URL = `/api/campaigns/${CAMPAIGN}/admin/rollback`;
const LIST_URL = `/api/campaigns/${CAMPAIGN}/admin/snapshots`;

const NEWEST_ZIP = 'test-campaign-2026-10-28T14-17-51-284.zip';
const OLDER_ZIP = 'test-campaign-2026-10-20T09-00-00-000.zip';

const hoursAgo = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();
const snapshot = (filename, hours) => ({ filename, size: 1024, timestamp: hoursAgo(hours) });

const jsonResponse = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
const neverSettles = () => new Promise(() => {});

function stubFetch({ snapshots } = {}) {
    const fetchMock = vi.fn((url) => {
        let result;
        if (url === LIST_URL) {
            result = snapshots ?? jsonResponse({ snapshots: [] });
        } else if (url === ROLLBACK_URL) {
            result = jsonResponse({ message: 'Rollback complete', restored: NEWEST_ZIP });
        } else {
            result = jsonResponse({});
        }
        return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const renderAdmin = () => render(
    <CampaignAdmin
        campaignName={CAMPAIGN}
        onBack={vi.fn()}
        theme="dark"
        toggleTheme={vi.fn()}
        onRenameCampaign={vi.fn()}
    />
);

const listGets = (fetchMock) =>
    fetchMock.mock.calls.filter(([u, opts]) => u === LIST_URL && !opts?.method).length;

const postCalls = (fetchMock) =>
    fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST');

const confirmBtn = () => screen.getByRole('button', { name: 'Confirm' });

beforeEach(() => {
    vi.stubGlobal('location', { href: 'http://localhost/', reload: vi.fn() });
    sessionStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
});

describe('CampaignAdmin - toolbar Rollback modal', () => {
    it('refetches the snapshot list when the modal opens', async () => {
        const fetchMock = stubFetch();
        renderAdmin();
        await waitFor(() => expect(listGets(fetchMock)).toBe(1));

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));

        await waitFor(() => expect(listGets(fetchMock)).toBe(2));
        expect(postCalls(fetchMock)).toHaveLength(0);
    });

    it('names the LATEST snapshot filename + human relative age once the list lands', async () => {
        stubFetch({
            snapshots: jsonResponse({
                snapshots: [snapshot(NEWEST_ZIP, 48), snapshot(OLDER_ZIP, 240)],
            }),
        });
        renderAdmin();

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));

        const warning = await screen.findByText(/overwrite ALL current campaign data/);
        await waitFor(() => expect(warning.textContent).toContain(NEWEST_ZIP));
        expect(warning.textContent).toContain('(2 days old)');
        expect(warning.textContent).not.toContain(OLDER_ZIP);
        expect(warning.textContent).not.toMatch(/the latest snapshot/i);
        await waitFor(() => expect(confirmBtn()).toBeEnabled());
    });

    it('keeps Confirm disabled with a loading note while the list is in flight', async () => {
        const fetchMock = stubFetch({ snapshots: neverSettles() });
        renderAdmin();

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));

        expect(screen.getByRole('heading', { name: 'Rollback Campaign' })).toBeInTheDocument();
        expect(screen.getByText('Loading the snapshot list…')).toBeInTheDocument();
        expect(confirmBtn()).toBeDisabled();
        fireEvent.click(confirmBtn());
        await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(0));
    });

    it('at ZERO snapshots shows a visible "No snapshots exist" note and disables Confirm — the click sends nothing', async () => {
        const fetchMock = stubFetch({ snapshots: jsonResponse({ snapshots: [] }) });
        renderAdmin();

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));

        const note = await screen.findByText('No snapshots exist');
        expect(note).toHaveClass('admin-snapshots-empty');
        expect(screen.getByText(/nothing to roll back to/i)).toBeInTheDocument();
        expect(confirmBtn()).toBeDisabled();
        fireEvent.click(confirmBtn());

        await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(0));
        expect(screen.queryByText('Rolling back...')).not.toBeInTheDocument();
        expect(window.location.reload).not.toHaveBeenCalled();
    });

    it('a failed snapshot list keeps Confirm disabled behind an honest error note', async () => {
        const fetchMock = stubFetch({ snapshots: jsonResponse({ error: 'boom' }, false) });
        renderAdmin();

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));

        const note = await screen.findByText(/could not load the snapshot list/i);
        expect(note).toHaveClass('admin-snapshots-empty');
        expect(confirmBtn()).toBeDisabled();
        fireEvent.click(confirmBtn());
        await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(0));
    });

    it('Cancel dismisses the modal without POSTing even once snapshots are known', async () => {
        const fetchMock = stubFetch({ snapshots: jsonResponse({ snapshots: [snapshot(NEWEST_ZIP, 2)] }) });
        renderAdmin();

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
        await waitFor(() => expect(confirmBtn()).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('heading', { name: 'Rollback Campaign' })).not.toBeInTheDocument();
        await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(0));
    });
});
