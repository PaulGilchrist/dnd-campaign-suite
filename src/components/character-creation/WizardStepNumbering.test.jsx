// @maintained-by-ai
/**
 * OWNER of the wizard step-numbering contract: one canonical index drives the
 * sidebar indicator, the content headings, and the Next/Back walk order.
 * - The flows table below is the exhaustive numbering pin (exact
 *   [canonicalStep, displayNumber] pairs + hidden steps for all four flows);
 *   WizardSidebar.test.jsx owns tab titles/enablement, useWizardNavigation.test.js
 *   owns validation/enablement semantics, and the ruleset walk-skip is delegated
 *   here by that hook's test header.
 * - 5e skips step 5 (Background); editing skips step 1 (Ruleset); display
 *   numbers stay consecutive 1..N over the visible steps only.
 */
import { render, screen } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { getVisibleSteps, getDisplayNumber } from '../../config/steps-config.js';
import useWizardNavigation from '../../hooks/wizard/useWizardNavigation.js';
import WizardSidebar from './WizardSidebar.jsx';
import WizardStepSpecial from './WizardStepSpecial.jsx';
import WizardStepBackground from './WizardStepBackground.jsx';

// useWizardNavigation validates through this boundary; its rules live in utils.test.js.
vi.mock('../../config/utils.js', () => ({
  validateStep: vi.fn(() => Promise.resolve({})),
}));

describe('wizard step numbering (indicator, headings, and walk share one index)', () => {
  // Exhaustive contract: exact visible steps and consecutive display numbers per flow.
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
    {
      flow: '2024 editing (Ruleset absent, 2+ shift down)',
      ctx: { isEditing: true, ruleset: '2024' },
      pairs: [
        [2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, 6], [8, 7], [9, 8], [10, 9],
        [11, 10], [12, 11], [13, 12], [14, 13], [15, 14], [16, 15], [17, 16],
      ],
      hidden: [1],
    },
    {
      flow: '5e editing (both skips)',
      ctx: { isEditing: true, ruleset: '5e' },
      pairs: [
        [2, 1], [3, 2], [4, 3], [6, 4], [7, 5], [8, 6], [9, 7], [10, 8], [11, 9],
        [12, 10], [13, 11], [14, 12], [15, 13], [16, 14], [17, 15],
      ],
      hidden: [1, 5],
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

  describe('WizardSidebar indicator', () => {
    // Titles/enablement are owned by WizardSidebar.test.jsx; this pins only that
    // the rendered tab numbers carry the shifted display numbers, gap-free.
    // Tabs read as "<displayNumber><title>"; the save tab is prefixed "✓".
    const renderedNumbers = () =>
      screen.getAllByRole('button', { name: /^\d/ }).map((btn) => Number(btn.textContent.match(/^\d+/)[0]));

    const renderSidebar = (ctx) =>
      render(
        <WizardSidebar
          currentStep={2}
          getStepEnabled={() => true}
          goToStep={vi.fn()}
          isSaveEnabled
          onSave={vi.fn()}
          {...ctx}
        />
      );

    it.each([
      ['5e create', { ruleset: '5e' }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]],
      ['5e editing', { isEditing: true, ruleset: '5e' }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]],
    ])('renders gap-free numbers for %s', (_label, ctx, expected) => {
      renderSidebar(ctx);
      expect(renderedNumbers()).toEqual(expected);
    });
  });

  describe('content headings consume the shared display number', () => {
    it('Special Actions heading shows the shifted 5e number (17 → Step 16)', () => {
      render(<WizardStepSpecial stepNumber={getDisplayNumber(17, { ruleset: '5e' })} formData={{}} onArrayFieldChange={vi.fn()} />);
      expect(screen.getByRole('heading', { name: 'Step 16: Special Actions' })).toBeInTheDocument();
    });

    it('Background heading shows at its 2024 display number (Step 5: Background)', () => {
      render(<WizardStepBackground stepNumber={getDisplayNumber(5, { ruleset: '2024' })} formData={{}} backgrounds={[]} ruleset="2024" onInputChange={vi.fn()} />);
      expect(screen.getByRole('heading', { name: 'Step 5: Background' })).toBeInTheDocument();
    });
  });

  describe('walk order', () => {
    it('Next/Back walk the visible index (5e skips Background between Subrace and Class)', async () => {
      const { result } = renderHook(() => useWizardNavigation(4, {}, [], { ruleset: '5e' }));
      await act(async () => { await result.current.navigateNext(); });
      expect(result.current.currentStep).toBe(6);
      act(() => { result.current.navigatePrevious(); });
      expect(result.current.currentStep).toBe(4);

      const { result: r2024 } = renderHook(() => useWizardNavigation(4, {}, [], { ruleset: '2024' }));
      await act(async () => { await r2024.current.navigateNext(); });
      expect(r2024.current.currentStep).toBe(5);
    });
  });
});
