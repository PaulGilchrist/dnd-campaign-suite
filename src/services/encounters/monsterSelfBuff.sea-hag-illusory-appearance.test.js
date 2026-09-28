// MA-1449: Sea Hag "Illusory Appearance" — formerly a FAIL(a) MISROUTE row:
// the caster's "spell save DC 13" (a CON caster stat) was transcribed into
// row-level save_dc/save_type, arming a real "DC 13 Constitution" chip that
// FORCED a saving throw on the armed target and paid NOTHING (save_effect ""
// → saveConditions []), while the disguise itself was never granted. Disguise
// Self is a save-less SELF cast. Fix: strip save_dc/save_type/attack_bonus
// (keys DELETED, Imp MA-1019 twin = key absent) + author
// automation:{type:"monster_self_buff", effect:"disguised", rounds:14400}
// (24 hours §37 hours×600) — the row rides the live MA-0655/0658/0780
// monsterSelfBuff seam with ZERO new chip-route code. RAW has NO uses limit →
// no uses/maxUses → MA-0020 gate honestly null (At Will ungated §57); the
// already-active te refusal (`illusory_appearance_refused` slug from the
// ACTION NAME / automationDetail `already_disguised` from the EFFECT KEY,
// §278 pin-both) is the only gate. No attack/cast enders — RAW the disguise
// lasts the full duration (invisible-only enders stay byte-untouched).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  buildSelfBuffGrantLog,
  buildSelfBuffPopup,
  buildAlreadyEnlargedRefusalLog,
  buildAlreadyEnlargedRefusalPopup,
  selfBuffRounds,
} from './monsterSelfBuff.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
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

const seaHag = monstersData.find(m => m.index === 'sea-hag');
const ILLUSORY_ROW = seaHag.actions[2];
const ILLUSORY_DESC = "The hag casts <strong>Disguise Self</strong>, using Constitution as the spellcasting ability (spell save DC 13). The spell's duration is 24 hours.";

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

describe('MA-1449 Illusory Appearance disk data shape', () => {
  it('sea-hag actions[2]: save_dc/save_type/attack_bonus KEYS DELETED, automation byte-shape, name/description byte-preserved, no uses (At Will)', () => {
    expect(ILLUSORY_ROW.name).toBe('Illusory Appearance');
    expect(ILLUSORY_ROW.description).toBe(ILLUSORY_DESC);
    expect('save_dc' in ILLUSORY_ROW).toBe(false);
    expect('save_type' in ILLUSORY_ROW).toBe(false);
    expect('attack_bonus' in ILLUSORY_ROW).toBe(false);
    expect(ILLUSORY_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'disguised', rounds: 14400 });
    expect(isMonsterSelfBuffRow(ILLUSORY_ROW)).toBe(true);
    expect(selfBuffRounds(ILLUSORY_ROW)).toBe(14400);
    // RAW: no uses limit on this stat block → gate stays honestly null.
    expect(ILLUSORY_ROW.uses).toBeUndefined();
    expect(ILLUSORY_ROW.maxUses).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(ILLUSORY_ROW, {})).toBeNull();
  });
});

describe('MA-1449 te `disguised` registry', () => {
  it('registered exactly once, Spells group (MA-0780 ghost precedent), buff badge, save-less truth in description', () => {
    const def = getEffectDefinition('disguised');
    expect(def).toBeDefined();
    expect(def.label).toBe('Disguised');
    expect(def.icon).toBe('fa-user-secret');
    expect(def.cls).toBe('effect-buff');
    expect(def.group).toBe('Spells');
    expect(def.fields).toEqual(['source']);
    expect(TARGET_EFFECT_DEFINITIONS.filter(d => d.effect === 'disguised')).toHaveLength(1);
    expect(def.description).toMatch(/Disguise Self/i);
    expect(def.description).toMatch(/not a target save/i);
    expect(def.description).toMatch(/GM-enforced/);
    expect(def.description).toMatch(/§70/);
  });
});

