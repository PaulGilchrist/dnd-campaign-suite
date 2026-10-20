// @maintained-by-ai
// MA-0694: Empyrean "Bolster" legendary self-buff lane on the monsterSelfBuff
// seam (§165 header-swallow fix: Bolster is a gated child — the shared legendary
// gate spends upstream in the modal BEFORE arming, the child row authors NO uses).
// This file pins the BOLSTER-DISTINCT behavior of resolveMonsterSelfBuffRow:
//   - automation.temp_hp self THP through the REAL tempHpService (replace-if-larger,
//     MA-0275) — only the runtime store is mocked (store-faithful, #1091);
//   - automation.ally_radius_ft te `bolster_advantage` on self + gridless allied
//     combatants (§42 lenient membership, PC decoy excluded loudly);
//   - ONE merged rounds:2 clock (§37: survives the boundary + the empyrean's next
//     turn, clears at round start R+2; target-LESS ally entry clears every stamp);
//   - honest double press: te latch refuses replace-not-stacks, zero spend /
//     zero THP burn / zero te / zero clock (#949, #1026 economy watch 🔴);
//   - gridless guard reaching its branch: console.error + self-only advantage
//     (#1035), grant stays honest (#945).
// Clock is a round counter only — never wall-clock (#app MANDATORY).
//
// Family dup-map (owners hold, this file does not re-drive):
//   ./monsterSelfBuff.test.js ................ base seam: spend-before-arming,
//     exhausted gate, not-self-buff, enlarge/invisible, duration-note branches
//   ./monsterSelfBuff.ma2071-*.test.js ....... ziz legendary-child twin (spend-free shape)
//   ../combat/conditions/conditionEffects.bolster.test.js ... te CONSUMER fold (+1 adv)
//   ../combat/conditions/targetEffectDefinitions.test.js:105-106 .. registry rows
//     `bolstered` + `bolster_advantage` exact table bytes (old "registry" test DELETED, #1012)
//   ../automation/handlers/buffs/tempHpService.js .... replace-if-larger implementation
// Old->new: header/shockwave/smite disk mirrors DROPPED (legendary-economy lane,
// not consumed here — reported); standalone refusal test folded into honest
// double press; duration-note + builder direct-units folded into press-path bytes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  bolsterTempHp,
  bolsterAllyRadiusFt,
  selfBuffRounds,
} from './monsterSelfBuff.js';
import { setRuntimeValue as setRuntimeValueMock } from '../../hooks/runtime/useRuntimeState.js';
import { addExpiration as addExpirationMock } from '../../services/rules/effects/expirations.js';
import monstersData from '../../../public/data/monsters.json';

// Store-faithful runtime: the REAL tempHpService runs on this in-memory store
// (replace-if-larger Math.max is production code, not mock code).
const rt = vi.hoisted(() => ({ thp: 0 }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((characterKey, propertyName) => (propertyName === 'tempHp' ? rt.thp : undefined)),
  setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
    if (propertyName === 'tempHp') rt.thp = value;
    return Promise.resolve();
  }),
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
// BY NAME (never by index — index pins break on benign sibling edits).
const BOLSTER = emp.legendary_actions.find(a => a.name === 'Bolster');
const duergar = monstersData.find(m => m.index === 'duergar');
const ENLARGE = duergar.actions.find(a => a.name === 'Enlarge');

// Two allied NPC decoys ride, the PC decoy must never.
const CREATURES = [
  { name: 'Empyrean 1', type: 'npc', currentHp: 346, maxHp: 346 },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11 },
  { name: 'Bandit 2', type: 'npc', currentHp: 11, maxHp: 11 },
  { name: 'AasimarTest', type: 'player', currentHp: 200, maxHp: 200 },
];

function makeDeps({ creatures = CREATURES } = {}) {
  const store = { te: [], logs: [] };
  return {
    store,
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te.push({ campaign, target, effect, source, extra });
    }),
    // Store-backed latch: a press arms, a re-press reads what the first press wrote.
    getActiveTargetEffect: vi.fn((campaign, target, effect) =>
      store.te.find(e => e.target === target && e.effect === effect) || null),
    getRuntimeValue: vi.fn(() => ({})),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
    addEntry: vi.fn((c, entry) => { store.logs.push(entry); return Promise.resolve(); }),
    getCombatContext: vi.fn(() => Promise.resolve(creatures == null ? null : { creatures })),
  };
}

