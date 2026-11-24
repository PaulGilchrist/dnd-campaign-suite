// @maintained-by-ai
/**
 * Data Management flows of CampaignAdmin: Clear Change Data, Clear Campaign
 * Log, and Full Reset. QA backlog 2026-11-24: the trio's native
 * window.confirm gates are retired onto the shared DeleteConfirmModal
 * role="dialog" tier (the Admin Regenerate/delete precedent) — this matrix
 * pins the dialog face (open naming the loss, focus on Cancel,
 * Cancel/Escape/backdrop ZERO-WRITE), correct endpoint + URL-encoding of the
 * campaign name, busy state, and success/error status rendering (non-OK
 * response vs rejected fetch — two distinct handler branches), and the
 * acting-tab reload semantics: Full Reset reloads on success like the
 * rollback/upload lanes (mirroring the reload assertions in
 * CampaignAdmin.rollback-upload.test.jsx), while the sibling clears and
 * every failure path stay put. A native confirm firing anywhere here is a
 * regression — the spy throws.
 *
 * Other CampaignAdmin flows are covered by sibling files: backup-restore,
 * rollback-upload, rename, delete, rendering, and theme-toggle tests —
 * behaviors already tested there are not duplicated here.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';

// The three destructive Data Management actions share one code shape
// (arm dialog → confirm POST → status), so they are exercised through one
// matrix. `dialog` is the shared tier's accessible name; `confirmPattern`
// keeps the retired native copy verbatim (minus its "Continue?" tail).
const DATA_ACTIONS = [
    {
        button: 'Clear Change Data',
        path: 'clear-change-data',
        dialog: 'Clear Change Data',
        yes: 'Yes, Clear Change Data',
        busyText: 'Clearing change data...',
        reloads: false,
        confirmPattern: /clear all runtime state for ".*" including HP, conditions, spell slots, death saves, and target effects/,
    },
    {
        button: 'Clear Campaign Log',
        path: 'clear-log',
        dialog: 'Clear Campaign Log',
        yes: 'Yes, Clear Log',
        busyText: 'Clearing log...',
        reloads: false,
        confirmPattern: /permanently delete the campaign log for ".*"\. Roll history will be lost/,
    },
    {
        button: 'Full Reset',
        path: 'full-reset',
        dialog: 'Full Reset',
        yes: 'Yes, Full Reset',
        busyText: 'Performing full reset...',
        // Success wipes change-data + log server-side; the acting tab must
        // reload so its React state reflects the wipe (rollback-lane parity).
        reloads: true,
        confirmPattern: /FULL RESET: This will delete both the campaign log AND all change data/,
    },
];

const postUrl = (name, path) =>
    `/api/campaigns/${encodeURIComponent(name)}/admin/${path}`;

const createDefaultProps = (overrides = {}) => ({
    campaignName: CAMPAIGN,
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

const jsonResponse = (body, ok = true) => ({ ok, json: () => Promise.resolve(body) });

/**
 * Stub fetch with one behavior for every Data Management POST route:
 * a response object, an Error (rejects), or a never-settling Promise
 * (busy state). The snapshots list gets an empty list; unrelated child
 * section endpoints (covered in their own test files) get neutral OK JSON.
 */
