// @maintained-by-ai
// ---------------------------------------------------------------------------
// isFreeCastAuthorized — GENERIC ORACLE lane of the free-cast family.
// Ticket lineage: #1510 (cla130 latch consumer), #1511 (cla138 T1/T2 null-coalesce),
// #1512 (rollback producer: every counter read coalesces null-and-absent identically).
// THIS file owns the oracle scan ITSELF: gate-by-gate branch presence + the
// tri-state decision bytes of isFreeCastAuthorized (spellPreparationService.js:323).
// Ticket-suffix siblings own PER-FEATURE consume/payment bytes — folded, cited,
// never re-grown here (ownership map per gate below).
//
// GATE TRUTH TABLE (FREE_CAST_CHECKS scan order, service :267-:321). REAL returns a
// BARE BOOLEAN (true ALLOW / false DENY — no {authorized, reason} object; DENY
// reasons are distinguishable only via the runtime READ ledger pinned below):
//   #1  runtimeSelectionFreeCast      naturalRecoveryFreeCast.includes(spell) OR
//       _Bewitching_Magic_freeCast truthy + spell==='Misty Step'  -> true; false->CONTINUE
//   #2  _ritualOnly/_telekineticMasterFreeCast spell-entry stamp -> true; false->CONTINUE
//       [ritualOnly sibling owns _ritualOnly bytes; #2 TK face owned here — cited by
//       spellCalc2024-telekinetic-master.test.js lane map]
//   #3  masteryOrSavantFreeCast  SpellMastery lv1/lv2 EXACT name+level; Signature lv3
//       selection && !SignatureSpells_<Spell>_used; _Divination_Savant_selection && !used
//       -> true; false->CONTINUE  [upcast gates owned by cla312/cla323 siblings]
//   #4  arcanumFreeCast  DECISIVE tri-state: not in class.arcanums -> CONTINUE;
//       spellLevel<6||>9 -> DECISIVE FALSE; else (stored ?? 1) > 0 decides, HALT.
//       [per-level key select owned by mysticArcanum sibling; DECISIVE-halt face here]
//   #5  isRitualAdeptAutoCast  [ritualAdept sibling owns CLA-299 face]
//   #6  phantasmal_creatures per-spell counter (_Phantasmal_Creatures_<Spell>_freeCastCount,
//       stored!=null?Number:usesMax, strict >0) -> true ALLOW-halt; false->CONTINUE
//   #7  shadow_arts same shape, Shadow_Arts prefix  [shadowArts sibling owns]
//   #8  scanFreeCastEntries(actions)  checkFreeCastEntry tri-state: uses_expression+usesMax
//       level/spell match -> true; perSpellTracking -> DECISIVE true/false; recharge+uses
//       -> true; shared _<Feature>_freeCast array -> true; else CONTINUE. An explicit
//       FALSE here HALTS the whole scan (rule-significant, service :93-:96/:107-:112).
//       [uses_expression lanes + bonus/special lane scans owned by
//       spellPreparationService.uncovered.isFreeCastAuthorized.test.js; Find Steed latch
//       auth owned by cla130; Fey face owned by cla138; FT-070 spent/deny bytes owned by
//       shadowTouched; shared-key consumption owned by wildCompanion]
//   #9  WGB  getRuntimeValue(name,'_War_Gods_Blessing_active') 2-arg + spell in
//       ['Shield of Faith','Spiritual Weapon'] -> true; false->CONTINUE (interleaves
//       BEFORE bonusActions scan — service :207-:311)
//   #10 scanFreeCastEntries(bonusActions)  [uncovered sibling owns lane scan]
//   #11 Mantle of Majesty  activeBuffs name-match (case-exact) + spell==='Command'.
//       Interleaves BEFORE specialActions scan — cited by
//       spellCastHandler.majesty.test.js ('own tests' => kept below, byte-pinned).
//   #12 scanFreeCastEntries(specialActions)  [uncovered sibling owns lane scan]
//   #13 auraOfVitalityFreeCast  QUIRK: spell gate is toLowerCase()-insensitive (the
//       ONLY case-insensitive name gate in the table; every other gate is case-exact,
//       #1457 trails pinned below). Reads the campaign-tier bucket literally
//       getRuntimeValue('campaign','targetEffects',campaign) — app-wide pattern
//       (SavePromptModal/savePromptUtils/CharSheet read the same literal keys: cited,
//       not changed). te.target must equal the caster name.
//       #1528 VERDICT 2026-10-22: DISPROVEN — 'campaign' is the store's declared TIER
//       selector (CAMPAIGN_KEYS[0], campaignKeys.js:7; producer registerTargetEffect
//       writes it there, targetEffectDefinitions.js:1507/:1519), never a misplaced
//       playerName; owner connects via te.target. Machine-census row added below.
//   #14 concentrationRecastFreeCast  spell in ['Eyebite','Spiritual Weapon','Shapechange']
//       (case-exact table) && getCombatSummary(campaign).creatures[name].concentration
//       .spell === spell; null combat summary -> false.  [prepareSpellCast concentration
//       management owned by spellPreparationService.test.js; auth table face here]
//   #15 default  all checks -> false (HALT).
//
// DISK CENSUS (readFileSync drift-throw, #1509-#1512 streak; both rulesets):
// every feature/spell/automation fixture below is DERIVED from REAL rows — zero
// fabricated names (the old 'Test Feature' fixtures are retired):
//   2024 classes.json  Wizard>Illusionist lv6 'Phantasmal Creatures' (freeCastSpells
//     exactly ['Summon Beast','Summon Fey'], usesMax 1, recharge long_rest);
//     Wizard lv18 'Spell Mastery'; Wizard lv20 'Signature Spells'; Wizard>Diviner lv3
//     'Divination Savant'; Bard>College of Glamour lv6 'Mantle of Majesty'
//     (free_spell 'Command', freeCasts:'at_will_while_active'); Cleric major lv6
//     free_spell ['Shield of Faith','Spiritual Weapon'] recharge 'short_or_long_rest'
//     (War God's Blessing lane); Warlock>Archfey lv14 'Bewitching Magic'
//     (type bewitching_magic — producer latch, consumer truth-table here; rollback
//     producer side owned by #1512 lane); Fighter>Psi Warrior lv18 'Telekinetic Master'.
//   2024 feats.json  'Shadow Touched' free_spell ['Invisibility'] perSpellTracking
//     long_rest (scan-halt fixture); 'Fey Touched' sibling row cited, not re-grown.
//   5e census: FREE_CAST_ENTRY_TYPES dispatch on 5e data = Ranger lv1 Hunter's Mark
//     free_spell (recharge, NO uses -> recharge gate inert at :88 uses==null guard;
//     shared-array fallback owned by uncovered sibling). recharge-kind table already
//     exists in the #1512 lane — cited, not re-enumerated; dawn/level/none kinds do
//     not exist either direction (#1512 dead-twin gold).
//   DEAD-TWIN REPORT (report-only, #1512 Detect-Thoughts-inert precedent):
//     misty_wanderer disk row carries NO spell byte, so entrySpells([undefined]) can
//     never match a spell cast in #8/#10/#12 — inert BY DESIGN on the auth side
//     (its latch lane is consume-side, cla130-shaped). No oracle row grows for it.
//
// ARITY / READ-FORM LEDGER (vs REAL, #1510 corrected-from-destructure canon):
//   isFreeCastAuthorized.length === 5 and it is SYNCHRONOUS (returns bare boolean,
//   never a Promise — pinned in the default-deny test). Two read tiers coexist and
//   both are byte-pinned as the pre-existing pattern (cited, not changed):
//   2-arg default tier: runtimeSelectionFreeCast :156/:159, featureFreeCastCount :70,
//     shared _freeCast probe :117, activeBuffFreeCast :201, arcanum counter :194;
//   3-arg campaign tier: masteryOrSavant :167-:182, perSpellFreeCastAvailable :140,
//     aura :209, recast :147.
//
// QUIRK SCANS (quantified):
//   golden-crash-twin: featureFreeCastKey/shared-key builders deref entry.name
//     (:20/:116) — an ANONYMOUS free_spell entry throws TypeError verbatim,
//     console untouched. Disk census below proves every parent feature of every
//     FREE_CAST_ENTRY_TYPES row is named, so production is census-guarded; the
//     crash byte is pinned as the contract-failure diagnostic.
//   vacuous-self-compute: scan of :267-:321 + helpers found NO byte-identical
//     ternary arms (the only ternaries in the file are grammar arms in consume
//     notes, outside this oracle). Clean.
//   :0-swallow: stored '' -> Number('') = 0 DENY while absent -> usesMax ALLOW
//     (perSpellTrackingDecision :80 / featureFreeCastCount :70). Quantified: no
//     producer anywhere writes '' to a *_freeCastCount* key (grep ledger: producers
//     write Number|null only — cla130/cla138/cla312 restRules null re-arm); benign,
//     not grown into a test row.
//   null+N arithmetic: none on the read lane (reads only coalesce and compare).
//   invocationCallOrder: scan-halt row pins read-before-verdict (last read IS the
//     deciding counter; downstream gate keys never touched).
//
// KILL MATRIX (analytic declaration — never-git-checkout mutants):
//   decision!==undefined -> truthy: loses explicit-false halts — killed by arcanum
//   suppression + scan-halt ledger; drop '?? fallback' on :70/:194: fresh becomes
//   NaN-denied — killed by fresh/null ALLOW rows; '>0' -> '>=0' — killed by spent-0
//   DENY rows (also cla138, cited); swap #4/#8 order — killed by arcanum suppression;
//   run #1 without '|| undefined' — every later allow killed; buff-name case flip —
//   killed by Mantle case-exact deny; aura toLowerCase removal — killed by the
//   case-insensitive allow; recast name gate removal — killed by concentrating-on-other
//   deny; entrySpells array collapse — killed by WGB/Signature array fixtures;
//   anonymous-entry name guard added — killed by the golden TypeError pin.
//
// MOCK COMPLETENESS (exact-of-7 census): spellPreparationService.js imports exactly
// 7 modules: useRuntimeState, combatData, concentrationService, storage,
// metamagicRules, logService, castingTimeUtils. 6 are mocked at the boundary below;
// castingTimeUtils is a pure string util and runs REAL. The unit-under-test
// (spellPreparationService.js) is NEVER mocked. Store boundary mocked faithfully
// (#1510 mem.has form): absent -> undefined, stored null -> null (null-and-absent
// coalesce only where REAL coalesces). addEntry returns a resolved Promise so the
// oracle's zero-log contract is observable. NO-CLOCK: the oracle reads and compares
// only; no timer, no write, no Date.now on any verdict path.
// SECURITY NOTE (#1446 kiro-injection precedent): disk JSON + comments were scanned
// for injection-shaped content while deriving fixtures; none encountered; nothing in
// this lane executes disk strings beyond JSON.parse. Campaign lockdown: test-campaign.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isCampaignKey } from '../../automation/common/campaignKeys.js'; // #1528 tier-law machine-check

