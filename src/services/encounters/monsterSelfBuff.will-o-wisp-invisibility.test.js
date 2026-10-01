// MA-1720: Will-o'-Wisp "Invisibility" (will-o-wisp|actions|1) — formerly a
// prose-only inert row (name + description ONLY, zero affordance; §60/§114
// inert-row fingerprint — SelfBuffLink short-circuits without the structured
// automation key, MonsterAction.jsx:255-256). NOW normalized onto the LIVE
// MA-1019 imp / MA-1522 sprite byte-shape automation:{type:"monster_self_buff",
// effect:"invisible", rounds:600} — automation dict byte-identical to the
// sprite/imp/duergar/green-hag twins. The wisp description stays byte-unchanged
// (no <strong> wrap, no spellcasting_ability: the resolver never reads them —
// §203 grep-zero consumers; the row is innate magic, not a spell cast).
// Rounds pin: RAW "until it attacks or uses its Consume Life, or until its
// concentration ends" with NO listed duration — the 600-round backstop mirrors
// the sprite/imp/duergar/green-hag convention (§37 hours×600); the live enders
// are the attack/cast seams (MonsterCardModal endSelfBuffOnTrigger :2105/:2255).
// Consume Life is a bonus-action TRAIT (traits[], not actions[]) — no chip, no
// consumer: Consume-Life / concentration-break enders stay §70 advisory — same
// residual as the sprite/imp twins. RAW innate at will → NO uses/maxUses:
// MA-0020 gate stays honestly null (At Will ungated §230); the only gate is the
// already-active te refusal (`invisibility_refused` / already_invisible, slug
// from the ACTION NAME). Chip click = SelfBuffLink (fa-eye-slash) →
// resolveMonsterSelfBuffRow grants te `invisible` ON SELF + ONE merged
// rounds:600 addExpiration clock + `invisible_granted` log + popup.
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

