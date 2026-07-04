// @cleaned-by-ai
// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WizardProgressBar from './WizardProgressBar.jsx';

const renderProgressBar = (props) =>
  render(<WizardProgressBar currentStep={1} totalSteps={5} {...props} />);

describe('WizardProgressBar', () => {
  describe('layout', () => {
    it('renders the progress bar container and fill element', () => {
      const { container } = renderProgressBar();
      const bar = container.firstChild;
      expect(bar).toHaveClass('progress-bar');
      expect(bar.firstChild).toHaveClass('progress-fill');
    });
  });

  describe('progress width calculation', () => {
    it('computes linear progress from 0% to 100% across steps', () => {
      // Step 1 of 5: (1-1)/(5-1) = 0%
      let { container } = renderProgressBar({ currentStep: 1, totalSteps: 5 });
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 0%');

      // Step 3 of 5: (3-1)/(5-1) = 50%
      ({ container } = renderProgressBar({ currentStep: 3, totalSteps: 5 }));
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 50%');

      // Step 5 of 5: (5-1)/(5-1) = 100%
      ({ container } = renderProgressBar({ currentStep: 5, totalSteps: 5 }));
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 100%');
    });

    it('computes correct progress for different step counts', () => {
      // Step 2 of 4: (2-1)/(4-1) = 33.333%
      const { container } = renderProgressBar({
        currentStep: 2,
        totalSteps: 4,
      });
      expect(container.firstChild.firstChild)
        .toHaveStyle(`--progress-width: 33.33333333333333%`);
    });
  });

  describe('editing mode', () => {
    it('adjusts progress downward when isEditing is true', () => {
      // isEditing: effectiveStep = 5-1 = 4, effectiveTotal = 6-1 = 5
      // Progress: (4-1)/(5-1) = 75%
      const { container } = renderProgressBar({
        currentStep: 5,
        totalSteps: 6,
        isEditing: true,
      });
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 75%');
    });
  });
});
