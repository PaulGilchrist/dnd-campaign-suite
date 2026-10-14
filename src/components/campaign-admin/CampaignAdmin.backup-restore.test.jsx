// @improved-by-ai
/**
 * Backup & Restore flows of CampaignAdmin: snapshot creation, snapshot list
 * rendering, and campaign download. Rollback and upload flows are covered by
 * CampaignAdmin.rollback-upload.test.jsx; URL-encoding of campaign names is
 * covered by CampaignAdmin.data-management.test.jsx.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';
const LIST_URL = `/api/campaigns/${CAMPAIGN}/admin/snapshots`;
const SNAPSHOT_URL = `/api/campaigns/${CAMPAIGN}/admin/snapshot`;
const DOWNLOAD_URL = `/api/campaigns/${CAMPAIGN}/admin/download`;

const SNAPSHOT_BTN = 'Create Snapshot';
const DOWNLOAD_BTN = 'Download Campaign';

const createDefaultProps = (overrides = {}) => ({
    campaignName: CAMPAIGN,
    onBack: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

const jsonResponse = (body, ok = true) => ({ ok, json: () => Promise.resolve(body) });

const zipResponse = () => ({
    ok: true,
    blob: () => Promise.resolve(new Blob(['zip'], { type: 'application/zip' })),
});

/**
 * Stub fetch with one handler per route. A handler may be a response object,
 * an Error (rejects every call), or a function of the per-route call count
 * returning either — so tests can script sequential responses (e.g. the
 * list refresh after a snapshot). Unknown URLs (child-section endpoints,
 * covered in their own test files) get a neutral OK response.
 */
function stubFetch(overrides = {}) {
    const handlers = {
        [LIST_URL]: jsonResponse({ snapshots: [] }),
        [SNAPSHOT_URL]: jsonResponse({
            message: 'Snapshot created',
            filename: 'test-campaign-2026-10-10T12-34-56-789.zip',
            size: 102400,
        }),
        [DOWNLOAD_URL]: zipResponse(),
        ...overrides,
    };
    const callCounts = {};
    const fetchMock = vi.fn((url) => {
        callCounts[url] = (callCounts[url] || 0) + 1;
        const handler = handlers[url] ?? jsonResponse({});
        const result = typeof handler === 'function' ? handler(callCounts[url]) : handler;
        return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

// jsdom may not implement createObjectURL; define it before spying so the
// blob plumbing is deterministic and anchor clicks don't trigger navigation.
function mockBlobDownloadPlumbing(objectUrl = 'blob:fake-download-url') {
    if (typeof URL.createObjectURL !== 'function') {
        URL.createObjectURL = vi.fn();
    }
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const clickSpy = vi.spyOn(Object.getPrototypeOf(document.createElement('a')), 'click').mockImplementation(() => {});
    return { createSpy, revokeSpy, clickSpy, objectUrl };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('CampaignAdmin - Snapshot', () => {
    it('creates a snapshot via POST and confirms with the archive name and size', async () => {
        const fetchMock = stubFetch();
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: SNAPSHOT_BTN }));

        const status = await screen.findByText(
            'Snapshot created: test-campaign-2026-10-10T12-34-56-789.zip (100.0 KB)'
        );
        expect(status.closest('.admin-status')).toHaveClass('admin-status--success');
        expect(fetchMock).toHaveBeenCalledWith(SNAPSHOT_URL, { method: 'POST' });
        // The busy flag clears once the request settles.
        expect(screen.getByRole('button', { name: SNAPSHOT_BTN })).toBeEnabled();
    });

    it('shows a busy state and blocks repeat snapshot requests while working', async () => {
        const fetchMock = stubFetch({ [SNAPSHOT_URL]: () => new Promise(() => {}) });
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: SNAPSHOT_BTN }));

        expect(await screen.findByText('Creating snapshot...')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: SNAPSHOT_BTN })).toBeDisabled();
        // Busy state spans the other backup actions too.
        expect(screen.getByRole('button', { name: DOWNLOAD_BTN })).toBeDisabled();

        // A second click must not queue a duplicate snapshot.
        fireEvent.click(screen.getByRole('button', { name: SNAPSHOT_BTN }));
        const snapshotPosts = fetchMock.mock.calls.filter(([url]) => url === SNAPSHOT_URL);
        expect(snapshotPosts).toHaveLength(1);
    });

    it('shows the server error and re-enables the button when the snapshot fails', async () => {
        stubFetch({ [SNAPSHOT_URL]: jsonResponse({ error: 'Snapshot failed' }, false) });
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: SNAPSHOT_BTN }));

        const status = await screen.findByText('Snapshot failed');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(screen.getByRole('button', { name: SNAPSHOT_BTN })).toBeEnabled();
    });

    it('shows the failure reason when the snapshot request never reaches the server', async () => {
        stubFetch({ [SNAPSHOT_URL]: new Error('Network failed') });
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: SNAPSHOT_BTN }));

        const status = await screen.findByText('Network failed');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(screen.getByRole('button', { name: SNAPSHOT_BTN })).toBeEnabled();
    });

    it('refreshes the snapshot list after creating a snapshot', async () => {
        const newSnapshot = {
            filename: 'test-campaign-2026-10-10T12-34-56-789.zip',
            size: 2048,
            timestamp: '2026-10-10T12:34:56.789Z',
        };
        // The server reports the archive in the list only from the second fetch on.
        stubFetch({
            [LIST_URL]: (call) => jsonResponse({ snapshots: call === 1 ? [] : [newSnapshot] }),
        });
        render(<CampaignAdmin {...createDefaultProps()} />);

        await waitFor(() => {
            expect(screen.getByText('No snapshots on the server yet.')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: SNAPSHOT_BTN }));

        const newRow = await screen.findByText(newSnapshot.filename);
        expect(newRow.closest('.admin-snapshot-row')).toHaveTextContent('2.0 KB');
    });

    it('renders snapshots returned by the server in order with formatted sizes', async () => {
        stubFetch({
            [LIST_URL]: jsonResponse({
                snapshots: [
                    { filename: 'test-campaign-2026-10-10T12-00-01-000.zip', size: 2048, timestamp: '2026-10-10T12:00:01.000Z' },
                    { filename: 'test-campaign-2026-10-09T11-00-00-000.zip', size: 3.5 * 1024 * 1024, timestamp: '2026-10-09T11:00:00.000Z' },
                    { filename: 'test-campaign-2026-10-08T10-00-00-000.zip', size: 1024, timestamp: '2026-10-08T10:00:00.000Z' },
                ],
            }),
        });
        render(<CampaignAdmin {...createDefaultProps()} />);

        const rows = await waitFor(() => {
            const found = document.querySelectorAll('.admin-snapshot-row');
            expect(found).toHaveLength(3);
            return found;
        });
        // Rendered in the order the server returned them (newest first).
        expect(rows[0]).toHaveTextContent('test-campaign-2026-10-10T12-00-01-000.zip');
        expect(rows[0]).toHaveTextContent('2.0 KB');
        expect(rows[1]).toHaveTextContent('test-campaign-2026-10-09T11-00-00-000.zip');
        expect(rows[1]).toHaveTextContent('3.5 MB');
        expect(rows[2]).toHaveTextContent('test-campaign-2026-10-08T10-00-00-000.zip');
        expect(rows[2]).toHaveTextContent('1.0 KB');
    });

    it('shows an empty-state message when the server has no snapshots', async () => {
        const fetchMock = stubFetch();
        render(<CampaignAdmin {...createDefaultProps()} />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(LIST_URL);
        });
        expect(screen.getByText('Available Snapshots')).toBeInTheDocument();
        expect(screen.getByText('No snapshots on the server yet.')).toBeInTheDocument();
        expect(document.querySelectorAll('.admin-snapshot-row')).toHaveLength(0);
    });
});

