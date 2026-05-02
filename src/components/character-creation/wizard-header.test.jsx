import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardHeader from './wizard-header';

describe('WizardHeader', () => {
    it('should render the title', () => {
        render(<WizardHeader title="Create Character" onClose={vi.fn()} />);
         
        expect(screen.getByText('Create Character')).toBeInTheDocument();
      });

    it('should render a close button', () => {
        render(<WizardHeader title="Test" onClose={vi.fn()} />);
         
        const closeButton = document.querySelector('.close-btn');
        expect(closeButton).toBeInTheDocument();
      });

    it('should call onClose when close button is clicked', () => {
        const onCloseMock = vi.fn();
        render(<WizardHeader title="Test" onClose={onCloseMock} />);
         
        const closeButton = document.querySelector('.close-btn');
        fireEvent.click(closeButton);
         
        expect(onCloseMock).toHaveBeenCalledTimes(1);
      });

    it('should render the close button with × symbol', () => {
        render(<WizardHeader title="Test" onClose={vi.fn()} />);
         
        const closeButton = document.querySelector('.close-btn');
        expect(closeButton.textContent).toBe('×');
      });

    it('should render the title in an h2 element', () => {
        render(<WizardHeader title="Test Title" onClose={vi.fn()} />);
         
        expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Test Title');
      });

    it('should render the wizard-header container', () => {
        render(<WizardHeader title="Test" onClose={vi.fn()} />);
         
        const header = document.querySelector('.wizard-header');
        expect(header).toBeInTheDocument();
      });

    it('should update when title changes', () => {
        const { rerender } = render(<WizardHeader title="Old Title" onClose={vi.fn()} />);
         
        expect(screen.getByText('Old Title')).toBeInTheDocument();
         
        rerender(<WizardHeader title="New Title" onClose={vi.fn()} />);
         
        expect(screen.getByText('New Title')).toBeInTheDocument();
      });
});
