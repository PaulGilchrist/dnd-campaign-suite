// @maintained-by-ai
// Seam map for the quiveringPalm cluster: THIS file owns the handle() success-path
// addEntry(...).catch() at quiveringPalmHandler.js L127 (set-vibrations log) —
// pins that a failed set-log does not break the automation and logs
// '[quiveringPalmHandler:log-error]'. Modal/refusal/release catches (L68/L148/L285)
// live in catchCoverage.test.js; applyShockwave() '[quiveringPalm] Error:' catches
// live in errorPaths.test.js; success-path resource writes live in handle.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './quiveringPalmHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestMonk',
    level: 17,
    proficiencyBonus: 6,
    proficiency: 6,
    abilities: [
      { name: 'Strength', bonus: 2 },
      { name: 'Wisdom', bonus: 3 },
      { name: 'Dexterity', bonus: 2 },
    ],
    class: {
      class_levels: [{ level: 17, focus_points: 4 }],
    },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Quivering Palm',
    automation: {
      type: 'quivering_palm',
      casting_time: 'passive',
      cost: { amount: 3, resource: 'kiPoints' },
      trigger: 'action',
      damageExpression: '10d10',
      damageType: 'Necrotic',
      ...automation,
    },
  };
}

// ── Tests: handle() — success path with addEntry rejection ─────

describe('quiveringPalmHandler.handle — success path addEntry rejection', () => {
  let consoleSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined);
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('does not throw when addEntry rejects on success path (set vibrations log)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return {
        attackerName: 'TestMonk',
        attackName: 'Unarmed Strike',
        saveResult: 'success',
      };
      if (b === 'kiPoints') return 5;
      if (b === 'targetEffects') return [];
      return undefined;
    });

    // The set-vibrations success path logs once via addEntry (L122-127);
    // reject it so the .catch(console.error) at L127 fires.
    addEntry.mockRejectedValueOnce(new Error('log error'));

    // Should not throw — the .catch() swallows the rejection.
    const result = await handle(action, ps, campaignName, null);

    // Automation still returns its set-success popup, and the log entry
    // was attempted with the canonical set description before failing.
    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Quivering Palm set on Goblin. Use the feature again to release the vibrations or trigger a shockwave.');
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestMonk',
      abilityName: 'Quivering Palm',
      description: "TestMonk set lethal vibrations in Goblin's body. Use the feature again to release the vibrations or trigger a shockwave.",
    }));
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[quiveringPalmHandler:log-error]', expect.any(Error));
    }, { timeout: 5000 });
  });
});
