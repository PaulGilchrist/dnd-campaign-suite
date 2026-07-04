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

    it('renders no children other than the fill element', () => {
      const { container } = renderProgressBar();
      expect(container.children.length).toBe(1);
      expect(container.firstChild.children.length).toBe(1);
    });
  });

  describe('progress width calculation', () => {
    it('defaults to 0% on the first step', () => {
      const { container } = renderProgressBar();
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 0%');
    });

    it('reaches 100% on the last step', () => {
      const { container } = renderProgressBar({
        currentStep: 5,
        totalSteps: 5,
      });
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 100%');
    });

    it('calculates linear progress for intermediate steps', () => {
      // Step 3 of 5: (3-1)/(5-1) = 50%
      const { container } = renderProgressBar({
        currentStep: 3,
        totalSteps: 5,
      });
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 50%');
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

    it('does not adjust progress when isEditing is omitted', () => {
      const { container } = renderProgressBar({
        currentStep: 3,
        totalSteps: 5,
      });
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 50%');
    });
  });
});
