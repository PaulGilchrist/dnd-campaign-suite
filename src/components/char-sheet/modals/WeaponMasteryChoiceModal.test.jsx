// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WeaponMasteryChoiceModal from './WeaponMasteryChoiceModal.jsx';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponMasteryChoice: vi.fn(),
}));

import * as automation from '../../../services/automation/index.js';

// Mirrors applyMasterySelection's popup return shape; description carries markup
// to pin the modal's dangerouslySetInnerHTML rendering path.
const popupFor = (mastery) => ({
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Weapon Master',
    description: `<p>Mastery property set to: ${mastery}. This will be applied to your next attack.</p>`,
  },
});

const baseProps = {
  playerStats: { name: 'Fighter1', level: 5 },
  campaignName: 'test-campaign',
  masteryProperties: ['Piercing', 'Slashing', 'Heavy'],
  onClose: vi.fn(),
  onConfirm: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WeaponMasteryChoiceModal', () => {
  it('renders header, instruction, one radio per mastery property, and gates Select until a choice is made', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);

    expect(screen.getByText('Weapon Master — Choose Mastery')).toBeInTheDocument();
    expect(screen.getByText('Choose a mastery property to activate with your weapon attacks:')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);

    const select = screen.getByRole('button', { name: 'Select' });
    expect(select).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled();
  });

  it('renders no radio options when masteryProperties is empty', () => {
    render(<WeaponMasteryChoiceModal {...makeProps({ masteryProperties: [] })} />);

    expect(screen.getByText('Choose a mastery property to activate with your weapon attacks:')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('tracks a single selection as options are clicked and enables Select', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Piercing' }));
    expect(screen.getByRole('radio', { name: 'Piercing' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Select' })).toBeEnabled();

    fireEvent.click(screen.getByRole('radio', { name: 'Heavy' }));
    expect(screen.getByRole('radio', { name: 'Heavy' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Piercing' })).not.toBeChecked();
  });

  it('Skip closes the modal without applying any mastery, even when one is selected', () => {
    const onClose = vi.fn();
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Slashing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(automation.applyWeaponMasteryChoice).not.toHaveBeenCalled();
  });

  it('Select dispatches the exact choice, notifies onConfirm, and swaps the view to the rendered result', async () => {
    const onConfirm = vi.fn();
    automation.applyWeaponMasteryChoice.mockResolvedValue(popupFor('Heavy'));
    render(<WeaponMasteryChoiceModal {...makeProps({ onConfirm })} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Heavy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
    expect(automation.applyWeaponMasteryChoice).toHaveBeenCalledWith(
      'Heavy',
      baseProps.playerStats,
      baseProps.campaignName
    );
    expect(onConfirm).toHaveBeenCalledWith('Heavy');

    // Result view: header + HTML description rendered as markup (not escaped text)
    expect(screen.getByText('Weapon Master')).toBeInTheDocument();
    expect(screen.getByText('Mastery property set to: Heavy. This will be applied to your next attack.')).toBeInTheDocument();
    // Choice UI is gone (positive result header gates these absences)
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(screen.queryByText('Choose a mastery property to activate with your weapon attacks:')).not.toBeInTheDocument();
  });

  it('Done closes the result view', async () => {
    const onClose = vi.fn();
    automation.applyWeaponMasteryChoice.mockResolvedValue(popupFor('Piercing'));
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Piercing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