async function press(deps, setPopupHtml = vi.fn()) {
  return resolveMonsterSelfBuffRow({
    action: BOLSTER,
    monsterName: 'Empyrean 1',
    campaignName: 'test-campaign',
    setPopupHtml,
    storedUses: {},
    deps,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rt.thp = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-0694 Bolster disk row (by name) + inert helpers', () => {
  it('Bolster rides the self-buff seam verbatim: automation {type,effect,rounds:2,temp_hp:10,ally_radius_ft:30}, NO own uses (§165 child)', () => {
    expect(BOLSTER.automation).toEqual({ type: 'monster_self_buff', effect: 'bolstered', rounds: 2, temp_hp: 10, ally_radius_ft: 30 });
    expect(BOLSTER.uses).toBeUndefined();
    expect(BOLSTER.maxUses).toBeUndefined();
    expect(isMonsterSelfBuffRow(BOLSTER)).toBe(true);
    expect(selfBuffRounds(BOLSTER)).toBe(2);
    expect(bolsterTempHp(BOLSTER)).toBe(10);
    expect(bolsterAllyRadiusFt(BOLSTER)).toBe(30);
  });

  it('non-bolster self-buff rows are byte-inert to the new fields: no bolster keys authored, helpers default to 0', () => {
    expect(ENLARGE.automation).toEqual({ type: 'monster_self_buff', effect: 'enlarged', rounds: 10 });
    expect(bolsterTempHp(ENLARGE)).toBe(0);
    expect(bolsterAllyRadiusFt(ENLARGE)).toBe(0);
    expect(bolsterTempHp({})).toBe(0);
    expect(bolsterAllyRadiusFt(undefined)).toBe(0);
  });
});

describe('MA-0694 Bolster press path — real tempHpService, one merged clock, zero legendary spend', () => {
  it('first press exact census: te bytes stamped self `bolstered` (duration:minute) then `bolster_advantage` on self + allied NPCs in board order (PC decoy excluded), addExpiration ONE exact rounds:2 clock with target-LESS ally entry, tempHpService writes 10 THP campaign-keyed, ordered grant logs, popup, zero ability_use/monsterSpellUses', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await press(deps, setPopupHtml);

    expect(result).toEqual({
      resolved: true,
      effectKey: 'bolstered',
      rounds: 2,
      remaining: null,
      thp: { amount: 10, held: 10 },
      allyNames: ['Bandit 1', 'Bandit 2'],
    });

    // Exact ordered register bytes (campaign, target, effect, source, extra).
    expect(deps.registerTargetEffect.mock.calls).toEqual([
      ['test-campaign', 'Empyrean 1', 'bolstered', 'Empyrean 1', { duration: 'minute', rounds: 2, actionName: 'Bolster' }],
      ['test-campaign', 'Empyrean 1', 'bolster_advantage', 'Empyrean 1', { duration: 'rounds', rounds: 2, actionName: 'Bolster' }],
      ['test-campaign', 'Bandit 1', 'bolster_advantage', 'Empyrean 1', { duration: 'rounds', rounds: 2, actionName: 'Bolster' }],
      ['test-campaign', 'Bandit 2', 'bolster_advantage', 'Empyrean 1', { duration: 'rounds', rounds: 2, actionName: 'Bolster' }],
    ]);

    // ONE merged clock: self entry targeted; ally entry target-LESS so every
    // stamped combatant clears together (§37).
    expect(addExpirationMock).toHaveBeenCalledTimes(1);
    expect(addExpirationMock).toHaveBeenCalledWith({
      attackerName: 'Empyrean 1',
      targetName: 'Empyrean 1',
      campaignName: 'test-campaign',
      rounds: 2,
      effects: [
        { type: 'remove_target_effect', effectKey: 'bolstered', source: 'Empyrean 1', target: 'Empyrean 1' },
        { type: 'remove_target_effect', effectKey: 'bolster_advantage', source: 'Empyrean 1' },
      ],
    });

    // Real tempHpService on the store-faithful runtime mock.
    expect(rt.thp).toBe(10);
    expect(setRuntimeValueMock).toHaveBeenCalledWith('Empyrean 1', 'tempHp', 10, 'test-campaign');

    // Economy watch (#1026 🔴): gate lives on the legendary seam upstream —
    // this row must never write monsterSpellUses nor emit an ability_use log.
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.store.logs.some(l => l.type === 'ability_use')).toBe(false);

    // Ordered logs with exact transport copy.
    expect(deps.store.logs.map(l => l.automationType)).toEqual(['bolstered_granted', 'bolster_temp_hp_granted', 'bolster_advantage_granted']);
    expect(deps.store.logs[1].description).toBe('Empyrean 1 Bolster: 10 Temporary Hit Points granted via tempHpService (replace-if-larger — 10 THP standing).');
    expect(deps.store.logs[0].description).toMatch(/armed on itself for 2 rounds/);
    expect(deps.store.logs[0].description).toMatch(/and allies within 30 ft/);
    expect(deps.store.logs[0].description).toMatch(/§42/);
    expect(deps.store.logs[2].description).toMatch(/stamped on itself \+ Bandit 1, Bandit 2/);
    expect(deps.store.logs[2].description).toMatch(/exact 30-ft radius \+ ally membership GM-enforced/);

    const popup = String(setPopupHtml.mock.calls[0][0]);
    expect(popup).toMatch(/Bolstered/);
    expect(popup).toMatch(/10 Temporary Hit Points/);
    expect(popup).toMatch(/allies within 30 ft/);
    expect(popup).toMatch(/2 rounds/);
  });

  it('replace-if-larger is tempHpService\'s own lane — 15 standing beats the new 10: held 15 passes through result, store write and log verbatim', async () => {
    rt.thp = 15;
    const deps = makeDeps();
    const result = await press(deps);

    expect(result.thp).toEqual({ amount: 10, held: 15 });
    expect(rt.thp).toBe(15);
    expect(setRuntimeValueMock).toHaveBeenCalledWith('Empyrean 1', 'tempHp', 15, 'test-campaign');
    expect(deps.store.logs[1].description).toBe('Empyrean 1 Bolster: 10 Temporary Hit Points granted via tempHpService (replace-if-larger — 15 THP standing).');
  });

  it('honest double press replaces-not-stacks (#949): first press arms, second press refuses already_bolstered with zero extra te, zero extra clock, zero THP change, exactly one refusal log, Already Bolstered popup', async () => {
    const deps = makeDeps();
    const first = await press(deps);
    expect(first.resolved).toBe(true);

    const setPopupHtml = vi.fn();
    const second = await press(deps, setPopupHtml);
    expect(second).toEqual({ resolved: false, reason: 'already-active' });

    // Zero delta on every write lane.
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(4);
    expect(addExpirationMock).toHaveBeenCalledTimes(1);
    expect(setRuntimeValueMock).toHaveBeenCalledTimes(1);
    expect(rt.thp).toBe(10);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();

    expect(deps.store.logs).toHaveLength(4);
    const refusal = deps.store.logs[3];
    expect(refusal.automationType).toBe('bolster_refused');
    expect(refusal.automationDetail).toBe('already_bolstered');
    expect(refusal.description).toBe('Empyrean 1 is already bolstered — Bolster refused, zero use spent. Refusal reason: already_bolstered.');
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/Already Bolstered/);
  });

  it('gridless advisory guard (#1035): combatSummary missing logs console.error, advantage lands on self only, honest zero-ally grant still resolves with the same merged clock', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = makeDeps({ creatures: null });
    const result = await press(deps);

    expect(result.resolved).toBe(true);
    expect(result.allyNames).toEqual([]);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(deps.registerTargetEffect.mock.calls.map(c => `${c[1]}:${c[2]}`)).toEqual(['Empyrean 1:bolstered', 'Empyrean 1:bolster_advantage']);
    expect(rt.thp).toBe(10);
    // Clock keeps the target-LESS entry — clearing unstamped stamps is inert.
    expect(addExpirationMock).toHaveBeenCalledTimes(1);
    expect(addExpirationMock.mock.calls[0][0].effects.some(e => e.effectKey === 'bolster_advantage' && e.target === undefined)).toBe(true);
    expect(deps.store.logs[2].description).toMatch(/no allied combatants on the board/);
  });
});
