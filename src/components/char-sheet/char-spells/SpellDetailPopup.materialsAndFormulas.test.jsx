// @improved-by-ai
/**
 * SpellDetailPopup — consumed-material row and MOD resolution in the upcast selector.
 *
 * materialComponents.js is intentionally NOT mocked here: it is a pure registry +
 * backpack lookup whose unit behavior is already covered by
 * src/services/rules/spells/materialComponents.test.js. Running it REAL lets these
 * tests pin the popup's actual contract (a registry spell arms the Material row;
 * the exact backpack name clears the "(not found in backpack)" warning) instead of
 * only proving the component echoes whatever a mock returned.
 *
 * Selector visibility, radio enabling, and selection state are covered by the
 * sibling SpellDetailPopup.rendering / .psionicCanCast / .freeCast test files.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
}));

const CAMPAIGN = 'test-campaign';

const createPlayerStats = ({ spellAbilities, ...rest } = {}) => ({
  name: 'Elara',
  level: 5,
  class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
  abilities: [{ name: 'Charisma', bonus: 3 }],
  proficiency: 3,
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 2,
    spells: [],
    ...(spellAbilities || {}),
  },
  automation: { passives: [], actions: [] },
  ...rest,
});

const createSpell = (overrides = {}) => ({
  name: 'Magic Missile',
  level: 1,
  description: 'Three darts of force strike a creature.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  school: 'Evocation',
  ...overrides,
});

// Revivify is in the real MATERIAL_REGISTRY: Diamond (300 gp), spell-consumed.
const createRevivify = () =>
  createSpell({
    name: 'Revivify',
    level: 3,
    description: 'You touch a living creature that has died.',
    damage: undefined,
  });

/** Build the popup's upcast rows from the spell's own damage ladder (single source). */
const upcastLevelsFrom = (spell, availableSlots = 4) =>
  Object.entries(spell.damage.damage_at_slot_level).map(([level, formula]) => ({
    level: Number(level),
    formula,
    availableSlots,
  }));

const renderPopup = (spell, playerStats, extraProps = {}) =>
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={CAMPAIGN}
      onClose={vi.fn()}
      {...extraProps}
    />,
  );

const renderUpcast = (ladder, statsOverrides = {}) => {
  const spell = createSpell({ damage: { damage_at_slot_level: ladder } });
  renderPopup(spell, createPlayerStats(statsOverrides), { upcastLevels: upcastLevelsFrom(spell) });
};

describe('SpellDetailPopup', () => {
  describe('Consumed material row', () => {
    it('shows the consumed material with a missing-backpack warning when the player lacks it', () => {
      renderPopup(createRevivify(), createPlayerStats());

      expect(screen.getByText('Material:')).toBeInTheDocument();
      expect(screen.getByText(/Diamond \(300 gp\)/)).toBeInTheDocument();
      expect(screen.getByText(/diamond worth 300\+ GP/)).toBeInTheDocument();
      expect(screen.getByText('(not found in backpack)')).toBeInTheDocument();
    });

    it('shows the material row without the warning when the exact item is in the backpack', () => {
      const stats = createPlayerStats({ inventory: { backpack: ['Diamond (300 gp)'] } });

      renderPopup(createRevivify(), stats);

      expect(screen.getByText(/Diamond \(300 gp\)/)).toBeInTheDocument();
      expect(screen.queryByText(/not found in backpack/)).not.toBeInTheDocument();
    });

    it('keeps the warning when the backpack holds a similar but differently named item', () => {
      const stats = createPlayerStats({ inventory: { backpack: [{ name: 'Diamond (1,000 gp)' }] } });

      renderPopup(createRevivify(), stats);

      expect(screen.getByText(/Diamond \(300 gp\)/)).toBeInTheDocument();
      expect(screen.getByText('(not found in backpack)')).toBeInTheDocument();
    });

    it('renders no material row for a spell with no consumed material', () => {
      renderPopup(createSpell(), createPlayerStats());

      expect(screen.queryByText(/Material:/)).not.toBeInTheDocument();
    });
  });

  describe('Upcast formula MOD resolution', () => {
    it.each([
      { label: 'positive modifier', modifier: 3, resolved: ['1d8+3', '2d8+3'] },
      { label: 'zero modifier', modifier: 0, resolved: ['1d8+0', '2d8+0'] },
      { label: 'negative modifier', modifier: -1, resolved: ['1d8+-1', '2d8+-1'] },
      { label: 'missing modifier (defaults to 0)', modifier: undefined, resolved: ['1d8+0', '2d8+0'] },
    ])('replaces MOD with the $label in every upcast row', ({ modifier, resolved }) => {
      renderUpcast({ '1': '1d8+MOD', '2': '2d8+MOD' }, { spellAbilities: { modifier } });

      resolved.forEach((text) => expect(screen.getByText(text)).toBeInTheDocument());
      // The formula belongs to its own level row, and no raw placeholder leaks.
      expect(screen.getByText(resolved[0]).closest('label')).toHaveTextContent('Level 1');
      expect(screen.queryByText(/MOD/)).not.toBeInTheDocument();
    });

    it('replaces every MOD occurrence within a single formula', () => {
      renderUpcast({ '1': '2d6+MOD+MOD', '2': '3d6+MOD+MOD' }, { spellAbilities: { modifier: 2 } });

      expect(screen.getByText('2d6+2+2')).toBeInTheDocument();
      expect(screen.getByText('3d6+2+2')).toBeInTheDocument();
      expect(screen.queryByText(/MOD/)).not.toBeInTheDocument();
    });

    it('replaces MOD at the start of a formula', () => {
      renderUpcast({ '1': 'MOD+2d6', '2': 'MOD+3d6' }, { spellAbilities: { modifier: 5 } });

      expect(screen.getByText('5+2d6')).toBeInTheDocument();
      expect(screen.getByText('5+3d6')).toBeInTheDocument();
      expect(screen.queryByText(/MOD/)).not.toBeInTheDocument();
    });

    it('resolves MOD surrounded by spaces without collapsing the formula layout', () => {
      renderUpcast({ '1': '1d8 + MOD', '2': '2d8 + MOD' }, { spellAbilities: { modifier: 3 } });

      expect(screen.getByText('1d8 + 3')).toBeInTheDocument();
      expect(screen.getByText('2d8 + 3')).toBeInTheDocument();
      expect(screen.queryByText(/MOD/)).not.toBeInTheDocument();
    });

    it('leaves formulas without MOD untouched', () => {
      renderUpcast({ '1': '3d4+1', '2': '4d4+1' }, { spellAbilities: { modifier: 3 } });

      expect(screen.getByText('3d4+1')).toBeInTheDocument();
      expect(screen.getByText('4d4+1')).toBeInTheDocument();
    });

    it('defaults MOD to 0 when the character has no spellAbilities at all', () => {
      const stats = createPlayerStats();
      delete stats.spellAbilities;
      const spell = createSpell({ damage: { damage_at_slot_level: { '1': '1d8+MOD', '2': '2d8+MOD' } } });

      renderPopup(spell, stats, { upcastLevels: upcastLevelsFrom(spell) });

      expect(screen.getByText('1d8+0')).toBeInTheDocument();
      expect(screen.getByText('2d8+0')).toBeInTheDocument();
      expect(screen.queryByText(/MOD/)).not.toBeInTheDocument();
    });
  });
});
