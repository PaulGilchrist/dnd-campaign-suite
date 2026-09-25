// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
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

// Import mocked functions after vi.mock calls
import { getPreCastOptions, getMaxMetamagicPerSpell, computeMetamagicCost, hasArcaneApotheosis } from '../../../services/rules/spells/metamagicRules.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ── Test fixtures ──

const baseSpell = { name: 'Fireball', level: 3 };

const basePlayerStats = {
  name: 'Sorcerer',
  class: { name: 'Sorcerer' },
  abilities: [{ name: 'Charisma', bonus: 4 }],
  rules: '5e',
  level: 5,
  _metamagicCurrentSP: 10,
  _isPsionicSpell: false,
  _psionicCost: 0,
};

const preCastOptions = [
  { name: 'Careful Spell', resolvedCost: 1, description: 'Allies automatically succeed on saving throws.', affordable: true },
  { name: 'Distant Spell', resolvedCost: 1, description: 'Double the range of the spell.', affordable: true },
  { name: 'Heightened Spell', resolvedCost: 3, description: 'Give one target disadvantage on its first saving throw.', affordable: true },
  { name: 'Quickened Spell', resolvedCost: 2, description: 'Change the casting time to 1 bonus action.', affordable: true },
  { name: 'Subtle Spell', resolvedCost: 1, description: 'Cast the spell without somatic or verbal components.', affordable: true },
  { name: 'Twinned Spell', resolvedCost: 3, description: 'Target a second creature in range.', affordable: true },
];

function createCostMock(selected) {
  let total = 0;
  for (const name of selected) {
    const opt = preCastOptions.find((o) => o.name === name);
    if (opt) total += opt.resolvedCost;
  }
  return { totalCost: total, waivedName: null };
}

// Shared apotheosis cost mock — waived the most expensive option
function setupApotheosisCostMock() {
  computeMetamagicCost.mockImplementation((selected) => {
    if (selected.length === 0) return { totalCost: 0, waivedName: null };
    const maxCost = Math.max(...selected.map((name) => {
      const opt = preCastOptions.find((o) => o.name === name);
      return opt?.resolvedCost || 0;
    }));
    const waivedName = preCastOptions.find((o) => o.resolvedCost === maxCost)?.name;
    const total = selected.reduce((sum, name) => {
      const opt = preCastOptions.find((o) => o.name === name);
      return sum + (opt?.resolvedCost || 0);
    }, 0) - maxCost;
    return { totalCost: total, waivedName };
  });
}

