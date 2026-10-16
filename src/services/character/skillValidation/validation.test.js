// @maintained-by-ai
// skillValidation SUBDIR internals lane (#2060): validation.js gate INTERNALS at the mocked
// limits/expertise seam — warnClassRestrictedExpertise hard/soft arms + null-list short-circuit,
// warnFeatRestrictedExpertise slot budget, warnSkillsOutsidePools Skilled allowance + the
// 'exceed Skilled uses' variant, assignSkillsToSources overlap allocation, and
// warnSourceOverSelection Skilled-overflow coverage + the `featName || source` label fallback.
// Cited homes, never re-pinned here (flat-validation #2058 owns validateSkills façade MESSAGE
// strings computed from class data: over-count, out-of-pool plain variant, duplicates,
// requires-proficiency, 'Too many from class' full string, getSkillInfo join-order; -feats
// #2055 owns the plain expertise-count message + skilledUsesAvailable accrual shape;
// -choice-sources #2053 owns skillChoiceSources construction; .expertise #2059 owns
// parseClassExpertiseSkillList verbatim disk rows / Assassin internals).
// Disk honesty: SIX matches the verbatim public/data/2024/classes.json Wizard Scholar colon
// pool (parsed, pinned in .expertise #2059); every skillChoiceSources / limits object here is
// a SYNTHETIC mocked-seam input — no disk row is claimed from it. details strings are mock
// noise, quoted only where interpolated into a pinned message.
// Idiom per #2055/#2058: resetAllMocks-beforeEach + explicit safe defaults (a forgotten
// override degrades loudly, never leaks the previous test's fixture). No timers.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSkills } from './validation.js';

vi.mock('./limits.js', () => ({
  getSkillLimits: vi.fn(),
}));
vi.mock('./expertise.js', () => ({
  getExpertiseLimits: vi.fn(),
}));

import { getSkillLimits } from './limits.js';
import { getExpertiseLimits } from './expertise.js';

// Verbatim Wizard Scholar six-skill pool (disk pin lives in .expertise #2059).
const SIX = ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion'];

// Synthetic mocked-seam limits (details = mock noise).
const wizardExpertiseLimits = {
  allowed: true,
  count: 1,
  classCount: 1,
  featCount: 0,
  classExpertiseSkillLists: [SIX],
  featExpertiseSkillLists: null,
  details: 'mock: 1 class expertise skill',
};

function form(overrides) {
  return {
    rules: '2024',
    class: { name: 'Wizard' },
    level: 2,
    skillProficiencies: ['Arcana', 'History'],
    expertSkills: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  // Safe defaults: 2 selected exactly fills `allowed`, no pools, no Skilled —
  // only expertise-gate overrides shape each test's warnings.
  getSkillLimits.mockResolvedValue({ allowed: 2, skillChoiceSources: [], skilledUsesAvailable: 0 });
  getExpertiseLimits.mockResolvedValue(wizardExpertiseLimits);
});

describe('warnClassRestrictedExpertise — hard arm (no free feat slot)', () => {
  it('accepts an in-list expert silently, hard-warns off-list experts, and never flags feat-list members', async () => {
    // In-list expert: fully clean pass through every gate.
    expect(await validateSkills(form({ expertSkills: ['Arcana'] }), [])).toEqual([]);

    // Off-list expert, no feat lists at all → hard warning with the full six-skill join.
    getSkillLimits.mockResolvedValue({ allowed: 3, skillChoiceSources: [], skilledUsesAvailable: 0 });
    const offList = await validateSkills(
      form({ skillProficiencies: ['Arcana', 'History', 'Perception'], expertSkills: ['Perception'] }),
      [],
    );
    expect(offList).toEqual([{
      message: `Class expertise is limited to: ${SIX.join(', ')}. Not eligible: Perception`,
      type: 'warning',
    }]);

    // Restricted feat slot EXISTS but is consumed by its own list member (Acrobatics):
    // the off-list Perception still hard-warns, Acrobatics is never flagged.
    getSkillLimits.mockResolvedValue({ allowed: 2, skillChoiceSources: [], skilledUsesAvailable: 0 });
    getExpertiseLimits.mockResolvedValue({
      ...wizardExpertiseLimits,
      count: 2,
      featCount: 1,
      featExpertiseSkillLists: [['Acrobatics']], // synthetic pool shape
    });
    const consumed = await validateSkills(
      form({ skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: ['Acrobatics', 'Perception'] }),
      [],
    );
    expect(consumed).toEqual([{
      message: `Class expertise is limited to: ${SIX.join(', ')}. Not eligible: Perception`,
      type: 'warning',
    }]);
  });
});

describe('warnClassRestrictedExpertise — soft arm and null-list short-circuit', () => {
  it('soft-warns an off-list expert while a feat expertise slot is still free', async () => {
    getExpertiseLimits.mockResolvedValue({
      ...wizardExpertiseLimits,
      count: 2,
      featCount: 2,
      featExpertiseSkillLists: [['Acrobatics']], // synthetic: only Acrobatics occupies a feat slot
    });
    const warnings = await validateSkills(
      form({ skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: ['Acrobatics', 'Perception'] }),
      [],
    );
    expect(warnings).toEqual([{
      message: `Perception is not in your class expertise list (${SIX.join(', ')}); it can only use a feat expertise slot.`,
      type: 'warning',
    }]);
  });

  it('short-circuits when no classExpertiseSkillLists exists (unrestricted Rogue grant)', async () => {
    getExpertiseLimits.mockResolvedValue({
      allowed: true,
      count: 2,
      classCount: 2,
      featCount: 0,
      classExpertiseSkillLists: null,
      featExpertiseSkillLists: null,
      details: 'mock: 2 unrestricted expertise skills',
    });
    // Same inputs that would flag Perception under a six-skill Wizard list stay clean.
    const warnings = await validateSkills(
      form({ class: { name: 'Rogue' }, skillProficiencies: ['Acrobatics', 'Perception'], expertSkills: ['Perception'] }),
      [],
    );
    expect(warnings).toEqual([]);
  });
});

