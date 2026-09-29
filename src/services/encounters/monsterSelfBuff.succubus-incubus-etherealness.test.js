// MA-1551: Succubus/Incubus "Etherealness" — formerly a zero-affordance
// plain-bold row (name+description only, all chip gates key off structured
// fields; exact MA-0780 Ghost Ethereality pre-fix twin). NOW rides the SAME
// MA-0655/0780 monster_self_buff seam: automation:{type:"monster_self_buff",
// effect:"ethereal", rounds:4800} (8 hours RAW sustain, §37 hours×600,
// ghost byte-shape mirrored). RAW Etherealness here is At Will → NO
// uses/maxUses authored → MA-0020 gate honestly null (§57); the already-active
// te refusal is the only gate. Refusal slug derives from the ACTION NAME
// ("Etherealness" → etherealness_refused — distinct from the ghost's
// ethereality_refused, §278), automationDetail from the effect key
// (already_ethereal) — both pinned. Plane-interaction clauses stay §70.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  buildSelfBuffGrantLog,
  buildAlreadyEnlargedRefusalLog,
  buildAlreadyEnlargedRefusalPopup,
  buildSelfBuffPopup,
  selfBuffRounds,
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

const succubus = monstersData.find(m => m.index === 'succubus-incubus');
const ETHEREALNESS_ROW = succubus.actions.find(a => a.name === 'Etherealness');
const ETHEREALNESS_DESC = 'The fiend magically enters the Ethereal Plane from the Material Plane, or vice versa.';

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

describe('MA-1551 Etherealness disk data shape (ghost MA-0780 byte-twin)', () => {
  it('succubus-incubus Etherealness authors monster_self_buff automation, name/description byte-preserved, no uses (At Will)', () => {
    expect(succubus).toBeDefined();
    expect(succubus.name).toBe('Succubus/Incubus');
    expect(ETHEREALNESS_ROW.name).toBe('Etherealness');
    expect(ETHEREALNESS_ROW.description).toBe(ETHEREALNESS_DESC);
    expect(ETHEREALNESS_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'ethereal', rounds: 4800 });
    expect(isMonsterSelfBuffRow(ETHEREALNESS_ROW)).toBe(true);
    expect(selfBuffRounds(ETHEREALNESS_ROW)).toBe(4800);
    // RAW: At Will on this stat block → gate stays honestly null.
    expect(ETHEREALNESS_ROW.uses).toBeUndefined();
    expect(ETHEREALNESS_ROW.maxUses).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(ETHEREALNESS_ROW, {})).toBeNull();
  });

  it('sibling succubus rows untouched — automation rides Etherealness only', () => {
    succubus.actions.filter(a => a.name !== 'Etherealness').forEach(a => {
      expect(a.automation).toBeUndefined();
    });
    // MA-1547/1550 save-path fields on Draining Kiss stay intact (§543).
    const kiss = succubus.actions.find(a => a.name === 'Draining Kiss');
    expect(kiss.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
    expect(kiss.save_dc).toBe(15);
    expect(kiss.save_type).toBe('Constitution');
  });

  it('te `ethereal` registry serves the row: Spells group, fa-ghost, effect key verbatim', () => {
    const def = getEffectDefinition('ethereal');
    expect(def).toBeDefined();
    expect(def.effect).toBe('ethereal');
    expect(ETHEREALNESS_ROW.automation.effect).toBe(def.effect);
    expect(def.icon).toBe('fa-ghost');
    expect(def.group).toBe('Spells');
  });
});

describe('MA-1551 Etherealness grant flow (At Will, no spend)', () => {
  it('first press: registers te ethereal on self, ONE merged rounds:4800 clock, ethereal_granted log, no ability_use spend', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ETHEREALNESS_ROW,
      monsterName: 'Succubus/Incubus 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.effectKey).toBe('ethereal');
    expect(result.remaining).toBeNull();
    expect(deps.store.uses).toEqual({});
    expect(deps.store.logs.some(e => e.type === 'ability_use')).toBe(false);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Succubus/Incubus 1', 'ethereal', 'Succubus/Incubus 1', expect.objectContaining({ rounds: 4800 }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Succubus/Incubus 1',
      targetName: 'Succubus/Incubus 1',
      campaignName: 'test-campaign',
      rounds: 4800,
      effects: [{ type: 'remove_target_effect', effectKey: 'ethereal', source: 'Succubus/Incubus 1', target: 'Succubus/Incubus 1' }],
    });
    const grant = deps.store.logs.find(e => e.automationType === 'ethereal_granted');
    expect(grant).toBeTruthy();
    expect(grant.characterName).toBe('Succubus/Incubus 1');
    expect(grant.abilityName).toBe('Etherealness');
    expect(grant.description).toContain('4800 rounds (8 hours)');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Border Ethereal'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('At Will'));
  });

  it('grant + popup prose ride the ethereal branch — never the invisibility else-copy', () => {
    const grant = buildSelfBuffGrantLog({ monsterName: 'Succubus/Incubus', action: ETHEREALNESS_ROW, effectKey: 'ethereal', rounds: 4800 });
    expect(grant.description).toContain('Border Ethereal');
    expect(grant.description).toContain('§70');
    expect(grant.description).not.toContain('turns invisible');
    expect(grant.description).not.toContain('ends when it attacks');
    const popup = buildSelfBuffPopup({ monsterName: 'Succubus/Incubus 1', action: ETHEREALNESS_ROW, effectKey: 'ethereal', rounds: 4800, remaining: null });
    expect(popup).toContain('slips into the Border Ethereal via Etherealness');
    expect(popup).toContain('4800 rounds (8 hours)');
    expect(popup).not.toContain('turns invisible');
  });

  it('refire while ethereal: zero-spend refusal — etherealness_refused (ACTION-NAME slug) + already_ethereal (effect-key detail)', async () => {
    const deps = makeDeps({ activeTe: { target: 'Succubus/Incubus 1', effect: 'ethereal', source: 'Succubus/Incubus 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ETHEREALNESS_ROW,
      monsterName: 'Succubus/Incubus 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'already-active' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.store.logs.some(e => e.type === 'ability_use')).toBe(false);
    const refusal = deps.store.logs.find(e => e.automationType === 'etherealness_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.automationDetail).toBe('already_ethereal');
    expect(refusal.characterName).toBe('Succubus/Incubus 1');
    // Ghost twin slug stays ghost-only — distinct action names, distinct slugs (§278).
    expect(deps.store.logs.some(e => e.automationType === 'ethereality_refused')).toBe(false);
    expect(buildAlreadyEnlargedRefusalLog({ monsterName: 'Succubus/Incubus', action: ETHEREALNESS_ROW, effectKey: 'ethereal' }).automationType).toBe('etherealness_refused');
    expect(buildAlreadyEnlargedRefusalPopup({ monsterName: 'Succubus/Incubus 1', action: ETHEREALNESS_ROW, effectKey: 'ethereal' })).toContain('already ethereal');
  });
});
