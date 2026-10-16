// @maintained-by-ai
// skillValidation FLAT-FAMILY CLOSER — this file's lane: validateSkills warning MESSAGES +
// getSkillInfo public façade. Sibling lanes are cited, never re-pinned:
//   • -core: getSkillLimits totals / fromX shapes / the 2024 base details clause verbatim.
//   • -choice-sources: skillChoiceSources attribution + the 'In 5e rules' prefix (#2053).
//   • -feats (#2055): the expertise-count message full-string '...expertise in 1 skill(s).
//     You have selected 2.' — that gate is NOT re-pinned here.
//   • .expertise (#2056): getExpertiseLimits slot accrual. .major-feature: Student of War pools.
//   • skillValidation/validation.test.js (#2060): internals with mocked limits — the restricted
//     class/feat expertise skill-list gates. Here those limits are COMPUTED from class data.
// rules-validation.json (both rulesets) has NO skill entries — every warning string here is
// hardcoded in validation.js, so full-string pins are against that source contract. Details
// interpolation is quoted (anchored count + paren wrapper), not re-pinned (core owns the clause).
// Disk honesty: fixtures marked "synthetic parse-shape" are parse inputs for validation.js only;
// no class/race/feat claims are made from them (disk rows live in the -core/-choice-sources lanes).
// Idiom per #2055: resetAllMocks-beforeEach + explicit safe defaults.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchFeatData: vi.fn(),
  loadFeatData: vi.fn(),
  loadEquipment: vi.fn(),
}));

import {
  validateSkills,
  getSkillInfo,
} from './skillValidation.js';

beforeEach(() => {
  vi.resetAllMocks();
  // Safe defaults: "data not found" — a forgotten per-test override degrades loudly,
  // it never leaks the previous test's fixtures.
  vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
  vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
  vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
  vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
  vi.mocked(dataLoader.loadEquipment).mockResolvedValue([]);
});

describe('validateSkills — warning messages', () => {
  it('names out-of-pool skills and over-count in one exact warning set', async () => {
    // synthetic parse-shape: only exercises validation.js pool/count templates
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
    });

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana', 'History', 'Insight', 'Religion'],
    }, []);

    // Pool warning pins full string; count warning pins its fixed template + interpolation,
    // quoting (not re-pinning) the details clause owned by the -core lane.
    expect(warnings).toEqual([
      {
        message: 'The following skills are not available from your class/race/feat choices: Insight, Religion. Only select from allowed skill pools.',
        type: 'warning',
      },
      {
        message: expect.stringMatching(/^Rules allow 2 skill proficiency\/ies\. You have selected 4\. \(You get .+ \(2 total\)\)$/),
        type: 'warning',
      },
    ]);
  });

  it('offers an info hint (not a warning) when fewer skills than allowed are selected', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History', // synthetic parse-shape
    });

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana'],
    }, []);

    expect(warnings).toEqual([
      {
        message: 'You can select up to 2 skill proficiencies. You have selected 1.',
        type: 'info',
      },
    ]);
  });

  it('stays silent when the selection exactly fills the pool', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History', // synthetic parse-shape
    });

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana', 'History'],
    }, []);

    expect(warnings).toEqual([]);
  });

  it('denies expertise for classes without it, naming the class or falling back to "this class"', async () => {
    // Expertise-count gate on the co-fired warning is owned by -feats #2055 — filtered out here.
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History', // synthetic parse-shape
      class_levels: [{ level: 1, features: [] }],
    });

    const fighterWarnings = await validateSkills({
      rules: '2024',
      class: { name: 'Fighter' },
      skillProficiencies: ['Arcana', 'History'],
      expertSkills: ['Arcana'],
    }, []);
    expect(fighterWarnings.filter((w) => w.message.startsWith('Expertise is not available'))).toEqual([
      {
        message: 'Expertise is not available for Fighter. Expertise is typically a Bard or Rogue feature.',
        type: 'warning',
      },
    ]);

    // No class at all: the formData.class?.name || 'this class' fallback branch.
    const noClassWarnings = await validateSkills({
      rules: '2024',
      skillProficiencies: ['Arcana'],
      expertSkills: ['Arcana'],
    }, []);
    expect(noClassWarnings.filter((w) => w.message.startsWith('Expertise is not available'))).toEqual([
      {
        message: 'Expertise is not available for this class. Expertise is typically a Bard or Rogue feature.',
        type: 'warning',
      },
    ]);
  });

  it('requires proficiency before expertise, listing every offending skill', async () => {
    // Expertise allowed (2 slots) so only the proficiency prerequisite fires here; the
    // restricted-list gates on top of this message are #2060's internals lane.
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 1 from Arcana', // synthetic parse-shape
      class_levels: [
        { level: 2, features: [{ name: 'Expertise', feature_specific: { expertise: { count: 2 } } }] },
      ],
    });

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Rogue' },
      level: 2,
      skillProficiencies: ['Arcana'],
      expertSkills: ['History', 'Medicine'],
    }, []);

    expect(warnings).toEqual([
      {
        message: 'Expertise requires proficiency first. These skills are not proficient: History, Medicine',
        type: 'warning',
      },
    ]);
  });

  it('flags a skill selected twice', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History', // synthetic parse-shape
    });

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana', 'Arcana'],
    }, []);

    expect(warnings).toEqual([
      {
        message: 'Some skills are selected multiple times. Each skill should only be selected once.',
        type: 'warning',
      },
    ]);
  });

  it('reports per-source over-selection when one pool is drained dry', async () => {
    // Class pool allows 1 but both selections live inside it (so no out-of-pool warning);
    // a fixed race grant keeps the total count clean so ONLY the source gate fires.
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 1 from Arcana, History', // synthetic parse-shape
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
      skill_proficiencies: 'Insight', // synthetic fixed-grant shape
    });

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana', 'History'],
    }, []);

    expect(warnings).toEqual([
      {
        message: 'Too many from class: 2 selected, only 1 allowed',
        type: 'warning',
      },
    ]);
  });

  it('says nothing for an empty or fully missing selection', async () => {
    // Safe defaults (all loaders null) — missing fields normalize to empty via `|| []`.
    expect(await validateSkills({ rules: '2024', class: { name: 'Wizard' } }, [])).toEqual([]);
    expect(await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      skillProficiencies: [],
      expertSkills: [],
    }, [])).toEqual([]);
  });
});

