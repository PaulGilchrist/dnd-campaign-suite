// MA-0655: Duergar "Enlarge" — formerly a zero-affordance inert row
// (description + usage only). The self-buff seam arms te `enlarged` ON SELF
// via resolveMonsterSelfBuffRow with ONE merged addExpiration clock
// (rounds:10 = 1 minute, §37 single-clock rule), spends the row's use
// BEFORE arming (MA-0020 monsterSpellUses economy + double-spend guard),
// refuses with zero spend when already enlarged (`enlarge_refused` +
// already_enlarged token) or exhausted. STR checks/saves advantage and
// rest-rearm stay §70 advisory on the grant log.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  buildSelfBuffGrantLog,
  buildAlreadyEnlargedRefusalLog,
  doublePrimaryDiceCount,
  selfBuffRounds,
} from './monsterSelfBuff.js';
import { TARGET_EFFECT_DEFINITIONS, getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

const duergar = monstersData.find(m => m.index === 'duergar');
const ENLARGE_ROW = duergar.actions[0];
const WAR_PICK = duergar.actions.find(a => a.name === 'War Pick');
const JAVELIN = duergar.actions.find(a => a.name === 'Javelin');

function makeDeps({ activeTe = null, storedUses = {} } = {}) {
  const store = { uses: { ...storedUses }, te: null, logs: [] };
  return {
    store,
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te = { campaign, target, effect, source, extra };
    }),
    getActiveTargetEffect: vi.fn(() => activeTe),
    addExpiration: vi.fn(),
    getRuntimeValue: vi.fn(() => store.uses),
    setRuntimeValue: vi.fn((c, k, v) => { store.uses = v; return Promise.resolve(); }),
    addEntry: vi.fn((c, entry) => { store.logs.push(entry); return Promise.resolve(); }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0655 disk data shape', () => {
  it('duergar Enlarge row authors the monster_self_buff automation + numeric uses', () => {
    expect(ENLARGE_ROW.name).toBe('Enlarge');
    expect(ENLARGE_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'enlarged', rounds: 10 });
    expect(ENLARGE_ROW.uses).toBe(1);
    expect(ENLARGE_ROW.maxUses).toBe(1);
    expect(ENLARGE_ROW.usage).toEqual({ type: 'recharge after rest', rest_types: ['short', 'long'] });
    expect(isMonsterSelfBuffRow(ENLARGE_ROW)).toBe(true);
    expect(selfBuffRounds(ENLARGE_ROW)).toBe(10);
  });

  it('STR-based weapon rows are structured-marked; other rows are not', () => {
    expect(WAR_PICK.strength_based).toBe(true);
    expect(WAR_PICK.damage_dice_primary).toBe('1d8 + 2');
    expect(JAVELIN.strength_based).toBe(true);
    expect(JAVELIN.damage_dice_primary).toBe('1d6 + 2');
    expect(ENLARGE_ROW.strength_based).toBeUndefined();
    const invis = duergar.actions.find(a => a.name === 'Invisibility');
    expect(invis.strength_based).toBeUndefined();
    expect(isMonsterSelfBuffRow(invis)).toBe(false);
  });

  it('te `enlarged` is registered in targetEffectDefinitions', () => {
    const def = getEffectDefinition('enlarged');
    expect(def).toBeDefined();
    expect(def.label).toBe('Enlarged');
    expect(def.icon).toMatch(/^fa-/);
    expect(def.cls).toBe('effect-buff');
    expect(def.group).toBe('Spells');
    expect(TARGET_EFFECT_DEFINITIONS.filter(d => d.effect === 'enlarged')).toHaveLength(1);
    expect(def.description).toMatch(/doubles its damage dice on Strength-based weapon attacks/i);
  });
});

describe('MA-0655 doublePrimaryDiceCount', () => {
  it('doubles dice count only — modifier untouched', () => {
    expect(doublePrimaryDiceCount('1d8 + 2')).toBe('2d8 + 2');
    expect(doublePrimaryDiceCount('1d6 + 2')).toBe('2d6 + 2');
    expect(doublePrimaryDiceCount('2d6 + 2')).toBe('4d6 + 2');
    expect(doublePrimaryDiceCount('1d8')).toBe('2d8');
    expect(doublePrimaryDiceCount('1d8+2')).toBe('2d8+2');
  });

  it('flat constants and empty formulas stay unchanged', () => {
    expect(doublePrimaryDiceCount('15')).toBe('15');
    expect(doublePrimaryDiceCount(null)).toBeNull();
  });
});

describe('MA-0655 grant flow', () => {
  it('first click: spends BEFORE arming, registers te enlarged on self, ONE merged rounds:10 clock, logs spend + grant + popup', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ENLARGE_ROW,
      monsterName: 'Duergar 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.effectKey).toBe('enlarged');
    expect(result.remaining).toBe(0);
    // spend BEFORE te register (double-spend guard)
    expect(deps.store.uses).toEqual({ Enlarge: 1 });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Duergar 1', 'enlarged', 'Duergar 1', expect.objectContaining({ rounds: 10 }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Duergar 1',
      targetName: 'Duergar 1',
      campaignName: 'test-campaign',
      rounds: 10,
      effects: [{ type: 'remove_target_effect', effectKey: 'enlarged', source: 'Duergar 1', target: 'Duergar 1' }],
    });
    const spend = deps.store.logs.find(e => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Enlarge');
    const grant = deps.store.logs.find(e => e.automationType === 'enlarged_granted');
    expect(grant.description).toContain('10 rounds');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Enlarged'));
  });

  it('already enlarged: refuses with zero spend, zero te, zero clock, enlarge_refused log', async () => {
    const deps = makeDeps({ activeTe: { target: 'Duergar 1', effect: 'enlarged', source: 'Duergar 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ENLARGE_ROW,
      monsterName: 'Duergar 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'already-active' });
    expect(deps.store.uses).toEqual({});
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    const refusal = deps.store.logs.find(e => e.automationType === 'enlarge_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toContain('already_enlarged');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Already Enlarged'));
  });

  it('exhausted uses: MA-0020 gate refusal, zero te, zero spend, enlarge_refused log', async () => {
    const deps = makeDeps({ storedUses: { Enlarge: 1 } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ENLARGE_ROW,
      monsterName: 'Duergar 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: { Enlarge: 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.store.logs.some(e => e.automationType === 'enlarge_refused')).toBe(true);
  });

  it('non-self-buff rows never resolve', async () => {
    const deps = makeDeps();
    const result = await resolveMonsterSelfBuffRow({
      action: WAR_PICK,
      monsterName: 'Duergar 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'not-self-buff' });
  });
});

describe('MA-0655 grant log copy', () => {
  it('grant log carries the §70 advisory for STR adv / rest-rearm', () => {
    const log = buildSelfBuffGrantLog({ monsterName: 'Duergar', action: ENLARGE_ROW, effectKey: 'enlarged', rounds: 10 });
    expect(log.abilityName).toBe('Enlarge');
    expect(log.description).toContain('§70');
    expect(buildAlreadyEnlargedRefusalLog({ monsterName: 'Duergar', action: ENLARGE_ROW, effectKey: 'enlarged' }).description).toContain('zero use spent');
  });
});
