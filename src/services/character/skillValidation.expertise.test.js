// @maintained-by-ai
// skillValidation SEAM MAP — this file = PUBLIC FAÇADE expertise lane (#2056): getExpertiseLimits
// imported through the skillValidation.js re-export, counting class/subclass expertise from
// VERBATIM disk rows (fabricated-vs-disk drill: no invented feature shapes).
//   • DISK RAW (re-verified against disk, contradicting the lv7/lv20 rumor): Rogue Expertise rows
//     live at lv1 and lv6 in BOTH rulesets → 2 slots at lv1, +2 at lv6 = 4. 2024 Ranger:
//     Deft Explorer lv2 = 1 ("You gain Expertise in that skill"), Expertise lv9 = +2 → 3.
//   • feats lane (skillValidation-feats.test.js, #2054, canonical home): ALL feat-granted
//     expertise (Boon of Skill, Keen Mind colon-pool quirk) — no feats flow through this file.
//   • skillValidation/expertise.test.js (#2059, home of INTERNAL exports): parseClassExpertiseSkillList
//     and the restricted-list gates — internals cited here, never re-pinned.
//   • siblings: -core (skill totals), -choice-sources (pools), .major-feature (Student of War),
//     .validation (validateSkills messages / getSkillInfo).
// Idiom per #2055: resetAllMocks-beforeEach + explicit safe defaults (a forgotten per-test
// override degrades to "class data not found" instead of leaking the previous test's fixtures).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchFeatData: vi.fn(),
  loadFeatData: vi.fn(),
  loadEquipment: vi.fn(async () => []),
}));

import { getExpertiseLimits } from './skillValidation.js';

const disk5e = JSON.parse(readFileSync('public/data/classes.json', 'utf8'));
const disk2024 = JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8'));
const diskClass = (ruleset, name) =>
  (ruleset === '2024' ? disk2024 : disk5e).find((c) => c.name === name);
const expertiseRowLevels = (cls) =>
  cls.class_levels
    .filter((l) => (l.features || []).some((f) => f.name === 'Expertise'))
    .map((l) => l.level);

beforeEach(() => {
  vi.resetAllMocks();
  // Safe defaults: class data served from real disk (exact-name lookup, null when absent).
  vi.mocked(dataLoader.fetchClassData).mockImplementation(
    async (name, ruleset = '5e') => diskClass(ruleset, name) ?? null,
  );
  vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
  vi.mocked(dataLoader.loadEquipment).mockResolvedValue([]);
});

