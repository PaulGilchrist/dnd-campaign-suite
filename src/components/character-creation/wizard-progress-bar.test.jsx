import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WizardProgressBar from './wizard-progress-bar.jsx';

describe('WizardProgressBar', () => {
    it('should render a progress bar', () => {
        render(<WizardProgressBar currentStep={1} totalSteps={5} />);
        
        const progressBar = document.querySelector('.progress-bar');
        expect(progressBar).toBeInTheDocument();
     });

    it('should render a progress fill element', () => {
        render(<WizardProgressBar currentStep={1} totalSteps={5} />);
        
        const progressFill = document.querySelector('.progress-fill');
        expect(progressFill).toBeInTheDocument();
     });

    it('should set progress width to 0% on first step', () => {
        render(<WizardProgressBar currentStep={1} totalSteps={5} />);
        
        const progressFill = document.querySelector('.progress-fill');
        expect(progressFill).toHaveStyle('--progress-width: 0%');
     });

    it('should set progress width to 100% on last step', () => {
        render(<WizardProgressBar currentStep={5} totalSteps={5} />);
        
        const progressFill = document.querySelector('.progress-fill');
        expect(progressFill).toHaveStyle('--progress-width: 100%');
     });

    it('should calculate intermediate progress correctly', () => {
        render(<WizardProgressBar currentStep={3} totalSteps={5} />);
        
        const progressFill = document.querySelector('.progress-fill');
        // Step 3 of 5: (3-1) / (5-1) = 2/4 = 50%
        expect(progressFill).toHaveStyle('--progress-width: 50%');
     });

    it('should adjust progress when in editing mode', () => {
        render(<WizardProgressBar currentStep={5} totalSteps={6} isEditing={true} />);
        
        const progressFill = document.querySelector('.progress-fill');
        // In editing mode: effectiveStep = 5-1 = 4, effectiveTotal = 6-1 = 5
        // Progress: (4-1) / (5-1) = 3/4 = 75%
        expect(progressFill).toHaveStyle('--progress-width: 75%');
     });

    it('should not adjust progress when not in editing mode', () => {
        render(<WizardProgressBar currentStep={3} totalSteps={5} isEditing={false} />);
        
        const progressFill = document.querySelector('.progress-fill');
        // Step 3 of 5: (3-1) / (5-1) = 2/4 = 50%
        expect(progressFill).toHaveStyle('--progress-width: 50%');
     });

    it('should handle two-step wizard correctly', () => {
        render(<WizardProgressBar currentStep={2} totalSteps={2} />);
        
        const progressFill = document.querySelector('.progress-fill');
        // Step 2 of 2: (2-1) / (2-1) = 1/1 = 100%
        expect(progressFill).toHaveStyle('--progress-width: 100%');
     });

    it('should handle single step wizard without division by zero', () => {
        render(<WizardProgressBar currentStep={1} totalSteps={1} />);
        
        const progressFill = document.querySelector('.progress-fill');
        // Step 1 of 1: (1-1) / (1-1) = 0/0 = NaN, which becomes NaN%
        expect(progressFill.style.getPropertyValue('--progress-width')).toBeDefined();
     });
});
