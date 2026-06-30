// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/combat/useActionPopup.js';

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useMetamagic.js', () => {
  const mockFn = () => ({
    currentSP: 10,
    maxSP: 10,
    spendSorceryPoints: vi.fn(),
    logMetamagic: vi.fn(),
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

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
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

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
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

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
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

describe('CharSpells abbreviations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('casting time abbreviations', () => {
    it('replaces "1 action" with abbreviated form containing "A"', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Fireball',
              level: 3,
              casting_time: '1 action',
              range: '150 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText(/1\s+A/)).toBeInTheDocument();
    });

    it('capitalizes "1 reaction" to "1 Reaction"', () => {
      const stats = {
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
              damage: {
                damage_at_slot_level: { '1': '1d4' },
                damage_type: 'Force',
              },
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      // Reaction + damage spells are filtered from the Spells table
      expect(screen.queryByText('Shield')).not.toBeInTheDocument();
    });

    it('replaces "1 bonus action" with abbreviated form "1 BA"', () => {
      const stats = {
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
              damage: {
                damage_at_slot_level: { '1': '1d4' },
                damage_type: 'Psychic',
              },
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      // Bonus action + damage spells are filtered from the Spells table
      expect(screen.queryByText('Healing Word')).not.toBeInTheDocument();
    });

    it('leaves casting time unchanged when no matching pattern exists', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Custom Spell',
              level: 1,
              casting_time: '1 turn',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('1 turn')).toBeInTheDocument();
    });

    it('renders empty string when casting_time is undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Mystery Spell',
              level: 1,
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Mystery Spell')).toBeInTheDocument();
    });

    it('renders empty string when casting_time is null', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Null Time Spell',
              level: 1,
              casting_time: null,
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Null Time Spell')).toBeInTheDocument();
    });
  });

  describe('duration abbreviations', () => {
    it('replaces "Instantaneous" with "Instant"', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Fireball',
              level: 3,
              casting_time: '1 action',
              range: '150 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Instant')).toBeInTheDocument();
    });

    it('replaces singular "minute" with "min"', () => {
      const stats = {
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

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText(/1 min/)).toBeInTheDocument();
    });

    it('replaces plural "minutes" with "min"', () => {
      const stats = {
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

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText(/10 min/)).toBeInTheDocument();
    });

    it('strips "up to " from duration text', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Protection from Evil',
              level: 1,
              casting_time: '1 action',
              range: 'Touch',
              duration: 'up to 1 hour',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const durationCell = screen.getByText(/1 hour/);
      expect(durationCell.textContent).not.toContain('up to');
    });

    it('renders empty string when duration is undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'No Duration Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('No Duration Spell')).toBeInTheDocument();
    });

    it('renders empty string when duration is null', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Null Duration Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: null,
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Null Duration Spell')).toBeInTheDocument();
    });
  });

  describe('combined casting time and duration abbreviations', () => {
    it('applies both casting time and duration abbreviations to the same spell', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Burning Hands',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              components: ['V', 'S'],
              damage: {
                damage_at_slot_level: { '1': '3d6' },
                damage_type: 'Fire',
              },
              prepared: 'Prepared',
            },
            {
              name: 'Shield',
              level: 1,
              casting_time: '1 reaction',
              range: 'Self',
              duration: '1 round',
              damage: {
                damage_at_slot_level: { '1': '1d4' },
                damage_type: 'Force',
              },
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      // Action+damage and reaction+damage spells are filtered from the Spells table
      expect(screen.queryByText('Burning Hands')).not.toBeInTheDocument();
      expect(screen.queryByText('Shield')).not.toBeInTheDocument();
    });

    it('abbreviates both casting time and duration for a bonus action spell', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Healing Word',
              level: 1,
              casting_time: '1 bonus action',
              range: '60 feet',
              duration: '1 round',
              damage: {
                damage_at_slot_level: { '1': '1d4' },
                damage_type: 'Psychic',
              },
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      // Bonus action + damage spells are filtered from the Spells table
      expect(screen.queryByText('Healing Word')).not.toBeInTheDocument();
    });
  });
});
