// @maintained-by-ai 2026-11-28
// Popups-folder canon (run2#2129-#2131): this lane owns ONLY the UI seam —
// option list render, selection payload shape, and gating. Rules math lives in
// metamagicRules.test.js; consumer prop-mapping lives in
// CharSpells.Popups.popupWidgets.test.jsx (stubbed popup). NOTE: MetamagicPopup
// does NOT mount TargetPopupBase — its own spell-name/SP-summary/skip/keydown
// markup (MetamagicPopup.jsx:141-147, :168-238) is owned HERE, not by
// TargetPopupBase.test.jsx. Roles not class selectors; class-serialization
// pins dropped per canon.
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MetamagicPopup from './MetamagicPopup.jsx';

vi.mock('../../../services/rules/spells/metamagicRules.js', () => ({
  getPreCastOptions: vi.fn(),
  getMaxMetamagicPerSpell: vi.fn(),
  computeMetamagicCost: vi.fn(),
  hasArcaneApotheosis: vi.fn(),
  consumeArcaneApotheosisWaiver: vi.fn(() => 7),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

import { getPreCastOptions, getMaxMetamagicPerSpell, computeMetamagicCost, hasArcaneApotheosis, consumeArcaneApotheosisWaiver } from '../../../services/rules/spells/metamagicRules.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ── Fixtures ──

const baseSpell = { name: 'Fireball', level: 3 };

const basePlayerStats = {
  name: 'Sorcerer',
  class: { name: 'Sorcerer' },
  _metamagicCurrentSP: 10,
};

const preCastOptions = [
  { name: 'Careful Spell', resolvedCost: 1, description: 'Allies automatically succeed on saving throws.' },
  { name: 'Distant Spell', resolvedCost: 1, description: 'Double the range of the spell.' },
  { name: 'Heightened Spell', resolvedCost: 3, description: 'Give one target disadvantage on its first saving throw.' },
  { name: 'Quickened Spell', resolvedCost: 2, description: 'Change the casting time to 1 bonus action.' },
  { name: 'Subtle Spell', resolvedCost: 1, description: 'Cast the spell without somatic or verbal components.' },
  { name: 'Twinned Spell', resolvedCost: 3, description: 'Target a second creature in range.' },
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
  const props = {
    spell: baseSpell,
    playerStats: { ...basePlayerStats, ...overrides.playerStats },
    campaignName: 'test-campaign',
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
  };
  return {
    ...render(<MetamagicPopup {...props} />),
    onConfirm: props.onConfirm,
    onSkip: props.onSkip,
  };
}

const checkboxFor = (name) => screen.getByRole('checkbox', { name: new RegExp(name) });
const applyButton = () => screen.getByRole('button', { name: /Apply & Cast/ });

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

  it('renders spell name, level, SP summary, and every option — no Psionic row and no Incarnate note by default', () => {
    renderPopup();
    expect(screen.getByRole('heading', { name: /Metamagic/ })).toBeInTheDocument();
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText(/\(Level 3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Sorcery Points:/)).toHaveTextContent(
      'Sorcery Points: 10 available — 0 selected — 10 remaining',
    );
    // All six options render as checkboxes with cost and description copy
    expect(screen.getAllByRole('checkbox')).toHaveLength(preCastOptions.length);
    for (const opt of preCastOptions) {
      expect(checkboxFor(opt.name)).toBeInTheDocument();
    }
    expect(screen.getByText('2 SP')).toBeInTheDocument(); // Quickened cost copy
    expect(screen.getByText('Give one target disadvantage on its first saving throw.')).toBeInTheDocument();
    // maxPerSpell=1 (default): the Sorcery Incarnate note is gated off; its
    // positive leg (maxPerSpell>1) is pinned in the multi-select test.
    expect(screen.queryByText(/Sorcery Incarnate/)).not.toBeInTheDocument();
    // Absence is gated on a positive leg: the options list above rendered in full
    expect(screen.queryByText('Psionic Sorcery')).not.toBeInTheDocument();
  });

  it('shows the not-a-Sorcerer view with a working Close button when there are no options', () => {
    getPreCastOptions.mockReturnValue([]);
    const { onSkip } = renderPopup({ playerStats: { class: { name: 'Wizard' } } });
    expect(screen.getByText('Your character is not a Sorcerer with available Metamagic options.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('skips only via Escape or Cast Without Metamagic — overlay clicks are inert', () => {
    const { onSkip, container } = renderPopup();
    fireEvent.click(container.firstChild); // overlay backdrop
    expect(onSkip).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cast Without Metamagic' }));
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it('gates Apply until selection, accrues cost as options toggle, emits the exact payload, and never stamps the Apotheosis latch on a paid confirm', () => {
    getMaxMetamagicPerSpell.mockReturnValue(3);
    const { onConfirm } = renderPopup();
    // maxPerSpell>1 positive leg of the Incarnate-note gate
    expect(screen.getByText(/Sorcery Incarnate/)).toHaveTextContent(
      'Sorcery Incarnate: you can use up to 3 Metamagic options per spell.',
    );
    const apply = applyButton();

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
    // #1451(a): a waivedName-null (paid) confirm must leave the once-per-turn
    // latch untouched (the waived leg is pinned in the Apotheosis test).
    expect(consumeArcaneApotheosisWaiver).not.toHaveBeenCalled();

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

  it('disables and ignores clicks on options blocked by the per-spell cap or by SP affordability', () => {
    // Cap leg: maxPerSpell=1 (default) — a second option is unselectable
    const { onConfirm } = renderPopup();
    fireEvent.click(checkboxFor('Careful Spell'));
    expect(checkboxFor('Careful Spell')).toBeChecked();
    const distant = checkboxFor('Distant Spell');
    expect(distant).toBeDisabled();
    fireEvent.click(distant);
    expect(distant).not.toBeChecked();
    expect(applyButton()).toHaveTextContent('Apply & Cast (1 SP)');
    expect(onConfirm).not.toHaveBeenCalled();

    // Affordability leg: 1 SP — the 2 SP option is unselectable, the 1 SP one stays live
    cleanup();
    renderPopup({ playerStats: { _metamagicCurrentSP: 1 } });
    const quickened = checkboxFor('Quickened Spell');
    expect(quickened).toBeDisabled();
    fireEvent.click(quickened);
    expect(quickened).not.toBeChecked();
    expect(checkboxFor('Careful Spell')).toBeEnabled();
  });

  it('requires a twin target before confirming Twinned Spell and threads twinTarget through the payload', () => {
    const { onConfirm } = renderPopup();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(checkboxFor('Twinned Spell'));
    const combo = screen.getByRole('combobox', { name: /Second Target/ });
    expect(screen.getByRole('option', { name: 'Goblin' })).toBeInTheDocument();

    const apply = applyButton();
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

    // No-combat leg (:136 creatureTargets.length > 0): the selector offers no
    // choices and the payload carries a null twinTarget without gating Apply.
    cleanup();
    getCombatSummary.mockReturnValue({ creatures: [] });
    const solo = renderPopup();
    fireEvent.click(checkboxFor('Twinned Spell'));
    const emptyCombo = screen.getByRole('combobox', { name: /Second Target/ });
    expect(within(emptyCombo).queryByRole('option', { name: 'Goblin' })).not.toBeInTheDocument();
    fireEvent.click(applyButton());
    expect(solo.onConfirm).toHaveBeenCalledTimes(1);
    expect(solo.onConfirm).toHaveBeenCalledWith({
      options: ['Twinned Spell'],
      totalCost: 3,
      twinTarget: null,
      psionicActive: false,
    });
  });

  it('waives the priciest selected option under Arcane Apotheosis and consumes the latch once, only at confirm', () => {
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
    expect(applyButton()).toHaveTextContent('Apply & Cast (1 SP)');
    // #1451(a): previewing (renders + toggles above) must NOT consume the waiver.
    expect(consumeArcaneApotheosisWaiver).not.toHaveBeenCalled();
    fireEvent.click(applyButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      options: ['Quickened Spell', 'Careful Spell'],
      totalCost: 1,
      twinTarget: null,
      psionicActive: false,
    });
    // #1451(a): the waived confirm consumes the once-per-turn latch exactly once,
    // at the confirm seam (disk 2024 L20 "on each of your turns").
    expect(consumeArcaneApotheosisWaiver).toHaveBeenCalledTimes(1);
    expect(consumeArcaneApotheosisWaiver).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sorcerer' }), 'test-campaign',
    );
  });

  it('keeps combined Apotheosis + Psionic affordability honest in the total display and payload', () => {
    hasArcaneApotheosis.mockReturnValue(true);
    getMaxMetamagicPerSpell.mockReturnValue(3);
    computeMetamagicCost.mockImplementation(apotheosisCostImpl);
    const { onConfirm } = renderPopup({
      playerStats: { _isPsionicSpell: true, _psionicCost: 1, _metamagicCurrentSP: 2 },
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

    const apply = applyButton();
    expect(apply).toHaveTextContent('Apply & Cast (2 SP)');
    fireEvent.click(apply);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      options: ['Careful Spell', 'Quickened Spell'],
      totalCost: 1,
      twinTarget: null,
      psionicActive: true,
    });
    // #1451(a): waived + psionic combo still burns exactly one turn waiver.
    expect(consumeArcaneApotheosisWaiver).toHaveBeenCalledTimes(1);
  });

  it('toggles Psionic Sorcery at the exact SP budget, reports psionicActive both ways, and blocks it when unaffordable', () => {
    computeMetamagicCost.mockReturnValue({ totalCost: 9, waivedName: null });
    const { onConfirm } = renderPopup({
      playerStats: { _isPsionicSpell: true, _psionicCost: 1 },
    });

    expect(screen.getByText('Psionic Sorcery')).toBeInTheDocument();
    expect(screen.getByText(/Cast without Verbal or Somatic/)).toBeInTheDocument();

    const psionic = checkboxFor('Psionic Sorcery');
    fireEvent.click(psionic); // 9 + 1 = 10 = currentSP — boundary is affordable
    expect(psionic).toBeChecked();

    const apply = applyButton();
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

    // Unaffordable leg: 10 − 9 = 1 < psionicCost 2 — the row renders disabled
    // and its clicks are ignored (the psionicActive:false payload is pinned above).
    cleanup();
    renderPopup({ playerStats: { _isPsionicSpell: true, _psionicCost: 2 } });
    const blocked = checkboxFor('Psionic Sorcery');
    expect(blocked).toBeDisabled();
    fireEvent.click(blocked);
    expect(blocked).not.toBeChecked();
  });
});