describe('MA-1449 Illusory Appearance grant flow (At Will, no spend)', () => {
  it('first click: NO gate/no ability_use spend, registers te disguised on self, ONE merged rounds:14400 clock, grant log + popup', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ILLUSORY_ROW,
      monsterName: 'Sea Hag 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.effectKey).toBe('disguised');
    expect(result.remaining).toBeNull();
    expect(deps.store.uses).toEqual({});
    expect(deps.store.logs.some(e => e.type === 'ability_use')).toBe(false);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Sea Hag 1', 'disguised', 'Sea Hag 1', expect.objectContaining({ rounds: 14400 }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Sea Hag 1',
      targetName: 'Sea Hag 1',
      campaignName: 'test-campaign',
      rounds: 14400,
      effects: [{ type: 'remove_target_effect', effectKey: 'disguised', source: 'Sea Hag 1', target: 'Sea Hag 1' }],
    });
    const grant = deps.store.logs.find(e => e.automationType === 'disguised_granted');
    expect(grant).toBeTruthy();
    expect(grant.characterName).toBe('Sea Hag 1');
    expect(grant.abilityName).toBe('Illusory Appearance');
    expect(grant.description).toContain('14400 rounds (24 hours)');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Sea Hag 1 is Disguised'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('no one rolls a save'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('At Will'));
  });

  it('grant prose is disguised-specific — never the invisibility else-branch copy (§278)', () => {
    const grant = buildSelfBuffGrantLog({ monsterName: 'Sea Hag', action: ILLUSORY_ROW, effectKey: 'disguised', rounds: 14400 });
    expect(grant.description).toContain('Disguise Self');
    expect(grant.description).toContain("is the hag's caster stat");
    expect(grant.description).toContain('§70');
    expect(grant.description).not.toContain('turns invisible');
    expect(grant.description).not.toContain('ends when it attacks');
    expect(grant.description).not.toContain('Border Ethereal');
    expect(grant.description).not.toContain('doubled');
  });

  it('popup prose is disguised-specific too', () => {
    const popup = buildSelfBuffPopup({ monsterName: 'Sea Hag 1', action: ILLUSORY_ROW, effectKey: 'disguised', rounds: 14400, remaining: null });
    expect(popup).toContain('Disguise Self');
    expect(popup).toContain('14400 rounds (24 hours)');
    expect(popup).not.toContain('turns invisible');
    expect(popup).not.toContain('Border Ethereal');
  });

  it('already disguised: refuses zero-spend, zero te, zero clock, illusory_appearance_refused + already_disguised', async () => {
    const deps = makeDeps({ activeTe: { target: 'Sea Hag 1', effect: 'disguised', source: 'Sea Hag 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ILLUSORY_ROW,
      monsterName: 'Sea Hag 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'already-active' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    const refusal = deps.store.logs.find(e => e.automationType === 'illusory_appearance_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.automationDetail).toBe('already_disguised');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Already Disguised'));
    expect(buildAlreadyEnlargedRefusalPopup({ monsterName: 'Sea Hag 1', action: ILLUSORY_ROW, effectKey: 'disguised' })).toContain('already disguised');
    expect(buildAlreadyEnlargedRefusalLog({ monsterName: 'Sea Hag', action: ILLUSORY_ROW, effectKey: 'disguised' }).description).toContain('zero use spent');
  });

  it('no attack/cast enders for disguised — endSelfBuffOnTrigger seams stay invisible-only (RAW full duration)', async () => {
    // The MA-0658 ender call sites in MonsterCardModal hardcode effectKey
    // 'invisible'; DISGUISED must never be dropped early there. Static pin:
    // the resolver only auto-ends OTHER te when granting `enlarged`.
    const deps = makeDeps();
    await resolveMonsterSelfBuffRow({
      action: ILLUSORY_ROW,
      monsterName: 'Sea Hag 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: {},
      deps,
    });
    // store untouched beyond the self te + clock — no foreign te removal writes
    expect(deps.store.te.effect).toBe('disguised');
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
  });

  it('enlarged/invisible/ethereal twins keep their byte-identical grant copy (no branch bleed)', () => {
    const duergar = monstersData.find(m => m.index === 'duergar');
    const ghost = monstersData.find(m => m.index === 'ghost');
    const enlargeRow = duergar.actions.find(a => a.name === 'Enlarge');
    const invisRow = duergar.actions.find(a => a.name === 'Invisibility');
    const etherealRow = ghost.actions.find(a => a.name === 'Ethereality');
    const enlargeGrant = buildSelfBuffGrantLog({ monsterName: 'Duergar', action: enlargeRow, effectKey: 'enlarged', rounds: 10 });
    expect(enlargeGrant.description).toContain('for 10 rounds (1 minute) — damage dice on Strength-based weapon attacks doubled');
    const invisGrant = buildSelfBuffGrantLog({ monsterName: 'Duergar', action: invisRow, effectKey: 'invisible', rounds: 600 });
    expect(invisGrant.description).toContain('600 rounds (1 hour)');
    expect(invisGrant.description).toContain('ends when it attacks, casts a spell, or uses its Enlarge');
    const etherealGrant = buildSelfBuffGrantLog({ monsterName: 'Ghost', action: etherealRow, effectKey: 'ethereal', rounds: 4800 });
    expect(etherealGrant.description).toContain('Border Ethereal');
    expect(etherealGrant.description).not.toContain('Disguise Self');
    // popup twins
    const invisPopup = buildSelfBuffPopup({ monsterName: 'Duergar', action: invisRow, effectKey: 'invisible', rounds: 600, remaining: 0 });
    expect(invisPopup).toContain('turns invisible');
    expect(invisPopup).not.toContain('Disguise Self');
    const etherealPopup = buildSelfBuffPopup({ monsterName: 'Ghost', action: etherealRow, effectKey: 'ethereal', rounds: 4800, remaining: null });
    expect(etherealPopup).toContain('Border Ethereal');
    expect(etherealPopup).not.toContain('Disguise Self');
  });
});
