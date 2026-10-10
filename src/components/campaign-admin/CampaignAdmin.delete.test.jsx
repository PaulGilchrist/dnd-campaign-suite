// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const renderCampaignAdmin = (props = {}) =>
    render(<CampaignAdmin {...createDefaultProps(props)} />);

const clickDeleteButton = () => {
    const btn = screen.getByRole('button', { name: /delete campaign/i });
    fireEvent.click(btn);
    return btn;
};

describe('CampaignAdmin - Delete Campaign', () => {
    let originalPrompt;
    let originalConfirm;
    let originalAlert;
    let originalLocation;

    beforeEach(() => {
        originalPrompt = window.prompt;
        originalConfirm = window.confirm;
        originalAlert = window.alert;
        originalLocation = window.location;
        window.prompt = vi.fn();
        window.confirm = vi.fn(() => true);
        window.alert = vi.fn();
        Object.defineProperty(window, 'location', {
            value: { reload: vi.fn() },
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        window.prompt = originalPrompt;
        window.confirm = originalConfirm;
        window.alert = originalAlert;
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
            configurable: true,
        });
    });

    describe('prompt confirmation', () => {
        it.each([
            { campaignName: 'test-campaign', expected: 'test-campaign' },
            { campaignName: 'my-special-campaign', expected: 'my-special-campaign' },
        ])('prompts user with campaign name "$expected" for deletion confirmation', ({ campaignName }) => {
            renderCampaignAdmin({ campaignName });
            clickDeleteButton();

            expect(window.prompt).toHaveBeenCalledWith(
                `Type the exact campaign name to confirm deletion of "${campaignName}":`
            );
        });

        it.each([
            { input: null, name: 'user cancelled' },
            { input: '', name: 'empty string' },
            { input: 'wrong-name', name: 'mismatched name' },
        ])('cancels deletion when prompt returns %s (%s)', ({ input }) => {
            window.prompt.mockReturnValueOnce(input);
            renderCampaignAdmin();
            clickDeleteButton();

            expect(window.prompt).toHaveBeenCalled();
            expect(window.confirm).not.toHaveBeenCalled();
            if (input === null) {
                expect(window.alert).not.toHaveBeenCalled();
            } else {
                expect(window.alert).toHaveBeenCalledWith(
                    'Campaign name did not match. Deletion cancelled.'
                );
            }
        });
    });

    describe('double confirmation', () => {
        it('cancels when first confirmation is denied', () => {
            window.prompt.mockReturnValueOnce('test-campaign');
            window.confirm.mockReturnValueOnce(false);
            renderCampaignAdmin();
            clickDeleteButton();

            expect(window.confirm).toHaveBeenCalledTimes(1);
            expect(window.alert).not.toHaveBeenCalled();
        });

        it('cancels when second confirmation is denied', () => {
            window.prompt.mockReturnValueOnce('test-campaign');
            window.confirm.mockReturnValueOnce(true);
            window.confirm.mockReturnValueOnce(false);
            renderCampaignAdmin();
            clickDeleteButton();

            expect(window.confirm).toHaveBeenCalledTimes(2);
            expect(window.alert).not.toHaveBeenCalled();
        });

        it('does not call delete fetch when confirmations are denied', () => {
            const fetchSpy = vi.spyOn(global, 'fetch');
            window.prompt.mockReturnValueOnce('test-campaign');
            window.confirm.mockReturnValueOnce(false);
            renderCampaignAdmin();
            clickDeleteButton();

            expect(fetchSpy).not.toHaveBeenCalledWith(
                '/api/campaigns/test-campaign',
                expect.objectContaining({ method: 'DELETE' })
            );
            fetchSpy.mockRestore();
        });

        it('proceeds to API call only when all confirmations pass', () => {
            window.prompt.mockReturnValueOnce('test-campaign');
            window.confirm.mockReturnValueOnce(true);
            window.confirm.mockReturnValueOnce(true);
            const fetchSpy = vi.fn(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
            );
            global.fetch = fetchSpy;
            renderCampaignAdmin();
            clickDeleteButton();

            expect(fetchSpy).toHaveBeenCalledWith(
                '/api/campaigns/test-campaign',
                { method: 'DELETE' }
            );
        });
    });

    describe('API deletion', () => {
        const setupFetch = (response) => {
            global.fetch = vi.fn(() =>
                Promise.resolve(response)
            );
        };

        it('sends DELETE request to correct endpoint after all confirmations', async () => {
            window.prompt.mockReturnValueOnce('test-campaign');
            window.confirm.mockReturnValueOnce(true);
            window.confirm.mockReturnValueOnce(true);
            setupFetch({ ok: true, json: () => Promise.resolve({}) });

            renderCampaignAdmin();
            clickDeleteButton();

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/campaigns/test-campaign',
                    { method: 'DELETE' }
                );
            }, { timeout: 5000 });
        });

        it('URL-encodes the campaign name in the DELETE endpoint', async () => {
            window.prompt.mockReturnValueOnce('my campaign/1');
            window.confirm.mockReturnValueOnce(true);
            window.confirm.mockReturnValueOnce(true);
            setupFetch({ ok: true, json: () => Promise.resolve({}) });

            renderCampaignAdmin({ campaignName: 'my campaign/1' });
            clickDeleteButton();

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/campaigns/my%20campaign%2F1',
                    { method: 'DELETE' }
                );
            }, { timeout: 5000 });
        });

        it('shows error alert with server message on failed deletion', async () => {
            window.prompt.mockReturnValueOnce('test-campaign');
            window.confirm.mockReturnValueOnce(true);
            window.confirm.mockReturnValueOnce(true);
            setupFetch({ ok: false, json: () => Promise.resolve({ error: 'Delete failed' }) });

            renderCampaignAdmin();
            clickDeleteButton();

            await waitFor(() => {
                expect(window.alert).toHaveBeenCalledWith('Failed to delete campaign: Delete failed');
            }, { timeout: 5000 });
        });

        it('shows generic error when server returns error without message field', async () => {
            window.prompt.mockReturnValueOnce('test-campaign');
            window.confirm.mockReturnValueOnce(true);
            window.confirm.mockReturnValueOnce(true);
            setupFetch({ ok: false, json: () => Promise.resolve({}) });

            renderCampaignAdmin();
            clickDeleteButton();

            await waitFor(() => {
                expect(window.alert).toHaveBeenCalledWith('Failed to delete campaign: Unknown error');
            }, { timeout: 5000 });
        });

        it('shows error alert on network error', async () => {
            window.prompt.mockReturnValueOnce('test-campaign');
            window.confirm.mockReturnValueOnce(true);
            window.confirm.mockReturnValueOnce(true);
            global.fetch = vi.fn(() => Promise.reject(new Error('Network failed')));

            renderCampaignAdmin();
            clickDeleteButton();

            await waitFor(() => {
                expect(window.alert).toHaveBeenCalledWith('Failed to delete campaign: Network failed');
            }, { timeout: 5000 });
        });

        it('shows success alert and reloads on successful deletion', async () => {
            window.prompt.mockReturnValueOnce('test-campaign');
            window.confirm.mockReturnValueOnce(true);
            window.confirm.mockReturnValueOnce(true);
            setupFetch({ ok: true, json: () => Promise.resolve({}) });

            renderCampaignAdmin();
            clickDeleteButton();

            await waitFor(() => {
                expect(window.alert).toHaveBeenCalledWith('Campaign deleted successfully.');
                expect(window.location.reload).toHaveBeenCalledTimes(1);
            }, { timeout: 5000 });
        });
    });
});
