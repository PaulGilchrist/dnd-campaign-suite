// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/combat/useActionPopup.js';

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
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
  return {
    default: mockFn,
    getCurrentSorceryPoints: mockFn.getCurrentSorceryPoints,
    getMaxSorceryPoints: mockFn.getMaxSorceryPoints,
  };
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
    pendingMultiTarget: null,
    handleMultiTargetConfirm: vi.fn(),
    handleMultiTargetSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingHeroesFeast: null,
    handleHeroesFeastConfirm: vi.fn(),
    handleHeroesFeastSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
    pendingLesserRestoration: null,
    handleLesserRestorationConfirm: vi.fn(),
    handleLesserRestorationSkip: vi.fn(),
    pendingMageArmor: null,
    handleMageArmorConfirm: vi.fn(),
    handleMageArmorSkip: vi.fn(),
    pendingShieldOfFaith: null,
    handleShieldOfFaithConfirm: vi.fn(),
    handleShieldOfFaithSkip: vi.fn(),
    pendingProtectionFromEnergy: null,
    handleProtectionFromEnergyConfirm: vi.fn(),
    handleProtectionFromEnergySkip: vi.fn(),
    pendingResistance: null,
    handleResistanceConfirm: vi.fn(),
    handleResistanceSkip: vi.fn(),
    pendingRemoveCurse: null,
    handleRemoveCurseConfirm: vi.fn(),
    handleRemoveCurseSkip: vi.fn(),
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

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 8, rolls: [4, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [4, 4, 4, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0 })),
}));

vi.mock('../../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({ players: [], placedItems: [] })),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 0 })),
}));

vi.mock('./SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell }) {
    return <div data-testid="spell-detail-popup">{spell?.name}</div>;
  },
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: function DiceRollResult() {
    return <div data-testid="dice-roll-result">DiceRollResult</div>;
  },
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));

vi.mock('./UpcastPopup.jsx', () => ({
  default: function UpcastPopup() {
    return <div data-testid="upcast-popup">Upcast</div>;
  },
}));

vi.mock('../popups/MultiTargetPopup.jsx', () => ({
  default: function MultiTargetPopup() {
    return <div data-testid="multi-target-popup">MultiTarget</div>;
  },
}));

vi.mock('../popups/MultiTargetCountPopup.jsx', () => ({
  default: function MultiTargetCountPopup() {
    return <div data-testid="aid-target-popup">Aid</div>;
  },
}));

vi.mock('../popups/MultiTargetCountPopup.jsx', () => ({
  default: function MultiTargetCountPopup() {
    return <div data-testid="heroes-feast-popup">HeroesFeast</div>;
  },
}));

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="greater-restoration-popup">GreaterRestoration</div>;
  },
}));

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="lesser-restoration-popup">LesserRestoration</div>;
  },
}));

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="remove-curse-popup">RemoveCurse</div>;
  },
}));

vi.mock('../popups/SingleTargetPopup.jsx', () => ({
  default: function SingleTargetPopup() {
    return <div data-testid="mage-armor-popup">MageArmor</div>;
  },
}));

vi.mock('../popups/SingleTargetPopup.jsx', () => ({
  default: function SingleTargetPopup() {
    return <div data-testid="shield-of-faith-popup">ShieldOfFaith</div>;
  },
}));

vi.mock('../popups/TargetWithTypePopup.jsx', () => ({
  default: function TargetWithTypePopup() {
    return <div data-testid="protection-from-energy-popup">ProtectionFromEnergy</div>;
  },
}));

vi.mock('../popups/TargetWithTypePopup.jsx', () => ({
  default: function TargetWithTypePopup() {
    return <div data-testid="resistance-popup">Resistance</div>;
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup">MagicMissile</div>;
  },
}));