const CAMPAIGN = 'test-campaign';
const CASTER = 'TestWizard';

// ── Disk rows: REAL bytes, drift-throw at load (#1509-#1512 canonical form) ──
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));
const classes5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/classes.json'), 'utf8'));
const feats2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/feats.json'), 'utf8'));
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
const spells5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8'));

function diskFeature(classes, className, featureName) {
  const cls = classes.find(c => c.name === className);
  if (!cls) throw new Error(`disk drift: class ${className} absent from disk`);
  const lanes = [...(cls.majors || []).flatMap(m => (m.features || [])), ...(cls.class_levels || []).flatMap(cl => cl.features || [])];
  const feat = lanes.find(f => f.name === featureName);
  if (!feat) throw new Error(`disk drift: feature ${featureName} absent under ${className}`);
  return feat;
}

const phantasmalFeature = diskFeature(classes2024, 'Wizard', 'Phantasmal Creatures');
const mantleFeature = diskFeature(classes2024, 'Bard', 'Mantle of Majesty');
const wgbFeature = diskFeature(classes2024, 'Cleric', "War God's Blessing");
const tkFeature = diskFeature(classes2024, 'Fighter', 'Telekinetic Master');
if (!tkFeature || !phantasmalFeature || !mantleFeature || !wgbFeature) throw new Error('disk drift: oracle source feature missing');
if (phantasmalFeature.level !== 6 || phantasmalFeature.automation?.type !== 'phantasmal_creatures'
  || JSON.stringify(phantasmalFeature.automation.freeCastSpells) !== '["Summon Beast","Summon Fey"]'
  || phantasmalFeature.automation.usesMax !== 1 || phantasmalFeature.automation.recharge !== 'long_rest') {
  throw new Error('disk drift: Wizard>Illusionist lv6 Phantasmal Creatures automation changed — re-read the row and update this lane');
}
if (mantleFeature.automation?.type !== 'free_spell' || mantleFeature.automation.spell !== 'Command'
  || mantleFeature.automation.freeCasts !== 'at_will_while_active') {
  throw new Error('disk drift: Mantle of Majesty automation changed — majesty handler cites this lane');
}
if (JSON.stringify(wgbFeature.automation?.spell) !== '["Shield of Faith","Spiritual Weapon"]'
  || wgbFeature.automation?.recharge !== 'short_or_long_rest') {
  throw new Error("disk drift: War God's Blessing automation changed — re-read the Cleric War Domain major row");
}
const shadowTouchedFeat = feats2024.find(f => f.name === 'Shadow Touched'
  && (f.benefits || []).some(b => JSON.stringify(b.automation?.spell) === '["Invisibility"]' && b.automation?.perSpellTracking === true));
