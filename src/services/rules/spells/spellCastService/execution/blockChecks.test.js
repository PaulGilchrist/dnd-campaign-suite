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
//     gates: targetName truthy (before ANY store read); store || [] + Array.isArray;
//     globe te on target; attacker inside → allow; THEN disk threshold read
//     #1466: maxBlockedSpellLevel via loadSpells(playerStats.rules) (disk owners
//     public/data/spells.json:4692 + 2024/spells.json:6226, both 5); missing key →
//     console.error('[blockChecks:globe-threshold-drift]') + exported fallback (D-suite).
//     te disk owner: targetEffectDefinitions.js:939 'globe_barrier'
//     (fields:['source']); row bytes mirror globeOfInvulnerabilityHandler.js:64-69
//     {target, effect, source, duration:'globe_duration'}.
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
// logService.addEntry, dataLoader.loadSpells (#1466 disk threshold read — stubbed
// disk-faithfully with the real Globe row bytes), forcecage/maze/banishment/
// imprisonment handlers, dynamic ./spellResolution.js getActiveBuffs. REAL always:
// blockChecks.js itself and
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
//   G2: untargeted-guard dropped (would read store); threshold-gate dropped
//       (lv6 would block); disk consulted ONLY on the block branch (loadSpells
//       times-0 on allow arms) — #1466 reorder pinned honestly: store IS read
//       at above-threshold targeted casts (threshold lives on disk, not code).
//   D (new #1466): disk-threshold-ignore mutant (disk=2 must let lv5 through);
//       off-by-one at mutated threshold (lv2 blocks); drift console-error tag +
//       exported fallback when the disk row lacks the key; DISK PARITY contract
//       pins both real disk files' automation.maxBlockedSpellLevel to the export
//       (fix#81 mirror-parity-contract: disk edits move the engine, drift alarms).
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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// #1466: stubbed with the REAL Globe row bytes from public/data/spells.json:4658-4693
// (and 2024 :6192-6227 — identical automation block); the D-suite mutates the threshold
// to prove the engine obeys it and pins both disk files against the exported fallback.
vi.mock('../../../../ui/dataLoader.js', () => ({
  loadSpells: vi.fn(),
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
const { loadSpells } = await import('../../../../ui/dataLoader.js');
const { getActiveBuffs } = await import('./spellResolution.js');
const { isForcecageBlocked } = await import('../../../../automation/handlers/spells/forcecageHandler.js');
const { isMazeBlocked } = await import('../../../../automation/handlers/spells/mazeHandler.js');
const { isBanishmentBlocked } = await import('../../../../automation/handlers/spells/banishmentHandler.js');
const { isImprisonmentBlocked } = await import('../../../../automation/handlers/spells/imprisonmentHandler.js');
const { checkBlockedBySpellcastingBuff, checkGlobeOfInvulnerability, checkForcecageBlocked, GLOBE_MAX_BLOCKED_SPELL_LEVEL_FALLBACK } = await import('./blockChecks.js');

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

// Disk-faithful Globe automation (public/data/spells.json:4688-4693 verified bytes);
// the D-suite pins the REAL files, so this fixture is the runtime-read stub.
const GLOBE_DISK_ROW = {
  name: 'Globe of Invulnerability',
  level: 6,
  automation: { type: 'globe_of_invulnerability', duration: 'Concentration, up to 1 minute', auraRange: 10, maxBlockedSpellLevel: 5 },
};

const WIZARD = { name: 'TestWizard' };

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeValue.mockReturnValue([]);
  addEntry.mockResolvedValue(undefined);
  loadSpells.mockResolvedValue([GLOBE_DISK_ROW]);
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

  it('#1466 reorder: UNtargeted casts return before the store read (zero store, zero disk); targeted above-threshold casts read the store and consult the disk threshold on the block branch but never block or log', async () => {
    // Store populated — consult is expected now (threshold lives on disk, evaluated after
    // the te lookup); blocking is what must NOT happen at level 6 > disk 5.
    getRuntimeValue.mockReturnValue([globeTe('Goblin', 'Mage')]);
    expect(await checkGlobeOfInvulnerability(DISINTEGRATE, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    expect(await checkGlobeOfInvulnerability({ name: 'Disintegrate', level: undefined, baseLevel: 6 }, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    expect(getRuntimeValue).toHaveBeenCalledTimes(2);
    expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
    expect(loadSpells).toHaveBeenCalledTimes(2);
    expect(loadSpells).toHaveBeenCalledWith('5e');
    expect(addEntry).not.toHaveBeenCalled();

    // Untargeted: the guard precedes EVERY read (kill: guard-drop mutant).
    expect(await checkGlobeOfInvulnerability(FIREBALL, null, WIZARD, 'test-campaign')).toBeNull();
    expect(await checkGlobeOfInvulnerability(FIREBALL, '', WIZARD, 'test-campaign')).toBeNull();
    expect(getRuntimeValue).toHaveBeenCalledTimes(2);
    expect(loadSpells).toHaveBeenCalledTimes(2);
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

  it('allows when the globe protects someone else and when the on-target row is a different effect — find matches BOTH target and effect keys, disk NEVER consulted when no globe shields the target', async () => {
    getRuntimeValue.mockReturnValue([
      globeTe('Orc', 'Mage'),
      { target: 'Goblin', effect: 'foresight', source: 'Mage', duration: 'concentration' },
    ]);
    expect(await checkGlobeOfInvulnerability(FIREBALL, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
    expect(loadSpells).not.toHaveBeenCalled();
  });

  it('allows when the attacker stands inside ANY globe protecting the same target — attacker some() gate, globe source never consulted, disk NEVER consulted on the allow arm', async () => {
    getRuntimeValue.mockReturnValue([globeTe('Goblin', 'Mage'), globeTe('TestWizard', 'OtherMage')]);
    expect(await checkGlobeOfInvulnerability(FIREBALL, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
    expect(loadSpells).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  #1466 disk-driven threshold + mirror-parity contract (D-suite)    */
/* ------------------------------------------------------------------ */

describe('checkGlobeOfInvulnerability — #1466 disk-driven threshold', () => {
  it('obeys a MUTATED disk threshold: automation.maxBlockedSpellLevel 2 lets Cone of Cold lv5 THROUGH (pre-fix hardcoded <=5 blocked — disk edits did nothing) and still blocks AT the mutated threshold', async () => {
    getRuntimeValue.mockReturnValue([globeTe('Goblin', 'Mage')]);
    loadSpells.mockResolvedValue([{ ...GLOBE_DISK_ROW, automation: { ...GLOBE_DISK_ROW.automation, maxBlockedSpellLevel: 2 } }]);
    expect(await checkGlobeOfInvulnerability(CONE_OF_COLD, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
    // boundary AT the mutated threshold still blocks (kills `<2` mutant).
    const result = await checkGlobeOfInvulnerability({ name: 'Web', level: 2 }, 'Goblin', WIZARD, 'test-campaign');
    expect(result).toStrictEqual({
      automationPopup: {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Globe of Invulnerability',
          description: 'Web (level 2) is blocked by Globe of Invulnerability protecting Goblin.',
        },
      },
    });
    // ruleset routing: 2024 caster reads the 2024 catalog (both pinned equal by parity).
    await checkGlobeOfInvulnerability({ name: 'Web', level: 2 }, 'Goblin', { name: 'TestWizard', rules: '2024' }, 'test-campaign');
    expect(loadSpells).toHaveBeenLastCalledWith('2024');
  });

  it('drift alarm: disk row WITHOUT automation.maxBlockedSpellLevel logs [blockChecks:globe-threshold-drift] once and gates at the exported RAW fallback 5', async () => {
    getRuntimeValue.mockReturnValue([globeTe('Goblin', 'Mage')]);
    loadSpells.mockResolvedValue([{ name: 'Globe of Invulnerability', level: 6 }]);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await checkGlobeOfInvulnerability(CONE_OF_COLD, 'Goblin', WIZARD, 'test-campaign');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[blockChecks:globe-threshold-drift]'));
    expect(result?.automationPopup?.payload?.description).toContain('blocked by Globe of Invulnerability protecting Goblin');
    expect(await checkGlobeOfInvulnerability(DISINTEGRATE, 'Goblin', WIZARD, 'test-campaign')).toBeNull();
    consoleSpy.mockRestore();
  });

  it('DISK PARITY CONTRACT (fix#81 mirror-parity-contract): REAL bytes of both ruleset catalogs pin the Globe automation threshold to the exported fallback — an untested disk edit away from the fallback turns this row RED', async () => {
    const spells5eDisk = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8'));
    const spells2024Disk = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
    for (const [version, list] of [['5e', spells5eDisk], ['2024', spells2024Disk]]) {
      const row = list.find(s => s && s.name === 'Globe of Invulnerability');
      expect(row, `Globe row absent from ${version} spells.json`).toBeTruthy();
      expect(row.level).toBe(6);
      // Law-vs-number drift detector: description must still say the threshold level
      // (5e: "spell of 5th level or lower" :4661; 2024: "spell of level 5 or lower").
      const text = row.description.join(' ');
      expect(text).toMatch(/(?:5th level|level 5) or lower/);
      expect(row.automation.maxBlockedSpellLevel, `disk drift alarm: ${version} spells.json`).toBe(GLOBE_MAX_BLOCKED_SPELL_LEVEL_FALLBACK);
    }
    expect(GLOBE_MAX_BLOCKED_SPELL_LEVEL_FALLBACK).toBe(5);
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
