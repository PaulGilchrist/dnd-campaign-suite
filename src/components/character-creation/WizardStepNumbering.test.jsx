// @maintained-by-ai 2026-11-28
/**
 * OWNER of the wizard step-numbering contract: one canonical index drives the
 * sidebar indicator, the content headings, and the Next/Back walk order.
 * - The flows table below is the exhaustive numbering pin (exact
 *   [canonicalStep, displayNumber] pairs + hidden steps); steps-config.test.js
 *   delegates the per-flow table here and owns only the no-arg default,
 *   WizardSidebar.test.jsx owns tab titles/enablement, and
 *   useWizardNavigation.test.js owns validation/enablement semantics and
 *   delegates the ruleset walk-skip here (per its test header).
 * - 5e skips step 5 (Background); the Ruleset step (1) is visible in BOTH
 *   flows — editing reaches it to switch a saved character's ruleset through
 *   the ledger guard, so the editing index must equal the create index
 *   (editing only changes the arrival step); display numbers stay
 *   consecutive 1..N over the visible steps only.
 * - Heading consumption is pinned by the renderers themselves: the live
 *   wizard walks 'Step 2/3' headings (CharacterCreationWizard.integration)
 *   and reaches the live 'Step 5: Background' heading in 2024 edit
 *   (edit-ruleset-switch), fed by the wizard's visible-steps index.
 */
import { render, screen } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { getVisibleSteps, getDisplayNumber } from '../../config/steps-config.js';
import useWizardNavigation from '../../hooks/wizard/useWizardNavigation.js';
import WizardSidebar from './WizardSidebar.jsx';

// useWizardNavigation validates through this boundary; its rules live in utils.test.js.
vi.mock('../../config/utils.js', () => ({
  validateStep: vi.fn(() => Promise.resolve({})),
}));

describe('wizard step numbering (indicator, headings, and walk share one index)', () => {
  // Exhaustive contract: exact visible steps and consecutive display numbers per create flow.
  describe.each([
    {
      flow: '2024 create',
      ctx: { ruleset: '2024' },
      pairs: [
        [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8], [9, 9],
        [10, 10], [11, 11], [12, 12], [13, 13], [14, 14], [15, 15], [16, 16], [17, 17],
      ],
      hidden: [],
    },
    {
      flow: '5e create (Background absent, 6+ shift down)',
      ctx: { ruleset: '5e' },
      pairs: [
        [1, 1], [2, 2], [3, 3], [4, 4], [6, 5], [7, 6], [8, 7], [9, 8], [10, 9],
        [11, 10], [12, 11], [13, 12], [14, 13], [15, 14], [16, 15], [17, 16],
      ],
      hidden: [5],
    },
  ])('$flow', ({ ctx, pairs, hidden }) => {
    it('numbers every visible step consecutively and hides non-flow steps', () => {
      const steps = getVisibleSteps(ctx);
      expect(steps.map(({ step, displayNumber }) => [step, displayNumber])).toEqual(pairs);
      pairs.forEach(([step, display]) => {
        expect(getDisplayNumber(step, ctx)).toBe(display);
      });
      hidden.forEach((step) => {
        expect(getDisplayNumber(step, ctx)).toBeUndefined();
      });
    });
  });

  // Regression: the Ruleset step must NEVER drop out of the editing flows —
  // edits reach it to switch a saved character's ruleset — so the editing
  // index is exactly the create index. Exact pairs are pinned once above;
  // equality is the whole contract here (holds even after a step-list edit).
  it.each(['2024', '5e'])('%s editing walks the same numbered steps as create', (ruleset) => {
    const ctx = { ruleset };
    const editing = getVisibleSteps({ ...ctx, isEditing: true });
    expect(editing).toEqual(getVisibleSteps(ctx));
    expect(getDisplayNumber(1, { ...ctx, isEditing: true })).toBe(1);
  });

  describe('WizardSidebar indicator', () => {
    // Titles/enablement are owned by WizardSidebar.test.jsx; this pins only
    // that the rendered tab numbers carry the shifted display numbers,
    // gap-free. Tabs read as "<displayNumber><title>"; the save tab is
    // prefixed "✓" so it never enters the numbered set. 5e is the shifted
    // flow — if the sidebar rendered canonical steps the walk would show a
    // gap at Background. Editing is not re-pinned here: the sidebar consumes
    // no isEditing input, and the editing/create equality is pinned above.
    it('renders gap-free shifted numbers for the 5e flow', () => {
      render(
        <WizardSidebar
          currentStep={2}
          getStepEnabled={() => true}
          goToStep={vi.fn()}
          isSaveEnabled
          onSave={vi.fn()}
          ruleset="5e"
        />
      );
      const numbers = screen
        .getAllByRole('button', { name: /^\d/ })
        .map((btn) => Number(btn.textContent.match(/^\d+/)[0]));
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    });
  });

  describe('walk order', () => {
    it('Next/Back walk the visible index (5e skips Background between Subrace and Class)', async () => {
      const { result } = renderHook(() => useWizardNavigation(4, {}, [], { ruleset: '5e' }));
      await act(async () => { expect(await result.current.navigateNext()).toBe(true); });
      expect(result.current.currentStep).toBe(6);
      act(() => { result.current.navigatePrevious(); });
      expect(result.current.currentStep).toBe(4);

      // 2024 keeps Background in the walk: step 4 advances to 5, not 6.
      const { result: r2024 } = renderHook(() => useWizardNavigation(4, {}, [], { ruleset: '2024' }));
      await act(async () => { await r2024.current.navigateNext(); });
      expect(r2024.current.currentStep).toBe(5);
    });
  });
});
