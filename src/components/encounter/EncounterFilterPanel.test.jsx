// @maintained-by-ai
// Component-unit lane for EncounterFilterPanel: the panel's own render surface and
// callback payloads. Filter STATE / filterMonsters lives in EncounterBuilder.helpers
// (#401); builder-level filter-change dispatch wiring lives in builder lanes
// (#399/#403/#406/#407) — do not duplicate those here.
// NOTE (fixed 2026-10-22): the environment dropdown removed in b0b431903 (filter-row
// refactor kept Type/Size/CR in the table but dropped Environment with no replacement)
// is restored here; options arrive via the environmentOptions prop, disk-derived from
// /data/monsters.json in EncounterBuilder (see EncounterBuilder.helpers.test.jsx lane).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterFilterPanel from './EncounterFilterPanel.jsx';

// Fixture mirrors the props EncounterBuilder.jsx passes verbatim
// (difficultyLabels at EncounterBuilder.jsx:20, colors at :581).
// environmentOptions mirrors the sorted unique set derived from /data/monsters.json
// (verified 2026-10-22 via python: 12 values incl. 'planar', absent from the
// retired hardcoded ENVIRONMENTS list — disk-derived, never retyped).
const DISK_ENVIRONMENTS = [
  'arctic', 'coastal', 'desert', 'forest', 'grassland', 'hill',
  'mountain', 'planar', 'swamp', 'underdark', 'underwater', 'urban',
];

const defaultFilter = {
  difficulty: 2,
  playerLevels: [5, 5],
  totalThreshold: 600,
  environment: 'forest',
  difficultyIndex: 2,
  difficultyLabels: ['Easy', 'Medium', 'Hard', 'Deadly'],
  difficultyColors: ['var(--color-success)', 'var(--color-warning)', '#fd7e14', 'var(--color-error)'],
};

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
      environmentOptions: DISK_ENVIRONMENTS,
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

  it('renders the environment select (accessible name "Environment") with the All Environments default, exact-value options mirroring the difficulty sibling, reflecting the current filter.environment', () => {
    render(<EncounterFilterPanel {...props} />);
    const select = screen.getByRole('combobox', { name: 'Environment' });
    const options = select.querySelectorAll('option');
    // 1 blank "All" sentinel + every disk-derived value, verbatim and sorted.
    expect(options).toHaveLength(DISK_ENVIRONMENTS.length + 1);
    expect([...options].map((o) => [o.value, o.textContent])).toEqual([
      ['', 'All Environments'],
      ['arctic', 'Arctic'],
      ['coastal', 'Coastal'],
      ['desert', 'Desert'],
      ['forest', 'Forest'],
      ['grassland', 'Grassland'],
      ['hill', 'Hill'],
      ['mountain', 'Mountain'],
      ['planar', 'Planar'],
      ['swamp', 'Swamp'],
      ['underdark', 'Underdark'],
      ['underwater', 'Underwater'],
      ['urban', 'Urban'],
    ]);
    // Controlled reflection, same fidelity as the difficulty select.
    expect(select).toHaveValue('forest');
  });

  it('emits onEnvironmentChange with the exact option bytes and follows new filter.environment props', () => {
    const emitted = [];
    props.onEnvironmentChange = vi.fn((e) => emitted.push(e.target.value));
    const { rerender } = render(<EncounterFilterPanel {...props} />);

    // Same read-inside-handler pattern as the difficulty select: the panel is
    // controlled, so React restores the unchanged prop value after dispatch.
    fireEvent.change(screen.getByRole('combobox', { name: 'Environment' }), { target: { value: 'planar' } });
    expect(emitted).toEqual(['planar']);

    rerender(<EncounterFilterPanel {...props} filter={{ ...props.filter, environment: 'planar' }} />);
    expect(screen.getByRole('combobox', { name: 'Environment' })).toHaveValue('planar');

    // The blank sentinel resets the filter to "all".
    fireEvent.change(screen.getByRole('combobox', { name: 'Environment' }), { target: { value: '' } });
    expect(emitted).toEqual(['planar', '']);
  });

  it('renders no party rows for an empty party, and pins the remove button disabled with one player left', () => {
    const { rerender } = render(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [] }} />);
    expect(screen.queryByLabelText(/^PC \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Remove player \d+$/)).not.toBeInTheDocument();

    rerender(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [7] }} />);
    expect(screen.getByLabelText('PC 1')).toHaveValue(7);
    expect(screen.getByLabelText('Remove player 1')).toBeDisabled();
  });

  it('dispatches onAddPlayer and onRemovePlayer with the exact row index', () => {
    render(<EncounterFilterPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add player' }));
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

  it('keeps level inputs controlled — new playerLevels props update the displayed values', () => {
    const { rerender } = render(<EncounterFilterPanel {...props} />);
    expect(screen.getByLabelText('PC 1')).toHaveValue(5);
    expect(screen.getByLabelText('PC 2')).toHaveValue(5);

    rerender(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [8, 12] }} />);
    expect(screen.getByLabelText('PC 1')).toHaveValue(8);
    expect(screen.getByLabelText('PC 2')).toHaveValue(12);
  });

  it('displays the target threshold with locale formatting and the difficulty label and border color', () => {
    const { rerender } = render(<EncounterFilterPanel {...props} />);
    const display = screen.getByText(/Target:/);
    expect(display.textContent).toBe('Target: 600 XP (Hard)');
    expect(display.getAttribute('style')).toContain('border-left-color: rgb(253, 126, 20)');

    rerender(<EncounterFilterPanel {...props} filter={{ ...props.filter, totalThreshold: 15000 }} />);
    expect(screen.getByText(/Target:/).textContent).toBe('Target: 15,000 XP (Hard)');
  });

  // jsdom serializes hex colors to rgb(); the source value stays the
  // builder's verbatim '#fd7e14' (EncounterBuilder.jsx:581).
  describe.each([
    ['null labels', { difficultyLabels: null }, 'Unknown', 'rgb(253, 126, 20)'],
    ['out-of-bounds index', { difficultyIndex: 10 }, 'Unknown', 'var(--color-text)'],
    ['null colors', { difficultyColors: null }, 'Hard', 'var(--color-text)'],
  ])('falls back to %s', (_case, patch, expectedLabel, expectedBorder) => {
    it(`renders label "${expectedLabel}" with border ${expectedBorder}`, () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, ...patch }} />);
      expect(screen.getByText(/Target:/).textContent).toContain(`(${expectedLabel})`);
      expect(screen.getByText(/Target:/).getAttribute('style')).toContain(`border-left-color: ${expectedBorder}`);
    });
  });
});
