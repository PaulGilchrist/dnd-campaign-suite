// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardHeader from './WizardHeader.jsx';

describe('WizardHeader', () => {
  const baseProps = {
    title: 'Test Title',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the wizard-header container', () => {
      const { container } = render(<WizardHeader {...baseProps} />);
      const wrapper = container.querySelector('.wizard-header');
      expect(wrapper).toBeInTheDocument();
    });

    it('renders the heading with the provided title', () => {
      render(<WizardHeader title="Create Character" onClose={() => {}} />);
      const heading = screen.getByRole('heading', { level: 2, name: 'Create Character' });
      expect(heading).toBeInTheDocument();
    });

    it('renders the close button with the close-btn class', () => {
      render(<WizardHeader {...baseProps} />);
      const closeBtn = screen.getByRole('button', { name: '×' });
      expect(closeBtn).toBeInTheDocument();
      expect(closeBtn).toHaveClass('close-btn');
    });

    it('renders the close button with an × character', () => {
      render(<WizardHeader {...baseProps} />);
      const closeBtn = screen.getByRole('button', { name: '×' });
      expect(closeBtn.textContent).toBe('×');
    });
  });

  describe('interaction', () => {
    it('calls onClose when the close button is clicked', () => {
      render(<WizardHeader {...baseProps} />);
      fireEvent.click(screen.getByRole('button', { name: '×' }));
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when no click occurs', () => {
      render(<WizardHeader {...baseProps} />);
      expect(baseProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('renders an empty string title when title is not provided', () => {
      const { container } = render(<WizardHeader onClose={() => {}} />);
      const heading = container.querySelector('h2');
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toBe('');
    });

    it('renders with a title containing special characters', () => {
      render(<WizardHeader title="Character Creation & Alignment" onClose={() => {}} />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Character Creation & Alignment');
    });

    it('renders with a long title', () => {
      const longTitle = 'A'.repeat(200);
      render(<WizardHeader title={longTitle} onClose={() => {}} />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.textContent).toBe(longTitle);
    });
  });
});
