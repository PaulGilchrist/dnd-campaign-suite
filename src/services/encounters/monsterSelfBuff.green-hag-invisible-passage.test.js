// @maintained-by-ai
// MA-0919: Green Hag "Invisible Passage" — formerly a zero-affordance inert
// row; NOW rides the MA-0655/0658 monster_self_buff seam with the row's
// own gate economy: automation:{type:"monster_self_buff", effect:"invisible",
// rounds:600} + uses:1/maxUses:1 + usage:"recharge after rest" (short|long).
// Green-hag-DISTINCT vs the family: unlike the at-will imp/quasit/sprite/
// wisp invisibility twins and the ungated ghost #1138, this row is a true
// 1/Day economy — press spends BEFORE arming, the REAL te latch refuses a
// double-press, and once spent the row stays refused until a rest rearms it
// (rest-refresh: recharge CANON #1132 / abilityUses CANON #1082 lanes own
// the refresh consumer — never re-driven here). Rounds:600 is the BINDING
// backstop on the round counter, never wall-clock (§37 hours×600); the RAW
// attack/cast enders are the real enders. te key `invisible` is this lane's
// own — succubus/ghost own `ethereal` (#1138), sea-hag owns `disguised`;
// twin bytes never absorbed here. Concentration-break ender + "no physical
// evidence" flavor clause stay §70 advisory (duergar twin residual).
//
// Maintainer trim (#1137/#1138 family lessons):
// - Injected activeTe fixture PURGED — real registerTargetEffect/
//   getActiveTargetEffect run on a store-faithful runtime; the already-active
//   latch is store-backed, honest double-press (#949). PC decoy + bystander
//   survivor (#948/#1057); zero-write census (#1026); te + clock + log
//   stamps exact (#993/#app).
// - duergar twin byte-identity test deleted: the duergar Invisibility row is
//   pinned verbatim by its owner monsterSelfBuff.test.js:216 and this file
//   pins the hag row to the same bytes — identity follows (delete-citing
//   owner, #1136; cross-lane mirrors live at imp:105/quasit:111/sprite:113).
// - endSelfBuffOnTrigger attack/cast/inert ender tests deleted: generic
//   consumer bytes for te `invisible` are owned by
//   monsterSelfBuff.test.js:371-417 (attack + cast + inert, same key);
//   ghost #1138 removed the same mirrors with this cite.
// old->new: disk[3]→disk[1]; grant[3 fixture]-→flow[1 honest triple-press];
// enders[3]→0 (owner-cited above); registry te bytes→golden
// targetEffectDefinitions.test.js:168 (#1012).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  selfBuffRounds,
} from './monsterSelfBuff.js';
import monstersData from '../../../public/data/monsters.json';

const { store, logs, expirations } = vi.hoisted(() => ({ store: {}, logs: [], expirations: [] }));
const TE_KEY = 'campaign|targetEffects|test-campaign';
const USES_KEY = 'Green Hag 1|monsterSpellUses|test-campaign';

// Store-faithful runtime (#1137): plain KV semantics only — the REAL
// registerTargetEffect/getActiveTargetEffect/spendMonsterAbilityUse run on
// top of it, so the latch and the 1/Day spend are store-backed, not
// injected fixtures (#949).
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

const greenHag = monstersData.find(m => m.index === 'green-hag');
// BY NAME verbatim (#1086/#1094) — never positional.
const PASSAGE_ROW = greenHag.actions.find(a => a.name === 'Invisible Passage');

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  logs.length = 0;
  expirations.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-0919 Invisible Passage disk row (by name) — 1/Day self-buff economy authored', () => {
  it('green-hag Invisible Passage authors automation + uses:1 + recharge-after-rest usage verbatim; it is the ONLY self-buff row on the hag', () => {
    expect(greenHag?.name).toBe('Green Hag');
    expect(PASSAGE_ROW.description).toBe('The hag magically turns invisible until she attacks or casts a spell, or until her concentration ends (as if concentrating on a spell). While invisible, she leaves no physical evidence of her passage, so she can be tracked only by magic. Any equipment she wears or carries is invisible with her.');
    expect(PASSAGE_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'invisible', rounds: 600 });
    expect(PASSAGE_ROW.uses).toBe(1);
    expect(PASSAGE_ROW.maxUses).toBe(1);
    expect(PASSAGE_ROW.usage).toEqual({ type: 'recharge after rest', rest_types: ['short', 'long'] });
    expect(isMonsterSelfBuffRow(PASSAGE_ROW)).toBe(true);
    expect(selfBuffRounds(PASSAGE_ROW)).toBe(600);
    // Discriminator: Claws and Illusory Appearance stay inert to this seam
    // (sea-hag's own Illusory Appearance `disguised` row is that lane's).
    expect(greenHag.actions.filter(isMonsterSelfBuffRow).map(a => a.name)).toEqual(['Invisible Passage']);
  });
});

