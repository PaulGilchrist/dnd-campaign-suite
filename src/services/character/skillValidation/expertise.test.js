// @maintained-by-ai
// skillValidation SUBDIR lane (#2059): INTERNAL exports of expertise.js —
// parseClassExpertiseSkillList colon-pool parsing + the classExpertiseSkillLists
// restricted-list gate of getExpertiseLimits. Cited homes, never re-pinned here:
// façade class totals/denial messages & subclass-container wiring → skillValidation.expertise.test.js
// (#2056); all feat-granted expertise → skillValidation-feats.test.js (#2054).
// Fixtures are VERBATIM disk rows from public/data/2024/classes.json (flat-vs-subdir
// naming-collision rename deferred per #2055 — both lanes complementary, kept).
// Idiom per #2055: resetAllMocks-beforeEach + safe defaults, so a forgotten override
// degrades to "no class data" instead of leaking the previous test's fixture.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { getExpertiseLimits, parseClassExpertiseSkillList } from './expertise.js';

vi.mock('../../ui/dataLoader.js', () => ({
  fetchClassData: vi.fn(),
  loadFeatData: vi.fn(),
}));

import { fetchClassData, loadFeatData } from '../../ui/dataLoader.js';

const disk2024 = JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8'));
const diskClass = (name) => disk2024.find((c) => c.name === name);
const diskFeature = (className, level, featName) =>
  diskClass(className).class_levels.find((l) => l.level === level)
    .features.find((f) => f.name === featName);

// Verbatim disk rows (no invented feature shapes).
const SCHOLAR = diskFeature('Wizard', 2, 'Scholar'); // colon pool: six skills
const ROGUE_EXPERTISE_LV6 = diskFeature('Rogue', 6, 'Expertise'); // unrestricted grant
const INFILTRATION_EXPERTISE = diskClass('Rogue').majors
  .find((m) => m.name === 'Assassin').features.find((f) => f.level === 9); // passive_rule only

beforeEach(() => {
  vi.resetAllMocks();
  fetchClassData.mockResolvedValue(null); // safe default: graceful "no class data" denial
  loadFeatData.mockResolvedValue([]);
});

describe('parseClassExpertiseSkillList', () => {
  it('parses the colon skill pool from the disk Wizard Scholar row; null for grants without a pool', () => {
    expect(SCHOLAR.description).toContain('Choose one of the following skills in which you have proficiency:');
    expect(parseClassExpertiseSkillList(SCHOLAR)).toEqual(['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion']);

    // Expertise mentioned but unrestricted (verbatim disk Bard rows): no "following skills:" pool → null.
    expect(parseClassExpertiseSkillList(diskFeature('Bard', 2, 'Expertise'))).toBeNull();
    expect(parseClassExpertiseSkillList(diskFeature('Bard', 9, 'Expertise'))).toBeNull();

    // No expertise keyword at all → null before the pool regex even runs (verbatim disk row).
    expect(parseClassExpertiseSkillList(diskFeature('Wizard', 1, 'Ritual Adept'))).toBeNull();
  });

  it('prefers feature_specific.expertise.skills over the description pool — 🔴 DEAD vs disk today (flag #1916)', () => {
    // Disk audit: feature_specific.expertise exists only on class_levels CONTAINERS
    // (Bard lv2/lv9, Rogue lv1/lv6) as { count, prerequisite } — never on feature rows,
    // never with .skills; expertise_options appears nowhere on disk. Forward-compat pin
    // for the source's explicit-list precedence, kept synthetic and labeled honestly.
    const withExplicit = { ...SCHOLAR, feature_specific: { expertise: { count: 1, skills: ['Arcana', 'History'] } } };
    expect(parseClassExpertiseSkillList(withExplicit)).toEqual(['Arcana', 'History']);
    // Empty explicit list falls through to the verbatim description colon pool.
    const withEmpty = { ...SCHOLAR, feature_specific: { expertise: { skills: [] } } };
    expect(parseClassExpertiseSkillList(withEmpty)).toEqual(['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion']);
  });
});

