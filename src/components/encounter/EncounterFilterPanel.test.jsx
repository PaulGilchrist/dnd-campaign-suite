// @maintained-by-ai 2026-11-28
// Component-unit lane for EncounterFilterPanel: the panel's own render surface and
// callback payloads. Filter STATE / filterMonsters and the disk-derived
// environmentOptions list live in EncounterBuilder.helpers.test.jsx (its "narrows
// rows by environment ... options derived from the mounted bestiary" test owns the
// monsters.json lock); builder-level filter-change dispatch wiring lives in the
// builder lanes (#399/#403/#406/#407) — do not duplicate those here. This unit only
// proves prop -> option rendering (capitalization, blank "All" sentinel), controlled
// reflection, and emitted payloads, so the options fixture is arbitrary, not disk.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterFilterPanel from './EncounterFilterPanel.jsx';

// Fixture mirrors the props EncounterBuilder passes (difficultyLabels, colors with
// the builder's verbatim '#fd7e14' at the Hard slot).
const defaultFilter = {
  difficulty: 2,
  playerLevels: [5, 5],
  totalThreshold: 600,
  environment: 'forest',
  difficultyIndex: 2,
  difficultyLabels: ['Easy', 'Medium', 'Hard', 'Deadly'],
  difficultyColors: ['var(--color-success)', 'var(--color-warning)', '#fd7e14', 'var(--color-error)'],
};

const ENVIRONMENT_OPTIONS = ['desert', 'forest', 'underdark'];

