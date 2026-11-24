// @maintained-by-ai
/**
 * Clear Change Data stale-sessions advisory (backlog XY 2026-11-23): the
 * success strip must carry an honest per-lane note that only the initiative
 * board retires live in open tabs — every other cleared key keeps its local
 * mirror until each tab reloads. The note rides the existing
 * .admin-status--success strip (no new modal tier), is scoped to the
 * change-data lane (Clear Campaign Log stays bare), and never fabricates a
 * connected-session count (no cheap GET exposes the server's SSE subscriber
 * array to the client).
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';

const ADVISORY = 'The initiative board retires live in every open tab, but other cleared state (HP, conditions, spell slots, effects) may keep showing on all open tabs — including this one — until each tab reloads.';

const jsonResponse = (body, ok = true) => ({ ok, json: () => Promise.resolve(body) });

// Confirm-button labels of the shared wipe dialog per toolbar trigger.
const WIPE_YES = {
    'Clear Change Data': 'Yes, Clear Change Data',
    'Clear Campaign Log': 'Yes, Clear Log',
    'Full Reset': 'Yes, Full Reset',
};

function stubFetch() {
    vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/admin/snapshots')) {
            return Promise.resolve(jsonResponse({ snapshots: [] }));
        }
        if (url.endsWith('/admin/change-data-census')) {
            return Promise.resolve(jsonResponse({ totalKeys: 0, unknownKeys: [] }));
        }
        if (/\/admin\/(clear-change-data|clear-log)$/.test(url)) {
            return Promise.resolve(jsonResponse({ message: 'Cleared' }));
        }
        return Promise.resolve(jsonResponse({}));
    }));
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
    stubFetch();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('Clear Change Data success advisory', () => {
    it('renders the honest per-lane advisory inside the same success strip', async () => {
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Clear Change Data' }));
        const wipeDialog = screen.getByRole('dialog', { name: 'Clear Change Data' });
        fireEvent.click(within(wipeDialog).getByRole('button', { name: WIPE_YES['Clear Change Data'] }));

        const success = await screen.findByText('Cleared');
        const strip = success.closest('.admin-status');
        expect(strip).toHaveClass('admin-status--success');

        const advisory = strip.querySelector('.admin-status-advisory');
        expect(advisory).not.toBeNull();
        expect(advisory).toHaveTextContent(ADVISORY);
        // Honest per lane: the initiative board retires — the note must never
        // claim the board itself stays stale.
        expect(advisory.textContent).toMatch(/initiative board retires live/i);
        // Generic wording only: never a fabricated connected-session number.
        expect(advisory.textContent).not.toMatch(/\d+\s+(connected|sessions|tabs|clients)/i);
    });

    it('keeps the Clear Campaign Log success strip bare (advisory is change-data scoped)', async () => {
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Clear Campaign Log' }));
        const wipeDialog = screen.getByRole('dialog', { name: 'Clear Campaign Log' });
        fireEvent.click(within(wipeDialog).getByRole('button', { name: WIPE_YES['Clear Campaign Log'] }));

        const success = await screen.findByText('Cleared');
        expect(success.closest('.admin-status')).toHaveClass('admin-status--success');
        expect(document.querySelector('.admin-status-advisory')).toBeNull();
    });

    it('shows no advisory on the error face when the clear is refused', async () => {
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (url.endsWith('/admin/change-data-census')) {
                return Promise.resolve(jsonResponse({ totalKeys: 0, unknownKeys: [] }));
            }
            if (url.endsWith('/admin/clear-change-data')) {
                return Promise.resolve(jsonResponse({ error: 'Only available on localhost' }, false));
            }
            return Promise.resolve(jsonResponse({}));
        }));
        render(<CampaignAdmin {...createDefaultProps()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Clear Change Data' }));
        const wipeDialog = screen.getByRole('dialog', { name: 'Clear Change Data' });
        fireEvent.click(within(wipeDialog).getByRole('button', { name: WIPE_YES['Clear Change Data'] }));

        const error = await screen.findByText('Only available on localhost');
        expect(error.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(document.querySelector('.admin-status-advisory')).toBeNull();
    });
});
