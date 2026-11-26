// @maintained-by-ai 2026-11-17
/**
 * Change-Data Census section of CampaignAdmin (backlog 2026-11-17 CD): the
 * Admin panel surfaces top-level change-data keys the server does NOT
 * recognize (phantom buckets from the blindly-accepting wildcard lane).
 * Locks the three rendered faces: honest "none" (empty store and
 * all-known store), the phantom list (key name + type/summary, siblings not
 * listed), the fetch-error face, the re-census after Clear Change Data, and
 * the section's own Refresh control (backlog 2026-11-17 EG: the census only
 * fetched on mount, so a phantom landing while the view stayed mounted left
 * the face silently stale).
 * Classification itself is server-side and pinned in
 * server/routes/campaigns-admin-change-data-census.test.js.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';
const CENSUS_URL = `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/admin/change-data-census`;

const jsonResponse = (body, ok = true) => ({ ok, json: () => Promise.resolve(body) });

// Confirm-button labels of the shared wipe dialog per toolbar trigger.
const WIPE_YES = {
    'Clear Change Data': 'Yes, Clear Change Data',
    'Clear Campaign Log': 'Yes, Clear Log',
    'Full Reset': 'Yes, Full Reset',
};

function stubFetchWithCensus(census) {
    const fetchMock = vi.fn((url) => {
        let result;
        if (url.endsWith('/admin/snapshots')) {
            result = jsonResponse({ snapshots: [] });
        } else if (url.endsWith('/admin/change-data-census')) {
            result = census instanceof Error
                ? Promise.reject(census)
                : Promise.resolve(census);
        } else {
            result = jsonResponse({});
        }
        return result instanceof Error ? Promise.reject(result) : result;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const createDefaultProps = (overrides = {}) => ({
    campaignName: CAMPAIGN,
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

beforeEach(() => {
    // QA backlog 2026-11-24: the wipe trio rides the shared role="dialog"
    // tier — a native confirm firing here is a regression.
    vi.spyOn(window, 'confirm').mockImplementation(() => {
        throw new Error('native window.confirm fired on an admin data-wipe path');
    });
    vi.stubGlobal('location', { href: 'http://localhost/', reload: vi.fn() });
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('CampaignAdmin - change-data census', () => {
    it('fetches the census from the admin lane on mount', async () => {
        const fetchMock = stubFetchWithCensus(jsonResponse({ totalKeys: 0, unknownKeys: [] }));
        render(<CampaignAdmin {...createDefaultProps()} />);

        await screen.findByText('No unknown top-level keys — change data is empty.');
        expect(fetchMock).toHaveBeenCalledWith(CENSUS_URL);
    });

    it('empty store renders the honest none face with no error', async () => {
        stubFetchWithCensus(jsonResponse({ totalKeys: 0, unknownKeys: [] }));
        const { container } = render(<CampaignAdmin {...createDefaultProps()} />);

        const none = await screen.findByText('No unknown top-level keys — change data is empty.');
        expect(none).toHaveAttribute('role', 'status');
        expect(container.querySelector('.campaign-admin .admin-status--error')).toBeNull();
        expect(container.querySelectorAll('.admin-snapshot-row')).toHaveLength(0);
    });

    it('all-known store names the key count on the none face', async () => {
        stubFetchWithCensus(jsonResponse({ totalKeys: 3, unknownKeys: [] }));
        render(<CampaignAdmin {...createDefaultProps()} />);

        expect(await screen.findByText('No unknown top-level keys — all 3 keys recognized.')).toBeInTheDocument();
    });

    it('lists exactly the unknown keys with type and summary; known siblings are not listed', async () => {
        stubFetchWithCensus(jsonResponse({
            totalKeys: 3,
            unknownKeys: [
                { key: 'inventory', type: 'object', summary: '2 keys: campaign, items' },
            ],
        }));
        const { container } = render(<CampaignAdmin {...createDefaultProps()} />);

        const row = await waitFor(() => {
            const row = container.querySelector('.admin-snapshot-row');
            if (!row) throw new Error('census row not rendered yet');
            return row;
        });
        expect(row.querySelector('.admin-snapshot-name').textContent).toContain('inventory');
        expect(row.querySelector('.admin-snapshot-meta').textContent).toBe('object · 2 keys: campaign, items');
        expect(container.querySelectorAll('.admin-snapshot-row')).toHaveLength(1);
        expect(screen.getByText(/1 of 3 top-level keys not recognized/)).toBeInTheDocument();
        // Recognized siblings (character bucket + specials) never appear.
        expect(container.textContent).not.toContain('AasimarTest');
        expect(container.textContent).not.toContain('combatSummary');
    });

    it('renders the fetch-error face without throwing when the lane fails', async () => {
        stubFetchWithCensus(new Error('boom'));
        render(<CampaignAdmin {...createDefaultProps()} />);

        expect(await screen.findByText('Could not load the change-data census from the server.')).toBeInTheDocument();
        expect(console.error).toHaveBeenCalledWith('Failed to load change-data census:', 'boom');
    });

    it('re-censuses after Clear Change Data succeeds (phantom swept -> none face)', async () => {
        const phantom = { totalKeys: 1, unknownKeys: [{ key: 'inventory', type: 'object', summary: '2 keys: campaign, items' }] };
        let censusCall = 0;
        const fetchMock = vi.fn((url) => {
            if (url.endsWith('/admin/snapshots')) return Promise.resolve(jsonResponse({ snapshots: [] }));
            if (url.endsWith('/admin/change-data-census')) {
                censusCall += 1;
                return Promise.resolve(jsonResponse(censusCall === 1 ? phantom : { totalKeys: 0, unknownKeys: [] }));
            }
            return Promise.resolve(jsonResponse({ message: 'Change data cleared' }));
        });
        vi.stubGlobal('fetch', fetchMock);
        render(<CampaignAdmin {...createDefaultProps()} />);

        await screen.findByText('inventory');

        fireEvent.click(screen.getByRole('button', { name: 'Clear Change Data' }));
        const wipeDialog = screen.getByRole('dialog', { name: 'Clear Change Data' });
        fireEvent.click(within(wipeDialog).getByRole('button', { name: WIPE_YES['Clear Change Data'] }));
        await screen.findByText('Change data cleared');

        expect(await screen.findByText('No unknown top-level keys — change data is empty.')).toBeInTheDocument();
        expect(censusCall).toBe(2);
    });

    // The census section owns its refresh affordance (the Snapshots/Backup
    // lanes never re-fetched it — mount-only fetch let a phantom key land
    // while the mounted panel kept claiming "all N recognized", EG law).
    it('Refresh control re-fetches the census without a view swap: flagged -> clean', async () => {
        const clean = { totalKeys: 3, unknownKeys: [] };
        const phantom = {
            totalKeys: 4,
            unknownKeys: [{ key: 'eg-census-probe', type: 'object', summary: '1 key: leaked' }],
        };
        let censusCall = 0;
        const fetchMock = vi.fn((url) => {
            if (url.endsWith('/admin/snapshots')) return Promise.resolve(jsonResponse({ snapshots: [] }));
            if (url.endsWith('/admin/change-data-census')) {
                censusCall += 1;
                return Promise.resolve(jsonResponse(censusCall === 2 ? phantom : clean));
            }
            return Promise.resolve(jsonResponse({}));
        });
        vi.stubGlobal('fetch', fetchMock);
        const { container } = render(<CampaignAdmin {...createDefaultProps()} />);

        const section = screen.getByRole('heading', { level: 3, name: 'Change-Data Census' }).closest('.admin-section');
        // One Refresh per census face position — this one lives IN the census
        // section header, not the adjacent audit lane.
        const refresh = within(section).getByRole('button', { name: 'Refresh' });

        expect(await within(section).findByText('No unknown top-level keys — all 3 keys recognized.')).toBeInTheDocument();

        // Phantom lands server-side -> press Refresh.
        fireEvent.click(refresh);
        // Transient loading note while the re-fetch is in flight: plain copy,
        // never a live region (rendering-idle contract shape).
        const loading = within(section).getByText('Loading change-data census…');
        expect(loading).not.toHaveAttribute('role');
        expect(within(section).queryByRole('status')).toBeNull();

        // Flagged face: N of M copy + .fa-ghost row, and (known live law) the
        // flagged face carries NO role=status.
        expect(await within(section).findByText(/1 of 4 top-level keys not recognized/)).toBeInTheDocument();
        const ghostRow = container.querySelector('.admin-snapshot-row');
        expect(ghostRow.querySelector('.fa-ghost')).toBeInTheDocument();
        expect(ghostRow.textContent).toContain('eg-census-probe');
        expect(ghostRow.textContent).toContain('object · 1 key: leaked');
        expect(within(section).queryByRole('status')).toBeNull();

        // Probe deleted server-side -> press Refresh again, clean face returns
        // byte-consistently (and the none face carries role=status again).
        fireEvent.click(refresh);
        const none = await within(section).findByText('No unknown top-level keys — all 3 keys recognized.');
        expect(none).toHaveAttribute('role', 'status');
        expect(censusCall).toBe(3);
        expect(container.querySelectorAll('.fa-ghost')).toHaveLength(0);
    });
});
