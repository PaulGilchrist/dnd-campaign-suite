// @maintained-by-ai
// Lane #1056 — sacredWeapon (attack-step): while an active Sacred Weapon buff exists, a
// melee/unarmed attack's damage-type byte is converted to the channeller's damageTypeChoice.
// Sacred-weapon family map:
//   - automation/handlers/class-cleric-paladin/sacredWeaponHandler.js OWNS the store write:
//     activateSacredWeapon stamps activeBuffs entry { name:'Sacred Weapon', effect:'sacred_weapon',
//     duration, damageTypeChoice: chosen?.damageType || null } keyed by (playerName, campaignName)
//     (sacredWeaponHandler.js:118-127). Activation/expiry is NOT this lane.
//   - automationCollector.sacredWeapon.test.js pins the collector emitting the passive
//     { name:'Sacred Weapon', effect:'sacred_weapon' } consumed at sacredWeapon.js:10 —
//     passive collection is NOT this lane.
//   - SacredWeaponModal / CharActions.sacredWeapon2024 cover the UI choice flow — not here.
//   - This lane owns: condition weapon gate (sacredWeapon.js:6-7) + handler byte-copy
//     (sacredWeapon.js:9-20): exact passive match → null; else campaign-keyed store read →
//     exact buff match → truthy damageTypeChoice copies onto ctx.attack.damageType →
//     prevData passes through VERBATIM ({ data: prevData }, same reference, #993).
// Consulted-bytes census (#967): weaponType ∈ {melee,unarmed}; passive/buff name/effect exact
// === (#950); damageTypeChoice truthiness (handler stores null per sacredWeaponHandler.js:121).
// Quirk pinned honestly: condition gates on passives *presence* only (an empty array passes —
// sacredWeapon.js:7 `!!...passives`); the handler's exact-match at :10 is the true gate.
// Handler has NO weapon-type check — condition is the sole weapon gate (fixed in the truth
// table below; the application test runs unarmed to prove the handler is weapon-agnostic).
// Old→new map: 34 tests → 5 (weapon/passives permutations → condition truth table +
// short-circuit-honesty row #1055; early-return permutations → refusal table with zero
// side-effects #936; no-choice permutations → falsy-choice table; store fidelity +
// planted-wrong-campaign/wrong-character falsifiers #1019/#1021/#1050 folded into the
// single exact-full-result application run #829/#1022; minimal-prevData runs were vacuous).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────
// Pure: the source's only import is getRuntimeValue (sacredWeapon.js:1) — dead-mock purge #1049.

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { sacredWeapon } from './sacredWeapon.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ───────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const PALADIN = 'Paladin1';

function makeCtx(overrides = {}) {
  return {
    campaignName: CAMPAIGN,
    playerStats: { name: PALADIN },
    attack: {},
    ...overrides,
  };
}

function withPassives(passives) {
  return { name: PALADIN, automation: { passives } };
}

const SW_PASSIVE = { name: 'Sacred Weapon', effect: 'sacred_weapon' };

// Faithful campaign-keyed store (#1019/#1021): only the (PALADIN, activeBuffs, CAMPAIGN)
// lane serves real buffs; other characters/campaigns return decoy lanes, never consulted.
function armBuffStore(buffs) {
  getRuntimeValue.mockImplementation((name, key, campaign) =>
    name === PALADIN && key === 'activeBuffs' && campaign === CAMPAIGN ? buffs : []
  );
}

// ── Tests ────────────────────────────────────────────────────────

