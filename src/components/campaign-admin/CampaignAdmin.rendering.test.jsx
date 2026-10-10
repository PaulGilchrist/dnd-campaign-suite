// @improved-by-ai
// @cleaned-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const createDefaultProps = (overrides = {}) => ({
    campaignName: 'test-campaign',
    onBack: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

const sectionHeadings = [
    'Appearance',
    'Campaign Management',
    'Data Management',
    'Backup & Restore',
];

// All window APIs used by CampaignAdmin. Spied and restored after each test
// to prevent leaks into behavioral tests in other files.
beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'prompt').mockImplementation(() => 'test-campaign');
    vi.stubGlobal('location', { reload: vi.fn() });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CampaignAdmin - Rendering', () => {
    const defaultProps = createDefaultProps();

    describe('container and header', () => {
        it('renders the outer container with correct class', () => {
            const { container } = render(<CampaignAdmin {...defaultProps} />);
            expect(container.querySelector('.ct-container.campaign-admin')).toBeInTheDocument();
        });

        it('renders the header with campaign name in h2', () => {
            render(<CampaignAdmin {...defaultProps} />);
            expect(screen.getByRole('heading', { name: 'Admin — test-campaign', level: 2 })).toBeInTheDocument();
        });

        it('renders the back button with correct icon and accessible name', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const backBtn = screen.getByRole('button', { name: /^Back$/ });
            expect(backBtn).toBeInTheDocument();
        });

        it('reflects campaign name with special characters in the header', () => {
            render(<CampaignAdmin {...createDefaultProps({ campaignName: 'my campaign/1' })} />);
            expect(screen.getByRole('heading', { name: 'Admin — my campaign/1', level: 2 })).toBeInTheDocument();
        });
    });

    describe('admin sections', () => {
        it('renders all four section headings', () => {
            render(<CampaignAdmin {...defaultProps} />);
            sectionHeadings.forEach((heading) => {
                expect(screen.getByText(heading)).toBeInTheDocument();
            });
        });

        it('renders section descriptions', () => {
            render(<CampaignAdmin {...defaultProps} />);
            expect(screen.getByText('Changes the display name. Character files, maps, and data are preserved.')).toBeInTheDocument();
            expect(screen.getByText('Permanently deletes the entire campaign and ALL its files. This cannot be undone.')).toBeInTheDocument();
            expect(screen.getByText('Removes all runtime state (HP, conditions, spell slots, death saves, target effects, active buffs, and position data).')).toBeInTheDocument();
            expect(screen.getByText('Deletes all entries from the campaign log. Roll history, combat events, and ability use records will be permanently lost.')).toBeInTheDocument();
            expect(screen.getByText('Clears both the campaign log and change data in one action. Use to fix corrupted campaign state.')).toBeInTheDocument();
            expect(screen.getByText('Creates a timestamped zip backup of the entire campaign folder on the server. Snapshots are kept (newest 10) and never overwrite each other, so you can roll back more than one step.')).toBeInTheDocument();
            expect(screen.getByText('Downloads the entire campaign folder as a .zip file to your computer.')).toBeInTheDocument();
            expect(screen.getByText('Restores the campaign to the last snapshot. All changes since the snapshot will be lost.')).toBeInTheDocument();
            expect(screen.getByText('Replaces the current campaign with an uploaded .zip file. A safety snapshot is saved first and used if upload fails.')).toBeInTheDocument();
        });
    });

    describe('action buttons', () => {
        it('renders the theme toggle button with correct icon for dark theme', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const btn = screen.getByRole('button', { name: /switch to/i });
            expect(btn).toBeInTheDocument();
            expect(btn.querySelector('i.fa-sun')).toBeInTheDocument();
            expect(btn.textContent).toContain('Switch to Light Mode');
        });

        it('renders all rename campaign action buttons', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameButtons = screen.getAllByRole('button', { name: /rename campaign/i });
            expect(renameButtons.length).toBeGreaterThanOrEqual(1);
        });

        it('renders all data management action buttons', () => {
            render(<CampaignAdmin {...defaultProps} />);
            expect(screen.getByRole('button', { name: 'Clear Change Data' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Clear Campaign Log' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Full Reset' })).toBeInTheDocument();
        });

        it('renders all backup & restore action buttons', () => {
            render(<CampaignAdmin {...defaultProps} />);
            expect(screen.getByRole('button', { name: 'Create Snapshot' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Download Campaign' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Rollback to Snapshot' })).toBeInTheDocument();
        });

        it('renders danger-styled action buttons', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const deleteBtn = screen.getByRole('button', { name: /delete campaign/i });
            expect(deleteBtn).toHaveClass('ct-btn-danger');

            const resetBtn = screen.getByRole('button', { name: 'Full Reset' });
            expect(resetBtn).toHaveClass('ct-btn-danger');

            const rollbackBtn = screen.getByRole('button', { name: 'Rollback to Snapshot' });
            expect(rollbackBtn).toHaveClass('ct-btn-danger');
        });

        it('renders primary-styled action buttons', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const clearChangeBtn = screen.getByRole('button', { name: 'Clear Change Data' });
            expect(clearChangeBtn).toHaveClass('ct-btn-primary');

            const clearLogBtn = screen.getByRole('button', { name: 'Clear Campaign Log' });
            expect(clearLogBtn).toHaveClass('ct-btn-primary');

            const snapshotBtn = screen.getByRole('button', { name: 'Create Snapshot' });
            expect(snapshotBtn).toHaveClass('ct-btn-primary');

            const downloadBtn = screen.getByRole('button', { name: 'Download Campaign' });
            expect(downloadBtn).toHaveClass('ct-btn-primary');
        });

        it('renders the upload file input inside a label', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const uploadLabel = document.querySelector('.admin-upload-label');
            expect(uploadLabel).toBeInTheDocument();
            expect(uploadLabel.querySelector('input[type="file"]')).toBeInTheDocument();
            expect(uploadLabel.querySelector('input[type="file"]')).toHaveAttribute('accept', '.zip');
        });

        it('renders the available snapshots section', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ snapshots: [{ filename: 'test-campaign-2026-10-10T12-00-00-000.zip', size: 4096, timestamp: '2026-10-10T12:00:00.000Z' }] }),
                })
            );
            render(<CampaignAdmin {...defaultProps} />);
            expect(screen.getByRole('heading', { name: 'Available Snapshots' })).toBeInTheDocument();
            await waitFor(() => {
                expect(document.querySelector('.admin-snapshot-name')).toHaveTextContent('test-campaign-2026-10-10T12-00-00-000.zip');
            });
        });
    });

    describe('hidden elements (negative assertions)', () => {
        it('does not render the rename modal by default', () => {
            render(<CampaignAdmin {...defaultProps} />);
            expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
            expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
        });

        it('does not render any confirm modal by default', () => {
            render(<CampaignAdmin {...defaultProps} />);
            expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
            expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
        });

        it('does not render status messages by default', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const statusEl = document.querySelector('.admin-status');
            expect(statusEl).not.toBeInTheDocument();
        });
    });
});
