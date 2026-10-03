// @improved-by-ai
// CLA-404: Beast Spells (Druid lv18 passive) — Wild Shape blanket block bypass
// in Beast form, except spells with a costly or consumed Material component.
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks (mirror blockChecks.test.js harness)                       */
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
/*  SUT imports (materialComponents stays REAL — its deps are mocked)*/
/* ------------------------------------------------------------------ */

const { addEntry } = await import('../../../../ui/logService.js');
const { getActiveBuffs } = await import('./spellResolution.js');
const { checkBlockedBySpellcastingBuff, beastSpellsAllowsCast } = await import('./blockChecks.js');

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const WILD_SHAPE_BUFF = { name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true };

const BEAST_SPELLS = [{ type: 'passive_rule', effect: 'beast_spells' }];

function makePlayerStats(overrides = {}) {
  return {
    name: 'Wild_Sage_Druid',
    automation: { passives: [], reactions: [], specialActions: [] },
    ...overrides,
  };
}

function lv18Druid() {
  return makePlayerStats({ automation: { passives: BEAST_SPELLS } });
}

// Guidance (2024): V/S cantrip, no Material — canonical lv18+ ALLOWED in Beast form.
function guidanceSpell() {
  return { name: 'Guidance', level: 0, components: ['V', 'S'] };
}

// Summon Beast (2024): V/S/M, gilded acorn worth 200+ GP — canonical REFUSED-material.
function summonBeastSpell() {
  return {
    name: 'Summon Beast',
    level: 2,
    components: ['V', 'S', 'M'],
    material: 'a feather, tuft of fur, and fish tail inside a gilded acorn worth 200+ GP',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getActiveBuffs.mockReturnValue([WILD_SHAPE_BUFF]);
});

describe('checkBlockedBySpellcastingBuff — Beast Spells bypass (CLA-404)', () => {
  it('lv18 passive + component-free spell (Guidance-shaped) → allowed, no refusal log', async () => {
    const result = await checkBlockedBySpellcastingBuff(guidanceSpell(), lv18Druid(), 'test-campaign');
    expect(result).toBeNull();
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => String(e.automationType).endsWith('_refused'));
    expect(refusal).toBeUndefined();
  });

  it('lv18 passive + V/S spell without material (Cure Wounds-shaped) → allowed', async () => {
    const spell = { name: 'Cure Wounds', level: 1, components: ['V', 'S'] };
    const result = await checkBlockedBySpellcastingBuff(spell, lv18Druid(), 'test-campaign');
    expect(result).toBeNull();
  });

  it('lv18 + Summon Beast-shaped (costly material) → refused with material reasoning', async () => {
    const result = await checkBlockedBySpellcastingBuff(summonBeastSpell(), lv18Druid(), 'test-campaign');
    expect(result?.automationPopup?.payload?.type).toBe('automation_info');
    expect(result.automationPopup.payload.name).toBe('Wild Shape');
    expect(result.automationPopup.payload.description).toContain('Material');
    expect(result.automationPopup.payload.description).toContain('Beast form');
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'shape_shift_refused');
    expect(refusal).toBeDefined();
    expect(refusal.automationDetail).toBe('material_component');
    expect(refusal.description).toContain('Summon Beast blocked');
  });

  it('lv18 + consumed-material spell without stated cost → refused-material', async () => {
    const spell = { name: 'Gentle Repose', level: 2, components: ['V', 'S', 'M'], material: '2 Copper Pieces, which the spell consumes' };
    const result = await checkBlockedBySpellcastingBuff(spell, lv18Druid(), 'test-campaign');
    expect(result).not.toBeNull();
    expect(result.automationPopup.payload.description).toContain('Material');
  });

  it('lv18 + trimmed spell ref (name only, registry fallback) → refused-material', async () => {
    const result = await checkBlockedBySpellcastingBuff({ name: 'Raise Dead' }, lv18Druid(), 'test-campaign');
    expect(result).not.toBeNull();
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'shape_shift_refused');
    expect(refusal.automationDetail).toBe('material_component');
  });

  it('no passive (lv<18 druid) + blocking buff → blanket form refusal, byte-shape unchanged (CLA-391)', async () => {
    const result = await checkBlockedBySpellcastingBuff(guidanceSpell(), makePlayerStats(), 'test-campaign');
    expect(result).not.toBeNull();
    expect(result.automationPopup.payload.description).toContain('no Spellcasting is allowed');
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'shape_shift_refused');
    expect(refusal).toBeDefined();
    expect(refusal.automationDetail).toBeUndefined();
    expect(refusal.description).toContain('cannot cast spells while under Wild Shape');
  });

  it('non-druid passive set + shape_shift buff → refused-form', async () => {
    const stats = makePlayerStats({ automation: { passives: [{ type: 'passive_rule', effect: 'hunter_lore' }] } });
    const result = await checkBlockedBySpellcastingBuff(guidanceSpell(), stats, 'test-campaign');
    expect(result).not.toBeNull();
    expect(result.automationPopup.payload.description).toContain('no Spellcasting is allowed');
  });

  it('lv18 passive but no blocking buff → null', async () => {
    getActiveBuffs.mockReturnValue([{ name: 'Shield', blocksSpellcasting: false }]);
    const result = await checkBlockedBySpellcastingBuff(guidanceSpell(), lv18Druid(), 'test-campaign');
    expect(result).toBeNull();
  });

  it('5e twin: passive byte-shape is ruleset-agnostic (same automation.passives consult)', async () => {
    const stats5e = makePlayerStats({ rules: '5e', automation: { passives: [{ type: 'passive_rule', effect: 'beast_spells' }] } });
    const result = await checkBlockedBySpellcastingBuff({ name: 'Speak with Animals', level: 1, components: ['V', 'S'] }, stats5e, 'test-campaign');
    expect(result).toBeNull();
  });
});

describe('beastSpellsAllowsCast predicate (CLA-404)', () => {
  it('allows component-free spells for passive holders', () => {
    expect(beastSpellsAllowsCast(guidanceSpell(), lv18Druid())).toBe(true);
  });

  it('denies costly-material spells for passive holders', () => {
    expect(beastSpellsAllowsCast(summonBeastSpell(), lv18Druid())).toBe(false);
  });

  it('denies for non-holders regardless of components', () => {
    expect(beastSpellsAllowsCast(guidanceSpell(), makePlayerStats())).toBe(false);
  });

  it('survives missing automation / missing spell', () => {
    expect(beastSpellsAllowsCast(guidanceSpell(), { name: 'X' })).toBe(false);
    expect(beastSpellsAllowsCast(null, lv18Druid())).toBe(true);
  });
});