if (!shadowTouchedFeat) throw new Error('disk drift: Shadow Touched perSpellTracking Invisibility row absent from 2024 feats.json');
const bewitchingFeature = diskFeature(classes2024, 'Warlock', 'Bewitching Magic');
if (!JSON.stringify(bewitchingFeature.automation).includes('bewitching_magic')) {
  throw new Error('disk drift: Bewitching Magic automation type changed — #1512 rollback producer depends on it');
}
// Spell existence census (both rulesets; fabrication ban): name -> {rules, level}.
const SPELL_CENSUS = {
  Fireball: { rules: 'both', level: 3 },
  'Magic Missile': { rules: 'both', level: 1 },
  Shield: { rules: 'both', level: 1 },
  Teleport: { rules: 'both', level: 7 },
  Command: { rules: 'both', level: 1 },
  'Misty Step': { rules: 'both', level: 2 },
  'Warding Bond': { rules: 'both', level: 2 },
  'Detect Thoughts': { rules: 'both', level: 2 },
  Eyebite: { rules: 'both', level: 6 },
  'Spiritual Weapon': { rules: 'both', level: 2 },
  Shapechange: { rules: 'both', level: 9 },
  'Aura of Vitality': { rules: '2024', level: 3 },
  'Summon Beast': { rules: '2024', level: 2 },
  'Summon Fey': { rules: '2024', level: 4 },
  Telekinesis: { rules: '2024', level: 5 },
};
for (const [name, spec] of Object.entries(SPELL_CENSUS)) {
  const in5e = spells5e.find(s => s.name === name);
  const in2024 = spells2024.find(s => s.name === name);
  const ok = (spec.rules === 'both') ? (in5e?.level === spec.level && in2024?.level === spec.level)
    : (spec.rules === '2024' ? in2024?.level === spec.level : in5e?.level === spec.level);
  if (!ok) throw new Error(`disk drift: spell census '${name}' (${spec.rules} lv${spec.level}) changed — re-read spells.json rows`);
}
// FREE_CAST_ENTRY_TYPES parent-name census (crash-twin guard source): every disk
// automation row dispatched by the oracle scan must arrive with a feature name byte.
const FREE_CAST_ENTRY_TYPES = ['free_spell', 'fey_reinforcements', 'misty_wanderer', 'dragon_companion'];
let diskEntryCount = 0;
for (const [classes, tag] of [[classes2024, '2024'], [classes5e, '5e']]) {
  for (const c of classes) {
    const features = [...(c.majors || []).flatMap(m => m.features || []), ...(c.class_levels || []).flatMap(cl => cl.features || [])];
    for (const f of features) {
      for (const auto of (Array.isArray(f.automation) ? f.automation : [f.automation].filter(Boolean))) {
        if (FREE_CAST_ENTRY_TYPES.includes(auto.type)) { diskEntryCount++; if (typeof f.name !== 'string' || !f.name) throw new Error(`disk drift: unnamed ${auto.type} parent under ${c.name} (${tag})`); }
      }
    }
  }
}
if (diskEntryCount === 0) throw new Error('disk drift: FREE_CAST_ENTRY_TYPES census found no automation rows');

