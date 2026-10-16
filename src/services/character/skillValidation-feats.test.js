// @maintained-by-ai
// skillValidation PAIR seam map (this file = feats lane; siblings cite it, don't re-pin):
//   • feats (HERE): canonical home (#2054) for the feat-granted lanes — Boon of Skill all-skills
//     short-circuit (getSkillLimits / getPreSelectedSkills all-18), the loadFeatData fallback with
//     its 5e-vs-2024 dataset split (Epic Boons exist ONLY on 2024 disk), expertise granted via
//     feats (counted, and feat-only allowance), and the validateSkills integration that rides the
//     short-circuit. Feat fixtures re-anchored VERBATIM to public/data/2024/feats.json (and the
//     negative against public/data/feats.json) per the featValidation disk-re-anchor precedent —
//     no fabricated feats. The disk boon spells its name 'Boon Of Skill' (capital O); the
//     short-circuit details string is HARDCODED lowercase in limits.js and pinned verbatim.
//   • core: totals, fromX shapes, null-data defaults, 5e background default, getPreSelectedSkills
//     accumulation, the 2024 base details clause verbatim — cited, not re-pinned here.
//   • choice-sources: skillChoiceSources attribution incl. Skill Expert pool entries — cited,
//     not re-pinned here.
//   • skillValidation.expertise.test.js: class expertise counts/parsing (never passes feats — the
//     feat expertise lanes are unique to this file). skillValidation.major-feature.test.js:
//     Student of War. skillValidation.validation.test.js: validateSkills messages / getSkillInfo.
//   • skillValidation/{expertise,validation}.test.js (subdir): internal exports (restricted
//     skill-list gates) — different granularity, complementary.
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

import {
  getSkillLimits,
  getPreSelectedSkills,
  getExpertiseLimits,
  validateSkills,
} from './skillValidation.js';

const diskFeats2024 = JSON.parse(readFileSync('public/data/2024/feats.json', 'utf8'));
const diskFeats5e = JSON.parse(readFileSync('public/data/feats.json', 'utf8'));
const diskBoon = () => JSON.parse(JSON.stringify(diskFeats2024.find((f) => f.index === 'boon-of-skill')));
const diskTough = () => JSON.parse(JSON.stringify(diskFeats2024.find((f) => f.name === 'Tough')));

// Canonical D&D 5e skill list — rules anchor, deliberately NOT imported from constants.js so a
// drift in ALL_SKILL_NAMES fails here loudly.
const CANONICAL_18 = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History',
  'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception',
  'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival',
];

// Synthetic parse-shape (class lane parsing owned by core lane; only here to prove the boon
// short-circuit happens BEFORE class parsing).
const wizardChoose2 = { skill_proficiencies: 'Choose 2 from Arcana, History' };

