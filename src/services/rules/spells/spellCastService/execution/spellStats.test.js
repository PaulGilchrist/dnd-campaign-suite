// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  spellStats lane — the computeSpellStats PRODUCER face of           */
/*  execution/index.js:191-222 (+ innate read :692, innate +1 seam     */
/*  :254). There is no spellStats.js module; this file names the       */
/*  lane, the unit is index.js's stats block, pinned THROUGH            */
/*  executeSpellCast at its pass-through seams:                        */
/*    :704 handleMassSuggestion(spell, spellSaveDc, ...) — every cast   */
/*    :767 handleNoSavePath({ spellToHit, ... }) — no-DC rows          */
/*    :409 rollExpression('<expr + MOD>') — spellCastingMod byte       */
/*    :254 rollDamage context.saveDc — adjudication innate +1          */
/*    :237 addEntry type:'spell' log — saveDC (pre-innate)             */
/*  Boundary (declared in spellCastService.execute.test.js:34 /        */
/*  spellCastService.test.js:38 — "computeSpellStats arithmetic …     */
/*  execution/spellStats.test.js"): outer lanes send STALE sentinels  */
/*  (toHit 99 / saveDc 13) and prove TRANSPORT of 9/17; this lane     */
/*  owns the arithmetic that produces them. savePath.js:139 innate +1  */
/*  twin is owned by savePath-single-target:444 / savePath-aoe-meta;  */
/*  MOD-replace mechanics by spellCastService.heal:336.                */
/*                                                                     */
/*  #1473 pin: computeSpellStats makes spellSaveDc ALWAYS NUMERIC —   */
/*  computed arm :199 = 8 + prof (never a missing/undefined byte at    */
/*  any seam); cached arm :201 passes the authored DC through.         */
/*  #1492 pin: the innate +1 at :254 rides a numeric base today       */
/*  (17→18); the NaN-latent face lives at savePath.js:139, not here.  */
/*  #1501 CLA-212 pin: spell.spellCastingAbility stamp (producer      */
/*  lineage featBuffService.js:617) beats the spellAbilities default   */
/*  at :695 and recomputes toHit/DC/mod from the named ability row.    */
/*  #1500 pin: proficiency throw guard :195-198 (kills every            */
/*  8+prof arithmetic row dead if removed); :192 ?.||0 / :218 ||0.     */
/*  #1505 pin: metamagicHeighten arrives at :256 as an explicit        */
/*  `false` byte (never key-absent) for a plain-vanilla caster.        */
/*                                                                     */
/*  Fixtures: REAL disk rows (drift-throw if a row disappears) +      */
/*  runtime PlayerStats shape (abilities:[{name,bonus}] as computed by  */
/*  rulesFactory's PlayerStats; bonus = RAW floor((score-10)/2)).      */
/*  Mutually distinguishable #1348: massSuggestion-seam DC census      */
/*  15/17/14/10 (T1,T1b,T1c,T2), noSavePath spellToHit census 9/0     */
/*  (T4), MOD-byte census '1d8 + 4'/'1d8 + 0'/'1d8 + 6' (T5),          */
/*  adjudication-context saveDc census 18/17 (T6). Stale sentinels     */
/*  99/13/6 differ from every computed value so swap-mutants die.      */
/*  NO-CLOCK: pure compute + inert seam captures; the only Date.now()  */
/*  lives in the addEntry log stamp (benign, never asserted). No       */
/*  timers, no clocks. Campaign lockdown: every cast is test-campaign. */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* ------------------------------------------------------------------ */
/*  Mocks — every live dependency edge of execution/index.js except   */
/*  the pure stats/damage resolvers that run REAL (core/              */
/*  spellDamageUtils.js has zero imports — running it REAL keeps      */
/*  lane routing honest: Fireball→'8d6' damage path, Friends/Cure      */
/*  Wounds→formula null → no-damage path; #1468 no canned '1d8').     */
/*  Removed dead twins: ./spellResolution.js (no importer anywhere in  */
/*  this graph — savePath/modalSpells/triggerSpells are factory-mocked */
/*  so the real module never loads). psychicSpellsHandler,             */
/*  compelledDuelHandler and castingTimeUtils run REAL (tiny, pure —   */
/*  same as the earlyReturns lanes).                                   */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
  checkCompelledDuelAttackExpiry: vi.fn(),
}));

