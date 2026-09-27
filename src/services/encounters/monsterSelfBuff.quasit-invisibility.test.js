// MA-1369: Quasit "Invisibility" — formerly a zero-affordance prose-only row
// with a junk attack_bonus:0 "+0" chip (§490) and no automation; the imp twin
// was normalized onto the LIVE MA-0658/MA-0919 monster_self_buff seam by
// MA-1019. This mirrors that fix byte-for-byte: automation:{type:
// "monster_self_buff", effect:"invisible", rounds:600} + spellcasting_ability:
// "Charisma", with the attack_bonus/save_dc/save_type/save_effect/range/
// reach/recharge junk stripped exactly as the imp twin does. RAW innate at
// will → NO uses/maxUses (MA-0020 gate honestly null, §230); the only gate is
// the already-active te refusal (`invisibility_refused` / already_invisible,
// slug from the ACTION NAME). Chip click = SelfBuffLink (fa-eye-slash) →
// resolveMonsterSelfBuffRow grants te `invisible` ON SELF + ONE merged
// rounds:600 addExpiration clock + `invisible_granted` log + popup;
// endSelfBuffOnTrigger (attack/cast seams) drops the te early with
// `invisible_ended` — Rend is the quasit's attack-ender trigger row.
// Concentration-break ender and invisibility advantage adjudication stay §70
// advisory — same residual as the imp/duergar/green-hag twins.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  selfBuffRounds,
  buildSelfBuffGrantLog,
  buildSelfBuffPopup,
  endSelfBuffOnTrigger,
} from './monsterSelfBuff.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
import { getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
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

const quasit = monstersData.find(m => m.index === 'quasit');
const imp = monstersData.find(m => m.index === 'imp');
const duergar = monstersData.find(m => m.index === 'duergar');
const greenHag = monstersData.find(m => m.index === 'green-hag');
const INVIS_ROW = quasit.actions.find(a => a.name === 'Invisibility');
const REND_ROW = quasit.actions[0];
const IMP_INVIS_ROW = imp.actions.find(a => a.name === 'Invisibility');
const DUERGAR_INVIS_ROW = duergar.actions.find(a => a.name === 'Invisibility');
const HAG_PASSAGE_ROW = greenHag.actions.find(a => a.name === 'Invisible Passage');
const QUASIT_INVIS_DESC = 'The quasit casts <strong>Invisibility</strong> on itself, requiring no spell components and using Charisma as the spellcasting ability.';

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
      if (propertyName === 'pendingExpirations' && characterKey === 'Quasit 1') return expirations;
      return undefined;
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { writes.push({ characterKey, propertyName, value }); }),
    addEntry: vi.fn((campaignName, entry) => { logs.push(entry); return Promise.resolve(); }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-1369 Quasit Invisibility disk data — imp MA-1019 twin byte-shape', () => {
  it('quasit actions[1] authors monster_self_buff automation, description byte-unchanged, no uses (At Will)', () => {
    expect(INVIS_ROW.name).toBe('Invisibility');
    expect(INVIS_ROW.description).toBe(QUASIT_INVIS_DESC);
    expect(INVIS_ROW.spellcasting_ability).toBe('Charisma');
    expect(INVIS_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'invisible', rounds: 600 });
    expect(isMonsterSelfBuffRow(INVIS_ROW)).toBe(true);
    expect(selfBuffRounds(INVIS_ROW)).toBe(600);
    // RAW innate at will → no uses limit authored → gate stays honestly null (§230).
    expect(INVIS_ROW.uses).toBeUndefined();
    expect(INVIS_ROW.maxUses).toBeUndefined();
    expect(INVIS_ROW.usage).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(INVIS_ROW, {})).toBeNull();
  });

  it('junk noise stripped: attack_bonus/save_dc/save_type/save_effect/range/reach/recharge all GONE (§490)', () => {
    for (const key of ['attack_bonus', 'save_dc', 'save_type', 'save_effect', 'range', 'reach', 'recharge']) {
      expect(INVIS_ROW[key]).toBeUndefined();
    }
    expect(Object.keys(INVIS_ROW)).toEqual(['name', 'description', 'spellcasting_ability', 'automation']);
  });

  it('key set/order + automation are byte-identical to the imp twin, duergar + green-hag twins', () => {
    expect(Object.keys(INVIS_ROW)).toEqual(Object.keys(IMP_INVIS_ROW));
    expect(INVIS_ROW.automation).toEqual(IMP_INVIS_ROW.automation);
    expect(INVIS_ROW.automation).toEqual(DUERGAR_INVIS_ROW.automation);
    expect(INVIS_ROW.automation).toEqual(HAG_PASSAGE_ROW.automation);
  });

  it('Rend stays inert to self-buff; Shape-Shift rides its own lane, never self-buff', () => {
    expect(REND_ROW.automation).toBeUndefined();
    expect(isMonsterSelfBuffRow(REND_ROW)).toBe(false);
    expect(isMonsterSelfBuffRow(quasit.actions.find(a => a.name === 'Shape-Shift'))).toBe(false);
  });

  it('te `invisible` is the registered self-buff key (eye-slash, buff, Spells group)', () => {
    const def = getEffectDefinition('invisible');
    expect(def).toBeDefined();
    expect(def.effect).toBe('invisible');
    expect(def.icon).toBe('fa-eye-slash');
    expect(def.cls).toBe('effect-buff');
    expect(def.description).toMatch(/turns invisible/i);
    expect(def.description).toMatch(/§70/);
  });
});