describe('warnFeatRestrictedExpertise — feat/class slot budget', () => {
  it('fires its own budget warning only with feat expertise lists, co-firing after the plain count gate', async () => {
    getSkillLimits.mockResolvedValue({ allowed: 4, skillChoiceSources: [], skilledUsesAvailable: 0 });
    getExpertiseLimits.mockResolvedValue({
      allowed: true,
      count: 1,
      classCount: 0,
      featCount: 1,
      classExpertiseSkillLists: null,
      featExpertiseSkillLists: [['Insight']], // synthetic: feat-restricted, no class list
      details: 'mock: 1 feat expertise slot',
    });

    // Insight claims the single feat slot; Perception still overflows the 1-slot budget.
    const warnings = await validateSkills(
      form({ skillProficiencies: ['Arcana', 'History', 'Insight', 'Perception'], expertSkills: ['Insight', 'Perception'] }),
      [],
    );
    expect(warnings).toEqual([
      {
        message: 'You can have expertise in 1 skill(s). You have selected 2. (mock: 1 feat expertise slot)',
        type: 'warning',
      },
      {
        message: 'You have selected 2 skill(s) for expertise but only have 1 slot(s) available. (mock: 1 feat expertise slot)',
        type: 'warning',
      },
    ]);

    // Within budget: the feat-list member alone is clean.
    getSkillLimits.mockResolvedValue({ allowed: 3, skillChoiceSources: [], skilledUsesAvailable: 0 });
    expect(await validateSkills(
      form({ skillProficiencies: ['Arcana', 'History', 'Insight'], expertSkills: ['Insight'] }),
      [],
    )).toEqual([]);
  });
});

describe('assignSkillsToSources + warnSourceOverSelection — per-source allocation', () => {
  it('spreads overlapping skills into the source that still has capacity and names the drained pool verbatim', async () => {
    // class picks 1 from [Arcana, History]; feat 'Obsessive' picks 1 from its own list (synthetic shapes).
    const pools = [
      { source: 'class', count: 1, skills: ['Arcana', 'History'] },
      { source: 'feat', featName: 'Obsessive', count: 1, skills: ['Investigation', 'Religion'] },
    ];
    getSkillLimits.mockResolvedValue({ allowed: 2, skillChoiceSources: pools, skilledUsesAvailable: 0 });

    // One skill drawn from each pool: clean.
    expect(await validateSkills(form({ skillProficiencies: ['Arcana', 'Investigation'] }), [])).toEqual([]);

    // Both Obsessive-list skills: the feat pool is drained — label falls back to featName.
    expect(await validateSkills(form({ skillProficiencies: ['Investigation', 'Religion'] }), [])).toEqual([{
      message: 'Too many from Obsessive: 2 selected, only 1 allowed',
      type: 'warning',
    }]);

    // Overlapping pick (History is in both pools) is assigned to the pool that still
    // needs it, so two selections from a one-capacity pair stay clean.
    getSkillLimits.mockResolvedValue({
      allowed: 2,
      skillChoiceSources: [
        { source: 'class', count: 1, skills: ['Arcana', 'History'] },
        { source: 'race', count: 1, skills: ['History'] },
      ],
      skilledUsesAvailable: 0,
    });
    expect(await validateSkills(
      form({ race: { name: 'Human' }, skillProficiencies: ['Arcana', 'History'] }),
      [],
    )).toEqual([]);
  });
});

describe('warnSourceOverSelection + warnSkillsOutsidePools — Skilled overflow accounting', () => {
  // class 1-from-[Arcana, Religion, Investigation] + race 1-from-[Religion, History] (synthetic).
  // Arcana+Investigation drain class (1 over); Religion shares both full pools and strands
  // unassigned; outside-pool picks are pure Skilled territory.
  const pools = [
    { source: 'class', count: 1, skills: ['Arcana', 'Religion', 'Investigation'] },
    { source: 'race', count: 1, skills: ['Religion', 'History'] },
  ];
  const inside = ['Arcana', 'Investigation', 'History', 'Religion'];

  it('warns the source label when nothing covers the drain; one Skilled use covers drain plus one outside pick; an unaffordable outside pair reports the exceed-Skilled variant', async () => {
    getSkillLimits.mockResolvedValue({ allowed: 4, skillChoiceSources: pools, skilledUsesAvailable: 0 });
    expect(await validateSkills(form({ skillProficiencies: inside }), [])).toEqual([{
      message: 'Too many from class: 2 selected, only 1 allowed',
      type: 'warning',
    }]);

    getSkillLimits.mockResolvedValue({ allowed: 5, skillChoiceSources: pools, skilledUsesAvailable: 1 });
    expect(await validateSkills(form({ skillProficiencies: [...inside, 'Insight'] }), [])).toEqual([]);

    getSkillLimits.mockResolvedValue({ allowed: 6, skillChoiceSources: pools, skilledUsesAvailable: 1 });
    const warnings = await validateSkills(
      form({ skillProficiencies: [...inside, 'Insight', 'Acrobatics'] }),
      [],
    );
    // Over-selection is silently Skilled-covered; the unaffordable outside pair is not.
    expect(warnings).toEqual([{
      message: 'The following skills are not available from your class/race/feat choices and exceed Skilled uses: Insight, Acrobatics.',
      type: 'warning',
    }]);
  });
});
