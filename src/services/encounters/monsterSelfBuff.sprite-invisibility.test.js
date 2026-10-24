// @maintained-by-ai
// MA-1522: Sprite "Invisibility" — formerly a plain-text inert row (name +
// description ONLY, zero affordance; §60/§114 inert-row fingerprint, unarmed
// per the MA-1369 invisibility census). NOW normalized onto the LIVE
// MA-1019 imp byte-shape: description gains the <strong>Invisibility</strong>
// markup wrap + spellcasting_ability:"Charisma" + automation:{type:
// "monster_self_buff", effect:"invisible", rounds:600} — key order
// byte-identical to the imp/duergar/green-hag twins. Sprite-DISTINCT core
// (quasit #1142 VERBATIM canonical shape): AT WILL — disk authors NO
// uses/maxUses/usage, so the MA-0020 gate is honestly null (§230) and
// presses NEVER spend: no uses store, no ability_use log, no "use(s) left"
// popup copy. The REAL already-active te latch is the only gate. rounds:600
// is the BINDING backstop on the round counter, never wall-clock (§37
// hours×600); the RAW attack/cast enders (Needle Sword / Enchanting Bow /
// Heart Sight casts) are the real enders via MonsterCardModal
// endSelfBuffOnTrigger. Sprite carries NO Concentration trait on disk and
// concentration-break ender + invisibility advantage adjudication stay §70
// advisory — same residual as the imp/quasit twins.
//
// selfBuff family map: owner monsterSelfBuff.test.js (duergar enlarged +
// invisible, ender consumer :327-405); ghost #1138 (ethereal 8h at-will);
// green-hag #1139 (invisible 1/Day); imp #1140 (invisible, at will);
// quasit #1142 (invisible, at will; canonical template); sea-hag #1143
// (disguised); sprite = THIS lane (invisible, at will); wisp lane reads
// sprite bytes cross-lane — its bytes never absorbed here.
//
// Maintainer trim (rec #1139/#1142 applied):
// - twin byte-mirror deleted (imp/duergar/green-hag cross-identity): sprite
//   row pinned verbatim here, imp by imp lane, duergar by owner :216, hag
//   by hag lane — identity follows transitively (delete-citing).
// - endSelfBuffOnTrigger attack/inert ender tests deleted: generic consumer
//   bytes for te `invisible` owned by monsterSelfBuff.test.js:327-405
//   (same key; #1138/#1139/#1140 precedent).
// - registry te bytes → golden targetEffectDefinitions.test.js:110/#1012.
// - Needle Sword/Enchanting Bow/Heart Sight inert pins folded into the
//   isMonsterSelfBuffRow discriminator filter (#1035); the standalone
//   zero-junk loop is absorbed by the full-keyset verbatim pin.
// - injected deps/activeTe fixtures PURGED — real registerTargetEffect/
//   getActiveTargetEffect/spendMonsterAbilityUse run on a store-faithful
//   runtime (#1137/#1091); latch store-backed (#949); exact toBe stamps
//   (#993); zero-write census (#1026); loud PC decoy + bystander survivor
//   (#948/#1057); seam clock never wall-clock (MANDATORY).
// old->new: disk[4]→disk[1]; grant-flow[4]→flow[1 honest triple-press];
// enders[2]→0 (owner monsterSelfBuff.test.js:327-405);
// registry[1]→golden #1012.
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