describe('skillValidation - feats lane (Boon of Skill + feat-granted expertise, off disk)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([]);
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
  });

  it('getSkillLimits: selected Boon of Skill short-circuits to all 18 with zeroed attributions and no choice pools', async () => {
    const boon = diskBoon();
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(wizardChoose2);

    const result = await getSkillLimits(
      { rules: '2024', class: { name: 'Wizard' }, feats: ['Boon Of Skill'] },
      [boon],
    );

    expect(result).toMatchObject({
      allowed: 18,
      allSkillsGranted: true,
      // Hardcoded in limits.js — lowercase "of" even though disk names it 'Boon Of Skill'.
      details: 'Boon of Skill grants proficiency in all skills',
      // Class/race/background attribution zeroed so nothing double-counts under the boon.
      fromClass: { count: 0, skills: [], isChoice: true },
      fromRace: { count: 0, skills: [], isChoice: false },
      fromBackground: { count: 0, skills: [], isChoice: false },
    });
    // No pools + no Skilled uses: the exact contract that lets all-18 pass validateSkills.
    expect(result.skillChoiceSources).toBeUndefined();
    expect(result.skilledUsesAvailable).toBe(0);
    expect(result.skilledUsesUsed).toBe(0);
  });

  it('allFeats empty: falls back to loadFeatData per ruleset — 2024 disk grants all 18, 5e disk has no Epic Boons so no short-circuit', async () => {
    vi.mocked(dataLoader.loadFeatData).mockImplementation(async (ruleset) =>
      ruleset === '2024' ? diskFeats2024 : diskFeats5e);
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(wizardChoose2);

    const granted = await getSkillLimits(
      { rules: '2024', class: { name: 'Wizard' }, feats: ['Boon Of Skill'] },
      [],
    );
    expect(granted.allowed).toBe(18);
    expect(granted.allSkillsGranted).toBe(true);

    // Same feat name under 5e: not on the 5e disk, so the boon lane must not fire
    // (normal 5e path: class 2 + hardcoded background 2; core lane owns that default).
    const denied = await getSkillLimits(
      { rules: '5e', class: { name: 'Wizard' }, feats: ['Boon Of Skill'] },
      [],
    );
    expect(denied.allSkillsGranted).toBeUndefined();
    expect(denied.allowed).toBe(4);
    expect(denied.details).not.toContain('Boon');
  });

  it('getPreSelectedSkills: Boon of Skill pre-selects exactly the canonical 18 skills', async () => {
    const result = await getPreSelectedSkills(
      { rules: '2024', class: { name: 'Wizard' }, feats: ['Boon Of Skill'] },
      [diskBoon()],
    );

    expect([...result].sort()).toEqual([...CANONICAL_18].sort());
    expect(result).toHaveLength(18);
  });

  it('getExpertiseLimits: Rogue lv2 class Expertise plus the boon Expertise benefit = 3 slots (+ 1 from feats)', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      class_levels: [
        { level: 1, features: [] },
        { level: 2, features: [{ name: 'Expertise', feature_specific: { expertise: { count: 2 } } }] },
      ],
    });

    const result = await getExpertiseLimits(
      { rules: '2024', class: { name: 'Rogue' }, level: 2, feats: ['Boon Of Skill'] },
      [diskBoon()],
    );

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(3);
    expect(result.classCount).toBe(2);
    expect(result.featCount).toBe(1);
    expect(result.details).toContain(' + 1 from feats');
    // Disk boon's Expertise text ("Choose one skill in which you lack Expertise.") carries no
    // enumerated pool, so it must not register a restricted feat skill list.
    expect(result.featExpertiseSkillLists).toBeNull();
  });

  it('getExpertiseLimits: boon alone (no class selected) still allows expertise — "Feats grant 1 expertise slot(s)"', async () => {
    const result = await getExpertiseLimits(
      { rules: '2024', feats: ['Boon Of Skill'] },
      [diskBoon()],
    );

    expect(result).toMatchObject({
      allowed: true,
      count: 1,
      classCount: 0,
      featCount: 1,
      details: 'Feats grant 1 expertise slot(s)',
    });
  });

  it('validateSkills: all 18 proficient + 1 boon expertise is clean; a 2nd expert trips only the expertise-count gate', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(wizardChoose2);

    const formData = {
      rules: '2024',
      class: { name: 'Wizard' },
      feats: ['Boon Of Skill'],
      skillProficiencies: [...CANONICAL_18],
      expertSkills: ['Acrobatics'],
    };
    expect(await validateSkills(formData, [diskBoon()])).toEqual([]);

    const greedy = { ...formData, expertSkills: ['Acrobatics', 'Stealth'] };
    const warnings = await validateSkills(greedy, [diskBoon()]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('warning');
    expect(warnings[0].message).toMatch(/expertise in 1 skill\(s\)\. You have selected 2\./);
  });

  it('normal path untouched: selecting disk Tough (boon present in library but unselected) or passing no feats at all never short-circuits', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(wizardChoose2);

    // Tough resolves in allFeats but grants only HP off disk — if matching ever ran over allFeats
    // instead of the selection, the boon would leak in here as all-18.
    const toughSelected = await getSkillLimits(
      { rules: '2024', class: { name: 'Wizard' }, feats: ['Tough'] },
      [diskBoon(), diskTough()],
    );
    expect(toughSelected.allowed).toBe(2);
    expect(toughSelected.allSkillsGranted).toBeUndefined();
    expect(toughSelected.details).not.toContain('Boon');

    const noFeats = await getSkillLimits(
      { rules: '2024', class: { name: 'Wizard' } },
      [],
    );
    expect(noFeats.allowed).toBe(2);
    expect(noFeats.allSkillsGranted).toBeUndefined();
  });
});
