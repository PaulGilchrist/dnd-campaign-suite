// MA-1522: Sprite "Invisibility" (sprite|actions|3) — formerly a plain-text
// inert row (name + description ONLY, zero affordance; §60/§114 inert-row
// fingerprint, unarmed per the MA-1369 invisibility census). NOW normalized
// onto the LIVE MA-1019 imp byte-shape: description gains the
// <strong>Invisibility</strong> markup wrap + spellcasting_ability:
// "Charisma" + automation:{type:"monster_self_buff", effect:"invisible",
// rounds:600} — key order byte-identical to the imp twin and the duergar/
// green-hag twins. Rounds pin: RAW innate at will with NO listed duration
// ("until concentration breaks" is the §70 advisory residual) — the 600-round
// backstop mirrors the imp/duergar/green-hag convention (§37 hours×600);
// the real enders are the live attack/cast seams (MonsterCardModal
// endSelfBuffOnTrigger). RAW innate at will → NO uses/maxUses: MA-0020 gate
// stays honestly null (At Will ungated §230); the only gate is the
// already-active te refusal (`invisibility_refused` / already_invisible, slug
// from the ACTION NAME). Chip click = SelfBuffLink (fa-eye-slash) →
// resolveMonsterSelfBuffRow grants te `invisible` ON SELF + ONE merged
// rounds:600 addExpiration clock + `invisible_granted` log + popup;
// endSelfBuffOnTrigger drops the te early with `invisible_ended` /
// ends_on_attack — Needle Sword is the sprite's attack-ender trigger row.
// Sprite carries NO Concentration trait on disk and concentration-break
// ender + invisibility advantage adjudication stay §70 advisory — same
// residual as the imp/quasit/duergar/green-hag twins.
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

