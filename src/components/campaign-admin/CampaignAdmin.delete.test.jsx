// @maintained-by-ai
/**
 * Behavior tests for the "Delete Campaign" flow (handleDeleteCampaign).
 *
 * Safety: fetch is stubbed in beforeEach and restored in afterEach, so no
 * DELETE can ever reach a live server. Only test-campaign (and a display-only
 * variant used strictly to exercise exact-name matching and URL encoding) is
 * ever passed to the component.
 *
 * Coverage map — each block is one distinct safety gate or outcome branch:
 *  - prompt: dismissed (silent abort) vs. non-exact input (empty / casing /
 *    whitespace) — each guards a different kind of accidental leniency
 *  - escalating confirms: decline at WARNING vs. decline at FINAL WARNING
 *  - success: exactly one DELETE to the URL-encoded endpoint, success alert,
 *    reload — only after every gate passes
 *  - failure: server error message, generic fallback, network rejection
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';
const MISMATCH_ALERT = 'Campaign name did not match. Deletion cancelled.';

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

    const openAndClickDelete = () => {
        renderCampaignAdmin();
        clickDeleteCampaign();
    };

    describe('exact-name prompt', () => {
        it.each([
            { typed: null, label: 'dismissed', alert: null },
            { typed: '', label: 'empty', alert: MISMATCH_ALERT },
            { typed: 'Test-Campaign', label: 'typed with different casing', alert: MISMATCH_ALERT },
            { typed: ` ${CAMPAIGN} `, label: 'padded with spaces', alert: MISMATCH_ALERT },
        ])('aborts when the prompt is $label', ({ typed, alert }) => {
            window.prompt.mockReturnValueOnce(typed);
            openAndClickDelete();

            expect(window.prompt).toHaveBeenCalledWith(
                `Type the exact campaign name to confirm deletion of "${CAMPAIGN}":`
            );
            if (alert) {
                expect(window.alert).toHaveBeenCalledWith(alert);
            } else {
                expect(window.alert).not.toHaveBeenCalled();
            }
            expect(window.confirm).not.toHaveBeenCalled();
            expect(deleteRequests()).toHaveLength(0);
            expect(window.location.reload).not.toHaveBeenCalled();
        });
    });

    describe('escalating confirmations', () => {
        it.each([
            { confirms: [false], lastWarning: 'permanently delete the entire campaign' },
            { confirms: [true, false], lastWarning: 'FINAL WARNING' },
        ])('aborts when the user declines at the last confirmation shown', ({ confirms, lastWarning }) => {
            consent({ confirms });
            openAndClickDelete();

            expect(window.confirm).toHaveBeenCalledTimes(confirms.length);
            expect(window.confirm).toHaveBeenLastCalledWith(
                expect.stringContaining(lastWarning)
            );
            expect(window.alert).not.toHaveBeenCalled();
            expect(deleteRequests()).toHaveLength(0);
            expect(window.location.reload).not.toHaveBeenCalled();
        });
    });

    describe('DELETE request', () => {
        it.each([
            { name: CAMPAIGN, url: `/api/campaigns/${CAMPAIGN}` },
            { name: 'test campaign/1', url: '/api/campaigns/test%20campaign%2F1' },
        ])('sends exactly one DELETE to $url and reloads only after every gate passes', async ({ name, url }) => {
            consent({ name });
            renderCampaignAdmin({ campaignName: name });
            clickDeleteCampaign();

            await waitFor(() => {
                expect(deleteRequests()).toHaveLength(1);
            }, WAIT_OPTIONS);
            expect(fetchSpy).toHaveBeenCalledWith(url, { method: 'DELETE' });
            expect(window.alert).toHaveBeenCalledWith('Campaign deleted successfully.');
            expect(window.location.reload).toHaveBeenCalledTimes(1);
        });

        it.each([
            { label: 'server error message', response: jsonResponse(false, { error: 'Campaign not found' }), message: 'Campaign not found' },
            { label: 'generic fallback', response: jsonResponse(false, {}), message: 'Unknown error' },
            { label: 'network rejection', error: new Error('Network failed'), message: 'Network failed' },
        ])('alerts "$message" without reloading on $label', async ({ response, error, message }) => {
            consent();
            stubDeleteOutcome({ response, error });
            openAndClickDelete();

            await waitFor(() => {
                expect(window.alert).toHaveBeenCalledWith(
                    `Failed to delete campaign: ${message}`
                );
            }, WAIT_OPTIONS);
            expect(deleteRequests()).toHaveLength(1);
            expect(window.location.reload).not.toHaveBeenCalled();
        });
    });
});
