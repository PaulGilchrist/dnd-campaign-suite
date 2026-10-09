// @improved-by-ai
// CLA-300 regression: Roving climb/swim must equal the rules-layer folded
// Speed (stats.speed), not folded Speed + 10 (double-count fingerprint).
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import rulesFactory from '../../services/rules/rulesFactory.js';

import {
  createMockStore,
  createDefaultProps,
  createMockPlayerStats,
  createSharedPopupReturnValue,
  resetTestState,
} from './CharSheet.test-utils.jsx';

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-summary"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-abilities"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-actions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-inventory"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-reactions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-special-actions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-character-advancement"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-spells"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('../../services/automation/handlers/shieldOfFaithHandler.js', () => ({
  applyShieldOfFaith: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraComboEffects.js', () => ({
  computeAuraComboEffects: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn().mockReturnValue({
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    cannotAct: false,
  }),
  getNetAttackMode: vi.fn().mockReturnValue('normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn().mockReturnValue({ creatures: [] }),
  loadCombatSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => expr),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isCreatureWarded: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockReturnValue(null),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getManeuversForRules: vi.fn().mockResolvedValue([]),
  getSuperiorityDice: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getProperty: vi.fn().mockResolvedValue(null),
    setProperty: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../common/popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: vi.fn((props) => (
    <div data-testid="attack-result-popup">
      <span>{props.popupHtml?.name || 'Attack'}</span>
    </div>
  )),
}));

const mockStore = createMockStore();
const sharedPopupReturnVal = createSharedPopupReturnValue();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => mockStore),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((key, prop) => {
    const defaults = { activeConditions: [], activeBuffs: [], targetEffects: [] };
    const def = Object.prototype.hasOwnProperty.call(defaults, prop) ? defaults[prop] : null;
    return mockStore.get(`${key}:${prop}`) ?? def;
  }),
}));

vi.mock('../../hooks/combat/useSharedPopup.js', () => {
  const mockFn = vi.fn();
  mockFn.mockImplementation(() => ({ ...sharedPopupReturnVal, Provider: ({ children }) => children }));
  return { default: mockFn };
});

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve(createMockPlayerStats())),
  },
}));

async function renderAndReadStats(stats) {
  vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));
  render(<CharSheet {...createDefaultProps()} />);
  await waitFor(() => {
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
  });
  const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
  return CharSummary.mock.calls[0][0].playerStats;
}

describe('CLA-300 Roving climb/swim equal folded Speed (no +10 double-count)', () => {
  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
  });

  it('bare Ranger lv6: folded speed 40 -> climb 40 swim 40', async () => {
    const stats = createMockPlayerStats({
      speed: 40,
      automation: { passives: [{ name: 'Roving' }] },
      inventory: { equipped: ['Longbow'] },
      equipment: [{ name: 'Longbow' }, { name: 'Chain Mail', armor_category: 'Heavy' }],
    });

    const passedStats = await renderAndReadStats(stats);

    expect(passedStats.climbSpeed).toBe(40);
    expect(passedStats.swimSpeed).toBe(40);
  });

  it('Speedy lane: folded speed 50 -> climb 50 swim 50', async () => {
    const stats = createMockPlayerStats({
      speed: 50,
      automation: { passives: [{ name: 'Roving' }, { effect: 'speed_increase', bonusExpression: '10' }] },
      inventory: { equipped: ['Longbow'] },
      equipment: [{ name: 'Longbow' }],
    });

    const passedStats = await renderAndReadStats(stats);

    expect(passedStats.climbSpeed).toBe(50);
    expect(passedStats.swimSpeed).toBe(50);
  });

  it('heavy armor: roving gate held -> no climb/swim speeds', async () => {
    const stats = createMockPlayerStats({
      speed: 30,
      automation: { passives: [{ name: 'Roving' }] },
      inventory: { equipped: ['Chain Mail'] },
      equipment: [{ name: 'Chain Mail', armor_category: 'Heavy' }],
    });

    const passedStats = await renderAndReadStats(stats);

    expect(passedStats.climbSpeed).toBeUndefined();
    expect(passedStats.swimSpeed).toBeUndefined();
  });

  it('non-Ranger lane (no Roving passive): inert', async () => {
    const stats = createMockPlayerStats({
      speed: 30,
      automation: { passives: [] },
      inventory: { equipped: [] },
      equipment: [],
    });

    const passedStats = await renderAndReadStats(stats);

    expect(passedStats.climbSpeed).toBeUndefined();
    expect(passedStats.swimSpeed).toBeUndefined();
  });
});