vi.mock('../../../features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../rules/spells/postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(() => Promise.resolve()),
  triggerPostCastAllyHeals: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../rules/spells/postCastRiderService.js', () => ({
  triggerBewitchingMagic: vi.fn(() => Promise.resolve()),
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve()),
  triggerSpellThief: vi.fn(() => Promise.resolve()),
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve()),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../../../automation/handlers/spells/sanctuaryHandler.js', () => ({
  endSanctuary: vi.fn(),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => null),
}));

vi.mock('../../../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../features/confusionService.js', () => ({
  triggerConfusion: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  markFortifiedHealthUsedIfGranted: vi.fn(),
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximizationForTarget: vi.fn(() => false),
  hasRerollHealingOnes: vi.fn(() => false),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
  rollExpressionMaximized: vi.fn(() => ({ total: 8, rolls: [8] })),
  applyHealingRerollOnes: vi.fn(() => ({ displayRolls: [5], originalRolls: [5] })),
}));

vi.mock('./helpers.js', () => ({
  refundSpellBreakerSlot: vi.fn(),
  applyHexEffects: vi.fn(),
  applyPowerWordHealToTarget: vi.fn(),
  applyPowerWordKillToTarget: vi.fn(),
  triggerArcaneWard: vi.fn(() => Promise.resolve()),
  triggerDispelMagic: vi.fn(() => Promise.resolve()),
  triggerExpertDivination: vi.fn(() => Promise.resolve(null)),
  applyRegenerateSpell: vi.fn(),
  executeMagicMissile: vi.fn(() => Promise.resolve()),
}));

vi.mock('./blockChecks.js', () => ({
  checkGlobeOfInvulnerability: vi.fn(() => Promise.resolve(null)),
  checkForcecageBlocked: vi.fn(() => Promise.resolve(null)),
  checkBlockedBySpellcastingBuff: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./modalSpells.js', () => ({
  handlePowerWordHeal: vi.fn(() => Promise.resolve({ handled: false })),
  handlePowerWordKill: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassSuggestion: vi.fn(() => ({ handled: false })),
  handleCalmEmotions: vi.fn(() => ({ handled: false })),
  handleHypnoticPatternEarly: vi.fn(() => ({ handled: false })),
  handleConfusionEarly: vi.fn(() => ({ handled: false })),
  handleShapechange: vi.fn(() => ({ handled: false })),
  handleFear: vi.fn(() => ({ handled: false })),
  handleConjureVolley: vi.fn(() => ({ handled: false })),
  handleSilence: vi.fn(() => ({ handled: false })),
  handleSleep: vi.fn(() => ({ handled: false })),
}));