describe('MA-0919 honest triple press — spend FIRST, real te latch, exhausted until rest', () => {
  it('press 1 spends the 1/Day use then arms te `invisible` exact bytes with ONE merged rounds:600 clock; press 2 refuses already_invisible zero-spend; after the te drops, press 3 refuses exhausted until a rest rearms', async () => {
    // Loud PC decoy (#948/#1057): same effect key on another target must
    // neither block the hag's press nor be disturbed by it.
    store[TE_KEY] = [{ target: 'PC 1', effect: 'invisible', source: 'Archmage 1' }];
    const setPopupHtml = vi.fn();
    const press = (storedUses) => resolveMonsterSelfBuffRow({
      action: PASSAGE_ROW,
      monsterName: 'Green Hag 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses,
      deps: {},
    });

    // Press 1 — spends BEFORE arming (uses store written before te store).
    const first = await press({});
    expect(first).toEqual({ resolved: true, effectKey: 'invisible', rounds: 600, remaining: 0, thp: null, allyNames: [] });
    expect(store[USES_KEY]).toEqual({ 'Invisible Passage': 1 });
    // te stamp exact producer bytes (#993): duration:minute, no bolster legs.
    expect(store[TE_KEY]).toEqual([
      { target: 'PC 1', effect: 'invisible', source: 'Archmage 1' },
      { target: 'Green Hag 1', effect: 'invisible', source: 'Green Hag 1', duration: 'minute', rounds: 600, actionName: 'Invisible Passage' },
    ]);
    expect(expirations).toEqual([{
      attackerName: 'Green Hag 1',
      targetName: 'Green Hag 1',
      campaignName: 'test-campaign',
      rounds: 600,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Green Hag 1', target: 'Green Hag 1' }],
    }]);
    expect(logs.map(l => l.automationType || l.type)).toEqual(['ability_use', 'invisible_granted']);
    expect(logs[0]).toMatchObject({ type: 'ability_use', characterName: 'Green Hag 1', abilityName: 'Invisible Passage' });
    expect(logs[0].description).toBe('Green Hag 1 uses Invisible Passage — 1 use spent, 0 left today (resets at dawn, GM-enforced for monsters).');
    expect(logs[1]).toMatchObject({ type: 'automation', automationType: 'invisible_granted', characterName: 'Green Hag 1', abilityName: 'Invisible Passage' });
    expect(logs[1].description).toBe('Green Hag 1 Invisible Passage: te `invisible` armed on itself for 600 rounds (1 hour) — ends when it attacks, casts a spell, or uses its Enlarge (attack/cast/enlarge enders drop the te with an `invisible_ended` log), or when its clock runs out. Concentration-break ender and invisibility advantage/disadvantage adjudication are GM-enforced (§70 advisory).');
    // Green-hag-only economy copy: at-will twins never render a uses note.
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('turns invisible'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('0 use(s) left (recharges after a short or long rest'));

    // Press 2 — already-active latch read off REAL store bytes (#949).
    const second = await press({});
    expect(second).toEqual({ resolved: false, reason: 'already-active' });
    expect(logs.map(l => l.automationType || l.type)).toEqual(['ability_use', 'invisible_granted', 'invisible_passage_refused']);
    expect(logs[2]).toMatchObject({ automationDetail: 'already_invisible', characterName: 'Green Hag 1', abilityName: 'Invisible Passage' });
    expect(logs[2].description).toBe('Green Hag 1 is already invisible — Invisible Passage refused, zero use spent. Refusal reason: already_invisible.');
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.stringContaining('Already Invisible'));

    // The te drops early via an attack/cast ender (consumer bytes owned by
    // monsterSelfBuff.test.js:371 — #1138 ghost precedent). Simulated here
    // by clearing the harness store, honest to this lane's next press.
    store[TE_KEY] = [{ target: 'PC 1', effect: 'invisible', source: 'Archmage 1' }];

    // Press 3 — 1 use already spent, no rest yet: exhausted, zero re-spend,
    // zero te, zero clock, decoy survivor (zero-write census #1026). The
    // row stays refused until recharge-after-rest refresh (#1132 owner).
    const third = await press({ 'Invisible Passage': 1 });
    expect(third).toEqual({ resolved: false, reason: 'exhausted' });
    expect(store[TE_KEY]).toEqual([{ target: 'PC 1', effect: 'invisible', source: 'Archmage 1' }]);
    expect(store[USES_KEY]).toEqual({ 'Invisible Passage': 1 });
    expect(expirations).toHaveLength(1);
    expect(logs.filter(l => l.type === 'ability_use')).toHaveLength(1);
    expect(logs.map(l => l.automationType || l.type)).toEqual(['ability_use', 'invisible_granted', 'invisible_passage_refused', 'invisible_passage_refused']);
    expect(logs[3].description).toBe('Green Hag 1 has already used Invisible Passage today (1/Day) — Invisible Passage refused. Uses reset at dawn; GM-enforced for monsters.');
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.stringContaining('Uses Exhausted'));
    // Seam clock is round-counter only — never wall-clock (MANDATORY flag).
    expect(new Set(expirations.map(e => e.rounds))).toEqual(new Set([600]));
  });
});
