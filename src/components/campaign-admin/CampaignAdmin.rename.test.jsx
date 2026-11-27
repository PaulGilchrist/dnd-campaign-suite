// @maintained-by-ai 2026-11-26
/**
 * Rename Campaign flow of CampaignAdmin: opening the modal, closing it
 * (Cancel / close icon / Escape) without renaming, backdrop clicks that
 * keep it open with the draft, submit validation (blank or unchanged names
 * can never be submitted via button or Enter), the failure face (modal
 * stays open with the draft + server error), and draft reset after success.
 *
 * Static rendering of the Rename card (heading, description, button class)
 * and the no-modal idle state are covered by CampaignAdmin.rendering.test.jsx;
 * lock gating by CampaignAdmin.rename-lock.test.jsx; window alert/confirm
 * mocks by the delete tests. None of that is repeated here.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';

const createDefaultProps = (overrides = {}) => ({
    campaignName: CAMPAIGN,
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

/**
 * Renders CampaignAdmin and opens the rename modal. Props are created
 * fresh per test so mock call counts never leak between tests.
 */
function renderWithRenameModal(overrides = {}) {
    const props = createDefaultProps(overrides);
    const { container } = render(<CampaignAdmin {...props} />);
    openModal();
    return {
        props,
        input: screen.getByLabelText('New Campaign Name'),
        submit: () => screen.getByRole('button', { name: 'Rename' }),
        cancel: () => screen.getByRole('button', { name: 'Cancel' }),
        closeIcon: () => container.querySelector('.ct-modal-close'),
        clickBackdrop: () => fireEvent.click(container.querySelector('.ct-modal-overlay')),
    };
}

const openModal = () => fireEvent.click(screen.getByRole('button', { name: 'Rename Campaign' }));
const type = (value) => fireEvent.change(screen.getByLabelText('New Campaign Name'), { target: { value } });

describe('CampaignAdmin - Rename Campaign', () => {
    it('opens the rename modal with an empty input suggesting the current name', () => {
        const { props, input, submit, cancel } = renderWithRenameModal();

        expect(input).toHaveValue('');
        expect(input).toHaveAttribute('placeholder', CAMPAIGN);
        expect(submit()).toBeInTheDocument();
        expect(cancel()).toBeInTheDocument();
        expect(props.onRenameCampaign).not.toHaveBeenCalled();
    });

    it('closes without renaming via Cancel, the close icon, or Escape, and stays open on backdrop clicks', () => {
        const { props, input, submit, cancel, closeIcon, clickBackdrop } = renderWithRenameModal();

        // Backdrop or input clicks never close the modal or lose the draft.
        type('draft-name');
        clickBackdrop();
        fireEvent.click(input);
        expect(submit()).toBeInTheDocument();
        expect(screen.getByLabelText('New Campaign Name')).toHaveValue('draft-name');

        fireEvent.click(cancel());
        expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();

        openModal();
        fireEvent.click(closeIcon());
        expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();

        openModal();
        fireEvent.keyDown(screen.getByLabelText('New Campaign Name'), { key: 'Escape' });
        expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument();

        expect(props.onRenameCampaign).not.toHaveBeenCalled();
    });

    it('keeps submit disabled until the name has non-whitespace content', () => {
        const { submit } = renderWithRenameModal();
        expect(submit()).toBeDisabled();

        type('   ');
        expect(submit()).toBeDisabled();

        type('Frostpeak Winter');
        expect(submit()).toBeEnabled();

        type('');
        expect(submit()).toBeDisabled();
    });

    // Regression (bug-campaign-rename-double-prompt): the modal value is the
    // single input surface — it goes straight to onRenameCampaign and no
    // native prompt() may fire behind the modal.
    it('submits the trimmed name once via the Rename button with no native prompt, closes, and reopens with a cleared draft', async () => {
        const promptSpy = vi.spyOn(window, 'prompt');
        const { props, submit } = renderWithRenameModal();
        type('  test-campaign/2  ');
        fireEvent.click(submit());

        expect(props.onRenameCampaign).toHaveBeenCalledTimes(1);
        expect(props.onRenameCampaign).toHaveBeenCalledWith('test-campaign/2');
        expect(promptSpy).not.toHaveBeenCalled();
        promptSpy.mockRestore();
        await waitFor(() => expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument());

        openModal();
        expect(screen.getByLabelText('New Campaign Name')).toHaveValue('');
    });

    it('submits the trimmed name on Enter and never submits a blank name', async () => {
        const { props, input } = renderWithRenameModal();
        type('  Frostpeak Winter  ');
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(props.onRenameCampaign).toHaveBeenCalledTimes(1);
        expect(props.onRenameCampaign).toHaveBeenCalledWith('Frostpeak Winter');
        await waitFor(() => expect(screen.queryByLabelText('New Campaign Name')).not.toBeInTheDocument());

        // Enter is the only submit path for a blank name (the button is
        // disabled), so the guard in the key handler must hold.
        openModal();
        type('   ');
        fireEvent.keyDown(screen.getByLabelText('New Campaign Name'), { key: 'Enter' });

        expect(props.onRenameCampaign).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText('New Campaign Name')).toBeInTheDocument();
    });

    it('keeps the modal open with the draft and shows the server error when the rename fails', async () => {
        const { props, submit } = renderWithRenameModal({
            onRenameCampaign: vi.fn().mockRejectedValue(new Error('Campaign already exists')),
        });
        type('Frostpeak Winter');
        fireEvent.click(submit());

        await waitFor(() => expect(screen.getByText('Campaign already exists')).toBeInTheDocument());
        expect(screen.getByLabelText('New Campaign Name')).toHaveValue('Frostpeak Winter');
        expect(props.onRenameCampaign).toHaveBeenCalledTimes(1);
    });

    it('disables submit with visible copy for a name identical (case-insensitively) to the current campaign name', () => {
        const { props, submit } = renderWithRenameModal();
        type('  Test-Campaign  ');
        // The inline note is the only user-visible signal for this state.
        expect(screen.getByText('The campaign already has this name')).toBeInTheDocument();
        expect(submit()).toBeDisabled();
        fireEvent.click(submit());
        expect(props.onRenameCampaign).not.toHaveBeenCalled();
        expect(screen.getByLabelText('New Campaign Name')).toBeInTheDocument();

        // A genuinely different name clears the note and re-enables submit.
        type('Test-Campaign II');
        expect(screen.queryByText('The campaign already has this name')).not.toBeInTheDocument();
        expect(submit()).toBeEnabled();
    });
});
