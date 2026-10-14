import { render, screen, fireEvent } from '@testing-library/react';
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

describe('CampaignAdmin - Rename Campaign', () => {
    const defaultProps = createDefaultProps();

    beforeEach(() => {
        vi.clearAllMocks();
        window.alert = vi.fn();
        window.confirm = vi.fn(() => true);
        Object.defineProperty(window, 'location', {
            value: { reload: vi.fn() },
            writable: true,
        });
    });

    describe('initial render', () => {
        it('renders the rename action with heading, description, and button', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameHeadings = screen.getAllByText('Rename Campaign');
            expect(renameHeadings.length).toBeGreaterThanOrEqual(2);
            expect(screen.getByText('Changes the display name. Character files, maps, and data are preserved.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /rename campaign/i })).toBeInTheDocument();
        });
    });

    describe('modal open/close', () => {
        it('opens rename modal when rename button is clicked', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            expect(screen.getByLabelText('New Campaign Name')).toBeInTheDocument();
        });

        it('closes modal when cancel button is clicked and does not call onRenameCampaign', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const cancelBtn = screen.getByText('Cancel');
            fireEvent.click(cancelBtn);

            expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
            expect(defaultProps.onRenameCampaign).not.toHaveBeenCalled();
        });

        it('prevents modal close when clicking modal body', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const modal = document.querySelector('.ct-modal');
            fireEvent.click(modal);

            expect(screen.getByLabelText('New Campaign Name')).toBeInTheDocument();
        });
    });

    describe('input behavior', () => {
        it('renders input with placeholder equal to current campaign name', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const input = screen.getByLabelText('New Campaign Name');
            expect(input).toHaveAttribute('placeholder', 'test-campaign');
        });

        it('disables submit button when input is empty', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const submitBtn = screen.getByRole('button', { name: 'Rename' });
            expect(submitBtn).toBeDisabled();
        });

        it('enables submit button when input has content', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const input = screen.getByLabelText('New Campaign Name');
            fireEvent.change(input, { target: { value: 'new-name' } });

            const submitBtn = screen.getByRole('button', { name: 'Rename' });
            expect(submitBtn).not.toBeDisabled();
        });
    });

    describe('submit behavior', () => {
        it('calls onRenameCampaign with trimmed value on button click', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const input = screen.getByLabelText('New Campaign Name');
            fireEvent.change(input, { target: { value: '  new-name  ' } });

            const submitBtn = screen.getByRole('button', { name: 'Rename' });
            fireEvent.click(submitBtn);

            expect(defaultProps.onRenameCampaign).toHaveBeenCalledWith('new-name');
        });

        it('calls onRenameCampaign with trimmed value on Enter key', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const input = screen.getByLabelText('New Campaign Name');
            fireEvent.change(input, { target: { value: 'new-name' } });

            fireEvent.keyDown(input, { key: 'Enter' });

            expect(defaultProps.onRenameCampaign).toHaveBeenCalledWith('new-name');
        });

        it('closes modal after successful submit', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const input = screen.getByLabelText('New Campaign Name');
            fireEvent.change(input, { target: { value: 'new-name' } });

            const submitBtn = screen.getByRole('button', { name: 'Rename' });
            fireEvent.click(submitBtn);

            expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
        });

        it('does not submit when input is empty', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const submitBtn = screen.getByRole('button', { name: 'Rename' });
            fireEvent.click(submitBtn);

            expect(defaultProps.onRenameCampaign).not.toHaveBeenCalled();
        });

        it('does not call onRenameCampaign when modal is closed without submitting', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const input = screen.getByLabelText('New Campaign Name');
            fireEvent.change(input, { target: { value: 'new-name' } });

            const cancelBtn = screen.getByText('Cancel');
            fireEvent.click(cancelBtn);

            expect(defaultProps.onRenameCampaign).not.toHaveBeenCalled();
        });

        it('closes modal on Escape key', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const input = screen.getByLabelText('New Campaign Name');
            fireEvent.keyDown(input, { key: 'Escape' });

            expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
        });
    });

    describe('campaign name variations', () => {
        it('passes trimmed value with special characters to onRenameCampaign', () => {
            const props = createDefaultProps({ campaignName: 'my campaign/1' });
            render(<CampaignAdmin {...props} />);
            const renameBtn = screen.getByRole('button', { name: /rename campaign/i });
            fireEvent.click(renameBtn);

            const input = screen.getByLabelText('New Campaign Name');
            fireEvent.change(input, { target: { value: '  new-campaign/2  ' } });

            const submitBtn = screen.getByRole('button', { name: 'Rename' });
            fireEvent.click(submitBtn);

            expect(props.onRenameCampaign).toHaveBeenCalledWith('new-campaign/2');
        });
    });
});
