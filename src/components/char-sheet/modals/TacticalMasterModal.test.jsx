// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TacticalMasterModal from './TacticalMasterModal.jsx';

vi.mock('../../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  MASTERY_EFFECTS: {
    Push: { label: 'Push (10 ft)', description: 'Push the creature up to 10 feet straight away from you if it is Large or smaller.', effect: 'push', value: 10, sizeLimit: 'large_or_smaller' },
    Topple: { label: 'Topple (Prone)', description: 'Force the creature to make a Constitution saving throw or fall Prone.', effect: 'topple', requiresSave: true, saveAbility: 'CON' },
    Sap: { label: 'Disadvantage on Next Attack', description: 'The creature has Disadvantage on its next attack roll before the start of your next turn.', effect: 'disadvantage_next_attack' },
    Slow: { label: 'Speed -10 ft', description: "Reduce the creature's Speed by 10 feet until the start of your next turn.", effect: 'speed_reduction', value: 10 },
    Vex: { label: 'Advantage on Next Attack', description: 'You have Advantage on your next attack roll against that creature before the end of your next turn.', effect: 'next_attack_advantage', value: 5, perTarget: true },
    Cleave: { label: 'Cleave (Extra Attack)', description: 'Make a melee attack roll with the weapon against a second creature within 5 feet of the first.', effect: 'cleave', oncePerTurn: true },
    Nick: { label: 'Nick (Extra Attack)', description: 'Make the extra attack of the Light property as part of the Attack action instead of as a Bonus Action.', effect: 'nick', oncePerTurn: true },
    Graze: { label: 'Graze (Miss Damage)', description: 'If your attack roll misses, deal damage equal to your ability modifier.', effect: 'graze' },
  },
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  loadWeaponMasteries: vi.fn(),
}));

import * as useActionPopup from '../../../hooks/combat/useActionPopup.js';

const mockPlayerStats = { name: 'Throg', level: 12, abilities: [{ name: 'CON', bonus: 3 }] };

function makeProps(overrides = {}) {
  return {
    attackName: 'Longsword Attack',
    baseMastery: 'Vex',
    replaceOptions: ['Push'],
    targetName: 'Goblin',
    playerStats: mockPlayerStats,
    campaignName: 'test-campaign',
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    isChoiceMode: false,
    ...overrides,
  };
}

function renderModal(overrides) {
  return render(<TacticalMasterModal {...makeProps(overrides)} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  useActionPopup.loadWeaponMasteries.mockResolvedValue([
    { name: 'Vex', description: 'Gain advantage on next attack.' },
    { name: 'Push', description: 'Push enemy 10 ft away.' },
  ]);
});

