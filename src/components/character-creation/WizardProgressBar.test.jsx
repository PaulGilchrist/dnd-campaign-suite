// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WizardProgressBar from './WizardProgressBar.jsx';

describe('WizardProgressBar', () => {
  // Truth table over every distinct props combination: exact fill width per
  // position. isEditing shifts the bar downward (first step excluded from
  // the denominator) while step 1 and the final step anchor 0% and 100%.
  it.each([
    // currentStep, totalSteps, isEditing, expected width
    [1, 5, false, '0%'],
    [2, 5, false, '25%'],
    [3, 5, false, '50%'],
    [4, 5, false, '75%'],
    [5, 5, false, '100%'],
    [2, 5, true, '0%'],
    [5, 5, true, '100%'],
  ])('step %i of %i with isEditing=%s fills the bar to %s', (
    currentStep, totalSteps, isEditing, expected,
  ) => {
    const { container } = render(
      <WizardProgressBar
        currentStep={currentStep}
        totalSteps={totalSteps}
        isEditing={isEditing}
      />
    );
    const fill = container.querySelector('.progress-fill');
    expect(fill).not.toBeNull();
    expect(fill).toHaveStyle(`--progress-width: ${expected}`);
  });
});
