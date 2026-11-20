// @maintained-by-ai
// Lane: the hoisted token status chip layer (backlog RG 2026-11-19 occlusion
// fix). Renders the SAME component trio Map.jsx paints — Players, PlacedItems
// and TokenStatusLayer as siblings in one <svg> — so the DOM proves the real
// paint-order contract: every chip row documents AFTER every token group (a
// disc in the cell below can no longer bury the row), while each row stays
// bound to its OWN token's cell (position + buried-stack transform) and the
// token lanes' visibility/ghost laws cull rows exactly like they cull art.
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Players from './Players.jsx';
import PlacedItems from './PlacedItems.jsx';
import TokenStatusLayer from './TokenStatusLayer.jsx';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';
import { buildTokenStackOffsets } from '../../services/maps/tokenStackOffsets.js';
import { CELL_SIZE } from '../../config/mapConfig';

const CAMPAIGN = 'test-campaign';
const gridCenterX = (gx) => gx * CELL_SIZE + CELL_SIZE / 2;
const gridCenterY = (gy) => gy * CELL_SIZE + CELL_SIZE / 2;

// The witnessed face: Thorin (player) at (2,2) carrying chips, Goblin
// (monster) at (2,3) — the cell BELOW. Monster art always paints after
// player art (tokenStackOffsets paint-order law), so the old in-group chips
// sat under the Goblin disc.
const thorin = { id: 'p1', name: 'Thorin', gridX: 2, gridY: 2 };
const goblin = (over) => ({
  id: 'token-1', name: 'Goblin 2', type: 'monster',
  gridX: 2, gridY: 3, visible: true, ...over,
});

// One <svg> tree, exactly the Map.jsx sibling order (rerender-friendly for
// the live-SSE/ghost legs — same element type per position, props only move).
const sceneTree = ({
  players = [],
  placedItems = [],
  isLocalhost = true,
  fog = new Set(),
  ghostCells = null,
}) => {
  const mapData = { players };
  const offsets = buildTokenStackOffsets({ mapData, placedItems });
  const shared = { gridCenterX, gridCenterY, isLocalhost, fog, campaignName: CAMPAIGN };
  return (
    <svg>
      <Players
        players={players}
        characters={[]}
        handlePointerDown={vi.fn()}
        setSelectedPlayer={vi.fn()}
        tokenOffsets={offsets.players}
        {...shared}
      />
      <PlacedItems
        placedItems={placedItems}
        setSelectedItem={vi.fn()}
        npcImages={{}}
        itemDragging={null}
        handleItemPointerDown={vi.fn()}
        tokenOffsets={offsets.items}
        ghostCells={ghostCells}
        {...shared}
      />
      <TokenStatusLayer
        players={players}
        placedItems={placedItems}
        playerOffsets={offsets.players}
        itemOffsets={offsets.items}
        {...shared}
      />
    </svg>
  );
};

const renderScene = (opts) => render(sceneTree(opts));
const rows = () => screen.queryAllByTestId('token-status-indicators');
const rowFor = (creatureName) => rows().find(r => r.getAttribute('data-creature') === creatureName) || null;
const chipBg = (row) => row.querySelector('circle.token-status-bg');

describe('TokenStatusLayer — hoisted chip paint order', () => {
  beforeEach(() => {
    getStore('Thorin').clear();
    getStore('Goblin 2').clear();
    getStore('campaign').clear();
  });

  it('every chip row documents after EVERY token group (occlusion fix)', () => {
    setRuntimeObject('Thorin', { activeConditions: ['prone', 'poisoned', 'blinded', 'restrained'] }, CAMPAIGN, true);
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    const { container } = renderScene({ players: [thorin], placedItems: [goblin()] });
    const tokens = container.querySelectorAll('svg > g.creature-group, svg > g.npc-group');
    expect(tokens).toHaveLength(2);
    expect(rows()).toHaveLength(2); // one row per chipped token
    for (const row of rows()) {
      expect(row.parentElement).toHaveClass('token-status-layer');
      expect(container.querySelector('svg > g.token-status-layer')).toBe(row.parentElement);
      for (const token of tokens) {
        // token precedes the row in document order ⇒ the row paints above.
        expect(row.compareDocumentPosition(token) & Node.DOCUMENT_POSITION_PRECEDING)
          .toBeTruthy();
      }
    }
  });

  it('rows stay bound to their own token: cell-centred position under the disc', () => {
    setRuntimeObject('Thorin', { activeConditions: ['prone'] }, CAMPAIGN, true);
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    renderScene({ players: [thorin], placedItems: [goblin()] });
    // Chip row: token column centre, just below the disc (CY + CELL/2 + 8).
    expect(Number(chipBg(rowFor('Thorin')).getAttribute('cx'))).toBe(gridCenterX(2));
    expect(Number(chipBg(rowFor('Thorin')).getAttribute('cy'))).toBe(gridCenterY(2) + CELL_SIZE / 2 + 8);
    expect(Number(chipBg(rowFor('Goblin 2')).getAttribute('cx'))).toBe(gridCenterX(2));
    expect(Number(chipBg(rowFor('Goblin 2')).getAttribute('cy'))).toBe(gridCenterY(3) + CELL_SIZE / 2 + 8);
  });

  it('a buried stacked token rides the same translate on its chip row', () => {
    setRuntimeObject('Thorin', { activeConditions: ['prone'] }, CAMPAIGN, true);
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    const { container } = renderScene({ players: [thorin], placedItems: [goblin({ gridX: 2, gridY: 2 })] });
    // Player paints BELOW the monster on the shared cell ⇒ the player is the
    // buried token (translate(-10,-10)); the monster stack top rides none.
    expect(container.querySelector('g.creature-group.token-buried'))
      .toHaveAttribute('transform', 'translate(-10, -10)');
    expect(rowFor('Thorin')).toHaveAttribute('transform', 'translate(-10, -10)');
    expect(rowFor('Goblin 2')).not.toHaveAttribute('transform');
  });
});

