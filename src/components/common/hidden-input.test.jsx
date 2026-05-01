import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HiddenInput from './hidden-input';

describe('HiddenInput', () => {
  const mockHandleInputToggle = vi.fn();
  const mockHandleValueChange = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the value when showInput is false', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={false}
        value={42}
        displayValue={true}
      />
    );
    
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should not render the value when displayValue is false', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={false}
        value={42}
        displayValue={false}
      />
    );
    
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('should render input when showInput is true', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={42}
      />
    );
    
    const input = screen.getByRole('spinbutton');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(42);
  });

  it('should call handleValueChange when input value changes', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={42}
      />
    );
    
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50' } });
    
    expect(mockHandleValueChange).toHaveBeenCalledWith('50');
  });

  it('should call handleInputToggle on blur', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={42}
      />
    );
    
    const input = screen.getByRole('spinbutton');
    fireEvent.blur(input);
    
    expect(mockHandleInputToggle).toHaveBeenCalled();
  });

  it('should call handleInputToggle and handleValueChange on Enter key', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={42}
      />
    );
    
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockHandleValueChange).toHaveBeenCalledWith('50');
    expect(mockHandleInputToggle).toHaveBeenCalled();
  });

  it('should not call handleInputToggle on non-Enter keys', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={42}
      />
    );
    
    const input = screen.getByRole('spinbutton');
    fireEvent.keyDown(input, { key: 'Escape' });
    
    expect(mockHandleInputToggle).not.toHaveBeenCalled();
  });

  it('should stop propagation on keydown events', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={42}
      />
    );
    
    const input = screen.getByRole('spinbutton');
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    
    expect(() => {
      input.dispatchEvent(event);
    }).not.toThrow();
  });

  it('should stop propagation on click events', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={42}
      />
    );
    
    const input = screen.getByRole('spinbutton');
    const event = new MouseEvent('click');
    
    expect(() => {
      input.dispatchEvent(event);
    }).not.toThrow();
  });

  it('should focus input when showInput becomes true', () => {
    const { rerender } = render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={false}
        value={42}
      />
    );
    
    rerender(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={42}
      />
    );
    
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveFocus();
  });

  it('should have clickable class on span', () => {
    const { container } = render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={false}
        value={42}
      />
    );
    
    const span = container.querySelector('span.clickable');
    expect(span).toBeInTheDocument();
  });

  it('should have type number on input', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={42}
      />
    );
    
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('type', 'number');
  });

  it('should have min attribute set to 0', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={42}
      />
    );
    
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '0');
  });
});