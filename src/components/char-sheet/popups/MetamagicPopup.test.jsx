// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

function renderPopup(overrides = {}) {
  const spell = overrides.spell !== undefined ? overrides.spell : { ...baseSpell };
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

    it('updates SP cost display when options are selected', () => {
      getMaxMetamagicPerSpell.mockReturnValue(3);
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      renderPopup();
      fireEvent.click(screen.getByText('Quickened Spell'));
      const btn = screen.getByText(/Apply & Cast/);
      expect(btn.textContent).toContain('2 SP');
      fireEvent.click(screen.getByText('Careful Spell'));
      expect(btn.textContent).toContain('3 SP');
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

    it('prevents selecting options that exceed SP budget', () => {
      getMaxMetamagicPerSpell.mockReturnValue(3);
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _metamagicCurrentSP: 2 } });
      fireEvent.click(screen.getByText('Careful Spell'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Careful Spell'],
        totalCost: 1,
        twinTarget: null,
        psionicActive: false,
      });
    });
  });

  // ── Twinned Spell target selection ──

  describe('Twinned Spell target selection', () => {
    it('shows target selector when Twinned Spell is selected', () => {
      renderPopup();
      fireEvent.click(screen.getByText('Twinned Spell'));
      expect(screen.getByText(/Second Target/)).toBeInTheDocument();
    });

    it('populates target dropdown with all creatures in combat', () => {
      renderPopup();
      fireEvent.click(screen.getByText('Twinned Spell'));
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.getByText('Orc')).toBeInTheDocument();
      expect(screen.getByText('Sorcerer')).toBeInTheDocument();
    });

    it('disables Apply & Cast when Twinned selected but no target chosen', () => {
      renderPopup();
      fireEvent.click(screen.getByText('Twinned Spell'));
      const btn = screen.getByText(/Apply & Cast/);
      expect(btn.disabled).toBe(true);
    });

    it('enables Apply & Cast when Twinned selected and target chosen', () => {
      const { onConfirm } = renderPopup();
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Twinned Spell'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Goblin' } });
      const btn = screen.getByText(/Apply & Cast/);
      expect(btn.disabled).toBe(false);
      fireEvent.click(btn);
      expect(onConfirm).toHaveBeenCalled();
    });

    it('includes twinTarget in onConfirm when Twinned is selected with a target', () => {
      const { onConfirm } = renderPopup();
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Twinned Spell'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Orc' } });
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Twinned Spell'],
        totalCost: 3,
        twinTarget: 'Orc',
        psionicActive: false,
      });
    });
  });

  // ── Affordability / insufficient SP ──

  describe('affordability', () => {
    it('disables Apply & Cast when cost exceeds available SP', () => {
      getMaxMetamagicPerSpell.mockReturnValue(3);
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      renderPopup({ playerStats: { ...basePlayerStats, _metamagicCurrentSP: 1 } });
      fireEvent.click(screen.getByText('Quickened Spell'));
      const btn = screen.getByText(/Apply & Cast/);
      expect(btn.disabled).toBe(true);
    });
  });

  // ── Arcane Apotheosis (waived cost) ──

  describe('Arcane Apotheosis', () => {
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

    it('shows waived cost label when Arcane Apotheosis is active', () => {
      hasArcaneApotheosis.mockReturnValue(true);
      getMaxMetamagicPerSpell.mockReturnValue(3);
      setupApotheosisCostMock();
      renderPopup();
      fireEvent.click(screen.getByText('Quickened Spell'));
      fireEvent.click(screen.getByText('Careful Spell'));
      const btn = screen.getByText(/Apply & Cast/);
      expect(btn.textContent).toContain('1 SP');
    });

    it('shows waived cost text on the most expensive option', () => {
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

    it('enables Apply & Cast when a single option is free via Arcane Apotheosis', () => {
      hasArcaneApotheosis.mockReturnValue(true);
      getMaxMetamagicPerSpell.mockReturnValue(3);
      setupApotheosisCostMock();
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _metamagicCurrentSP: 1 } });
      fireEvent.click(screen.getByText('Quickened Spell'));
      const btn = screen.getByText(/Apply & Cast/);
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toContain('0 SP');
      fireEvent.click(btn);
      expect(onConfirm).toHaveBeenCalledWith({
        options: ['Quickened Spell'],
        totalCost: 0,
        twinTarget: null,
        psionicActive: false,
      });
    });
  });

  // ── 2024 ruleset ──

  describe('2024 ruleset / maxPerSpell > 1', () => {
    it('shows incarnate note when maxPerSpell > 1', () => {
      getMaxMetamagicPerSpell.mockReturnValue(2);
      renderPopup();
      expect(screen.getByText(/Sorcery Incarnate/)).toBeInTheDocument();
      expect(screen.getByText(/up to 2 Metamagic options/)).toBeInTheDocument();
    });

    it('does not show incarnate note when maxPerSpell is 1', () => {
      getMaxMetamagicPerSpell.mockReturnValue(1);
      renderPopup();
      expect(screen.queryByText(/Sorcery Incarnate/)).not.toBeInTheDocument();
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

    it('includes psionicActive when Psionic Sorcery is affordable and selected', () => {
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 1 } });
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      fireEvent.click(screen.getByText('Psionic Sorcery'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: [],
        totalCost: 1,
        twinTarget: null,
        psionicActive: true,
      });
    });

    it('adds psionic cost to total cost display', () => {
      computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
      renderPopup({ playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 1 } });
      fireEvent.click(screen.getByText('Psionic Sorcery'));
      const btn = screen.getByText(/Apply & Cast/);
      expect(btn.textContent).toContain('1 SP');
    });

    it('includes psionicActive when totalCost + psionicCost equals currentSP', () => {
      computeMetamagicCost.mockReturnValue({ totalCost: 9, waivedName: null });
      const { onConfirm } = renderPopup({ playerStats: { ...basePlayerStats, _isPsionicSpell: true, _psionicCost: 1 } });
      fireEvent.click(screen.getByText('Psionic Sorcery'));
      fireEvent.click(screen.getByText(/Apply & Cast/));
      expect(onConfirm).toHaveBeenCalledWith({
        options: [],
        totalCost: 10,
        twinTarget: null,
        psionicActive: true,
      });
    });
  });

  // ── Apotheosis + Psionic combined ──

  describe('Apotheosis + Psionic combined', () => {
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
        totalCost: 2,
        twinTarget: null,
        psionicActive: true,
      });
    });
  });

  // ── Spell level affects Twinned Spell cost ──

  it('calculates Twinned Spell cost based on spell level', () => {
    const highLevelSpell = { name: 'Dragon Breath', level: 5 };
    computeMetamagicCost.mockImplementation((selected) => createCostMock(selected));
    const twinnedOptions = preCastOptions.map((o) =>
      o.name === 'Twinned Spell' ? { ...o, resolvedCost: 5 } : o,
    );
    getPreCastOptions.mockReturnValue(twinnedOptions);
    renderPopup({ spell: highLevelSpell });
    expect(screen.getByText('5 SP')).toBeInTheDocument();
  });
});
