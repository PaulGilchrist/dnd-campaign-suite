// @maintained-by-ai
// MA-2071: Ziz "Blinding Ascent" legendary child (legendary_actions, by name)
// — formerly a prose-only row that spent a legendary use unconditionally and
// died in the console.error at MonsterCardModal.jsx resolveLegendaryRowMechanic
// ("no resolvable mechanic") with ZERO invisibility grant (MA-2012/MA-2054
// twin). NOW rides the LIVE MA-0658/MA-0694 monster_self_buff seam:
// automation:{type:"monster_self_buff", effect:"invisible", rounds:2}.
//
// Ziz-DISTINCT core (#1138/#1139/#1140 family map): LEGENDARY CHILD economy —
// the row authors NO uses/maxUses (§165 phantom-counter ban), so the internal
// MA-0020 gate is honestly null and this seam NEVER spends: the shared
// legendary header pool ("Legendary Action Uses: 3") is spent UPSTREAM by
// resolveLegendaryRow→expendLegendaryUse (owner: monsterLegendaryUses.test.js
// + MonsterCardModal.legendary-uses lanes) — here that honesty is PROVEN by
// the zero-write census (only the te store is ever touched, all three presses).
// Refusal slug derives from the ACTION NAME (§239): `blinding_ascent_refused`
// / already_invisible — distinct from imp invisibility_refused (#1140) and
// hag invisible_passage_refused (#1139). rounds:2 is the adjudicated
// round-clock approximation of RAW "until the start of his next turn"
// (granted round R, clears round R+2 via processExpirationList
// currentRound >= appliedRound + rounds); the REAL enders are the family's
// attack/cast consumers, RAW-consistent for invisibility; the §398 movement
// clause "rises into the sun" stays unexpressible.
//
// Ziz family map: Solar Flare recharge → monsterRecharge.ma2067 (CLOSED
// #1130); Wing Shield reaction advisory → monsterActionAdvisory.ma2068
// (CLOSED #1089); Sky Screech save → saveProcessing.ma2072 (:31-55 owns
// screech bytes); epic roster sweep → monsterEpicCohort.test.js :88-98
// (legendary header/child economy generics); Blinding Ascent self-buff =
// THIS lane. selfBuff family: owner monsterSelfBuff.test.js (duergar
// enlarged/invisible, ender consumer :327-405); ghost #1138; green-hag
// #1139; imp #1140 (at-will 600-round twin) — their bytes never absorbed.
//
// Maintainer trim (#1138/#1139/#1140 recs applied):
// - twin byte-identity mirror DELETED: imp bytes owned by
//   monsterSelfBuff.imp-invisibility.test.js:97, Empyrean Bolster rounds:2
//   by monsterSelfBuff.bolster.test.js:116-117 — ziz row pinned verbatim
//   here, identity follows transitively (delete-citing owners, rec #1139).
// - te `invisible` registry mirror DELETED → golden
//   targetEffectDefinitions.test.js:110 (#1012); producer consulted-bytes
//   read honestly: invisibility else-copy in selfBuffPopupBody/buildSelfBuff-
//   GrantLog + selfBuffDurationNote rounds<10 branch → exact toBe stamps below.
// - ender mirrors stay OUT: attack/cast/enlarge consumer bytes for te
//   `invisible` owned by monsterSelfBuff.test.js:327-405 (#1138/#1139/#1140).
// - Wing/Screech sibling absence FOLDED into the ONE exactly-once
//   isMonsterSelfBuffRow discriminator filter (#1035 reach-branch, #829);
//   their full bytes owned by ma2068/ma2072 above.
// - injected deps/activeTe fixtures PURGED — real registerTargetEffect/
//   getActiveTargetEffect/spendMonsterAbilityUse run on a store-faithful
//   runtime (#1137/#1091); latch store-backed (#949); exact toBe stamps
//   (#993); zero-write census (#1026); loud PC decoy + bystander survivor
//   (#948/#1057); seam clock never wall-clock (MANDATORY).
// old->new: disk[4]→disk[1 by-name]; registry→golden #1012; twins→0
// (owner-cited); grant[1]+popup-copy[1]+refire[1]+re-grant[1]→flow[1 honest
// triple-press].
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
// tests; here the exact ONE merged rounds:2 clock stamp IS the contract.
vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: (entry) => { expirations.push(entry); },
  KEY: 'pendingExpirations',
}));

