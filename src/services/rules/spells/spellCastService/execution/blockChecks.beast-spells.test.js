// @maintained-by-ai
// CLA-404: Beast Spells (Druid lv18 passive) — lane: blockChecks.js BEAST-FORM
// BLOCKING face. Disk identity (#1362, read 2026-10-21): BOTH catalogs carry the
// row — public/data/classes.json class_levels[17].features[0] and
// public/data/2024/classes.json class_levels[17].features[0], each with
// automation {type:'passive_rule', effect:'beast_spells'} (2014 lv18, 2024 lv18;
// not renamed). The consumer is ruleset-agnostic: blockChecks.js:9-10 never reads
// `rules`, so one byte-shape serves both.
//
// OWNERSHIP SPLIT vs #1450 (materialComponents.js, cited verbatim there): the
// text-detector internals (COSTLY_OR_CONSUMED_MATERIAL_RE
// /(\d[\d,]*\s*(?:gp|gold)|worth|consumes)/i, case-fold, Aid free-text false
// side, 33-row registry) are #1450's lane — NOT re-derived here. This lane pins
// the blockChecks WIRING: which cast attempts the beast-form gate + detector
// verdict combos block, exact refusal message bytes, refusable-vs-passthrough,
// and the missing-material-text silent-allow (#1441-family).
//
// 4-QUADRANT TABLE (beastSpells passive × costly/consumed material):
//   holder × free     → null (allow, no log)                 [gate: allow]
//   holder × costly   → material refusal (text or registry)  [gate: 2 rows]
//   holder × M, no cost text, no registry row → null         [gate: passthrough]
//   non-holder × any  → blanket form refusal (CLA-391)       [gate: no-passive]
// Hub gate ORDER of this seam vs other blockers lives at execution/index.js:652
// REAL-chain (#1454 lane) + modals refusal pins (#1457) — module-direct only here.
// fix#300 (#1465 external-dead census): beastSpellsAllowsCast demoted module-local
// in blockChecks.js (zero external production importers; fix#294 shape) — the former
// direct-import truth table now runs through the PUBLIC seam checkBlockedBySpellcastingBuff
// (fix#82 coordinated, same pass).
// NO-CLOCK: blocking here is instantaneous — no timers, no game clock (#mandatory).
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — line-by-line vs blockChecks.js imports. Detector stays   */
/*  REAL (materialComponents; its deps setRuntimeValue/addEntry are  */
/*  the mocked modules above). blockChecks.js itself NEVER mocked.   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  SUT imports                                                      */
/* ------------------------------------------------------------------ */

const { addEntry } = await import('../../../../ui/logService.js');
const { getActiveBuffs } = await import('./spellResolution.js');
const { checkBlockedBySpellcastingBuff } = await import('./blockChecks.js');

/* ------------------------------------------------------------------ */
/*  Fixtures — disk-faithful bytes (fabricated-shape ban #1455/57/  */
/*  58/63): every spell below is a REAL row in its cited catalog.   */
/* ------------------------------------------------------------------ */

const WILD_SHAPE_BUFF = { name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true };
const BEAST_SPELLS = [{ type: 'passive_rule', effect: 'beast_spells' }];

function druid(passives) {
  return { name: 'Wild_Sage_Druid', automation: { passives, reactions: [], specialActions: [] } };
}
const lv18Druid = () => druid(BEAST_SPELLS);
const noPassiveDruid = () => druid([]);

// Guidance — 2024 disk: V/S cantrip, material null. ALLOW-side fixture.
const GUIDANCE = { name: 'Guidance', level: 0, components: ['V', 'S'], material: null };
// Summon Beast — 2024 disk bytes, text-detector hit ('worth ... GP'); NOT a
// registry row → proves blockChecks forwards spell.material into the detector.
const SUMMON_BEAST = {
  name: 'Summon Beast',
  level: 2,
  components: ['V', 'S', 'M'],
  material: 'a feather, tuft of fur, and fish tail inside a gilded acorn worth 200+ GP',
};
// Acid Arrow — 5e disk bytes: real M component, NO cost text, NO registry row.
// Passthrough-quadrant fixture (silent-allow, sanctioned by blockChecks.js:23-25
// + materialComponents.js CLA-404 comment: cost/consumption lives only in text).
const ACID_ARROW_5E = {
  name: 'Acid Arrow',
  level: 2,
  rules: '5e',
  components: ['V', 'S', 'M'],
  material: "Powdered rhubarb leaf and an adder's stomach.",
};

beforeEach(() => {
  vi.clearAllMocks();
  getActiveBuffs.mockReturnValue([WILD_SHAPE_BUFF]);
});

