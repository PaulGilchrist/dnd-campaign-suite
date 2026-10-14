// @maintained-by-ai
/**
 * Data Management flows of CampaignAdmin: Clear Change Data, Clear Campaign
 * Log, and Full Reset. Covers the confirmation prompt (including declined
 * paths), correct endpoint + URL-encoding of the campaign name, busy state,
 * and success/error status rendering (non-OK response vs rejected fetch —
 * two distinct handler branches).
 *
 * Other CampaignAdmin flows are covered by sibling files: backup-restore,
 * rollback-upload, rename, delete, rendering, and theme-toggle tests —
 * behaviors already tested there are not duplicated here.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';

// The three destructive Data Management actions share one code shape
// (confirm → POST → status), so they are exercised through one matrix.
const DATA_ACTIONS = [
    {
        button: 'Clear Change Data',
        path: 'clear-change-data',
        busyText: 'Clearing change data...',
        confirmPattern: /clear all runtime state for ".*" including HP, conditions, spell slots, death saves, and target effects/,
    },
    {
        button: 'Clear Campaign Log',
        path: 'clear-log',
        busyText: 'Clearing log...',
        confirmPattern: /permanently delete the campaign log for ".*"\. Roll history will be lost/,
    },
    {
        button: 'Full Reset',
        path: 'full-reset',
        busyText: 'Performing full reset...',
        confirmPattern: /FULL RESET: This will delete both the campaign log AND all change data/,
    },
];

const postUrl = (name, path) =>
    `/api/campaigns/${encodeURIComponent(name)}/admin/${path}`;

const createDefaultProps = (overrides = {}) => ({
    campaignName: CAMPAIGN,
    onBack: vi.fn(),
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

beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe.each(DATA_ACTIONS)('$button', ({ button, path, busyText, confirmPattern }) => {
    const url = postUrl(CAMPAIGN, path);

    it('asks for confirmation with a data-loss warning and sends nothing when declined', async () => {
        const fetchMock = stubFetch();
        window.confirm.mockReturnValueOnce(false);
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: button }));

        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(confirmPattern));
        // Decline returns synchronously before any fetch — assert immediately.
        DATA_ACTIONS.forEach(({ path: p }) =>
            expect(countPosts(fetchMock, postUrl(CAMPAIGN, p))).toBe(0));
        expect(document.querySelector('.campaign-admin .admin-status')).toBeNull();
        expect(screen.getByRole('button', { name: button })).toBeEnabled();
    });

    it('posts to /admin/$path exactly once and shows the server success message', async () => {
        const fetchMock = stubFetch(jsonResponse({ message: `${button} complete` }));
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: button }));

        const status = await screen.findByText(`${button} complete`);
        expect(countPosts(fetchMock, url)).toBe(1);
        expect(status.closest('.admin-status')).toHaveClass('admin-status--success');
        // The action settles: busy text gone, buttons usable again.
        expect(screen.queryByText(busyText)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: button })).toBeEnabled();
    });

    it('shows a busy state and blocks repeat requests while $path is in flight', async () => {
        const fetchMock = stubFetch(new Promise(() => {}));
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: button }));

        const busy = await screen.findByText(busyText);
        expect(busy.closest('.admin-status')).toHaveClass('admin-status--loading');
        // Busy state spans all three destructive actions, not just the clicked one.
        DATA_ACTIONS.forEach(({ button: b }) =>
            expect(screen.getByRole('button', { name: b })).toBeDisabled());

        // A second click on the disabled button must not queue a duplicate POST.
        fireEvent.click(screen.getByRole('button', { name: button }));
        expect(countPosts(fetchMock, url)).toBe(1);
        expect(window.confirm).toHaveBeenCalledTimes(1);
    });

    it('surfaces the server error message and re-enables the buttons when $path fails', async () => {
        stubFetch(jsonResponse({ error: `${button} declined by server` }, false));
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: button }));

        const status = await screen.findByText(`${button} declined by server`);
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(screen.getByRole('button', { name: button })).toBeEnabled();
    });
});

describe('CampaignAdmin - Data Management network failures', () => {
    // Distinct branch from the non-OK response test: the fetch itself rejects.
    it('shows the failure reason when the request never reaches the server', async () => {
        const fetchMock = stubFetch(new Error('Network failed'));
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Full Reset' }));

        const status = await screen.findByText('Network failed');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(countPosts(fetchMock, postUrl(CAMPAIGN, 'full-reset'))).toBe(1);
        expect(screen.getByRole('button', { name: 'Full Reset' })).toBeEnabled();
    });
});

describe('URL-encoding of the campaign name', () => {
    // One compound name exercises the single encodeURIComponent code path
    // across every special-character class (space, slash, &, #, ?).
    const campaignName = 'test campaign/1 &x#y?';

    it('encodes the campaign name in every data-management endpoint', async () => {
        const fetchMock = stubFetch();
        render(<CampaignAdmin {...createDefaultProps({ campaignName })} />);

        for (const { button, path } of DATA_ACTIONS) {
            fireEvent.click(screen.getByRole('button', { name: button }));
            await waitFor(() => {
                expect(countPosts(fetchMock, postUrl(campaignName, path))).toBe(1);
            });
        }
        // No unencoded campaign name ever leaves the client.
        fetchMock.mock.calls.forEach(([u]) => {
            expect(u).not.toContain(campaignName);
        });
    });
});