describe('CampaignAdmin - Download', () => {
    it('downloads the campaign as a zip named after the campaign and confirms', async () => {
        const { createSpy, revokeSpy, clickSpy, objectUrl } = mockBlobDownloadPlumbing();
        const fetchMock = stubFetch();
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: DOWNLOAD_BTN }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(DOWNLOAD_URL);
            expect(clickSpy).toHaveBeenCalledTimes(1);
        });
        expect(createSpy).toHaveBeenCalledTimes(1);
        const anchor = clickSpy.mock.instances[0];
        expect(anchor.tagName).toBe('A');
        expect(anchor.download).toBe('test-campaign.zip');
        expect(anchor.getAttribute('href')).toBe(objectUrl);
        expect(revokeSpy).toHaveBeenCalledWith(objectUrl);
        expect(await screen.findByText('Download started')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: DOWNLOAD_BTN })).toBeEnabled();
    });

    it('shows a busy state while preparing the download', async () => {
        stubFetch({ [DOWNLOAD_URL]: () => new Promise(() => {}) });
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: DOWNLOAD_BTN }));

        expect(await screen.findByText('Preparing download...')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: DOWNLOAD_BTN })).toBeDisabled();
        expect(screen.getByRole('button', { name: SNAPSHOT_BTN })).toBeDisabled();
    });

    it('shows the server error without triggering a file download when the download fails', async () => {
        const { createSpy, clickSpy } = mockBlobDownloadPlumbing();
        stubFetch({ [DOWNLOAD_URL]: jsonResponse({ error: 'Download failed' }, false) });
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: DOWNLOAD_BTN }));

        const status = await screen.findByText('Download failed');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(createSpy).not.toHaveBeenCalled();
        expect(clickSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: DOWNLOAD_BTN })).toBeEnabled();
    });

    it('shows the failure reason when the download request never reaches the server', async () => {
        const { clickSpy } = mockBlobDownloadPlumbing();
        stubFetch({ [DOWNLOAD_URL]: new Error('Network failed') });
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: DOWNLOAD_BTN }));

        const status = await screen.findByText('Network failed');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(clickSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: DOWNLOAD_BTN })).toBeEnabled();
    });
});