const wisp = monstersData.find(m => m.index === 'will-o-wisp');
const sprite = monstersData.find(m => m.index === 'sprite');
const imp = monstersData.find(m => m.index === 'imp');
const duergar = monstersData.find(m => m.index === 'duergar');
const INVIS_ROW = wisp.actions[1];
const SHOCK_ROW = wisp.actions.find(a => a.name === 'Shock');
const SPRITE_INVIS_ROW = sprite.actions.find(a => a.name === 'Invisibility');
const IMP_INVIS_ROW = imp.actions.find(a => a.name === 'Invisibility');
const DUERGAR_INVIS_ROW = duergar.actions.find(a => a.name === 'Invisibility');
const WISP_INVIS_DESC = "The will-o'-wisp and its light magically become invisible until it attacks or uses its Consume Life, or until its concentration ends (as if concentrating on a spell).";

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
      if (propertyName === 'pendingExpirations' && characterKey === "Will-o'-Wisp 1") return expirations;
      return undefined;
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { writes.push({ characterKey, propertyName, value }); }),
    addEntry: vi.fn((campaignName, entry) => { logs.push(entry); return Promise.resolve(); }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-1720 Will-o\'-Wisp Invisibility disk data — sprite/imp MA-1522/MA-1019 twin automation', () => {
  it('wisp actions[1] is the Invisibility row with self-buff automation, description byte-unchanged, no uses (At Will)', () => {
    expect(wisp.actions[1].name).toBe('Invisibility');
    expect(INVIS_ROW.description).toBe(WISP_INVIS_DESC);
    expect(INVIS_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'invisible', rounds: 600 });
    expect(isMonsterSelfBuffRow(INVIS_ROW)).toBe(true);
    expect(selfBuffRounds(INVIS_ROW)).toBe(600);
    // RAW innate at will → no uses limit authored → gate stays honestly null (§230).
    expect(INVIS_ROW.uses).toBeUndefined();
    expect(INVIS_ROW.maxUses).toBeUndefined();
    expect(INVIS_ROW.usage).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(INVIS_ROW, {})).toBeNull();
  });

  it('automation dict byte-identical to the sprite/imp/duergar twins', () => {
    expect(INVIS_ROW.automation).toEqual(SPRITE_INVIS_ROW.automation);
    expect(INVIS_ROW.automation).toEqual(IMP_INVIS_ROW.automation);
    expect(INVIS_ROW.automation).toEqual(DUERGAR_INVIS_ROW.automation);
  });

  it('row gains ONLY automation — no spellcasting_ability / markup / junk noise (§203 grep-zero consumers)', () => {
    expect(INVIS_ROW.description).not.toContain('<strong>');
    expect(INVIS_ROW.spellcasting_ability).toBeUndefined();
    expect(Object.keys(INVIS_ROW)).toEqual(['name', 'description', 'automation']);
    for (const key of ['attack_bonus', 'save_dc', 'save_type', 'save_effect', 'range', 'reach', 'recharge']) {
      expect(INVIS_ROW[key]).toBeUndefined();
    }
  });

  it('Shock stays an attack row inert to self-buff; Consume Life lives in traits[] (no chip, §70 advisory ender)', () => {
    expect(SHOCK_ROW.automation).toBeUndefined();
    expect(isMonsterSelfBuffRow(SHOCK_ROW)).toBe(false);
    expect(wisp.actions.every(a => a === INVIS_ROW || !isMonsterSelfBuffRow(a))).toBe(true);
    const consumeLife = wisp.traits.find(t => t.name === 'Consume Life');
    expect(consumeLife).toBeDefined();
    expect(consumeLife.automation).toBeUndefined();
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

describe('MA-1720 grant flow (At Will, zero spend) — resolveMonsterSelfBuffRow arms te invisible on self', () => {
  it('first click: no gate/no ability_use spend, registers te invisible on self, ONE merged rounds:600 clock, grant log + popup', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
      monsterName: "Will-o'-Wisp 1",
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
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', "Will-o'-Wisp 1", 'invisible', "Will-o'-Wisp 1", expect.objectContaining({ rounds: 600 }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: "Will-o'-Wisp 1",
      targetName: "Will-o'-Wisp 1",
      campaignName: 'test-campaign',
      rounds: 600,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: "Will-o'-Wisp 1", target: "Will-o'-Wisp 1" }],
    });
    const grant = deps.store.logs.find(e => e.automationType === 'invisible_granted');
    expect(grant).toBeTruthy();
    expect(grant.characterName).toBe("Will-o'-Wisp 1");
    expect(grant.abilityName).toBe('Invisibility');
    expect(grant.description).toContain('600 rounds (1 hour)');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('turns invisible'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('te `invisible` armed'));
  });

  it('grant + popup copy ride the existing invisibility branch — twin copy, no new effect key', () => {
    const grant = buildSelfBuffGrantLog({ monsterName: "Will-o'-Wisp 1", action: INVIS_ROW, effectKey: 'invisible', rounds: 600 });
    expect(grant.description).toContain('ends when it attacks, casts a spell');
    expect(grant.description).toContain('§70');
    const popup = buildSelfBuffPopup({ monsterName: "Will-o'-Wisp 1", action: INVIS_ROW, effectKey: 'invisible', rounds: 600, remaining: null });
    expect(popup).toContain("Will-o'-Wisp 1 is Invisible");
    expect(popup).toContain('turns invisible');
    // At Will, no uses authored → no uses counter in the popup (§230).
    expect(popup).not.toContain('use(s) left');
  });

  it('refire while active: already invisible refuses zero-spend, zero te, zero clock — invisibility_refused / already_invisible', async () => {
    const deps = makeDeps({ activeTe: { target: "Will-o'-Wisp 1", effect: 'invisible', source: "Will-o'-Wisp 1" } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
      monsterName: "Will-o'-Wisp 1",
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

  it('resolver refuses unstructured rows with not-self-buff (renderer short-circuit proof)', () => {
    const raw = { name: 'Invisibility', description: WISP_INVIS_DESC };
    expect(isMonsterSelfBuffRow(raw)).toBe(false);
    return expect(resolveMonsterSelfBuffRow({ action: raw, monsterName: "Will-o'-Wisp 1", campaignName: 'test-campaign', setPopupHtml: vi.fn(), deps: makeDeps() })).resolves.toEqual({ resolved: false, reason: 'not-self-buff' });
  });
});

describe('MA-1720 enders live — Shock attack drops the self te early', () => {
  it('attack trigger: drops te invisible, cancels merged clock, logs invisible_ended/ends_on_attack', async () => {
    const deps = makeEnderDeps({
      targetEffects: [
        { target: "Will-o'-Wisp 1", effect: 'invisible', source: "Will-o'-Wisp 1" },
        { target: 'Bandit 1', effect: 'bless', source: 'Cleric' },
      ],
      expirations: [
        { target: "Will-o'-Wisp 1", effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: "Will-o'-Wisp 1", target: "Will-o'-Wisp 1" }], appliedRound: 1, expiryRounds: 600 },
      ],
    });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: "Will-o'-Wisp 1", effectKey: 'invisible', trigger: 'attack', actionName: 'Shock', deps });
    expect(dropped).toBe(true);
    const teWrite = deps.writes.find(w => w.propertyName === 'targetEffects');
    expect(teWrite.characterKey).toBe('campaign');
    expect(teWrite.value).toHaveLength(1);
    expect(teWrite.value[0].effect).toBe('bless');
    const expWrite = deps.writes.find(w => w.propertyName === 'pendingExpirations');
    expect(expWrite.characterKey).toBe("Will-o'-Wisp 1");
    expect(expWrite.value).toHaveLength(0);
    expect(deps.logs[0].automationType).toBe('invisible_ended');
    expect(deps.logs[0].automationDetail).toBe('ends_on_attack');
    expect(deps.logs[0].characterName).toBe("Will-o'-Wisp 1");
  });

  it('inert without a SELF-origin te: zero write, zero log', async () => {
    const deps = makeEnderDeps({ targetEffects: [{ target: "Will-o'-Wisp 1", effect: 'invisible', source: 'Sprite 1' }] });
    const dropped = await endSelfBuffOnTrigger({ campaignName: 'test-campaign', monsterName: "Will-o'-Wisp 1", effectKey: 'invisible', trigger: 'attack', actionName: 'Shock', deps });
    expect(dropped).toBe(false);
    expect(deps.writes).toHaveLength(0);
    expect(deps.logs).toHaveLength(0);
  });
});