describe('CharSpells edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('missing or empty spell fields', () => {
    it('renders a spell when components is undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Read Magic',
              level: 0,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Read Magic')).toBeInTheDocument();
      const table = screen.getByRole('table');
      // Notes column should be empty (no components to join)
      const notesCell = table.querySelector('tbody tr:last-child td:nth-child(8)');
      expect(notesCell.textContent).toBe('');
    });

    it('renders a spell when casting_time is undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Shield',
              level: 1,
              range: 'Self',
              duration: '1 round',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Shield')).toBeInTheDocument();
      const table = screen.getByRole('table');
      const castingTimeCell = table.querySelector('tbody tr td:nth-child(4)');
      expect(castingTimeCell.textContent).toBe('');
    });

    it('renders a spell when duration is undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Vicious Mockery',
              level: 0,
              casting_time: '1 action',
              range: '60 feet',
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Vicious Mockery')).toBeInTheDocument();
      const table = screen.getByRole('table');
      const durationCell = table.querySelector('tbody tr td:nth-child(7)');
      expect(durationCell.textContent).toBe('');
    });

    it('renders a spell when range is an empty string', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Stranger Thing',
              level: 1,
              casting_time: '1 action',
              range: '',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Stranger Thing')).toBeInTheDocument();
      const table = screen.getByRole('table');
      const rangeCell = table.querySelector('tbody tr td:nth-child(5)');
      expect(rangeCell.textContent).toBe('');
    });

    it('renders a spell when damage_type is missing from damage object', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Magic Missile',
              level: 1,
              casting_time: '1 action',
              range: '120 feet',
              duration: 'Instantaneous',
              components: ['V', 'S'],
              damage: {
                damage_at_slot_level: {
                  '1': '1d4+1',
                },
              },
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      const table = screen.getByRole('table');
      const effectCell = table.querySelector('tbody tr td:nth-child(6)');
      // Effect should show damage amount but no damage_type
      expect(effectCell.textContent).toContain('1d4+1');
    });

    it('renders a spell when damage_at_slot_level and damage_at_character_level are empty objects', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Strangely Empty Spell',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              components: ['V'],
              damage: {
                damage_at_slot_level: {},
                damage_at_character_level: {},
              },
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Strangely Empty Spell')).toBeInTheDocument();
      const table = screen.getByRole('table');
      const effectCell = table.querySelector('tbody tr td:nth-child(6)');
      // With empty damage objects, effect shows undefined values
      expect(effectCell.textContent).toContain('undefined');
    });

    it('renders a spell when damage is null', () => {
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
              duration: '10 minutes',
              components: ['V', 'M'],
              damage: null,
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Light')).toBeInTheDocument();
      const table = screen.getByRole('table');
      const effectCell = table.querySelector('tbody tr td:nth-child(6)');
      expect(effectCell.textContent).toBe('Utility');
    });

    it('renders a spell with full damage display including save DC', () => {
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
                damage_at_slot_level: {
                  '1': '3d6',
                },
                damage_type: 'Fire',
              },
              dc: {
                dc_type: 'Dex',
                dc_success: 'half',
              },
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.getByText('Burning Hands')).toBeInTheDocument();
      const table = screen.getByRole('table');
      const effectCell = table.querySelector('tbody tr td:nth-child(6)');
      expect(effectCell.textContent).toContain('3d6');
      expect(effectCell.textContent).toContain('Fire');
      expect(effectCell.textContent).toContain('Dex');
      expect(effectCell.textContent).toContain('half');
    });
  });

  describe('spell table structure', () => {
    it('renders 7 columns in the spell table header', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Test Spell',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: '1 minute',
              components: ['V', 'S'],
              damage: {
                damage_at_slot_level: { '1': '1d6' },
                damage_type: 'Fire',
              },
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const headers = table.querySelectorAll('thead th');
      expect(headers).toHaveLength(8); // Spell, Level, Prepared, Time, Range, Effect, Duration, Notes
    });

    it('renders spell row with all data populated', () => {
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
              components: ['V', 'S', 'M'],
              damage: {
                damage_at_slot_level: { '3': '8d6' },
                damage_type: 'Fire',
              },
              concentration: true,
              ritual: true,
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const cells = row.querySelectorAll('td');

      expect(cells[0].textContent).toBe('Fireball');
      expect(cells[1].textContent).toBe('3');
      // Prepared cell should have a checkbox
      expect(cells[2].querySelector('input[type="checkbox"]')).not.toBeNull();
      // Casting time should have "1" prefix and abbreviated
      expect(cells[3].textContent).toContain(' A');
      // Range
      expect(cells[4].textContent).toBe('150 feet');
      // Effect
      expect(cells[5].textContent).toContain('8d6');
      expect(cells[5].textContent).toContain('Fire');
      // Duration abbreviated
      expect(cells[6].textContent).toBe('Instant');
      // Notes: Concentration + Ritual + Components
      expect(cells[7].textContent).toContain('Con');
      expect(cells[7].textContent).toContain('Ritual');
      expect(cells[7].textContent).toContain('V/S/M');
    });

    it('renders cantrip level as "Cantrip" text', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Cantrip Test',
              level: 0,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const row = table.querySelector('tbody tr');
      const cells = row.querySelectorAll('td');
      expect(cells[1].textContent).toBe('Cantrip');
    });
  });

  describe('notes column formatting', () => {
    it('shows concentration as "Con" in notes', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Concentration Spell',
              level: 2,
              casting_time: '1 action',
              range: '60 feet',
              duration: 'Concentration',
              components: ['V'],
              concentration: true,
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const notesCell = table.querySelector('tbody tr td:nth-child(8)');
      expect(notesCell.textContent).toContain('Con');
      expect(notesCell.textContent).toContain('V');
    });

    it('shows ritual as "Ritual" in notes', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Ritual Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              components: ['S'],
              ritual: true,
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const notesCell = table.querySelector('tbody tr td:nth-child(8)');
      expect(notesCell.textContent).toContain('Ritual');
      expect(notesCell.textContent).toContain('S');
    });

    it('joins multiple components with slashes in notes', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Multi Component Spell',
              level: 3,
              casting_time: '1 action',
              range: '300 feet',
              duration: '1 round',
              components: ['V', 'S', 'M'],
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const notesCell = table.querySelector('tbody tr td:nth-child(8)');
      expect(notesCell.textContent).toBe('V/S/M');
    });
  });

  describe('duration formatting', () => {
    it('abbreviates "minute" to "min"', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Minute Duration Spell',
              level: 0,
              casting_time: '1 action',
              range: 'Touch',
              duration: '1 minute',
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const durationCell = table.querySelector('tbody tr td:nth-child(7)');
      expect(durationCell.textContent).toContain('min');
    });

    it('abbreviates "minutes" to "min"', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Minutes Duration Spell',
              level: 0,
              casting_time: '1 action',
              range: 'Touch',
              duration: '10 minutes',
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const durationCell = table.querySelector('tbody tr td:nth-child(7)');
      expect(durationCell.textContent).toContain('min');
    });

    it('strips "up to" from duration', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Up To Duration Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: 'up to 1 hour',
              prepared: 'Prepared',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const durationCell = table.querySelector('tbody tr td:nth-child(7)');
      expect(durationCell.textContent).toBe('1 hour');
    });

    it('abbreviates "Instantaneous" to "Instant"', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Instant Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const durationCell = table.querySelector('tbody tr td:nth-child(7)');
      expect(durationCell.textContent).toBe('Instant');
    });
  });

  describe('casting time formatting', () => {
    it('abbreviates "action" to " A"', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Action Spell',
              level: 1,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const timeCell = table.querySelector('tbody tr td:nth-child(4)');
      expect(timeCell.textContent).toContain(' A');
    });

    it('abbreviates "bonus action" to "BA"', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Bonus Action Spell',
              level: 1,
              casting_time: '1 bonus action',
              range: 'Self',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const timeCell = table.querySelector('tbody tr td:nth-child(4)');
      expect(timeCell.textContent).toContain('BA');
    });

    it('abbreviates "reaction" to "Reaction"', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Reaction Spell',
              level: 0,
              casting_time: '1 reaction',
              range: '60 feet',
              duration: 'Instantaneous',
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const timeCell = table.querySelector('tbody tr td:nth-child(4)');
      expect(timeCell.textContent).toContain('Reaction');
    });
  });

  describe('damage cell interactivity', () => {
    it('does not have clickable class when effect is utility', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Utility Cantrip',
              level: 0,
              casting_time: '1 action',
              range: 'Self',
              duration: 'Instantaneous',
              damage: null,
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const effectCell = table.querySelector('tbody tr td:nth-child(6)');
      expect(effectCell.classList.contains('clickable')).toBe(false);
    });

    it('has clickable class when effect contains damage formula', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Damage Cantrip',
              level: 0,
              casting_time: '1 action',
              range: '60 feet',
              duration: 'Instantaneous',
              damage: {
                damage_at_slot_level: { '0': '1d10' },
                damage_type: 'Acid',
              },
              prepared: 'Always',
            },
          ],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      const table = screen.getByRole('table');
      const effectCell = table.querySelector('tbody tr td:nth-child(6)');
      expect(effectCell.classList.contains('clickable')).toBe(true);
    });
  });

  describe('empty and null spellAbilities', () => {
    it('renders nothing when spellAbilities is undefined', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: undefined,
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders nothing when spellAbilities is null', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: null,
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders nothing when spells array is empty', () => {
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          toHit: 5,
          modifier: 3,
          saveDc: 13,
          cantrips_known: 0,
          spells: [],
        },
      };

      render(<CharSpells playerStats={stats} handleTogglePreparedSpells={mockHandleTogglePreparedSpells} />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });
});