describe('EncounterFilterPanel', () => {
  let props;

  beforeEach(() => {
    props = {
      filter: defaultFilter,
      onDifficultyChange: vi.fn(),
      onEnvironmentChange: vi.fn(),
      onAddPlayer: vi.fn(),
      onRemovePlayer: vi.fn(),
      onPlayerLevelChange: vi.fn(),
      environmentOptions: ENVIRONMENT_OPTIONS,
    };
  });

  it('renders the difficulty select, party controls, and level rows reflecting the filter (min 1, max 20)', () => {
    render(<EncounterFilterPanel {...props} />);
    expect(screen.getByRole('combobox', { name: 'Difficulty' })).toBeInTheDocument();
    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add player' })).toBeInTheDocument();
    expect(screen.getByLabelText('PC 1')).toHaveValue(5);
    expect(screen.getByLabelText('PC 2')).toHaveValue(5);
    expect(screen.getByLabelText('PC 1')).toHaveAttribute('min', '1');
    expect(screen.getByLabelText('PC 1')).toHaveAttribute('max', '20');
    expect(screen.getByLabelText('Remove player 1')).toBeEnabled();
    expect(screen.getByLabelText('Remove player 2')).toBeEnabled();
  });

  it('offers exactly Easy/Medium/Hard/Deadly options, reflects the selected difficulty, and emits the change event', () => {
    const emitted = [];
    props.onDifficultyChange = vi.fn((e) => emitted.push(e.target.value));
    render(<EncounterFilterPanel {...props} />);
    const select = screen.getByRole('combobox', { name: 'Difficulty' });
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(4);
    expect([...options].map((o) => [o.value, o.textContent])).toEqual([
      ['0', 'Easy'],
      ['1', 'Medium'],
      ['2', 'Hard'],
      ['3', 'Deadly'],
    ]);
    expect(select).toHaveValue('2');

    // Value must be read inside the handler: the panel is controlled, so React
    // restores the select to the unchanged prop value after dispatch.
    fireEvent.change(select, { target: { value: '3' } });
    expect(emitted).toEqual(['3']);
  });

  it('renders the Environment select with a blank All-Environments sentinel plus one capitalized option per environmentOptions entry, reflects and emits raw values, and follows new props', () => {
    const emitted = [];
    props.onEnvironmentChange = vi.fn((e) => emitted.push(e.target.value));
    const { rerender } = render(<EncounterFilterPanel {...props} />);
    const select = screen.getByRole('combobox', { name: 'Environment' });
    expect([...select.querySelectorAll('option')].map((o) => [o.value, o.textContent])).toEqual([
      ['', 'All Environments'],
      ['desert', 'Desert'],
      ['forest', 'Forest'],
      ['underdark', 'Underdark'],
    ]);
    expect(select).toHaveValue('forest');

    fireEvent.change(select, { target: { value: 'underdark' } });
    expect(emitted).toEqual(['underdark']);

    rerender(<EncounterFilterPanel {...props} filter={{ ...props.filter, environment: 'underdark' }} />);
    expect(screen.getByRole('combobox', { name: 'Environment' })).toHaveValue('underdark');

    // The blank sentinel resets the filter to "all"...
    fireEvent.change(screen.getByRole('combobox', { name: 'Environment' }), { target: { value: '' } });
    expect(emitted).toEqual(['underdark', '']);

    // ...and a null/undefined filter.environment displays that sentinel.
    rerender(<EncounterFilterPanel {...props} filter={{ ...props.filter, environment: null }} />);
    expect(screen.getByRole('combobox', { name: 'Environment' })).toHaveValue('');
  });

  it('renders no party rows for an empty party, follows new playerLevels props, and pins the remove button disabled with one player left', () => {
    const { rerender } = render(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [] }} />);
    expect(screen.queryByLabelText(/^PC \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Remove player \d+$/)).not.toBeInTheDocument();

    // Controlled reflection: multi-row prop updates flow to the displayed values.
    rerender(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [8, 12] }} />);
    expect(screen.getByLabelText('PC 1')).toHaveValue(8);
    expect(screen.getByLabelText('PC 2')).toHaveValue(12);
    expect(screen.getByLabelText('Remove player 1')).toBeEnabled();

    rerender(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [7] }} />);
    expect(screen.getByLabelText('PC 1')).toHaveValue(7);
    expect(screen.getByLabelText('Remove player 1')).toBeDisabled();
  });

  it('dispatches onAddPlayer and onRemovePlayer with the exact row index', () => {
    render(<EncounterFilterPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add player' }));
    // onAddPlayer is wired straight to onClick and receives the raw synthetic event;
    // the event is not part of the contract — assert only that clicking fired it once.
    expect(props.onAddPlayer).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Remove player 1'));
    expect(props.onRemovePlayer).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByLabelText('Remove player 2'));
    expect(props.onRemovePlayer).toHaveBeenCalledWith(1);
  });

  it('emits onPlayerLevelChange with numeric index and number-converted level for each row', () => {
    render(<EncounterFilterPanel {...props} />);
    fireEvent.change(screen.getByLabelText('PC 1'), { target: { value: '10' } });
    expect(props.onPlayerLevelChange).toHaveBeenCalledWith(0, 10);

    fireEvent.change(screen.getByLabelText('PC 2'), { target: { value: '3' } });
    expect(props.onPlayerLevelChange).toHaveBeenCalledWith(1, 3);
  });

  it('displays the target threshold with locale formatting and the difficulty label and border color', () => {
    const { rerender } = render(<EncounterFilterPanel {...props} />);
    const display = screen.getByText(/Target:/);
    expect(display.textContent).toBe('Target: 600 XP (Hard)');
    expect(display.getAttribute('style')).toContain('border-left-color: rgb(253, 126, 20)');

    rerender(<EncounterFilterPanel {...props} filter={{ ...props.filter, totalThreshold: 15000 }} />);
    expect(screen.getByText(/Target:/).textContent).toBe('Target: 15,000 XP (Hard)');
  });

  // jsdom serializes hex colors to rgb(). Two cases cover both guard arms on both
  // expressions: null arrays short-circuit the `&&`, an in-bounds-array/out-of-range
  // index misses the lookup.
  describe.each([
    ['null label and color arrays', { difficultyLabels: null, difficultyColors: null }, 'Unknown', 'var(--color-text)'],
    ['out-of-bounds index', { difficultyIndex: 10 }, 'Unknown', 'var(--color-text)'],
  ])('falls back to %s', (_case, patch, expectedLabel, expectedBorder) => {
    it(`renders label "${expectedLabel}" with border ${expectedBorder}`, () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, ...patch }} />);
      expect(screen.getByText(/Target:/).textContent).toContain(`(${expectedLabel})`);
      expect(screen.getByText(/Target:/).getAttribute('style')).toContain(`border-left-color: ${expectedBorder}`);
    });
  });
});
