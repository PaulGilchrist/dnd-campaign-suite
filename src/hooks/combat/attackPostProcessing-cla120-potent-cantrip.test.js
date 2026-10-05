// CLA-120: the Potent Cantrip miss-half formula rides the pre-baked
// autoDamageFormula — the phantom roll must collapse to ONE [Empowered
// Evocation] term, never a double label (CLA-279 idempotency shape).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 22, rolls: [8, 5, 5, 4], modifier: 0 })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasIgnoreResistance: vi.fn(() => false),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => Promise.resolve({ finalDamage: 11, newHp: 4 })),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
  hasPotentCantrip: vi.fn(() => true),
  applyMinDamageAdjustment: vi.fn((total) => total),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => [{ type: 'empowered_evocation' }]),
  getEmpoweredEvocationIntModifier: vi.fn(() => 5),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const { processPotentCantrip } = await import('./attackPostProcessing.js');

function makeContext(overrides = {}) {
  return {
    name: 'Fire Bolt',
    playerStats: { name: 'DivinationWizard', abilities: [{ name: 'Intelligence', bonus: 5 }] },
    autoDamageFormula: '4d10 + 5 [Empowered Evocation]',
    autoDamageRollResult: { total: 29, rolls: [8, 6, 6, 4], modifier: 5 },
    autoDamageSchool: 'Evocation',
    damageType: 'Fire',
    saveDc: null,
    ...overrides,
  };
}

describe('processPotentCantrip — CLA-120 phantom miss formula folds INT once', () => {
  let logEntry;

  beforeEach(() => {
    vi.clearAllMocks();
    logEntry = vi.fn();
  });

  it('pre-baked autoDamageFormula → ONE [Empowered Evocation] term (no double label)', async () => {
    await processPotentCantrip({
      hit: false, isAutoMiss: false, targetName: 'NPC 1', characterName: 'DivinationWizard',
      campaignName: 'test-campaign', context: makeContext(), characters: [],
      logEntry, setPopupHtml: vi.fn(),
    });

    expect(logEntry).toHaveBeenCalled();
    const formula = logEntry.mock.calls[0][0].formula;
    expect(formula).toBe('4d10 + 5 [Empowered Evocation]');
    expect(formula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);
  });

  it('unmarked potentFormula → INT folded exactly once (PASS control)', async () => {
    await processPotentCantrip({
      hit: false, isAutoMiss: false, targetName: 'NPC 1', characterName: 'DivinationWizard',
      campaignName: 'test-campaign',
      context: makeContext({ autoDamageFormula: '4d10' }),
      characters: [], logEntry, setPopupHtml: vi.fn(),
    });

    const formula = logEntry.mock.calls[0][0].formula;
    expect(formula).toBe('4d10 + 5 [Empowered Evocation]');
    expect(formula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);
  });

  it('non-evocation school → zero terms (school gate control)', async () => {
    await processPotentCantrip({
      hit: false, isAutoMiss: false, targetName: 'NPC 1', characterName: 'DivinationWizard',
      campaignName: 'test-campaign',
      context: makeContext({ autoDamageFormula: '4d12', autoDamageSchool: 'Necromancy' }),
      characters: [], logEntry, setPopupHtml: vi.fn(),
    });

    const formula = logEntry.mock.calls[0][0].formula;
    expect(formula).toBe('4d12');
    expect(formula).not.toContain('[Empowered Evocation]');
  });
});
