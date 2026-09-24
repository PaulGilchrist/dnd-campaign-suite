// MA-1016: resolveUtilitySpellCastRow uses-leg — the innate 1/Day row
// (Ice Mephit "Fog Cloud": Charisma, NO spell_save_dc, NO recharge,
// numeric uses:1 + maxUses:1 MA-0633 byte-shape) previously resolved
// not-utility-row (spell_save_dc guard) and had zero uses consumption on
// the utility lane. Now: fresh cast spends via spendMonsterAbilityUse
// (MA-0020 monsterSpellUses map, "1 use spent, 0 left today") + advisory
// cast record carrying (Charisma) without a DC, no-components, concentration
// and the fog §70 advisory; exhausted re-press refuses with the shared
// mc-prerequisite-refusal popup + fog_cloud_refused automation log, ZERO
// spend, ZERO cast record (§57/§172). Rest-rearm = §70 residual (GM).
import { describe, it, expect, vi } from 'vitest';
import { resolveUtilitySpellCastRow } from './monsterUtilitySpellCast.js';

const MONSTER = 'Ice Mephit 1';
const CAMPAIGN = 'test-campaign';

const FOG_ROW = {
  name: 'Fog Cloud',
  description: 'The mephit casts <strong>Fog Cloud</strong>, requiring no spell components and using Charisma as the spellcasting ability.',
  spellcasting_ability: 'Charisma',
  usage: '1/Day',
  uses: 1,
  maxUses: 1,
};

const SPELL = { name: 'Fog Cloud', level: 1, concentration: true, duration: 'Up to 1 minute' };

function makeDeps(initialUses = null) {
  const store = { [`${MONSTER}.monsterSpellUses`]: initialUses };
  return {
    store,
    deps: {
      addEntry: vi.fn(() => Promise.resolve()),
      getRuntimeValue: vi.fn((c, k) => store[`${c}.${k}`] ?? null),
      setRuntimeValue: vi.fn((c, k, v) => { store[`${c}.${k}`] = v; return Promise.resolve(); }),
    },
  };
}

describe('MA-1016 Fog Cloud utility cast — 1/Day spend at resolve', () => {
  it('fresh row spends the MA-0020 use then logs the advisory cast (Charisma/no-components/fog §70)', async () => {
    const { store, deps } = makeDeps(null);
    const setPopupHtml = vi.fn();
    const res = await resolveUtilitySpellCastRow({
      action: FOG_ROW, spellName: 'Fog Cloud', spell: SPELL,
      monsterName: MONSTER, campaignName: CAMPAIGN, setPopupHtml, deps,
    });
    expect(res).toEqual({ resolved: true, rechargeKey: null });
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(store[`${MONSTER}.monsterSpellUses`]).toEqual({ 'Fog Cloud': 1 });
    expect(store[`${MONSTER}.monsterRecharge`] ?? null).toBeNull();
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.length).toBe(2);
    expect(logs[0]).toMatchObject({ type: 'ability_use', abilityName: 'Fog Cloud' });
    expect(logs[0].description).toMatch(/uses Fog Cloud — 1 use spent, 0 left today/);
    expect(logs[1].type).toBe('ability_use');
    expect(logs[1].abilityName).toBe('Fog Cloud');
    expect(logs[1].description).toMatch(/^Ice Mephit 1 casts Fog Cloud via Spellcasting \(Charisma\)\./);
    expect(logs[1].description).toContain('No spell components required.');
    expect(logs[1].description).toContain('Concentration (Up to 1 minute).');
    expect(logs[1].description).toMatch(/Fog zones have no engine consumer \(§70\).*GM-enforced/);
    expect(logs[1].description).not.toMatch(/spell save DC/);
    expect(logs[1].description).not.toMatch(/Wall\/zone/);
  });

  it('imp twin (no uses): innate at-will stays ungated, no monsterSpellUses write', async () => {
    const IMP_ROW = {
      name: 'Invisibility',
      description: 'The imp casts <strong>Invisibility</strong> on itself, requiring no spell components and using Charisma as the spellcasting ability.',
      spellcasting_ability: 'Charisma',
    };
    const { store, deps } = makeDeps(null);
    const res = await resolveUtilitySpellCastRow({
      action: IMP_ROW, spellName: 'Invisibility', spell: { name: 'Invisibility', concentration: true, duration: 'Up to 1 hour' },
      monsterName: 'Imp 1', campaignName: CAMPAIGN, setPopupHtml: vi.fn(), deps,
    });
    expect(res.resolved).toBe(true);
    expect(store['Imp 1.monsterSpellUses'] ?? null).toBeNull();
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.length).toBe(1);
    expect(logs[0].description).toMatch(/Invisibility has no monster-side consumer \(§70\)/);
  });
});

describe('MA-1016 Fog Cloud utility cast — exhausted refuses', () => {
  it('second press refuses with popup + fog_cloud_refused automation log, zero spend, zero cast record', async () => {
    const { store, deps } = makeDeps({ 'Fog Cloud': 1 });
    const setPopupHtml = vi.fn();
    const res = await resolveUtilitySpellCastRow({
      action: FOG_ROW, spellName: 'Fog Cloud', spell: SPELL,
      monsterName: MONSTER, campaignName: CAMPAIGN, setPopupHtml, deps,
    });
    expect(res).toEqual({ resolved: false, reason: 'uses-exhausted' });
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml.mock.calls[0][0]).toContain('mc-prerequisite-refusal');
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.length).toBe(1);
    expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'fog_cloud_refused' });
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(store[`${MONSTER}.monsterSpellUses`]).toEqual({ 'Fog Cloud': 1 });
  });

  it('row with neither spell_save_dc nor spellcasting_ability resolves nothing (MA-1014 pin)', async () => {
    const { deps } = makeDeps(null);
    const res = await resolveUtilitySpellCastRow({
      action: { name: 'Ice Spear', attack_bonus: 10 }, spellName: 'X',
      monsterName: MONSTER, campaignName: CAMPAIGN, setPopupHtml: vi.fn(), deps,
    });
    expect(res).toEqual({ resolved: false, reason: 'not-utility-row' });
    expect(deps.addEntry).not.toHaveBeenCalled();
  });
});
