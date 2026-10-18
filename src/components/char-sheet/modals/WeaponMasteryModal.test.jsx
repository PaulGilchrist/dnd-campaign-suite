// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WeaponMasteryModal from './WeaponMasteryModal.jsx';

vi.mock('../../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  // Labels/descriptions mirror weaponMasteryHandler.js MASTERY_EFFECTS verbatim.
  MASTERY_EFFECTS: {
    Push: { label: 'Push (10 ft)', description: 'Push the creature up to 10 feet straight away from yourself if it is Large or smaller.', effect: 'push', value: 10 },
    Topple: { label: 'Topple (Prone)', description: 'Force the creature to make a Constitution saving throw or fall Prone.', effect: 'topple', requiresSave: true, saveAbility: 'CON' },
    Sap: { label: 'Disadvantage on Next Attack', description: 'The creature has Disadvantage on its next attack roll before the start of your next turn.', effect: 'disadvantage_next_attack' },
    Slow: { label: 'Speed -10 ft', description: 'Reduce the creature\'s Speed by 10 feet until the start of your next turn.', effect: 'speed_reduction', value: 10 },
    Vex: { label: 'Advantage on Next Attack', description: 'You have Advantage on your next attack roll against that creature before the end of your next turn.', effect: 'next_attack_advantage', value: 5 },
    Cleave: { label: 'Cleave (Extra Attack)', description: 'Make a melee attack roll with the weapon against a second creature within 5 feet of the first.', effect: 'cleave' },
    Nick: { label: 'Nick (Extra Attack)', description: 'Make the extra attack of the Light property as part of the Attack action instead of as a Bonus Action.', effect: 'nick' },
    Graze: { label: 'Graze (Miss Damage)', description: 'If your attack roll misses, deal damage equal to your ability modifier.', effect: 'graze' },
  },
  applyMasteryEffect: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  loadWeaponMasteries: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

import * as weaponMasteryHandler from '../../../services/automation/handlers/combat/weaponMasteryHandler.js';
import * as useActionPopup from '../../../hooks/combat/useActionPopup.js';
import * as damageUtils from '../../../services/rules/combat/damageUtils.js';

const { applyMasteryEffect } = weaponMasteryHandler;
const { loadWeaponMasteries } = useActionPopup;
const { getCombatContext, getTargetFromAttacker } = damageUtils;

const mockPlayerStats = { name: 'Throg' };
const mockCampaignName = 'test-campaign';

const popup = (description, name = 'Vex') => ({
  type: 'popup',
  payload: { type: 'automation_info', name, description },
});

function makeProps(overrides) {
  return {
    attackName: 'Longsword Attack',
    baseMastery: 'Vex',
    extraMasteries: ['Push'],
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

// Mirrors production mounting: CharActionModals passes targetName={null},
// so target auto-detection (mocked to null by default) is the live path.
async function renderModal(overrides) {
  let view;
  await act(async () => {
    view = render(<WeaponMasteryModal {...makeProps(overrides)} />);
  });
  return view;
}

async function selectAndActivate(checkboxLabel) {
  const radio = screen.getAllByRole('radio').find(r =>
    (r.labels[0]?.textContent || '').includes(checkboxLabel));
  fireEvent.click(radio);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Real loadWeaponMasteries returns [{ name, description }] from weapon-mastery.json.
  loadWeaponMasteries.mockResolvedValue([
    { name: 'Vex', description: 'Custom Vex description.' },
    { name: 'Push', description: 'Custom Push description.' },
  ]);
  getCombatContext.mockResolvedValue(null);
  getTargetFromAttacker.mockReturnValue(null);
  applyMasteryEffect.mockResolvedValue(popup('Vex applied to Goblin.'));
});

describe('WeaponMasteryModal', () => {

  it('renders header, instruction, one ordered radio per mastery with labels, and badges only on feature-source options', async () => {
    await renderModal();

    expect(screen.getByText('Weapon Mastery — Longsword Attack')).toBeInTheDocument();
    // No target resolved → exact instruction with no target suffix.
    expect(screen.getByText('Choose a mastery property to activate:')).toBeInTheDocument();
    expect(screen.getByText('You can activate one mastery property per hit.')).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    // Base mastery first, extra mastery second; labels come from MASTERY_EFFECTS.
    // (textContent concatenates children without whitespace.)
    expect(radios.map(r => r.labels[0].textContent)).toEqual([
      expect.stringMatching(/^Advantage on Next Attack/),
      expect.stringMatching(/^Push \(10 ft\)Feature/),
    ]);
    // Feature badge appears exactly once — never on the weapon-source base.
    expect(screen.getAllByText('Feature')).toHaveLength(1);
  });

  it('deduplicates a mastery present in both baseMastery and extraMasteries', async () => {
    await renderModal({ extraMasteries: ['Vex', 'Push'] });

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByText('Advantage on Next Attack')).toBeInTheDocument();
  });

  it('excludes Graze from both sources and falls back to the raw name for unknown masteries', async () => {
    await renderModal({ baseMastery: 'Graze', extraMasteries: ['Graze', 'CustomMastery'] });

    // Only the unknown mastery survives — Graze never appears, even as a fallback label.
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByText('CustomMastery')).toBeInTheDocument();
    expect(screen.queryByText(/Graze/)).not.toBeInTheDocument();
  });

  it('prefers loaded mastery descriptions and falls back to MASTERY_EFFECTS text', async () => {
    const view = await renderModal();
    expect(screen.getByText('Custom Vex description.')).toBeInTheDocument();
    expect(screen.getByText('Custom Push description.')).toBeInTheDocument();

    // JSON entries missing → handler fallback description renders instead.
    view.unmount();
    loadWeaponMasteries.mockResolvedValue([]);
    await renderModal();
    expect(screen.getByText('You have Advantage on your next attack roll against that creature before the end of your next turn.')).toBeInTheDocument();
  });

  it('hides damage-dependent masteries (Vex/Slow) when damageTotal is zero', async () => {
    const view = await renderModal({ baseMastery: 'Vex', extraMasteries: ['Push', 'Slow'], damageTotal: 0 });

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(1);
    expect(radios[0].labels[0].textContent).toMatch(/^Push \(10 ft\)/);
    expect(screen.queryByText(/Advantage on Next Attack/)).not.toBeInTheDocument();
    expect(screen.queryByText('Speed -10 ft')).not.toBeInTheDocument();

    view.unmount();
    await renderModal({ baseMastery: 'Vex', extraMasteries: ['Push', 'Slow'], damageTotal: 14 });
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('keeps Activate disabled until a mastery is selected, and only one radio is checked at a time', async () => {
    await renderModal();

    const activate = screen.getByRole('button', { name: 'Activate' });
    expect(activate).toBeDisabled();

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    expect(radios[0]).toBeChecked();
    expect(activate).toBeEnabled();

    fireEvent.click(radios[1]);
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
  });

  it('dispatches applyMasteryEffect with exactly the selected mastery, stats, campaign, and target', async () => {
    await renderModal({ targetName: 'Goblin' });

    fireEvent.click(screen.getAllByRole('radio')[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    });

    expect(applyMasteryEffect).toHaveBeenCalledTimes(1);
    expect(applyMasteryEffect).toHaveBeenCalledWith('Vex', mockPlayerStats, mockCampaignName, 'Goblin');
  });

  it('replaces the selection screen with the rendered result and closes via Done', async () => {
    const onClose = vi.fn();
    applyMasteryEffect.mockResolvedValue(popup('<strong>Vex</strong> applied to Goblin.'));
    await renderModal({ targetName: 'Goblin', onClose });

    await selectAndActivate('Advantage');

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.getByText('Weapon Mastery')).toBeInTheDocument();
    // Result description renders as HTML: bold 'Vex' element + trailing text node.
    expect(screen.getByText('Vex').tagName).toBe('STRONG');
    expect(screen.getByText(/applied to Goblin\./)).toBeInTheDocument();
    // Selection UI fully replaced.
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays on the selection screen when applyMasteryEffect resolves null', async () => {
    applyMasteryEffect.mockResolvedValue(null);
    await renderModal();

    fireEvent.click(screen.getAllByRole('radio')[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    });

    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('closes via Skip without applying anything', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(applyMasteryEffect).not.toHaveBeenCalled();
  });

  it('auto-detects the target and threads it into display and dispatch', async () => {
    const cs = { creatures: [{ name: 'Throg' }, { name: 'Ogre' }] };
    getCombatContext.mockResolvedValue(cs);
    getTargetFromAttacker.mockReturnValue({ name: 'Ogre' });

    await renderModal();

    await screen.findByText(/against.*Ogre/);
    expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, 'Throg');

    await selectAndActivate('Advantage');
    expect(applyMasteryEffect).toHaveBeenCalledWith('Vex', mockPlayerStats, mockCampaignName, 'Ogre');
  });

  it('shows an inert modal with no options and disabled Activate when masteries are empty', async () => {
    await renderModal({ baseMastery: null, extraMasteries: null });

    expect(screen.getByText('Weapon Mastery — Longsword Attack')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled();
  });

});