const ziz = monstersData.find(m => m.index === 'ziz');
// BY NAME verbatim (#1086/#1094) — never positional.
const ASCENT = ziz.legendary_actions.find(a => a.name === 'Blinding Ascent');
const HEADER = ziz.legendary_actions.find(a => a.name === 'Legendary Action Uses: 3');
const ASCENT_DESC = 'Ziz rises into the sun, becoming invisible until the start of his next turn.';

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  logs.length = 0;
  expirations.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-2071 Ziz Blinding Ascent disk row (by name) — legendary child, §165 honestly ungated', () => {
  it('Blinding Ascent authors monster_self_buff/invisible rounds:2 verbatim, NO own uses → gate null; the header keeps the ONLY counter; it is the ONLY self-buff row on Ziz (Ziz wing-delegate and sky-screech siblings stay inert — full bytes owned ma2068/ma2072)', () => {
    expect(ziz?.name).toBe('Ziz');
    expect(ASCENT.description).toBe(ASCENT_DESC);
    expect(ASCENT.automation).toEqual({ type: 'monster_self_buff', effect: 'invisible', rounds: 2 });
    expect(isMonsterSelfBuffRow(ASCENT)).toBe(true);
    // round-clock approximation of RAW until-next-turn (#993): rounds:2.
    expect(selfBuffRounds(ASCENT)).toBe(2);
    // §165 phantom-counter ban (the pre-fix burn shape authored NEITHER fix
    // field): no own counter → internal gate honestly null, this seam spends
    // nothing — the legendary economy rides the shared header pool upstream.
    expect(ASCENT.uses).toBeUndefined();
    expect(ASCENT.maxUses).toBeUndefined();
    expect(ASCENT.advisory).toBeUndefined();
    expect(ASCENT.delegates_to).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(ASCENT, {})).toBeNull();
    // §165 contrast anchor: the counter lives on the header ONLY.
    expect(HEADER.uses).toBe(3);
    expect(isMonsterSelfBuffRow(HEADER)).toBe(false);
    // Discriminator exactly-once (#829) + reach-guard (#1035): Wing delegate
    // and Sky Screech stay inert here (full bytes: ma2068/ma2072), and no
    // invisibility hides in actions/reactions.
    expect(ziz.legendary_actions.filter(isMonsterSelfBuffRow).map(a => a.name)).toEqual(['Blinding Ascent']);
    expect((ziz.actions || []).filter(isMonsterSelfBuffRow)).toEqual([]);
    expect((ziz.reactions || []).filter(isMonsterSelfBuffRow)).toEqual([]);
  });
});

