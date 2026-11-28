// @maintained-by-ai 2026-11-28
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WizardProgressBar from './WizardProgressBar.jsx';

describe('WizardProgressBar', () => {
  // Truth table over the canonical step index: exact fill width per position.
  // The Ruleset step counts in BOTH create and edit flows (shared
  // getVisibleSteps index), so the bar carries no editing offset — the first
  // and final steps anchor 0% and 100%.
  it.each([
    // currentStep, totalSteps, expected width
    [1, 5, '0%'],
    [2, 5, '25%'],
    [3, 5, '50%'],
    [4, 5, '75%'],
    [5, 5, '100%'],
    // Different denominator proves the ratio divides by totalSteps rather
    // than a hardcoded 25%-per-step step.
    [2, 3, '50%'],
  ])('step %i of %i fills the bar to %s', (
    currentStep, totalSteps, expected,
  ) => {
    const { container } = render(
      <WizardProgressBar
        currentStep={currentStep}
        totalSteps={totalSteps}
      />
    );
    const fill = container.querySelector('.progress-fill');
    expect(fill).not.toBeNull();
    expect(fill).toHaveStyle(`--progress-width: ${expected}`);
  });
});