describe('getExpertiseLimits classExpertiseSkillLists gate', () => {
  it('gates 2024 Wizard to the six Scholar skills at lv2, silent at lv1 (verbatim disk class data)', async () => {
    fetchClassData.mockResolvedValue(diskClass('Wizard'));

    const lv1 = await getExpertiseLimits({ rules: '2024', class: { name: 'Wizard' }, level: 1 }, []);
    expect(lv1).toMatchObject({ allowed: false, count: 0, classExpertiseSkillLists: null });

    const lv2 = await getExpertiseLimits({ rules: '2024', class: { name: 'Wizard' }, level: 2 }, []);
    expect(lv2).toMatchObject({
      allowed: true,
      count: 1,
      classCount: 1,
      featCount: 0,
      classExpertiseSkillLists: [['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion']],
    });
    expect(lv2.details).toBe('Wizard can have expertise in 1 skill(s) at level 2. Class expertise is limited to: Arcana, History, Investigation, Medicine, Nature, Religion');
  });

  it('disables the gate when any class source is unrestricted: disk Bard, and restricted+unrestricted mixes', async () => {
    // Verbatim disk Bard: both Expertise rows (lv2, lv9) are unrestricted choice-of-your's.
    fetchClassData.mockResolvedValue(diskClass('Bard'));
    const bard = await getExpertiseLimits({ rules: '2024', class: { name: 'Bard' }, level: 9 }, []);
    expect(bard).toMatchObject({ allowed: true, classCount: 4, classExpertiseSkillLists: null });

    // One restricted pool + one unrestricted grant in the same class → gate opens wide.
    // (Synthetic placement of verbatim disk rows; no disk Wizard ships lv10 Expertise.)
    fetchClassData.mockResolvedValue({
      class_levels: [
        { level: 2, features: [SCHOLAR] },
        { level: 10, features: [ROGUE_EXPERTISE_LV6] },
      ],
    });
    const mixed = await getExpertiseLimits({ rules: '2024', class: { name: 'Wizard' }, level: 20 }, []);
    expect(mixed).toMatchObject({ classCount: 3, classExpertiseSkillLists: null });
  });

  it('collects restricted lists from 2024 majors, honoring the feature-level and major-name gates', async () => {
    // No disk major grants expertise today (Wizard majors are spellbook Savants), so this
    // wires verbatim disk rows under real disk major names — pinned for future data,
    // placement synthetic. Diviner holds an unrestricted decoy that must not be collected
    // when Abjurer is selected, and a non-matching major name collects nothing.
    fetchClassData.mockResolvedValue({
      class_levels: [{ level: 1, features: [] }],
      majors: [
        { name: 'Abjurer', features: [SCHOLAR] },
        { name: 'Diviner', features: [ROGUE_EXPERTISE_LV6] },
      ],
    });
    const form = (subclass, level) => ({ rules: '2024', class: { name: 'Wizard', subclass: { name: subclass } }, level });

    const gated = await getExpertiseLimits(form('Abjurer', 2), []);
    expect(gated).toMatchObject({ allowed: true, classCount: 1, classExpertiseSkillLists: [['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion']] });

    // Majors feature-level gate: lv2 Scholar is not consumed at level 1.
    expect(await getExpertiseLimits(form('Abjurer', 1), [])).toMatchObject({ count: 0, classExpertiseSkillLists: null });

    // Major-name gate: selected subclass with no matching major entry collects nothing.
    expect(await getExpertiseLimits(form('Transmuter', 20), [])).toMatchObject({ count: 0, classExpertiseSkillLists: null });
  });

  it('gate is null without a selected class (never fetching) or without class data', async () => {
    const noClass = await getExpertiseLimits({ rules: '2024', level: 1 }, []);
    expect(noClass).toMatchObject({ allowed: false, count: 0, classExpertiseSkillLists: null });
    expect(fetchClassData).not.toHaveBeenCalled();

    // fetchClassData default-resolves null (see beforeEach safe default).
    const noData = await getExpertiseLimits({ rules: '2024', class: { name: 'Wizard' }, level: 20 }, []);
    expect(noData).toMatchObject({ allowed: false, count: 0, classExpertiseSkillLists: null });
  });

  it('🔴 BUG (pinned honestly): disk lv9 "Infiltration Expertise" credits +2 expertise to 2024 Assassin', async () => {
    // countExpertiseFromFeature's name-branch matches any feature named *Expertise* and
    // defaults to +2 when its description has no "choose N". Disk lv9 Infiltration Expertise
    // (verbatim row, automation is passive_rule mimicry/roving_aim) grants NO expertise slot,
    // so Assassin classCount inflates 4 → 6 from lv9. Also slips past the restricted-list
    // parser (no colon pool → null), silently marking it unrestricted. Expected honest count: 4.
    fetchClassData.mockResolvedValue(diskClass('Rogue'));
    const assassinAt = (level) =>
      getExpertiseLimits({ rules: '2024', class: { name: 'Rogue', subclass: { name: 'Assassin' } }, level }, []);

    expect(INFILTRATION_EXPERTISE.name).toBe('Infiltration Expertise');
    expect(parseClassExpertiseSkillList(INFILTRATION_EXPERTISE)).toBeNull();

    expect(await assassinAt(8)).toMatchObject({ classCount: 4 }); // lv1+lv6 Expertise only
    expect(await assassinAt(9)).toMatchObject({ classCount: 6 }); // 🔴 should be 4 — phantom +2 from name match
    expect(await assassinAt(20)).toMatchObject({ classCount: 6 }); // 🔴 persists; lv13/lv17 add 0
  });
});
