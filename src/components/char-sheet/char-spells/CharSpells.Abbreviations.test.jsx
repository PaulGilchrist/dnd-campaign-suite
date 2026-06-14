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

vi.mock('../MetamagicPopup.jsx', () => ({
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

vi.mock('../../../services/rules/spellCastService.js', () => ({
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

  describe('Casting time and duration abbreviations', () => {
    it('should display casting time with abbreviations', () => {
      render(
          <CharSpells
            playerStats={mockPlayerStats}
            handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
             />
              );

          // '1 action' should be replaced with ' A' - check the table cell content
       const tableCells = screen.getAllByText(/A$/);
       expect(tableCells.length).toBeGreaterThan(0);
          });

    it('should display duration with abbreviations', () => {
      render(
          <CharSpells
            playerStats={mockPlayerStats}
            handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
             />
            );

          // 'Instantaneous' should be replaced with 'Instant'
       const instantElements = screen.getAllByText('Instant');
       expect(instantElements.length).toBeGreaterThan(0);
          });

    it('should abbreviate "1 reaction" to "R"', () => {
      const statsWithReaction = {
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
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithReaction}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/1 R/)).toBeInTheDocument();
    });

    it('should abbreviate "1 bonus action" to "BA"', () => {
      const statsWithBonusAction = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Healing Word',
              level: 1,
              casting_time: '1 bonus action',
              range: '60 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithBonusAction}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/1 BA/)).toBeInTheDocument();
    });

    it('should abbreviate "1 minute" to "1 min" in duration', () => {
      const statsWithMinuteDuration = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Bless',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Concentration, up to 1 minute',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithMinuteDuration}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/1 min/)).toBeInTheDocument();
    });

    it('should abbreviate "10 minutes" to "10 min" in duration', () => {
      const statsWithMinutesDuration = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Light',
              level: 0,
              casting_time: '1 action',
              range: 'Touch',
              duration: 'Concentration, up to 10 minutes',
              prepared: 'Always',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithMinutesDuration}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText(/10 min/)).toBeInTheDocument();
    });

    it('should handle spell with "1 reaction" casting time', () => {
      const statsWithReaction = {
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
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithReaction}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Shield')).toBeInTheDocument();
    });

    it('should handle spell with "1 bonus action" casting time', () => {
      const statsWithBonusAction = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Healing Word',
              level: 1,
              casting_time: '1 bonus action',
              range: '60 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(
        <CharSpells
          playerStats={statsWithBonusAction}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />
      );

      expect(screen.getByText('Healing Word')).toBeInTheDocument();
    });
  });
});
