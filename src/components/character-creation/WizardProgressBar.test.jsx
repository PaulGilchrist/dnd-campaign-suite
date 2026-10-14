// Removed 7 tests (redundant or low-value):
//   - "computes correct progress for different step counts" → redundant with "computes linear progress" (same formula, different constants)
//   - "renders 0% for the first step of a 12-step wizard" → redundant with "computes linear progress" (0% for step 1 already tested)
//   - "renders 100% for the last step of a 12-step wizard" → redundant with "computes linear progress" (100% for last step already tested)
//   - "renders 0% when isEditing shifts to the first effective step" → redundant with "shifts progress downward when isEditing is true" (isEditing true → 0% already tested)
//   - "handles totalSteps of 1 without crashing (produces NaN)" → invalid input, asserts internal CSS variable value
//   - "handles currentStep of 0 (produces negative progress)" → invalid input, asserts internal CSS variable value
//   - "handles negative progress when isEditing shifts below first step" → invalid input, asserts internal CSS variable value
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WizardProgressBar from './WizardProgressBar.jsx';

describe('WizardProgressBar', () => {
  function renderProgressBar(props = {}) {
    return render(<WizardProgressBar currentStep={1} totalSteps={5} {...props} />);
  }

  function getFillElement(container) {
    return container.querySelector('.progress-fill');
  }

  describe('structure', () => {
    it('renders a progress-bar container with a progress-fill child', () => {
      const { container } = renderProgressBar();
      expect(container.firstChild).toHaveClass('progress-bar');
      expect(getFillElement(container)).toHaveClass('progress-fill');
    });
  });

  describe('progress width calculation', () => {
    it('computes linear progress from 0% to 100% across steps', () => {
      let { container } = renderProgressBar({ currentStep: 1, totalSteps: 5 });
      expect(getFillElement(container)).toHaveStyle('--progress-width: 0%');

      ({ container } = renderProgressBar({ currentStep: 3, totalSteps: 5 }));
      expect(getFillElement(container)).toHaveStyle('--progress-width: 50%');

      ({ container } = renderProgressBar({ currentStep: 5, totalSteps: 5 }));
      expect(getFillElement(container)).toHaveStyle('--progress-width: 100%');
    });
  });

  describe('isEditing mode', () => {
    it('shifts progress downward when isEditing is true', () => {
      let { container } = renderProgressBar({
        currentStep: 2,
        totalSteps: 4,
        isEditing: false,
      });
      expect(getFillElement(container)).toHaveStyle(
        `--progress-width: 33.33333333333333%`
      );

      ({ container } = renderProgressBar({
        currentStep: 2,
        totalSteps: 4,
        isEditing: true,
      }));
      expect(getFillElement(container)).toHaveStyle('--progress-width: 0%');
    });
  });
});
