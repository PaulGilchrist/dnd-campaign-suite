// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SacredWeaponModal from './SacredWeaponModal.jsx';

// ── Mocked modules ──

vi.mock(
  '../../../../services/automation/handlers/class-cleric-paladin/sacredWeaponHandler.js',
  () => ({
    applyDamageTypeChoice: vi.fn(),
  })
);

// ── Re-import mocked modules ──

import * as sacredWeaponHandler from '../../../../services/automation/handlers/class-cleric-paladin/sacredWeaponHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Sacred Weapon',
  automation: {
    type: 'sacred_weapon',
    options: [
      { name: 'Radiant', damageType: 'Radiant' },
      { name: 'Fire', damageType: 'Fire' },
      { name: 'Cold', damageType: 'Cold' },
    ],
  },
};

const basePlayerStats = {
  name: 'Paladin1',
  level: 5,
  hitPoints: 40,
};

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function makeAction(overrides) {
  return { ...baseAction, ...(overrides || {}) };
}

// Shared mock result used across multiple tests to avoid duplication
function makeResult(description) {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Sacred Weapon',
      description: description ?? 'Sacred Weapon activated.',
    },
  };
}

// ── Tests ──

describe('SacredWeaponModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Structure & display ──

  it('renders modal with all structural elements and CSS classes', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('displays the action name in the header', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
  });

  it('renders a Font Awesome icon in the header', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(document.querySelector('.sp-header .fa-solid')).toBeInTheDocument();
  });

  it('displays the choice prompt text', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(
      screen.getByText('Choose the damage type for Sacred Weapon:')
    ).toBeInTheDocument();
  });

  it('renders all damage type options as radio buttons with labels', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(screen.getByLabelText('Radiant')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
    expect(screen.getByLabelText('Cold')).toBeInTheDocument();
  });

  it('renders the correct number of label elements', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(document.querySelectorAll('label').length).toBe(3);
  });

  it('uses a consistent radio button group name', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(
      document.querySelectorAll('input[name="sacredWeaponOption"]').length
    ).toBe(3);
  });

  it('renders Activate and Cancel buttons', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(
      screen.getByRole('button', { name: 'Activate Sacred Weapon' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders a Font Awesome icon on the Activate button', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    const activateBtn = screen.getByRole('button', {
      name: 'Activate Sacred Weapon',
    });
    expect(activateBtn.querySelector('.fa-solid')).toBeInTheDocument();
  });

  it('does not render a Font Awesome icon on the Done button', async () => {
    sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(makeResult());
    render(<SacredWeaponModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Radiant'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Activate Sacred Weapon' })
      );
    });
    await waitFor(() => {
      const doneBtn = screen.getByRole('button', { name: 'Done' });
      expect(doneBtn.querySelector('.fa-solid')).not.toBeInTheDocument();
    });
  });

  // ── Initial state ──

  it('has no option selected and Activate button disabled on mount', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(screen.getByLabelText('Radiant')).not.toBeChecked();
    expect(screen.getByLabelText('Fire')).not.toBeChecked();
    expect(screen.getByLabelText('Cold')).not.toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Activate Sacred Weapon' })
    ).toBeDisabled();
  });

  it('does not show the Done button on initial render', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  // ── Overlay & dismissal ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<SacredWeaponModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<SacredWeaponModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when clicking the modal header', () => {
    const onClose = vi.fn();
    render(<SacredWeaponModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-header'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when clicking the modal body', () => {
    const onClose = vi.fn();
    render(<SacredWeaponModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-body'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when clicking the modal actions', () => {
    const onClose = vi.fn();
    render(<SacredWeaponModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-actions'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<SacredWeaponModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Selection behavior ──

  it('selects an option when its radio button is clicked', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByLabelText('Fire')).toBeChecked();
  });

  it('switches selection when a different option is clicked', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Radiant'));
    expect(screen.getByLabelText('Radiant')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Radiant')).not.toBeChecked();
    expect(screen.getByLabelText('Cold')).toBeChecked();
  });

  it('enables Activate button after selecting an option', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(
      screen.getByRole('button', { name: 'Activate Sacred Weapon' })
    ).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(
      screen.getByRole('button', { name: 'Activate Sacred Weapon' })
    ).toBeEnabled();
  });

  // ── Activation flow ──

  it('passes the selected damage type to applyDamageTypeChoice', async () => {
    sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(makeResult());
    render(<SacredWeaponModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Radiant'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Activate Sacred Weapon' })
      );
    });
    expect(sacredWeaponHandler.applyDamageTypeChoice).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      'Radiant'
    );
  });

  it('does not call applyDamageTypeChoice when no option is selected', async () => {
    render(<SacredWeaponModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Activate Sacred Weapon' })
      );
    });
    expect(sacredWeaponHandler.applyDamageTypeChoice).not.toHaveBeenCalled();
  });

  it('shows the result description after activation', async () => {
    const description =
      'Sacred Weapon activated. Your melee weapon glows with bright light in a 20-foot radius.';
    sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(
      makeResult(description)
    );
    render(<SacredWeaponModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Activate Sacred Weapon' })
      );
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.innerHTML).toContain(description);
    });
  });

  it('hides the choice prompt, buttons, and options after activation', async () => {
    sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(makeResult());
    render(<SacredWeaponModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Radiant'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Activate Sacred Weapon' })
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByText('Choose the damage type for Sacred Weapon:')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Activate Sacred Weapon' })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Radiant')).not.toBeInTheDocument();
    });
  });

  it('shows the Done button after activation', async () => {
    sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(makeResult());
    render(<SacredWeaponModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Cold'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Activate Sacred Weapon' })
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('calls onClose when Done is clicked after activation', async () => {
    const onClose = vi.fn();
    sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(makeResult());
    render(<SacredWeaponModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('Radiant'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Activate Sacred Weapon' })
      );
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Edge cases: missing / empty options ──

  it('renders without radio options when automation.options is missing', () => {
    const actionNoOptions = makeAction({
      automation: { type: 'sacred_weapon' },
    });
    render(<SacredWeaponModal {...makeProps({ action: actionNoOptions })} />);
    expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
    expect(screen.queryByLabelText('Radiant')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Activate Sacred Weapon' })
    ).toBeInTheDocument();
  });

  it('does not call applyDamageTypeChoice when no options are available', async () => {
    const actionNoOptions = makeAction({
      automation: { type: 'sacred_weapon' },
    });
    render(<SacredWeaponModal {...makeProps({ action: actionNoOptions })} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Activate Sacred Weapon' })
      );
    });
    expect(sacredWeaponHandler.applyDamageTypeChoice).not.toHaveBeenCalled();
  });

  it('renders without radio options when automation.options is an empty array', () => {
    const actionEmptyOptions = makeAction({
      automation: { type: 'sacred_weapon', options: [] },
    });
    render(<SacredWeaponModal {...makeProps({ action: actionEmptyOptions })} />);
    expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
    expect(screen.queryByLabelText('Radiant')).not.toBeInTheDocument();
  });

  it('renders without radio options when automation is null', () => {
    const actionNullAutomation = makeAction({ automation: null });
    render(
      <SacredWeaponModal {...makeProps({ action: actionNullAutomation })} />
    );
    expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
    expect(screen.queryByLabelText('Radiant')).not.toBeInTheDocument();
  });

  it('renders without radio options when automation is undefined', () => {
    const action = { name: 'Sacred Weapon', automation: undefined };
    render(<SacredWeaponModal {...makeProps({ action })} />);
    expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
    expect(screen.queryByLabelText('Radiant')).not.toBeInTheDocument();
  });

  // ── Edge cases: single option ──

  it('renders a single option when only one is available', () => {
    const actionSingleOption = makeAction({
      automation: {
        type: 'sacred_weapon',
        options: [{ name: 'Radiant', damageType: 'Radiant' }],
      },
    });
    render(<SacredWeaponModal {...makeProps({ action: actionSingleOption })} />);
    expect(screen.getByLabelText('Radiant')).toBeInTheDocument();
    expect(screen.queryByLabelText('Fire')).not.toBeInTheDocument();
  });

  // ── Custom action name ──

  it('renders a custom action name from the action prop', () => {
    const customAction = makeAction({ name: 'Divine Smite' });
    render(<SacredWeaponModal {...makeProps({ action: customAction })} />);
    expect(screen.getByText('Divine Smite')).toBeInTheDocument();
  });

  // ── State reset on remount ──

  it('resets selection state on each mount', () => {
    const { unmount } = render(<SacredWeaponModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Radiant'));
    expect(screen.getByLabelText('Radiant')).toBeChecked();
    unmount();
    const { container } = render(<SacredWeaponModal {...makeProps()} />);
    expect(container.querySelector('input[name="sacredWeaponOption"]')).not.toBeChecked();
  });

  // ── Error cases ──

  it('throws when action is undefined', () => {
    expect(() =>
      render(<SacredWeaponModal {...makeProps({ action: undefined })} />)
    ).toThrow();
  });
});