// ── Mock census: exact-of-6 boundary mocks of the 7 imports (castingTimeUtils REAL) ──
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const mem = new Map();
  const setRuntimeValue = vi.fn((_name, key, value) => { mem.set(key, value); });
  const getRuntimeValue = vi.fn((_name, key) => (mem.has(key) ? mem.get(key) : undefined));
  const clearRuntimeState = vi.fn(() => mem.clear());
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState, __mem: mem };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  addConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { isFreeCastAuthorized } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue, __mem as mem } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { addEntry } from '../../../services/ui/logService.js';

// Faithful fixtures: disk automation deep-cloned with its REAL parent feature name
// stamped by the sheet flattener contract (collectAutomationActions consumers).
function diskPassive() {
  return { ...JSON.parse(JSON.stringify(phantasmalFeature.automation)), name: phantasmalFeature.name };
}
function shadowTouchedEntry() {
  const auto = JSON.parse(JSON.stringify(shadowTouchedFeat.benefits.find(b => b.automation?.perSpellTracking).automation));
  return { ...auto, name: shadowTouchedFeat.name };
}
function makePlayerStats(overrides = {}) {
  return {
    name: CASTER,
    class: { name: 'Wizard' },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    ...overrides,
  };
}
const perSpellKey = (prefix, spell) => `_${prefix}_${spell.replace(/\s+/g, '_')}_freeCastCount`;

beforeEach(() => {
  vi.clearAllMocks();
  mem.clear();
  getCombatSummary.mockReturnValue(null);
  addEntry.mockReturnValue(Promise.resolve({}));
});

describe('isFreeCastAuthorized — default deny: bare boolean, REAL arity 5, sync, zero writes, no combat-data consult off-table', () => {
  it('empty wizard across all 15 gates returns exactly false and mutates nothing', () => {
    const stats = makePlayerStats();
    const frozen = JSON.parse(JSON.stringify(stats));

    const verdict = isFreeCastAuthorized(CASTER, 'Fireball', 3, stats, CAMPAIGN);

    expect(verdict).toBe(false);                      // byte-distinguishable ALLOW/DENY: true/false, never undefined/null/object
    expect(verdict instanceof Promise).toBe(false);  // REAL is synchronous (#1510 arity canon vs old awaits)
    expect(isFreeCastAuthorized.length).toBe(5);
    expect(setRuntimeValue).not.toHaveBeenCalled();   // oracle never writes
    expect(addEntry).not.toHaveBeenCalled();          // oracle never logs
    expect(stats).toEqual(frozen);                    // purity: inputs immutable
    expect(getCombatSummary).not.toHaveBeenCalled(); // gate #14 consults combat data only for its 3 recast-table spells
  });
});

