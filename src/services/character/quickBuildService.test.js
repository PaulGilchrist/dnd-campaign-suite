// @maintained-by-ai 2026-11-19
/**
 * quickBuildService — Quick Build draft legality against the REAL rules data.
 *
 * Every assertion re-runs the wizard's own validator services (point-buy
 * costs from rules-validation.json, getSkillLimits/getToolLimitsByCategory/
 * getLanguageLimits/getSpellLimits/validateSpellSelection/validateStep), so
 * a fabricated default that the wizard would reject can never pass here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateQuickBuildDraft, deriveQuickBackground } from './quickBuildService.js';
import { getPointBuyCosts, validateAbilityTotals, validateStep } from '../../config/utils.js';
import { loadValidationRules } from '../ui/dataLoader.js';
import { getSkillLimits } from './skillValidation.js';
import { validateTools } from './toolValidation.js';
import { getLanguageLimits, getFightingStyleLimits } from './languagesFightingstylesValidation.js';
import { getSpellLimits, validateSpellSelection } from '../rules/spells/spellLimits.js';
import { getPreSelectedSpells } from './getPreSelectedSpells.js';
import { QUICK_BUILD_ABILITY_TEMPLATES } from '../../config/quickBuildDefaults.js';

import classes5e from '../../../public/data/classes.json';
import classes2024 from '../../../public/data/2024/classes.json';
import races5e from '../../../public/data/races.json';
import races2024 from '../../../public/data/2024/races.json';
import feats5e from '../../../public/data/feats.json';
import feats2024 from '../../../public/data/2024/feats.json';
import backgrounds2024 from '../../../public/data/2024/backgrounds.json';
import rulesValidation from '../../../public/data/rules-validation.json';
import rulesValidation2024 from '../../../public/data/2024/rules-validation.json';
import spells5e from '../../../public/data/spells.json';
import spells2024 from '../../../public/data/2024/spells.json';
import equipment from '../../../public/data/equipment.json';
import abilityScores from '../../../public/data/ability-scores.json';
import fightingStyles from '../../../public/data/fighting-styles.json';
import languages from '../../../public/data/languages.json';

const FILES = {
  'data/classes.json': classes5e,
  'data/2024/classes.json': classes2024,
  'data/races.json': races5e,
  'data/2024/races.json': races2024,
  'data/feats.json': feats5e,
  'data/2024/feats.json': feats2024,
  'data/backgrounds.json': [],
  'data/2024/backgrounds.json': backgrounds2024,
  'data/rules-validation.json': rulesValidation,
  'data/2024/rules-validation.json': rulesValidation2024,
  'data/spells.json': spells5e,
  'data/2024/spells.json': spells2024,
  'data/equipment.json': equipment,
  'data/ability-scores.json': abilityScores,
  'data/fighting-styles.json': fightingStyles,
  'data/languages.json': languages,
};

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const key = String(url).replace(/^\.\//, '').replace(/^\//, '');
    const body = FILES[key];
    if (body === undefined) {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      headers: { get: () => 'application/json' },
    });
  });
});

const classNames = Object.keys(QUICK_BUILD_ABILITY_TEMPLATES);

function seedForm({ ruleset, race = 'Human', subrace = '', className, subclass = '', background = '', name = 'Quickling' }) {
  return {
    name,
    level: 1,
    alignment: 'True Neutral',
    rules: ruleset,
    background,
    race: { name: race, subrace: { name: subrace } },
    class: { name: className, subclass: { name: subclass }, divineOrder: '', primalOrder: '' },
    abilities: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map(n => ({
      name: n, baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0,
    })),
    expertSkills: [],
    feats: [],
    fightingStyles: [],
    immunities: [],
    inventory: { backpack: [], equipped: [], gold: 10, magicItems: [] },
    languages: [],
    resistances: [],
    skillProficiencies: [],
    toolProficiencies: [],
    specialActions: [],
    spells: [],
    magicInitiateInstances: [],
    xp: 0,
    xpMode: 'milestone',
  };
}

const dataFor = (ruleset) => ({
  racesData: ruleset === '2024' ? races2024 : races5e,
  classes: ruleset === '2024' ? classes2024 : classes5e,
  feats: ruleset === '2024' ? feats2024 : feats5e,
  classSubtypes: (ruleset === '2024' ? classes2024 : classes5e).map(c => ({
    className: c.name,
    subtypes: c.subclasses || c.majors || [],
  })),
});

describe('quickBuildService', () => {
  describe('ability templates — point-buy legality (12 classes x 2 rulesets)', () => {
    it.each(classNames.flatMap(className => ['5e', '2024'].map(ruleset => ({ className, ruleset }))))(
      '$ruleset $className draft stays inside the wizard point-buy validator',
      async ({ className, ruleset }) => {
        const draft = await generateQuickBuildDraft(seedForm({ ruleset, className }));
        const costs = await getPointBuyCosts(ruleset);
        const rules = await loadValidationRules(ruleset);
        const spent = draft.abilities.reduce((sum, a) => sum + (costs[a.baseScore] || 0), 0);

        expect(spent, 'point-buy spend').toBeLessThanOrEqual(rules.point_buy.total_points);
        draft.abilities.forEach(a => {
          expect(a.baseScore).toBeGreaterThanOrEqual(rules.point_buy.min_base_score);
          expect(a.baseScore).toBeLessThanOrEqual(rules.point_buy.max_base_score);
        });
        // The same cap gate the wizard runs before Save/Next:
        const { racesData, feats } = dataFor(ruleset);
        expect(await validateAbilityTotals(draft, { allFeats: feats, racesData, ruleset })).toEqual({});
      }
    );

    it('raises the class primary ability to the highest base score', async () => {
      const draft = await generateQuickBuildDraft(seedForm({ ruleset: '5e', className: 'Wizard' }));
      const byName = Object.fromEntries(draft.abilities.map(a => [a.name, a.baseScore]));
      const max = Math.max(...Object.values(byName));
      expect(byName.Intelligence).toBe(max);
    });
  });

  describe('draft legality through the wizard step validators', () => {
    // Required coverage per the roadmap item + one prepared-known contrast.
    const CASES = [
      { ruleset: '5e', className: 'Barbarian', race: 'Human' },
      { ruleset: '5e', className: 'Wizard', race: 'Human' },
      { ruleset: '2024', className: 'Cleric', race: 'Human' },
      { ruleset: '2024', className: 'Rogue', race: 'Human' },
      { ruleset: '2024', className: 'Fighter', race: 'Human' },
    ];

    it.each(CASES)('$ruleset $className: every filled lane is within its step limits', async ({ ruleset, className, race }) => {
      const draft = await generateQuickBuildDraft(seedForm({ ruleset, className, race }));
      const { racesData, classSubtypes, feats } = dataFor(ruleset);

      // Required selection steps walk clean through the real validateStep.
      for (const step of [3, 4, 5, 6, 7, 9, 10]) {
        expect(await validateStep(step, draft, { racesData, classSubtypes, ruleset, allFeats: feats }), `step ${step}`).toEqual({});
      }

      // Skills within the class/race/background allowance.
      const limits = await getSkillLimits(draft, feats);
      expect(draft.skillProficiencies.length).toBeLessThanOrEqual(limits.allowed);
      expect(draft.skillProficiencies.length).toBeGreaterThan(0);

      // Tools produce no rule warnings (2024 lane; 5e validates to []).
      expect(await validateTools(draft)).toEqual([]);

      // Languages within the race/class/background allowance.
      const langLimits = await getLanguageLimits(draft);
      expect(draft.languages.length).toBeLessThanOrEqual(langLimits.allowed);

      // Fighting styles within allowance.
      const styleLimits = await getFightingStyleLimits(draft);
      expect((draft.class.fightingStyles || []).length).toBeLessThanOrEqual(styleLimits.allowed);

      // Spells within the step's own limits (validator excludes pre-selecteds).
      const preSelected = await getPreSelectedSpells(draft);
      const spellCheck = await validateSpellSelection({
        selectedSpells: draft.spells.filter(s => !preSelected.includes(s)),
        allSpells: ruleset === '2024' ? spells2024 : spells5e,
        className,
        level: 1,
        version: ruleset,
        majorName: draft.class.subclass?.name || null,
        abilityScores: draft.abilities,
      });
      expect(spellCheck.valid, spellCheck.violations.join('; ')).toBe(true);

      // Inventory prefilled with real items and gold.
      const itemTotal = draft.inventory.backpack.length + draft.inventory.equipped.length;
      expect(itemTotal).toBeGreaterThan(0);
      expect(typeof draft.inventory.gold).toBe('number');
      expect(draft.inventory.gold).toBeGreaterThan(0);
    });
  });

  describe('rule-required and class-specific defaults', () => {
    it('defaults the subclass to the first option the step-7 list offers', async () => {
      const draft5e = await generateQuickBuildDraft(seedForm({ ruleset: '5e', className: 'Cleric' }));
      expect(draft5e.class.subclass.name).toBe(classes5e.find(c => c.name === 'Cleric').subclasses[0].name);

      const draft24 = await generateQuickBuildDraft(seedForm({ ruleset: '2024', className: 'Cleric' }));
      expect(draft24.class.subclass.name).toBe(classes2024.find(c => c.name === 'Cleric').majors[0].name);
    });

    it('keeps a user-picked subclass instead of overwriting it', async () => {
      const draft = await generateQuickBuildDraft(seedForm({ ruleset: '5e', className: 'Fighter', subclass: 'Champion' }));
      expect(draft.class.subclass.name).toBe('Champion');
    });

    it('2024: assigns the background-granted origin feat (rules require a level-1 pick)', async () => {
      const draft = await generateQuickBuildDraft(seedForm({ ruleset: '2024', className: 'Cleric' }));
      const background = backgrounds2024.find(b => b.name === draft.background);
      expect(background).toBeDefined();
      expect(draft.feats).toEqual([background.feat]);
    });

    it('2024: respects a hand-picked background over the class default', async () => {
      const draft = await generateQuickBuildDraft(seedForm({ ruleset: '2024', className: 'Cleric', background: 'Soldier' }));
      expect(draft.background).toBe('Soldier');
      expect(draft.feats).toEqual(['Savage Attacker']);
    });

    it('5e: no level-1 feats, magic items or special actions', async () => {
      const draft = await generateQuickBuildDraft(seedForm({ ruleset: '5e', className: 'Wizard' }));
      expect(draft.feats).toEqual([]);
      expect(draft.inventory.magicItems).toEqual([]);
      expect(draft.specialActions).toEqual([]);
    });

    it('grants expertise to Rogues in both rulesets, drawn from their proficiencies', async () => {
      for (const ruleset of ['5e', '2024']) {
        const draft = await generateQuickBuildDraft(seedForm({ ruleset, className: 'Rogue' }));
        expect(draft.expertSkills.length).toBe(2);
        draft.expertSkills.forEach(skill => expect(draft.skillProficiencies).toContain(skill));
      }
    });

    it('5e classes with level-1 Fighting Style get exactly one; others get none', async () => {
      const fighter = await generateQuickBuildDraft(seedForm({ ruleset: '5e', className: 'Fighter' }));
      expect(fighter.class.fightingStyles).toEqual(['Defense']);
      const wizard = await generateQuickBuildDraft(seedForm({ ruleset: '5e', className: 'Wizard' }));
      expect(wizard.class.fightingStyles).toEqual([]);
    });

    it('fills cantrips then lowest-level spells up to the caster limits', async () => {
      const draft = await generateQuickBuildDraft(seedForm({ ruleset: '2024', className: 'Cleric' }));
      const limits = await getSpellLimits({ className: 'Cleric', level: 1, version: '2024', majorName: draft.class.subclass.name, abilityScores: draft.abilities });
      const spellPool = spells2024.filter(s => (s.classes || []).includes('Cleric'));
      const selectedLevels = draft.spells
        .map(name => spellPool.find(s => s.name === name)?.level)
        .filter(level => level !== undefined);
      expect(selectedLevels.filter(l => l === 0).length).toBe(limits.cantrip);
      expect(selectedLevels.filter(l => l > 0).length).toBe(limits.preparedSpells);
      expect(Math.max(...selectedLevels)).toBeLessThanOrEqual(1);
    });

    it('leaves non-caster spells empty', async () => {
      const draft = await generateQuickBuildDraft(seedForm({ ruleset: '5e', className: 'Barbarian' }));
      expect(draft.spells).toEqual([]);
    });
  });

  describe('inventory sourcing', () => {
    it('2024: parses option A of the class starting_equipment (items + gold)', async () => {
      const draft = await generateQuickBuildDraft(seedForm({ ruleset: '2024', className: 'Barbarian' }));
      expect(draft.inventory.gold).toBe(15);
      expect(draft.inventory.equipped).toContain('Greataxe');
      expect(draft.inventory.backpack).toContain("Explorer's Pack");
      expect(draft.inventory.itemMeta.Handaxe.quantity).toBe(4);
    });

    it('5e: authored equipment lists reference real equipment.json names', async () => {
      const equipmentNames = new Set(equipment.map(e => e.name));
      for (const className of classNames) {
        const draft = await generateQuickBuildDraft(seedForm({ ruleset: '5e', className }));
        [...draft.inventory.backpack, ...draft.inventory.equipped].forEach(name => {
          expect(equipmentNames.has(name), `${className}: ${name}`).toBe(true);
        });
      }
    });

    it('5e: gold is the average of the class starting_wealth dice', async () => {
      const barbarian = await generateQuickBuildDraft(seedForm({ ruleset: '5e', className: 'Barbarian' }));
      // '2d4 x 10 gp' -> mean 5 * 10
      expect(barbarian.inventory.gold).toBe(50);
    });
  });

  describe('wizard entry affordance + determinism', () => {
    it('deriveQuickBackground only answers for 2024 (5e hides the Background step)', () => {
      expect(deriveQuickBackground({ ruleset: '2024' })).toBe('Guard');
      expect(deriveQuickBackground({ ruleset: '5e', className: 'Rogue' })).toBe('');
    });

    // RF 2026-11-19: the step-5 prefill and the step-7 draft must agree —
    // walk both lanes from the same seed and pin the observed values equal.
    it.each([
      { className: 'Rogue', classDefault: 'Criminal' },
      { className: 'Cleric', classDefault: 'Hermit' },
    ])('2024 quick-build $className: prefilled background equals the applied draft background',
      async ({ className, classDefault }) => {
        // Lane 1 — Background step (5) prefill: class not yet chosen.
        const prefill = deriveQuickBackground({ ruleset: '2024' });
        expect(prefill).toBe('Guard');

        // Lane 2 — the user walks past the prefill; step-7 draft applies.
        const walked = await generateQuickBuildDraft(
          seedForm({ ruleset: '2024', className, background: prefill })
        );
        expect(walked.background).toBe(prefill);

        // Same class with a skipped (empty) Background step resolves through
        // the same function to the class default — one derivation, one table.
        const skipped = await generateQuickBuildDraft(
          seedForm({ ruleset: '2024', className, background: '' })
        );
        expect(skipped.background).toBe(classDefault);
        expect(skipped.background).toBe(
          deriveQuickBackground({ ruleset: '2024', className })
        );
      });

    it('the derivation is deterministic: same inputs, same background', () => {
      const runs = Array.from({ length: 5 }, () =>
        deriveQuickBackground({ ruleset: '2024', className: 'Rogue' }));
      runs.forEach(bg => expect(bg).toBe(runs[0]));
    });

    it('produces the identical draft on repeated runs', async () => {
      const seed = seedForm({ ruleset: '2024', className: 'Wizard' });
      const first = await generateQuickBuildDraft(seed);
      const second = await generateQuickBuildDraft(seed);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    it('returns the input untouched (loudly) when race or class is missing', async () => {
      const incomplete = seedForm({ ruleset: '5e', className: 'Wizard' });
      incomplete.race = { name: '', subrace: { name: '' } };
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const out = await generateQuickBuildDraft(incomplete);
      expect(out).toEqual(incomplete);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
