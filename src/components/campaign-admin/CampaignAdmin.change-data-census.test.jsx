// @maintained-by-ai
/**
 * Change-Data Census section of CampaignAdmin (backlog 2026-11-17 CD): the
 * Admin panel surfaces top-level change-data keys the server does NOT
 * recognize (phantom buckets from the blindly-accepting wildcard lane).
 * Locks the three rendered faces: honest "none" (empty store and
 * all-known store), the phantom list (key name + type/summary, siblings not
 * listed), the fetch-error face, and the re-census after Clear Change Data.
 * Classification itself is server-side and pinned in
 * server/routes/campaigns-admin-change-data-census.test.js.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';
const CENSUS_URL = `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/admin/change-data-census`;

const jsonResponse = (body, ok = true) => ({ ok, json: () => Promise.resolve(body) });

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
    vi.spyOn(window, 'confirm').mockReturnValue(true);
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
        await screen.findByText('Change data cleared');

        expect(await screen.findByText('No unknown top-level keys — change data is empty.')).toBeInTheDocument();
        expect(censusCall).toBe(2);
    });
});
