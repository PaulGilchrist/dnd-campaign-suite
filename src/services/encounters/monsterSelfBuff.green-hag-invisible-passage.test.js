// MA-0919: Green Hag "Invisible Passage" — formerly a zero-affordance inert
// row (description + name only). NOW rides the SAME MA-0658 self-buff seam as
// the Duergar "Invisibility" twin, reusing its byte-shape exactly:
// automation:{type:"monster_self_buff", effect:"invisible", rounds:600} +
// usage:{type:"recharge after rest", rest_types:["short","long"]} +
// uses:1/maxUses:1 (duergar twin sentinel mirrored verbatim; rounds:600 is
// the BINDING backstop clock — the RAW attack/cast enders are the real
// enders). resolveMonsterSelfBuffRow grants te `invisible` ON SELF with ONE
// merged rounds:600 clock, spends the row's use BEFORE arming, refuses
// zero-spend when already invisible (`invisibility_refused` /
// already_invisible); endSelfBuffOnTrigger (attack / cast seams in
// MonsterCardModal) drops the self te early with an `invisible_ended` /
// ends_on_${trigger} log + clock cancel. Concentration-break ender and the
// flavor clause (no physical evidence of her passage) stay §70 advisory —
// the duergar twin carries the same residual.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  selfBuffRounds,
  endSelfBuffOnTrigger,
} from './monsterSelfBuff.js';
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

const greenHag = monstersData.find(m => m.index === 'green-hag');
const duergar = monstersData.find(m => m.index === 'duergar');
const PASSAGE_ROW = greenHag.actions[2];
const DUERGAR_INVIS_ROW = duergar.actions[3];
const CLAWS_ROW = greenHag.actions[0];

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

