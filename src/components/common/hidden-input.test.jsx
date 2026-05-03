import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HiddenInput from './hidden-input';

describe('HiddenInput', () => {
  const mockHandleInputToggle = vi.fn();
  const mockHandleValueChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render value when showInput is false', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={false}
        value={5}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should not render value when showInput is false and displayValue is false', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={false}
        value={5}
        displayValue={false}
      />
    );

    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('should render input when showInput is true', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={5}
      />
    );

    const input = screen.getByRole('spinbutton');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(5);
  });

  it('should call handleValueChange when input value changes', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={5}
      />
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });

    expect(mockHandleValueChange).toHaveBeenCalledWith('10');
  });

  it('should call handleInputToggle on blur', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={5}
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
        value={5}
      />
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockHandleValueChange).toHaveBeenCalled();
    expect(mockHandleInputToggle).toHaveBeenCalled();
  });

  it('should stop propagation on click', () => {
    render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={5}
      />
    );

    const input = screen.getByRole('spinbutton');
    const clickEvent = new MouseEvent('click', { bubbles: true });
    const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');
    input.dispatchEvent(clickEvent);

    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it('should focus input when showInput becomes true', () => {
    const { rerender } = render(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={false}
        value={5}
      />
    );

    rerender(
      <HiddenInput
        handleInputToggle={mockHandleInputToggle}
        handleValueChange={mockHandleValueChange}
        showInput={true}
        value={5}
      />
    );

    const input = screen.getByRole('spinbutton');
    expect(document.activeElement).toBe(input);
  });
});