const sprite = monstersData.find(m => m.index === 'sprite');
// BY NAME verbatim (#1086/#1094) — never positional.
const INVIS_ROW = sprite.actions.find(a => a.name === 'Invisibility');
const SPRITE_INVIS_DESC = 'The sprite casts <strong>Invisibility</strong> on itself, requiring no spell components and using Charisma as the spellcasting ability.';

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  logs.length = 0;
  expirations.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-1522 Sprite Invisibility disk row (by name) — AT WILL, honestly ungated', () => {
  it('sprite Invisibility authors monster_self_buff automation verbatim, rounds:600, no uses → MA-0020 gate null; it is the ONLY self-buff row on the sprite', () => {
    expect(sprite?.name).toBe('Sprite');
    expect(INVIS_ROW.description).toBe(SPRITE_INVIS_DESC);
    expect(INVIS_ROW.spellcasting_ability).toBe('Charisma');
    expect(INVIS_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'invisible', rounds: 600 });
    expect(isMonsterSelfBuffRow(INVIS_ROW)).toBe(true);
    expect(selfBuffRounds(INVIS_ROW)).toBe(600);
    // RAW innate at will → no uses limit authored → gate stays honestly null (§230).
    expect(INVIS_ROW.uses).toBeUndefined();
    expect(INVIS_ROW.maxUses).toBeUndefined();
    expect(INVIS_ROW.usage).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(INVIS_ROW, {})).toBeNull();
    // Full-keyset verbatim pin: §490 junk (attack_bonus/save_dc/save_type/
    // save_effect/range/reach/recharge) is GONE — the row carries ONLY the
    // four sanctioned keys (absorbs the standalone zero-junk loop).
    expect(Object.keys(INVIS_ROW)).toEqual(['name', 'description', 'spellcasting_ability', 'automation']);
    // Discriminator reach-guard (#1035): Needle Sword / Enchanting Bow /
    // Heart Sight stay inert to self-buff, exactly once.
    expect(sprite.actions.filter(isMonsterSelfBuffRow).map(a => a.name)).toEqual(['Invisibility']);
    // At-will honesty: no legendary/lair invisibility hiding elsewhere.
    expect(sprite.legendary_actions).toEqual([]);
    expect(sprite.lair_actions).toEqual([]);
    expect(sprite.reactions).toEqual([]);
  });
});

describe('MA-1522 honest triple press — AT WILL zero-spend, real te latch, re-grant after ender', () => {
  it('press 1 arms te `invisible` exact bytes on self with ZERO spend; PC decoy untouched; press 2 refuses already_invisible zero-write; after the te drops, press 3 re-grants at will with still zero spend', async () => {
    // Loud PC decoy (#948/#1057): same effect key on another target must
    // neither block the sprite's press nor be disturbed by it.
    store[TE_KEY] = [{ target: 'PC 1', effect: 'invisible', source: 'Archmage 1' }];
    const setPopupHtml = vi.fn();
    const press = () => resolveMonsterSelfBuffRow({
      action: INVIS_ROW,
      monsterName: 'Sprite 1',
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
      { target: 'Sprite 1', effect: 'invisible', source: 'Sprite 1', duration: 'minute', rounds: 600, actionName: 'Invisibility' },
    ]);
    expect(expirations).toEqual([{
      attackerName: 'Sprite 1',
      targetName: 'Sprite 1',
      campaignName: 'test-campaign',
      rounds: 600,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Sprite 1', target: 'Sprite 1' }],
    }]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'invisible_granted', characterName: 'Sprite 1', abilityName: 'Invisibility' });
    // Sprite renders the family else-copy verbatim — the duergar-residual
    // "or uses its Enlarge" clause is asserted honestly (sprite has no
    // Enlarge; the real enders are attack/cast, §70 advisory).
    expect(logs[0].description).toBe('Sprite 1 Invisibility: te `invisible` armed on itself for 600 rounds (1 hour) — ends when it attacks, casts a spell, or uses its Enlarge (attack/cast/enlarge enders drop the te with an `invisible_ended` log), or when its clock runs out. Concentration-break ender and invisibility advantage/disadvantage adjudication are GM-enforced (§70 advisory).');
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
      { target: 'Sprite 1', effect: 'invisible', source: 'Sprite 1', duration: 'minute', rounds: 600, actionName: 'Invisibility' },
    ]);
    expect(expirations).toHaveLength(1);
    expect(logs.map(l => l.automationType || l.type)).toEqual(['invisible_granted', 'invisibility_refused']);
    const refusal = logs[1];
    expect(refusal.automationDetail).toBe('already_invisible');
    expect(refusal.description).toBe('Sprite 1 is already invisible — Invisibility refused, zero use spent. Refusal reason: already_invisible.');
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.stringContaining('Already Invisible'));

    // The te drops early via a Needle Sword/cast ender (consumer bytes owned
    // by monsterSelfBuff.test.js:327-405 — #1138/#1139/#1140 precedent).
    // Simulated here by clearing the harness store, honest to this lane's
    // next press.
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
