// @maintained-by-ai: 2026-10-14
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  WIZARD_STEPS,
  getStepConfig,
  getVisibleSteps,
  getDisplayNumber,
  getTotalSteps,
} from './steps-config.js';

/**
 * Canonical wizard spec: "<step>: <title>" as shown in the sidebar and
 * headings. A change here is a deliberate spec change.
 */
const EXPECTED_STEPS = [
  '1: Ruleset',
  '2: Basic Information',
  '3: Race',
  '4: Subrace',
  '5: Background',
  '6: Class',
  '7: Subclass / Major',
  '8: Feats',
  '9: Ability Scores',
  '10: Skill Proficiencies',
  '11: Tool Proficiencies',
  '12: Languages & Fighting Styles',
  '13: Resistances & Immunities',
  '14: Spells',
  '15: Magic Items',
  '16: Inventory',
  '17: Special Actions',
];

/**
 * The only steps whose getProps renames a context key to a different
 * component prop name (prop → context key). Everything else must pass
 * through unchanged — the introspection test below enforces that split.
 */
const RENAMES = {
  9: {
    onBackgroundIncreaseChange: 'updateBackgroundIncrease',
    backgroundAbilityChoices: 'backgroundAbilityNames',
    onFeatAbilityChoiceChange: 'handleFeatAbilityChoice',
  },
  12: { warnings: 'languageWarnings' },
  13: { warnings: 'resistanceWarnings' },
};

/**
 * Runs a step's getProps against a recording Proxy so the prop → context-key
 * mapping is derived from the source at runtime instead of a hardcoded copy.
 * Every destructured context key comes back as "ctx:<key>".
 */
const readProps = (step) => {
  const read = new Set();
  const props = step.getProps(new Proxy({}, {
    get: (_target, key) => {
      if (typeof key === 'string') read.add(key);
      return `ctx:${String(key)}`;
    },
  }));
  return { props, read };
};

describe('steps-config', () => {
  it('declares the canonical steps, numbered contiguously from 1 with matching titles', () => {
    expect(WIZARD_STEPS.map((step) => `${step.step}: ${step.title}`)).toEqual(EXPECTED_STEPS);
  });

  it('assigns a distinct renderable component to every step', () => {
    const components = WIZARD_STEPS.map((step) => step.component);
    for (const component of components) {
      expect(typeof component === 'function' || typeof component?.type === 'function').toBe(true);
    }
    expect(new Set(components).size).toBe(components.length);
  });

  describe('getProps context → component props mapping', () => {
    for (const step of WIZARD_STEPS) {
      it(`step ${step.step} (${step.title}) passes through context keys, renaming only as specified`, () => {
        const { props, read } = readProps(step);
        const renames = RENAMES[step.step] || {};

        for (const [prop, value] of Object.entries(props)) {
          // No hardcoded values or fallbacks: every prop is a context passthrough.
          expect(typeof value, `step ${step.step} prop '${prop}' is not a context passthrough`).toBe('string');
          const source = value.replace(/^ctx:/, '');
          expect(source, `step ${step.step} prop '${prop}' unexpectedly renamed`).toBe(renames[prop] ?? prop);
        }

        // Every context key read must be projected onto a prop — nothing dropped.
        const sources = [...new Set(Object.values(props).map((v) => String(v).replace(/^ctx:/, '')))].sort();
        expect(sources).toEqual([...read].sort());
      });
    }

    // FIXME (source bug, 2026-10-14): WizardStepRenderer destructures languageWarnings
    // into _languageWarnings and omits it from the getProps({...}) context in
    // CharacterCreationWizard.jsx, so step 12's `warnings` prop is always undefined and
    // WizardStepLanguages never renders the limit warnings that useWizardLanguages computes.
    // Fix: forward `languageWarnings` in the renderer's getProps({...}) call.
    it('renderer supplies every context key each step reads (no dropped wiring)', () => {
      const src = readFileSync(
        join(process.cwd(), 'src/components/character-creation/CharacterCreationWizard.jsx'),
        'utf8'
      );
      const block = src.match(/stepConfig\.getProps\(\{([\s\S]*?)\}\);/);
      expect(block, 'renderer getProps({...}) call not found — update this guard').not.toBeNull();
      const supplied = new Set(
        block[1]
          .split('\n')
          .map((line) => line.match(/^\s*([A-Za-z_$][\w$]*)\s*(?::[^,]+)?,?\s*$/))
          .filter(Boolean)
          .map((m) => m[1])
      );

      for (const step of WIZARD_STEPS) {
        const { read } = readProps(step);
        for (const key of read) {
          expect([...supplied], `step ${step.step} reads '${key}' but the renderer never supplies it`).toContain(key);
        }
      }
    });
  });

  it('getStepConfig resolves each step number, undefined outside the wizard range', () => {
    for (const entry of WIZARD_STEPS) {
      expect(getStepConfig(entry.step)).toBe(entry);
    }
    for (const n of [-1, 0, 18, 100]) {
      expect(getStepConfig(n)).toBeUndefined();
    }
  });

  // Full 5e/2024/editing numbering is covered in WizardStepNumbering.test.jsx;
  // here: default args and the getDisplayNumber ↔ getVisibleSteps derivation.
  it('getVisibleSteps defaults to the 5e create flow and getDisplayNumber derives from it', () => {
    const steps = getVisibleSteps();
    expect(steps).toHaveLength(getTotalSteps() - 1); // Background (5) skipped
    expect(steps.map((step) => step.step)).not.toContain(5);
    expect(steps.map((step) => step.displayNumber)).toEqual(steps.map((_, i) => i + 1));
    for (const step of steps) {
      expect(getDisplayNumber(step.step)).toBe(step.displayNumber);
    }
    expect(getDisplayNumber(5)).toBeUndefined();
  });
});
