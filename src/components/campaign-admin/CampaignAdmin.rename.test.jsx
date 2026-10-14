// @improved-by-ai
/**
 * Rename Campaign flow of CampaignAdmin: opening/closing the modal,
 * input validation (blank names can never be submitted), submitting via
 * button click or Enter with the trimmed name, and draft-name reset after
 * a successful rename.
 *
 * Other CampaignAdmin flows are covered by sibling files: backup-restore,
 * rollback-upload, delete, data-management, rendering, and theme-toggle
 * tests — behaviors already tested there (e.g. the modal is absent before
 * the button is clicked, section descriptions) are not repeated here.
 */
import { render, screen, fireEvent } from '@testing-library/react';
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

/**
 * Renders CampaignAdmin and opens the rename modal. Props are created
 * fresh per test so mock call counts never leak between tests. No
 * alert/confirm/prompt/location mocks: the rename flow never touches
 * them (the delete tests cover those window APIs).
 */
function renderWithRenameModal(overrides = {}) {
    const props = createDefaultProps(overrides);
    const { container, unmount } = render(<CampaignAdmin {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename Campaign' }));
    return {
        props,
        unmount,
        input: screen.getByLabelText('New Campaign Name'),
        submit: () => screen.getByRole('button', { name: 'Rename' }),
        cancel: () => screen.getByRole('button', { name: 'Cancel' }),
        closeModalIcon: () => container.querySelector('.ct-modal-close'),
        clickBackdrop: () => fireEvent.click(container.querySelector('.ct-modal-overlay')),
    };
}

const type = (input, value) => fireEvent.change(input, { target: { value } });

describe('CampaignAdmin - Rename Campaign', () => {
    describe('modal access', () => {
        it('shows a Rename Campaign heading and action button', () => {
            render(<CampaignAdmin {...createDefaultProps()} />);
            expect(screen.getByRole('heading', { level: 3, name: 'Rename Campaign' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Rename Campaign' })).toBeInTheDocument();
        });

        it('opens the rename modal with an empty input when the button is clicked', () => {
            const { input, cancel, submit } = renderWithRenameModal();
            expect(input).toHaveValue('');
            expect(submit()).toBeInTheDocument();
            expect(cancel()).toBeInTheDocument();
        });

        it('closes the modal via Cancel without renaming', () => {
            const { props, input, cancel } = renderWithRenameModal();
            type(input, 'new-name');
            fireEvent.click(cancel());

            expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
            expect(props.onRenameCampaign).not.toHaveBeenCalled();
        });

        it('closes the modal via the header close icon without renaming', () => {
            const { props, input, closeModalIcon } = renderWithRenameModal();
            type(input, 'new-name');
            fireEvent.click(closeModalIcon());

            expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
            expect(props.onRenameCampaign).not.toHaveBeenCalled();
        });

        it('closes the modal on Escape without renaming', () => {
            const { props, input } = renderWithRenameModal();
            type(input, 'new-name');
            fireEvent.keyDown(input, { key: 'Escape' });

            expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
            expect(props.onRenameCampaign).not.toHaveBeenCalled();
        });

        it('stays open when the backdrop or modal body is clicked, keeping the draft name', () => {
            const { props, input, clickBackdrop } = renderWithRenameModal();
            type(input, 'draft-name');
            clickBackdrop();
            fireEvent.click(screen.getByLabelText('New Campaign Name'));

            expect(screen.getByLabelText('New Campaign Name')).toHaveValue('draft-name');
            expect(props.onRenameCampaign).not.toHaveBeenCalled();
        });
    });

    describe('input validation', () => {
        it('suggests the current campaign name as the placeholder', () => {
            for (const campaignName of [CAMPAIGN, 'my campaign/1']) {
                const { input, unmount } = renderWithRenameModal({ campaignName });
                expect(input).toHaveAttribute('placeholder', campaignName);
                unmount();
            }
        });

        it('keeps submit disabled until the name has non-whitespace content', () => {
            const { input, submit } = renderWithRenameModal();
            expect(submit()).toBeDisabled();

            type(input, '   ');
            expect(submit()).toBeDisabled();

            type(input, 'Frostpeak Winter');
            expect(submit()).toBeEnabled();

            type(input, '');
            expect(submit()).toBeDisabled();
        });
    });

    describe('submitting a rename', () => {
        it('calls onRenameCampaign once with the trimmed name and closes the modal', () => {
            const { props, input, submit } = renderWithRenameModal();
            type(input, '  test-campaign/2  ');
            fireEvent.click(submit());

            expect(props.onRenameCampaign).toHaveBeenCalledTimes(1);
            expect(props.onRenameCampaign).toHaveBeenCalledWith('test-campaign/2');
            expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
        });

        it('submits the trimmed name on Enter and closes the modal', () => {
            const { props, input } = renderWithRenameModal();
            type(input, '  test-campaign-new  ');
            fireEvent.keyDown(input, { key: 'Enter' });

            expect(props.onRenameCampaign).toHaveBeenCalledTimes(1);
            expect(props.onRenameCampaign).toHaveBeenCalledWith('test-campaign-new');
            expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();
        });

        it('never submits a blank name via Enter and keeps the modal open', () => {
            const { props, input } = renderWithRenameModal();
            type(input, '   ');
            fireEvent.keyDown(input, { key: 'Enter' });

            expect(props.onRenameCampaign).not.toHaveBeenCalled();
            expect(screen.getByLabelText('New Campaign Name')).toBeInTheDocument();
        });

        it('clears the draft name after a successful rename so reopening starts empty', () => {
            const { props, input, submit } = renderWithRenameModal();
            type(input, 'test-campaign-new');
            fireEvent.click(submit());
            expect(props.onRenameCampaign).toHaveBeenCalledWith('test-campaign-new');

            fireEvent.click(screen.getByRole('button', { name: 'Rename Campaign' }));
            expect(screen.getByLabelText('New Campaign Name')).toHaveValue('');
        });
    });
});
