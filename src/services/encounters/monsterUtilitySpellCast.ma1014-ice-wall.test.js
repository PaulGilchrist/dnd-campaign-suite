// MA-1014: resolveUtilitySpellCastRow — the adjudication behind the Ice
// Devil "Ice Wall" spell chip (spell_save_dc-only zone/utility row).
// Fresh row: recharge spends at resolve (MA-0633 spend-at-resolve byte-shape
// — this route has no picker) with its own ability_use log + the CLA-325
// advisory cast record carrying the RAW clauses (spell save DC 17,
// Intelligence, level 8 version, no components, §70 GM-enforced wall).
// Spent row: shared .mc-recharge-refusal popup + ice_wall_refused log,
// ZERO spend, ZERO cast record. Runtime writes ride single merged map
// writes via spendMonsterRecharge (MA-0005 recipe).
import { describe, it, expect, vi } from 'vitest';
import { resolveUtilitySpellCastRow } from './monsterUtilitySpellCast.js';

const MONSTER = 'Ice Devil 1';
const CAMPAIGN = 'test-campaign';

const ICE_WALL_ROW = {
  name: 'Ice Wall',
  description: 'The devil casts <strong>Wall of Ice</strong> (level 8 version), requiring no spell components and using Intelligence as the spellcasting ability (spell save DC 17).',
  spell_save_dc: 17,
  spellcasting_ability: 'Intelligence',
  recharge: '6',
};

const SPELL = { name: 'Wall of Ice', level: 6, concentration: true, duration: 'Up to 10 minutes' };

function makeDeps(initialRecharge = null) {
  const store = { [`${MONSTER}.monsterRecharge`]: initialRecharge };
  return {
    store,
    deps: {
      addEntry: vi.fn(() => Promise.resolve()),
      getRuntimeValue: vi.fn((c, k) => store[`${c}.${k}`] ?? null),
      setRuntimeValue: vi.fn((c, k, v) => { store[`${c}.${k}`] = v; return Promise.resolve(); }),
    },
  };
}

describe('MA-1014 utility spell cast — fresh recharge spends', () => {
  it('spends recharge at resolve then logs the advisory cast (DC/ability/level/no-components)', async () => {
    const { store, deps } = makeDeps(null);
    const setPopupHtml = vi.fn();
    const res = await resolveUtilitySpellCastRow({
      action: ICE_WALL_ROW, spellName: 'Wall of Ice', spell: SPELL, castLevel: 8,
      monsterName: MONSTER, campaignName: CAMPAIGN, setPopupHtml, deps,
    });
    expect(res).toEqual({ resolved: true, rechargeKey: 'Ice Wall' });
    expect(store[`${MONSTER}.monsterRecharge`]).toEqual({ 'Ice Wall': { recharged: false, threshold: 6 } });
    expect(setPopupHtml).not.toHaveBeenCalled();
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.length).toBe(2);
    expect(logs[0]).toMatchObject({ type: 'ability_use', abilityName: 'Ice Wall' });
    expect(logs[0].description).toMatch(/uses Ice Wall — Recharge 6/);
    expect(logs[1].type).toBe('ability_use');
    expect(logs[1].abilityName).toBe('Wall of Ice');
    expect(logs[1].description).toMatch(/^Ice Devil 1 casts Wall of Ice via Spellcasting \(spell save DC 17, Intelligence\)\./);
    expect(logs[1].description).toContain('Level 8 version.');
    expect(logs[1].description).toContain('No spell components required.');
    expect(logs[1].description).toContain('Concentration (Up to 10 minutes).');
    expect(logs[1].description).toMatch(/§70.*GM-enforced/);
  });

  it('recovered row re-spends with a fresh charge', async () => {
    const { store, deps } = makeDeps({ 'Ice Wall': { recharged: true, threshold: 6 } });
    const res = await resolveUtilitySpellCastRow({
      action: ICE_WALL_ROW, spellName: 'Wall of Ice', spell: SPELL, castLevel: 8,
      monsterName: MONSTER, campaignName: CAMPAIGN, setPopupHtml: vi.fn(), deps,
    });
    expect(res.resolved).toBe(true);
    expect(store[`${MONSTER}.monsterRecharge`]).toEqual({ 'Ice Wall': { recharged: false, threshold: 6 } });
    expect(deps.addEntry).toHaveBeenCalledTimes(2);
  });
});

describe('MA-1014 utility spell cast — spent recharge refuses', () => {
  it('refuses with the shared popup + ice_wall_refused log, zero spend, zero cast record', async () => {
    const { store, deps } = makeDeps({ 'Ice Wall': { recharged: false, threshold: 6 } });
    const setPopupHtml = vi.fn();
    const res = await resolveUtilitySpellCastRow({
      action: ICE_WALL_ROW, spellName: 'Wall of Ice', spell: SPELL, castLevel: 8,
      monsterName: MONSTER, campaignName: CAMPAIGN, setPopupHtml, deps,
    });
    expect(res).toEqual({ resolved: false, reason: 'not-recharged' });
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml.mock.calls[0][0]).toContain('mc-recharge-refusal');
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.length).toBe(1);
    expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'ice_wall_refused' });
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(store[`${MONSTER}.monsterRecharge`]).toEqual({ 'Ice Wall': { recharged: false, threshold: 6 } });
  });

  it('non-utility action (no spell_save_dc) resolves nothing', async () => {
    const { deps } = makeDeps(null);
    const res = await resolveUtilitySpellCastRow({
      action: { name: 'Ice Spear', attack_bonus: 10 }, spellName: 'X',
      monsterName: MONSTER, campaignName: CAMPAIGN, setPopupHtml: vi.fn(), deps,
    });
    expect(res).toEqual({ resolved: false, reason: 'not-utility-row' });
    expect(deps.addEntry).not.toHaveBeenCalled();
  });
});