describe('TacticalMasterModal - rendering', () => {
  it('renders header, target instruction, radio options, and action buttons', () => {
    renderModal();
    expect(screen.getByText(/Tactical Master/)).toBeInTheDocument();
    expect(screen.getByText(/Longsword Attack/)).toBeInTheDocument();
    expect(screen.getByText(/Choose a mastery property against/)).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByText('Advantage on Next Attack')).toBeInTheDocument();
    expect(screen.getByText('Push (10 ft)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply/ })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('uses featureName for the title, falling back to "Tactical Master"', () => {
    const { unmount } = renderModal({ featureName: 'Battering Roots' });
    expect(screen.getByText(/Battering Roots/)).toBeInTheDocument();
    expect(screen.queryByText(/Tactical Master/)).not.toBeInTheDocument();
    unmount();

    renderModal();
    expect(screen.getByText(/Tactical Master/)).toBeInTheDocument();
  });

  it('omits the target from the instruction when targetName is null', () => {
    renderModal({ targetName: null });
    expect(screen.getByText(/Choose a mastery property:/)).toBeInTheDocument();
    expect(screen.queryByText(/Choose a mastery property against/)).not.toBeInTheDocument();
  });

  it('deduplicates options, excludes Graze, and badges only feature-source masteries', () => {
    renderModal({ baseMastery: 'Vex', replaceOptions: ['Vex', 'Push', 'Graze'] });
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByText(/Graze/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Feature')).toHaveLength(1);
  });

  it('prefers loaded descriptions, falls back to MASTERY_EFFECTS, then to the mastery name', async () => {
    useActionPopup.loadWeaponMasteries.mockResolvedValue([
      { name: 'Push', description: 'Push desc from file.' },
    ]);
    renderModal({ replaceOptions: ['Push', 'UnknownMastery'] });
    expect(await screen.findByText('Push desc from file.')).toBeInTheDocument();
    expect(screen.getByText(/You have Advantage on your next attack roll/)).toBeInTheDocument();
    expect(screen.getByText('UnknownMastery')).toBeInTheDocument();
  });
});

describe('TacticalMasterModal - defaults and selection', () => {
  it('defaults selection and instruction copy by mode', () => {
    const { unmount } = renderModal();
    expect(screen.getByRole('radio', { name: /Advantage on Next Attack/, checked: true })).toBeInTheDocument();
    expect(screen.getByText(/replace that property/)).toBeInTheDocument();
    unmount();

    renderModal({ isChoiceMode: true, baseMastery: null, replaceOptions: ['Push', 'Sap'] });
    expect(screen.getByRole('radio', { name: /Push/, checked: true })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Advantage on Next Attack/ })).not.toBeInTheDocument();
    expect(screen.getByText(/in addition to the mastery property/)).toBeInTheDocument();
  });

  it('keeps Apply disabled and inert until a mastery is selected', () => {
    const onConfirm = vi.fn();
    const { rerender } = renderModal({ baseMastery: null, replaceOptions: [], onConfirm });
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    const apply = screen.getByRole('button', { name: /Apply/ });
    expect(apply).toBeDisabled();
    fireEvent.click(apply);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();

    rerender(<TacticalMasterModal {...makeProps({ baseMastery: null, replaceOptions: ['Push'], onConfirm })} />);
    expect(screen.getByRole('radio', { name: /Push/, checked: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply/ })).toBeDisabled();
    fireEvent.click(screen.getByText('Push (10 ft)'));
    expect(screen.getByRole('button', { name: /Apply/ })).not.toBeDisabled();
  });

  it('moves the radio selection and confirms the exact mastery name exactly once', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderModal({ onConfirm });
    fireEvent.click(screen.getByText('Push (10 ft)'));
    expect(screen.getByRole('radio', { name: /Push/, checked: true })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Advantage on Next Attack/, checked: true })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Push');
  });
});

describe('TacticalMasterModal - applied state', () => {
  it('shows the applied state after confirming and closes via Done without re-confirming', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModal({ onConfirm, onClose });
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.getByText(/Mastery applied successfully/)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // WM-003 F3: a once-per-turn refusal must surface its payload text, not success.
  it.each([
    { case: 'an explicit refused flag', payload: { name: 'Nick', refused: true, description: 'Throg can use Nick only once per turn.' } },
    { case: 'a popup lacking the mastery_rider automation', payload: { name: 'Cleave', description: 'Cleave can only be used once per turn.' } },
    { case: 'a refused flag alongside automation', payload: { name: 'Nick', refused: true, description: 'Nick already used this turn.', automation: { type: 'mastery_rider', masteries: ['Nick'] } } },
    { case: 'a refusal lacking a description', payload: { name: 'Nick', refused: true } },
  ])('surfaces the refusal text for $case instead of the success message', async ({ payload }) => {
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', ...payload } });
    renderModal({ baseMastery: 'Nick', replaceOptions: [], onConfirm });
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));
    expect(await screen.findByText(payload.description || 'Mastery not applied.')).toBeInTheDocument();
    expect(screen.queryByText(/Mastery applied successfully/)).not.toBeInTheDocument();
  });

  it('shows success when onConfirm resolves with a mastery_rider popup', async () => {
    const onConfirm = vi.fn().mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Nick', description: 'Nick applied.', automation: { type: 'mastery_rider', masteries: ['Nick'] } },
    });
    renderModal({ baseMastery: 'Nick', replaceOptions: [], onConfirm });
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));
    expect(await screen.findByText(/Mastery applied successfully/)).toBeInTheDocument();
    expect(screen.queryByText('Nick applied.')).not.toBeInTheDocument();
  });
});

describe('TacticalMasterModal - close behavior', () => {
  it('calls onClose once when Skip is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
