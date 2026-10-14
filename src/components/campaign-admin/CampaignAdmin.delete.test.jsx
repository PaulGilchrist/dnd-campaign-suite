// @improved-by-ai
/**
 * Behavior tests for the "Delete Campaign" flow (handleDeleteCampaign).
 *
 * Safety: every test targets test-campaign only (or a display-only variant used
 * strictly to check exact-name matching and URL encoding). fetch is stubbed in
 * beforeEach and restored in afterEach, so no DELETE can ever reach a live server.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
        // Safe defaults: the user has NOT consented to anything yet, so a test
        // that forgets to answer a dialog can never trigger a real deletion.
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
        fireEvent.click(screen.getByRole('button', { name: /delete campaign/i }));

    // Walk the user through the safety gauntlet: type the name in the prompt,
    // then answer the escalating WARNING / FINAL WARNING confirmations.
    const consent = ({ name = CAMPAIGN, confirms = [true, true] } = {}) => {
        window.prompt.mockReturnValueOnce(name);
        confirms.forEach((answer) => window.confirm.mockReturnValueOnce(answer));
    };

    // The view GETs /admin/snapshots on mount — scope fetch assertions to DELETEs.
    const deleteRequests = () =>
        fetchSpy.mock.calls.filter(([, options]) => options?.method === 'DELETE');

    // Answer only the DELETE call differently; every other fetch succeeds.
    const stubDeleteResponse = (response) => {
        fetchSpy.mockImplementation((url, options) =>
            Promise.resolve(options?.method === 'DELETE' ? response : jsonResponse(true, {}))
        );
    };

    const openAndClickDelete = () => {
        renderCampaignAdmin();
        clickDeleteCampaign();
    };

    describe('exact-name prompt', () => {
        it('asks the user to type the exact campaign name before anything is deleted', () => {
            openAndClickDelete();

            expect(window.prompt).toHaveBeenCalledWith(
                `Type the exact campaign name to confirm deletion of "${CAMPAIGN}":`
            );
            expect(deleteRequests()).toHaveLength(0);
            expect(window.location.reload).not.toHaveBeenCalled();
        });

        it('silently aborts when the user dismisses the prompt', () => {
            window.prompt.mockReturnValueOnce(null);
            openAndClickDelete();

            expect(window.alert).not.toHaveBeenCalled();
            expect(window.confirm).not.toHaveBeenCalled();
            expect(deleteRequests()).toHaveLength(0);
            expect(window.location.reload).not.toHaveBeenCalled();
        });

        it.each([
            { typed: '', label: 'empty input' },
            { typed: 'wrong-name', label: 'a different name' },
            { typed: 'Test-Campaign', label: 'the name with different casing' },
            { typed: ` ${CAMPAIGN} `, label: 'the name padded with spaces' },
        ])('cancels with an alert when the typed name is not an exact match ($label)', ({ typed }) => {
            window.prompt.mockReturnValueOnce(typed);
            openAndClickDelete();

            expect(window.alert).toHaveBeenCalledWith(
                'Campaign name did not match. Deletion cancelled.'
            );
            expect(window.confirm).not.toHaveBeenCalled();
            expect(deleteRequests()).toHaveLength(0);
            expect(window.location.reload).not.toHaveBeenCalled();
        });
    });

    describe('double-warning confirmations', () => {
        it('aborts at the first warning when declined', () => {
            consent({ confirms: [false] });
            openAndClickDelete();

            expect(window.confirm).toHaveBeenCalledTimes(1);
            expect(window.confirm).toHaveBeenCalledWith(
                expect.stringContaining('permanently delete the entire campaign')
            );
            expect(window.alert).not.toHaveBeenCalled();
            expect(deleteRequests()).toHaveLength(0);
            expect(window.location.reload).not.toHaveBeenCalled();
        });

        it('aborts at the final warning when declined', () => {
            consent({ confirms: [true, false] });
            openAndClickDelete();

            expect(window.confirm).toHaveBeenCalledTimes(2);
            expect(window.confirm).toHaveBeenLastCalledWith(
                expect.stringContaining('FINAL WARNING')
            );
            expect(window.alert).not.toHaveBeenCalled();
            expect(deleteRequests()).toHaveLength(0);
            expect(window.location.reload).not.toHaveBeenCalled();
        });
    });

    describe('DELETE request', () => {
        it('sends exactly one DELETE request and reloads only after every confirmation passes', async () => {
            consent();
            openAndClickDelete();

            await waitFor(() => {
                expect(deleteRequests()).toHaveLength(1);
            }, WAIT_OPTIONS);
            expect(fetchSpy).toHaveBeenCalledWith(`/api/campaigns/${CAMPAIGN}`, { method: 'DELETE' });
            expect(window.alert).toHaveBeenCalledWith('Campaign deleted successfully.');
            expect(window.location.reload).toHaveBeenCalledTimes(1);
        });

        it('URL-encodes the campaign name in the DELETE endpoint', async () => {
            const name = 'test campaign/1';
            consent({ name });
            renderCampaignAdmin({ campaignName: name });
            clickDeleteCampaign();

            await waitFor(() => {
                expect(deleteRequests()).toHaveLength(1);
            }, WAIT_OPTIONS);
            expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test%20campaign%2F1', { method: 'DELETE' });
        });

        it('surfaces the server error and does not reload when deletion fails', async () => {
            consent();
            stubDeleteResponse(jsonResponse(false, { error: 'Campaign not found' }));
            openAndClickDelete();

            await waitFor(() => {
                expect(window.alert).toHaveBeenCalledWith(
                    'Failed to delete campaign: Campaign not found'
                );
            }, WAIT_OPTIONS);
            expect(window.location.reload).not.toHaveBeenCalled();
        });

        it('falls back to a generic error when the failure response carries no message', async () => {
            consent();
            stubDeleteResponse(jsonResponse(false, {}));
            openAndClickDelete();

            await waitFor(() => {
                expect(window.alert).toHaveBeenCalledWith(
                    'Failed to delete campaign: Unknown error'
                );
            }, WAIT_OPTIONS);
            expect(window.location.reload).not.toHaveBeenCalled();
        });

        it('reports network errors and does not reload', async () => {
            consent();
            fetchSpy.mockImplementation((url, options) =>
                options?.method === 'DELETE'
                    ? Promise.reject(new Error('Network failed'))
                    : Promise.resolve(jsonResponse(true, {}))
            );
            openAndClickDelete();

            await waitFor(() => {
                expect(window.alert).toHaveBeenCalledWith(
                    'Failed to delete campaign: Network failed'
                );
            }, WAIT_OPTIONS);
            expect(deleteRequests()).toHaveLength(1);
            expect(window.location.reload).not.toHaveBeenCalled();
        });
    });
});
