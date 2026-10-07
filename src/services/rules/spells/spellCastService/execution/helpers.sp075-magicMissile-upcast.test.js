// SP-075: executeMagicMissile derives its dart count and log spellLevel from
// metaCtx.slotLevel — pins that the upcast level threaded by the confirm lane
// (slotLevel 2/4) reaches getMagicMissileCount and the spell log, and that the
// lv1 fallback (no metaCtx.slotLevel, spell.level 1) stays byte-identical.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [{ name: 'Goblin A', maxHp: 30, currentHp: 30 }],
  })),
}));

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 12, damageReduced: false })),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 3, rolls: [2] })),
  rollExpressionMaximized: vi.fn(() => ({ total: 5, rolls: [4] })),
  applyHealingRerollOnes: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

import { executeMagicMissile } from './helpers.js';
import { applyDamageToTarget } from '../../../../rules/combat/applyDamage.js';
import { rollExpression } from '../../../../dice/diceRoller.js';
import { addEntry } from '../../../../ui/logService.js';

const CAMPAIGN = 'test-campaign';
const spell = { name: 'Magic Missile', level: 1, casting_time: 'Action', range: '120 feet', damage: { damage_type: 'Force' } };

function makeServices() {
  return {
    rollDamage: vi.fn(),
    playerStats: { name: 'DivinationWizard', automation: { passives: [] } },
    getTargetInfo: vi.fn(async () => ({ name: 'Goblin A' })),
    campaignName: CAMPAIGN,
    mapName: null,
    characters: [],
  };
}

function spellLog() {
  return addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'spell');
}

describe('SP-075 executeMagicMissile — dart count tracks the paid slot level', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('slotLevel 2: rolls 4 darts, logs spellLevel 2 missileCount 4', async () => {
    const services = makeServices();
    await executeMagicMissile(spell, { slotLevel: 2, magicMissileDistribution: { 'Goblin A': 4 } }, services);

    expect(rollExpression).toHaveBeenCalledWith('1d4 + 1');
    expect(services.rollDamage).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Magic Missile (Goblin A)',
      formula: '4× 1d4 + 1',
      total: 12,
    }));
    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin A', 12, ['Force'], expect.objectContaining({ attackerName: 'DivinationWizard' }));
    const log = spellLog();
    expect(log.spellLevel).toBe(2);
    expect(log.missileCount).toBe(4);
    expect(log.missileDamage).toBe('1d4 + 1');
  });

  it('slotLevel 4: logs spellLevel 4 missileCount 6', async () => {
    const services = makeServices();
    await executeMagicMissile(spell, { slotLevel: 4, magicMissileDistribution: { 'Goblin A': 6 } }, services);

    const log = spellLog();
    expect(log.spellLevel).toBe(4);
    expect(log.missileCount).toBe(6);
    expect(services.rollDamage).toHaveBeenCalledWith(expect.objectContaining({ formula: '6× 1d4 + 1', total: 18 }));
  });

  it('lv1 fallback: no metaCtx.slotLevel — spell.level 1, 3 darts, byte-identical legacy', async () => {
    const services = makeServices();
    await executeMagicMissile(spell, { magicMissileDistribution: { 'Goblin A': 3 } }, services);

    const log = spellLog();
    expect(log.spellLevel).toBe(1);
    expect(log.missileCount).toBe(3);
    expect(services.rollDamage).toHaveBeenCalledWith(expect.objectContaining({ formula: '3× 1d4 + 1', total: 9 }));
  });
});
