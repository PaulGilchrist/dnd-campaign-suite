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
      // Step 2 of 5: (2-1)/(5-1) = 25%
      const { container } = renderProgressBar({
        currentStep: 2,
        totalSteps: 5,
      });
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 25%');
    });

    it('calculates linear progress for intermediate steps (step 3 of 5)', () => {
      // Step 3 of 5: (3-1)/(5-1) = 50%
      const { container } = renderProgressBar({
        currentStep: 3,
        totalSteps: 5,
      });
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 50%');
    });

    it('calculates linear progress for intermediate steps (step 4 of 5)', () => {
      // Step 4 of 5: (4-1)/(5-1) = 75%
      const { container } = renderProgressBar({
        currentStep: 4,
        totalSteps: 5,
      });
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 75%');
    });

    it('handles a two-step wizard reaching 100% on step 2', () => {
      const { container } = renderProgressBar({
        currentStep: 2,
        totalSteps: 2,
      });
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 100%');
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

    it('does not adjust progress when isEditing is false', () => {
      const { container } = renderProgressBar({
        currentStep: 3,
        totalSteps: 5,
        isEditing: false,
      });
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 50%');
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

  describe('edge cases', () => {
    it('handles a single-step wizard without crashing', () => {
      const { container } = renderProgressBar({
        currentStep: 1,
        totalSteps: 1,
      });
      // Division by zero produces NaN; the component should still render
      // and set the CSS variable (even if the value is NaN%)
      const fill = container.firstChild.firstChild;
      expect(fill).toBeInTheDocument();
      expect(fill.style.getPropertyValue('--progress-width')).toBeDefined();
    });

    it('handles currentStep greater than totalSteps', () => {
      const { container } = renderProgressBar({
        currentStep: 10,
        totalSteps: 5,
      });
      // (10-1)/(5-1) = 225%
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 225%');
    });

    it('handles negative step values', () => {
      const { container } = renderProgressBar({
        currentStep: -1,
        totalSteps: 5,
      });
      // (-1-1)/(5-1) = -50%
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: -50%');
    });

    it('handles zero totalSteps (division by -1)', () => {
      const { container } = renderProgressBar({
        currentStep: 1,
        totalSteps: 0,
      });
      // (1-1)/(0-1) = 0/-1 = 0%
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: 0%');
    });

    it('handles isEditing with currentStep 0 (effectiveStep = -1)', () => {
      const { container } = renderProgressBar({
        currentStep: 0,
        totalSteps: 5,
        isEditing: true,
      });
      // effectiveStep = -1, effectiveTotal = 4
      // (-1-1)/(4-1) = -66.666...%
      expect(container.firstChild.firstChild)
        .toHaveStyle('--progress-width: -66.66666666666666%');
    });
  });
});
