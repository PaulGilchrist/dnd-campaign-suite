// @maintained-by-ai
// MA-1868: Cthulhu "Psychic Shatter" — regular (non-legendary) action row,
// numeric save_dc → the save chip resolves through the regular save-chip lane
// (MonsterCardModal handleSaveRoll) and NEVER reaches expendLegendaryUse, so
// the MA-0073 per-action cooldown gate never armed: pre-fix the chip re-fired
// unlimited times per turn (live probe: 2/2 fires, 0 refused). Fix = DATA
// structured field `once_per_turn: true` on cthulhu's Psychic Shatter row +
// regular-row helpers in monsterLegendaryUses.js riding the SAME MA-0073
// latch: `monsterLegendaryActionCooldowns` map, slug, the refusal popup/log
// vocabulary (`<slug>_refused (once per turn)`, zero save rolled) and the
// EXISTING turn-start clear in regainLegendaryUses (:440 — the clear is
// legendary-state-independent, so it already runs for regular monsters).
// `hasLegendaryCooldownClause` stays byte-identical (owner: MA-0073 clause
// parse @monsterLegendaryUses.test.js:636): the prose regex matches "can't
// TAKE this action again until the START OF ITS next turn" — Cthulhu's
// "can't USE … until ITS next turn" wording deliberately never matches; the
// regular lane arms ONLY on the structured field (precision — no other row
// silently changes behavior).
//
// Family ownership (do not re-drive here):
// - expend-gate generics / turn-latch / slug / refusal vocabulary bytes:
//   MA-0021 + MA-0073 canon @monsterLegendaryUses.test.js:79-110, :636-706
//   (incl. the :701 turn-start-nothing-stamped no-spurious-writes twin —
//   branch is monster-agnostic, removed from this file as its duplicate).
// - legendary uses header/counter: ma1579-tarrasque-general.test.js.
// Covered uniquely here: (1) the cthulhu DATA fingerprint (exact-once
// once_per_turn arm, core bytes untouched), (2) the FIELD-driven vs
// prose-driven lane split, (3) the regular-row latch lifecycle on a monster
// with NO uses economy (regain returns regained:false yet still clears).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isOncePerTurnActionRow,
  regularActionCooldownRefusal,
  stampRegularActionCooldown,
  regainLegendaryUses,
  hasLegendaryCooldownClause,
  MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY,
} from './monsterLegendaryUses.js';
import monstersData from '../../../public/data/monsters.json';

// Real regainLegendaryUses/setRuntimeValue persist via storage.set → fetch.
vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const CTHULHU = monstersData.find((m) => m.index === 'cthulhu');
const SHATTER = CTHULHU.actions.find((a) => a.name === 'Psychic Shatter');
const CLAW = CTHULHU.actions.find((a) => a.name === 'Claw');
const COOLDOWNS = (name) => `${name}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`;

let store;
let deps;
let cs;
beforeEach(() => {
  store = {};
  cs = { round: 1, activeCreatureName: 'Bandit 1' };
  deps = {
    getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
    setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
    addEntry: vi.fn(() => Promise.resolve()),
    getCombatContext: vi.fn(() => Promise.resolve(cs)),
  };
});

describe('MA-1868 disk fingerprint: cthulhu Psychic Shatter once_per_turn armed (DATA fix)', () => {
  it('exact-once once_per_turn:true arms ONLY Psychic Shatter; save/damage/stun core bytes untouched', () => {
    expect(SHATTER).toBeTruthy();
    expect(SHATTER.once_per_turn).toBe(true);
    // Precision: no other cthulhu row silently opts into the new lane.
    expect(CTHULHU.actions.filter(isOncePerTurnActionRow).map((a) => a.name)).toEqual(['Psychic Shatter']);
    // EXACT core (byte-unchanged by the fix):
    expect(SHATTER.save_dc).toBe(24);
    expect(SHATTER.save_type).toBe('Intelligence');
    expect(SHATTER.damage_dice_primary).toBe('6d10');
    expect(SHATTER.damage_type_primary).toBe('Psychic');
    expect(SHATTER.conditions).toEqual(['stunned']);
    expect(SHATTER.save_effect).toBe('Failure: Stunned until the end of its next turn. Success: Half damage and no Stun.');
    expect(SHATTER.description).toContain('Cthulhu can\'t use this action again until its next turn.');
    // No fake d6-recharge and no per-DAY uses lane (wrong cadence for
    // "until its next turn" — recharge would add a d6, uses:1 would over-lock);
    // absent dc_success = engine default half = RAW-correct ("Success: Half damage").
    expect(SHATTER.recharge).toBeUndefined();
    expect(SHATTER.usage).toBeUndefined();
    expect(SHATTER.uses).toBeUndefined();
    expect(SHATTER.maxUses).toBeUndefined();
    expect(SHATTER.dc_success).toBeUndefined();
  });
});

