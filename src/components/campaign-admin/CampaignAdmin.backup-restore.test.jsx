// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const createDefaultProps = (overrides = {}) => ({
    campaignName: 'test-campaign',
    onBack: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

describe('CampaignAdmin - Snapshot', () => {
    const defaultProps = createDefaultProps();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('disables the button while snapshotting', async () => {
        global.fetch = vi.fn(() => new Promise(() => {}));

        render(<CampaignAdmin {...defaultProps} />);
        const btn = screen.getByRole('button', { name: 'Create Snapshot' });

        fireEvent.click(btn);

        await waitFor(() => {
            expect(btn).toBeDisabled();
        });
    });

    it('shows loading status while snapshotting', async () => {
        global.fetch = vi.fn(() => new Promise(() => {}));

        render(<CampaignAdmin {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Create Snapshot' }));

        await waitFor(() => {
            expect(screen.getByText('Creating snapshot...')).toBeInTheDocument();
        });
    });

    it('shows success naming the archive file and its size', async () => {
        global.fetch = vi.fn((url) => {
            if (url.includes('/admin/snapshots')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ snapshots: [] }) });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ message: 'Snapshot created', filename: 'test-campaign-2026-10-10T12-34-56-789.zip', size: 102400 }),
            });
        });

        render(<CampaignAdmin {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Create Snapshot' }));

        await waitFor(() => {
            expect(screen.getByText('Snapshot created: test-campaign-2026-10-10T12-34-56-789.zip (100.0 KB)')).toBeInTheDocument();
        });
    });

    it('refreshes the snapshot list after creating a snapshot', async () => {
        const fetchMock = vi.fn((url) => {
            if (url.includes('/admin/snapshots')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ snapshots: [] }) });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ message: 'Snapshot created', filename: 'test-campaign-2026-10-10T12-34-56-789.zip', size: 2048 }),
            });
        });
        global.fetch = fetchMock;

        render(<CampaignAdmin {...defaultProps} />);
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/campaigns/test-campaign/admin/snapshots');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Create Snapshot' }));

        await waitFor(() => {
            const listFetches = fetchMock.mock.calls.filter(([url]) => url.includes('/admin/snapshots'));
            expect(listFetches.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('renders the available snapshots list newest first', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    snapshots: [
                        { filename: 'test-campaign-2026-10-10T12-00-01-000.zip', size: 2048, timestamp: '2026-10-10T12:00:01.000Z' },
                        { filename: 'test-campaign-2026-10-09T11-00-00-000.zip', size: 1024, timestamp: '2026-10-09T11:00:00.000Z' },
                    ],
                }),
            })
        );

        render(<CampaignAdmin {...defaultProps} />);

        await waitFor(() => {
            const rows = document.querySelectorAll('.admin-snapshot-row');
            expect(rows).toHaveLength(2);
            expect(rows[0]).toHaveTextContent('test-campaign-2026-10-10T12-00-01-000.zip');
            expect(rows[0]).toHaveTextContent('2.0 KB');
            expect(rows[1]).toHaveTextContent('test-campaign-2026-10-09T11-00-00-000.zip');
            expect(rows[1]).toHaveTextContent('1.0 KB');
        });
    });

    it('shows an empty-state message when no snapshots exist', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve({ snapshots: [] }) })
        );

        render(<CampaignAdmin {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText('No snapshots on the server yet.')).toBeInTheDocument();
        });
    });

    it('shows error status on failed response', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Snapshot failed' }) })
        );

        render(<CampaignAdmin {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Create Snapshot' }));

        await waitFor(() => {
            expect(screen.getByText('Snapshot failed')).toBeInTheDocument();
        });
    });

    it('shows error status on network error', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('Network failed')));

        render(<CampaignAdmin {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Create Snapshot' }));

        await waitFor(() => {
            expect(screen.getByText('Network failed')).toBeInTheDocument();
        });
    });
});

describe('CampaignAdmin - Download', () => {
    const defaultProps = createDefaultProps();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('disables the button while downloading', async () => {
        const mockBlob = new Blob(['test'], { type: 'application/zip' });
        global.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, blob: () => Promise.resolve(mockBlob) })
        );

        render(<CampaignAdmin {...defaultProps} />);
        const btn = screen.getByRole('button', { name: 'Download Campaign' });

        fireEvent.click(btn);

        await waitFor(() => {
            expect(btn).toBeDisabled();
        });
    });

    it('revokes the object URL after download', async () => {
        const mockBlob = new Blob(['test'], { type: 'application/zip' });
        global.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, blob: () => Promise.resolve(mockBlob) })
        );
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

        render(<CampaignAdmin {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Download Campaign' }));

        await waitFor(() => {
            expect(revokeObjectURLSpy).toHaveBeenCalled();
        });
    });

    it('shows error status on failed response', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ error: 'Download failed' }),
            })
        );

        render(<CampaignAdmin {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Download Campaign' }));

        await waitFor(() => {
            expect(screen.getByText('Download failed')).toBeInTheDocument();
        });
    });

    it('shows error status on network error', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('Network failed')));

        render(<CampaignAdmin {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Download Campaign' }));

        await waitFor(() => {
            expect(screen.getByText('Network failed')).toBeInTheDocument();
        });
    });
});
