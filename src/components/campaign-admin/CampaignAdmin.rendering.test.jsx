// @maintained-by-ai
/**
 * Rendering smoke tests for CampaignAdmin: what the admin view looks like
 * on load, before any interaction. One render per behavioral contract:
 * header, section headings (child consoles wired in), the action-card
 * table (heading + warning copy + enabled, correctly styled control, one
 * loop), the upload label, and the idle negative path.
 *
 * Interaction flows are covered by sibling files and are deliberately NOT
 * repeated here: rename (incl. modal chrome), delete, data-management,
 * backup-restore, rollback-upload (incl. the restoredSnapshot banner
 * positive path), and theme-toggle/Back interactions — the theme-toggle
 * sibling also fully covers the static toggle labels (both modes, with
 * icons), so no static label assertions live here.
 * EnforcementSection, SessionSection, and AiRefereeSection have their own
 * unit tests; this file only asserts those consoles are mounted.
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

// One entry per Backup & Restore / Data Management / Campaign Management
// button card: the card must pair its title, its user-facing warning copy,
// and a working (enabled, correctly styled) action button. Destructive
// actions carry ct-btn-danger, routine ones ct-btn-primary — never both.
// The Upload card is checked separately: its control is a file-input label.
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

// Status wording that must only appear once an action is in flight.
const BUSY_TEXTS = ['Creating snapshot...', 'Rolling back...', 'Preparing download...', 'Uploading and extracting...', 'Clearing change data...', 'Clearing log...', 'Performing full reset...'];

describe('CampaignAdmin - Rendering', () => {
    it('renders the admin container with the campaign name and a Back button in the header', () => {
        const { container } = renderAdmin();
        expect(container.querySelector('.ct-container.campaign-admin')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: `Admin — ${CAMPAIGN}` })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    });

    it('renders all section headings, mounting the Enforcement, Session, and AI Referee consoles', () => {
        // The child consoles have their own test files for behavior;
        // here we only verify the admin view wires them in.
        renderAdmin();
        ['Appearance', 'Campaign Management', 'Data Management', 'Backup & Restore'].forEach((heading) => {
            expect(screen.getByRole('heading', { level: 3, name: heading })).toBeInTheDocument();
        });
        [/Enforcement/, /Session/, /AI Referee/].forEach((heading) => {
            expect(screen.getByRole('heading', { level: 3, name: heading })).toBeInTheDocument();
        });
    });

    it('pairs every action card title with its warning copy and an enabled, correctly styled button', () => {
        renderAdmin();
        ACTION_CARDS.forEach(({ heading, button, cls, description }) => {
            const card = screen.getByRole('heading', { level: 3, name: heading }).closest('.admin-action');
            expect(card).not.toBeNull();
            // The description belongs to THIS card, not just somewhere on the page.
            expect(card).toHaveTextContent(description);

            const btn = screen.getByRole('button', { name: button });
            expect(btn.closest('.admin-action')).toBe(card);
            expect(btn).toHaveClass(cls);
            // A button must not be styled as both safe and destructive.
            expect(btn).not.toHaveClass(cls === 'ct-btn-danger' ? 'ct-btn-primary' : 'ct-btn-danger');
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
        const input = uploadLabel.querySelector('input[type="file"]');
        expect(input).toBeInTheDocument();
        expect(input).toBeEnabled();
    });

    it('renders idle: no modals, status, busy, or restore messaging before anything happens', () => {
        // The positive paths (modals, statuses, restoredSnapshot banner) are
        // exercised by the rename/delete/rollback/data-management siblings.
        const { container } = renderAdmin();
        expect(container.querySelectorAll('.ct-modal-overlay')).toHaveLength(0);
        expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(container.querySelector('.admin-status')).not.toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.queryByText(/Campaign restored from/)).not.toBeInTheDocument();
        BUSY_TEXTS.forEach((busyText) => {
            expect(screen.queryByText(busyText)).not.toBeInTheDocument();
        });
    });
});