describe('checkBlockedBySpellcastingBuff — Beast Spells gate quadrants (CLA-404)', () => {
  it('passive holder + free-component spell → allowed in Beast form, ruleset-agnostic, with zero log calls', async () => {
    expect(await checkBlockedBySpellcastingBuff(GUIDANCE, lv18Druid(), 'test-campaign')).toBeNull();
    // 5e twin: same passive bytes, different rules field — module never reads `rules`.
    const speakWithAnimals5e = { name: 'Speak with Animals', level: 1, rules: '5e', components: ['V', 'S'], material: null };
    expect(await checkBlockedBySpellcastingBuff(speakWithAnimals5e, lv18Druid(), 'test-campaign')).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('passive holder + text-detector costly material (Summon Beast disk bytes) → material refusal, exact popup + full log-entry key set', async () => {
    const result = await checkBlockedBySpellcastingBuff(SUMMON_BEAST, lv18Druid(), 'test-campaign');
    expect(result).toStrictEqual({
      automationPopup: {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Wild Shape',
          description: 'Summon Beast requires a Material component with a cost (or one the spell consumes) — Beast Spells does not allow it while Wild_Sage_Druid is in Beast form.',
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
      automationType: 'shape_shift_refused',
      automationDetail: 'material_component',
      creatureName: 'Wild_Sage_Druid',
      characterName: 'Wild_Sage_Druid',
      name: 'Wild Shape',
      description: 'Summon Beast blocked — costly or consumed Material components are not allowed while in Beast form (Beast Spells exception).',
    });
  });

  it('passive holder + trimmed spell ref (name only) → registry fallback still blocks with material reasoning (#1450 registry, wiring pinned here)', async () => {
    const result = await checkBlockedBySpellcastingBuff({ name: 'Raise Dead' }, lv18Druid(), 'test-campaign');
    expect(result.automationPopup.payload.description).toBe(
      'Raise Dead requires a Material component with a cost (or one the spell consumes) — Beast Spells does not allow it while Wild_Sage_Druid is in Beast form.'
    );
    const entry = addEntry.mock.calls[0][1];
    expect(entry.automationDetail).toBe('material_component');
    expect(entry.automationType).toBe('shape_shift_refused');
    expect(entry.description).toBe('Raise Dead blocked — costly or consumed Material components are not allowed while in Beast form (Beast Spells exception).');
  });

  it('passive holder + real M-component spell with no cost text and no registry row → silent ALLOW (documented passthrough, #1441-family)', async () => {
    expect(await checkBlockedBySpellcastingBuff(ACID_ARROW_5E, lv18Druid(), 'test-campaign')).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('no beast_spells passive (empty, wrong-effect, empty) → CLA-391 blanket form refusal; unnamed buff falls back to Shape-Shift name', async () => {
    // Wrong-effect passive kills effect-mutants of the some() filter.
    const hunterLore = druid([{ type: 'passive_rule', effect: 'hunter_lore' }]);
    // Wrong-type passive kills type-mutants despite correct effect byte.
    const wrongType = druid([{ type: 'class_feature', effect: 'beast_spells' }]);
    for (const stats of [noPassiveDruid(), hunterLore, wrongType]) {
      const result = await checkBlockedBySpellcastingBuff(GUIDANCE, stats, 'test-campaign');
      expect(result.automationPopup.payload.description).toBe(
        'Guidance cannot be cast while Wild_Sage_Druid is under Wild Shape — no Spellcasting is allowed.'
      );
      const entry = addEntry.mock.calls.at(-1)[1];
      expect(entry.automationDetail).toBeUndefined();
      expect(entry.automationType).toBe('shape_shift_refused');
      expect(entry.description).toBe('Guidance blocked — Wild_Sage_Druid cannot cast spells while under Wild Shape.');
    }
    // Unnamed blocking buff → 'Shape-Shift' fallback bytes.
    getActiveBuffs.mockReturnValue([{ effect: 'shape_shift', blocksSpellcasting: true }]);
    const result = await checkBlockedBySpellcastingBuff(GUIDANCE, noPassiveDruid(), 'test-campaign');
    expect(result.automationPopup.payload.name).toBe('Shape-Shift');
    expect(result.automationPopup.payload.description).toBe(
      'Guidance cannot be cast while Wild_Sage_Druid is under Shape-Shift — no Spellcasting is allowed.'
    );
  });
});

describe('CLA-404 truth table — PUBLIC SEAM (fix#300/#1465: beastSpellsAllowsCast demoted module-local, fix#82 coordinated retarget)', () => {
  // Every row flows through checkBlockedBySpellcastingBuff with the blocking
  // WILD_SHAPE_BUFF active (beforeEach): allow-side verdict === null, deny-side
  // verdict === automationPopup — the demoted helper's boolean maps 1:1 onto the
  // public gate's observable shape (fix#297 row-9 public-surface pattern).
  it('holder×free allow; holder×costly and non-holder×any deny; missing automation denies without throwing; null spell silently allows', async () => {
    // Quadrant rows (disk-faithful fixtures above).
    await expect(checkBlockedBySpellcastingBuff(GUIDANCE, lv18Druid(), 'test-campaign')).resolves.toBeNull();
    await expect(checkBlockedBySpellcastingBuff(SUMMON_BEAST, lv18Druid(), 'test-campaign')).resolves.toMatchObject({ automationPopup: { type: 'popup' } });
    await expect(checkBlockedBySpellcastingBuff(GUIDANCE, noPassiveDruid(), 'test-campaign')).resolves.toMatchObject({ automationPopup: { type: 'popup' } });
    await expect(checkBlockedBySpellcastingBuff(SUMMON_BEAST, noPassiveDruid(), 'test-campaign')).resolves.toMatchObject({ automationPopup: { type: 'popup' } });
    // Golden non-throw guard (#1360 family): automation key absent → deny popup, no throw.
    await expect(checkBlockedBySpellcastingBuff(GUIDANCE, { name: 'Wild_Sage_Druid' }, 'test-campaign')).resolves.toMatchObject({ automationPopup: { type: 'popup' } });
    // Quirk pin (silent-null): null spell → detector false → ALLOW for passive holders;
    // the public gate returns null at the allow branch BEFORE any spell deref, so the
    // call completes silently (materialComponents #1450 pins its own detector(false)
    // side; the gate-side consequence is owned here).
    await expect(checkBlockedBySpellcastingBuff(null, lv18Druid(), 'test-campaign')).resolves.toBeNull();
  });
});