describe('TokenStatusLayer — chip laws reach BOTH token classes', () => {
  beforeEach(() => {
    getStore('Thorin').clear();
    getStore('Goblin 2').clear();
    getStore('campaign').clear();
  });

  it('conditions then targetEffects, tones and tooltips intact through the layer', () => {
    setRuntimeObject('Thorin', { activeConditions: ['blinded'] }, CAMPAIGN, true);
    setRuntimeObject('Goblin 2', { activeConditions: ['prone', 'poisoned', 'blinded', 'restrained'] }, CAMPAIGN, true);
    setRuntimeObject('campaign', {
      targetEffects: [{ target: 'Thorin', effect: 'sanctuary', source: 'Cleric' }],
    }, CAMPAIGN, true);
    renderScene({ players: [thorin], placedItems: [goblin()] });
    const playerChips = [...rowFor('Thorin').querySelectorAll('g.token-status-chip')];
    expect(playerChips).toHaveLength(2);
    expect(playerChips[0]).toHaveAttribute('data-label', 'Blinded');
    expect(playerChips[0]).toHaveClass('effect-condition');
    expect(playerChips[1]).toHaveAttribute('data-label', 'Sanctuary');
    expect(playerChips[1]).toHaveClass('effect-buff');
    expect(playerChips[1].querySelector('title').textContent).toContain('from Cleric');
    const monsterChips = [...rowFor('Goblin 2').querySelectorAll('g.token-status-chip')];
    expect(monsterChips).toHaveLength(4); // 3 visible + overflow
    expect(monsterChips.slice(0, 3).map(c => c.getAttribute('data-label')))
      .toEqual(['Prone', 'Poisoned', 'Blinded']);
    expect(monsterChips[3]).toHaveClass('token-status-overflow');
    expect(monsterChips[3].querySelector('text.token-status-glyph').textContent).toBe('+1');
    expect(monsterChips[3].querySelector('title').textContent).toBe('1 more: Restrained');
  });

  it('clear-status tokens and non-creature props get no row (row per chipped token)', () => {
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    renderScene({
      players: [thorin],
      placedItems: [goblin(), { id: 'barrel-1', name: 'Barrel', type: 'barrel', gridX: 4, gridY: 4, visible: true }],
    });
    expect(rows()).toHaveLength(1);
    expect(rowFor('Goblin 2')).toBeInTheDocument();
  });

  it('live store updates repaint the hoisted rows (SSE lane unchanged)', () => {
    renderScene({ players: [thorin], placedItems: [goblin()] });
    expect(rows()).toHaveLength(0);
    act(() => setRuntimeObject('Thorin', { activeConditions: ['poisoned'] }, CAMPAIGN, true));
    expect(rows()).toHaveLength(1);
    act(() => setRuntimeObject('Thorin', { activeConditions: [] }, CAMPAIGN, true));
    expect(rows()).toHaveLength(0);
  });
});

describe('TokenStatusLayer — visibility and ghost laws cull rows with the art', () => {
  beforeEach(() => {
    getStore('Thorin').clear();
    getStore('Goblin 2').clear();
    getStore('campaign').clear();
  });

  it('a LAN client fogged away from a player token paints no row for it', () => {
    setRuntimeObject('Thorin', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    renderScene({ players: [thorin], isLocalhost: false, fog: new Set(['2,2']) });
    expect(rows()).toHaveLength(0);
  });

  it('hidden/fogged creature rows paint no chips for LAN clients; the GM keeps the truth row', () => {
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    const lan = renderScene({ placedItems: [goblin({ visible: false })], isLocalhost: false });
    expect(rows()).toHaveLength(0);
    lan.unmount();
    const fogged = renderScene({ placedItems: [goblin()], isLocalhost: false, fog: new Set(['2,3']) });
    expect(rows()).toHaveLength(0);
    fogged.unmount();
    renderScene({ placedItems: [goblin({ visible: false })], isLocalhost: true });
    expect(rows()).toHaveLength(1); // GM truth face unchanged (chips ride the dim art)
  });

  it('ghost law: a token frozen as .token-ghost leaks zero chip rows', () => {
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    // Visitor, token genuinely live first (no memory in play yet)…
    const { container, rerender } = renderScene({
      placedItems: [goblin()], isLocalhost: false,
    });
    expect(container.querySelectorAll('g.npc-group.token-ghost')).toHaveLength(0);
    expect(rows()).toHaveLength(1);
    // …then the cell leaves the light: the parent's hoisted pass hands down
    // the last-seen memory, the art re-renders as a ghost at that cell and
    // the chip layer (reading the TRUE cell) paints none.
    rerender(sceneTree({
      placedItems: [goblin()], isLocalhost: false, fog: new Set(['2,3']),
      ghostCells: new Map([['token-1', { gridX: 2, gridY: 3 }]]),
    }));
    expect(container.querySelectorAll('g.npc-group.token-ghost')).toHaveLength(1);
    expect(rows()).toHaveLength(0);
  });
});
