import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
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
  },
  automation: { passives: [], actions: [] },
};

const mockCampaignName = 'test-campaign';

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

const renderPopup = (
  spell = baseMockSpell,
  playerStats = baseMockPlayerStats,
  campaignName = mockCampaignName,
  extraProps = {}
) =>
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={campaignName}
      onClose={vi.fn()}
      {...extraProps}
    />
  );

const freeCastText = 'Free Cast — no spell slot consumed';

describe('SpellDetailPopup - Free Cast Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
  });

  describe('Natural Recovery', () => {
    it('authorizes when spell name is in the free cast array', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Healing Word'];
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Healing Word',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d4+1' } },
      };
      renderPopup(spell);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

    it('does not authorize when spell name is not in the free cast array or array is empty', () => {
      // Spell not in array
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Healing Word'];
        return null;
      });
      const spell = {
        ...baseMockSpell,
        name: 'Fire Bolt',
        level: 0,
        damage: { damage_at_slot_level: { '0': '1d10' } },
      };
      renderPopup(spell);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();

      // Reset mock to default before next render
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return [];
        return null;
      });
      const spell2 = {
        ...baseMockSpell,
        name: 'Healing Word',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d4+1' } },
      };
      renderPopup(spell2);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    });
  });

  describe('Bewitching Magic', () => {
    it('authorizes Misty Step when the free cast flag is true', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Bewitching_Magic_freeCast') return true;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Misty Step',
        level: 2,
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };
      renderPopup(spell);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

    it('does not authorize non-Misty Step spells even when the flag is true', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Bewitching_Magic_freeCast') return true;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      renderPopup(spell);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    });
  });

  describe('Spell Mastery', () => {
    it('authorizes when spell name and level match', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SpellMastery_level1') return 'Shield';
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Shield',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d5+1' } },
      };
      renderPopup(spell);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

    it('does not authorize when spell name matches but level does not, or name does not match', () => {
      // Name matches but level mismatch
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SpellMastery_level1') return 'Shield';
        return null;
      });
      const spell = {
        ...baseMockSpell,
        name: 'Shield',
        level: 2,
        damage: { damage_at_slot_level: { '2': '1d5+1' } },
      };
      renderPopup(spell);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();

      // Name mismatch (same mock setup)
      const spell2 = {
        ...baseMockSpell,
        name: 'Magic Missile',
        level: 1,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(spell2);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    });
  });

  describe('Signature Spells', () => {
    it('authorizes when spell is selected, level 3, and not yet used', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SignatureSpells_selection') return ['Fireball'];
        if (key === 'SignatureSpells_Fireball_used') return false;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      renderPopup(spell);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

    it('does not authorize when spell has already been used or is not in the selection', () => {
      // Already used
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SignatureSpells_selection') return ['Fireball'];
        if (key === 'SignatureSpells_Fireball_used') return true;
        return null;
      });
      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      renderPopup(spell);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();

      // Not in selection (different spell name, same selection/mock)
      const spell2 = {
        ...baseMockSpell,
        name: 'Magic Missile',
        level: 1,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(spell2);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    });
  });

  describe('Divination Savant', () => {
    it('authorizes when spell is selected and not yet used', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Divination_Savant_selection') return ['Warding Bond'];
        if (key === '_Divination_Savant_Warding_Bond_used') return false;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Warding Bond',
        level: 2,
        damage: { damage_at_slot_level: { '2': '2d6' } },
      };
      renderPopup(spell);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

    it('does not authorize when spell has already been used or is not in the selection', () => {
      // Already used
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Divination_Savant_selection') return ['Warding Bond'];
        if (key === '_Divination_Savant_Warding_Bond_used') return true;
        return null;
      });
      const spell = {
        ...baseMockSpell,
        name: 'Warding Bond',
        level: 2,
        damage: { damage_at_slot_level: { '2': '2d6' } },
      };
      renderPopup(spell);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();

      // Not in selection (different spell name, same selection/mock)
      const spell2 = {
        ...baseMockSpell,
        name: 'Magic Missile',
        level: 1,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(spell2);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    });
  });

  describe('Counter-based free_spell actions', () => {
    it('authorizes when count > 0 and spell matches', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === "_Paladin's_Smite_freeCastCount") return 1;
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: "Paladin's Smite",
              type: 'free_spell',
              spell: 'Divine Smite',
              uses_expression: '1/rest',
              usesMax: 1,
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: 'Divine Smite',
        level: 1,
        damage: { damage_at_slot_level: { '1': '2d8' } },
      };
      renderPopup(spell, stats);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

    it('does not authorize when count is 0 or spell name does not match', () => {
      // count = 0
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === "_Paladin's_Smite_freeCastCount") return 0;
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: "Paladin's Smite",
              type: 'free_spell',
              spell: 'Divine Smite',
              uses_expression: '1/rest',
              usesMax: 1,
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: 'Divine Smite',
        level: 1,
        damage: { damage_at_slot_level: { '1': '2d8' } },
      };
      renderPopup(spell, stats);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();

      // spell mismatch (count = 1)
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === "_Paladin's_Smite_freeCastCount") return 1;
        return null;
      });
      const spell2 = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      renderPopup(spell2, stats);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    });

    it('falls back to uses value when count is not in runtime state', () => {
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: "Paladin's Smite",
              type: 'free_spell',
              spell: 'Divine Smite',
              uses: 1,
              recharge: 'long_rest',
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: 'Divine Smite',
        level: 1,
        damage: { damage_at_slot_level: { '1': '2d8' } },
      };
      renderPopup(spell, stats);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

    it('does not authorize when uses is 0 and count is not in runtime state, or spell does not match', () => {
      // uses = 0, no count → fallback to uses = 0
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: "Paladin's Smite",
              type: 'free_spell',
              spell: 'Divine Smite',
              uses: 0,
              recharge: 'long_rest',
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: 'Divine Smite',
        level: 1,
        damage: { damage_at_slot_level: { '1': '2d8' } },
      };
      renderPopup(spell, stats);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();

      // spell mismatch with same fallback stats
      const spell2 = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      renderPopup(spell2, stats);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    });

    it('authorizes Mystic Arcanum when count > 0 and level matches', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Mystic_Arcanum_freeCastCount') return 1;
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: 'Mystic Arcanum',
              type: 'free_spell',
              spell: 'level 8 spell',
              uses_expression: '1/long rest',
              usesMax: 1,
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: 'Incendiary Cloud',
        level: 8,
        damage: { damage_at_slot_level: { '8': '8d8' } },
      };
      renderPopup(spell, stats);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });
  });

  describe('Fey Reinforcements / Dragon Companion', () => {
    it('authorizes via Fey Reinforcements when spell name matches', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Fey_Reinforcements_freeCast') return ["Hunter's Mark"];
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: 'Fey Reinforcements',
              type: 'fey_reinforcements',
              spell: "Hunter's Mark",
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: "Hunter's Mark",
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      renderPopup(spell, stats);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

    it('authorizes via Dragon Companion when spell name matches', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Dragon_Companion_freeCast') return ['Dragon Breath'];
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: 'Dragon Companion',
              type: 'dragon_companion',
              spell: 'Dragon Breath',
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: 'Dragon Breath',
        level: 1,
        damage: { damage_at_slot_level: { '1': '2d6' } },
      };
      renderPopup(spell, stats);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });
  });

  describe('Mantle of Majesty bonusActions', () => {
    it('authorizes when spell name is in the free cast array', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Mantle_of_Majesty_freeCast') return ['Command'];
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [],
          bonusActions: [
            {
              name: 'Mantle of Majesty',
              type: 'free_spell',
              spell: 'Command',
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: 'Command',
        level: 1,
        damage: null,
        dc: { dc_type: 'WIS', dc_success: 'none' },
      };
      renderPopup(spell, stats);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

  describe('Mantle of Majesty bonusActions uses_expression fallback', () => {
    it('authorizes via bonusActions with uses + recharge when count > 0', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Test_Feature_freeCastCount') return 2;
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [],
          bonusActions: [
            {
              name: 'Test Feature',
              type: 'free_spell',
              spell: 'Test Spell',
              uses: 2,
              recharge: 'long_rest',
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: 'Test Spell',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      renderPopup(spell, stats);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

    it('does not authorize when bonusActions count is 0', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Test_Feature_freeCastCount') return 0;
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [],
          bonusActions: [
            {
              name: 'Test Feature',
              type: 'free_spell',
              spell: 'Test Spell',
              uses: 2,
              recharge: 'long_rest',
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: 'Test Spell',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      renderPopup(spell, stats);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    });

    it('does not authorize when bonusActions spell does not match', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Test_Feature_freeCastCount') return 2;
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [],
          bonusActions: [
            {
              name: 'Test Feature',
              type: 'free_spell',
              spell: 'Test Spell',
              uses: 2,
              recharge: 'long_rest',
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      renderPopup(spell, stats);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    });
  });
  });

  describe('Mantle of Majesty active buff', () => {
    it('authorizes Command when Mantle of Majesty is in activeBuffs', () => {
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [],
          bonusActions: [],
        },
      };
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Mantle of Majesty' }];
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Command',
        level: 1,
        damage: null,
        dc: { dc_type: 'WIS', dc_success: 'none' },
      };
      renderPopup(spell, stats);
      expect(screen.getByText(freeCastText)).toBeInTheDocument();
    });

    it('does not authorize Command when Mantle of Majesty is not active or a different spell is shown', () => {
      // No activeBuffs
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [],
          bonusActions: [],
        },
      };

      const spell = {
        ...baseMockSpell,
        name: 'Command',
        level: 1,
        damage: null,
        dc: { dc_type: 'WIS', dc_success: 'none' },
      };
      renderPopup(spell, stats);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();

      // Mantle active but wrong spell
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Mantle of Majesty' }];
        return null;
      });
      const spell2 = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      renderPopup(spell2, stats);
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    });
  });
});
