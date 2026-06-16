import { describe, it, expect } from 'vitest';
import useWizardConfig from './useWizardConfig.js';

describe('useWizardConfig', () => {
  it('should be a function', () => {
    expect(typeof useWizardConfig).toBe('function');
  });

  it('should be the default export', () => {
    expect(useWizardConfig).toBeDefined();
  });
});
