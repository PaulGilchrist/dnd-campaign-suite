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
  endSelfBuffOnTrigger,
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
  KEY: 'pendingExpirations',
}));

const duergar = monstersData.find(m => m.index === 'duergar');
const ENLARGE_ROW = duergar.actions[0];
const WAR_PICK = duergar.actions.find(a => a.name === 'War Pick');
const JAVELIN = duergar.actions.find(a => a.name === 'Javelin');
const INVIS_ROW = duergar.actions.find(a => a.name === 'Invisibility');

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
    // MA-0658: Invisibility now rides the SAME self-buff seam (not inert)
    expect(isMonsterSelfBuffRow(invis)).toBe(true);
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

// MA-0658: Duergar "Invisibility" — formerly a zero-affordance inert row
// (description + usage only). NOW rides the SAME MA-0655 self-buff seam:
// automation:{type:"monster_self_buff", effect:"invisible", rounds:600} +
// uses:1/maxUses:1. resolveMonsterSelfBuffRow grants te `invisible` ON SELF
// with ONE merged rounds:600 (1 hour) addExpiration clock, spends the row's
// use BEFORE arming, refuses zero-spend when already invisible or exhausted.
// RAW enders (attack / cast / enlarge) drop the self te early via
// endSelfBuffOnTrigger with an `invisible_ended` / ends_on_${trigger} log +
// clock cancel; concentration-break ender and invisibility advantage
// adjudication stay §70 advisory (mirrors the MA-0655 enlarged twin).
describe('MA-0658 Invisibility disk data + registry', () => {
  it('duergar actions[3] Invisibility authors monster_self_buff automation + numeric uses, usage kept', () => {
    expect(INVIS_ROW.name).toBe('Invisibility');
    expect(INVIS_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'invisible', rounds: 600 });
    expect(INVIS_ROW.uses).toBe(1);
    expect(INVIS_ROW.maxUses).toBe(1);
    expect(INVIS_ROW.usage).toEqual({ type: 'recharge after rest', rest_types: ['short', 'long'] });
    expect(isMonsterSelfBuffRow(INVIS_ROW)).toBe(true);
    expect(selfBuffRounds(INVIS_ROW)).toBe(600);
  });

  it('te `invisible` is registered in targetEffectDefinitions (exactly once)', () => {
    const def = getEffectDefinition('invisible');
    expect(def).toBeDefined();
    expect(def.label).toBe('Invisible');
    expect(def.icon).toMatch(/^fa-/);
    expect(def.cls).toBe('effect-buff');
    expect(def.group).toBe('Spells');
    expect(TARGET_EFFECT_DEFINITIONS.filter(d => d.effect === 'invisible')).toHaveLength(1);
    expect(def.description).toMatch(/until it attacks, casts a spell, or uses its Enlarge/i);
    expect(def.description).toMatch(/concentration is broken, up to 1 hour/i);
  });
});

