// @maintained-by-ai 2026-11-26
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  WIZARD_STEPS,
  getStepConfig,
  getVisibleSteps,
  getDisplayNumber,
  getLadderCauseTitle,
  getSaveCauseTitle,
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
 * through unchanged — the introspection matrix below enforces that split.
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
  it('declares the canonical steps, numbered contiguously from 1, each with a unique renderable component', () => {
    expect(WIZARD_STEPS.map((step) => `${step.step}: ${step.title}`)).toEqual(EXPECTED_STEPS);
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

    // Guard (was FIXME 2026-10-14, fixed 2026-10-22): the renderer's getProps({...})
    // block in CharacterCreationWizard.jsx previously destructured languageWarnings into
    // _languageWarnings and omitted it from the supplied context, so step 12's `warnings`
    // prop was always undefined and WizardStepLanguages never rendered the limit warnings
    // that useWizardLanguages computes. Fix: `languageWarnings` is now forwarded in the
    // renderer's getProps({...}) call. No component-level test catches this class of
    // dropped wiring — the step components only render what they are handed.
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

  // The exhaustive per-flow numbering (exact step/display pairs, consecutive
  // numbering, hidden steps for all four flows) is OWNED by
  // WizardStepNumbering.test.jsx; here only the no-arg default: it must
  // behave as the 5e create flow (Background skipped).
  it('getVisibleSteps/getDisplayNumber default to the 5e create flow', () => {
    const steps = getVisibleSteps();
    expect(steps).toEqual(getVisibleSteps({ ruleset: '5e' }));
    expect(steps.map((step) => step.step)).not.toContain(5);
    expect(steps).toHaveLength(getTotalSteps() - 1);
    for (const step of steps) {
      expect(getDisplayNumber(step.step)).toBe(step.displayNumber);
    }
    expect(getDisplayNumber(5)).toBeUndefined();
  });

  // Shared cause sentence for EVERY ladder-disabled wizard control (sidebar
  // tabs, sidebar ✓ Save, edit-mode footer Save Changes). Consumption of the
  // produced titles is covered in WizardSidebar/WizardFooter tests.
  it('getLadderCauseTitle names the blocking step via the CURRENT ruleset flow, silent otherwise', () => {
    expect(getLadderCauseTitle(4, { ruleset: '5e' })).toBe('Complete "Subrace" first');
    expect(getLadderCauseTitle(5, { ruleset: '2024' })).toBe('Complete "Background" first');
    // Nothing blocks the ladder (caps-only disablement owns its own messaging).
    expect(getLadderCauseTitle(null, { ruleset: '5e' })).toBeUndefined();
    expect(getLadderCauseTitle(undefined)).toBeUndefined();
    // Blocking step outside the visible flow (stale mid-switch 5 in the 5e
    // flow, which has no Background step) or outside the wizard range.
    expect(getLadderCauseTitle(5, { ruleset: '5e' })).toBeUndefined();
    expect(getLadderCauseTitle(99, { ruleset: '2024' })).toBeUndefined();
  });

  // Combined disabled-Save sentence feeding BOTH save controls (sidebar
  // ✓ Save + edit-mode footer Save Changes) — the ladder idiom extended to
  // cover the caps belt so a disabled Save is never silent (run AZ backlog).
  it('getSaveCauseTitle lets a ladder break win over any caps break', () => {
    expect(getSaveCauseTitle({
      firstInvalidStep: 5,
      ruleset: '2024',
      abilityCapBroken: true,
      selectionCapBroken: true,
    })).toBe('Complete "Background" first');
  });

  it('getSaveCauseTitle names exactly the broken caps lanes, silent when nothing blocks Save', () => {
    const base = { firstInvalidStep: null, ruleset: '5e' };
    expect(getSaveCauseTitle({ ...base, selectionCapBroken: true }))
      .toBe('Feats/skills exceed the rules limit — fix highlighted steps');
    expect(getSaveCauseTitle({ ...base, ruleset: '2024', abilityCapBroken: true }))
      .toBe('Ability totals exceed the rules limit — fix highlighted steps');
    expect(getSaveCauseTitle({ ...base, ruleset: '2024', abilityCapBroken: true, selectionCapBroken: true }))
      .toBe('Ability totals and feats/skills exceed the rules limit — fix highlighted steps');
    expect(getSaveCauseTitle(base)).toBeUndefined();
    expect(getSaveCauseTitle()).toBeUndefined();
  });
});
