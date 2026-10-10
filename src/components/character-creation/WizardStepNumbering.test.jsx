import { render, screen } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WIZARD_STEPS, getVisibleSteps, getDisplayNumber, getTotalSteps } from '../../config/steps-config.js';
import useWizardNavigation from '../../hooks/wizard/useWizardNavigation.js';
import WizardSidebar from './WizardSidebar.jsx';
import WizardStepSpecial from './WizardStepSpecial.jsx';
import WizardStepBackground from './WizardStepBackground.jsx';

vi.mock('../../config/utils.js', () => ({
  validateStep: vi.fn(() => Promise.resolve({})),
  validateFinalFormData: vi.fn(() => ({})),
  validateAbilityTotals: vi.fn(() => Promise.resolve({})),
  hasDuplicateCharacterName: vi.fn(() => false),
  DUPLICATE_CHARACTER_NAME_ERROR: 'A character with that name already exists',
}));

describe('wizard step numbering (indicator and content share one index)', () => {
  const canonicalTitle = (step) => WIZARD_STEPS.find((s) => s.step === step)?.title;

  describe('getVisibleSteps', () => {
    it('numbers all 17 steps consecutively for the 2024 create flow', () => {
      const steps = getVisibleSteps({ ruleset: '2024' });
      expect(steps).toHaveLength(getTotalSteps());
      expect(steps.map((s) => s.displayNumber)).toEqual(steps.map((_, i) => i + 1));
      expect(getDisplayNumber(5, { ruleset: '2024' })).toBe(5);
      expect(getDisplayNumber(8, { ruleset: '2024' })).toBe(8);
    });

    it('renumbers consecutively for the 5e create flow with Background absent from BOTH', () => {
      const steps = getVisibleSteps({ ruleset: '5e' });
      expect(steps).toHaveLength(16);
      expect(steps.map((s) => s.displayNumber)).toEqual(steps.map((_, i) => i + 1));
      expect(steps.map((s) => s.step)).not.toContain(5);
      expect(steps.map((s) => s.title)).not.toContain('Background');
      expect(getDisplayNumber(5, { ruleset: '5e' })).toBeUndefined();
      expect(getDisplayNumber(6, { ruleset: '5e' })).toBe(5);
      expect(getDisplayNumber(8, { ruleset: '5e' })).toBe(7);
      expect(getDisplayNumber(17, { ruleset: '5e' })).toBe(16);
    });

    it('renumbers consecutively when editing (Ruleset step skipped)', () => {
      const steps = getVisibleSteps({ isEditing: true, ruleset: '5e' });
      expect(steps).toHaveLength(15);
      expect(steps.map((s) => s.displayNumber)).toEqual(steps.map((_, i) => i + 1));
      expect(getDisplayNumber(1, { isEditing: true })).toBeUndefined();
      expect(getDisplayNumber(2, { isEditing: true })).toBe(1);
    });
  });

  describe('WizardSidebar indicator', () => {
    const renderNumbers = (props = {}) => {
      const { container } = render(
        <WizardSidebar
          currentStep={2}
          getStepEnabled={() => true}
          goToStep={vi.fn()}
          isSaveEnabled
          onSave={vi.fn()}
          {...props}
        />
      );
      return Array.from(container.querySelectorAll('.sidebar-tab .sidebar-tab-number')).map((el) => Number(el.textContent));
    };

    it('lists every step with no numbering gap for 5e (no 4→6 jump)', () => {
      const numbers = renderNumbers({ ruleset: '5e' });
      expect(numbers).toHaveLength(16);
      expect(numbers).toEqual(numbers.map((_, i) => i + 1));
      expect(numbers).not.toContain(17);
    });

    it('lists all 17 steps consecutively for 2024', () => {
      const numbers = renderNumbers({ ruleset: '2024' });
      expect(numbers).toHaveLength(17);
      expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    });

    it('numbers tabs consecutively when editing', () => {
      const numbers = renderNumbers({ isEditing: true, ruleset: '2024' });
      expect(numbers).toHaveLength(16);
      expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    });
  });

  describe('content headings match the indicator number', () => {
    it('Special Actions heading uses the shared display number', () => {
      render(<WizardStepSpecial stepNumber={getDisplayNumber(17, { ruleset: '5e' })} formData={{}} onArrayFieldChange={vi.fn()} />);
      expect(screen.getByText('Step 16: Special Actions')).toBeInTheDocument();

      render(<WizardStepSpecial stepNumber={getDisplayNumber(17, { ruleset: '2024' })} formData={{}} onArrayFieldChange={vi.fn()} />);
      expect(screen.getByText('Step 17: Special Actions')).toBeInTheDocument();
    });

    it('Background heading uses the shared display number where 2024 shows it, and its title matches the indicator tab', () => {
      const display = getDisplayNumber(5, { ruleset: '2024' });
      render(<WizardStepBackground stepNumber={display} formData={{}} backgrounds={[]} ruleset="2024" onInputChange={vi.fn()} />);
      expect(screen.getByText(`Step ${display}: Background`)).toBeInTheDocument();
      expect(canonicalTitle(5)).toBe('Background');
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
