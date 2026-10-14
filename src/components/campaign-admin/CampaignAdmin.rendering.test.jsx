// @improved-by-ai
/**
 * Rendering smoke tests for CampaignAdmin: what the admin view looks like
 * on load, before any interaction. Verifies structure (header, section
 * headings, action cards pairing heading + warning copy + button), theme
 *-aware labels, and idle negative paths (no modals, no status messaging).
 *
 * Interaction flows are covered by sibling files and are deliberately NOT
 * repeated here: rename, delete, data-management, backup-restore,
 * rollback-upload, and theme-toggle tests, plus EnforcementSection,
 * SessionSection, and AiRefereeSection unit tests (this file only asserts
 * those consoles are mounted into the admin view).
 *
 * fetch and EventSource are inert globally (src/test/setup.js), so no
 * test here can reach a live server; every campaign name used is a
 * test-campaign variant.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';

const createDefaultProps = (overrides = {}) => ({
    campaignName: CAMPAIGN,
    onBack: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

const renderAdmin = (overrides = {}) => {
    const props = createDefaultProps(overrides);
    const utils = render(<CampaignAdmin {...props} />);
    return { props, ...utils };
};

// Every destructive-affordance button must carry the danger class so the GM
// can visually tell it apart from routine actions.
const DANGER_BUTTONS = ['Delete Campaign', 'Full Reset', 'Rollback to Snapshot'];
const PRIMARY_BUTTONS = ['Rename Campaign', 'Clear Change Data', 'Clear Campaign Log', 'Create Snapshot', 'Download Campaign'];

// One entry per Backup & Restore / Data Management / Campaign Management card:
// the card must pair its title, its user-facing warning copy, and a working
// (enabled, correctly styled) action button. The Upload card is checked
// separately — its control is a file-input label, not a button.
const ACTION_CARDS = [
    {
        heading: 'Rename Campaign',
        button: 'Rename Campaign',
        cls: 'ct-btn-primary',
        description: 'Changes the display name. Character files, maps, and data are preserved.',
    },
    {
        heading: 'Delete Campaign',
        button: 'Delete Campaign',
        cls: 'ct-btn-danger',
        description: 'Permanently deletes the entire campaign and ALL its files. This cannot be undone.',
    },
    {
        heading: 'Clear Change Data',
        button: 'Clear Change Data',
        cls: 'ct-btn-primary',
        description: 'Removes all runtime state (HP, conditions, spell slots, death saves, target effects, active buffs, and position data).',
    },
    {
        heading: 'Clear Campaign Log',
        button: 'Clear Campaign Log',
        cls: 'ct-btn-primary',
        description: 'Deletes all entries from the campaign log. Roll history, combat events, and ability use records will be permanently lost.',
    },
    {
        heading: 'Full Reset',
        button: 'Full Reset',
        cls: 'ct-btn-danger',
        description: 'Clears both the campaign log and change data in one action. Use to fix corrupted campaign state.',
    },
    {
        heading: 'Snapshot',
        button: 'Create Snapshot',
        cls: 'ct-btn-primary',
        description: 'Creates a timestamped zip backup of the entire campaign folder on the server. Snapshots are kept (newest 10) and never overwrite each other, so you can roll back more than one step.',
    },
    {
        heading: 'Download',
        button: 'Download Campaign',
        cls: 'ct-btn-primary',
        description: 'Downloads the entire campaign folder as a .zip file to your computer.',
    },
    {
        heading: 'Rollback',
        button: 'Rollback to Snapshot',
        cls: 'ct-btn-danger',
        description: 'Restores the campaign to the last snapshot. All changes since the snapshot will be lost.',
    },
];

describe('CampaignAdmin - Rendering', () => {
    describe('container and header', () => {
        it('renders the campaign-admin container with the campaign name in the header', () => {
            // Special characters must appear verbatim in the header.
            for (const campaignName of [CAMPAIGN, 'my campaign/1']) {
                const { container, unmount } = renderAdmin({ campaignName });
                expect(container.querySelector('.ct-container.campaign-admin')).toBeInTheDocument();
                expect(screen.getByRole('heading', { level: 2, name: `Admin — ${campaignName}` })).toBeInTheDocument();
                unmount();
            }
        });

        it('renders a Back button in the header', () => {
            renderAdmin();
            expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
        });
    });

    describe('sections', () => {
        it('renders all four core section headings', () => {
            renderAdmin();
            ['Appearance', 'Campaign Management', 'Data Management', 'Backup & Restore'].forEach((heading) => {
                expect(screen.getByRole('heading', { level: 3, name: heading })).toBeInTheDocument();
            });
        });

        it('mounts the Enforcement, Session, and AI Referee consoles', () => {
            // These child sections have their own test files for behavior;
            // here we only verify the admin view wires them in.
            renderAdmin();
            expect(screen.getByRole('heading', { level: 3, name: /Enforcement/ })).toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 3, name: /Session/ })).toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 3, name: /AI Referee/ })).toBeInTheDocument();
        });
    });

    describe('action cards', () => {
        describe.each(ACTION_CARDS)('$heading card', ({ heading, button, cls, description }) => {
            it('pairs the title with its warning copy and an enabled, correctly styled button', () => {
                renderAdmin();

                const card = screen.getByRole('heading', { level: 3, name: heading }).closest('.admin-action');
                expect(card).not.toBeNull();
                // The description belongs to THIS card, not just somewhere on the page.
                expect(card).toHaveTextContent(description);

                const btn = screen.getByRole('button', { name: button });
                expect(btn).toHaveClass(cls);
                expect(btn.closest('.admin-action')).toBe(card);
                // Idle on load: nothing is mid-flight, so nothing is disabled.
                expect(btn).toBeEnabled();
            });
        });

        it('wraps the upload file input in a clickable label with its warning copy', () => {
            const { container } = renderAdmin();

            const card = screen.getByRole('heading', { level: 3, name: 'Upload' }).closest('.admin-action');
            expect(card).toHaveTextContent('Replaces the current campaign with an uploaded .zip file. A safety snapshot is saved first and used if upload fails.');

            // The label carries the primary-button styling and contains the input,
            // so clicking the styled "Upload Campaign" control opens the file picker.
            const uploadLabel = container.querySelector('label.admin-upload-label');
            expect(uploadLabel).toBeInTheDocument();
            expect(uploadLabel).toHaveClass('ct-btn-primary');
            expect(uploadLabel.querySelector('input[type="file"]')).toBeInTheDocument();
        });

        it('marks exactly the destructive buttons with danger styling and the routine ones as primary', () => {
            renderAdmin();
            DANGER_BUTTONS.forEach((name) => {
                expect(screen.getByRole('button', { name })).toHaveClass('ct-btn-danger');
            });
            PRIMARY_BUTTONS.forEach((name) => {
                expect(screen.getByRole('button', { name })).toHaveClass('ct-btn-primary');
            });
            // A button must not be styled as both safe and destructive.
            DANGER_BUTTONS.forEach((name) => {
                expect(screen.getByRole('button', { name })).not.toHaveClass('ct-btn-primary');
            });
        });
    });

    describe('theme toggle', () => {
        it('labels the toggle for the opposite of the current theme', () => {
            const { unmount } = renderAdmin({ theme: 'dark' });
            expect(screen.getByRole('button', { name: 'Switch to Light Mode' })).toBeInTheDocument();
            unmount();

            renderAdmin({ theme: 'light' });
            expect(screen.getByRole('button', { name: 'Switch to Dark Mode' })).toBeInTheDocument();
        });
    });

    describe('idle state (negative assertions)', () => {
        it('shows no modals until an action opens one', () => {
            const { container } = renderAdmin();
            expect(container.querySelectorAll('.ct-modal-overlay')).toHaveLength(0);
            expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        });

        it('shows no status, busy, or restore messaging before anything happens', () => {
            const { container } = renderAdmin();
            expect(container.querySelector('.admin-status')).not.toBeInTheDocument();
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            expect(screen.queryByText(/Campaign restored from/)).not.toBeInTheDocument();
            ['Creating snapshot...', 'Rolling back...', 'Preparing download...', 'Uploading and extracting...', 'Clearing change data...', 'Clearing log...', 'Performing full reset...'].forEach((busyText) => {
                expect(screen.queryByText(busyText)).not.toBeInTheDocument();
            });
        });
    });
});
