// @maintained-by-ai
// Catch-branch coverage for quiveringPalmHandler: pins that each addEntry(...).catch()
// call site swallows log rejections AND logs '[quiveringPalmHandler:log-error]'.
// Seam map for the cluster: handle() success-path catch → successCatch.test.js;
// applyShockwave() catches → errorPaths.test.js; refusal/validation branch messages
// (without rejection injection) → handle.test.js and quiveringPalmHandler.test.js.
// All refusal branches share one .catch in refusal(), so one representative covers it.
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

import { handle, applyRelease } from './quiveringPalmHandler.js';
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

// ── Tests: handle() — addEntry rejection (silent .catch) ───────

describe('quiveringPalmHandler.handle — addEntry rejection', () => {
  let consoleSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined);
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('does not throw when addEntry rejects (modal path - vibrations already active)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    addEntry.mockRejectedValueOnce(new Error('log error'));

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return 'Ogre';
      return undefined;
    });

    // Should not throw - the .catch() swallows the error
    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('quiveringPalm');
    expect(result.payload.targetName).toBe('Ogre');
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[quiveringPalmHandler:log-error]', expect.any(Error));
    }, { timeout: 5000 });
  });

  it('does not throw when addEntry rejects (refusal path via refusal() helper)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    addEntry.mockRejectedValueOnce(new Error('log error'));

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return { attackerName: 'Goblin', attackName: 'Longsword' };
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    // Refusal popup still returned despite failed log; pins popup-vs-log
    // description divergence owned by refusal(). Branch messages for the other
    // refusal reasons are pinned in handle.test.js / quiveringPalmHandler.test.js.
    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Quivering Palm — Last attack was not made by you.');
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[quiveringPalmHandler:log-error]', expect.any(Error));
    }, { timeout: 5000 });
  });
});

// ── Tests: applyRelease() — addEntry rejection ─────────────────

describe('quiveringPalmHandler.applyRelease — addEntry rejection', () => {
  let consoleSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined);
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('does not throw when addEntry rejects', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (b === 'targetEffects') return [
        { target: 'Goblin', effect: 'quivering_palm', source: 'Quivering Palm' },
      ];
      return undefined;
    });

    addEntry.mockRejectedValueOnce(new Error('log error'));

    // Should not throw - the .catch() swallows the error
    const result = await applyRelease(action, ps, campaignName, 'Goblin');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Vibrations released harmlessly against Goblin.');
    expect(result.payload.isRelease).toBe(true);
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[quiveringPalmHandler:log-error]', expect.any(Error));
    }, { timeout: 5000 });
  });
});
