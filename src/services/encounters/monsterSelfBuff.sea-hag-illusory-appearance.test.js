// @maintained-by-ai
// MA-1449: Sea Hag "Illusory Appearance" — formerly a FAIL(a) MISROUTE row:
// the caster's "spell save DC 13" (a CON caster stat) was transcribed into
// row-level save_dc/save_type, arming a real "DC 13 Constitution" chip that
// FORCED a saving throw on the armed target and paid NOTHING (save_effect ""
// → saveConditions []), while the disguise itself was never granted. Disguise
// Self is a save-less SELF cast. Fix: strip save_dc/save_type/attack_bonus
// (keys DELETED, Imp MA-1019 twin = key absent) + author
// automation:{type:"monster_self_buff", effect:"disguised", rounds:14400}
// (24 hours §37 hours×600) — the row rides the live MA-0655/0658/0780
// monsterSelfBuff seam with ZERO new chip-route code. te `disguised` is a
// DISTINCT key from `invisible`/`ethereal` (#1138 verified): the sea-hag's
// own honest disk set is Claw / Death Glare / Illusory Appearance — NO
// Invisible Passage (that is the green-hag lane #1139), and the
// isMonsterSelfBuffRow filter proves exactly one row qualifies. RAW has NO
// uses limit → no uses/maxUses/usage → MA-0020 gate honestly null (§57 At
// Will); the already-active te latch is the ONLY gate. No attack/cast enders
// — RAW the disguise lasts the full duration (invisible-only enders stay
// byte-untouched, verified by the bystander survivor in the press flow).
//
// selfBuff family map: owner monsterSelfBuff.test.js (duergar enlarged +
// invisible, ender consumer :371-417, twin copy :419); ghost #1138 (ethereal
// 8h at-will, copy :115); green-hag #1139 (invisible 1/Day); imp #1140 /
// quasit #1142 (invisible, at will); sea-hag = THIS lane (disguised,
// at will, save-less); sprite/wisp queued behind — their bytes never
// absorbed here.
//
// Maintainer trim (#1138 rec APPLIED verbatim / #1139 #1142 family
// template): :196-216 enlarge/invis/ethereal twin mirrors of owner :419 +
// golden registry + ghost lane TRIMMED to the not.toContain('Disguise Self')
// bleed checks only — positive twin bytes stay with their owners.
// - Injected deps/activeTe fixtures PURGED — real registerTargetEffect/
//   getActiveTargetEffect run on a store-faithful runtime (#1137/#1091);
//   latch store-backed (#949); exact toBe stamps/clock/logs (#993);
//   zero-write census (#1026); loud PC decoy + bystander survivor
//   (#948/#1057); seam clock never wall-clock (MANDATORY flag).
// - registry te bytes → golden targetEffectDefinitions.test.js:109 (#1012);
//   only this ticket's save-less truth phrase pinned here.
// - ender mirror deleted: endSelfBuffOnTrigger consumer bytes owned by
//   monsterSelfBuff.test.js:371-417; the disguised lane's no-early-drop
//   truth rides press-1's zero-write census + bystander `invisible` survivor.
// old->new: disk[1 positional]→disk[1 by-name verbatim + full-keyset +
// filter]; registry[1]→golden #1012 (+save-less phrase folded into disk);
// grant-flow[4: first-click/grant-prose/popup-prose/refusal]→flow[1 honest
// triple-press]; enders[1]→0 (owner :371-417); twins[1]→anti-bleed[1
// not.toContain('Disguise Self') only, #1138 rec].
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  selfBuffRounds,
  buildSelfBuffGrantLog,
  buildSelfBuffPopup,
} from './monsterSelfBuff.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
import { getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
import monstersData from '../../../public/data/monsters.json';

const { store, logs, expirations } = vi.hoisted(() => ({ store: {}, logs: [], expirations: [] }));
const TE_KEY = 'campaign|targetEffects|test-campaign';

// Store-faithful runtime (#1137): plain KV semantics only — the REAL
// registerTargetEffect/getActiveTargetEffect run on top of it, so the
// already-active latch is store-backed, not an injected fixture (#949).
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (scope, key, campaign) => store[`${scope}|${key}|${campaign}`],
  setRuntimeValue: (scope, key, value, campaign) => {
    store[`${scope}|${key}|${campaign}`] = value;
    return Promise.resolve();
  },
  getAllStoreKeys: () => [],
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: (campaign, entry) => {
    logs.push(entry);
    return Promise.resolve();
  },
}));
// addExpiration recorder: the expirationQueue consumer lane owns its own
// tests; here the exact ONE merged clock stamp IS the contract.
vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: (entry) => { expirations.push(entry); },
  KEY: 'pendingExpirations',
}));

