// @maintained-by-ai
// MA-1720: Will-o'-Wisp "Invisibility" (will-o-wisp|actions|Invisibility) —
// formerly a prose-only inert row (name + description ONLY, zero affordance;
// §60/§114 inert-row fingerprint — SelfBuffLink short-circuits without the
// structured automation key, MonsterAction.jsx:255-256). NOW normalized onto
// the LIVE MA-1019 imp / MA-1522 sprite byte-shape automation:{type:
// "monster_self_buff", effect:"invisible", rounds:600}. The wisp description
// stays byte-unchanged (no <strong> wrap, no spellcasting_ability: the
// resolver never reads them — §203 grep-zero consumers; the row is innate
// magic, not a spell cast). Wisp-DISTINCT core (sprite/imp/quasit canonical
// family shape): AT WILL — disk authors NO uses/maxUses/usage, so the MA-0020
// gate is honestly null (§230) and presses NEVER spend: no uses store, no
// ability_use log, no "use(s) left" popup copy. The REAL already-active te
// latch is the only gate. rounds:600 is the BINDING backstop on the round
// counter, never wall-clock (§37 hours×600). RAW "until it attacks or uses
// its Consume Life, or until its concentration ends": the attack ender is
// live via MonsterCardModal endSelfBuffOnTrigger; Consume Life is a
// bonus-action TRAIT (traits[], not actions[] — disk-honest pin below: no
// automation, no chip) and the concentration-break ender stay §70 advisory —
// same residual as the sprite/imp twins.
//
// selfBuff family map: owner monsterSelfBuff.test.js (duergar enlarged +
// invisible; disk anchors :102-112; row-admission/not-self-buff :122-133;
// refusal copy :179-192; endSelfBuffOnTrigger ender consumer sole owner
// :327-405 — #1146 refreshed); ghost #1138 (ethereal 8h at-will);
// green-hag #1139 (invisible 1/Day); imp #1140 (invisible, at will);
// quasit #1142 (invisible, at will; canonical template); sprite #1144
// (invisible, at will); sea-hag #1143 (disguised); wisp = THIS lane
// (invisible, at will; its bytes never absorbed cross-lane).
//
// Maintainer trim (recs #1139/#1142/#1144 applied):
// - twin byte-mirror (automation vs sprite/imp/duergar) deleted: each twin
//   pinned verbatim in its own lane (duergar by owner anchor :102-112) —
//   identity follows transitively (delete-citing).
// - endSelfBuffOnTrigger attack/inert ender mirrors deleted: generic te
//   `invisible` consumer bytes owned by monsterSelfBuff.test.js:327-405
//   (#1146 base pass — refreshed range; #1138/#1139/#1140 precedent).
// - resolver not-self-buff refusal → owner monsterSelfBuff.test.js:122-133.
// - registry te bytes → golden targetEffectDefinitions.test.js:110/#1012.
// - Shock inert pin folded into the isMonsterSelfBuffRow discriminator
//   filter (#1035, exactly once per card); the standalone zero-junk loop is
//   absorbed by the full-keyset verbatim pin (#1142).
// - injected deps/activeTe fixtures PURGED — real registerTargetEffect/
//   getActiveTargetEffect/spendMonsterAbilityUse run on a store-faithful
//   runtime (#1137/#1091); latch store-backed (#949); exact toBe stamps
//   (#993); zero-write census (#1026); loud PC decoy + bystander survivor
//   (#948/#1057); seam clock never wall-clock (MANDATORY); the family
//   else-copy's "or uses its Enlarge" residual asserted honestly — the wisp
//   has no Enlarge; the real enders are attack/cast (§70) (#1140).
// old->new: disk[5]→disk[1]; flow[4]→flow[1 honest triple-press];
// enders[2]→0 (owner monsterSelfBuff.test.js:327-405);
// registry[1]→golden #1012 :110.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  selfBuffRounds,
} from './monsterSelfBuff.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
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

const wisp = monstersData.find(m => m.index === 'will-o-wisp');
// BY NAME verbatim (#1086/#1094) — never positional.
const INVIS_ROW = wisp.actions.find(a => a.name === 'Invisibility');
const WISP_INVIS_DESC = "The will-o'-wisp and its light magically become invisible until it attacks or uses its Consume Life, or until its concentration ends (as if concentrating on a spell).";
const WISP = "Will-o'-Wisp 1";

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  logs.length = 0;
  expirations.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-1720 Will-o\'-Wisp Invisibility disk row (by name) — AT WILL, honestly ungated', () => {
  it('wisp Invisibility authors monster_self_buff automation verbatim, rounds:600, no uses → MA-0020 gate null; it is the ONLY self-buff row on the wisp', () => {
    expect(wisp?.name).toBe('Will-o\'-Wisp');
    expect(INVIS_ROW.description).toBe(WISP_INVIS_DESC);
    expect(INVIS_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'invisible', rounds: 600 });
    expect(isMonsterSelfBuffRow(INVIS_ROW)).toBe(true);
    expect(selfBuffRounds(INVIS_ROW)).toBe(600);
    // RAW innate at will → no uses limit authored → gate stays honestly null (§230).
    expect(INVIS_ROW.uses).toBeUndefined();
    expect(INVIS_ROW.maxUses).toBeUndefined();
    expect(INVIS_ROW.usage).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(INVIS_ROW, {})).toBeNull();
    // Full-keyset verbatim pin: no <strong> wrap, no spellcasting_ability
    // (§203 grep-zero consumers — innate magic, not a spell cast), §490 junk
    // (attack_bonus/save_dc/save_type/save_effect/range/reach/recharge) is
    // GONE — the row carries ONLY the three sanctioned keys (absorbs the
    // standalone zero-junk loop, #1142).
    expect(Object.keys(INVIS_ROW)).toEqual(['name', 'description', 'automation']);
    // Discriminator reach-guard (#1035): Shock stays an attack row, inert to
    // self-buff, exactly once.
    expect(wisp.actions.filter(isMonsterSelfBuffRow).map(a => a.name)).toEqual(['Invisibility']);
    // Wisp quirk (§70 advisory): Consume Life — the RAW ender named in the
    // description — is a bonus-action TRAIT (traits[], not actions[]): no
    // automation, no chip, no consumer.
    const consumeLife = wisp.traits.find(t => t.name === 'Consume Life');
    expect(consumeLife).toBeDefined();
    expect(consumeLife.automation).toBeUndefined();
    // At-will honesty: no legendary/lair/reaction invisibility hiding elsewhere.
    expect(wisp.legendary_actions).toEqual([]);
    expect(wisp.lair_actions).toEqual([]);
    expect(wisp.reactions).toEqual([]);
  });
});

