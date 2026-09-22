// MA-0830: Giant Squid Ink Cloud (reactions[0], formerly a zero-affordance
// inert prose row with a cosmetic string uses) — BYTE-TWIN of MA-0813 (Giant
// Octopus): rides the MA-0554 self-aura byte-shape via the SAME registered te
// `ink_cloud` (NOT re-registered) through resolveSelfAuraRow, numeric
// maxUses:1 puts the chip counter on the MA-0020 monsterSpellUses economy,
// and the exhausted second click refuses with `ink_cloud_refused` + zero
// spend/zero te. 15-ft Cube modeled honestly at 8-ft centered radius (§62);
// swim-speed move, 1-minute/dispel clock and the underwater trigger stay
// advisory (GM-enforced) on the arm log + popup.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSelfAuraRow,
  resolveSelfAuraRow,
} from './monsterSelfAura.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
import { getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
import monstersData from '../../../public/data/monsters.json';

const squid = monstersData.find(m => m.name === 'Giant Squid');
const REACTION_ROW = squid.reactions[0];

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

describe('MA-0830 te reuse (no re-registration)', () => {
  it('rides the MA-0813 registered ink_cloud te', () => {
    const def = getEffectDefinition('ink_cloud');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Ink Cloud');
    expect(def.group).toBe('Defensive');
  });
});

describe('MA-0830 disk data shape', () => {
  it('giant squid Ink Cloud reaction mirrors the octopus MA-0554 self-zone dict at 8-ft radius', () => {
    expect(REACTION_ROW.name).toBe('Ink Cloud');
    expect(REACTION_ROW.trigger).toBe('The squid takes damage while underwater.');
    expect(REACTION_ROW.description).toMatch(/15-foot <strong>Cube<\/strong> centered on itself/);
    expect(REACTION_ROW.uses).toBe('1/Day');
    expect(REACTION_ROW.maxUses).toBe(1);
    expect(REACTION_ROW.range).toBe('15-foot Cube');
    expect(REACTION_ROW.zone).toEqual({
      self: true,
      radius_ft: 8,
      no_save: true,
      effect_key: 'ink_cloud',
      noun: 'ink',
      advisory: expect.stringContaining('8-ft centered radius'),
    });
    expect(REACTION_ROW.zone.advisory).toMatch(/Cube NOT parsed/);
    expect(REACTION_ROW.zone.advisory).toMatch(/GM-enforced/);
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

describe('MA-0830 activation', () => {
  it('first click: spends 1/Day, arms ink_cloud te on self radius 8, logs advisory + duration', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action: REACTION_ROW,
      monsterName: 'Giant Squid 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: true, effectKey: 'ink_cloud', radiusFt: 8, remaining: 0 });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith(
      'test-campaign',
      'Giant Squid 1',
      'ink_cloud',
      'Giant Squid 1',
      expect.objectContaining({ radiusFt: 8, noun: 'ink' }),
    );
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toMatch(/Ink Cloud.*1 use spent, 0 left today/);
    const arm = logs.find(l => l.automationType === 'self_aura_armed');
    expect(arm.characterName).toBe('Giant Squid 1');
    expect(arm.description).toMatch(/ink_cloud self aura armed on Giant Squid 1 \(radius 8 ft, no save\)/);
    expect(arm.description).toMatch(/GM-enforced/);
    expect(arm.description).toMatch(/Duration 1 minute \(advisory\)/);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/Ink Cloud — 8-ft Aura/);
  });

  it('second click (already spent): refusal popup + ink_cloud_refused log, zero te, zero spend', async () => {
    const deps = makeDeps({ uses: { 'Ink Cloud': 1 } });
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action: REACTION_ROW,
      monsterName: 'Giant Squid 1',
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
