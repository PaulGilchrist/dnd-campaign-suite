// @maintained-by-ai
// skillValidation PAIR seam map (this file = core lane; choice-sources = skillValidation-choice-sources.test.js):
//   • core (HERE): getSkillLimits totals, fromClass/fromRace/fromBackground shapes, null-data
//     defaults per ruleset, 5e hardcoded background default, getPreSelectedSkills auto-vs-choice
//     accumulation. Attribution/pools and the 5e 'In 5e rules' prefix: owned by the choice-sources
//     lane — cited, not re-pinned here.
//   • skillValidation.major-feature.test.js: canonical home for the 'major' lane (Student of War).
//     skillValidation-feats.test.js: canonical home for Boon of Skill short-circuit (including
//     getPreSelectedSkills all-18). skillValidation.validation.test.js: validateSkills messages /
//     getSkillInfo. skillValidation.expertise.test.js: expertise slots.
// rules-validation.json (both rulesets) has NO skill entries — details strings are built from the
// limits.js templates, so the 2024 base clause is pinned verbatim against that template here (only
// this lane pins it). Background rows re-anchored verbatim to public/data/2024/backgrounds.json
// (reuse the choice-sources disk rows); remaining fixtures are synthetic parse-shapes, marked as such.
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
} from './skillValidation.js';

describe('skillValidation - core lane (limits totals, fromX shapes, pre-selected)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSkillLimits', () => {
    it('2024: allowed sums class+race+background and each fromX keeps its own shape', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History', // synthetic choice shape
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight', // synthetic fixed-grant shape
      });
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
        skill_proficiencies: 'Deception and Sleight of Hand', // verbatim public/data/2024/backgrounds.json Charlatan
      });

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Charlatan',
      }, []);

      // class 2 + race 1 + background 2 (+0 feats)
      expect(result.allowed).toBe(5);
      expect(result.fromClass).toEqual({ count: 2, skills: ['Arcana', 'History'], isChoice: true });
      expect(result.fromRace).toEqual({ count: 1, skills: ['Insight'], isChoice: false });
      expect(result.fromBackground).toEqual({ count: 2, skills: ['Deception', 'Sleight of Hand'], isChoice: false });
      // 2024 details template (limits.js), pinned once here; feat suffixes owned by choice-sources lane
      expect(result.details).toBe(
        'You get 2 skill choice(s) from Arcana, History, 1 from your race, and 2 from your background (5 total)'
      );
    });

    it('5e: background default is hardcoded count-only and never fetched, even when background data exists', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight',
      });
      // 2024-Acolyte disk row as wrong-container decoy: the 5e lane must not consume it
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
        skill_proficiencies: 'Insight and Religion',
      });

      const result = await getSkillLimits({
        rules: '5e',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Acolyte',
      }, []);

      // class 2 + race 1 + hardcoded background 2 (+0 feats)
      expect(result.allowed).toBe(5);
      expect(result.fromClass).toEqual({ count: 2, skills: ['Arcana', 'History'], isChoice: true });
      expect(result.fromRace).toEqual({ count: 1, skills: ['Insight'], isChoice: false });
      expect(result.fromBackground).toEqual({ count: 2, skills: [], isChoice: true });
      expect(dataLoader.fetchBackgroundData).not.toHaveBeenCalled();
    });

    it('all-null data still yields each ruleset\'s own baseline: 5e keeps background 2, 2024 grants nothing', async () => {
      const result5e = await getSkillLimits({ rules: '5e' }, []);
      expect(result5e.allowed).toBe(2);
      expect(result5e.fromClass).toEqual({ count: 0, skills: [], isChoice: true });
      expect(result5e.fromRace).toEqual({ count: 0, skills: [], isChoice: false });
      expect(result5e.fromBackground).toEqual({ count: 2, skills: [], isChoice: true });

      const result2024 = await getSkillLimits({ rules: '2024' }, []);
      expect(result2024.allowed).toBe(0);
      expect(result2024.fromClass).toEqual({ count: 0, skills: [], isChoice: true });
      expect(result2024.fromRace).toEqual({ count: 0, skills: [], isChoice: false });
      expect(result2024.fromBackground).toEqual({ count: 0, skills: [], isChoice: false });
    });

    it('race with no skill_proficiencies adds nothing to allowed and keeps fromRace empty', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 1 from Arcana',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      }, []);

      expect(result.fromRace).toEqual({ count: 0, skills: [], isChoice: false });
      // class 1 + empty race + no background: empty race contributed exactly 0
      expect(result.allowed).toBe(1);
    });
  });

  describe('getPreSelectedSkills', () => {
    it('accumulates fixed race then fixed class grants (2024)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight and Perception', // synthetic fixed-grant shape
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Arcana', // synthetic fixed-grant shape
      });

      const result = await getPreSelectedSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Dwarf' },
      }, []);

      expect(result).toEqual(['Insight', 'Perception', 'Arcana']);
    });

    it('2024: fixed background pre-selects while choice race and choice class are excluded', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Choose 1 from Insight, Perception',
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
        skill_proficiencies: 'Deception and Sleight of Hand', // verbatim public/data/2024/backgrounds.json Charlatan
      });

      const result = await getPreSelectedSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Charlatan',
      }, []);

      // only the fixed background list — neither choice pool may leak into pre-selection
      expect(result).toEqual(['Deception', 'Sleight of Hand']);
    });

    it('5e backgrounds never pre-select, even when fetchable 2024-style data is available', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      // 2024-Acolyte disk row as decoy: if the 5e lane wrongly consumed it, this would leak
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
        skill_proficiencies: 'Insight and Religion', // verbatim public/data/2024/backgrounds.json Acolyte
      });

      const result = await getPreSelectedSkills({
        rules: '5e',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Acolyte',
      }, []);

      expect(result).toEqual([]);
      expect(dataLoader.fetchBackgroundData).not.toHaveBeenCalled();
    });
  });
});
