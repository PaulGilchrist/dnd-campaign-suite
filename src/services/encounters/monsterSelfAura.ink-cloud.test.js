// MA-0813: Giant Octopus Ink Cloud (reactions[0], formerly a zero-affordance
// inert prose row with a cosmetic string uses) — rides the MA-0554 self-aura
// byte-shape (Darkmantle Darkness Aura twin): self-origin save-less zone dict
// arms the registered te `ink_cloud` ON SELF via resolveSelfAuraRow, numeric
// maxUses:1 puts the chip counter on the MA-0020 monsterSpellUses economy,
// and the exhausted second click refuses with `ink_cloud_refused` + zero
// spend/zero te. Cube shape, swim-speed move, 1-minute/dispel clock and the
// underwater trigger stay advisory (GM-enforced) on the arm log + popup.
// MA-1251: plain Octopus Ink Cloud (reactions[0], formerly prose-only zero
// affordance, RAW At-Will) — byte-twin zone dict at centered radius 3
// (5-foot Cube, MA-0919 decision-pin precedent), NO uses/maxUses so the
// uses-gate returns null and the press arms with zero spend (honest ungated).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSelfAuraRow,
  resolveSelfAuraRow,
} from './monsterSelfAura.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
import { TARGET_EFFECT_DEFINITIONS, getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
import monstersData from '../../../public/data/monsters.json';

const octopus = monstersData.find(m => m.name === 'Giant Octopus');
const REACTION_ROW = octopus.reactions[0];
const smallOctopus = monstersData.find(m => m.name === 'Octopus');
const SMALL_OCTOPUS_ROW = smallOctopus.reactions[0];

function makeDeps(stored = {}) {
  const store = { ...stored };
  return {
    store,
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te = { campaign, target, effect, source, extra };
    }),
    getRuntimeValue: vi.fn(() => store.uses || {}),
    setRuntimeValue: vi.fn((c, k, v) => { store.uses = v; return Promise.resolve(); }),
    addEntry: vi.fn((c, entry) => { store.logs = store.logs || []; store.logs.push(entry); return Promise.resolve(); }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0813 te registry', () => {
  it('registers ink_cloud in the Defensive group at its alphabetical slot', () => {
    const def = getEffectDefinition('ink_cloud');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Ink Cloud');
    expect(def.group).toBe('Defensive');
    expect(def.description).toMatch(/Heavily Obscured ink cloud/i);
    const labels = TARGET_EFFECT_DEFINITIONS.filter(d => d.group === 'Defensive').map(d => d.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});

describe('MA-0813 disk data shape', () => {
  it('giant octopus Ink Cloud reaction carries the MA-0554 self-zone dict + numeric maxUses', () => {
    expect(REACTION_ROW.name).toBe('Ink Cloud');
    expect(REACTION_ROW.trigger).toBe('The octopus takes damage while underwater.');
    expect(REACTION_ROW.description).toMatch(/10-foot <strong>Cube<\/strong> centered on itself/);
    expect(REACTION_ROW.uses).toBe('1/Day');
    expect(REACTION_ROW.maxUses).toBe(1);
    expect(REACTION_ROW.range).toBe('10-foot Cube');
    expect(REACTION_ROW.zone).toEqual({
      self: true,
      radius_ft: 5,
      no_save: true,
      effect_key: 'ink_cloud',
      noun: 'ink',
      advisory: expect.stringContaining('GM-enforced'),
    });
    expect(REACTION_ROW.save_dc).toBeUndefined();
    expect(REACTION_ROW.attack_bonus).toBeUndefined();
    expect(isSelfAuraRow(REACTION_ROW)).toBe(true);
  });

  it('uses counter gate reads numeric maxUses: fresh row has 1 use, spent row is exhausted', () => {
    const fresh = monsterAbilitySaveUsesGate(REACTION_ROW, {});
    expect(fresh).toEqual({ useKey: 'Ink Cloud', maxUses: 1, used: 0, remaining: 1, exhausted: false });
    const spent = monsterAbilitySaveUsesGate(REACTION_ROW, { 'Ink Cloud': 1 });
    expect(spent.remaining).toBe(0);
    expect(spent.exhausted).toBe(true);
  });
});

describe('MA-0813 activation', () => {
  it('first click: spends 1/Day, arms ink_cloud te on self radius 5, logs advisory + duration', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action: REACTION_ROW,
      monsterName: 'Giant Octopus 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: true, effectKey: 'ink_cloud', radiusFt: 5, remaining: 0 });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith(
      'test-campaign',
      'Giant Octopus 1',
      'ink_cloud',
      'Giant Octopus 1',
      expect.objectContaining({ radiusFt: 5, noun: 'ink' }),
    );
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toMatch(/Ink Cloud.*1 use spent, 0 left today/);
    const arm = logs.find(l => l.automationType === 'self_aura_armed');
    expect(arm.characterName).toBe('Giant Octopus 1');
    expect(arm.description).toMatch(/ink_cloud self aura armed on Giant Octopus 1 \(radius 5 ft, no save\)/);
    expect(arm.description).toMatch(/GM-enforced/);
    expect(arm.description).toMatch(/Duration 1 minute \(advisory\)/);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/Ink Cloud — 5-ft Aura/);
  });

  it('second click (already spent): refusal popup + ink_cloud_refused log, zero te, zero spend', async () => {
    const deps = makeDeps({ uses: { 'Ink Cloud': 1 } });
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action: REACTION_ROW,
      monsterName: 'Giant Octopus 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: { 'Ink Cloud': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.some(l => l.automationType === 'ink_cloud_refused')).toBe(true);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/Uses Exhausted/);
  });
});