const seaHag = monstersData.find(m => m.index === 'sea-hag');
// BY NAME verbatim (#1086/#1094) — never positional.
const ILLUSORY_ROW = seaHag.actions.find(a => a.name === 'Illusory Appearance');
const SEA_HAG_DESC = "The hag casts <strong>Disguise Self</strong>, using Constitution as the spellcasting ability (spell save DC 13). The spell's duration is 24 hours.";

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  logs.length = 0;
  expirations.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-1449 Illusory Appearance disk row (by name) — save-less misroute fixed, AT WILL ungated', () => {
  it('sea-hag Illusory Appearance authors monster_self_buff disguised verbatim; save_dc/save_type/attack_bonus keys DELETED; no uses → MA-0020 gate null; it is the ONLY self-buff row on the sea hag', () => {
    expect(seaHag?.name).toBe('Sea Hag');
    expect(ILLUSORY_ROW.description).toBe(SEA_HAG_DESC);
    // The MA-1449 misroute fix: the DC-13 CON save chip keys are DELETED
    // (Imp MA-1019 twin = key absent) — a save-less SELF cast never arms a
    // forced saving throw.
    expect('save_dc' in ILLUSORY_ROW).toBe(false);
    expect('save_type' in ILLUSORY_ROW).toBe(false);
    expect('attack_bonus' in ILLUSORY_ROW).toBe(false);
    // te `disguised` — DISTINCT key from `invisible`/`ethereal` (#1138);
    // rounds:14400 = 24 hours on the round-counter seam, never wall-clock.
    expect(ILLUSORY_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'disguised', rounds: 14400 });
    expect(isMonsterSelfBuffRow(ILLUSORY_ROW)).toBe(true);
    expect(selfBuffRounds(ILLUSORY_ROW)).toBe(14400);
    // RAW: no uses limit on this stat block → gate stays honestly null (§57).
    expect(ILLUSORY_ROW.uses).toBeUndefined();
    expect(ILLUSORY_ROW.maxUses).toBeUndefined();
    expect(ILLUSORY_ROW.usage).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(ILLUSORY_ROW, {})).toBeNull();
    // Full-keyset verbatim pin: the misroute keys are gone; the disk keeps
    // ONLY these sanctioned (with legacy empty-string) keys — nothing new
    // may re-arm a chip.
    expect(Object.keys(ILLUSORY_ROW)).toEqual(['name', 'description', 'save_effect', 'range', 'reach', 'recharge', 'automation']);
    // Discriminator (#1035): the sea-hag honest set is Claw / Death Glare /
    // Illusory Appearance — exactly one row qualifies, and there is NO
    // Invisible Passage on this card (that is the green-hag lane #1139).
    expect(seaHag.actions.map(a => a.name)).toEqual(['Claw', 'Death Glare', 'Illusory Appearance']);
    expect(seaHag.actions.filter(isMonsterSelfBuffRow).map(a => a.name)).toEqual(['Illusory Appearance']);
    // At-will honesty: no self-buff hiding in legendary/lair/reactions.
    expect(seaHag.legendary_actions).toEqual([]);
    expect(seaHag.lair_actions).toEqual([]);
    expect(seaHag.reactions).toEqual([]);
    // Registry bytes → golden targetEffectDefinitions.test.js:109 (#1012);
    // only this ticket's save-less truth phrase is pinned here.
    expect(getEffectDefinition('disguised').description).toContain('not a target save');
  });
});

