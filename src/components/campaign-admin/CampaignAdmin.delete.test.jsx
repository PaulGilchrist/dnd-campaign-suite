// @maintained-by-ai 2026-11-26
/**
 * Behavior tests for the "Delete Campaign" flow (handleDeleteConfirm).
 *
 * Lane migrated off the native prompt→confirm→confirm→alert chain to the
 * shared DeleteConfirmModal role="dialog" tier (backlog 2026-11-04 CO):
 * the typed-name gate lives INSIDE the dialog, there is ONE confirm button
 * that renders DISABLED until the typed name matches (owner decision
 * 2026-11-11 — flipped from the old enabled-until-click gate; match is
 * trimmed + case-insensitive per backlog 2026-11-16 XC), and failure
 * copy is inline (role="alert") — never a native prompt/confirm/alert.
 * OWNED here: arm → type → disabled-gate → DELETE semantics.
 * The dialog chrome itself (aria-modal, focus trap, Escape/backdrop
 * dismiss routing) stays pinned by common/DeleteConfirmModal.test.jsx —
 * only this host's Cancel lane (dialog closes, zero writes) is pinned here.
 * The campaign-lock disclosure note is pinned by the sibling
 * CampaignAdmin.delete-lock.test.jsx; the data-wipe trio is a separate
 * lane owned by CampaignAdmin.data-management.test.jsx.
 *
 * Safety: fetch is stubbed in beforeEach and restored in afterEach, so no
 * DELETE can ever reach a live server. Only test-campaign (and a display-only
 * variant used strictly to exercise exact-name matching and URL encoding) is
 * ever passed to the component.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';

const createDefaultProps = (overrides = {}) => ({
    campaignName: CAMPAIGN,
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

const jsonResponse = (ok, body) => ({ ok, json: () => Promise.resolve(body) });

const WAIT_OPTIONS = { timeout: 2000 };

describe('CampaignAdmin - Delete Campaign', () => {
    let saved;
    let fetchSpy;

    beforeEach(() => {
        saved = {
            prompt: window.prompt,
            confirm: window.confirm,
            alert: window.alert,
            fetch: global.fetch,
            location: window.location,
        };
        sessionStorage.clear();
        // Every native dialog channel is spied so a regression back to
        // prompt/confirm/alert fails, and a test that forgets consent can
        // never trigger a real deletion (fetch is stubbed anyway).
        window.prompt = vi.fn();
        window.confirm = vi.fn(() => false);
        window.alert = vi.fn();
        fetchSpy = vi.fn(() => Promise.resolve(jsonResponse(true, {})));
        global.fetch = fetchSpy;
        Object.defineProperty(window, 'location', {
            value: { reload: vi.fn() },
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        window.prompt = saved.prompt;
        window.confirm = saved.confirm;
        window.alert = saved.alert;
        global.fetch = saved.fetch;
        Object.defineProperty(window, 'location', {
            value: saved.location,
            writable: true,
            configurable: true,
        });
    });

    const renderCampaignAdmin = (props = {}) =>
        render(<CampaignAdmin {...createDefaultProps(props)} />);

    const openDeleteModal = (props = {}) => {
        renderCampaignAdmin(props);
        fireEvent.click(screen.getByRole('button', { name: 'Delete Campaign' }));
        return screen.getByRole('dialog', { name: 'Delete Campaign' });
    };

    const typedInput = () =>
        screen.getByLabelText(/Type the exact campaign name/i);

    const confirmButton = (name = CAMPAIGN) =>
        screen.getByRole('button', { name: `Delete "${name}"` });

    const type = (typed) =>
        fireEvent.change(typedInput(), { target: { value: typed } });

    const clickConfirm = (name = CAMPAIGN) =>
        fireEvent.click(confirmButton(name));

    const typeAndConfirm = (typed) => {
        type(typed);
        clickConfirm();
    };

    // The view GETs /admin/snapshots on mount — scope fetch assertions to DELETEs.
    const deleteRequests = () =>
        fetchSpy.mock.calls.filter(([, options]) => options?.method === 'DELETE');

    // Answer only the DELETE call differently; every other fetch succeeds.
    const stubDeleteOutcome = ({ response, error }) => {
        fetchSpy.mockImplementation((url, options) => {
            if (options?.method !== 'DELETE') {
                return Promise.resolve(jsonResponse(true, {}));
            }
            return error
                ? Promise.reject(error)
                : Promise.resolve(response ?? jsonResponse(true, {}));
        });
    };

    const expectNoNativeDialogs = () => {
        expect(window.prompt).not.toHaveBeenCalled();
        expect(window.confirm).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
    };

    const expectZeroWrites = () => {
        expect(deleteRequests()).toHaveLength(0);
        expect(window.location.reload).not.toHaveBeenCalled();
        expect(sessionStorage.getItem('postDeleteNotice')).toBeNull();
        expectNoNativeDialogs();
    };

    const waitForDeletion = async (expectedUrl = `/api/campaigns/${CAMPAIGN}`, expectedNotice = CAMPAIGN) => {
        await waitFor(() => {
            expect(deleteRequests()).toHaveLength(1);
        }, WAIT_OPTIONS);
        expect(fetchSpy).toHaveBeenCalledWith(expectedUrl, { method: 'DELETE' });
        await waitFor(() => {
            expect(window.location.reload).toHaveBeenCalledTimes(1);
        }, WAIT_OPTIONS);
        expectNoNativeDialogs();
        // Post-delete carry-over (backlog CP 2026-11-04): the success reload
        // arms the one-shot sessionStorage notice the selection page consumes
        // (raw name — the notice names what was deleted, URL encoding is the
        // transport's business only). Consumer rendering is pinned in
        // campaign-selection/CampaignSelection.post-delete-notice.test.jsx.
        expect(JSON.parse(sessionStorage.getItem('postDeleteNotice'))).toEqual({
            campaign: expectedNotice,
        });
    };

    describe('role=dialog modal', () => {
        it('opens a host dialog naming the full loss, with the typed-name input and exactly one destructive confirm', () => {
            const dialog = openDeleteModal();
            expect(dialog).toHaveTextContent(
                `This will permanently delete the entire campaign '${CAMPAIGN}'`
            );
            expect(typedInput()).toBeInTheDocument();
            // Backlog 2026-11-18 LA: the raw probe read ph:"" here — the
            // campaign-delete host now echoes the exact token into the
            // placeholder (gate + label-derived accessible name unchanged).
            expect(typedInput()).toHaveAttribute('placeholder', CAMPAIGN);
            // ONE destructive confirm inside the dialog (the trigger button
            // behind the backdrop is not part of the dialog). aria-modal /
            // dismiss routing are the shared tier's contract, pinned in
            // common/DeleteConfirmModal.test.jsx.
            expect(
                within(dialog).getAllByRole('button').map((b) => b.textContent.trim())
            ).toEqual(['Cancel', `Delete "${CAMPAIGN}"`]);
            expectNoNativeDialogs();
        });
    });

    describe('typed-name gate', () => {
        // Owner decision 2026-11-11: the gate lives IN the button — the
        // confirm renders disabled until the typed name matches. Backlog
        // 2026-11-16 XC: the match is trimmed + case-insensitive (the confirm
        // label already displays the true name verbatim, so a caps-lock slip
        // must not silently disable the one affordance); empty/whitespace-only
        // input and names differing by more than case/whitespace stay
        // disabled, even when clicked. The handler guard stays as a fallback
        // that a real click can no longer reach.
        it('renders the confirm disabled on open (empty input)', () => {
            openDeleteModal();
            expect(confirmButton()).toBeDisabled();
            expectZeroWrites();
        });

        it.each([
            { typed: '', label: 'left empty' },
            { typed: '   ', label: 'only whitespace' },
            { typed: 'wrong-name', label: 'a different name' },
            { typed: CAMPAIGN.slice(0, -1), label: 'missing the final character' },
            { typed: `${CAMPAIGN}x`, label: 'carrying an extra character' },
        ])('keeps the confirm disabled and inert to clicks while the name is $label', ({ typed }) => {
            openDeleteModal();
            type(typed);
            expect(confirmButton()).toBeDisabled();
            clickConfirm(); // React suppresses onClick on a disabled button
            expect(screen.queryByRole('dialog', { name: 'Delete Campaign' })).toBeInTheDocument();
            expectZeroWrites();
        });

        it('enables for a case-flipped AND padded match, keeps the label on the TRUE name, and deletes the TRUE name', async () => {
            // One variant exercising both match sub-branches (trim +
            // case-insensitive, backlog 2026-11-16 XC): the confirm label
            // displays the true campaign name verbatim regardless of what was
            // typed, and the DELETE + notice carry the TRUE name.
            openDeleteModal();
            type(`  ${CAMPAIGN.toUpperCase()}  `);
            expect(confirmButton()).toBeEnabled();
            clickConfirm();
            await waitForDeletion();
        });

        it('re-disables on an edit back to a mismatch (both whitespace and text)', () => {
            // Pins that the gate tracks every keystroke — a once-enabled
            // confirm must not latch open.
            openDeleteModal();
            type(`  ${CAMPAIGN}  `);
            expect(confirmButton()).toBeEnabled();
            type('wrong-name');
            expect(confirmButton()).toBeDisabled();
            type(CAMPAIGN);
            expect(confirmButton()).toBeEnabled();
            type('   ');
            expect(confirmButton()).toBeDisabled();
        });
    });

    describe('cancel affordance', () => {
        it('dismisses the dialog with zero deletion and no reload', () => {
            openDeleteModal();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByRole('dialog', { name: 'Delete Campaign' })).not.toBeInTheDocument();
            expectZeroWrites();
        });
    });

    describe('DELETE request', () => {
        it('sends exactly one DELETE and reloads after the exact name is confirmed', async () => {
            openDeleteModal();
            typeAndConfirm(CAMPAIGN);
            await waitForDeletion();
        });

        it('URL-encodes campaign names with reserved characters', async () => {
            const name = 'test campaign/1';
            openDeleteModal({ campaignName: name });
            type(name);
            clickConfirm(name);
            await waitForDeletion('/api/campaigns/test%20campaign%2F1', name);
        });
    });

    describe('failure lanes', () => {
        it.each([
            { label: 'server error message', response: jsonResponse(false, { error: 'Campaign not found' }), message: 'Campaign not found' },
            { label: 'generic fallback', response: jsonResponse(false, {}), message: 'Unknown error' },
            { label: 'network rejection', error: new Error('Network failed'), message: 'Network failed' },
        ])('shows "$message" inline without reloading on $label', async ({ response, error, message }) => {
            openDeleteModal();
            stubDeleteOutcome({ response, error });
            typeAndConfirm(CAMPAIGN);

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent(
                    `Failed to delete campaign: ${message}`
                );
            }, WAIT_OPTIONS);
            // The dialog stays open for a retry; nothing else fires.
            expect(screen.getByRole('dialog', { name: 'Delete Campaign' })).toBeInTheDocument();
            expect(deleteRequests()).toHaveLength(1);
            expect(window.location.reload).not.toHaveBeenCalled();
            expect(sessionStorage.getItem('postDeleteNotice')).toBeNull();
            expectNoNativeDialogs();
        });
    });
});
