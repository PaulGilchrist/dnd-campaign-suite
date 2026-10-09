// @improved-by-ai
// @cleaned-by-ai
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

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/class-wizard/overchannelHandler.js', () => ({
  getOverchannelNecroticDamage: vi.fn(() => null),
}));

vi.mock('../../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
}));

const baseMockPlayerStats = {
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
    modifier: 3,
  },
  automation: { passives: [], actions: [] },
};

const baseMockSpell = {
  name: 'Magic Missile',
  level: 1,
  description: 'Three darts of force strike a creature.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  damage: {
    damage_at_slot_level: {
      '1': '3d4+1',
      '2': '4d4+1',
      '3': '5d4+1',
    },
  },
  school: 'Evocation',
};

const mockCampaignName = 'test-campaign';

const renderPopup = (spell = baseMockSpell, playerStats = baseMockPlayerStats, extraProps = {}) =>
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={mockCampaignName}
      onClose={vi.fn()}
      {...extraProps}
    />,
  );

describe('SpellDetailPopup - rendering', () => {
  describe('upcast selector visibility', () => {
    it('shows the upcast selector when the spell is upcastable and multiple levels are available', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
        { level: 2, formula: '4d4+1', availableSlots: 3 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, { upcastLevels });
      expect(screen.getByText(/Cast at Level:/)).toBeInTheDocument();
    });

    it('hides the upcast selector when only one upcast level exists', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, { upcastLevels });
      expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
    });

    it('hides the upcast selector when the spell has only a single damage value (not upcastable)', () => {
      const nonUpcastableSpell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(nonUpcastableSpell, baseMockPlayerStats, {
        upcastLevels: [
          { level: 1, formula: '3d4+1', availableSlots: 4 },
          { level: 2, formula: '4d4+1', availableSlots: 3 },
        ],
      });
      expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
    });
  });
});