describe('MA-2071 honest triple press — legendary child spend-free, real te latch, re-grant after the clock drops', () => {
  it('press 1 arms te `invisible` exact bytes on self rounds:2 with ONE merged clock and ZERO spend (header pool spent upstream); PC decoy untouched; press 2 refuses blinding_ascent_refused/already_invisible zero-write; after the te drops, press 3 re-grants with still zero spend; seam clock round-counter only (MANDATORY)', async () => {
    // Loud PC decoy (#948/#1057): same effect key on another target must
    // neither block Ziz's press nor be disturbed by it.
    store[TE_KEY] = [{ target: 'PC 1', effect: 'invisible', source: 'Archmage 1' }];
    const setPopupHtml = vi.fn();
    const press = () => resolveMonsterSelfBuffRow({
      action: ASCENT,
      monsterName: 'Ziz 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps: {},
    });

    // Press 1 — legendary child: gate null (§165) → remaining null, ZERO
    // spend by this seam (vs the duergar/hag spend-then-arm twins at
    // monsterSelfBuff.test.js / green-hag #1139 — the Modal :920 header
    // spend is owned by the monsterLegendaryUses lanes, never re-driven).
    const first = await press();
    expect(first).toEqual({ resolved: true, effectKey: 'invisible', rounds: 2, remaining: null, thp: null, allyNames: [] });
    // te stamp exact producer bytes (#993): duration:minute, no bolster legs.
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect: 'invisible', source: 'Archmage 1' },
      { target: 'Ziz 1', effect: 'invisible', source: 'Ziz 1', duration: 'minute', rounds: 2, actionName: 'Blinding Ascent' },
    ]);
    expect(expirations).toEqual([{
      attackerName: 'Ziz 1',
      targetName: 'Ziz 1',
      campaignName: 'test-campaign',
      rounds: 2,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Ziz 1', target: 'Ziz 1' }],
    }]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'invisible_granted', characterName: 'Ziz 1', abilityName: 'Blinding Ascent' });
    // Ziz renders the family invisibility else-copy verbatim — the
    // "or uses its Enlarge" clause is honest residual (Ziz has no Enlarge;
    // the real enders are attack/cast, §70 advisory, consumer owned by
    // monsterSelfBuff.test.js:327-405 — enders never re-driven here).
    expect(logs[0].description).toBe('Ziz 1 Blinding Ascent: te `invisible` armed on itself for 2 rounds — ends when it attacks, casts a spell, or uses its Enlarge (attack/cast/enlarge enders drop the te with an `invisible_ended` log), or when its clock runs out. Concentration-break ender and invisibility advantage/disadvantage adjudication are GM-enforced (§70 advisory).');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Ziz 1 is Invisible'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('turns invisible via Blinding Ascent'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('armed for 2 rounds'));
    // §165 child: no own counter → no uses counter in the popup.
    expect(setPopupHtml).not.toHaveBeenCalledWith(expect.stringContaining('use(s) left'));
    // Zero-write census (#1026): across every press only the te store is
    // touched — no uses store, no ability_use log, this seam spends NOTHING.
    expect(logs.some(l => l.type === 'ability_use')).toBe(false);
    expect(Object.keys(store)).toEqual([TE_KEY]);

    // Press 2 — latch read off REAL store bytes, not an injected fixture (#949).
    const second = await press();
    expect(second).toEqual({ resolved: false, reason: 'already-active' });
    // Zero-write census (#1026): te store byte-identical (decoy survivor),
    // one clock only, no uses store ever written.
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect: 'invisible', source: 'Archmage 1' },
      { target: 'Ziz 1', effect: 'invisible', source: 'Ziz 1', duration: 'minute', rounds: 2, actionName: 'Blinding Ascent' },
    ]);
    expect(expirations).toHaveLength(1);
    expect(logs.map(l => l.automationType || l.type)).toEqual(['invisible_granted', 'blinding_ascent_refused']);
    const refusal = logs[1];
    // §239 slug from the ACTION NAME — this lane's gate-copy discriminator.
    expect(refusal.automationDetail).toBe('already_invisible');
    expect(refusal.description).toBe('Ziz 1 is already invisible — Blinding Ascent refused, zero use spent. Refusal reason: already_invisible.');
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.stringContaining('Already Invisible'));

    // The te drops when its rounds:2 clock (or an attack/cast ender) clears
    // it — consumer bytes owned by monsterSelfBuff.test.js:327-405 and the
    // expirationQueue lane. Simulated here by clearing the harness store,
    // honest to this lane's next press.
    store[TE_KEY] = [{ target: 'PC 1', effect: 'invisible', source: 'Archmage 1' }];

    // Press 3 — fresh press, fresh clock: re-grants exactly once, still
    // zero spend forever (legendary economy lives upstream on the header).
    const third = await press();
    expect(third).toEqual({ resolved: true, effectKey: 'invisible', rounds: 2, remaining: null, thp: null, allyNames: [] });
    expect(store[TE_KEY]).toHaveLength(2);
    expect(store[TE_KEY].filter(te => te.effect === 'invisible' && te.target === 'Ziz 1')).toHaveLength(1);
    expect(expirations).toHaveLength(2);
    expect(logs.some(l => l.type === 'ability_use')).toBe(false);
    expect(Object.keys(store)).toEqual([TE_KEY]);
    // Seam clock is round-counter only — never wall-clock (MANDATORY flag).
    expect(new Set(expirations.map(e => e.rounds))).toEqual(new Set([2]));
  });
});