function stubFetch(adminHandler = jsonResponse({ message: 'Done' })) {
    const fetchMock = vi.fn((url) => {
        let result;
        if (url.endsWith('/admin/snapshots')) {
            result = jsonResponse({ snapshots: [] });
        } else if (url.endsWith('/admin/change-data-census')) {
            // Census lane has its own test file; these flows just need the
            // honest empty store so the mount fetch never lands on the error face.
            result = jsonResponse({ totalKeys: 0, unknownKeys: [] });
        } else if (/\/admin\/(clear-change-data|clear-log|full-reset)$/.test(url)) {
            result = adminHandler;
        } else {
            result = jsonResponse({});
        }
        return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const countPosts = (fetchMock, url) =>
    fetchMock.mock.calls.filter(([u, opts]) => u === url && opts?.method === 'POST').length;

// Arm the shared dialog from the toolbar button and hand it back.
function armDialog(button, dialogName) {
    fireEvent.click(screen.getByRole('button', { name: button }));
    return screen.getByRole('dialog', { name: dialogName });
}

beforeEach(() => {
    // A native confirm that FIRES on these lanes is a regression — make it loud.
    vi.spyOn(window, 'confirm').mockImplementation(() => {
        throw new Error('native window.confirm fired on an admin data-wipe path');
    });
    // Reload is stubbed (same shape as the rollback-upload sibling) so a
    // successful Full Reset can still be inspected post-"reload".
    vi.stubGlobal('location', { href: 'http://localhost/', reload: vi.fn() });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe.each(DATA_ACTIONS)('$button', ({ button, path, dialog, yes, busyText, confirmPattern, reloads }) => {
    const url = postUrl(CAMPAIGN, path);

    it('arms the shared in-app dialog with the data-loss warning; Cancel is fully inert', async () => {
        const fetchMock = stubFetch();
        render(<CampaignAdmin {...createDefaultProps()} />);

        const el = armDialog(button, dialog);

        // role=dialog on the .modal-shell-overlay tier — never .sp-overlay.
        expect(el).toHaveAttribute('aria-modal', 'true');
        expect(el.closest('.modal-shell-overlay')).not.toBeNull();
        expect(el).toHaveTextContent(confirmPattern);
        expect(window.confirm).not.toHaveBeenCalled();
        // Initial focus lands on the inert default.
        expect(within(el).getByRole('button', { name: 'Cancel' })).toHaveFocus();

        fireEvent.click(within(el).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        // Decline wrote nothing: no POST on any wipe route, no status, buttons live.
        DATA_ACTIONS.forEach(({ path: p }) =>
            expect(countPosts(fetchMock, postUrl(CAMPAIGN, p))).toBe(0));
        expect(document.querySelector('.campaign-admin .admin-status')).toBeNull();
        expect(screen.getByRole('button', { name: button })).toBeEnabled();
    });

    it('ESCAPE and BACKDROP dismiss the dialog zero-write', async () => {
        const fetchMock = stubFetch();
        render(<CampaignAdmin {...createDefaultProps()} />);

        const el = armDialog(button, dialog);
        fireEvent.keyDown(within(el).getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        const el2 = armDialog(button, dialog);
        fireEvent.click(document.querySelector('.modal-shell-overlay'));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        void el2;

        DATA_ACTIONS.forEach(({ path: p }) =>
            expect(countPosts(fetchMock, postUrl(CAMPAIGN, p))).toBe(0));
        expect(document.querySelector('.campaign-admin .admin-status')).toBeNull();
    });

    it('posts to /admin/$path exactly once, shows the server success message, and reloads=$reloads', async () => {
        const fetchMock = stubFetch(jsonResponse({ message: `${button} complete` }));
        render(<CampaignAdmin {...createDefaultProps()} />);

        const el = armDialog(button, dialog);
        fireEvent.click(within(el).getByRole('button', { name: yes }));

        const status = await screen.findByText(`${button} complete`);
        expect(countPosts(fetchMock, url)).toBe(1);
        expect(status.closest('.admin-status')).toHaveClass('admin-status--success');
        // The confirm closes as the lane runs.
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // The action settles: busy text gone, buttons usable again.
        expect(screen.queryByText(busyText)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: button })).toBeEnabled();
        // reload is in the same success branch as setStatus, so by the time
        // the status rendered the decision is final.
        if (reloads) {
            await waitFor(() => expect(window.location.reload).toHaveBeenCalledTimes(1));
        } else {
            expect(window.location.reload).not.toHaveBeenCalled();
        }
    });

    it('shows a busy state and blocks repeat requests while $path is in flight', async () => {
        const fetchMock = stubFetch(new Promise(() => {}));
        render(<CampaignAdmin {...createDefaultProps()} />);

        const el = armDialog(button, dialog);
        fireEvent.click(within(el).getByRole('button', { name: yes }));

        const busy = await screen.findByText(busyText);
        expect(busy.closest('.admin-status')).toHaveClass('admin-status--loading');
        // Busy state spans all three destructive actions, not just the clicked one.
        DATA_ACTIONS.forEach(({ button: b }) =>
            expect(screen.getByRole('button', { name: b })).toBeDisabled());

        // A second click on the disabled button must not queue a duplicate POST.
        fireEvent.click(screen.getByRole('button', { name: button }));
        expect(countPosts(fetchMock, url)).toBe(1);
        expect(window.confirm).not.toHaveBeenCalled();
    });

    it('surfaces the server error message and re-enables the buttons without reloading when $path fails', async () => {
        stubFetch(jsonResponse({ error: `${button} declined by server` }, false));
        render(<CampaignAdmin {...createDefaultProps()} />);

        const el = armDialog(button, dialog);
        fireEvent.click(within(el).getByRole('button', { name: yes }));

        const status = await screen.findByText(`${button} declined by server`);
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(screen.getByRole('button', { name: button })).toBeEnabled();
        expect(window.location.reload).not.toHaveBeenCalled();
    });
});

describe('CampaignAdmin - Data Management network failures', () => {
    // Distinct branch from the non-OK response test: the fetch itself rejects.
    it('shows the failure reason when the request never reaches the server', async () => {
        const fetchMock = stubFetch(new Error('Network failed'));
        render(<CampaignAdmin {...createDefaultProps()} />);

        const el = armDialog('Full Reset', 'Full Reset');
        fireEvent.click(within(el).getByRole('button', { name: 'Yes, Full Reset' }));

        const status = await screen.findByText('Network failed');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(countPosts(fetchMock, postUrl(CAMPAIGN, 'full-reset'))).toBe(1);
        expect(screen.getByRole('button', { name: 'Full Reset' })).toBeEnabled();
        // Transport error: the wipe never happened, the tab stays put.
        expect(window.location.reload).not.toHaveBeenCalled();
    });
});

describe('URL-encoding of the campaign name', () => {
    // One compound name exercises the single encodeURIComponent code path
    // across every special-character class (space, slash, &, #, ?).
    const campaignName = 'test campaign/1 &x#y?';

    it('encodes the campaign name in every data-management endpoint', async () => {
        const fetchMock = stubFetch();
        render(<CampaignAdmin {...createDefaultProps({ campaignName })} />);

        for (const { button, path, dialog, yes } of DATA_ACTIONS) {
            const el = armDialog(button, dialog);
            fireEvent.click(within(el).getByRole('button', { name: yes }));
            await waitFor(() => {
                expect(countPosts(fetchMock, postUrl(campaignName, path))).toBe(1);
                // The POST count turns true the instant the fetch is *dispatched*,
                // while all three action buttons are still busy-disabled (the
                // 'clearing-*' setStatus rendered inside the click). Clicking the
                // next button in that window is silently swallowed by jsdom for
                // disabled buttons (same behavior pinned by the busy test above),
                // its POST never fires, and the waitFor times out — a coin flip
                // between RTL's setTimeout(0) drain and React's MessageChannel
                // success commit that only inverts under full-suite CPU load
                // (flake watch batch #134). Gate on the success commit itself:
                // the busy status clearing and the button re-enabling is the
                // causal signal that the lane is ready for the next action.
                expect(screen.getByRole('button', { name: button })).toBeEnabled();
            });
        }
        // No unencoded campaign name ever leaves the client.
        fetchMock.mock.calls.forEach(([u]) => {
            expect(u).not.toContain(campaignName);
        });
    });
});
