import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/useActionPopup.js';

vi.mock('../../../hooks/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

vi.mock('../../../hooks/useMetamagic.js', () => {
  const mockFn = () => ({
    currentSP: 10,
    maxSP: 10,
    spendSorceryPoints: vi.fn(),
    logMetamagic: vi.fn(),
    saveLastDamageEvent: vi.fn(),
    getLastDamageEvent: vi.fn(() => null),
    clearLastDamageEvent: vi.fn(),
  });
  mockFn.getCurrentSorceryPoints = vi.fn(() => 10);
  mockFn.getMaxSorceryPoints = vi.fn(() => 10);
  return { default: mockFn, getCurrentSorceryPoints: mockFn.getCurrentSorceryPoints, getMaxSorceryPoints: mockFn.getMaxSorceryPoints };
});

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MockMetamagicPopup({ onConfirm, onSkip }) {
    return (
      <div data-testid="metamagic-popup">
        <button data-testid="mock-confirm" onClick={() => onConfirm({ options: [], totalCost: 0, twinTarget: null })}>
          Mock Confirm
        </button>
        <button data-testid="mock-skip" onClick={onSkip}>
          Mock Skip
        </button>
      </div>
    );
  },
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function MockCharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
    },
}));

vi.mock('lodash', () => ({
  cloneDeep: vi.fn(obj => JSON.parse(JSON.stringify(obj))),
}));

vi.mock('../../../hooks/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    pendingGreaterRestoration: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
  })),
}));

vi.mock('../../../hooks/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    gateUpcast: vi.fn(() => false),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
    getCantripAutoLevel: vi.fn(() => null),
  })),
}));

vi.mock('../../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

describe('CharSpells', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('Spell effects and notes', () => {
    it('should display damage effect for spells with damage', () => {
      render(
          <CharSpells
            playerStats={mockPlayerStats}
            handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
             />
            );

       // Fireball has damage
       expect(screen.getByText('8d6 Fire')).toBeInTheDocument();
       });

    it('should display Utility for spells without damage', () => {
      render(
          <CharSpells
            playerStats={mockPlayerStats}
            handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
             />
            );

       // Light has no damage, should show Utility
       expect(screen.getByText('Utility')).toBeInTheDocument();
       });

    it('should display concentration note when spell has concentration', () => {
      const statsWithConcentration = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Calm Emotions',
              level: 1,
              casting_time: '1 action',
              range: '60 feet',
              duration: 'Concentration, up to 1 minute',
              components: ['V', 'S'],
              concentration: true,
              prepared: 'Prepared',
                },
               ],
              },
            };

      render(
          <CharSpells
            playerStats={statsWithConcentration}
            handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
             />
            );

          // Notes show "Con, V/S" - check for Con in the notes
      expect(screen.getByText(/Con,/)).toBeInTheDocument();
         });

    it('should display ritual note when spell has ritual', () => {
      const statsWithRitual = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Detect Magic',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Concentration, up to 10 minutes',
              components: ['V', 'S'],
              ritual: true,
              prepared: 'Prepared',
                },
               ],
              },
            };

      render(
          <CharSpells
            playerStats={statsWithRitual}
            handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
             />
            );

          // Notes show "Ritual, V/S" - check for Ritual in the notes
      expect(screen.getByText(/Ritual,/)).toBeInTheDocument();
         });

    it('should display components note', () => {
      render(
          <CharSpells
            playerStats={mockPlayerStats}
            handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
             />
            );

        // Fireball has components ['V', 'S', 'M'] which should be joined as 'V/S/M'
      expect(screen.getByText('V/S/M')).toBeInTheDocument();
      });

    it('should render damage_at_character_level effect', () => {
      const statsWithCharLevelDamage = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            ...mockPlayerStats.spellAbilities.spells,
            {
              name: 'Fire Bolt',
              level: 0,
              casting_time: '1 action',
              range: '120 feet',
              duration: 'Instantaneous',
              components: ['V', 'S'],
              damage: {
                damage_at_character_level: {
                  '1': '1d10',
                },
                damage_type: 'Fire',
              },
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithCharLevelDamage}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // Spell with damage_at_character_level should show that damage
      expect(screen.getByText('1d10 Fire')).toBeInTheDocument();
    });

    it('should display both Concentration and Ritual notes', () => {
      const statsWithBoth = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Wandermage',
              level: 3,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Concentration, up to 6 minutes',
              components: ['V', 'S', 'M'],
              concentration: true,
              ritual: true,
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithBoth}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      // Notes should show "Con, Ritual, V/S/M" with minute abbreviation
      expect(screen.getByText(/Con, Ritual, V\/S\/M/)).toBeInTheDocument();
    });

    it('should abbreviate duration with concentration and minutes', () => {
      const statsWithConcentrationDuration = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Haste',
              level: 3,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Concentration, up to 1 minute',
              components: ['V', 'S', 'M'],
              concentration: true,
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithConcentrationDuration}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/Concentration, up to 1 min/)).toBeInTheDocument();
    });

    it('should render spell with only damage_at_character_level', () => {
      const statsWithCharLevelOnly = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Eldritch Blast',
              level: 0,
              casting_time: '1 action',
              range: '120 feet',
              duration: 'Instantaneous',
              components: ['V'],
              damage: {
                damage_at_character_level: {
                  '1': '1d10',
                  '5': '2d10',
                },
                damage_type: 'Force',
              },
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithCharLevelOnly}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Eldritch Blast')).toBeInTheDocument();
    });

    it('should show Utility for spell with no damage field', () => {
      const statsWithUtilitySpell = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Shield',
              level: 1,
              casting_time: '1 reaction',
              range: 'Self',
              duration: '1 round',
              components: ['V'],
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithUtilitySpell}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Utility')).toBeInTheDocument();
    });
  });
});
