// @maintained-by-ai 2026-11-24
// skillValidation limits.js SOURCE-ATTRIBUTION lane (RH 2026-11-24 fix):
// getSkillLimits' details sentence must name each slot bucket by its REAL source.
//   • 5e quick-build lane (background '' BY DESIGN — the wizard hides the
//     Background step and deriveQuickBackground answers ''): the free-choice
//     bucket the validator enforces is class-sourced, so NO 'from your
//     background' clause may render and the (N total) must equal `allowed`.
//   • background-bearing lane (2024 quick-build Soldier/Guard): the clause
//     stays, with per-source counts off real disk data and an honest total.
//   • the rule is count-driven, so a 2024 build WITHOUT a background also
//     drops the clause — no string-specific branching on ruleset.
// Cited homes, never re-pinned here: -core (fromX shapes, totals, hardcoded 5e
// background default), -choice-sources (skillChoiceSources pools), feats
// (feat suffixes). Disk honesty: every row below is verbatim from
// public/data/classes.json, public/data/races.json, public/data/2024/*.json.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import * as dataLoader from '../../ui/dataLoader.js';

vi.mock('../../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchFeatData: vi.fn(),
  loadFeatData: vi.fn(async () => []),
  loadEquipment: vi.fn(async () => []),
}));

import { getSkillLimits } from './limits.js';

const disk5eClass = (name) =>
  JSON.parse(readFileSync('public/data/classes.json', 'utf8')).find((c) => c.name === name);
const disk5eRace = (name) =>
  JSON.parse(readFileSync('public/data/races.json', 'utf8')).find((r) => r.name === name);
const disk2024Class = (name) =>
  JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8')).find((c) => c.name === name);
const disk2024Race = (name) =>
  JSON.parse(readFileSync('public/data/2024/races.json', 'utf8')).find((r) => r.name === name);
const disk2024Background = (name) =>
  JSON.parse(readFileSync('public/data/2024/backgrounds.json', 'utf8')).find((b) => b.name === name);

// Pull the "(N total)" figure out of the attribution sentence.
const statedTotal = (details) => Number(details.match(/\((\d+) total\)/)[1]);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getSkillLimits source attribution (limits.js details sentence)', () => {
  it('5e empty-background build names the free-choice bucket by class, never by background', async () => {
    // Verbatim disk rows: 5e Fighter/races carry no top-level skill_proficiencies
    // string, so both parse to 0 and the whole `allowed` budget is the anonymous
    // 2-slot choice bucket the validator enforces.
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(disk5eClass('Fighter'));
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(disk5eRace('Human'));

    const result = await getSkillLimits(
      { rules: '5e', class: { name: 'Fighter' }, race: { name: 'Human' }, background: '' },
      [],
    );

    expect(result.details).toBe('In 5e rules, you get 2 skill choice(s), 0 from your race (2 total)');
    expect(result.details).not.toContain('background');
    // The stated total is exactly what the validator enforces.
    expect(result.allowed).toBe(2);
    expect(statedTotal(result.details)).toBe(result.allowed);
    // No pools → WizardStepSkills renders this details line verbatim; the
    // fromBackground shape the validator counts is unchanged.
    expect(result.skillChoiceSources).toEqual([]);
    expect(result.fromBackground).toEqual({ count: 2, skills: [], isChoice: true });
  });

  it('5e build WITH a named background keeps the honest background clause', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History', // synthetic choice shape
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(disk5eRace('Human'));

    const result = await getSkillLimits(
      { rules: '5e', class: { name: 'Wizard' }, race: { name: 'Human' }, background: 'Acolyte' },
      [],
    );

    expect(result.details).toBe(
      'In 5e rules, you get 2 skill choice(s) from Arcana, History, 0 from your race, and 2 from your background (4 total)'
    );
    expect(statedTotal(result.details)).toBe(result.allowed);
  });

  it('2024 quick-build (Fighter/Human/Guard) attributes each real source verbatim off disk', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(disk2024Class('Fighter'));
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(disk2024Race('Human'));
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(disk2024Background('Guard'));

    const result = await getSkillLimits(
      { rules: '2024', class: { name: 'Fighter' }, race: { name: 'Human' }, background: 'Guard' },
      [],
    );

    // class 2 (Choose 2 off disk) + race 1 (Skillful) + background 2
    // (Guard: "Athletics and Perception")
    expect(result.details.startsWith(
      'You get 2 skill choice(s) from Acrobatics, Animal Handling, Athletics, History, Insight, ' +
      'Intimidation, Persuasion, Perception, Survival, 1 from your race, ' +
      'and 2 from your background (5 total)'
    )).toBe(true);
    expect(statedTotal(result.details)).toBe(result.allowed);
    expect(result.fromBackground).toEqual({ count: 2, skills: ['Athletics', 'Perception'], isChoice: false });
  });

  it('2024 build with no background drops the clause too — the rule is count-driven, not ruleset-specific', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(disk2024Class('Fighter'));
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(disk2024Race('Human'));
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

    const result = await getSkillLimits(
      { rules: '2024', class: { name: 'Fighter' }, race: { name: 'Human' }, background: '' },
      [],
    );

    expect(result.details).not.toContain('from your background');
    // class 2 + race 1 + background 0: total stays honest against `allowed`.
    expect(statedTotal(result.details)).toBe(result.allowed);
    expect(result.allowed).toBe(3);
  });
});