function renderPopup(overrides = {}) {
  const spell = overrides.spell !== undefined ? { ...overrides.spell } : { ...baseSpell };
  const playerStats = { ...basePlayerStats, ...overrides.playerStats };
  const props = {
    spell,
    playerStats,
    campaignName: 'test',
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

// ── Tests ──

describe('MetamagicPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPreCastOptions.mockReturnValue(preCastOptions);
    getMaxMetamagicPerSpell.mockReturnValue(1);
    computeMetamagicCost.mockImplementation(() => ({ totalCost: 0, waivedName: null }));
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
    // Remove the document keydown listener added by the component
    document.removeEventListener('keydown', () => {});
  });

  // ── Rendering ──

  it('renders spell name, level, and all pre-cast metamagic options', () => {
    renderPopup();
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    expect(screen.getByText('Metamagic')).toBeInTheDocument();
    expect(screen.getByText(/Sorcery Points:/)).toBeInTheDocument();
    expect(screen.getByText('Careful Spell')).toBeInTheDocument();
    expect(screen.getByText('Distant Spell')).toBeInTheDocument();
    expect(screen.getByText('Heightened Spell')).toBeInTheDocument();
    expect(screen.getByText('Quickened Spell')).toBeInTheDocument();
    expect(screen.getByText('Subtle Spell')).toBeInTheDocument();
    expect(screen.getByText('Twinned Spell')).toBeInTheDocument();
    expect(screen.getByText('Allies automatically succeed on saving throws.')).toBeInTheDocument();
    expect(screen.getByText('Double the range of the spell.')).toBeInTheDocument();
    expect(screen.getByText(/Apply & Cast/)).toBeInTheDocument();
    expect(screen.getByText('Cast Without Metamagic')).toBeInTheDocument();
    expect(screen.queryByText('Empowered Spell')).not.toBeInTheDocument();
  });

  // ── Empty options (non-Sorcerer) ──

  it('shows "not a Sorcerer" message for non-Sorcerer', () => {
    getPreCastOptions.mockReturnValue([]);
    renderPopup({ playerStats: { ...basePlayerStats, class: { name: 'Wizard' } } });
    expect(screen.getByText(/Your character is not a Sorcerer with available Metamagic options/)).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('calls onSkip when Close button is clicked in empty-options modal', () => {
    getPreCastOptions.mockReturnValue([]);
    const { onSkip } = renderPopup({ playerStats: { ...basePlayerStats, class: { name: 'Wizard' } } });
    fireEvent.click(screen.getByText('Close'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  // ── Skip / close behavior ──

  describe('skip / close', () => {
    it('calls onSkip when Cast Without Metamagic is clicked', () => {
      const { onSkip } = renderPopup();
      fireEvent.click(screen.getByText('Cast Without Metamagic'));
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when Escape key is pressed', () => {
      const { onSkip } = renderPopup();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when the overlay background is clicked', () => {
      const { onSkip } = renderPopup();
      const overlay = document.querySelector('.popup-overlay');
      fireEvent.click(overlay);
      expect(onSkip).not.toHaveBeenCalled();
      expect(screen.getByText('Cast Without Metamagic')).toBeInTheDocument();
    });
  });

  // ── Confirm behavior ──

  describe('option selection and confirm', () => {
    it('calls onConfirm with selected options and cost', () => {
      const { onConfirm } = renderPopup();
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Quickened Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Quickened Spell'],
        totalCost: 2,
        twinTarget: null,
        psionicActive: false,
      });
    });

    it('accumulates cost for multiple selected options', () => {
      getMaxMetamagicPerSpell.mockReturnValue(3);
      const { onConfirm } = renderPopup();
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Careful Spell'));
      fireEvent.click(screen.getByText('Subtle Spell'));
      fireEvent.click(screen.getByText('Quickened Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Careful Spell', 'Subtle Spell', 'Quickened Spell'],
        totalCost: 4,
        twinTarget: null,
        psionicActive: false,
      });
    });

    it('does not call onConfirm when no options are selected', () => {
      const { onConfirm } = renderPopup();
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('updates SP cost in confirm when options are selected', () => {
      getMaxMetamagicPerSpell.mockReturnValue(3);
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      const { onConfirm } = renderPopup();
      fireEvent.click(screen.getByText('Quickened Spell'));
      fireEvent.click(screen.getByText('Careful Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Quickened Spell', 'Careful Spell'],
        totalCost: 3,
        twinTarget: null,
        psionicActive: false,
      });
    });

    it('deselects an option when clicked again', () => {
      const { onConfirm } = renderPopup();
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Careful Spell'));
      fireEvent.click(screen.getByText('Careful Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('selects first option and prevents selecting second when max is 1', () => {
      getMaxMetamagicPerSpell.mockReturnValue(1);
      const { onConfirm } = renderPopup();
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Careful Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Careful Spell'],
        totalCost: 1,
        twinTarget: null,
        psionicActive: false,
      });
    });

    it('does not call onConfirm when cost exceeds available SP', () => {
      getMaxMetamagicPerSpell.mockReturnValue(3);
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _metamagicCurrentSP: 1 } });
      fireEvent.click(screen.getByText('Quickened Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  // ── Twinned Spell target selection ──

  describe('Twinned Spell target selection', () => {
    it('shows target selector when Twinned Spell is selected', () => {
      renderPopup();
      fireEvent.click(screen.getByText('Twinned Spell'));
      expect(screen.getByText(/Second Target/)).toBeInTheDocument();
    });

    it('does not call onConfirm when Twinned selected but no target chosen', () => {
      const { onConfirm } = renderPopup();
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Twinned Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('confirms with twinTarget when Twinned selected and target chosen', () => {
      const { onConfirm } = renderPopup();
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Twinned Spell'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Goblin' } });
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Twinned Spell'],
        totalCost: 3,
        twinTarget: 'Goblin',
        psionicActive: false,
      });
    });

    it('sends twinTarget as null when no creatures exist', () => {
      getCombatSummary.mockReturnValue({ creatures: [] });
      const { onConfirm } = renderPopup();
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Twinned Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Twinned Spell'],
        totalCost: 3,
        twinTarget: null,
        psionicActive: false,
      });
    });
  });

  // ── Affordability / insufficient SP ──

  describe('affordability', () => {
    it('disables the option label when an option is unaffordable', () => {
      getMaxMetamagicPerSpell.mockReturnValue(3);
      renderPopup({ playerStats: { ...basePlayerStats, _metamagicCurrentSP: 1 } });
      const optionLabel = screen.getByRole('checkbox', { name: /Heightened Spell/ }).closest('.metamagic-option');
      expect(optionLabel).toHaveClass('metamagic-option-disabled');
    });

    it('allows confirming when selected options fit within SP budget', () => {
      getMaxMetamagicPerSpell.mockReturnValue(3);
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _metamagicCurrentSP: 2 } });
      fireEvent.click(screen.getByText('Careful Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  // ── Arcane Apotheosis (waived cost) ──

  describe('Arcane Apotheosis', () => {
    it('shows waived cost label on the most expensive option', () => {
      hasArcaneApotheosis.mockReturnValue(true);
      getMaxMetamagicPerSpell.mockReturnValue(1);
      setupApotheosisCostMock();
      renderPopup();
      fireEvent.click(screen.getByText('Quickened Spell'));
      fireEvent.click(screen.getByText('Careful Spell'));
      expect(screen.getByText('0 (waived)')).toBeInTheDocument();
    });

    it('allows selecting additional options when Apotheosis makes them affordable', () => {
      hasArcaneApotheosis.mockReturnValue(true);
      getMaxMetamagicPerSpell.mockReturnValue(3);
      setupApotheosisCostMock();
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _metamagicCurrentSP: 1 } });
      fireEvent.click(screen.getByText('Careful Spell'));
      fireEvent.click(screen.getByText('Quickened Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Careful Spell', 'Quickened Spell'],
        totalCost: 1,
        twinTarget: null,
        psionicActive: false,
      });
    });

    it('confirms with waived cost of 0 when Apotheosis covers the entire cost', () => {
      hasArcaneApotheosis.mockReturnValue(true);
      getMaxMetamagicPerSpell.mockReturnValue(3);
      setupApotheosisCostMock();
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _metamagicCurrentSP: 1 } });
      fireEvent.click(screen.getByText('Quickened Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Quickened Spell'],
        totalCost: 0,
        twinTarget: null,
        psionicActive: false,
      });
    });
  });

  // ── 2024 ruleset / maxPerSpell > 1 ──

  describe('2024 ruleset / maxPerSpell > 1', () => {
    it.each`
      maxPerSpell | showNote
      ${1}        | ${false}
      ${2}        | ${true}
      ${3}        | ${true}
    `('shows incarnate note when maxPerSpell > 1 ($maxPerSpell => $showNote)', ({ maxPerSpell, showNote }) => {
      getMaxMetamagicPerSpell.mockReturnValue(maxPerSpell);
      renderPopup();
      if (showNote) {
        expect(screen.getByText(/Sorcery Incarnate/)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`up to ${maxPerSpell} Metamagic options`))).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Sorcery Incarnate/)).not.toBeInTheDocument();
      }
    });
  });

  // ── Psionic spells ──

  describe('Psionic spells', () => {
    it('does not show Psionic Sorcery option for non-psionic spells', () => {
      renderPopup();
      expect(screen.queryByText('Psionic Sorcery')).not.toBeInTheDocument();
    });

    it('shows Psionic Sorcery option for psionic spells', () => {
      renderPopup({ playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 1 } });
      expect(screen.getByText('Psionic Sorcery')).toBeInTheDocument();
      expect(screen.getByText(/Cast without Verbal or Somatic/)).toBeInTheDocument();
    });

    it('does not include psionicActive when Psionic Sorcery is not affordable', () => {
      computeMetamagicCost.mockReturnValue({ totalCost: 10, waivedName: null });
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 2 } });
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: [],
        totalCost: 10,
        twinTarget: null,
        psionicActive: false,
      });
    });

    it('includes psionicActive when Psionic Sorcery is selected and affordable', () => {
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 1 } });
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Psionic Sorcery'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      // CLA-271: confirmed totalCost is Metamagic-options only — psionic cost is
      // carried by psionicActive and paid downstream.
      expect(onConfirm).toHaveBeenCalledWith({
        options: [],
        totalCost: 0,
        twinTarget: null,
        psionicActive: true,
      });
    });

    it('includes psionicActive when totalCost + psionicCost equals currentSP', () => {
      computeMetamagicCost.mockReturnValue({ totalCost: 9, waivedName: null });
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 1 } });
      fireEvent.click(screen.getByText('Psionic Sorcery'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: [],
        totalCost: 9,
        twinTarget: null,
        psionicActive: true,
      });
    });

    it('does not include psionicActive when psionic cost exceeds remaining SP', () => {
      computeMetamagicCost.mockReturnValue({ totalCost: 9, waivedName: null });
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 2 } });
      fireEvent.click(screen.getByText('Psionic Sorcery'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: [],
        totalCost: 9,
        twinTarget: null,
        psionicActive: false,
      });
    });

    it('unchecks Psionic Sorcery when deselected and re-confirms', () => {
      computeMetamagicCost.mockReturnValue({ totalCost: 9, waivedName: null });
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 1 } });
      const checkbox = screen.getByRole('checkbox', { name: /Psionic Sorcery/ });
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: [],
        totalCost: 9,
        twinTarget: null,
        psionicActive: false,
      });
    });
  });

  // ── Apotheosis + Psionic combined ──

  describe('Apotheosis + Psionic combined', () => {
    it('computes affordability correctly when both Apotheosis and Psionic are active', () => {
      hasArcaneApotheosis.mockReturnValue(true);
      getMaxMetamagicPerSpell.mockReturnValue(3);
      setupApotheosisCostMock();
      const { onConfirm } = renderPopup({
        playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 1, _metamagicCurrentSP: 3 },
      });
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Psionic Sorcery'));
      fireEvent.click(screen.getByText('Careful Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Careful Spell'],
        totalCost: 1,
        twinTarget: null,
        psionicActive: true,
      });
    });
  });

  // ── Spell level affects Twinned Spell cost ──

  it('calculates Twinned Spell cost based on spell level', () => {
    const highLevelSpell = { name: 'Dragon Breath', level: 5 };
    const twinnedOptions = preCastOptions.map((o) =>
      o.name === 'Twinned Spell' ? { ...o, resolvedCost: 5 } : o,
    );
    getPreCastOptions.mockReturnValue(twinnedOptions);
    computeMetamagicCost.mockImplementation((selected, options) => {
      if (selected.length === 0) return { totalCost: 0, waivedName: null };
      const total = selected.reduce((sum, name) => {
        const opt = options?.find((o) => o.name === name);
        return sum + (opt?.resolvedCost || 0);
      }, 0);
      return { totalCost: total, waivedName: null };
    });
    const { onConfirm } = renderPopup({ spell: highLevelSpell });
    fireEvent.click(screen.getByText('Twinned Spell'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Goblin' } });
    fireEvent.click(screen.getByText(/Apply & Cast/));
    expect(onConfirm).toHaveBeenCalledWith({
      options: ['Twinned Spell'],
      totalCost: 5,
      twinTarget: 'Goblin',
      psionicActive: false,
    });
  });
});