vi.mock('./triggerSpells.js', () => ({
  handleRegenerate: vi.fn(() => Promise.resolve({ handled: false })),
  handleSeeInvisibility: vi.fn(() => Promise.resolve({ handled: false })),
  handleFleshToStone: vi.fn(() => Promise.resolve({ handled: false })),
  handleHoldMonster: vi.fn(() => Promise.resolve({ handled: false })),
  handleBanishment: vi.fn(() => Promise.resolve({ handled: false })),
  handleConfusion: vi.fn(() => Promise.resolve({ handled: false })),
  handleMaze: vi.fn(() => Promise.resolve({ handled: false })),
  handlePowerWordStun: vi.fn(() => Promise.resolve({ handled: false })),
  handleHypnoticPattern: vi.fn(() => Promise.resolve({ handled: false })),
  handleSlow: vi.fn(() => Promise.resolve({ handled: false })),
  handleBane: vi.fn(() => Promise.resolve({ handled: false })),
  handleBless: vi.fn(() => Promise.resolve({ handled: false })),
  handleBeaconOfHope: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassSuggestion: vi.fn(() => Promise.resolve({ handled: false })),
  handleSuggestion: vi.fn(() => Promise.resolve({ handled: false })),
  handleCommand: vi.fn(() => Promise.resolve({ handled: false })),
  handleOttoDance: vi.fn(() => Promise.resolve({ handled: false })),
  handleResilientSphere: vi.fn(() => Promise.resolve({ handled: false })),
  handleBlur: vi.fn(() => Promise.resolve({ handled: false })),
  handleExpeditiousRetreat: vi.fn(() => Promise.resolve({ handled: false })),
  handleFriends: vi.fn(() => Promise.resolve({ handled: false })),
  handleCrownOfMadness: vi.fn(() => Promise.resolve({ handled: false })),
  handleAnimalFriendship: vi.fn(() => Promise.resolve({ handled: false })),
  handleDominateBeast: vi.fn(() => Promise.resolve({ handled: false })),
  handleDominateMonster: vi.fn(() => Promise.resolve({ handled: false })),
  handleDominatePerson: vi.fn(() => Promise.resolve({ handled: false })),
  handleRayOfEnfeeblement: vi.fn(() => Promise.resolve({ handled: false })),
  handleCompelledDuel: vi.fn(() => Promise.resolve({ handled: false })),
  handleGlobeOfInvulnerability: vi.fn(() => Promise.resolve({ handled: false })),
  handleForcecage: vi.fn(() => Promise.resolve({ handled: false })),
  handleStinkingCloud: vi.fn(() => Promise.resolve({ handled: false })),
  handleSleetStorm: vi.fn(() => Promise.resolve({ handled: false })),
  handleFaerieFire: vi.fn(() => Promise.resolve({ handled: false })),
  handleTashasHideousLaughter: vi.fn(() => Promise.resolve({ handled: false })),
  handleImprisonment: vi.fn(() => Promise.resolve({ handled: false })),
  handleHeroism: vi.fn(() => Promise.resolve({ handled: false })),
  handleHolyAura: vi.fn(() => Promise.resolve({ handled: false })),
  handleLongstrider: vi.fn(() => Promise.resolve({ handled: false })),
  handleSpareTheDying: vi.fn(() => Promise.resolve({ handled: false })),
  handleEnhanceAbility: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassCureWounds: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassHealingWord: vi.fn(() => Promise.resolve({ handled: false })),
  handlePrayerOfHealing: vi.fn(() => Promise.resolve({ handled: false })),
  handleFalseLife: vi.fn(() => Promise.resolve({ handled: false })),
  handleRemoveCurse: vi.fn(() => Promise.resolve({ handled: false })),
  handleProtectionFromEnergy: vi.fn(() => Promise.resolve({ handled: false })),
  handleProtectionFromPoison: vi.fn(() => Promise.resolve({ handled: false })),
  handleResistance: vi.fn(() => Promise.resolve({ handled: false })),
  handleGenericAutomation: vi.fn(() => Promise.resolve({ handled: false })),
}));

vi.mock('./savePath.js', () => ({
  handleSavePath: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./noSavePath.js', () => ({
  handleNoSavePath: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./damageCalculation.js', () => ({
  computeRange: vi.fn(() => ({})),
  computeEmpoweredEvocation: vi.fn(() => ({ empEvocFormula: null })),
  computeBlessedStrikes: vi.fn((_, formula) => formula),
  computeRadiantSoul: vi.fn((_, __, ___, ____, formula) => formula),
  computeOverchannel: vi.fn(() => ({ overchannelFormula: null, overchannelActive: false, overchannelUseCount: 0 })),
}));

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

/* ------------------------------------------------------------------ */
/*  SUT import after mocks + mock/seam references                      */
/* ------------------------------------------------------------------ */

import { executeSpellCast } from './index.js';

const { addEntry } = await import('../../../../ui/logService.js');
const { handleMassSuggestion } = await import('./modalSpells.js');
const { handleNoSavePath } = await import('./noSavePath.js');
const { rollExpression } = await import('../../../../dice/diceRoller.js');
const { isInnateSorceryActive } = await import('../../../../combat/buffs/buffService.js');

/* ------------------------------------------------------------------ */
/*  REAL disk rows with drift-throw (#1503/04: existence-first,      */
/*  fabrication-ban — every byte below comes from public/data)         */
/* ------------------------------------------------------------------ */

