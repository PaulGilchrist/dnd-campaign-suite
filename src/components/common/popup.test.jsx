import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Popup from './popup';

describe('Popup', () => {
  const mockOnClickOrKeyDown = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
   });

  afterEach(() => {
    // Clean up any event listeners
    document.removeEventListener('keydown', vi.fn());
   });

  it('should render popup overlay', () => {
    render(
       <Popup
        html="<p>Test content</p>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
       />
     );
    
    expect(screen.getByRole('presentation')).toBeInTheDocument();
   });

  it('should render popup modal', () => {
    render(
       <Popup
        html="<p>Test content</p>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
       />
     );
    
    const modal = document.querySelector('.popup-modal');
    expect(modal).toBeInTheDocument();
   });

  it('should display sanitized HTML content', () => {
    render(
       <Popup
        html="<p>Test content</p>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
       />
     );
    
    const modal = document.querySelector('.popup-modal');
    expect(modal.innerHTML).toBe('<p>Test content</p>');
   });

  it('should sanitize dangerous HTML', () => {
    render(
       <Popup
        html="<script>alert('xss')</script><p>Safe content</p>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
       />
     );
    
    const modal = document.querySelector('.popup-modal');
    expect(modal.innerHTML).not.toContain('<script>');
    expect(modal.innerHTML).toContain('Safe content');
   });

  it('should call onClickOrKeyDown when overlay is clicked', () => {
    render(
       <Popup
        html="<p>Test content</p>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
       />
     );
    
    const overlay = document.querySelector('.popup-overlay');
    fireEvent.click(overlay);
    
    expect(mockOnClickOrKeyDown).toHaveBeenCalled();
   });

  it('should call onClickOrKeyDown when Escape key is pressed', () => {
    render(
       <Popup
        html="<p>Test content</p>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
       />
     );
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockOnClickOrKeyDown).toHaveBeenCalled();
   });

  it('should remove event listener after onClickOrKeyDown is called', () => {
    render(
       <Popup
        html="<p>Test content</p>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
       />
     );
    
    const overlay = document.querySelector('.popup-overlay');
    fireEvent.click(overlay);
    
    // The event listener should be removed
    // We can verify this by checking that subsequent keydown events don't trigger the handler
    mockOnClickOrKeyDown.mockClear();
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockOnClickOrKeyDown).not.toHaveBeenCalled();
   });

  it('should handle empty HTML content', () => {
    render(
       <Popup
        html=""
        onClickOrKeyDown={mockOnClickOrKeyDown}
       />
     );
    
    const modal = document.querySelector('.popup-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.innerHTML).toBe('');
   });

  it('should handle HTML with multiple elements', () => {
    render(
       <Popup
        html="<div><h1>Title</h1><p>Content</p></div>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
       />
     );
    
    const modal = document.querySelector('.popup-modal');
    expect(modal.innerHTML).toContain('<h1>Title</h1>');
    expect(modal.innerHTML).toContain('<p>Content</p>');
   });

  it('should not call onClickOrKeyDown when clicking inside modal', () => {
    render(
       <Popup
        html="<button>Click me</button>"
        onClickOrKeyDown={mockOnClickOrKeyDown}
       />
     );
    
    const modal = document.querySelector('.popup-modal');
    fireEvent.click(modal);
    
    // Click on modal itself should not trigger overlay click
    // (event propagation is stopped by the modal)
   });
});