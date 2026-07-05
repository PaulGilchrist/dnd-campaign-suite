// @cleaned-by-ai
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

// Shared mock result used across tests
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

  it('renders modal with action name, choice prompt, options, and buttons', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
    expect(
      screen.getByText('Choose the damage type for Sacred Weapon:')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Radiant')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
    expect(screen.getByLabelText('Cold')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Activate Sacred Weapon' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders a custom action name from the action prop', () => {
    const customAction = makeAction({ name: 'Divine Smite' });
    render(<SacredWeaponModal {...makeProps({ action: customAction })} />);
    expect(screen.getByText('Divine Smite')).toBeInTheDocument();
  });

  // ── Initial state ──

  it('has no option selected and Activate button disabled on mount', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(screen.getByLabelText('Radiant')).not.toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Activate Sacred Weapon' })
    ).toBeDisabled();
  });

  it('does not show the Done button on initial render', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  // ── Selection behavior ──

  it('enables Activate button after selecting an option', () => {
    render(<SacredWeaponModal {...makeProps()} />);
    expect(
      screen.getByRole('button', { name: 'Activate Sacred Weapon' })
    ).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(
      screen.getByRole('button', { name: 'Activate Sacred Weapon' })
    ).toBeEnabled();
    expect(screen.getByLabelText('Fire')).toBeChecked();
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

  it('shows the result description and Done button after activation, hides controls', async () => {
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
      expect(screen.queryByRole('button', { name: 'Activate Sacred Weapon' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Radiant')).not.toBeInTheDocument();
      expect(screen.queryByText('Choose the damage type for Sacred Weapon:')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      const body = document.querySelector('.sp-body');
      expect(body.innerHTML).toContain(description);
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

  // ── Edge cases: missing / empty / null automation ──

  it('renders without radio options when automation is missing, empty, null, or undefined', () => {
    const scenarios = [
      { automation: { type: 'sacred_weapon' } },
      { automation: { type: 'sacred_weapon', options: [] } },
      { automation: null },
      { automation: undefined },
    ];
    scenarios.forEach((automation) => {
      const action = makeAction({ automation });
      const { unmount } = render(<SacredWeaponModal {...makeProps({ action })} />);
      expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
      expect(screen.queryByLabelText('Radiant')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Activate Sacred Weapon' })
      ).toBeInTheDocument();
      unmount();
    });
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