const sprite = monstersData.find(m => m.index === 'sprite');
const imp = monstersData.find(m => m.index === 'imp');
const duergar = monstersData.find(m => m.index === 'duergar');
const greenHag = monstersData.find(m => m.index === 'green-hag');
const INVIS_ROW = sprite.actions[3];
const NEEDLE_ROW = sprite.actions.find(a => a.name === 'Needle Sword');
const ENCHANTING_ROW = sprite.actions.find(a => a.name === 'Enchanting Bow');
const HEART_SIGHT_ROW = sprite.actions.find(a => a.name === 'Heart Sight');
const IMP_INVIS_ROW = imp.actions.find(a => a.name === 'Invisibility');
const DUERGAR_INVIS_ROW = duergar.actions.find(a => a.name === 'Invisibility');
const HAG_PASSAGE_ROW = greenHag.actions.find(a => a.name === 'Invisible Passage');
const SPRITE_INVIS_DESC = 'The sprite casts <strong>Invisibility</strong> on itself, requiring no spell components and using Charisma as the spellcasting ability.';

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
      if (propertyName === 'pendingExpirations' && characterKey === 'Sprite 1') return expirations;
      return undefined;
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { writes.push({ characterKey, propertyName, value }); }),
    addEntry: vi.fn((campaignName, entry) => { logs.push(entry); return Promise.resolve(); }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-1522 Sprite Invisibility disk data — imp MA-1019 twin byte-shape', () => {
  it('sprite actions[3] is the Invisibility row with markup wrap + spellcasting_ability + self-buff automation, no uses (At Will)', () => {
    expect(sprite.actions[3].name).toBe('Invisibility');
    expect(INVIS_ROW.description).toBe(SPRITE_INVIS_DESC);
    expect(INVIS_ROW.description).toContain('<strong>Invisibility</strong>');
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

  it('key set/order byte-identical to the imp twin; automation identical to imp/duergar/green-hag twins', () => {
    expect(Object.keys(INVIS_ROW)).toEqual(['name', 'description', 'spellcasting_ability', 'automation']);
    expect(Object.keys(INVIS_ROW)).toEqual(Object.keys(IMP_INVIS_ROW));
    expect(INVIS_ROW.automation).toEqual(IMP_INVIS_ROW.automation);
    expect(INVIS_ROW.automation).toEqual(DUERGAR_INVIS_ROW.automation);
    expect(INVIS_ROW.automation).toEqual(HAG_PASSAGE_ROW.automation);
  });

  it('zero junk noise on the row: attack_bonus/save_dc/save_type/save_effect/range/reach/recharge all absent (§490)', () => {
    for (const key of ['attack_bonus', 'save_dc', 'save_type', 'save_effect', 'range', 'reach', 'recharge']) {
      expect(INVIS_ROW[key]).toBeUndefined();
    }
  });

  it('Needle Sword / Enchanting Bow / Heart Sight stay inert to self-buff (discriminator)', () => {
    expect(NEEDLE_ROW.automation).toBeUndefined();
    expect(isMonsterSelfBuffRow(NEEDLE_ROW)).toBe(false);
    expect(ENCHANTING_ROW.automation).toBeUndefined();
    expect(isMonsterSelfBuffRow(ENCHANTING_ROW)).toBe(false);
    expect(HEART_SIGHT_ROW.automation).toBeUndefined();
    expect(isMonsterSelfBuffRow(HEART_SIGHT_ROW)).toBe(false);
  });

  it('te `invisible` is the registered self-buff key (eye-slash, buff)', () => {
    const def = getEffectDefinition('invisible');
    expect(def).toBeDefined();
    expect(def.effect).toBe('invisible');
    expect(def.icon).toBe('fa-eye-slash');
    expect(def.cls).toBe('effect-buff');
    expect(def.description).toMatch(/turns invisible/i);
    expect(def.description).toMatch(/§70/);
  });
});

describe('MA-1522 grant flow (At Will, zero spend) — resolveMonsterSelfBuffRow arms te invisible on self', () => {
  it('first click: no gate/no ability_use spend, registers te invisible on self, ONE merged rounds:600 clock, grant log + popup', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
      monsterName: 'Sprite 1',
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
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Sprite 1', 'invisible', 'Sprite 1', expect.objectContaining({ rounds: 600 }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Sprite 1',
      targetName: 'Sprite 1',
      campaignName: 'test-campaign',
      rounds: 600,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Sprite 1', target: 'Sprite 1' }],
    });
    const grant = deps.store.logs.find(e => e.automationType === 'invisible_granted');
    expect(grant).toBeTruthy();
    expect(grant.characterName).toBe('Sprite 1');
    expect(grant.abilityName).toBe('Invisibility');
    expect(grant.description).toContain('600 rounds (1 hour)');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('turns invisible'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('te `invisible` armed'));
  });

  it('grant + popup copy ride the existing invisibility branch — acceptable twin copy, no new effect key', () => {
    const grant = buildSelfBuffGrantLog({ monsterName: 'Sprite 1', action: INVIS_ROW, effectKey: 'invisible', rounds: 600 });
    expect(grant.description).toContain('ends when it attacks, casts a spell');
    expect(grant.description).toContain('§70');
    const popup = buildSelfBuffPopup({ monsterName: 'Sprite 1', action: INVIS_ROW, effectKey: 'invisible', rounds: 600, remaining: null });
    expect(popup).toContain('Sprite 1 is Invisible');
    expect(popup).toContain('turns invisible');
    // At Will, no uses authored → no uses counter in the popup (§230).
    expect(popup).not.toContain('use(s) left');
  });

  it('refire while active: already invisible refuses zero-spend, zero te, zero clock — invisibility_refused / already_invisible', async () => {
    const deps = makeDeps({ activeTe: { target: 'Sprite 1', effect: 'invisible', source: 'Sprite 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
      monsterName: 'Sprite 1',
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
    const first = await resolveMonsterSelfBuffRow({ action: INVIS_ROW, monsterName: 'Sprite 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), storedUses: {}, deps });
    expect(first.resolved).toBe(true);
    const deps2 = makeDeps();
    const second = await resolveMonsterSelfBuffRow({ action: INVIS_ROW, monsterName: 'Sprite 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), storedUses: {}, deps: deps2 });
    expect(second.resolved).toBe(true);
    expect(second.remaining).toBeNull();
    expect(deps2.store.logs.some(e => e.type === 'ability_use')).toBe(false);
    expect(deps2.registerTargetEffect).toHaveBeenCalledTimes(1);
  });
});

describe('MA-1522 enders live — Needle Sword attack / cast drop the self te early', () => {
  it('Needle Sword attack trigger: drops te invisible, cancels merged clock, logs invisible_ended/ends_on_attack', async () => {
    const deps = makeEnderDeps({
      targetEffects: [
        { target: 'Sprite 1', effect: 'invisible', source: 'Sprite 1' },
        { target: 'Bandit 1', effect: 'bless', source: 'Cleric' },
      ],
      expirations: [
        { target: 'Sprite 1', effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Sprite 1', target: 'Sprite 1' }], appliedRound: 1, expiryRounds: 600 },
      ],
    });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: 'Sprite 1', effectKey: 'invisible', trigger: 'attack', actionName: 'Needle Sword', deps });
    expect(dropped).toBe(true);
    const teWrite = deps.writes.find(w => w.propertyName === 'targetEffects');
    expect(teWrite.characterKey).toBe('campaign');
    expect(teWrite.value).toHaveLength(1);
    expect(teWrite.value[0].effect).toBe('bless');
    const expWrite = deps.writes.find(w => w.propertyName === 'pendingExpirations');
    expect(expWrite.characterKey).toBe('Sprite 1');
    expect(expWrite.value).toHaveLength(0);
    expect(deps.logs[0].automationType).toBe('invisible_ended');
    expect(deps.logs[0].automationDetail).toBe('ends_on_attack');
    expect(deps.logs[0].characterName).toBe('Sprite 1');
  });

  it('inert without a SELF-origin te: zero write, zero log', async () => {
    const deps = makeEnderDeps({ targetEffects: [{ target: 'Sprite 1', effect: 'invisible', source: 'Imp 1' }] });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: 'Sprite 1', effectKey: 'invisible', trigger: 'attack', actionName: 'Needle Sword', deps });
    expect(dropped).toBe(false);
    expect(deps.writes).toHaveLength(0);
    expect(deps.logs).toHaveLength(0);
  });
});
