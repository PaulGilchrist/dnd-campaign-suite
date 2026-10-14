import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HiddenInput from './HiddenInput.jsx';

describe('HiddenInput', () => {
  const mockOnToggle = vi.fn();
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the value as text when showInput is false and displayValue is true', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
        />
      );

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders nothing when showInput is false and displayValue is false', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
          displayValue={false}
        />
      );

      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('renders a focused number input when showInput is true', () => {
      const { rerender } = render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
        />
      );

      rerender(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(5);
    });

    it('hides the input and shows the value when showInput becomes false', () => {
      const { rerender } = render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      rerender(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
        />
      );

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders native min and max attributes on the input element', () => {
      const { rerender } = render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
          max={20}
        />
      );

      rerender(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
          max={20}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '20');
    });
  });

  describe('input interaction', () => {
    it('updates local value on change without calling handleValueChange', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '10' } });

      expect(mockOnChange).not.toHaveBeenCalled();
      expect(input).toHaveValue(10);
    });

    it('commits the local value and toggles on blur', () => {
      const { rerender } = render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
        />
      );

      rerender(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      // No change: commits original value
      const input = screen.getByRole('spinbutton');
      fireEvent.blur(input);
      expect(mockOnChange).toHaveBeenCalledWith(5);
      expect(mockOnToggle).toHaveBeenCalled();

      vi.clearAllMocks();

      // Changed value: commits new value
      rerender(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
        />
      );
      rerender(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );
      const input2 = screen.getByRole('spinbutton');
      fireEvent.change(input2, { target: { value: '10' } });
      fireEvent.blur(input2);
      expect(mockOnChange).toHaveBeenCalledWith(10);
      expect(mockOnToggle).toHaveBeenCalled();
    });

    it('commits on Enter key and toggles', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(5);
      expect(mockOnToggle).toHaveBeenCalled();
    });

    it('clamps value to max on commit via blur', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
          max={10}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '15' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(10);
    });

    it('clamps negative values to 0 on commit', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '-5' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(0);
    });

    it('clamps to 0 when max is 0', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
          max={0}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(0);
    });

  });
});
