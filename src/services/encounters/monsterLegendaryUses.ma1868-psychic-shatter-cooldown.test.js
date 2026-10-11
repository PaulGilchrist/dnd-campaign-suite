// MA-1868: Cthulhu "Psychic Shatter" — regular (non-legendary) action row,
// numeric save_dc → the save chip resolves through the regular save-chip lane
// (MonsterCardModal handleSaveRoll) and NEVER reaches expendLegendaryUse, so
// the MA-0073 per-action cooldown gate never armed: pre-fix the chip re-fired
// unlimited times per turn (live probe: 2/2 fires, 0 refused). Fix = DATA
// structured field `once_per_turn: true` on cthulhu.actions[3] + regular-row
// helpers in monsterLegendaryUses.js riding the SAME MA-0073 latch:
// `monsterLegendaryActionCooldowns` map, legendaryActionSlug, the refusal
// popup/log vocabulary (`<slug>_refused (once per turn)`, zero save rolled)
// and the EXISTING turn-start clear in regainLegendaryUses (:361 — the clear
// is legendary-state-independent, so it already runs for regular monsters).
// `hasLegendaryCooldownClause` stays byte-identical: the MA-0073 prose regex
// matches "can't TAKE this action again until the START OF ITS next turn" —
// Cthulhu's "can't USE … until ITS next turn" wording deliberately never
// matches it; the regular lane arms ONLY on the structured field (precision,
// no other row silently changes behavior).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isOncePerTurnActionRow,
  regularActionCooldownRefusal,
  stampRegularActionCooldown,
  regainLegendaryUses,
  hasLegendaryCooldownClause,
  legendaryActionSlug,
  MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY,
} from './monsterLegendaryUses.js';
import monstersData from '../../../public/data/monsters.json';

// Real regainLegendaryUses/setRuntimeValue persist via storage.set → fetch.
vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const CTHULHU = monstersData.find((m) => m.index === 'cthulhu');
const SHATTER = CTHULHU.actions[3];

let store;
let logs;
let deps;
let cs;
beforeEach(() => {
  store = {};
  logs = [];
  cs = { round: 1, activeCreatureName: 'Bandit 1' };
  deps = {
    getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
    setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
    addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
    getCombatContext: vi.fn(() => Promise.resolve(cs)),
  };
});

describe('MA-1868 disk fingerprint: cthulhu Psychic Shatter once_per_turn armed (DATA fix)', () => {
  it('row[3] authors once_per_turn:true immediately after description; save/damage/stun core byte-exact', () => {
    expect(SHATTER.name).toBe('Psychic Shatter');
    expect(SHATTER.once_per_turn).toBe(true);
    const keys = Object.keys(SHATTER);
    expect(keys.indexOf('once_per_turn')).toBe(keys.indexOf('description') + 1);
    // EXACT core (byte-unchanged by the fix):
    expect(SHATTER.save_dc).toBe(24);
    expect(SHATTER.save_type).toBe('Intelligence');
    expect(SHATTER.damage_dice_primary).toBe('6d10');
    expect(SHATTER.damage_type_primary).toBe('Psychic');
    expect(SHATTER.conditions).toEqual(['stunned']);
    expect(SHATTER.save_effect).toBe('Failure: Stunned until the end of its next turn. Success: Half damage and no Stun.');
    expect(SHATTER.description).toContain('Cthulhu can\'t use this action again until its next turn.');
    // No fake d6-recharge and no per-DAY uses lane (wrong cadence for
    // "until its next turn" — recharge would add a d6, uses:1 would over-lock):
    expect(SHATTER.recharge).toBeUndefined();
    expect(SHATTER.usage).toBeUndefined();
    expect(SHATTER.uses).toBeUndefined();
    expect(SHATTER.maxUses).toBeUndefined();
    // absent dc_success = engine default half = RAW-correct ("Success: Half damage").
    expect(SHATTER.dc_success).toBeUndefined();
  });

  it('lane is FIELD-driven, not prose-driven: the MA-0073 "take … the start of its next turn" regex NEVER matches Cthulhu wording (byte-identical legend lane)', () => {
    expect(isOncePerTurnActionRow(SHATTER)).toBe(true);
    expect(hasLegendaryCooldownClause(SHATTER)).toBe(false);
    expect(isOncePerTurnActionRow(CTHULHU.actions[1])).toBe(false); // Claw — no field
    expect(isOncePerTurnActionRow({ name: 'X', once_per_turn: 'true' })).toBe(false); // strict boolean
    expect(isOncePerTurnActionRow(null)).toBe(false);
    expect(legendaryActionSlug('Psychic Shatter')).toBe('psychic_shatter');
  });
});

describe('MA-1868 regular-row cooldown latch (MA-0073 vocabulary reuse)', () => {
  const MONSTER = 'Cthulhu 1';

  it('fire stamps the slug; every later press refused with <slug>_refused (once per turn) zero-roll; own turn-start clear re-arms', async () => {
    // un-stamped → no refusal (first press allowed)
    expect(regularActionCooldownRefusal({ action: SHATTER, monsterName: MONSTER, deps })).toBeNull();

    // successful fire: stamp once_per_turn latch
    await stampRegularActionCooldown({ action: SHATTER, monsterName: MONSTER, campaignName: 'test-campaign', deps });
    expect(store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toMatchObject({ psychic_shatter: { round: 1 } });

    // later presses — ANY active creature, same turn window — refuse; refusal
    // carries the MA-0073 byte-vocabulary (zero save rolled).
    cs.activeCreatureName = 'AasimarTest';
    const refusal = regularActionCooldownRefusal({ action: SHATTER, monsterName: MONSTER, deps });
    expect(refusal).toBeTruthy();
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
    // uses outstanding (the MA-0073 :361 clear is legendary-state-independent)
    cs.activeCreatureName = MONSTER;
    const regain = await regainLegendaryUses({ monsterName: MONSTER, campaignName: 'test-campaign', deps });
    expect(regain).toEqual({ regained: false }); // regular monster: no uses economy
    expect(store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toBeNull();

    // next turn — refire ALLOWED, fresh stamp at the new round
    cs = { round: 2, activeCreatureName: 'Bandit 1' };
    expect(regularActionCooldownRefusal({ action: SHATTER, monsterName: MONSTER, deps })).toBeNull();
    await stampRegularActionCooldown({ action: SHATTER, monsterName: MONSTER, campaignName: 'test-campaign', deps });
    expect(store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toMatchObject({ psychic_shatter: { round: 2 } });
  });

  it('rows without once_per_turn are byte-inert: never consult, never stamp', async () => {
    const claw = CTHULHU.actions[1]; // "Claw" — plain attack row
    store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`] = { claw: { round: 1 } };
    expect(regularActionCooldownRefusal({ action: claw, monsterName: MONSTER, deps })).toBeNull();
    deps.setRuntimeValue.mockClear();
    await stampRegularActionCooldown({ action: claw, monsterName: MONSTER, campaignName: 'test-campaign', deps });
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toEqual({ claw: { round: 1 } }); // untouched
  });

  it('turn-start with nothing stamped: no spurious cooldown writes (MA-0073 :701 twin)', async () => {
    const r = await regainLegendaryUses({ monsterName: 'Nobody 1', campaignName: 'test-campaign', deps });
    expect(r).toEqual({ regained: false });
    expect(deps.setRuntimeValue.mock.calls.some((c) => String(c[1]).includes(MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY))).toBe(false);
  });
});