describe('sacredWeapon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Source carries [sw-debug] console.log lines (leftover debug noise — reported upstream);
    // silence them without asserting on log bytes.
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Truth table over consulted bytes (condition, sacredWeapon.js:6-7). The empty-passives
  // row pins the presence-only quirk honestly: condition true is NOT enough to apply —
  // the handler table below shows the empty array yields null.
  it.each([
    ['melee, armed passive', 'melee', [SW_PASSIVE], true],
    ['unarmed, armed passive', 'unarmed', [SW_PASSIVE], true],
    ['melee, empty passives array (presence-only check)', 'melee', [], true],
    ['ranged (armed passive present)', 'ranged', [SW_PASSIVE], false],
    ['thrown (armed passive present)', 'thrown', [SW_PASSIVE], false],
    ['weaponType missing', undefined, [SW_PASSIVE], false],
    ['weaponType empty string', '', [SW_PASSIVE], false],
    ['automation missing', 'melee', undefined, false],
  ])('condition: %s → %s', (_label, weaponType, passives, expected) => {
    const ctx = makeCtx({
      attack: { weaponType },
      playerStats: passives === undefined ? { name: PALADIN } : withPassives(passives),
    });
    expect(sacredWeapon.condition(ctx)).toBe(expected);
  });

  // && short-circuit honesty (#1055): a failing weapon byte never touches playerStats, so
  // weaponOk=false + null playerStats is false — NOT a throw. weaponOk=true + null
  // playerStats throws TypeError (no null check at sacredWeapon.js:7 — pinned honestly).
  it('short-circuits on the weapon byte, then throws on null playerStats', () => {
    expect(sacredWeapon.condition({ attack: null, playerStats: null })).toBe(false);
    expect(sacredWeapon.condition({ attack: { weaponType: 'ranged' }, playerStats: null })).toBe(false);
    expect(() => sacredWeapon.condition({ attack: { weaponType: 'melee' }, playerStats: null })).toThrow(TypeError);
  });

  // Passive gate (sacredWeapon.js:10-12): every refusal returns null, burns no store read,
  // and mutates nothing (#936). Exact-=== byte contract (#950): near-miss casing/effect
  // refuses; the collector that produces these exact bytes is pinned in its own lane.
  it.each([
    ['passives empty (condition-true quirk vs handler gate)', []],
    ['passives null', null],
    ['no Sacred Weapon passive', [{ name: 'Divine Sense', effect: 'divine_sense' }]],
    ['wrong effect byte', [{ name: 'Sacred Weapon', effect: 'wrong_effect' }]],
    ['lowercase name byte', [{ name: 'sacred weapon', effect: 'sacred_weapon' }]],
  ])('handler returns null and touches nothing when %s', async (_label, passives) => {
    const ctx = makeCtx({
      attack: { weaponType: 'melee', damageType: 'slashing' },
      playerStats: withPassives(passives),
    });
    const prevData = { formula: '1d8+3', total: 11 };

    const result = await sacredWeapon.handler(ctx, prevData);

    expect(result).toBe(null);
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(ctx.attack).toEqual({ weaponType: 'melee', damageType: 'slashing' });
  });

  // The one application run (exact full result #829, distinguishable bytes #1022):
  // exact campaign-keyed store read (#1019/#1021); radiant-flavoured decoys on the WRONG
  // campaign and WRONG character lanes are never consulted (#1050/#1052/#1055 falsifiers —
  // 'Psychic' must never land); the buff's choice OVERWRITES existing damageType while other
  // attack bytes are preserved; prevData passes through verbatim (#993, same reference).
  // Runs unarmed: the handler itself is weapon-agnostic — condition is the sole weapon gate.
  it('converts the attack damage type from the campaign-keyed buff, verbatim pass-through', async () => {
    getRuntimeValue.mockImplementation((name, key, campaign) => {
      if (name === PALADIN && key === 'activeBuffs' && campaign === CAMPAIGN) {
        return [
          { name: 'Bless', effect: 'bless' },
          { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Radiant' },
        ];
      }
      // decoy lanes: same feature, different choice byte — must never be read
      return [{ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Psychic' }];
    });

    const ctx = makeCtx({
      attack: { weaponType: 'unarmed', damageType: 'slashing', ability: 'str' },
      playerStats: withPassives([SW_PASSIVE]),
    });
    const prevData = { formula: '1d8+3', total: 11 };

    const result = await sacredWeapon.handler(ctx, prevData);

    expect(getRuntimeValue).toHaveBeenCalledTimes(1);
    expect(getRuntimeValue).toHaveBeenCalledWith(PALADIN, 'activeBuffs', CAMPAIGN);
    expect(ctx.attack).toEqual({ weaponType: 'unarmed', damageType: 'Radiant', ability: 'str' });
    expect(result).toEqual({ data: prevData });
    expect(result.data).toBe(prevData);
  });

  // Passive armed but nothing converts (sacredWeapon.js:14-17): missing store entry and
  // falsy damageTypeChoice (store writes null when no option chosen —
  // sacredWeaponHandler.js:121) all pass prevData through untouched, byte-identical.
  it.each([
    ['store empty', []],
    ['store null (|| [] guard)', null],
    ['no Sacred Weapon buff', [{ name: 'Bless', effect: 'bless' }]],
    ['buff missing damageTypeChoice', [SW_PASSIVE]],
    ['buff damageTypeChoice null (stored shape)', [{ ...SW_PASSIVE, damageTypeChoice: null }]],
    ['buff damageTypeChoice empty string', [{ ...SW_PASSIVE, damageTypeChoice: '' }]],
  ])('passes prevData through untouched when %s', async (_label, buffs) => {
    armBuffStore(buffs);
    const ctx = makeCtx({
      attack: { weaponType: 'melee', damageType: 'piercing' },
      playerStats: withPassives([SW_PASSIVE]),
    });
    const prevData = { formula: '1d8+3', total: 11 };

    const result = await sacredWeapon.handler(ctx, prevData);

    expect(result).toEqual({ data: prevData });
    expect(result.data).toBe(prevData);
    expect(ctx.attack.damageType).toBe('piercing');
  });
});