function diskRow(name, year = '5e') {
  const arr = year === '2024' ? spells2024 : spells5e;
  const row = arr.find(s => s.name === name);
  if (!row) throw new Error(`disk drift: '${name}' missing from ${year} spells.json`);
  return cloneDeep(row);
}

const CAMPAIGN = 'test-campaign'; // campaign lockdown

/* RAW structure pin: ability bonus = floor((score-10)/2) — the
 * runtime PlayerStats shape (rulesFactory), NOT the raw character
 * file shape ({name, baseScore}); disk character rows confirm every
 * ability name used here exists on real casters. */
function bonus(score) {
  return Math.floor((score - 10) / 2);
}

function makeAbilities(scores) {
  return Object.entries(scores).map(([name, score]) => ({ name, bonus: bonus(score) }));
}

/* Mutual distinguishability #1348 — the census:
 * W1 lvl10 prof+4: INT 20(+5) WIS 16(+3) CHA 18(+4)  → DCs 17/15/16, toHit 9, mod +4/+6
 * W2 lvl3  prof+2: INT 18(+4)                          → DCs 14/10, guards row
 * cached sentinels toHit 99 / saveDc 13 / modifier 6 differ from EVERY computed byte. */
function makeCaster(overrides = {}) {
  return {
    name: 'SpellStatsWizard',
    abilities: makeAbilities({ Strength: 8, Dexterity: 12, Constitution: 14, Intelligence: 20, Wisdom: 16, Charisma: 18 }),
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 99, saveDc: 13, modifier: 6 },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  };
}

const W2 = () => makeCaster({
  name: 'SpellStatsWizardL3',
  abilities: makeAbilities({ Strength: 8, Dexterity: 12, Constitution: 14, Intelligence: 18, Wisdom: 12, Charisma: 12 }),
  proficiency: 2,
  level: 3,
  spellAbilities: { toHit: 99, modifier: 6 }, // no saveDc, no spellCastingAbility — :199 arm
});

function services(stats, overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: stats,
    getTargetInfo: async () => ({ name: 'Goblin' }),
    campaignName: CAMPAIGN,
    ...overrides,
  };
}

/* seam capture helpers — exact, not expect.any */
const massSuggestionDc = () => handleMassSuggestion.mock.calls.map(c => c[1]);
const spellLogEntry = () => addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'spell');

