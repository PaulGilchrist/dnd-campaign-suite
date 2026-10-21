// @maintained-by-ai
// blockChecks.js module-direct lane (BASE): every blocking gate pinned individually.
// OWNERSHIP (verbatim, #1465): 'beast-spells lane owns: CLA-404 4-quadrant table,
// Shape-Shift fallback, passthrough quadrant; blockChecks is the single bypass site;
// :396 covers no-blocking-buff face' — that :396 face is kept here (B1 below).
// Hub .execute REAL-chain gate ORDER + refusal passthrough = #1454 lane
// (execution/index.js:651-687, gate order buff→globe→barriers); not re-grown here.
// Detector internals (COSTLY_OR_CONSUMED_MATERIAL_RE, registry rows) = #1450 lane;
// consumed here only via the unmocked REAL materialComponents on the caller path.
//
// GATE ENUMERATION (blockChecks.js, all exports):
//   checkBlockedBySpellcastingBuff(spell, playerStats, campaignName)
//     gate: buffs.find(b=>b.blocksSpellcasting)      disk owner: classes.json:3808
//       (Wild Shape, effect 'shape_shift' → sibling lane) and classes.json:41-58
//       (Rage: no auto.effect → combatStanceHandler.js:294 effect||'stance' →
//       buff effect 'stance' → refusalType 'stance_refused' — pinned here, B2).
//       non-blocking store → null, silent (B1). Beast bypass + material-specific
//       refusal = sibling #1465. Ruleset stance: module NEVER reads `rules`
//       (#1465 note, re-verified) — Rage row is 5e-only disk today; 2024 classes
//       carry no blocksSpellcasting row → no split needed at this seam.
//   checkGlobeOfInvulnerability(spell, targetName, playerStats, campaignName)
//     gates: level ?? baseLevel ?? 1 <= 5 (before ANY store read); targetName
//     truthy; store || [] + Array.isArray; globe te on target; attacker inside →
//     allow. te disk owner: targetEffectDefinitions.js:939 'globe_barrier'
//     (fields:['source']); row bytes mirror globeOfInvulnerabilityHandler.js:64-69
//     {target, effect, source, duration:'globe_duration'}.
//     2024 disk spells.json Globe is level 6 automation.maxBlockedSpellLevel:5 —
//     hard-coded <=5 agrees, but the field is unread: reported quirk, sanctioned
//     only insofar as both catalogs block through level 5.
//   checkForcecageBlocked(spell, targetName, playerStats, campaignName)
//     gates: !targetName early return (zero handler calls); then SHORT-CIRCUIT
//     chain Forcecage→Maze→Banishment→Imprisonment (first blocker owns the single
//     popup+log; later barriers never consulted). Side-detection internals are
//     each handler's own lane (handler tests, cf. imprisonmentHandler.helpers
//     .test.js:11); this lane mocks the four and pins wiring: tuple
//     (caster, target, campaign), branch message bytes, chain order, log-once.
//   beastSpellsAllowsCast — externally DEAD export (only internal caller
//     blockChecks.js:31; grep src+server finds no other importer; #1465 finding
//     re-confirmed). Full truth table owned by sibling blockChecks.beast-spells
//     .test.js — zero rows here (no re-grow); removal is a source edit:
//     report-only, out of scope.
//
// MOCK COMPLETENESS vs blockChecks.js imports, line-by-line: useRuntimeState
// (getRuntimeValue+setRuntimeValue — set needed by REAL materialComponents),
// logService.addEntry, forcecage/maze/banishment/imprisonment handlers, dynamic
// ./spellResolution.js getActiveBuffs. REAL always: blockChecks.js itself and
// ../../materialComponents.js (spellHasCostlyOrConsumedMaterial is pure
// regex+registry; its fetch on :117 sits in consumeMaterial — never traversed
// here, so no URL-aware stub needed).
//
// QUIRK CENSUS: no clock reads anywhere (blocking instantaneous; NO-CLOCK policy
// respected; Date.now only as log metadata, #1367 family); no HP-key traversal
// (grep currentHp/hp empty — N/A); :0-swallow: none — every refusal logs
// (CLA-391 'never silent' honored, log bytes pinned); silent-null guards:
// spell.level/baseLevel ?? default-1 (pinned via message byte) and null-store
// || [] (#1441 family, documented-silent-allow sanctioned); golden unguarded
// path: addEntry rejection must NOT turn the gate into a throw — .catch +
// console.error('[blockChecks:log-error]') pinned once (G1 last row); the
// identical .catch exists at 5 sites (globe + 4 barrier branches — inline-dup
// chokepoint declared, mirror bytes, one non-throw row suffices); simplifiable
// dup: globeEffects filter (:68) scans the same array as globeEffect find (:69)
// with an overlapping predicate (fresh-form equivalent of #1465 :32 —
// report-only); store key is the literal 'campaign' — campaignName param never
// reaches getRuntimeValue (tuple pinned, quirk-by-design).
// Case-gate trails: none — disk keys compared lowercase-canonical
// ('globe_barrier','shape_shift'); refusalType is the only case transform
// (:34, 'stance' → 'stance_refused' pinned byte in B2).
//
// PRESERVED-CITED-BY (semantics kept; line numbers shift old→new):
//   spellCastService.special.test.js:40/:431 cites blockChecks.test.js:208-255
//     (checkForcecageBlocked unit rows) → NEW F-suite below.
//   globeOfInvulnerabilityService.test.js:27 cites this file for inbound-spell
//     block semantics → NEW G-suite below.
//   spellCastService.execute.test.js:37 cites 'block gates payload/log bytes'
//     → toStrictEqual full-object rows below.
//   imprisonmentHandler.helpers.test.js:11 expects blockChecks consumer to MOCK
//     isImprisonmentBlocked → kept mocked.
//   #1465 cites old :396 'no-blocking-buff face' → kept as B1.
//
// KILL MATRIX (per surviving test):
//   B1: blockingBuff-always-truthy; getActiveBuffs-arg-swap; silent-refusal.
//   B2: refusalType-not-lowercased/not-underscored; blockName fallback-order
//       swap (effect before name); automationDetail leaking 'material_component';
//       creatureName/characterName swap; popup bytes.
//   G1: threshold-<-mutant (lv5 boundary row must block); level interpolation in
//       both messages; || instead of ?? (Fire Bolt lv0 row); baseLevel fallback;
//       default-1 (trimmed ref); log creatureName=globe-source-not-attacker;
//       addEntry-reject-throw mutant + console-error tag (last row).
//   G2: level-gate-after-store-read reorder (store never touched);
//       targetName-truthy dropped (would read store); threshold-6-blocks mutant.
//   G3: Array.isArray dropped (object store crashes filter); || [] dropped;
//       store-key tuple ('campaign','targetEffects') vs param mutant.
//   G4: target-key dropped from find (other target's globe would block);
//       effect-key dropped (foresight row would block).
//   G5: attacker-protected some() dropped (block-both mutant).
//   F1: !targetName dropped (handlers consulted on null/'' target).
//   F2: branch name/description bytes; chain order + short-circuit (later
//       stubs TRUE — consulting them is the bug); run-all-adopt-last mutant
//       (addEntry toHaveBeenCalledTimes(1)); handler arg-tuple order.
//   F3: chain-incomplete mutant (all four consulted, invocationCallOrder
//       strictly ascending); null passthrough; zero-log.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/handlers/spells/forcecageHandler.js', () => ({
  isForcecageBlocked: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/spells/mazeHandler.js', () => ({
  isMazeBlocked: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/spells/banishmentHandler.js', () => ({
  isBanishmentBlocked: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/spells/imprisonmentHandler.js', () => ({
  isImprisonmentBlocked: vi.fn(() => false),
}));

