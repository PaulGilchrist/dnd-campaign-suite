// @improved-by-ai
import { render } from '@testing-library/react';
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
    saveLastDamageEvent: vi.fn(),
    getLastDamageEvent: vi.fn(() => null),
    clearLastDamageEvent: vi.fn(),
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

vi.mock('lodash', () => ({
  cloneDeep: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
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

const renderSpellsTable = (playerStats) => {
  const { container } = render(
    <CharSpells
      playerStats={playerStats}
      handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
    />
  );
  const table = container.querySelector('.table-spells');
  return { container, table };
};

const getRowTexts = (table) => {
  if (!table) return [];
  const rows = table.querySelectorAll('tbody tr');
  return Array.from(rows).map((row) =>
    Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent)
  );
};

const getSpellRow = (table, spellName) => {
  const rows = getRowTexts(table);
  return rows.find((row) => row[0] === spellName);
};

const createSpell = (overrides) => ({
  name: 'Test Spell',
  level: 1,
  casting_time: '1 action',
  range: 'Self',
  duration: 'Instantaneous',
  components: ['V', 'S'],
  prepared: 'Prepared',
  ...overrides,
});

describe('CharSpells', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('Spell effect display', () => {
    it('should display damage value and type from damage_at_slot_level', () => {
      const spell = createSpell({
        name: 'Fireball',
        level: 3,
        damage: {
          damage_at_slot_level: { '3': '8d6' },
          damage_type: 'Fire',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Fireball');
      expect(row).toBeDefined();
      expect(row[5]).toBe('8d6 Fire');
    });

    it('should display damage value and type from damage_at_character_level for cantrips', () => {
      const spell = createSpell({
        name: 'Fire Bolt',
        level: 0,
        damage: {
          damage_at_character_level: { '1': '1d10' },
          damage_type: 'Fire',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Fire Bolt');
      expect(row).toBeDefined();
      expect(row[5]).toBe('1d10 Fire');
    });

    it('should display Utility for spells without a damage field', () => {
      const spell = createSpell({
        name: 'Light',
        level: 0,
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Light');
      expect(row).toBeDefined();
      expect(row[5]).toBe('Utility');
    });

    it('should display Utility for spells with a damage field that has no slot/character level data', () => {
      const spell = createSpell({
        name: 'Shield',
        level: 1,
        damage: {
          damage_type: 'Force',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Shield');
      expect(row).toBeDefined();
      expect(row[5]).toBe('Utility');
    });

    it('should display save DC info in effect text when spell has a DC', () => {
      const spell = createSpell({
        name: 'Burning Hands',
        level: 1,
        damage: {
          damage_at_slot_level: { '1': '3d6' },
          damage_type: 'Fire',
        },
        dc: {
          dc_type: 'Constitution',
          dc_success: 'half',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Burning Hands');
      expect(row).toBeDefined();
      expect(row[5]).toBe('3d6 Fire (Constitution half)');
    });

    it('should display "negates" when dc_success is not half', () => {
      const spell = createSpell({
        name: 'Sleep',
        level: 1,
        damage: {
          damage_at_slot_level: { '1': '3d8' },
          damage_type: 'Psychic',
        },
        dc: {
          dc_type: 'Wisdom',
          dc_success: 'none',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Sleep');
      expect(row).toBeDefined();
      expect(row[5]).toBe('3d8 Psychic (Wisdom negates)');
    });

    it('should prioritize damage_at_slot_level over damage_at_character_level', () => {
      const spell = createSpell({
        name: 'Chain Lightning',
        level: 6,
        damage: {
          damage_at_slot_level: { '6': '10d6' },
          damage_at_character_level: { '1': '2d6' },
          damage_type: 'Lightning',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Chain Lightning');
      expect(row).toBeDefined();
      expect(row[5]).toBe('10d6 Lightning');
    });

    it('should select the highest character level within player level for damage_at_character_level', () => {
      const spell = createSpell({
        name: 'Eldritch Blast',
        level: 0,
        damage: {
          damage_at_character_level: {
            '1': '1d10',
            '5': '2d10',
            '11': '3d10',
            '17': '4d10',
          },
          damage_type: 'Force',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Eldritch Blast');
      expect(row).toBeDefined();
      expect(row[5]).toBe('1d10 Force');
    });
  });

  describe('Notes column', () => {
    it('should display "Con" abbreviation for concentration spells', () => {
      const spell = createSpell({
        name: 'Hold Person',
        concentration: true,
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Hold Person');
      expect(row).toBeDefined();
      expect(row[7]).toContain('Con');
      expect(row[7]).not.toContain('Concentration');
    });

    it('should display "Ritual" for ritual spells', () => {
      const spell = createSpell({
        name: 'Detect Magic',
        ritual: true,
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Detect Magic');
      expect(row).toBeDefined();
      expect(row[7]).toContain('Ritual');
    });

    it('should display both concentration and ritual when both are true', () => {
      const spell = createSpell({
        name: 'Wand of Magic Awareness',
        concentration: true,
        ritual: true,
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Wand of Magic Awareness');
      expect(row).toBeDefined();
      expect(row[7]).toMatch(/Con, Ritual/);
    });

    it('should display components joined with slashes', () => {
      const spell = createSpell({
        name: 'Fireball',
        components: ['V', 'S', 'M'],
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Fireball');
      expect(row).toBeDefined();
      expect(row[7]).toContain('V/S/M');
    });

    it('should display components joined with slashes for two components', () => {
      const spell = createSpell({
        name: 'Light',
        components: ['V', 'M'],
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Light');
      expect(row).toBeDefined();
      expect(row[7]).toContain('V/M');
    });

    it('should display empty notes for spell with no flags or components', () => {
      const spell = createSpell({
        name: 'Magic Missile',
        components: [],
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Magic Missile');
      expect(row).toBeDefined();
      expect(row[7]).toBe('');
    });

    it('should display all note types together in correct order', () => {
      const spell = createSpell({
        name: 'Concentration Ritual Spell',
        concentration: true,
        ritual: true,
        components: ['V', 'S', 'M'],
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Concentration Ritual Spell');
      expect(row).toBeDefined();
      expect(row[7]).toBe('Con, Ritual, V/S/M');
    });
  });

  describe('Duration display', () => {
    it('should abbreviate "Concentration, up to 1 minute" to "Concentration, 1 min"', () => {
      const spell = createSpell({
        name: 'Haste',
        duration: 'Concentration, up to 1 minute',
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Haste');
      expect(row).toBeDefined();
      expect(row[6]).toBe('Concentration, 1 min');
    });

    it('should abbreviate "Concentration, up to 10 minutes" to "Concentration, 10 mins"', () => {
      const spell = createSpell({
        name: 'Darkness',
        duration: 'Concentration, up to 10 minutes',
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Darkness');
      expect(row).toBeDefined();
      expect(row[6]).toBe('Concentration, 10 mins');
    });

    it('should abbreviate "Instantaneous" to "Instant"', () => {
      const spell = createSpell({
        name: 'Fireball',
        duration: 'Instantaneous',
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Fireball');
      expect(row).toBeDefined();
      expect(row[6]).toBe('Instant');
    });

    it('should abbreviate "10 minutes" to "10 mins"', () => {
      const spell = createSpell({
        name: 'Light',
        duration: '10 minutes',
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Light');
      expect(row).toBeDefined();
      expect(row[6]).toBe('10 mins');
    });

    it('should remove "up to " prefix from duration', () => {
      const spell = createSpell({
        name: 'Bless',
        duration: 'Concentration, up to 1 minute',
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Bless');
      expect(row).toBeDefined();
      expect(row[6]).toBe('Concentration, 1 min');
    });

    it('should leave duration unchanged when no abbreviation applies', () => {
      const spell = createSpell({
        name: 'Armor of Agathys',
        duration: '1 hour',
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Armor of Agathys');
      expect(row).toBeDefined();
      expect(row[6]).toBe('1 hour');
    });

    it('should render empty string for missing duration', () => {
      const spell = createSpell({
        name: 'Test Spell',
        duration: undefined,
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Test Spell');
      expect(row).toBeDefined();
      expect(row[6]).toBe('');
    });
  });

  describe('Casting time display', () => {
    it('should abbreviate "action" to " A"', () => {
      const spell = createSpell({
        name: 'Fireball',
        casting_time: '1 action',
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Fireball');
      expect(row).toBeDefined();
      expect(row[3]).toBe('1  A');
    });

    it('should abbreviate "bonus action" to "BA"', () => {
      const spell = createSpell({
        name: 'Cunning Action',
        casting_time: '1 bonus action',
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Cunning Action');
      expect(row).toBeDefined();
      expect(row[3]).toBe('1 BA');
    });

    it('should abbreviate "reaction" to "Reaction"', () => {
      const spell = createSpell({
        name: 'Shield',
        casting_time: '1 reaction',
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Shield');
      expect(row).toBeDefined();
      expect(row[3]).toBe('1 Reaction');
    });

    it('should leave casting_time unchanged when no match', () => {
      const spell = createSpell({
        name: 'Time Stop',
        casting_time: '1 turn',
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Time Stop');
      expect(row).toBeDefined();
      expect(row[3]).toBe('1 turn');
    });

    it('should render empty string for missing casting_time', () => {
      const spell = createSpell({
        name: 'Test Spell',
        casting_time: undefined,
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Test Spell');
      expect(row).toBeDefined();
      expect(row[3]).toBe('');
    });
  });

  describe('Damage display edge cases', () => {
    it('should display damage_at_character_level with multiple levels for a cantrip', () => {
      const spell = createSpell({
        name: 'Eldritch Blast',
        level: 0,
        damage: {
          damage_at_character_level: {
            '1': '1d10',
            '5': '2d10',
          },
          damage_type: 'Force',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Eldritch Blast');
      expect(row).toBeDefined();
      expect(row[5]).toBe('1d10 Force');
    });

    it('should display damage value when only damage_at_character_level has data', () => {
      const spell = createSpell({
        name: 'Scorching Ray',
        level: 2,
        damage: {
          damage_at_character_level: { '3': '4d6' },
          damage_type: 'Fire',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Scorching Ray');
      expect(row).toBeDefined();
      expect(row[5]).toBe('4d6 Fire');
    });

    it('should display damage with formula containing addition', () => {
      const spell = createSpell({
        name: 'Magic Missile',
        level: 1,
        damage: {
          damage_at_slot_level: { '1': '1d4+1' },
          damage_type: 'Force',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Magic Missile');
      expect(row).toBeDefined();
      expect(row[5]).toBe('1d4+1 Force');
    });
  });

  describe('Table structure', () => {
    it('should render all expected columns in each row', () => {
      const spell = createSpell({
        name: 'Complete Spell',
        level: 2,
        casting_time: '1 action',
        range: '60 feet',
        duration: 'Concentration, up to 1 minute',
        components: ['V', 'S', 'M'],
        concentration: true,
        ritual: true,
        damage: {
          damage_at_slot_level: { '2': '2d6' },
          damage_type: 'Acid',
        },
        dc: {
          dc_type: 'Dexterity',
          dc_success: 'half',
        },
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Complete Spell');
      expect(row).toBeDefined();
      // Columns: Spell, Level, Prepared(checkbox), Time, Range, Effect, Duration, Notes
      expect(row).toHaveLength(8);
      expect(row[0]).toBe('Complete Spell');
      expect(row[1]).toBe('2');
      // Prepared column renders a checkbox input, so textContent is empty
      expect(row[2]).toBe('');
      expect(row[3]).toBe('1  A');
      expect(row[4]).toBe('60 feet');
      expect(row[5]).toBe('2d6 Acid (Dexterity half)');
      expect(row[6]).toBe('Concentration, 1 min');
      expect(row[7]).toBe('Con, Ritual, V/S/M');
    });

    it('should render cantrip level as "Cantrip" text', () => {
      const spell = createSpell({
        name: 'Cantrip Test',
        level: 0,
      });
      const { table } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const row = getSpellRow(table, 'Cantrip Test');
      expect(row).toBeDefined();
      expect(row[1]).toBe('Cantrip');
    });

    it('should render checkbox cell for prepared spells', () => {
      const spell = createSpell({
        name: 'Prepared Test',
        prepared: 'Prepared',
      });
      const { container } = renderSpellsTable({
        ...mockPlayerStats,
        spellAbilities: { ...mockPlayerStats.spellAbilities, spells: [spell] },
      });

      const checkbox = container.querySelector('tbody tr input[type="checkbox"]');
      expect(checkbox).toBeTruthy();
      expect(checkbox.checked).toBe(true);
    });
  });
});