describe('MA-1369 grant flow (At Will, zero spend) — resolveMonsterSelfBuffRow arms te invisible on self', () => {
  it('first click: no gate/no ability_use spend, registers te invisible on self, ONE merged rounds:600 clock, grant log + popup', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
      monsterName: 'Quasit 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.effectKey).toBe('invisible');
    expect(result.remaining).toBeNull();
    expect(deps.store.uses).toEqual({});
    expect(deps.store.logs.some(e => e.type === 'ability_use')).toBe(false);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Quasit 1', 'invisible', 'Quasit 1', expect.objectContaining({ rounds: 600 }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Quasit 1',
      targetName: 'Quasit 1',
      campaignName: 'test-campaign',
      rounds: 600,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Quasit 1', target: 'Quasit 1' }],
    });
    const grant = deps.store.logs.find(e => e.automationType === 'invisible_granted');
    expect(grant).toBeTruthy();
    expect(grant.characterName).toBe('Quasit 1');
    expect(grant.abilityName).toBe('Invisibility');
    expect(grant.description).toContain('600 rounds (1 hour)');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('turns invisible'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('te `invisible` armed'));
  });

  it('grant + popup copy ride the existing invisibility branch — acceptable twin copy, no new effect key', () => {
    const grant = buildSelfBuffGrantLog({ monsterName: 'Quasit 1', action: INVIS_ROW, effectKey: 'invisible', rounds: 600 });
    expect(grant.description).toContain('ends when it attacks, casts a spell');
    expect(grant.description).toContain('§70');
    const popup = buildSelfBuffPopup({ monsterName: 'Quasit 1', action: INVIS_ROW, effectKey: 'invisible', rounds: 600, remaining: null });
    expect(popup).toContain('Quasit 1 is Invisible');
    expect(popup).toContain('turns invisible');
    // At Will, no uses authored → no uses counter in the popup (§230).
    expect(popup).not.toContain('use(s) left');
  });

  it('refire while active: already invisible refuses zero-spend, zero te, zero clock — invisibility_refused / already_invisible', async () => {
    const deps = makeDeps({ activeTe: { target: 'Quasit 1', effect: 'invisible', source: 'Quasit 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
      monsterName: 'Quasit 1',
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
    const refusal = deps.store.logs.find(e => e.automationType === 'invisibility_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.automationDetail).toBe('already_invisible');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Already Invisible'));
  });

  it('at-will refire after the te drops re-grants honestly with zero spend (ungated §230)', async () => {
    const deps = makeDeps();
    const first = await resolveMonsterSelfBuffRow({ action: INVIS_ROW, monsterName: 'Quasit 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), storedUses: {}, deps });
    expect(first.resolved).toBe(true);
    const deps2 = makeDeps();
    const second = await resolveMonsterSelfBuffRow({ action: INVIS_ROW, monsterName: 'Quasit 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), storedUses: {}, deps: deps2 });
    expect(second.resolved).toBe(true);
    expect(second.remaining).toBeNull();
    expect(deps2.store.logs.some(e => e.type === 'ability_use')).toBe(false);
    expect(deps2.registerTargetEffect).toHaveBeenCalledTimes(1);
  });
});

describe('MA-1369 enders live — Rend attack / cast drop the self te early', () => {
  it('Rend attack trigger: drops te invisible, cancels merged clock, logs invisible_ended/ends_on_attack', async () => {
    const deps = makeEnderDeps({
      targetEffects: [
        { target: 'Quasit 1', effect: 'invisible', source: 'Quasit 1' },
        { target: 'Bandit 1', effect: 'bless', source: 'Cleric' },
      ],
      expirations: [
        { target: 'Quasit 1', effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Quasit 1', target: 'Quasit 1' }], appliedRound: 1, expiryRounds: 600 },
      ],
    });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: 'Quasit 1', effectKey: 'invisible', trigger: 'attack', actionName: 'Rend', deps });
    expect(dropped).toBe(true);
    const teWrite = deps.writes.find(w => w.propertyName === 'targetEffects');
    expect(teWrite.characterKey).toBe('campaign');
    expect(teWrite.value).toHaveLength(1);
    expect(teWrite.value[0].effect).toBe('bless');
    const expWrite = deps.writes.find(w => w.propertyName === 'pendingExpirations');
    expect(expWrite.characterKey).toBe('Quasit 1');
    expect(expWrite.value).toHaveLength(0);
    expect(deps.logs[0].automationType).toBe('invisible_ended');
    expect(deps.logs[0].automationDetail).toBe('ends_on_attack');
    expect(deps.logs[0].characterName).toBe('Quasit 1');
  });

  it('inert without a SELF-origin te: zero write, zero log', async () => {
    const deps = makeEnderDeps({ targetEffects: [{ target: 'Quasit 1', effect: 'invisible', source: 'Imp 1' }] });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: 'Quasit 1', effectKey: 'invisible', trigger: 'attack', actionName: 'Rend', deps });
    expect(dropped).toBe(false);
    expect(deps.writes).toHaveLength(0);
    expect(deps.logs).toHaveLength(0);
  });
});