describe('getSkillInfo — per-skill attribution', () => {
  it('attributes a choice-pool class skill without pre-selecting it', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History', // synthetic parse-shape
    });

    expect(await getSkillInfo('Arcana', {
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
    })).toEqual({ isAllowed: true, source: 'Class', isPreSelected: false });
  });

  it('attributes a fixed race grant and marks it pre-selected', async () => {
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
      skill_proficiencies: 'Insight', // synthetic fixed-grant shape
    });

    expect(await getSkillInfo('Insight', {
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Dwarf' },
    })).toEqual({ isAllowed: true, source: 'Race', isPreSelected: true });
  });

  it('joins every matching source in class, race, background order', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 1 from Deception', // synthetic parse-shape
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
      skill_proficiencies: 'Deception', // synthetic fixed-grant shape
    });
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      skill_proficiencies: 'Deception and Persuasion', // verbatim public/data/2024/backgrounds.json Charlatan
    });

    expect(await getSkillInfo('Deception', {
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      background: 'Charlatan',
    })).toEqual({ isAllowed: true, source: 'Class, Race, Background', isPreSelected: true });
  });

  it('reports skills it cannot see — unknown name, majors container, feat grants', async () => {
    // Honest façade asymmetry (analog of #2051's resistances attribution quirk): validateSkills
    // honors major pools (major-feature lane) and feat pools (feats lane), but getSkillInfo
    // reads only class/race/background skill strings — such skills report as not allowed.
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Arcana', // synthetic — Stealth lives only in the majors decoy container
      majors: [{
        name: 'Battle Master',
        features: [{ level: 3, name: 'Student of War', proficiency_choices: [{ choose: 1, from: ['Skill: Stealth'] }] }],
      }],
    });

    expect(await getSkillInfo('Stealth', {
      rules: '2024',
      class: { name: 'Wizard', subclass: { name: 'Battle Master' } },
      feats: ['Keen Mind'],
    })).toEqual({ isAllowed: false, source: '', isPreSelected: false });
    expect(dataLoader.loadFeatData).not.toHaveBeenCalled();
  });

  it('never consults backgrounds under 5e rules', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      skill_proficiencies: 'Insight and Religion', // verbatim public/data/2024/backgrounds.json Acolyte — wrong-ruleset decoy
    });

    expect(await getSkillInfo('Insight', {
      rules: '5e',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      background: 'Acolyte',
    })).toEqual({ isAllowed: false, source: '', isPreSelected: false });
    expect(dataLoader.fetchBackgroundData).not.toHaveBeenCalled();
  });
});
