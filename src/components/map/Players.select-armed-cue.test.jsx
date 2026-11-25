// @maintained-by-ai
// Lane: the Select-tool marquee exclusion cue on player tokens (backlog
// RH 2026-11-24). The marquee (useSelectMove) selects WALL CELLS +
// placedItems ONLY — players[] tokens are the documented lane split handed
// to usePlayerDragging (useSelectMove.test.js header). This file pins the
// spectacle that explains the split: armed → cue class + dashed ring +
// cause-naming <title> on EVERY token; disarmed / any other tool → cue
// fully absent; and the cue never swallows the pointer lanes underneath
// (single-token drag + right-click menu keep working while armed).
// The marquee law itself is pinned by useSelectMove.test.js — unchanged.
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Players from './Players.jsx';
import { TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_SELECT } from '../../config/mapConfig';

const CELL = 40;
const gridCenterX = (gx) => gx * CELL + CELL / 2;
const gridCenterY = (gy) => gy * CELL + CELL / 2;
const CUE_TITLE = 'Player tokens aren\u2019t group-selectable \u2014 drag them individually';

const players = [
  { id: 'p1', name: 'Thorin', gridX: 2, gridY: 3 },
  { id: 'p2', name: 'Gimli', gridX: 4, gridY: 3 },
];

const renderLayer = (props = {}) =>
  render(
    <svg>
      <Players
        players={players}
        characters={[]}
        gridCenterX={gridCenterX}
        gridCenterY={gridCenterY}
        isLocalhost
        handlePointerDown={vi.fn()}
        setSelectedPlayer={vi.fn()}
        campaignName="test-campaign"
        {...props}
      />
    </svg>
  );

describe('Players — Select-tool "not group-selectable" cue', () => {
  it('Select armed: every token carries the cue class, dashed ring and title', () => {
    const { container } = renderLayer({ tool: TOOL_SELECT });
    const groups = container.querySelectorAll('g.creature-group');
    expect(groups).toHaveLength(players.length);
    for (const group of groups) {
      expect(group).toHaveClass('not-group-selectable');
      const ring = group.querySelector('circle.not-group-select-ring');
      expect(ring).toBeInTheDocument();
      // Decorative layer must never eat the drag/menu pointer lanes.
      expect(ring).toHaveAttribute('pointer-events', 'none');
      const title = group.querySelector('title');
      expect(title).toBeInTheDocument();
      expect(title.textContent).toBe(CUE_TITLE);
    }
  });

  it('disarmed (no tool prop) carries no cue DOM at all', () => {
    const { container } = renderLayer({});
    expect(container.querySelectorAll('.not-group-selectable')).toHaveLength(0);
    expect(container.querySelectorAll('circle.not-group-select-ring')).toHaveLength(0);
    expect(container.querySelectorAll('title')).toHaveLength(0);
  });

  it('every other tool state (none/paint/erase) leaves the cue absent', () => {
    for (const tool of [TOOL_NONE, TOOL_PAINT, TOOL_ERASE]) {
      const { container, unmount } = renderLayer({ tool });
      expect(container.querySelectorAll('.not-group-selectable'), tool).toHaveLength(0);
      expect(container.querySelectorAll('circle.not-group-select-ring'), tool).toHaveLength(0);
      expect(container.querySelectorAll('title'), tool).toHaveLength(0);
      unmount();
    }
  });

  it('cue shown: single-token pointer drag and the right-click opener still fire', () => {
    const handlePointerDown = vi.fn();
    const setSelectedPlayer = vi.fn();
    const { container } = renderLayer({
      tool: TOOL_SELECT,
      handlePointerDown,
      setSelectedPlayer,
    });
    const [first, second] = container.querySelectorAll('g.creature-group');
    first.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(handlePointerDown).toHaveBeenCalledWith(expect.any(Object), 'p1');
    second.querySelector('circle.creature-circle').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true })
    );
    expect(setSelectedPlayer).toHaveBeenCalledWith(players[1]);
  });

  it('cue coexists with the passive chrome (context-menu rect + ownership ring) on one token', () => {
    const { container } = renderLayer({
      tool: TOOL_SELECT,
      selectedPlayer: { id: 'p1' },
    });
    const first = container.querySelectorAll('g.creature-group')[0];
    expect(first.querySelector('circle.not-group-select-ring')).toBeInTheDocument();
    expect(first.querySelector('rect[stroke="#FFD700"]')).toBeInTheDocument();
  });

  it('fogged tokens never paint (cue cull runs with the token cull)', () => {
    const { container } = renderLayer({
      tool: TOOL_SELECT,
      isLocalhost: false,
      fog: new Set(['2,3']),
    });
    expect(container.querySelectorAll('g.creature-group')).toHaveLength(1); // only Gimli survives
    expect(container.querySelectorAll('circle.not-group-select-ring')).toHaveLength(1);
  });
});
