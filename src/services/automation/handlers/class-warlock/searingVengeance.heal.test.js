// @maintained-by-ai
// SEARING VENGEANCE HEAL SEAM (quad file 1/4). Canonical home of:
// - getRealMaxHp runtime-truth: combatSummary player entries are 1/1 placeholders,
//   runtime hitPoints is max-HP truth; healAmount = floor(maxHp/2); targetMaxHp payload pin.
// - confirm-time heal through the REAL applyHealingToTarget chokepoint (both sibling
//   suites mock it): modifyHitPoints runtime write, canonical 0→positive deathSaves/
//   deathFailures/isDead reset, hp_change heal log.
// - burst gate centered on the healed target, not the caster (source-keyed isWithinRange
//   mock — Handler.test.js 'filters creatures by ally range and attack range' keys by
//   target name only and cannot catch a caster-centred regression).
// Also carries the quad's only full-args applyDamageToTarget pin (folded into the
// confirm heal test below) — ConfirmPath lane may adopt it in
// 'handles multiple targets by applying damage to each', then drop it here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../dice/diceRoller.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, rollExpression: vi.fn() }
});

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(async () => {}),
}));

import { handle, confirmSearingVengeance } from './searingVengeanceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';

function makeAction(automation = {}) {
  return {
    name: 'Searing Vengeance',
    automation: {
      healExpression: 'floor(target_max_hp / 2)',
      damageExpression: '2d8 + CHA modifier',
      damageType: 'Radiant',
      range: '30_ft',
      condition: 'blinded',
      conditionDuration: 'until_end_of_current_turn',
      uses: 1,
      usesMax: 1,
      recharge: 'long_rest',
      casting_time: '1 reaction',
      trigger: 'death_save_by_ally_or_self',
      allyRange: '60_ft',
      ...automation,
    },
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'HexWarlock',
    level: 14,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

describe('searingVengeance CLA-304 heal math', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('heals from runtime real maxHp when combatSummary player entry is a 1/1 placeholder', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((subject, key) => {
      if (key === 'searingvengeanceUses') return 1;
      if (subject === 'LightfootHalfling' && key === 'currentHitPoints') return 0;
      if (subject === 'LightfootHalfling' && key === 'hitPoints') return 12;
      return null;
    });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'LightfootHalfling', type: 'player', currentHp: 1, maxHp: 1 },
        { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32 },
      ],
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.payload.targetName).toBe('LightfootHalfling');
    expect(result.payload.targetMaxHp).toBe(12);
    expect(result.payload.healAmount).toBe(6);
  });

  it('burst range gate centers on the healed target, not the caster', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((subject, key) => {
      if (key === 'searingvengeanceUses') return 1;
      if (subject === 'LightfootHalfling' && key === 'currentHitPoints') return 0;
      if (subject === 'LightfootHalfling' && key === 'hitPoints') return 12;
      return null;
    });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'LightfootHalfling', type: 'player', currentHp: 1, maxHp: 1 },
        { name: 'NearThug', type: 'npc', currentHp: 32, maxHp: 32 },
        { name: 'FarThug', type: 'npc', currentHp: 32, maxHp: 32 },
      ],
    });
    const rangeCheck = await import('../../../rules/combat/rangeCheck.js');
    // source-keyed mock: within-range is true only from the HEALED ally, never from the caster
    rangeCheck.isWithinRange.mockImplementation(async (source, target) => {
      if (source === 'HexWarlock') return true;
      if (source === 'LightfootHalfling') return target === 'NearThug';
      return false;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.payload.targetName).toBe('LightfootHalfling');
    expect(result.payload.creatureTargets.map(t => t.name)).toEqual(['NearThug']);
  });

  it('heal is applied at confirm time via canonical applyHealingToTarget (death saves reset)', async () => {
    const cs = {
      creatures: [
        { name: 'LightfootHalfling', type: 'player', currentHp: 1, maxHp: 1 },
        { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32 },
      ],
    };
    useRuntimeState.getRuntimeValue.mockImplementation((subject, key) => {
      if (key === 'searingvengeanceUses') return 1;
      if (subject === 'LightfootHalfling' && key === 'currentHitPoints') return 0;
      if (subject === 'LightfootHalfling' && key === 'hitPoints') return 12;
      return null;
    });
    damageUtils.getCombatContext.mockResolvedValue(cs);
    diceRoller.rollExpression.mockReturnValue({ total: 18, rolls: [7, 8] });

    const payload = {
      name: 'Searing Vengeance',
      targetName: 'LightfootHalfling',
      targetMaxHp: 12,
      healAmount: 6,
      selectedTargets: ['Thug 1'],
    };

    const result = await confirmSearingVengeance({
          automation: makeAction().automation,
          playerStats: makePlayerStats(),
          campaignName,
          mapName: null,
          characters: [],
          payload,
      });

    // real HP written through runtime store (modifyHitPoints inside applyHealingToTarget)
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'LightfootHalfling', 'currentHitPoints', 6, campaignName
    );
    // canonical 0→positive convention: pending death saves cleared
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'LightfootHalfling', 'deathSaves', [false, false, false], campaignName
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'LightfootHalfling', 'deathFailures', [false, false, false], campaignName
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'LightfootHalfling', 'isDead', 0, campaignName
    );
    expect(result.payload.description).toContain('regains 6 HP');
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'hp_change',
      targetName: 'LightfootHalfling',
      delta: 6,
      currentHp: 6,
      maxHp: 12,
      isHealing: true,
    }));
    // quad's only full-args burst-damage pin (borrowed from the CHA test, whose own
    // rollExpression pin lives in ConfirmPath 'resolves CHA modifier from abilities bonus')
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Thug 1', 18, ['Radiant'], { campaignName, characters: [], ignoreResistance: false, attackerName: 'HexWarlock' });
  });
});
