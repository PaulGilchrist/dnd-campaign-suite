// MA-0694: Empyrean "Bolster" legendary self-buff legs on the MA-0655/0658
// monsterSelfBuff seam. §165 header-swallow fix made Bolster a gated child
// (shared legendary gate spends in the modal BEFORE arming); this file pins
// the EFFECT TRANSPORT axes: automation.temp_hp self THP via tempHpService
// (replace-if-larger, MA-0275 semantics) + automation.ally_radius_ft te
// `bolster_advantage` on self + allied combatants (gridless: every non-PC
// board member lenient, §42 advisory) — all keys ride ONE merged clock
// (rounds:2 = survives the boundary + the empyrean's next turn, clears at
// the start of the round after — closest round-clock to RAW "until the end
// of the empyrean's next turn"). Already-bolstered refuses with
// `bolster_refused` / already_bolstered, zero spend/THP/te.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  bolsterTempHp,
  bolsterAllyRadiusFt,
  buildBolsterTempHpLog,
  buildBolsterAllyGrantLog,
  selfBuffRounds,
} from './monsterSelfBuff.js';
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
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

const emp = monstersData.find(m => m.index === 'empyrean');
const HEADER = emp.legendary_actions[0];
const BOLSTER = emp.legendary_actions[1];
const SHOCKWAVE = emp.legendary_actions[2];
const SMITE = emp.legendary_actions[3];

const CREATURES = [
  { name: 'Empyrean 1', type: 'npc', currentHp: 346, maxHp: 346 },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11 },
  { name: 'Bandit 2', type: 'npc', currentHp: 11, maxHp: 11 },
  { name: 'AasimarTest', type: 'player', currentHp: 200, maxHp: 200 },
];

function makeDeps({ activeTe = null, creatures = CREATURES, existingTempHp = 0 } = {}) {
  const store = { te: [], logs: [], thp: existingTempHp, expirations: [] };
  return {
    store,
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te.push({ campaign, target, effect, source, extra });
    }),
    getActiveTargetEffect: vi.fn(() => activeTe),
    addExpiration: vi.fn((entry) => { store.expirations.push(entry); }),
    getRuntimeValue: vi.fn(() => ({})),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
    addEntry: vi.fn((c, entry) => { store.logs.push(entry); return Promise.resolve(); }),
    setTempHp: vi.fn((name, amount) => { store.thp = Math.max(store.thp, amount); return store.thp; }),
    getCombatContext: vi.fn(() => Promise.resolve(creatures == null ? null : { creatures })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0694 disk data shape: empyrean legendary header + Bolster automation', () => {
  it('legendary_actions[0] is the canonical header with numeric uses:1 (§165)', () => {
    expect(HEADER.name).toBe('Legendary Action Uses: 1');
    expect(HEADER.uses).toBe(1);
    expect(HEADER.description).toMatch(/Immediately after another creature's turn, the empyrean can expend a use/);
    expect(HEADER.description).toMatch(/regains all expended uses at the start of each of its turns/);
  });

  it('Bolster child rides the self-buff seam: monster_self_buff/bolstered, rounds:2, temp_hp:10, ally_radius_ft:30, own uses dropped', () => {
    expect(BOLSTER.name).toBe('Bolster');
    expect(BOLSTER.uses).toBeUndefined();
    expect(BOLSTER.automation).toEqual({ type: 'monster_self_buff', effect: 'bolstered', rounds: 2, temp_hp: 10, ally_radius_ft: 30 });
    expect(isMonsterSelfBuffRow(BOLSTER)).toBe(true);
    expect(selfBuffRounds(BOLSTER)).toBe(2);
    expect(bolsterTempHp(BOLSTER)).toBe(10);
    expect(bolsterAllyRadiusFt(BOLSTER)).toBe(30);
  });

  it('Shockwave keeps its numeric save fields riding the shared gate; Smite delegates_to Divine Ray with uses dropped (§165 same-pass)', () => {
    expect(SHOCKWAVE.name).toBe('Shockwave of Glory');
    expect(SHOCKWAVE.save_dc).toBe(23);
    expect(SHOCKWAVE.save_type).toBe('Constitution');
    expect(SHOCKWAVE.uses).toBeUndefined();
    expect(SMITE.name).toBe('Smite');
    expect(SMITE.delegates_to).toBe('Divine Ray');
    expect(SMITE.uses).toBeUndefined();
    const ray = emp.actions.find(a => a.name === 'Divine Ray');
    expect(ray.attack_bonus).toBe(15);
  });

  it('both new te keys are registered in the targetEffect registry', () => {
    const adv = getEffectDefinition('bolster_advantage');
    expect(adv).toBeDefined();
    expect(adv.label).toBe('Bolstered (Advantage on D20 Tests)');
    expect(adv.cls).toBe('effect-buff');
    expect(adv.group).toBe('Spells');
    expect(adv.icon).toMatch(/^fa-/);
    const marker = getEffectDefinition('bolstered');
    expect(marker).toBeDefined();
    expect(marker.label).toBe('Bolstered');
    expect(marker.cls).toBe('effect-buff');
    expect(TARGET_EFFECT_DEFINITIONS.filter(d => d.effect === 'bolster_advantage')).toHaveLength(1);
    expect(TARGET_EFFECT_DEFINITIONS.filter(d => d.effect === 'bolstered')).toHaveLength(1);
  });

  it('duergar self-buff rows carry neither bolster field (seam stays byte-inert)', () => {
    const duergar = monstersData.find(m => m.index === 'duergar');
    expect(bolsterTempHp(duergar.actions[0])).toBe(0);
    expect(bolsterAllyRadiusFt(duergar.actions[0])).toBe(0);
  });
});

