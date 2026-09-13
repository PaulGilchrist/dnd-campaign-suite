// @improved-by-ai
// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';

// ── Mocks ──────────────────────────────────────────────────────────────────
//
// This file only covers rendering behavior that is NOT already tested in the
// other MonsterCardModal test files (MonsterCardModal.test.jsx,
// MonsterCardModal.senses-and-fallback.test.jsx, etc.). Interaction, dice-roll,
// and overlay/close behavior all live in those files.
//
// Cleanup applied (redundant test removal):
//   - Removed "prefers creatureName when monster.name is empty" — fully covered
//     by MonsterCardModal.test.jsx:146-152 which tests the same creatureName ||
//     monster.name || 'Monster' fallback chain (default + override cases).

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => String(html || '')),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({})),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(() => ({ name: 'Goblin', conditions: [] })),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 30),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStore('Goblin').clear();
  });

  // ════════════════════════════════════════════
  // Monster name resolution
  // ════════════════════════════════════════════

  describe('monster name resolution', () => {
    it('falls back to "Monster" when neither creatureName nor monster.name is present', () => {
      render(<MonsterCardModal {...makeProps(makeMonster({ name: undefined }), { creatureName: '' })} />);
      expect(screen.getByText('Monster')).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Speed line
  // ════════════════════════════════════════════

  describe('speed line', () => {
    it('joins multiple speed modes into a single comma-separated value', () => {
      const m = makeMonster({ speed: { walk: '30 ft.', fly: '20 ft.' } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/walk 30 ft\., fly 20 ft\./)).toBeInTheDocument();
    });

    it('renders the Speed label with an empty value when speed is missing', () => {
      render(<MonsterCardModal {...makeProps(makeMonster({ speed: {} }))} />);
      expect(screen.getByText('Speed')).toBeInTheDocument();
      expect(document.querySelector('.mc-stat-speed .mc-stat-value').textContent).toBe('');
    });
  });

  // ════════════════════════════════════════════
  // Temporary hit points
  // ════════════════════════════════════════════

  describe('temporary hit points', () => {
    it('renders a Temp HP stat when the creature has temp HP in the runtime store', () => {
      getStore('Goblin').set('tempHp', 5);
      render(<MonsterCardModal {...makeProps(makeMonster())} />);
      expect(screen.getByText('Temp HP')).toBeInTheDocument();
      expect(document.querySelector('.mc-stat-temp-hp').textContent).toContain('5');
    });

    it('does not render a Temp HP stat when the creature has no temp HP', () => {
      render(<MonsterCardModal {...makeProps(makeMonster())} />);
      expect(screen.queryByText('Temp HP')).not.toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Languages
  // ════════════════════════════════════════════

  describe('languages', () => {
    it('joins array-format languages with commas', () => {
      const m = makeMonster({ languages: ['Common', 'Goblin', 'Draconic'] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Common, Goblin, Draconic')).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Legendary resistance
  // ════════════════════════════════════════════

  describe('legendary resistance', () => {
    it('renders "0/day" when legendary_resistance is 0 (a valid count, not "none")', () => {
      const m = makeMonster({ legendary_resistance: 0 });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('0/day')).toBeInTheDocument();
    });
  });
});