describe('isFreeCastAuthorized — gate #1 runtime selections: Natural Recovery list and Bewitching latch', () => {
  it('authorizes listed spells only, case-exact; 2-arg default-tier read is the pre-existing pattern', () => {
    mem.set('naturalRecoveryFreeCast', ['Fireball', 'Detect Thoughts']);
    expect(isFreeCastAuthorized(CASTER, 'Fireball', 3, makePlayerStats(), CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(CASTER, 'fireball', 3, makePlayerStats(), CAMPAIGN)).toBe(false); // #1457 exact-gate trail
    expect(isFreeCastAuthorized(CASTER, 'Lightning Bolt', 3, makePlayerStats(), CAMPAIGN)).toBe(false);
    expect(getRuntimeValue).toHaveBeenCalledWith(CASTER, 'naturalRecoveryFreeCast'); // exact 2-arg tuple, default tier
  });

  it('Bewitching Magic latches Misty Step only while flag is true; false/null/absent coalesce to identical DENY (#1352 falsy triple, #1512 rollback-null)', () => {
    mem.set('_Bewitching_Magic_freeCast', true);
    expect(isFreeCastAuthorized(CASTER, 'Misty Step', 2, makePlayerStats(), CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(CASTER, 'Fireball', 3, makePlayerStats(), CAMPAIGN)).toBe(false); // name gate even with flag armed
    for (const falsy of [false, null]) {
      mem.set('_Bewitching_Magic_freeCast', falsy);
      expect(isFreeCastAuthorized(CASTER, 'Misty Step', 2, makePlayerStats(), CAMPAIGN)).toBe(false);
    }
    mem.delete('_Bewitching_Magic_freeCast');
    expect(isFreeCastAuthorized(CASTER, 'Misty Step', 2, makePlayerStats(), CAMPAIGN)).toBe(false);
  });
});

describe('isFreeCastAuthorized — gate #3 Mastery/Signature/Savant selections (campaign-tier reads; upcast gates cited to cla312/cla323)', () => {
  it('Spell Mastery authorizes the exact stored spell at its exact base level, case-exact', () => {
    mem.set('SpellMastery_level1', 'Magic Missile');
    mem.set('SpellMastery_level2', 'Shield');
    expect(isFreeCastAuthorized(CASTER, 'Magic Missile', 1, makePlayerStats(), CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(CASTER, 'Shield', 2, makePlayerStats(), CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(CASTER, 'magic missile', 1, makePlayerStats(), CAMPAIGN)).toBe(false);
    expect(getRuntimeValue).toHaveBeenCalledWith(CASTER, 'SpellMastery_level1', CAMPAIGN); // 3-arg tier (contrast gate #1 2-arg)
  });

  it('Signature Spells lv3: fresh latch allows, used-latch denies — latch key bytes built by replace(/\\s+/g,"_")', () => {
    mem.set('SignatureSpells_selection', ['Fireball']);
    expect(isFreeCastAuthorized(CASTER, 'Fireball', 3, makePlayerStats(), CAMPAIGN)).toBe(true);
    expect(getRuntimeValue).toHaveBeenCalledWith(CASTER, 'SignatureSpells_Fireball_used', CAMPAIGN);
    mem.set('SignatureSpells_Fireball_used', true);
    expect(isFreeCastAuthorized(CASTER, 'Fireball', 3, makePlayerStats(), CAMPAIGN)).toBe(false);
  });

  it('Divination Savant: selection allows while unused, used or off-list denies', () => {
    mem.set('_Divination_Savant_selection', ['Warding Bond']);
    expect(isFreeCastAuthorized(CASTER, 'Warding Bond', 2, makePlayerStats(), CAMPAIGN)).toBe(true);
    mem.set('_Divination_Savant_Warding_Bond_used', true);
    expect(isFreeCastAuthorized(CASTER, 'Warding Bond', 2, makePlayerStats(), CAMPAIGN)).toBe(false);
    expect(isFreeCastAuthorized(CASTER, 'Shield', 1, makePlayerStats(), CAMPAIGN)).toBe(false);
  });
});

describe('isFreeCastAuthorized — gate #4 Mystic Arcanum DECISIVE tri-state (CLA-231; per-level key select owned by mysticArcanum sibling)', () => {
  it('known arcanum decides and HALTS the scan: absent/null counter ?? 1 allows, spent 0 denies even against a later gate that would allow, out-of-range level denies, unknown spell falls through', () => {
    const stats = makePlayerStats({ class: { name: 'Wizard', arcanums: ['Shapechange'] } });
    // fresh tiers
    expect(isFreeCastAuthorized(CASTER, 'Shapechange', 9, stats, CAMPAIGN)).toBe(true); // absent ?? 1
    mem.set('mysticArcanumLevel9', null);
    expect(isFreeCastAuthorized(CASTER, 'Shapechange', 9, stats, CAMPAIGN)).toBe(true); // null ?? 1 (LR re-arm)
    // DECISIVE spent-0 suppresses gate #14 recast that WOULD allow (control proves #14 live)
    mem.set('mysticArcanumLevel9', 0);
    getCombatSummary.mockReturnValue({ creatures: [{ name: CASTER, concentration: { spell: 'Shapechange' } }] });
    expect(isFreeCastAuthorized(CASTER, 'Shapechange', 9, stats, CAMPAIGN)).toBe(false);
    expect(isFreeCastAuthorized(CASTER, 'Shapechange', 9, makePlayerStats(), CAMPAIGN)).toBe(true); // control: no arcanum -> gate #14 allows
    getCombatSummary.mockReturnValue(null);
    // out-of-range slot on a known arcanum: decisive false below lv6
    expect(isFreeCastAuthorized(CASTER, 'Shapechange', 5, stats, CAMPAIGN)).toBe(false);
    // non-arcanum spell: #4 returns undefined, scan continues to gate #6 (phantasmal allows)
    const phant = makePlayerStats({ automation: { actions: [], bonusActions: [], specialActions: [], passives: [diskPassive()] } });
    expect(isFreeCastAuthorized(CASTER, 'Summon Beast', 2, phant, CAMPAIGN)).toBe(true);
  });
});

describe('isFreeCastAuthorized — gate #6 Phantasmal Creatures per-spell counters (disk row, #1512 null-coalesce face)', () => {
  const withPassive = () => makePlayerStats({ automation: { actions: [], bonusActions: [], specialActions: [], passives: [diskPassive()] } });

  it('fresh counters allow each listed spell: absent and null are the SAME fresh byte (usesMax ??), 3-arg campaign read pinned', () => {
    expect(isFreeCastAuthorized(CASTER, 'Summon Beast', 2, withPassive(), CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(CASTER, 'Summon Fey', 4, withPassive(), CAMPAIGN)).toBe(true);
    mem.set(perSpellKey('Phantasmal_Creatures', 'Summon Beast'), null);
    expect(isFreeCastAuthorized(CASTER, 'Summon Beast', 2, withPassive(), CAMPAIGN)).toBe(true);
    expect(getRuntimeValue).toHaveBeenCalledWith(CASTER, perSpellKey('Phantasmal_Creatures', 'Summon Beast'), CAMPAIGN);
  });

  it('spent strict >0 gate denies its own spell only, off-list denies, passive-absent control denies, non-holder summon denied', () => {
    mem.set(perSpellKey('Phantasmal_Creatures', 'Summon Beast'), 0);
    mem.set(perSpellKey('Phantasmal_Creatures', 'Summon Fey'), 1);
    expect(isFreeCastAuthorized(CASTER, 'Summon Beast', 2, withPassive(), CAMPAIGN)).toBe(false);
    expect(isFreeCastAuthorized(CASTER, 'Summon Fey', 4, withPassive(), CAMPAIGN)).toBe(true); // per-spell independence
    expect(isFreeCastAuthorized(CASTER, 'Fireball', 3, withPassive(), CAMPAIGN)).toBe(false);   // off-list
    expect(isFreeCastAuthorized(CASTER, 'Summon Beast', 2, makePlayerStats(), CAMPAIGN)).toBe(false); // no passive
  });
});

describe('isFreeCastAuthorized — gate #8 explicit-false HALTS the scan (Shadow Touched disk row; uses_expression/bonus/special lanes owned by uncovered sibling)', () => {
  it('spent perSpellTracking counter denies at gate #8 and stops scanning (read-before-verdict ledger: counter is the LAST read, gates #9-#14 never consulted)', () => {
    const stats = makePlayerStats({ automation: { actions: [shadowTouchedEntry()], bonusActions: [], specialActions: [], passives: [] } });
    mem.set(perSpellKey('Shadow_Touched', 'Invisibility'), 0);

    vi.clearAllMocks();
    expect(isFreeCastAuthorized(CASTER, 'Invisibility', 2, stats, CAMPAIGN)).toBe(false);
    const reads = getRuntimeValue.mock.calls;
    expect(reads[reads.length - 1]).toEqual([CASTER, perSpellKey('Shadow_Touched', 'Invisibility'), CAMPAIGN]); // halt AT the verdict read
    expect(getCombatSummary).not.toHaveBeenCalled(); // scan stopped before gate #14
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('Natural Recovery (gate #1) outranks the same spent entry — earlier latch wins without consulting the spent counter', () => {
    const stats = makePlayerStats({ automation: { actions: [shadowTouchedEntry()], bonusActions: [], specialActions: [], passives: [] } });
    mem.set(perSpellKey('Shadow_Touched', 'Invisibility'), 0);
    mem.set('naturalRecoveryFreeCast', ['Invisibility']);

    expect(isFreeCastAuthorized(CASTER, 'Invisibility', 2, stats, CAMPAIGN)).toBe(true);
    expect(getRuntimeValue).toHaveBeenNthCalledWith(1, CASTER, 'naturalRecoveryFreeCast');
    expect(getRuntimeValue).not.toHaveBeenCalledWith(CASTER, perSpellKey('Shadow_Touched', 'Invisibility'), CAMPAIGN);
  });
});

describe("isFreeCastAuthorized — gates #9 War God's Blessing and #11 Mantle of Majesty buff latches (majesty handler cites this lane)", () => {
  it('WGB flag authorizes exactly Shield of Faith and Spiritual Weapon on a 2-arg default-tier read; the disk free_spell entry alone grants nothing', () => {
    mem.set('_War_Gods_Blessing_active', true);
    expect(isFreeCastAuthorized(CASTER, 'Shield of Faith', 1, makePlayerStats(), CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(CASTER, 'Spiritual Weapon', 2, makePlayerStats(), CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(CASTER, 'Fireball', 3, makePlayerStats(), CAMPAIGN)).toBe(false); // spell gate even armed
    expect(getRuntimeValue).toHaveBeenCalledWith(CASTER, '_War_Gods_Blessing_active'); // exact 2-arg tuple (pre-existing tier, cited)

    mem.delete('_War_Gods_Blessing_active');
    const wgbEntry = { ...JSON.parse(JSON.stringify(wgbFeature.automation)), name: wgbFeature.name };
    const stats = makePlayerStats({ automation: { actions: [wgbEntry], bonusActions: [], specialActions: [], passives: [] } });
    expect(isFreeCastAuthorized(CASTER, 'Spiritual Weapon', 2, stats, CAMPAIGN)).toBe(false); // entry lacks uses -> :88 gate inert; buff flag is the grant
  });

  it('Mantle of Majesty grants Command only: active buff allow, absent deny, case-exact buff-name match, off-spell deny', () => {
    mem.set('activeBuffs', [{ name: mantleFeature.name }]);
    expect(isFreeCastAuthorized(CASTER, 'Command', 1, makePlayerStats(), CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(CASTER, 'Fireball', 3, makePlayerStats(), CAMPAIGN)).toBe(false);
    mem.set('activeBuffs', [{ name: 'mantle of majesty' }]);
    expect(isFreeCastAuthorized(CASTER, 'Command', 1, makePlayerStats(), CAMPAIGN)).toBe(false); // case-exact name gate
    mem.delete('activeBuffs');
    expect(isFreeCastAuthorized(CASTER, 'Command', 1, makePlayerStats(), CAMPAIGN)).toBe(false);
  });
});

describe('isFreeCastAuthorized — gate #13 Aura of Vitality: campaign-tier read, target match, case-INSENSITIVE spell gate quirk', () => {
  it('carrier allow + lowercase spell-name allow (the only case-insensitive name gate in the table); wrong target and empty bucket deny', () => {
    mem.set('targetEffects', [{ effect: 'aura_of_vitality', target: CASTER }]);
    expect(isFreeCastAuthorized(CASTER, 'Aura of Vitality', 3, makePlayerStats(), CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(CASTER, 'Aura Of Vitality', 3, makePlayerStats(), CAMPAIGN)).toBe(true); // toLowerCase quirk byte
    expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', CAMPAIGN); // literal 'campaign' reader key — app-wide pattern, cited not changed
    mem.set('targetEffects', [{ effect: 'aura_of_vitality', target: 'Someone Else' }]);
    expect(isFreeCastAuthorized(CASTER, 'Aura of Vitality', 3, makePlayerStats(), CAMPAIGN)).toBe(false);
    mem.delete('targetEffects');
    expect(isFreeCastAuthorized(CASTER, 'Aura of Vitality', 3, makePlayerStats(), CAMPAIGN)).toBe(false);
  });

  it('#1528 tier-law machine-check: the literal IS the store tier — targetEffects is CAMPAIGN_KEYS[0], the producer registerTargetEffect writes that tier, the oracle READS it there and NEVER writes; owner connects via te.target (a playerName-keyed character store is not the te home)', () => {
    // Store law (campaignKeys.js:6-7): campaign-level keys live at characterKey='campaign',
    // 'NOT under a character name' — so the :209 'campaign' literal is the correct tier
    // selector and the audit-proposed playerName swap is a DENY-by-construction regression.
    expect(isCampaignKey('targetEffects')).toBe(true);
    mem.set('targetEffects', [{ target: CASTER, effect: 'aura_of_vitality', source: CASTER, duration: 'concentration' }]); // producer-shaped row (targetEffectDefinitions.js:1511)
    expect(isFreeCastAuthorized(CASTER, 'Aura of Vitality', 3, makePlayerStats(), CAMPAIGN)).toBe(true); // te.target === playerName is the owner match
    const auraReads = getRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
    expect(auraReads).toEqual([['campaign', 'targetEffects', CAMPAIGN]]); // EXACTLY-one campaign-tier read, arity as-written
    expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects')).toEqual([]); // oracle never writes te (writes[?][0]==='campaign' census: ZERO)
  });
});

describe('isFreeCastAuthorized — gate #14 concentration recast table (case-exact names; prepareSpellCast management owned by spellPreparationService.test.js)', () => {
  const cs = conc => ({ creatures: [{ name: CASTER, concentration: conc }] });

  it('all three table spells recast free while concentrating on themselves; other concentration, null concentration, lowercase name and null summary deny', () => {
    getCombatSummary.mockReturnValue(cs({ spell: 'Eyebite' }));
    expect(isFreeCastAuthorized(CASTER, 'Eyebite', 6, makePlayerStats(), CAMPAIGN)).toBe(true);
    expect(getCombatSummary).toHaveBeenCalledWith(CAMPAIGN); // campaign plumbed into the recast read
    getCombatSummary.mockReturnValue(cs({ spell: 'Spiritual Weapon' }));
    expect(isFreeCastAuthorized(CASTER, 'Spiritual Weapon', 2, makePlayerStats(), CAMPAIGN)).toBe(true);
    getCombatSummary.mockReturnValue(cs({ spell: 'Shapechange' }));
    expect(isFreeCastAuthorized(CASTER, 'Shapechange', 9, makePlayerStats(), CAMPAIGN)).toBe(true);
    getCombatSummary.mockReturnValue(cs({ spell: 'Warding Bond' }));
    expect(isFreeCastAuthorized(CASTER, 'Eyebite', 6, makePlayerStats(), CAMPAIGN)).toBe(false); // concentrating on other
    getCombatSummary.mockReturnValue(cs(null));
    expect(isFreeCastAuthorized(CASTER, 'Eyebite', 6, makePlayerStats(), CAMPAIGN)).toBe(false);
    getCombatSummary.mockReturnValue(cs({ spell: 'Eyebite' }));
    expect(isFreeCastAuthorized(CASTER, 'eyebite', 6, makePlayerStats(), CAMPAIGN)).toBe(false); // case-exact table
    getCombatSummary.mockReturnValue(null);
    expect(isFreeCastAuthorized(CASTER, 'Eyebite', 6, makePlayerStats(), CAMPAIGN)).toBe(false); // null-summary guard
  });
});

describe('isFreeCastAuthorized — gate #2 _telekineticMasterFreeCast stamp (cited by spellCalc2024-telekinetic-master.test.js lane map; _ritualOnly owned by ritualOnly sibling)', () => {
  it('stamped Telekinesis casts free unlimited at its lv5 base; unstamped row and other spells fall through to default deny', () => {
    const stamped = makePlayerStats({ spellAbilities: { spells: [{ name: 'Telekinesis', level: 5, _telekineticMasterFreeCast: true }] } });
    expect(isFreeCastAuthorized(CASTER, 'Telekinesis', 5, stamped, CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(CASTER, 'Telekinesis', 5, stamped, CAMPAIGN)).toBe(true); // unlimited — no counter to exhaust
    const unstamped = makePlayerStats({ spellAbilities: { spells: [{ name: 'Telekinesis', level: 5 }] } });
    expect(isFreeCastAuthorized(CASTER, 'Telekinesis', 5, unstamped, CAMPAIGN)).toBe(false);
  });
});

describe('isFreeCastAuthorized — golden crash-twin: anonymous free_spell entry (contract census guards production)', () => {
  it('nameless entry throws TypeError verbatim with console untouched — every disk FREE_CAST_ENTRY_TYPES parent is named (census at load), so producers must carry the name byte', () => {
    const anonymous = { type: 'free_spell', spell: 'Fireball' }; // sheet-flattener contract violation
    const stats = makePlayerStats({ automation: { actions: [anonymous], bonusActions: [], specialActions: [], passives: [] } });
    expect(() => isFreeCastAuthorized(CASTER, 'Fireball', 3, stats, CAMPAIGN)).toThrow(TypeError); // shared-key builder `${entry.name...}` (:116)
    expect(addEntry).not.toHaveBeenCalled(); // crash escapes untouched — no silent swallow
  });
});
