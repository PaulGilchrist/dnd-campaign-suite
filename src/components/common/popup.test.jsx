import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Popup from './popup.jsx';

describe('Popup', () => {
  const mockOnClickOrKeyDown = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any event listeners
    document.removeEventListener('keydown', expect.any(Function));
  });

  it('should render popup with sanitized html content', () => {
    render(
      <Popup
        html="<b>Test Content</b>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
      />
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should call onClickOrKeyDown when overlay is clicked', () => {
    render(
      <Popup
        html="Test Content"
        onClickOrKeyDown={mockOnClickOrKeyDown}
      />
    );

    const overlay = document.querySelector('.popup-overlay');
    fireEvent.click(overlay);

    expect(mockOnClickOrKeyDown).toHaveBeenCalled();
  });

  it('should render popup modal with html content', () => {
    render(
      <Popup
        html="<div>Modal Content</div>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
      />
    );

    const modal = document.querySelector('.popup-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('should close on Escape key', () => {
    render(
      <Popup
        html="Test Content"
        onClickOrKeyDown={mockOnClickOrKeyDown}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClickOrKeyDown).toHaveBeenCalled();
  });

  it('should sanitize dangerous html', () => {
    render(
      <Popup
        html="<script>alert('xss')</script><b>Safe Content</b>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
      />
    );

    expect(screen.getByText('Safe Content')).toBeInTheDocument();
    expect(screen.queryByText("alert('xss')")).not.toBeInTheDocument();
  });
});
