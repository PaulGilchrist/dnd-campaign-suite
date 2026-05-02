import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepFeats from './wizard-step-feats';

const { MockSelectableList } = vi.hoisted(() => ({
  MockSelectableList: vi.fn(({ title, resultLabel, items, renderSummary, renderWarnings }) => (
    <div data-testid="selectable-list">
      <h2>{title}</h2>
      <div data-testid="result-label">{resultLabel}</div>
      <div data-testid="item-count">{items?.length || 0} items</div>
      {renderSummary && <div data-testid="summary">{renderSummary()}</div>}
      {renderWarnings && <div data-testid="warnings">{renderWarnings()}</div>}
    </div>
  ))
}));

vi.mock('./selectable-list', () => ({ default: MockSelectableList }));

vi.mock('../../services/feat-validation', () => ({
  validateFeats: vi.fn(() => Promise.resolve([])),
  getFeatLimits: vi.fn(() => Promise.resolve({ allowed: 1, originRequired: false, details: 'Level 4 grants one feat.' })),
}));

vi.mock('../../services/sanitize', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

describe('WizardStepFeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProps = {
    formData: {
      feats: ['Feat A'],
      level: 4,
      rules: '5e',
    },
    allFeats: [
      { name: 'Feat A', index: 'feat_a', type: 'General', description: '<p>Description A</p>' },
      { name: 'Feat B', index: 'feat_b', type: 'Ability Improvement', desc: ['Description B'] },
    ],
    onArrayFieldChange: vi.fn(),
    preSelectedFeats: [],
  };

  it('should render feat step title', async () => {
    render(<WizardStepFeats {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 4: Feats')).toBeInTheDocument();
    });
  });

  it('should render summary with feat limits', async () => {
    render(<WizardStepFeats {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText(/You have selected 1 of 1 allowed feat/)).toBeInTheDocument();
    });
  });

  it('should display feat limits details', async () => {
    render(<WizardStepFeats {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Level 4 grants one feat/)).toBeInTheDocument();
    });
  });

  it('should not render warnings when validation passes', async () => {
    render(<WizardStepFeats {...mockProps} />);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('should pass items to SelectableList', async () => {
    render(<WizardStepFeats {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
    });
  });

  it('should handle empty feats array', async () => {
    const propsNoFeats = {
      ...mockProps,
      formData: { feats: [], level: 1, rules: '5e' },
    };

    render(<WizardStepFeats {...propsNoFeats} />);

    await waitFor(() => {
      expect(screen.getByText('Step 4: Feats')).toBeInTheDocument();
    });
  });

  it('should handle loading state (undefined feats)', async () => {
    const propsNoFeats = {
      ...mockProps,
      allFeats: undefined,
    };

    render(<WizardStepFeats {...propsNoFeats} />);

    await waitFor(() => {
      expect(screen.getByText('Step 4: Feats')).toBeInTheDocument();
    });
  });

  it('should call validateFeats on mount', async () => {
    const { validateFeats } = await import('../../services/feat-validation.js');
    render(<WizardStepFeats {...mockProps} />);

    await waitFor(() => {
      expect(validateFeats).toHaveBeenCalled();
    });
  });

  it('should call getFeatLimits on mount', async () => {
    const { getFeatLimits } = await import('../../services/feat-validation.js');
    render(<WizardStepFeats {...mockProps} />);

    await waitFor(() => {
      expect(getFeatLimits).toHaveBeenCalled();
    });
  });
});
