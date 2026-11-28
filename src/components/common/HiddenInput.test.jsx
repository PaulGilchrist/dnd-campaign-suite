// @maintained-by-ai 2026-11-27 — improved-and-trimmed pass (23→20 tests)
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HiddenInput from './HiddenInput.jsx';

// Renders HiddenInput with fresh handlers per test so no cross-test mock state leaks.
function setup(props = {}) {
  const handleInputToggle = vi.fn();
  const handleValueChange = vi.fn();
  const utils = render(
    <HiddenInput
      handleInputToggle={handleInputToggle}
      handleValueChange={handleValueChange}
      {...props}
    />
  );
  return { ...utils, handleInputToggle, handleValueChange };
}

describe('HiddenInput', () => {
  describe('display mode (showInput=false)', () => {
    it('shows the current value as text and offers no input', () => {
      setup({ showInput: false, value: 7 });

      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('renders no value text when displayValue is false', () => {
      setup({ showInput: false, value: 7, displayValue: false });

      expect(screen.queryByText('7')).not.toBeInTheDocument();
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('updates the displayed text when the value prop changes externally', () => {
      const { rerender } = setup({ showInput: false, value: 5 });

      rerender(
        <HiddenInput
          handleInputToggle={vi.fn()}
          handleValueChange={vi.fn()}
          showInput={false}
          value={12}
        />
      );

      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('still lets parent click handlers fire when displaying text', () => {
      // Only the editing input suppresses click propagation; the text display
      // must stay clickable so the parent can open edit mode.
      const onParentClick = vi.fn();
      render(
        <div onClick={onParentClick}>
          <HiddenInput
            handleInputToggle={vi.fn()}
            handleValueChange={vi.fn()}
            showInput={false}
            value={5}
          />
        </div>
      );

      fireEvent.click(screen.getByText('5'));

      expect(onParentClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit mode (showInput=true)', () => {
    it('opens focused and pre-filled when the parent switches into edit mode', () => {
      // Consumers (CharHitPoints, CharGold, TrackedResourceInput) all mount in
      // display mode and toggle showInput on — the focus contract lives there.
      const { rerender } = setup({ showInput: false, value: 5 });
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

      rerender(
        <HiddenInput
          handleInputToggle={vi.fn()}
          handleValueChange={vi.fn()}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(5);
      expect(input).toHaveFocus();
    });

    it('renders min/max bounds when max is given and leaves max unbounded when not', () => {
      const { rerender } = setup({ showInput: true, value: 5, max: 20 });

      const bounded = screen.getByRole('spinbutton');
      expect(bounded).toHaveAttribute('min', '0');
      expect(bounded).toHaveAttribute('max', '20');

      rerender(
        <HiddenInput
          handleInputToggle={vi.fn()}
          handleValueChange={vi.fn()}
          showInput
          value={5}
        />
      );

      expect(screen.getByRole('spinbutton')).not.toHaveAttribute('max');
    });

    it('keeps typed text locally without committing on every keystroke', () => {
      const { handleValueChange, handleInputToggle } = setup({ showInput: true, value: 5 });

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } });

      expect(screen.getByRole('spinbutton')).toHaveValue(12);
      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleInputToggle).not.toHaveBeenCalled();
    });
  });

  describe('committing via blur or Enter', () => {
    const commitByBlur = (props, typedValue) => {
      const handlers = setup({ showInput: true, value: 5, ...props });
      const input = screen.getByRole('spinbutton');
      if (typedValue !== undefined) {
        fireEvent.change(input, { target: { value: String(typedValue) } });
      }
      fireEvent.blur(input);
      return handlers;
    };

    const commitByEnter = (props, typedValue) => {
      const handlers = setup({ showInput: true, value: 5, ...props });
      const input = screen.getByRole('spinbutton');
      if (typedValue !== undefined) {
        fireEvent.change(input, { target: { value: String(typedValue) } });
      }
      fireEvent.keyDown(input, { key: 'Enter' });
      return handlers;
    };

    it('commits the untouched value on blur and toggles editing off once', () => {
      const { handleValueChange, handleInputToggle } = commitByBlur();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange).toHaveBeenCalledWith(5);
      expect(handleInputToggle).toHaveBeenCalledTimes(1);
    });

    it('commits a typed value on blur', () => {
      const { handleValueChange, handleInputToggle } = commitByBlur({}, 12);

      expect(handleValueChange).toHaveBeenCalledWith(12);
      expect(handleInputToggle).toHaveBeenCalledTimes(1);
    });

    it('commits a typed value on Enter without requiring blur', () => {
      const { handleValueChange, handleInputToggle } = commitByEnter({}, 12);

      expect(handleValueChange).toHaveBeenCalledWith(12);
      expect(handleInputToggle).toHaveBeenCalledTimes(1);
    });

    it('does not commit on other keys', () => {
      const { handleValueChange, handleInputToggle } = setup({ showInput: true, value: 5 });
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '12' } });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleInputToggle).not.toHaveBeenCalled();
    });

    it('cancels on Escape without committing the typed value', () => {
      const { handleValueChange, handleInputToggle } = setup({ showInput: true, value: 5 });
      const input = screen.getByRole('spinbutton');

      fireEvent.change(input, { target: { value: '12' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleInputToggle).toHaveBeenCalledTimes(1);
    });

    it('clamps values above max on commit', () => {
      const { handleValueChange } = commitByBlur({ max: 10 }, 15);

      expect(handleValueChange).toHaveBeenCalledWith(10);
    });

    it('clamps negative values to 0 on commit', () => {
      const { handleValueChange } = commitByBlur({}, -5);

      expect(handleValueChange).toHaveBeenCalledWith(0);
    });

    it('clamps to 0 when max is 0', () => {
      const { handleValueChange } = commitByBlur({ max: 0 }, 5);

      expect(handleValueChange).toHaveBeenCalledWith(0);
    });

    it('does not clamp in-range or over-range values when no max is given', () => {
      const { handleValueChange } = commitByBlur({}, 500);

      expect(handleValueChange).toHaveBeenCalledWith(500);
    });

    it('cancels without committing when the input is cleared and blurred', () => {
      const { handleValueChange, handleInputToggle } = commitByBlur({}, '');

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleInputToggle).toHaveBeenCalledTimes(1);
    });

    // The cleared-draft cancel above covers both commit triggers: blur and Enter
    // share commit()'s empty-draft guard, and their routing is pinned by the
    // typed-value blur/Enter cases.
    it('still commits an explicitly typed 0', () => {
      const { handleValueChange, handleInputToggle } = commitByBlur({}, '0');

      expect(handleValueChange).toHaveBeenCalledWith(0);
      expect(handleInputToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('event containment inside clickable parents', () => {
    it('stops click events on the input from reaching parent handlers', () => {
      const onParentClick = vi.fn();
      render(
        <div onClick={onParentClick}>
          <HiddenInput
            handleInputToggle={vi.fn()}
            handleValueChange={vi.fn()}
            showInput
            value={5}
          />
        </div>
      );

      fireEvent.click(screen.getByRole('spinbutton'));

      expect(onParentClick).not.toHaveBeenCalled();
    });

    it('stops keydown events on the input from reaching parent handlers', () => {
      const onParentKeyDown = vi.fn();
      render(
        <div onKeyDown={onParentKeyDown}>
          <HiddenInput
            handleInputToggle={vi.fn()}
            handleValueChange={vi.fn()}
            showInput
            value={5}
          />
        </div>
      );

      fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowUp' });

      expect(onParentKeyDown).not.toHaveBeenCalled();
    });
  });
});
