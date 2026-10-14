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

describe('URL encoding', () => {
    beforeEach(() => {
        window.confirm = vi.fn(() => true);
    });

    it.each([
        { campaignName: 'my campaign/1', encoded: 'my%20campaign%2F1' },
        { campaignName: 'campaign & stuff', encoded: 'campaign%20%26%20stuff' },
        { campaignName: 'a#b?c', encoded: 'a%23b%3Fc' },
    ])('URL-encodes special characters in campaign name for $campaignName', async ({ campaignName, encoded }) => {
        const action = { name: 'Clear Change Data' };
        global.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Done' }) })
        );

        render(<CampaignAdmin {...createDefaultProps({ campaignName })} />);
        fireEvent.click(screen.getByRole('button', { name: action.name }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                `/api/campaigns/${encoded}/admin/clear-change-data`,
                { method: 'POST' }
            );
        });
    });
});