describe('executeSpellCast — computeSpellStats producer (index.js:191-222)', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // keeps factory impls; re-stamp the two test-mutated ones
    isInnateSorceryActive.mockReturnValue(false);
  });

  it('recomputes spellSaveDc = 8 + ability.mod + proficiency at every DC seam: spell-stamped Wisdom override (:695,:207) wins over the Intelligence default (8+3+4=15 vs 8+5+4=17), a 2024 disk Fireball computes identical arithmetic on its own caster (8+4+2=14), and stale cached saveDc 13 never survives the recompute — while playerStats/metaCtx/spell inputs are never mutated', async () => {
    const stats = makeCaster();
    const metaCtx = { targetName: 'Goblin' };
    const statsSnapshot = cloneDeep(stats);
    const metaSnapshot = cloneDeep(metaCtx);

    // Row 1: spell.spellCastingAbility stamp (featBuffService.js:617 lineage, #1501/#1478)
    const fb = diskRow('Fireball');
    fb.spellCastingAbility = 'Wisdom';
    await executeSpellCast(fb, { ...metaCtx }, services(stats));
    expect(handleMassSuggestion).toHaveBeenCalledWith(fb, 15, stats, CAMPAIGN);
    const log1 = spellLogEntry();
    expect(log1.saveDC).toBe(15);
    expect(log1).toMatchObject({ type: 'spell', spellName: 'Fireball', spellLevel: 3, targetName: 'Goblin' });

    // Row 2: no spell stamp → spellAbilities.spellCastingAbility default → INT recompute.
    // Kills "cached saveDc wins" (would be 13) and "spell stamp ignored" (would be 17 here, 13 there).
    const fb2 = diskRow('Fireball');
    await executeSpellCast(fb2, { targetName: 'Goblin' }, services(makeCaster()));
    expect(handleMassSuggestion.mock.calls[1][1]).toBe(17);
    expect(addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'spell')[1].saveDC).toBe(17);

    // Row 3: #1365 dual-ruleset — REAL 2024 disk row on its own W2 caster: arithmetic is
    // ruleset-invariant in the producer (only lookupFullSpell's URL differs, owned elsewhere).
    const fb2024 = diskRow('Fireball', '2024');
    fb2024.spellCastingAbility = 'Intelligence';
    const w2 = W2();
    await executeSpellCast(fb2024, { targetName: 'Goblin' }, services(w2));
    expect(handleMassSuggestion.mock.calls[2][1]).toBe(14);

    // purity (#1479/#1505): the caller owns every input object — compute mutates none.
    expect(metaCtx).toEqual(metaSnapshot);
    expect(Object.keys(metaCtx)).toEqual(['targetName']); // :680 copies — no metamagicHeighten key written back
    expect(stats).toEqual(statsSnapshot);
    expect(fb.components).toEqual(['V', 'S', 'M']); // psychic reduction inert without config (:159-167)
  });

  it('computes spellSaveDc = 8 + proficiency through the cached-absent arm :194-199 — always numeric (#1473), never an undefined byte at the :704 seam or the cast log', async () => {
    const stats = W2(); // spellAbilities {toHit:99, modifier:6}: no saveDc, no spellCastingAbility
    const fb = diskRow('Fireball');
    await executeSpellCast(fb, { targetName: 'Goblin' }, services(stats));

    expect(handleMassSuggestion).toHaveBeenCalledTimes(1);
    const [, dc] = handleMassSuggestion.mock.calls[0];
    expect(dc).toBe(10); // 8 + prof 2 — numeric guarantee pinned
    expect(typeof dc).toBe('number');
    expect(spellLogEntry().saveDC).toBe(10);
  });

  it('throws and aborts the cast before the early chain and the cast log when saveDc and proficiency are both missing (:195-198 guard, #1500)', async () => {
    const stats = W2();
    stats.proficiency = null;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(
        executeSpellCast(diskRow('Fireball'), { targetName: 'Goblin' }, services(stats)),
      ).rejects.toThrow('playerStats.proficiency is required for spell save DC calculation');
      expect(spy.mock.calls.map(c => c[0])).toContain('[spellCast] executeSpellCast: playerStats.proficiency is missing');
      expect(handleMassSuggestion).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled(); // :698 log sits after :696 — guard aborts before any byte lands
    } finally {
      spy.mockRestore();
    }
  });

  it('derives handleNoSavePath.spellToHit: recomputed INT row 5+4=9 beats the stale cached 99 (:206), and a caster with null spellAbilities receives the 0 default (:192 ?.||0) with the computed-arm DC alongside', async () => {
    const NO_DC_KEYS = ['campaignName', 'characters', 'getTargetInfo', 'mapName', 'metaCtx', 'playerStats', 'rollAttack', 'spellToHit', 'damageType', 'spell'].sort();

    // Row 1: REAL Fire Bolt row (no dc) → damage path → no-save seam.
    await executeSpellCast(diskRow('Fire Bolt'), { targetName: 'Goblin' }, services(makeCaster()));
    expect(handleNoSavePath).toHaveBeenCalledTimes(1);
    const opts = handleNoSavePath.mock.calls[0][0];
    expect(Object.keys(opts).sort()).toEqual(NO_DC_KEYS); // exact key-set, no fabricated keys
    expect(opts.spellToHit).toBe(9); // 5 + 4 — cached 99 killed
    expect(opts.damageType).toBe('Fire');

    // Row 2: spellAbilities null → toHit falls to the :192 0-default; saveDc falls to :199 (8+4=12).
    handleNoSavePath.mockClear();
    const bare = makeCaster({ spellAbilities: null });
    await executeSpellCast(diskRow('Fire Bolt'), { targetName: 'Goblin' }, services(bare));
    const opts2 = handleNoSavePath.mock.calls[0][0];
    expect(opts2.spellToHit).toBe(0);
    expect(massSuggestionDc()[1]).toBe(12);
  });

  it('resolves spellCastingMod for the heal MOD byte from the three fallback arms :211-219: ability-row override 4 (not cached 6), cached modifier 6, undefined-modifier ||0, and null-spellAbilities init 0', async () => {
    const cw = () => diskRow('Cure Wounds'); // REAL row {1:'1d8 + MOD'}, no dc → generic-heal seam

    // Row A: spellAbilities default overridden to Charisma (+4) matched at :212-215 → 4,
    // kills cached-modifier-first (:218 would give 6).
    await executeSpellCast(cw(), { targetName: 'Goblin' }, services(makeCaster({
      spellAbilities: { spellCastingAbility: 'Charisma', toHit: 99, saveDc: 13, modifier: 6 },
    })));
    expect(rollExpression).toHaveBeenCalledWith('1d8 + 4');
    expect(massSuggestionDc()[0]).toBe(16); // 8 + CHA 4 + prof 4 (:207 recompute, not cached 13)

    // Row B: no spellCastingAbility, cached modifier 6 → :218 arm.
    await executeSpellCast(cw(), { targetName: 'Goblin' }, services(makeCaster({
      spellAbilities: { toHit: 99, saveDc: 13, modifier: 6 },
    })));
    expect(rollExpression).toHaveBeenLastCalledWith('1d8 + 6');

    // Row C: modifier absent → :218 ||0 swallows undefined to 0 ('1d8 + undefined' mutant dies).
    await executeSpellCast(cw(), { targetName: 'Goblin' }, services(makeCaster({
      spellAbilities: { toHit: 99, saveDc: 13 },
    })));
    expect(rollExpression).toHaveBeenLastCalledWith('1d8 + 0');

    // Row D: spellAbilities null skips :217 entirely → :211 init 0 (:199 gives DC 8+4=12).
    await executeSpellCast(cw(), { targetName: 'Goblin' }, services(makeCaster({ spellAbilities: null })));
    expect(rollExpression).toHaveBeenLastCalledWith('1d8 + 0');
    expect(massSuggestionDc()[3]).toBe(12);
  });

  it('reads innate sorcery at :692 for (name, campaign) and applies the +1 ONLY at the adjudication-context seam :254 — REAL Friends disk row: active 17→18, inactive stays 17, and every other byte of the zero-damage rollDamage envelope (pre-innate 17 at :704 and in the cast log, explicit metamagicHeighten:false #1505, lowercase disk status byte) is exact', async () => {
    const envelope = (saveDc) => ({
      name: 'Friends', formula: '0', total: 0, rolls: [], modifier: 0,
      context: {
        targetName: 'Goblin', attackerName: 'SpellStatsWizard',
        spellSchool: 'Enchantment', saveDc,
        saveType: 'WIS', dcSuccess: 'none',
        metamagicHeighten: false, isCantrip: false,
        statusEffects: ['charmed'], // REAL disk byte (lowercase)
      },
    });

    // Row 1: innate ACTIVE.
    isInnateSorceryActive.mockReturnValue(true);
    const rollDamage = vi.fn();
    await executeSpellCast(diskRow('Friends'), { targetName: 'Goblin' }, services(makeCaster(), { rollDamage }));
    expect(isInnateSorceryActive).toHaveBeenCalledWith('SpellStatsWizard', CAMPAIGN);
    expect(handleMassSuggestion.mock.calls[0][1]).toBe(17); // :704 carries the PRE-innate DC
    expect(spellLogEntry().saveDC).toBe(17);
    expect(spellLogEntry().concentration).toBe(true);
    expect(rollDamage).toHaveBeenCalledTimes(1);
    expect(rollDamage.mock.calls[0][0]).toEqual(envelope(18)); // #1492: +1 on a numeric base

    // Row 2: innate INACTIVE — kills the always-+1 mutant at :254.
    isInnateSorceryActive.mockReturnValue(false);
    const rollDamage2 = vi.fn();
    await executeSpellCast(diskRow('Friends'), { targetName: 'Goblin' }, services(makeCaster(), { rollDamage: rollDamage2 }));
    expect(rollDamage2.mock.calls[0][0]).toEqual(envelope(17));
  });
});