describe('MA-0694 Bolster grant flow', () => {
  it('first grant: THP via tempHpService, te bolstered on self, bolster_advantage on self + allied NPCs (PC excluded), ONE merged clock, spend-free (gate lives on the legendary seam), grant + ally + THP logs', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: BOLSTER, monsterName: 'Empyrean 1', campaignName: 'test-campaign', setPopupHtml, storedUses: {}, deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.thp).toEqual({ amount: 10, held: 10 });
    expect(deps.setTempHp).toHaveBeenCalledWith('Empyrean 1', 10, 'test-campaign');
    const teKeys = deps.registerTargetEffect.mock.calls.map(c => `${c[1]}:${c[2]}`);
    expect(teKeys).toEqual(['Empyrean 1:bolstered', 'Empyrean 1:bolster_advantage', 'Bandit 1:bolster_advantage', 'Bandit 2:bolster_advantage']);
    expect(teKeys).not.toContain('AasimarTest:bolster_advantage');
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    const clock = deps.store.expirations[0];
    expect(clock.rounds).toBe(2);
    expect(clock.effects).toEqual([
      { type: 'remove_target_effect', effectKey: 'bolstered', source: 'Empyrean 1', target: 'Empyrean 1' },
      { type: 'remove_target_effect', effectKey: 'bolster_advantage', source: 'Empyrean 1' },
    ]);
    const types = deps.store.logs.map(l => l.automationType);
    expect(types).toEqual(['bolstered_granted', 'bolster_temp_hp_granted', 'bolster_advantage_granted']);
    const thpLog = deps.store.logs.find(l => l.automationType === 'bolster_temp_hp_granted');
    expect(thpLog.description).toMatch(/10 Temporary Hit Points.*replace-if-larger.*10 THP standing/s);
    expect(deps.store.logs[2].description).toMatch(/Bandit 1, Bandit 2/);
    expect(deps.store.logs[2].description).toMatch(/GM-enforced .*§42/s);
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/Bolstered/);
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/10 Temporary Hit Points/);
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/30 ft/);
  });

  it('THP replace-if-larger: existing 15 beats the new 10 — held 15 in the log', async () => {
    const deps = makeDeps({ existingTempHp: 15 });
    await resolveMonsterSelfBuffRow({
      action: BOLSTER, monsterName: 'Empyrean 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), storedUses: {}, deps,
    });
    expect(deps.store.thp).toBe(15);
    expect(deps.store.logs.find(l => l.automationType === 'bolster_temp_hp_granted').description).toMatch(/10 Temporary Hit Points.*15 THP standing/s);
  });

  it('gridless advisory: cs missing logs console.error, advantage stays on self only, zero ally te', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = makeDeps({ creatures: null });
    const result = await resolveMonsterSelfBuffRow({
      action: BOLSTER, monsterName: 'Empyrean 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), storedUses: {}, deps,
    });
    expect(result.allyNames).toEqual([]);
    const targets = deps.registerTargetEffect.mock.calls.filter(c => c[2] === 'bolster_advantage').map(c => c[1]);
    expect(targets).toEqual(['Empyrean 1']);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('already bolstered refuses with zero spend, zero THP, zero te, zero clock: bolster_refused / already_bolstered', async () => {
    const deps = makeDeps({ activeTe: { target: 'Empyrean 1', effect: 'bolstered', source: 'Empyrean 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: BOLSTER, monsterName: 'Empyrean 1', campaignName: 'test-campaign', setPopupHtml, storedUses: {}, deps,
    });
    expect(result.resolved).toBe(false);
    expect(result.reason).toBe('already-active');
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.setTempHp).not.toHaveBeenCalled();
    expect(deps.store.logs).toHaveLength(1);
    expect(deps.store.logs[0].automationType).toBe('bolster_refused');
    expect(deps.store.logs[0].automationDetail).toBe('already_bolstered');
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/Already Bolstered/);
  });

  it('rounds:2 duration note reads "2 rounds" (sub-minute branch); enlarged/invisible notes byte-unchanged', async () => {
    const deps = makeDeps();
    const result = await resolveMonsterSelfBuffRow({
      action: BOLSTER, monsterName: 'Empyrean 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), storedUses: {}, deps,
    });
    const grant = deps.store.logs.find(l => l.automationType === 'bolstered_granted');
    expect(grant.description).toMatch(/armed on itself for 2 rounds/);
    expect(result.rounds).toBe(2);
  });

  it('buildBolsterTempHpLog / buildBolsterAllyGrantLog carry the raw numbers + advisory tokens', () => {
    const thpLog = buildBolsterTempHpLog({ monsterName: 'Empyrean 1', action: BOLSTER, amount: 10, held: 10 });
    expect(thpLog.type).toBe('automation');
    expect(thpLog.abilityName).toBe('Bolster');
    const allyLog = buildBolsterAllyGrantLog({ monsterName: 'Empyrean 1', action: BOLSTER, radiusFt: 30, allyNames: [], rounds: 2 });
    expect(allyLog.description).toMatch(/no allied combatants on the board/);
    expect(allyLog.description).toMatch(/30-ft radius \+ ally membership GM-enforced/);
  });
});
