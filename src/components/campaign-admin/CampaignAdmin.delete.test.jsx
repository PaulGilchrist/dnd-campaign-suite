// @maintained-by-ai
/**
 * Behavior tests for the "Delete Campaign" flow (handleDeleteConfirm).
 *
 * Lane migrated off the native prompt→confirm→confirm→alert chain to the
 * shared DeleteConfirmModal role="dialog" tier (backlog 2026-11-04 CO):
 * the typed-name gate lives INSIDE the dialog, there is ONE confirm button,
 * and mismatch/failure copy is inline (role="alert") — never a native
 * prompt/confirm/alert. OWNED here: arm → type → gate → DELETE semantics;
 * the dialog chrome/focus trap itself stays pinned by
 * common/DeleteConfirmModal.test.jsx.
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
const MISMATCH_COPY = 'Campaign name did not match. Deletion cancelled.';

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

    const clickDeleteCampaign = () =>
        fireEvent.click(screen.getByRole('button', { name: 'Delete Campaign' }));

    const openDeleteModal = (props = {}) => {
        renderCampaignAdmin(props);
        clickDeleteCampaign();
        return screen.getByRole('dialog', { name: 'Delete Campaign' });
    };

    const typedInput = () =>
        screen.getByLabelText(/Type the exact campaign name/i);

    const clickConfirm = () =>
        fireEvent.click(screen.getByRole('button', { name: `Delete "${CAMPAIGN}"` }));

    const typeAndConfirm = (typed) => {
        fireEvent.change(typedInput(), { target: { value: typed } });
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

    const waitForDeletion = async (expectedUrl = `/api/campaigns/${CAMPAIGN}`) => {
        await waitFor(() => {
            expect(deleteRequests()).toHaveLength(1);
        }, WAIT_OPTIONS);
        expect(fetchSpy).toHaveBeenCalledWith(expectedUrl, { method: 'DELETE' });
        await waitFor(() => {
            expect(window.location.reload).toHaveBeenCalledTimes(1);
        }, WAIT_OPTIONS);
        expectNoNativeDialogs();
    };

    describe('role=dialog modal', () => {
        it('opens a labelled dialog with the typed-name input and exactly one destructive confirm', () => {
            openDeleteModal();
            const dialog = screen.getByRole('dialog', { name: 'Delete Campaign' });
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveTextContent(
                `This will permanently delete the entire campaign '${CAMPAIGN}'`
            );
            expect(typedInput()).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
            // ONE destructive confirm inside the dialog (the trigger button
            // behind the backdrop is not part of the dialog).
            expect(
                within(dialog).getAllByRole('button').map((b) => b.textContent.trim())
            ).toEqual(['Cancel', `Delete "${CAMPAIGN}"`]);
            expectNoNativeDialogs();
        });
    });

    describe('exact-name gate', () => {
        it.each([
            { typed: '', label: 'left empty' },
            { typed: 'Test-Campaign', label: 'typed with different casing' },
            { typed: ` ${CAMPAIGN} `, label: 'padded with spaces' },
        ])('shows inline copy and keeps the dialog open when the name is $label', ({ typed }) => {
            openDeleteModal();
            typeAndConfirm(typed);

            expect(screen.getByRole('alert')).toHaveTextContent(MISMATCH_COPY);
            expect(screen.getByRole('dialog', { name: 'Delete Campaign' })).toBeInTheDocument();
            expect(deleteRequests()).toHaveLength(0);
            expect(window.location.reload).not.toHaveBeenCalled();
            expectNoNativeDialogs();
        });

        it('recovers: a mismatch followed by the exact name deletes', async () => {
            openDeleteModal();
            typeAndConfirm('wrong-name');
            expect(screen.getByRole('alert')).toHaveTextContent(MISMATCH_COPY);

            typeAndConfirm(CAMPAIGN);
            await waitForDeletion();
        });
    });

    describe('cancel affordance', () => {
        it('dismisses the dialog with zero deletion and no reload', () => {
            openDeleteModal();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByRole('dialog', { name: 'Delete Campaign' })).not.toBeInTheDocument();
            expect(deleteRequests()).toHaveLength(0);
            expect(window.location.reload).not.toHaveBeenCalled();
            expectNoNativeDialogs();
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
            fireEvent.change(typedInput(), { target: { value: name } });
            fireEvent.click(screen.getByRole('button', { name: `Delete "${name}"` }));
            await waitForDeletion('/api/campaigns/test%20campaign%2F1');
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
            expect(screen.getByRole('dialog', { name: 'Delete Campaign' })).toBeInTheDocument();
            expect(deleteRequests()).toHaveLength(1);
            expect(window.location.reload).not.toHaveBeenCalled();
            expectNoNativeDialogs();
        });
    });
});
