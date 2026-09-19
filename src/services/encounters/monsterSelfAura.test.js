// MA-0554: Darkmantle Darkness Aura (actions[1], 15-ft self emanation,
// 1/Day) — formerly a zero-affordance inert row. Self-origin zone rows
// arm the authored te ON SELF via resolveSelfAuraRow, spend the row's
// 1/Day through the existing MA-0020 monsterSpellUses economy, and refuse
// the second activation with `<slug>_refused` + zero spend/zero te.
// Light/vision legs stay §70 advisory on the arm log + popup.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSelfAuraRow,
  resolveSelfAuraRow,
  buildSelfAuraArmLog,
  SELF_AURA_LIGHT_ADVISORY,
} from './monsterSelfAura.js';
import monstersData from '../../../public/data/monsters.json';

const darkmantle = monstersData.find(m => m.name === 'Darkmantle');
const AURA_ROW = darkmantle.actions[1];

function makeDeps(stored = {}) {
  const store = { ...stored };
  return {
    store,
    logs: [],
    teWrites: [],
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

describe('MA-0554 disk data shape', () => {
  it('darkmantle Darkness Aura row carries the self-origin MA-0043 zone dict + numeric uses', () => {
    expect(AURA_ROW.name).toBe('Darkness Aura');
    expect(AURA_ROW.uses).toBe('1/Day');
    expect(AURA_ROW.maxUses).toBe(1);
    expect(AURA_ROW.zone).toEqual({
      self: true,
      radius_ft: 15,
      no_save: true,
      effect_key: 'lair_darkness',
      noun: 'darkness',
      advisory: expect.stringContaining('§70'),
    });
    expect(AURA_ROW.save_dc).toBeUndefined();
    expect(AURA_ROW.attack_bonus).toBeUndefined();
  });

  it('isSelfAuraRow: true only for self+radius+save-less zone rows', () => {
    expect(isSelfAuraRow(AURA_ROW)).toBe(true);
    expect(isSelfAuraRow(darkmantle.actions[0])).toBe(false);
    expect(isSelfAuraRow(null)).toBe(false);
    // lair MA-0043 zone row (no self flag) never arms the self-grant path
    expect(isSelfAuraRow({ name: 'Shroud of Darkness', zone: { radius_ft: 15, no_save: true, effect_key: 'lair_darkness' } })).toBe(false);
    // save rows never arm (save seam owns them)
    expect(isSelfAuraRow({ name: 'X', save_dc: 12, zone: { self: true, radius_ft: 15 } })).toBe(false);
  });
});

describe('MA-0554 activation', () => {
  it('first click: spends 1/Day, arms lair_darkness te on self radius 15, logs §70 advisory + popup', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action: AURA_ROW,
      monsterName: 'Darkmantle 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: true, effectKey: 'lair_darkness', radiusFt: 15, remaining: 0 });
    expect(deps.store.uses).toEqual({ 'Darkness Aura': 1 });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith(
      'test-campaign',
      'Darkmantle 1',
      'lair_darkness',
      'Darkmantle 1',
      expect.objectContaining({ radiusFt: 15, noun: 'darkness' }),
    );
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toMatch(/Darkness Aura.*1 use spent, 0 left today/);
    const arm = logs.find(l => l.automationType === 'self_aura_armed');
    expect(arm.characterName).toBe('Darkmantle 1');
    expect(arm.description).toMatch(/lair_darkness self aura armed on Darkmantle 1 \(radius 15 ft, no save\)/);
    expect(arm.description).toMatch(/No illumination model \(§70\)/);
    expect(arm.description).toMatch(/Concentration, up to 10 minutes/);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/Darkness Aura — 15-ft Aura/);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/no illumination model \(§70\)/i);
  });

  it('second click (already spent): refusal popup + darkness_aura_refused log, zero te, zero spend', async () => {
    const deps = makeDeps({ uses: { 'Darkness Aura': 1 } });
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action: AURA_ROW,
      monsterName: 'Darkmantle 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: { 'Darkness Aura': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.some(l => l.automationType === 'darkness_aura_refused')).toBe(true);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/Uses Exhausted/);
  });

  it('double-spend guard: exhausted store mid-flight refuses with no te write', async () => {
    const deps = makeDeps({ uses: { 'Darkness Aura': 1 } });
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action: AURA_ROW,
      monsterName: 'Darkmantle 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
  });

  it('non-self-aura rows are inert (Crush attack row): no te, no spend, no log', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action: darkmantle.actions[0],
      monsterName: 'Darkmantle 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'not-self-aura' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addEntry).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  it('arm log builder carries the authored advisory clause and §70 fallback copy', () => {
    const row = { name: 'Gloom Shroud', zone: { self: true, radius_ft: 30, effect_key: 'lair_darkness' } };
    const log = buildSelfAuraArmLog({ monsterName: 'M', action: row, effectKey: 'lair_darkness', radiusFt: 30 });
    expect(log.description).toContain('radius 30 ft, no save');
    expect(log.description).toContain(SELF_AURA_LIGHT_ADVISORY);
  });
});
