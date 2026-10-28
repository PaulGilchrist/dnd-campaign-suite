// @maintained-by-ai
/**
 * Per-snapshot Restore rows of the "Available Snapshots" list: one aria-
 * labelled Restore button per row, the shared .ct-modal-overlay ConfirmModal
 * naming BOTH campaign and exact filename, Cancel/close dismissal that sends
 * nothing, and the confirmed lane — POST {filename} JSON to /admin/rollback,
 * postRestoreNotice handoff, acting-tab reload, plus busy-gating of the row
 * buttons. The legacy top-level "Rollback to Snapshot" button keeps its body-
 * less POST (verified here so the widened route's newest-first lane stays
 * reachable from the UI). Sibling files cover the other flows.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';
const ROLLBACK_URL = `/api/campaigns/${CAMPAIGN}/admin/rollback`;
const LIST_URL = `/api/campaigns/${CAMPAIGN}/admin/snapshots`;

const OLDER_ZIP = 'test-campaign-2026-10-08T10-00-00-000.zip';
const NEWER_ZIP = 'test-campaign-2026-10-09T11-00-00-000.zip';
const SNAPSHOT_LIST = [
    { filename: NEWER_ZIP, size: 2048, timestamp: '2026-10-09T11:00:00.000Z' },
    { filename: OLDER_ZIP, size: 1024, timestamp: '2026-10-08T10:00:00.000Z' },
];

const jsonResponse = (body, ok = true) => ({ ok, json: () => Promise.resolve(body) });
const neverSettles = () => new Promise(() => {});

function stubFetch({ rollback, snapshots } = {}) {
    const fetchMock = vi.fn((url) => {
        let result;
        if (url === LIST_URL) {
            result = snapshots ?? jsonResponse({ snapshots: SNAPSHOT_LIST });
        } else if (url === ROLLBACK_URL) {
            result = rollback ?? jsonResponse({ message: 'Rollback complete', restored: OLDER_ZIP });
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

const postCalls = (fetchMock) =>
    fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST');

const restoreBtn = (filename) => screen.getByRole('button', { name: `Restore "${filename}"` });

beforeEach(() => {
    vi.stubGlobal('location', { href: 'http://localhost/', reload: vi.fn() });
    sessionStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
});

describe('CampaignAdmin - per-snapshot Restore rows', () => {
    it('renders one aria-labelled Restore button per snapshot row', async () => {
        stubFetch();
        renderAdmin();

        await waitFor(() => expect(document.querySelectorAll('.admin-snapshot-row')).toHaveLength(2));
        expect(restoreBtn(NEWER_ZIP)).toBeInTheDocument();
        expect(restoreBtn(OLDER_ZIP)).toBeInTheDocument();
        expect(restoreBtn(OLDER_ZIP)).toHaveClass('ct-btn', 'ct-btn-danger');
    });

    it('row Restore opens the shared confirm modal naming the campaign AND the exact filename', async () => {
        const fetchMock = stubFetch();
        renderAdmin();

        fireEvent.click(await waitFor(() => restoreBtn(OLDER_ZIP)));

        expect(screen.getByRole('heading', { name: 'Rollback Campaign' })).toBeInTheDocument();
        const warning = screen.getByText(/overwrite ALL current campaign data/);
        expect(warning.textContent).toContain(`"${CAMPAIGN}"`);
        expect(warning.textContent).toContain(`"${OLDER_ZIP}"`);
        expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('ct-btn-danger');
        expect(postCalls(fetchMock)).toHaveLength(0);
    });

    it('Cancel and close are fully inert — no POST, no notice, no reload, no status', async () => {
        const fetchMock = stubFetch();
        const { container } = renderAdmin();

        fireEvent.click(await waitFor(() => restoreBtn(OLDER_ZIP)));
        fireEvent.click(container.querySelector('.ct-modal-header .ct-modal-close'));
        expect(screen.queryByRole('heading', { name: 'Rollback Campaign' })).not.toBeInTheDocument();

        fireEvent.click(restoreBtn(NEWER_ZIP));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('heading', { name: 'Rollback Campaign' })).not.toBeInTheDocument();

        await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(0));
        expect(document.querySelector('.campaign-admin .admin-status')).toBeNull();
        expect(sessionStorage.getItem('postRestoreNotice')).toBeNull();
        expect(window.location.reload).not.toHaveBeenCalled();
    });

    it('confirmed row Restore posts the exact filename, hands off the notice, and reloads', async () => {
        const fetchMock = stubFetch();
        renderAdmin();

        fireEvent.click(await waitFor(() => restoreBtn(OLDER_ZIP)));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

        const status = await screen.findByText('Rollback complete');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--success');
        const posts = postCalls(fetchMock);
        expect(posts).toHaveLength(1);
        const [url, options] = posts[0];
        expect(url).toBe(ROLLBACK_URL);
        expect(options.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(options.body)).toEqual({ filename: OLDER_ZIP });
        expect(JSON.parse(sessionStorage.getItem('postRestoreNotice'))).toEqual({
            campaign: CAMPAIGN,
            restored: OLDER_ZIP,
        });
        await waitFor(() => expect(window.location.reload).toHaveBeenCalledTimes(1));
    });

    it('surfaces a server rejection without reloading or storing a notice', async () => {
        const fetchMock = stubFetch({ rollback: jsonResponse({ error: 'Snapshot not found' }, false) });
        renderAdmin();

        fireEvent.click(await waitFor(() => restoreBtn(OLDER_ZIP)));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

        const status = await screen.findByText('Snapshot not found');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(postCalls(fetchMock)).toHaveLength(1);
        expect(window.location.reload).not.toHaveBeenCalled();
        expect(sessionStorage.getItem('postRestoreNotice')).toBeNull();
        expect(restoreBtn(OLDER_ZIP)).toBeEnabled();
    });

    it('busy state disables every row button and blocks duplicate restores', async () => {
        const fetchMock = stubFetch({ rollback: neverSettles() });
        renderAdmin();

        fireEvent.click(await waitFor(() => restoreBtn(OLDER_ZIP)));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

        expect(await screen.findByText('Rolling back...')).toBeInTheDocument();
        expect(restoreBtn(OLDER_ZIP)).toBeDisabled();
        expect(restoreBtn(NEWER_ZIP)).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Rollback to Snapshot' })).toBeDisabled();
        expect(postCalls(fetchMock)).toHaveLength(1);
    });

    it('top Rollback to Snapshot button still POSTs with no body (legacy newest lane)', async () => {
        const fetchMock = stubFetch();
        renderAdmin();

        fireEvent.click(screen.getByRole('button', { name: 'Rollback to Snapshot' }));
        const warning = screen.getByText(/overwrite ALL current campaign data/);
        expect(warning.textContent).toContain('latest snapshot');
        expect(warning.textContent).not.toContain(OLDER_ZIP);
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

        await screen.findByText('Rollback complete');
        const posts = postCalls(fetchMock);
        expect(posts).toHaveLength(1);
        expect(posts[0][0]).toBe(ROLLBACK_URL);
        expect(posts[0][1].body).toBeUndefined();
    });
});