describe('MA-1868 lane split: FIELD-driven, never prose-driven (legendary lane byte-inert)', () => {
  // MA-0073 owns the prose-regex + slug semantics (@:636); pinned HERE is
  // that Cthulhu's "can't USE … until its next turn" wording never matches
  // it, so the legendary lane shears nothing while the field arms correctly.
  it.each([
    ['authored true', { name: 'X', once_per_turn: true }, true],
    ['string "true" (strict ===)', { name: 'X', once_per_turn: 'true' }, false],
    ['field absent (Claw)', CLAW, false],
    ['null row', null, false],
  ])('isOncePerTurnActionRow — %s → %s', (_label, row, expected) => {
    expect(isOncePerTurnActionRow(row)).toBe(expected);
  });

  it('non-opted rows are byte-inert: regex never matches Cthulhu wording, refusal null, stamp writes nothing', async () => {
    expect(hasLegendaryCooldownClause(SHATTER)).toBe(false);
    expect(hasLegendaryCooldownClause(CLAW)).toBe(false);

    // refusal consults nothing and stamp touches nothing on a plain row,
    // even with a pre-seeded map (zero-applied-must-not-burn, #1026).
    store[COOLDOWNS('Cthulhu 1')] = { claw: { round: 1 } };
    expect(regularActionCooldownRefusal({ action: CLAW, monsterName: 'Cthulhu 1', deps })).toBeNull();
    await stampRegularActionCooldown({ action: CLAW, monsterName: 'Cthulhu 1', campaignName: 'test-campaign', deps });
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(store[COOLDOWNS('Cthulhu 1')]).toEqual({ claw: { round: 1 } }); // untouched
  });
});

describe('MA-1868 regular-row cooldown latch (MA-0073 vocabulary reuse, no uses economy)', () => {
  const MONSTER = 'Cthulhu 1';

  it('fire stamps the slug; every later press refused once-per-turn zero-roll; own turn-start clears (regained:false) and re-arms next round', async () => {
    // first press — un-stamped, allowed (no refusal)
    expect(regularActionCooldownRefusal({ action: SHATTER, monsterName: MONSTER, deps })).toBeNull();

    // successful fire stamps the shared latch at the combat-seam round
    await stampRegularActionCooldown({ action: SHATTER, monsterName: MONSTER, campaignName: 'test-campaign', deps });
    expect(store[COOLDOWNS(MONSTER)]).toMatchObject({ psychic_shatter: { round: 1 } });

    // later presses — ANY active creature, same turn window — refuse with
    // the reused MA-0073 vocabulary (owner pins the bytes @:644; refused
    // press re-stamps nothing — zero-applied-must-not-burn, #1026).
    cs.activeCreatureName = 'AasimarTest';
    const refusal = regularActionCooldownRefusal({ action: SHATTER, monsterName: MONSTER, deps });
    expect(refusal.refusalLog).toMatchObject({
      type: 'automation',
      automationType: 'psychic_shatter_refused (once per turn)',
      characterName: MONSTER,
      abilityName: 'Psychic Shatter',
    });
    expect(refusal.refusalLog.description).toMatch(/can't take this action again until the start of its next turn. Zero spend, no save rolled./);
    expect(refusal.popupHtml).toMatch(/can't take Psychic Shatter again until the start of its next turn/);

    // stamp is idempotent while stamped — no duplicate write, no round-refresh
    deps.setRuntimeValue.mockClear();
    await stampRegularActionCooldown({ action: SHATTER, monsterName: MONSTER, campaignName: 'test-campaign', deps });
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();

    // the monster's OWN turn-start clears the latch even with NO legendary
    // uses outstanding (regular monster: no uses economy, yet the :440
    // legendary-state-independent clear still runs)
    cs.activeCreatureName = MONSTER;
    const regain = await regainLegendaryUses({ monsterName: MONSTER, campaignName: 'test-campaign', deps });
    expect(regain).toEqual({ regained: false });
    expect(store[COOLDOWNS(MONSTER)]).toBeNull();

    // next turn — refire ALLOWED, fresh stamp at the new round
    cs = { round: 2, activeCreatureName: 'Bandit 1' };
    expect(regularActionCooldownRefusal({ action: SHATTER, monsterName: MONSTER, deps })).toBeNull();
    await stampRegularActionCooldown({ action: SHATTER, monsterName: MONSTER, campaignName: 'test-campaign', deps });
    expect(store[COOLDOWNS(MONSTER)]).toMatchObject({ psychic_shatter: { round: 2 } });
  });
});