describe('MA-1251 Octopus disk data shape', () => {
  it('octopus Ink Cloud reaction carries the self-zone dict byte-twin of its siblings, ungated', () => {
    expect(SMALL_OCTOPUS_ROW.name).toBe('Ink Cloud');
    expect(SMALL_OCTOPUS_ROW.trigger).toBe('A creature ends its turn within 5 feet of the octopus while underwater');
    expect(SMALL_OCTOPUS_ROW.description).toMatch(/5-foot <strong>Cube<\/strong> centered on itself/);
    expect(SMALL_OCTOPUS_ROW.zone).toEqual({
      self: true,
      radius_ft: 3,
      no_save: true,
      effect_key: 'ink_cloud',
      noun: 'ink',
      advisory: expect.stringContaining('GM-enforced'),
    });
    expect(SMALL_OCTOPUS_ROW.save_dc).toBeUndefined();
    expect(SMALL_OCTOPUS_ROW.attack_bonus).toBeUndefined();
    expect(isSelfAuraRow(SMALL_OCTOPUS_ROW)).toBe(true);
  });

  it('RAW At-Will: no uses/maxUses authored, so the uses-gate is null (no counter, no spend)', () => {
    expect(SMALL_OCTOPUS_ROW.uses).toBeUndefined();
    expect(SMALL_OCTOPUS_ROW.maxUses).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(SMALL_OCTOPUS_ROW, {})).toBeNull();
    expect(monsterAbilitySaveUsesGate(SMALL_OCTOPUS_ROW, { 'Ink Cloud': 7 })).toBeNull();
  });
});

describe('MA-1251 Octopus activation', () => {
  it('press arms ink_cloud te on self radius 3 with ZERO spend — ungated, no counter, no decrement', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action: SMALL_OCTOPUS_ROW,
      monsterName: 'Octopus 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: true, effectKey: 'ink_cloud', radiusFt: 3, remaining: null });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith(
      'test-campaign',
      'Octopus 1',
      'ink_cloud',
      'Octopus 1',
      expect.objectContaining({ radiusFt: 3, noun: 'ink' }),
    );
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.some(l => l.type === 'ability_use')).toBe(false);
    const arm = logs.find(l => l.automationType === 'self_aura_armed');
    expect(arm.characterName).toBe('Octopus 1');
    expect(arm.description).toMatch(/ink_cloud self aura armed on Octopus 1 \(radius 3 ft, no save\)/);
    expect(arm.description).toMatch(/GM-enforced/);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/Ink Cloud — 3-ft Aura/);
    expect(setPopupHtml.mock.calls[0][0]).not.toMatch(/use\(s\) left/);
  });
});
