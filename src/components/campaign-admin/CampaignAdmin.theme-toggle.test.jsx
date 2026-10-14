import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const createDefaultProps = (overrides = {}) => ({
    campaignName: 'test-campaign',
    onBack: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

describe('CampaignAdmin - Theme Toggle', () => {
    it('calls toggleTheme when theme button is clicked', () => {
        const props = createDefaultProps();
        render(<CampaignAdmin {...props} />);
        const btn = screen.getByRole('button', { name: /switch to/i });
        fireEvent.click(btn);
        expect(props.toggleTheme).toHaveBeenCalledTimes(1);
    });
});

describe('CampaignAdmin - Back Button', () => {
    it('calls onBack when back button is clicked', () => {
        const props = createDefaultProps();
        render(<CampaignAdmin {...props} />);
        const backBtn = screen.getByRole('button', { name: /^Back$/ });
        fireEvent.click(backBtn);
        expect(props.onBack).toHaveBeenCalledTimes(1);
    });
});