function makeEnderDeps({ targetEffects = [], expirations = [] } = {}) {
  const writes = [];
  const logs = [];
  return {
    writes,
    logs,
    getRuntimeValue: vi.fn((characterKey, propertyName) => {
      if (propertyName === 'targetEffects') return targetEffects;
      if (propertyName === 'pendingExpirations' && characterKey === 'Duergar 1') return expirations;
      return undefined;
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { writes.push({ characterKey, propertyName, value }); }),
    addEntry: vi.fn((campaignName, entry) => { logs.push(entry); return Promise.resolve(); }),
  };
}

describe('MA-0658 invisibility grant flow (same seam as enlarged)', () => {
  it('first click: spends BEFORE arming, registers te invisible on self, ONE merged rounds:600 clock, logs spend + grant + popup', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
      monsterName: 'Duergar 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.effectKey).toBe('invisible');
    expect(result.remaining).toBe(0);
    expect(deps.store.uses).toEqual({ Invisibility: 1 });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Duergar 1', 'invisible', 'Duergar 1', expect.objectContaining({ rounds: 600 }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Duergar 1',
      targetName: 'Duergar 1',
      campaignName: 'test-campaign',
      rounds: 600,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Duergar 1', target: 'Duergar 1' }],
    });
    const spend = deps.store.logs.find(e => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Invisibility');
    const grant = deps.store.logs.find(e => e.automationType === 'invisible_granted');
    expect(grant.description).toContain('600 rounds (1 hour)');
    expect(grant.description).toContain('§70');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('turns invisible'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Ends on attack, spell cast, or Enlarge'));
  });

  it('already invisible: refuses zero-spend, zero te, zero clock, invisibility_refused + already_invisible', async () => {
    const deps = makeDeps({ activeTe: { target: 'Duergar 1', effect: 'invisible', source: 'Duergar 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
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
    const refusal = deps.store.logs.find(e => e.automationType === 'invisibility_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.automationDetail).toBe('already_invisible');
    expect(refusal.description).toContain('already_invisible');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Already Invisible'));
  });

  it('exhausted uses: MA-0020 gate refusal, zero te, zero spend', async () => {
    const deps = makeDeps({ storedUses: { Invisibility: 1 } });
    const result = await resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
      monsterName: 'Duergar 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: { Invisibility: 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.store.logs.some(e => e.automationType === 'invisibility_refused')).toBe(true);
  });
});

describe('MA-0658 enlarge ender inside the grant seam', () => {
  it('granting Enlarge while invisible drops self te invisible + invisible_ended/ends_on_enlarge log, enlarged still granted', async () => {
    const store = {
      targetEffects: [{ target: 'Duergar 1', effect: 'invisible', source: 'Duergar 1' }],
      expirations: [{ target: 'Duergar 1', effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Duergar 1', target: 'Duergar 1' }], appliedRound: 1, expiryRounds: 600 }],
      uses: {},
    };
    const logs = [];
    const deps = {
      registerTargetEffect: vi.fn(),
      getActiveTargetEffect: vi.fn(() => null),
      addExpiration: vi.fn(),
      getRuntimeValue: vi.fn((characterKey, propertyName) => {
        if (propertyName === 'targetEffects') return store.targetEffects;
        if (propertyName === 'pendingExpirations') return store.expirations;
        return store.uses;
      }),
      setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
        if (propertyName === 'targetEffects') store.targetEffects = value;
        if (propertyName === 'pendingExpirations') store.expirations = value;
        if (propertyName === 'monsterSpellUses') store.uses = value;
        return Promise.resolve();
      }),
      addEntry: vi.fn((campaignName, entry) => { logs.push(entry); return Promise.resolve(); }),
    };
    const result = await resolveMonsterSelfBuffRow({
      action: ENLARGE_ROW,
      monsterName: 'Duergar 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Duergar 1', 'enlarged', 'Duergar 1', expect.objectContaining({ rounds: 10 }));
    expect(store.targetEffects.some(te => te.effect === 'invisible')).toBe(false);
    expect(store.expirations).toHaveLength(0);
    const endLog = logs.find(e => e.automationType === 'invisible_ended');
    expect(endLog).toBeTruthy();
    expect(endLog.automationDetail).toBe('ends_on_enlarge');
    expect(endLog.description).toContain('ends on enlarge');
  });
});

describe('MA-0658 endSelfBuffOnTrigger (attack / cast ender consumer)', () => {
  it('attack trigger: drops self te invisible, cancels the merged clock, logs invisible_ended/ends_on_attack', async () => {
    const deps = makeEnderDeps({
      targetEffects: [
        { target: 'Duergar 1', effect: 'invisible', source: 'Duergar 1' },
        { target: 'Bandit 1', effect: 'bless', source: 'Cleric' },
      ],
      expirations: [
        { target: 'Duergar 1', effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Duergar 1', target: 'Duergar 1' }], appliedRound: 1, expiryRounds: 600 },
        { target: 'Duergar 1', effects: [{ type: 'remove_target_effect', effectKey: 'other', source: 'X', target: 'Duergar 1' }], appliedRound: 1, expiryRounds: 5 },
      ],
    });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: 'Duergar 1', effectKey: 'invisible', trigger: 'attack', actionName: 'War Pick', deps });
    expect(dropped).toBe(true);
    const teWrite = deps.writes.find(w => w.propertyName === 'targetEffects');
    expect(teWrite.characterKey).toBe('campaign');
    expect(teWrite.value).toHaveLength(1);
    expect(teWrite.value[0].effect).toBe('bless');
    const expWrite = deps.writes.find(w => w.propertyName === 'pendingExpirations');
    expect(expWrite.characterKey).toBe('Duergar 1');
    expect(expWrite.value).toHaveLength(1);
    expect(expWrite.value[0].effects[0].effectKey).toBe('other');
    expect(deps.logs).toHaveLength(1);
    expect(deps.logs[0].automationType).toBe('invisible_ended');
    expect(deps.logs[0].automationDetail).toBe('ends_on_attack');
    expect(deps.logs[0].description).toContain('ends on attack');
    expect(deps.logs[0].characterName).toBe('Duergar 1');
  });

  it('cast trigger: same drop + clock cancel with ends_on_cast log', async () => {
    const deps = makeEnderDeps({
      targetEffects: [{ target: 'Duergar 1', effect: 'invisible', source: 'Duergar 1' }],
      expirations: [{ target: 'Duergar 1', effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Duergar 1', target: 'Duergar 1' }], appliedRound: 2, expiryRounds: 600 }],
    });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: 'Duergar 1', effectKey: 'invisible', trigger: 'cast', actionName: 'Invisibility', deps });
    expect(dropped).toBe(true);
    expect(deps.writes.some(w => w.propertyName === 'targetEffects' && w.value.length === 0)).toBe(true);
    expect(deps.logs[0].automationDetail).toBe('ends_on_cast');
  });

  it('inert without a SELF-origin te: zero write, zero log (PC-sourced te untouched)', async () => {
    const deps = makeEnderDeps({ targetEffects: [{ target: 'Duergar 1', effect: 'invisible', source: 'Drow Mage 1' }] });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: 'Duergar 1', effectKey: 'invisible', trigger: 'attack', actionName: 'War Pick', deps });
    expect(dropped).toBe(false);
    expect(deps.writes).toHaveLength(0);
    expect(deps.logs).toHaveLength(0);
  });

  it('grant/refusal copy stays byte-identical for the enlarged twin', () => {
    const grant = buildSelfBuffGrantLog({ monsterName: 'Duergar', action: ENLARGE_ROW, effectKey: 'enlarged', rounds: 10 });
    expect(grant.description).toContain('for 10 rounds (1 minute) — damage dice on Strength-based weapon attacks doubled');
    expect(buildAlreadyEnlargedRefusalLog({ monsterName: 'Duergar', action: ENLARGE_ROW, effectKey: 'enlarged' }).automationDetail).toBe('already_enlarged');
  });
});