vi.mock('./spellResolution.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../../ui/logService.js');
const { getActiveBuffs } = await import('./spellResolution.js');
const { isForcecageBlocked } = await import('../../../../automation/handlers/spells/forcecageHandler.js');
const { isMazeBlocked } = await import('../../../../automation/handlers/spells/mazeHandler.js');
const { isBanishmentBlocked } = await import('../../../../automation/handlers/spells/banishmentHandler.js');
const { isImprisonmentBlocked } = await import('../../../../automation/handlers/spells/imprisonmentHandler.js');
const { checkBlockedBySpellcastingBuff, checkGlobeOfInvulnerability, checkForcecageBlocked } = await import('./blockChecks.js');

// Disk-faithful spell refs (levels verified against public/data/spells.json,
// 2026-10-21: Fire Bolt 0, Fireball 3, Cone of Cold 5, Disintegrate 6).
const FIRE_BOLT = { name: 'Fire Bolt', level: 0, components: ['V', 'S'], material: null };
const FIREBALL = { name: 'Fireball', level: 3, components: ['V', 'S', 'M'], material: 'A tiny ball of bat guano and sulfur.' };
const CONE_OF_COLD = { name: 'Cone of Cold', level: 5, components: ['V', 'S', 'M'], material: 'A small crystal or glass cone.' };
const DISINTEGRATE = { name: 'Disintegrate', level: 6, components: ['V', 'S', 'M'], material: 'A lodestone and a pinch of dust.' };