describe('skillValidation facade — getExpertiseLimits (class expertise counts, disk-anchored)', () => {
  it('Rogue: disk RAW pins Expertise rows at lv1+lv6, slots accrue 2 → 2 → 4, both rulesets', async () => {
    // Disk RAW anchor: if classes.json ever re-anchors Expertise (e.g. to lv7/lv20), fail loudly here.
    expect(expertiseRowLevels(diskClass('5e', 'Rogue'))).toEqual([1, 6]);
    expect(expertiseRowLevels(diskClass('2024', 'Rogue'))).toEqual([1, 6]);

    const boundaries = [
      { level: 1, count: 2 },
      { level: 5, count: 2 },
      { level: 6, count: 4 },
      { level: 20, count: 4 },
    ];
    for (const ruleset of ['5e', '2024']) {
      for (const { level, count } of boundaries) {
        const result = await getExpertiseLimits(
          { rules: ruleset, class: { name: 'Rogue' }, level },
          [],
        );
        expect(result, `Rogue lv${level} (${ruleset})`).toMatchObject({
          allowed: true,
          count,
          classCount: count,
          featCount: 0,
        });
      }
      // Full façade contract at one boundary: ruleset passthrough + hardcoded details format.
      expect(dataLoader.fetchClassData).toHaveBeenCalledWith('Rogue', ruleset);
      const first = await getExpertiseLimits(
        { rules: ruleset, class: { name: 'Rogue' }, level: 1 },
        [],
      );
      expect(first.details).toBe('Rogue can have expertise in 2 skill(s) at level 1');
    }
  });

  it('Ranger (2024 disk): 0 → Deft Explorer lv2 (+1) → Expertise lv9 (+2), exact details', async () => {
    const at = async (level) =>
      getExpertiseLimits({ rules: '2024', class: { name: 'Ranger' }, level }, []);

    expect(await at(1)).toMatchObject({ allowed: false, count: 0 });
    // Deft Explorer's "You gain Expertise in that skill." parses to exactly 1 slot.
    expect(await at(2)).toMatchObject({ allowed: true, count: 1, classCount: 1, featCount: 0 });
    expect((await at(2)).details).toBe('Ranger can have expertise in 1 skill(s) at level 2');
    // lv9 Expertise row ("Choose two...") adds 2 more — total 3, stable to lv20.
    expect(await at(9)).toMatchObject({ allowed: true, count: 3 });
    expect(await at(20)).toMatchObject({ allowed: true, count: 3 });
  });

  it('denies gracefully: class without expertise, no class, unknown class, class data without class_levels', async () => {
    // Real disk Fighter (2024): levels present, zero expertise text anywhere → 0 slots.
    expect(expertiseRowLevels(diskClass('2024', 'Fighter'))).toEqual([]);
    expect(await getExpertiseLimits({ rules: '2024', class: { name: 'Fighter' }, level: 2 }, [])).toMatchObject({
      allowed: false,
      count: 0,
      details: 'Fighter can have expertise in 0 skill(s) at level 2',
    });

    // No class selected: never even loads class data.
    const callsBefore = vi.mocked(dataLoader.fetchClassData).mock.calls.length;
    const noClass = await getExpertiseLimits({ rules: '2024', level: 1 }, []);
    expect(noClass).toMatchObject({ allowed: false, count: 0, details: 'No class selected' });
    expect(vi.mocked(dataLoader.fetchClassData).mock.calls).toHaveLength(callsBefore);

    // Unknown class → loader null → per-class denial message.
    expect(diskClass('2024', 'Mystic')).toBeUndefined();
    expect(await getExpertiseLimits({ rules: '2024', class: { name: 'Mystic' }, level: 5 }, [])).toMatchObject({
      allowed: false,
      count: 0,
      details: 'Expertise is not available for Mystic',
    });

    // Class data present but missing class_levels → same graceful denial.
    vi.mocked(dataLoader.fetchClassData).mockImplementationOnce(async () => ({ name: 'Rogue' }));
    expect(await getExpertiseLimits({ rules: '2024', class: { name: 'Rogue' }, level: 20 }, [])).toMatchObject({
      allowed: false,
      count: 0,
      details: 'Expertise is not available for Rogue',
    });
  });

  it('consumes subclass expertise from the container matching the ruleset, gated on feature level', async () => {
    // 2024: real lv6 Expertise feature (verbatim disk row) re-hosted under the Thief major —
    // no disk major ships an expertise grant today, so container wiring is pinned for future data.
    const expertise2024 = diskClass('2024', 'Rogue').class_levels.find((l) => l.level === 6)
      .features.find((f) => f.name === 'Expertise');
    vi.mocked(dataLoader.fetchClassData).mockImplementation(async () => ({
      class_levels: [{ level: 1, features: [] }],
      majors: [{ name: 'Thief', features: [expertise2024] }],
    }));
    const form2024 = { rules: '2024', class: { name: 'Rogue', subclass: { name: 'Thief' } } };
    expect(await getExpertiseLimits({ ...form2024, level: 5 }, [])).toMatchObject({ allowed: false, count: 0 });
    expect(await getExpertiseLimits({ ...form2024, level: 6 }, [])).toMatchObject({ allowed: true, count: 2, classCount: 2 });

    // 5e: real lv6 Expertise feature re-hosted under the 5e Thief subclass class_levels.
    const expertise5e = diskClass('5e', 'Rogue').class_levels.find((l) => l.level === 6)
      .features.find((f) => f.name === 'Expertise');
    vi.mocked(dataLoader.fetchClassData).mockImplementation(async () => ({
      class_levels: [{ level: 1, features: [] }],
      subclasses: [{ name: 'Thief', class_levels: [{ level: 6, features: [expertise5e] }] }],
    }));
    const form5e = { rules: '5e', class: { name: 'Rogue', subclass: { name: 'Thief' } } };
    expect(await getExpertiseLimits({ ...form5e, level: 5 }, [])).toMatchObject({ allowed: false, count: 0 });
    expect(await getExpertiseLimits({ ...form5e, level: 6 }, [])).toMatchObject({ allowed: true, count: 2, classCount: 2 });
  });

  it('ignores wrong-container and wrong-subclass expertise decoys', async () => {
    const expertise2024 = diskClass('2024', 'Rogue').class_levels.find((l) => l.level === 6)
      .features.find((f) => f.name === 'Expertise');

    // 2024 must NOT read the legacy `subclasses` container.
    vi.mocked(dataLoader.fetchClassData).mockImplementationOnce(async () => ({
      class_levels: [{ level: 1, features: [] }],
      subclasses: [{ name: 'Thief', class_levels: [{ level: 6, features: [expertise2024] }] }],
    }));
    expect(
      await getExpertiseLimits({ rules: '2024', class: { name: 'Rogue', subclass: { name: 'Thief' } }, level: 6 }, []),
    ).toMatchObject({ allowed: false, count: 0 });

    // 5e must NOT read the 2024-only `majors` container.
    vi.mocked(dataLoader.fetchClassData).mockImplementationOnce(async () => ({
      class_levels: [{ level: 1, features: [] }],
      majors: [{ name: 'Thief', features: [expertise2024] }],
    }));
    expect(
      await getExpertiseLimits({ rules: '5e', class: { name: 'Rogue', subclass: { name: 'Thief' } }, level: 6 }, []),
    ).toMatchObject({ allowed: false, count: 0 });

    // Right container, right ruleset, but the major name does not match the selected subclass.
    vi.mocked(dataLoader.fetchClassData).mockImplementationOnce(async () => ({
      class_levels: [{ level: 1, features: [] }],
      majors: [{ name: 'Thief', features: [expertise2024] }],
    }));
    expect(
      await getExpertiseLimits({ rules: '2024', class: { name: 'Rogue', subclass: { name: 'Assassin' } }, level: 6 }, []),
    ).toMatchObject({ allowed: false, count: 0 });
  });
});