function makeEnderDeps({ targetEffects = [], expirations = [] } = {}) {
  const writes = [];
  const logs = [];
  return {
    writes,
    logs,
    getRuntimeValue: vi.fn((characterKey, propertyName) => {
      if (propertyName === 'targetEffects') return targetEffects;
      if (propertyName === 'pendingExpirations' && characterKey === 'Green Hag 1') return expirations;
      return undefined;
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { writes.push({ characterKey, propertyName, value }); }),
    addEntry: vi.fn((campaignName, entry) => { logs.push(entry); return Promise.resolve(); }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0919 Invisible Passage disk data — duergar twin byte-shape reused', () => {
  it('green-hag actions[2] authors monster_self_buff automation + numeric uses + usage', () => {
    expect(PASSAGE_ROW.name).toBe('Invisible Passage');
    expect(PASSAGE_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'invisible', rounds: 600 });
    expect(PASSAGE_ROW.uses).toBe(1);
    expect(PASSAGE_ROW.maxUses).toBe(1);
    expect(PASSAGE_ROW.usage).toEqual({ type: 'recharge after rest', rest_types: ['short', 'long'] });
    expect(isMonsterSelfBuffRow(PASSAGE_ROW)).toBe(true);
    expect(selfBuffRounds(PASSAGE_ROW)).toBe(600);
  });

  it('automation/usage/uses fields are byte-identical to the duergar Invisibility twin', () => {
    expect(PASSAGE_ROW.automation).toEqual(DUERGAR_INVIS_ROW.automation);
    expect(PASSAGE_ROW.usage).toEqual(DUERGAR_INVIS_ROW.usage);
    expect(PASSAGE_ROW.uses).toBe(DUERGAR_INVIS_ROW.uses);
    expect(PASSAGE_ROW.maxUses).toBe(DUERGAR_INVIS_ROW.maxUses);
  });

  it('Claws stays a pure attack row — no automation collateral on siblings', () => {
    expect(CLAWS_ROW.automation).toBeUndefined();
    expect(isMonsterSelfBuffRow(CLAWS_ROW)).toBe(false);
  });
});

describe('MA-0919 grant flow — resolveMonsterSelfBuffRow arms te invisible on self', () => {
  it('press: spends BEFORE arming, registers te invisible on self, ONE merged rounds:600 backstop clock, logs spend + grant + popup', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: PASSAGE_ROW,
      monsterName: 'Green Hag 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.effectKey).toBe('invisible');
    expect(result.remaining).toBe(0);
    expect(deps.store.uses).toEqual({ 'Invisible Passage': 1 });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Green Hag 1', 'invisible', 'Green Hag 1', expect.objectContaining({ rounds: 600 }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Green Hag 1',
      targetName: 'Green Hag 1',
      campaignName: 'test-campaign',
      rounds: 600,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Green Hag 1', target: 'Green Hag 1' }],
    });
    const spend = deps.store.logs.find(e => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Invisible Passage');
    const grant = deps.store.logs.find(e => e.automationType === 'invisible_granted');
    expect(grant.description).toContain('600 rounds (1 hour)');
    expect(grant.description).toContain('ends when it attacks, casts a spell');
    expect(grant.description).toContain('§70');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('turns invisible'));
  });

  it('refire same window: already invisible refuses zero-spend, zero te, zero clock — invisibility_refused / already_invisible', async () => {
    const deps = makeDeps({ activeTe: { target: 'Green Hag 1', effect: 'invisible', source: 'Green Hag 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: PASSAGE_ROW,
      monsterName: 'Green Hag 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'already-active' });
    expect(deps.store.uses).toEqual({});
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    const refusal = deps.store.logs.find(e => e.automationType === 'invisible_passage_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.automationDetail).toBe('already_invisible');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Already Invisible'));
  });

  it('exhausted uses: MA-0020 gate refusal, zero te, zero spend', async () => {
    const deps = makeDeps({ storedUses: { 'Invisible Passage': 1 } });
    const result = await resolveMonsterSelfBuffRow({
      action: PASSAGE_ROW,
      monsterName: 'Green Hag 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: { 'Invisible Passage': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.store.logs.some(e => e.automationType === 'invisible_passage_refused')).toBe(true);
  });
});

describe('MA-0919 enders live — attack / cast drop the self te early', () => {
  it('Claws attack trigger: drops te invisible, cancels merged clock, logs invisible_ended/ends_on_attack', async () => {
    const deps = makeEnderDeps({
      targetEffects: [
        { target: 'Green Hag 1', effect: 'invisible', source: 'Green Hag 1' },
        { target: 'Bandit 1', effect: 'bless', source: 'Cleric' },
      ],
      expirations: [
        { target: 'Green Hag 1', effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Green Hag 1', target: 'Green Hag 1' }], appliedRound: 1, expiryRounds: 600 },
      ],
    });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: 'Green Hag 1', effectKey: 'invisible', trigger: 'attack', actionName: 'Claws', deps });
    expect(dropped).toBe(true);
    const teWrite = deps.writes.find(w => w.propertyName === 'targetEffects');
    expect(teWrite.characterKey).toBe('campaign');
    expect(teWrite.value).toHaveLength(1);
    expect(teWrite.value[0].effect).toBe('bless');
    const expWrite = deps.writes.find(w => w.propertyName === 'pendingExpirations');
    expect(expWrite.characterKey).toBe('Green Hag 1');
    expect(expWrite.value).toHaveLength(0);
    expect(deps.logs[0].automationType).toBe('invisible_ended');
    expect(deps.logs[0].automationDetail).toBe('ends_on_attack');
    expect(deps.logs[0].characterName).toBe('Green Hag 1');
  });

  it('cast trigger: same drop + clock cancel with ends_on_cast log', async () => {
    const deps = makeEnderDeps({
      targetEffects: [{ target: 'Green Hag 1', effect: 'invisible', source: 'Green Hag 1' }],
      expirations: [{ target: 'Green Hag 1', effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Green Hag 1', target: 'Green Hag 1' }], appliedRound: 2, expiryRounds: 600 }],
    });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: 'Green Hag 1', effectKey: 'invisible', trigger: 'cast', actionName: 'Invisible Passage', deps });
    expect(dropped).toBe(true);
    expect(deps.writes.some(w => w.propertyName === 'targetEffects' && w.value.length === 0)).toBe(true);
    expect(deps.logs[0].automationDetail).toBe('ends_on_cast');
  });

  it('inert without a SELF-origin te: zero write, zero log', async () => {
    const deps = makeEnderDeps({ targetEffects: [{ target: 'Green Hag 1', effect: 'invisible', source: 'Dryad 1' }] });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: 'Green Hag 1', effectKey: 'invisible', trigger: 'attack', actionName: 'Claws', deps });
    expect(dropped).toBe(false);
    expect(deps.writes).toHaveLength(0);
    expect(deps.logs).toHaveLength(0);
  });
});