describe('MA-1720 honest triple press — AT WILL zero-spend, real te latch, re-grant after ender', () => {
  it('press 1 arms te `invisible` exact bytes on self with ZERO spend; PC decoy untouched; press 2 refuses already_invisible zero-write; after the te drops, press 3 re-grants at will with still zero spend', async () => {
    // Loud PC decoy (#948/#1057): same effect key on another target must
    // neither block the wisp's press nor be disturbed by it.
    store[TE_KEY] = [{ target: 'PC 1', effect: 'invisible', source: 'Archmage 1' }];
    const setPopupHtml = vi.fn();
    const press = () => resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
      monsterName: WISP,
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps: {},
    });

    // Press 1 — at will: remaining null, ZERO spend (§230 ungated — the
    // uses store is NEVER written on this lane).
    const first = await press();
    expect(first).toEqual({ resolved: true, effectKey: 'invisible', rounds: 600, remaining: null, thp: null, allyNames: [] });
    // te stamp exact producer bytes (#993): duration:minute, no bolster legs.
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect: 'invisible', source: 'Archmage 1' },
      { target: WISP, effect: 'invisible', source: WISP, duration: 'minute', rounds: 600, actionName: 'Invisibility' },
    ]);
    expect(expirations).toEqual([{
      attackerName: WISP,
      targetName: WISP,
      campaignName: 'test-campaign',
      rounds: 600,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: WISP, target: WISP }],
    }]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'invisible_granted', characterName: WISP, abilityName: 'Invisibility' });
    // The wisp renders the family else-copy verbatim — the duergar-residual
    // "or uses its Enlarge" clause is asserted honestly (the wisp has no
    // Enlarge; the real enders are attack/Consume Life, §70 advisory) (#1140).
    expect(logs[0].description).toBe("Will-o'-Wisp 1 Invisibility: te `invisible` armed on itself for 600 rounds (1 hour) — ends when it attacks, casts a spell, or uses its Enlarge (attack/cast/enlarge enders drop the te with an `invisible_ended` log), or when its clock runs out. Concentration-break ender and invisibility advantage/disadvantage adjudication are GM-enforced (§70 advisory).");
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('turns invisible'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('te `invisible` armed'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Ends on attack, spell cast, or Enlarge'));
    // At Will, no uses authored → no uses counter in the popup (§230).
    expect(setPopupHtml).not.toHaveBeenCalledWith(expect.stringContaining('use(s) left'));
    // Zero-spend census (#1026): only the te store was ever written.
    expect(logs.some(l => l.type === 'ability_use')).toBe(false);
    expect(Object.keys(store)).toEqual([TE_KEY]);

    // Press 2 — latch read off REAL store bytes, not an injected fixture (#949).
    const second = await press();
    expect(second).toEqual({ resolved: false, reason: 'already-active' });
    // Zero-write census (#1026): te store byte-identical (decoy survivor),
    // one clock only, no uses store ever written.
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect: 'invisible', source: 'Archmage 1' },
      { target: WISP, effect: 'invisible', source: WISP, duration: 'minute', rounds: 600, actionName: 'Invisibility' },
    ]);
    expect(expirations).toHaveLength(1);
    expect(logs.map(l => l.automationType || l.type)).toEqual(['invisible_granted', 'invisibility_refused']);
    // Refusal wording canonical bytes owned by monsterSelfBuff.test.js:179-192.
    expect(logs[1].automationDetail).toBe('already_invisible');
    expect(logs[1].description).toBe("Will-o'-Wisp 1 is already invisible — Invisibility refused, zero use spent. Refusal reason: already_invisible.");
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.stringContaining('Already Invisible'));

    // The te drops early via a Shock-attack ender (consumer bytes owned by
    // monsterSelfBuff.test.js:327-405 — #1146 refreshed). Simulated here by
    // clearing the harness store, honest to this lane's next press.
    store[TE_KEY] = [{ target: 'PC 1', effect: 'invisible', source: 'Archmage 1' }];

    // Press 3 — at will re-grant: ungated §230, STILL zero spend forever.
    const third = await press();
    expect(third).toEqual({ resolved: true, effectKey: 'invisible', rounds: 600, remaining: null, thp: null, allyNames: [] });
    expect(store[TE_KEY]).toHaveLength(2);
    expect(expirations).toHaveLength(2);
    expect(logs.filter(l => l.type === 'ability_use')).toHaveLength(0);
    expect(Object.keys(store)).toEqual([TE_KEY]);
    // Seam clock is round-counter only — never wall-clock (MANDATORY flag).
    expect(new Set(expirations.map(e => e.rounds))).toEqual(new Set([600]));
  });
});