// Globe te rows mirror globeOfInvulnerabilityHandler.js:64-69 bytes exactly.
function globeTe(target, source) {
  return { target, effect: 'globe_barrier', source, duration: 'globe_duration' };
}

const WIZARD = { name: 'TestWizard' };

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeValue.mockReturnValue([]);
  addEntry.mockResolvedValue(undefined);
  getActiveBuffs.mockReturnValue([]);
  isForcecageBlocked.mockReturnValue(false);
  isMazeBlocked.mockReturnValue(false);
  isBanishmentBlocked.mockReturnValue(false);
  isImprisonmentBlocked.mockReturnValue(false);
});

/* ------------------------------------------------------------------ */
/*  checkGlobeOfInvulnerability — inbound-spell block (G1-G5)         */
/* ------------------------------------------------------------------ */

describe('checkGlobeOfInvulnerability', () => {
  it('blocks spells of level 5 or lower cast at a globed target from outside — boundary level 5 blocks, ??/default-1 resolution pinned in message bytes, exact popup object, full log key set attributed to the globe source, and a rejecting addEntry still yields the refusal (golden non-throw)', async () => {
    getRuntimeValue.mockReturnValue([globeTe('Goblin', 'Mage')]);
    const rows = [
      // ?? not ||: level 0 stays 0 and blocks (cantrips included, per Globe text).
      { spell: FIRE_BOLT, level: 0 },
      { spell: FIREBALL, level: 3 },
      { spell: { name: 'Fireball', level: undefined, baseLevel: 3 }, level: 3 },
      // Trimmed ref, no level/baseLevel → documented default 1 in message byte.
      { spell: { name: 'Fireball' }, level: 1 },
      // Boundary (kills threshold `<5` mutant).
      { spell: CONE_OF_COLD, level: 5 },
    ];
    let consoleSpy;
    const logError = new Error('log down');
    for (let i = 0; i < rows.length; i++) {
      vi.clearAllMocks();
      addEntry.mockResolvedValue(undefined);
      const { spell, level } = rows[i];
      if (i === rows.length - 1) {
        addEntry.mockRejectedValue(logError);
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      }
      const expectedPopup = {
        automationPopup: {
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Globe of Invulnerability',
            description: `${spell.name} (level ${level}) is blocked by Globe of Invulnerability protecting Goblin.`,
          },
        },
      };
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', WIZARD, 'test-campaign');
      expect(result).toStrictEqual(expectedPopup);
      expect(addEntry).toHaveBeenCalledTimes(1);
      const [campaign, entry] = addEntry.mock.calls[0];
      expect(campaign).toBe('test-campaign');
      const { timestamp, ...rest } = entry;
      expect(typeof timestamp).toBe('number');
      if (i === rows.length - 1) {
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0][0]).toBe('[blockChecks:log-error]');
        expect(consoleSpy.mock.calls[0][1]).toBe(logError);
        consoleSpy.mockRestore();
      } else {
        expect(rest).toStrictEqual({
          type: 'automation',
          // Quirk pinned: log creatureName is the globe's SOURCE, not the attacker.
          creatureName: 'Mage',
          name: 'Globe of Invulnerability',
          description: `${spell.name} (level ${level}) from TestWizard blocked — target is protected by Globe of Invulnerability.`,
        });
      }
    }
  });

  it('allows above-threshold and untargeted casts WITHOUT ever reading the targetEffects store (level/target gates precede the store read)', async () => {
    // Store populated — consulting it would block Fireball rows; none may touch it.
    getRuntimeValue.mockReturnValue([globeTe('Goblin', 'Mage')]);
    expect(await checkGlobeOfInvulnerability(DISINTEGRATE, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    expect(await checkGlobeOfInvulnerability({ name: 'Disintegrate', level: undefined, baseLevel: 6 }, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    expect(await checkGlobeOfInvulnerability(FIREBALL, null, WIZARD, 'test-campaign')).toBeNull();
    expect(await checkGlobeOfInvulnerability(FIREBALL, '', WIZARD, 'test-campaign')).toBeNull();
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('allows when the stored targetEffects are missing, falsy, or non-array (|| [] and Array.isArray guards) and reads the literal (campaign, targetEffects) key pair', async () => {
    for (const store of [null, undefined, 0, {}, 'nope']) {
      vi.clearAllMocks();
      getRuntimeValue.mockReturnValue(store);
      expect(await checkGlobeOfInvulnerability(FIREBALL, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
      expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
    }
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('allows when the globe protects someone else and when the on-target row is a different effect — find matches BOTH target and effect keys', async () => {
    getRuntimeValue.mockReturnValue([
      globeTe('Orc', 'Mage'),
      { target: 'Goblin', effect: 'foresight', source: 'Mage', duration: 'concentration' },
    ]);
    expect(await checkGlobeOfInvulnerability(FIREBALL, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('allows when the attacker stands inside ANY globe protecting the same target — attacker some() gate, globe source never consulted', async () => {
    getRuntimeValue.mockReturnValue([globeTe('Goblin', 'Mage'), globeTe('TestWizard', 'OtherMage')]);
    expect(await checkGlobeOfInvulnerability(FIREBALL, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  checkForcecageBlocked — barrier chain (F1-F3)                     */
/* ------------------------------------------------------------------ */

describe('checkForcecageBlocked', () => {
  it('returns null for null/empty target WITHOUT consulting any barrier handler (all four stubbed TRUE to prove the guard precedes every call)', async () => {
    isForcecageBlocked.mockReturnValue(true);
    isMazeBlocked.mockReturnValue(true);
    isBanishmentBlocked.mockReturnValue(true);
    isImprisonmentBlocked.mockReturnValue(true);
    for (const target of [null, '']) {
      expect(await checkForcecageBlocked(FIREBALL, target, WIZARD, 'test-campaign')).toBeNull();
    }
    expect(isForcecageBlocked).not.toHaveBeenCalled();
    expect(isMazeBlocked).not.toHaveBeenCalled();
    expect(isBanishmentBlocked).not.toHaveBeenCalled();
    expect(isImprisonmentBlocked).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('each barrier in Forcecage→Maze→Banishment→Imprisonment order owns one exact popup and one full log entry, consults its handler with (caster, target, campaign), and short-circuits all later barriers even when they would also block', async () => {
    const barriers = [
      { stub: isForcecageBlocked, name: 'Forcecage', place: 'prison' },
      { stub: isMazeBlocked, name: 'Maze', place: 'demiplane' },
      { stub: isBanishmentBlocked, name: 'Banishment', place: 'demiplane' },
      { stub: isImprisonmentBlocked, name: 'Imprisonment', place: 'prison' },
    ];
    for (let i = 0; i < barriers.length; i++) {
      vi.clearAllMocks();
      // Earlier barriers clear, this barrier blocks, LATER barriers would block
      // too if consulted — consulting them at all is the bug.
      barriers.forEach((b, j) => b.stub.mockReturnValue(j >= i));
      const barrier = barriers[i];
      const result = await checkForcecageBlocked(FIREBALL, 'Goblin', WIZARD, 'test-campaign');
      expect(result).toStrictEqual({
        automationPopup: {
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: barrier.name,
            description: `Fireball is blocked by ${barrier.name}. TestWizard and Goblin are on opposite sides of the ${barrier.place}, and no attack, spell, or effect can pass through it.`,
          },
        },
      });
      expect(barrier.stub).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
      barriers.slice(i + 1).forEach((later) => expect(later.stub).not.toHaveBeenCalled());
      expect(addEntry).toHaveBeenCalledTimes(1);
      const [campaign, entry] = addEntry.mock.calls[0];
      expect(campaign).toBe('test-campaign');
      const { timestamp, ...rest } = entry;
      expect(typeof timestamp).toBe('number');
      expect(rest).toStrictEqual({
        type: 'automation',
        creatureName: 'TestWizard',
        name: barrier.name,
        description: `Fireball from TestWizard blocked by ${barrier.name} — TestWizard and Goblin are on opposite sides of the ${barrier.place}.`,
      });
    }
  });

  it('returns null after consulting all four barriers in strict order when none block, logging nothing', async () => {
    expect(await checkForcecageBlocked(FIREBALL, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    expect(isForcecageBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
    expect(isMazeBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
    expect(isBanishmentBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
    expect(isImprisonmentBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
    expect(isForcecageBlocked.mock.invocationCallOrder[0]).toBeLessThan(isMazeBlocked.mock.invocationCallOrder[0]);
    expect(isMazeBlocked.mock.invocationCallOrder[0]).toBeLessThan(isBanishmentBlocked.mock.invocationCallOrder[0]);
    expect(isBanishmentBlocked.mock.invocationCallOrder[0]).toBeLessThan(isImprisonmentBlocked.mock.invocationCallOrder[0]);
    expect(addEntry).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  checkBlockedBySpellcastingBuff — CLA-391 base face (B1-B2)       */
/*  Wild Shape bytes + Beast Spells quadrants: sibling #1465 lane.   */
/* ------------------------------------------------------------------ */

describe('checkBlockedBySpellcastingBuff (CLA-391)', () => {
  it('returns null and logs nothing when no buff blocks spellcasting — empty store and buff row without the flag (queried by (playerName, campaign))', async () => {
    // Second row bytes mirror buffService.js:27 (Innate Sorcery activeBuffs row).
    for (const buffs of [[], [{ name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' }]]) {
      vi.clearAllMocks();
      getActiveBuffs.mockReturnValue(buffs);
      expect(await checkBlockedBySpellcastingBuff(FIREBALL, WIZARD, 'test-campaign')).toBeNull();
      expect(getActiveBuffs).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    }
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('refuses a non-beast caster under Rage with stance_refused log bytes and exact generic popup — buff row from combatStanceHandler (effect falls back to "stance"), blockName from buff.name', async () => {
    // Disk chain: classes.json Barbarian Rage automation (no effect key,
    // blocksSpellcasting:true) → combatStanceHandler.js:294 auto.effect||'stance'.
    getActiveBuffs.mockReturnValue([{ name: 'Rage', effect: 'stance', duration: 'until_next_turn_extendable', resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'], advantages: [], damageBonusExpression: 'rage_damage', blocksSpellcasting: true, optionName: null, noArmor: false, range: null, flySpeed: null, reactionSave: null, isImprovedDuplicity: false }]);
    const barbarian = { name: 'TestBarbarian' };

    const result = await checkBlockedBySpellcastingBuff(FIREBALL, barbarian, 'test-campaign');

    expect(result).toStrictEqual({
      automationPopup: {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Rage',
          description: 'Fireball cannot be cast while TestBarbarian is under Rage — no Spellcasting is allowed.',
        },
      },
    });
    expect(addEntry).toHaveBeenCalledTimes(1);
    const [campaign, entry] = addEntry.mock.calls[0];
    expect(campaign).toBe('test-campaign');
    const { timestamp, ...rest } = entry;
    expect(typeof timestamp).toBe('number');
    expect(rest).toStrictEqual({
      type: 'automation',
      automationType: 'stance_refused',
      automationDetail: undefined,
      creatureName: 'TestBarbarian',
      characterName: 'TestBarbarian',
      name: 'Rage',
      description: 'Fireball blocked — TestBarbarian cannot cast spells while under Rage.',
    });
  });
});
