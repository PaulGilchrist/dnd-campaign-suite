// @maintained-by-ai
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MetamagicPopup from './MetamagicPopup.jsx';

vi.mock('../../../services/rules/spells/metamagicRules.js', () => ({
  getPreCastOptions: vi.fn(),
  getMaxMetamagicPerSpell: vi.fn(),
  computeMetamagicCost: vi.fn(),
  hasArcaneApotheosis: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

import { getPreCastOptions, getMaxMetamagicPerSpell, computeMetamagicCost, hasArcaneApotheosis } from '../../../services/rules/spells/metamagicRules.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ── Fixtures ──

const baseSpell = { name: 'Fireball', level: 3 };

const basePlayerStats = {
  name: 'Sorcerer',
  class: { name: 'Sorcerer' },
  _metamagicCurrentSP: 10,
};

const preCastOptions = [
  { name: 'Careful Spell', resolvedCost: 1, description: 'Allies automatically succeed on saving throws.', affordable: true },
  { name: 'Distant Spell', resolvedCost: 1, description: 'Double the range of the spell.', affordable: true },
  { name: 'Heightened Spell', resolvedCost: 3, description: 'Give one target disadvantage on its first saving throw.', affordable: true },
  { name: 'Quickened Spell', resolvedCost: 2, description: 'Change the casting time to 1 bonus action.', affordable: true },
  { name: 'Subtle Spell', resolvedCost: 1, description: 'Cast the spell without somatic or verbal components.', affordable: true },
  { name: 'Twinned Spell', resolvedCost: 3, description: 'Target a second creature in range.', affordable: true },
];

// Honest default: mirrors the real service summing resolvedCost of selected options.
function defaultCostImpl(selected, options = preCastOptions) {
  const totalCost = (selected || []).reduce((sum, name) => {
    const opt = (options || []).find((o) => o.name === name);
    return sum + (opt ? opt.resolvedCost : 0);
  }, 0);
  return { totalCost, waivedName: null };
}

// Arcane Apotheosis shape: waives the most expensive selected option.
function apotheosisCostImpl(selected, options = preCastOptions) {
  if (!selected || selected.length === 0) return { totalCost: 0, waivedName: null };
  const costOf = (name) => options.find((o) => o.name === name)?.resolvedCost || 0;
  const maxCost = Math.max(...selected.map(costOf));
  const waivedName = selected.find((name) => costOf(name) === maxCost);
  return { totalCost: selected.reduce((sum, name) => sum + costOf(name), 0) - maxCost, waivedName };
}

function renderPopup(overrides = {}) {
  const spell = overrides.spell !== undefined ? overrides.spell : baseSpell;
  const playerStats = { ...basePlayerStats, ...overrides.playerStats };
  const props = {
    spell,
    playerStats,
    campaignName: 'test-campaign',
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
    ...overrides.props,
  };
  return {
    ...render(<MetamagicPopup {...props} />),
    onConfirm: props.onConfirm,
    onSkip: props.onSkip,
  };
}

const checkboxFor = (name) => screen.getByRole('checkbox', { name: new RegExp(name) });

// ── Tests ──

describe('MetamagicPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPreCastOptions.mockReturnValue(preCastOptions);
    getMaxMetamagicPerSpell.mockReturnValue(1);
    computeMetamagicCost.mockImplementation(defaultCostImpl);
    hasArcaneApotheosis.mockReturnValue(false);
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Sorcerer', type: 'player' },
        { name: 'Goblin', type: 'npc' },
        { name: 'Orc', type: 'npc' },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders spell name, level, SP summary, and every option — no Psionic row for non-psionic spells', () => {
    renderPopup();
    expect(screen.getByRole('heading', { name: /Metamagic/ })).toBeInTheDocument();
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText(/\(Level 3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Sorcery Points:/)).toHaveTextContent(
      'Sorcery Points: 10 available — 0 selected — 10 remaining',
    );
    // All six options as checkboxes with cost and description copy
    expect(screen.getAllByRole('checkbox')).toHaveLength(preCastOptions.length);
    for (const opt of preCastOptions) {
      expect(checkboxFor(opt.name)).toBeInTheDocument();
      expect(screen.getByText(opt.description)).toBeInTheDocument();
    }
    expect(screen.getByText('2 SP')).toBeInTheDocument(); // Quickened cost copy
    // Absence is gated on a positive leg: the options list above rendered in full
    expect(screen.queryByText('Psionic Sorcery')).not.toBeInTheDocument();
  });

  it('shows the Sorcery Incarnate note only when maxPerSpell > 1', () => {
    renderPopup();
    expect(screen.queryByText(/Sorcery Incarnate/)).not.toBeInTheDocument();

    cleanup();
    getMaxMetamagicPerSpell.mockReturnValue(3);
    renderPopup();
    expect(screen.getByText(/Sorcery Incarnate/)).toHaveTextContent(
      'Sorcery Incarnate: you can use up to 3 Metamagic options per spell.',
    );
  });

  it('shows the not-a-Sorcerer view with a working Close button when there are no options', () => {
    getPreCastOptions.mockReturnValue([]);
    const { onSkip } = renderPopup({ playerStats: { ...basePlayerStats, class: { name: 'Wizard' } } });
    expect(screen.getByText('Your character is not a Sorcerer with available Metamagic options.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when Escape is pressed', () => {
    const { onSkip } = renderPopup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('dismisses via Cast Without Metamagic only — overlay clicks are inert', () => {
    const { onSkip } = renderPopup();
    fireEvent.click(document.querySelector('.popup-overlay'));
    expect(onSkip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cast Without Metamagic' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('gates Apply until something is selected, accrues cost as options toggle, and emits the exact payload', () => {
    getMaxMetamagicPerSpell.mockReturnValue(3);
    const { onConfirm } = renderPopup();
    const apply = screen.getByRole('button', { name: /Apply & Cast/ });

    expect(apply).toBeDisabled();
    fireEvent.click(apply);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(checkboxFor('Quickened Spell'));
    fireEvent.click(checkboxFor('Careful Spell'));
    fireEvent.click(checkboxFor('Subtle Spell'));
    expect(apply).toHaveTextContent('Apply & Cast (4 SP)');
    fireEvent.click(apply);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      options: ['Quickened Spell', 'Careful Spell', 'Subtle Spell'],
      totalCost: 4,
      twinTarget: null,
      psionicActive: false,
    });

    // Deselecting re-gates the running total
    fireEvent.click(checkboxFor('Careful Spell'));
    expect(checkboxFor('Careful Spell')).not.toBeChecked();
    expect(apply).toHaveTextContent('Apply & Cast (3 SP)');
    fireEvent.click(apply);
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenNthCalledWith(2, {
      options: ['Quickened Spell', 'Subtle Spell'],
      totalCost: 3,
      twinTarget: null,
      psionicActive: false,
    });
  });

  it('caps selection at maxPerSpell by disabling the other options', () => {
    const { onConfirm } = renderPopup();
    fireEvent.click(checkboxFor('Careful Spell'));
    expect(checkboxFor('Careful Spell')).toBeChecked();

    const distant = checkboxFor('Distant Spell');
    expect(distant).toBeDisabled();
    fireEvent.click(distant);
    expect(distant).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Apply & Cast/ })).toHaveTextContent('Apply & Cast (1 SP)');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables unaffordable options and ignores their clicks when SP is low', () => {
    renderPopup({ playerStats: { ...basePlayerStats, _metamagicCurrentSP: 1 } });
    const quickened = checkboxFor('Quickened Spell');
    expect(quickened).toBeDisabled();
    expect(quickened.closest('.metamagic-option')).toHaveClass('metamagic-option-disabled');
    fireEvent.click(quickened);
    expect(quickened).not.toBeChecked();
    // A 1 SP option is still affordable at 1 SP
    expect(checkboxFor('Careful Spell')).toBeEnabled();
  });

  it('requires a second target before confirming Twinned Spell and sends twinTarget', () => {
    const { onConfirm } = renderPopup();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(checkboxFor('Twinned Spell'));
    const combo = screen.getByRole('combobox', { name: /Second Target/ });
    expect(screen.getByRole('option', { name: 'Goblin' })).toBeInTheDocument();

    const apply = screen.getByRole('button', { name: /Apply & Cast/ });
    expect(apply).toBeDisabled();
    fireEvent.click(apply);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(combo, { target: { value: 'Goblin' } });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      options: ['Twinned Spell'],
      totalCost: 3,
      twinTarget: 'Goblin',
      psionicActive: false,
    });
  });

  it('confirms Twinned Spell with a null twinTarget when no combat creatures exist', () => {
    getCombatSummary.mockReturnValue({ creatures: [] });
    const { onConfirm } = renderPopup();
    fireEvent.click(checkboxFor('Twinned Spell'));
    // Selector renders but offers no creature choices
    const combo = screen.getByRole('combobox', { name: /Second Target/ });
    expect(within(combo).queryByRole('option', { name: 'Goblin' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Apply & Cast/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      options: ['Twinned Spell'],
      totalCost: 3,
      twinTarget: null,
      psionicActive: false,
    });
  });

  it('waives the priciest selected option under Arcane Apotheosis and confirms at the reduced total', () => {
    hasArcaneApotheosis.mockReturnValue(true);
    getMaxMetamagicPerSpell.mockReturnValue(3);
    computeMetamagicCost.mockImplementation(apotheosisCostImpl);
    const { onConfirm } = renderPopup();

    fireEvent.click(checkboxFor('Quickened Spell'));
    fireEvent.click(checkboxFor('Careful Spell'));

    const quickenedRow = screen.getByText('Quickened Spell').closest('.metamagic-option');
    expect(within(quickenedRow).getByText('0 (waived)')).toBeInTheDocument();
    const carefulRow = screen.getByText('Careful Spell').closest('.metamagic-option');
    expect(within(carefulRow).getByText('1 SP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply & Cast/ })).toHaveTextContent('Apply & Cast (1 SP)');
    fireEvent.click(screen.getByRole('button', { name: /Apply & Cast/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      options: ['Quickened Spell', 'Careful Spell'],
      totalCost: 1,
      twinTarget: null,
      psionicActive: false,
    });
  });

  it('keeps combined Apotheosis + Psionic affordability honest in the total display and payload', () => {
    hasArcaneApotheosis.mockReturnValue(true);
    getMaxMetamagicPerSpell.mockReturnValue(3);
    computeMetamagicCost.mockImplementation(apotheosisCostImpl);
    const { onConfirm } = renderPopup({
      playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 1, _metamagicCurrentSP: 2 },
    });

    fireEvent.click(checkboxFor('Psionic Sorcery'));
    expect(checkboxFor('Psionic Sorcery')).toBeChecked();
    fireEvent.click(checkboxFor('Careful Spell'));
    fireEvent.click(checkboxFor('Quickened Spell'));

    // Careful + Quickened (1 after waiver) + Psionic (1) consumes the whole 2 SP budget
    const heightened = checkboxFor('Heightened Spell');
    expect(heightened).toBeDisabled();
    fireEvent.click(heightened);
    expect(heightened).not.toBeChecked();

    const apply = screen.getByRole('button', { name: /Apply & Cast/ });
    expect(apply).toHaveTextContent('Apply & Cast (2 SP)');
    fireEvent.click(apply);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      options: ['Careful Spell', 'Quickened Spell'],
      totalCost: 1,
      twinTarget: null,
      psionicActive: true,
    });
  });

  it('selects Psionic Sorcery at the exact SP budget, toggles off, and reports psionicActive both times', () => {
    computeMetamagicCost.mockReturnValue({ totalCost: 9, waivedName: null });
    const { onConfirm } = renderPopup({
      playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 1 },
    });

    expect(screen.getByText('Psionic Sorcery')).toBeInTheDocument();
    expect(screen.getByText(/Cast without Verbal or Somatic/)).toBeInTheDocument();

    const psionic = checkboxFor('Psionic Sorcery');
    fireEvent.click(psionic); // 9 + 1 = 10 = currentSP — boundary is affordable
    expect(psionic).toBeChecked();

    const apply = screen.getByRole('button', { name: /Apply & Cast/ });
    expect(apply).toHaveTextContent('Apply & Cast (10 SP)');
    fireEvent.click(apply);
    // CLA-271: confirmed totalCost is Metamagic-options only — psionic cost is
    // carried by psionicActive and paid downstream.
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      options: [],
      totalCost: 9,
      twinTarget: null,
      psionicActive: true,
    });

    fireEvent.click(psionic);
    expect(psionic).not.toBeChecked();
    fireEvent.click(apply);
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenNthCalledWith(2, {
      options: [],
      totalCost: 9,
      twinTarget: null,
      psionicActive: false,
    });
  });

  it('leaves Psionic Sorcery unselectable when totalCost + psionicCost exceeds SP', () => {
    computeMetamagicCost.mockReturnValue({ totalCost: 9, waivedName: null });
    const { onConfirm } = renderPopup({
      playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 2 },
    });

    const psionic = checkboxFor('Psionic Sorcery');
    expect(psionic).toBeDisabled(); // 10 − 9 = 1 < 2
    fireEvent.click(psionic);
    expect(psionic).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Apply & Cast/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      options: [],
      totalCost: 9,
      twinTarget: null,
      psionicActive: false,
    });
  });
});