describe('MA-1449 honest triple press — save-less AT WILL zero-spend, real te latch, re-grant after the clock drops the te', () => {
  it('press 1 arms te `disguised` exact bytes on self, save-less, ZERO spend; PC decoy + bystander invisible untouched; press 2 refuses already_disguised zero-write; after the te drops, press 3 re-grants at will with still zero spend', async () => {
    // Loud PC decoy (#948/#1057): same effect key on another target must
    // neither block the hag's press nor be disturbed by it. Bystander te
    // `invisible` proves this lane never touches the invisibility keys.
    store[TE_KEY] = [
      { target: 'PC 1', effect: 'disguised', source: 'Archmage 1' },
      { target: 'PC 2', effect: 'invisible', source: 'Archmage 1' },
    ];
    const setPopupHtml = vi.fn();
    const press = () => resolveMonsterSelfBuffRow({
      action: ILLUSORY_ROW,
      monsterName: 'Sea Hag 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps: {},
    });

    // Press 1 — at will, save-less: remaining null, ZERO spend (§57 — the
    // uses store is NEVER written on this lane), no one rolls a save.
    const first = await press();
    expect(first).toEqual({ resolved: true, effectKey: 'disguised', rounds: 14400, remaining: null, thp: null, allyNames: [] });
    // te stamp exact producer bytes (#993): duration:minute, no bolster legs,
    // bystander + decoy byte-untouched.
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect: 'disguised', source: 'Archmage 1' },
      { target: 'PC 2', effect: 'invisible', source: 'Archmage 1' },
      { target: 'Sea Hag 1', effect: 'disguised', source: 'Sea Hag 1', duration: 'minute', rounds: 14400, actionName: 'Illusory Appearance' },
    ]);
    expect(expirations).toEqual([{
      attackerName: 'Sea Hag 1',
      targetName: 'Sea Hag 1',
      campaignName: 'test-campaign',
      rounds: 14400,
      effects: [{ type: 'remove_target_effect', effectKey: 'disguised', source: 'Sea Hag 1', target: 'Sea Hag 1' }],
    }]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'disguised_granted', characterName: 'Sea Hag 1', abilityName: 'Illusory Appearance' });
    // §278: the `disguised` branch renders its OWN honest copy — exact bytes
    // carry the save-less truth ("never a target save") and the RAW
    // no-attack/cast-enders clause; the invisibility else-copy
    // ("turns invisible"/attack-enders) is absent transitively.
    expect(logs[0].description).toBe('Sea Hag 1 Illusory Appearance: te `disguised` armed on itself for 14400 rounds (24 hours) — the hag casts Disguise Self on itself (save-less SELF cast — the row\'s "spell save DC 13" is the hag\'s caster stat, never a target save); no attack/cast enders — RAW the disguise lasts the full duration. Truelook, physical inspection (DC 20 Intelligence (Investigation)) and dispel-magic are GM-enforced (§70 advisory). At Will, no uses limit; a re-cast while disguised refuses zero-cost via the `illusory_appearance_refused` / already_disguised latch.');
    // Popup: disguised branch exact bytes — save-less truth + At Will, and
    // with no uses authored there is NO "use(s) left" counter (§57).
    expect(setPopupHtml).toHaveBeenCalledWith('<div class="mc-prerequisite-refusal"><h3>Sea Hag 1 is Disguised</h3><p>Sea Hag 1 casts Disguise Self on itself via Illusory Appearance — te `disguised` armed for 14400 rounds (24 hours) (one merged clock). Save-less SELF cast: no one rolls a save (the row\'s "spell save DC 13" is the hag\'s caster stat). Truelook / inspection / dispel-magic GM-enforced (§70). At Will — no uses limit.</p></div>');
    expect(setPopupHtml).not.toHaveBeenCalledWith(expect.stringContaining('use(s) left'));
    // Zero-write census (#1026): only the te store exists — no uses store,
    // no foreign te removal writes, no `${effectKey}_ended` log (the
    // enlarged-only ender guard at monsterSelfBuff.js:292 never fires).
    expect(logs.some(l => l.type === 'ability_use')).toBe(false);
    expect(Object.keys(store)).toEqual([TE_KEY]);

    // Press 2 — latch read off REAL store bytes, not an injected fixture (#949).
    const second = await press();
    expect(second).toEqual({ resolved: false, reason: 'already-active' });
    // Zero-write census (#1026): te store byte-identical (decoy + bystander
    // survivors), one clock only, no uses store ever written.
    expect(store[TE_KEY]).toHaveLength(3);
    expect(store[TE_KEY][2]).toEqual({ target: 'Sea Hag 1', effect: 'disguised', source: 'Sea Hag 1', duration: 'minute', rounds: 14400, actionName: 'Illusory Appearance' });
    expect(expirations).toHaveLength(1);
    expect(logs.map(l => l.automationType || l.type)).toEqual(['disguised_granted', 'illusory_appearance_refused']);
    expect(logs[1]).toMatchObject({ automationDetail: 'already_disguised', characterName: 'Sea Hag 1', abilityName: 'Illusory Appearance' });
    expect(logs[1].description).toBe('Sea Hag 1 is already disguised — Illusory Appearance refused, zero use spent. Refusal reason: already_disguised.');
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.stringContaining('Already Disguised'));

    // The te drops at its 14400-round clock expiry (consumer bytes owned by
    // the expirationQueue lane; the invisible-only endSelfBuffOnTrigger
    // consumer is owned by monsterSelfBuff.test.js:371-417 — #1138/#1139
    // precedent, and disguised is NOT one of their keys). Simulated here by
    // clearing this lane's self te, honest to the next press.
    store[TE_KEY] = [
      { target: 'PC 1', effect: 'disguised', source: 'Archmage 1' },
      { target: 'PC 2', effect: 'invisible', source: 'Archmage 1' },
    ];

    // Press 3 — at will re-grant: ungated §57, STILL zero spend forever.
    const third = await press();
    expect(third).toEqual({ resolved: true, effectKey: 'disguised', rounds: 14400, remaining: null, thp: null, allyNames: [] });
    expect(store[TE_KEY]).toHaveLength(3);
    expect(expirations).toHaveLength(2);
    expect(logs.filter(l => l.type === 'ability_use')).toHaveLength(0);
    expect(Object.keys(store)).toEqual([TE_KEY]);
    // Seam clock is round-counter only — never wall-clock (MANDATORY flag).
    expect(new Set(expirations.map(e => e.rounds))).toEqual(new Set([14400]));
  });
});

describe('MA-1449 anti-bleed — the new `disguised` branch never contaminates the twin branches (§278, #1138 rec)', () => {
  it.each([
    ['enlarged', 'duergar', 'Enlarge'],
    ['invisible', 'duergar', 'Invisibility'],
    ['ethereal', 'ghost', 'Ethereality'],
  ])('%s twin grant + popup copy never contain "Disguise Self" (positive twin bytes owned by owner :419 / ghost #1138 :115 / golden #1012)', (effectKey, monsterIndex, actionName) => {
    const monster = monstersData.find(m => m.index === monsterIndex);
    const row = monster.actions.find(a => a.name === actionName);
    expect(row).toBeTruthy();
    expect(buildSelfBuffGrantLog({ monsterName: `${monster.name} 1`, action: row, effectKey, rounds: 600 }).description).not.toContain('Disguise Self');
    expect(buildSelfBuffPopup({ monsterName: `${monster.name} 1`, action: row, effectKey, rounds: 600, remaining: null })).not.toContain('Disguise Self');
  });
});
