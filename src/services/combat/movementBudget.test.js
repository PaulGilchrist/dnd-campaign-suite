import { describe, it, expect } from 'vitest';
import {
    computePathCost,
    snapToBudget,
    clampMovementDrop,
    clampSelectionOffset,
    terrainMultiplier,
    FEET_PER_CELL,
} from './movementBudget.js';
import { getTurnState } from './turnState.js';

const GRID = 20;
const open = () => new Set(); // no obstacles

describe('terrainMultiplier (L5-002 §7.3)', () => {
    it('difficult/rough/swamp double, greater quadruples, plain single', () => {
        expect(terrainMultiplier({ '2,2': 'difficult' }, 2, 2)).toBe(2);
        expect(terrainMultiplier({ '2,2': 'Rough' }, 2, 2)).toBe(2);
        expect(terrainMultiplier({ '2,2': 'greater' }, 2, 2)).toBe(4);
        expect(terrainMultiplier({ '2,2': 'plain' }, 2, 2)).toBe(1);
        expect(terrainMultiplier({}, 2, 2)).toBe(1);
        expect(terrainMultiplier(undefined, 2, 2)).toBe(1);
    });
});

describe('computePathCost (L5-002)', () => {
    it('same cell is free', () => {
        expect(computePathCost({ from: { gridX: 3, gridY: 3 }, to: { gridX: 3, gridY: 3 }, gridSize: GRID })).toBe(0);
    });

    it('straight-line cost on open ground', () => {
        // 4 cells orthogonal → 20 ft.
        const cost = computePathCost({ from: { gridX: 0, gridY: 0 }, to: { gridX: 4, gridY: 0 }, obstacles: open(), terrain: {}, gridSize: GRID });
        expect(cost).toBe(4 * FEET_PER_CELL);
    });

    it('difficult terrain cells double their step cost', () => {
        // Path 0,0 → 2,0 through two difficult cells ahead.
        const terrain = { '1,0': 'difficult', '2,0': 'difficult' };
        const cost = computePathCost({ from: { gridX: 0, gridY: 0 }, to: { gridX: 2, gridY: 0 }, obstacles: open(), terrain, gridSize: GRID });
        expect(cost).toBe(2 * FEET_PER_CELL * 2);
    });

    it('walls force a detour (cheapest legal path)', () => {
        // Wall at 1,0 blocks the straight route; must go around (+cost).
        const obstacles = new Set(['1,0']);
        const straight = { from: { gridX: 0, gridY: 0 }, to: { gridX: 2, gridY: 0 }, obstacles, terrain: {}, gridSize: GRID };
        const cost = computePathCost(straight);
        expect(cost).toBeGreaterThan(2 * FEET_PER_CELL);
    });

    it('returns Infinity when the target is unreachable (boxed in)', () => {
        const obstacles = new Set(['1,0', '0,1']); // origin 0,0 sealed
        const cost = computePathCost({ from: { gridX: 0, gridY: 0 }, to: { gridX: 5, gridY: 5 }, obstacles, terrain: {}, gridSize: GRID });
        expect(cost).toBe(Infinity);
    });
});

describe('snapToBudget (L5-002)', () => {
    it('returns the target itself when it fits the budget', () => {
        const s = snapToBudget({ from: { gridX: 0, gridY: 0 }, to: { gridX: 2, gridY: 0 }, budgetFeet: 30, obstacles: open(), terrain: {}, gridSize: GRID });
        expect(s).toMatchObject({ x: 2, y: 0 });
    });

    it('stops short at the affordable cell when the budget is too small', () => {
        // Want 8 cells (40ft) with a 15ft budget → reach 3 cells out.
        const s = snapToBudget({ from: { gridX: 0, gridY: 0 }, to: { gridX: 8, gridY: 0 }, budgetFeet: 15, obstacles: open(), terrain: {}, gridSize: GRID });
        expect(s.costFeet).toBeLessThanOrEqual(15);
        expect(s.x).toBe(3);
        expect(s.y).toBe(0);
    });

    it('zero budget leaves the creature at the origin', () => {
        const s = snapToBudget({ from: { gridX: 4, gridY: 4 }, to: { gridX: 9, gridY: 4 }, budgetFeet: 0, obstacles: open(), terrain: {}, gridSize: GRID });
        expect(s).toMatchObject({ x: 4, y: 4, costFeet: 0 });
    });
});

describe('clampMovementDrop (L5-002)', () => {
    const ts = (name, over) => ({ [name]: { ...getTurnState({}, name), ...over } });

    it('passes the drop through when it fits the remaining budget', () => {
        const r = clampMovementDrop({
            turnState: ts('Rakan', { movementUsedFeet: 0 }),
            creatureName: 'Rakan', speedFeet: 30,
            from: { gridX: 0, gridY: 0 }, to: { gridX: 2, gridY: 0 },
            obstacles: open(), terrain: {}, gridSize: GRID,
        });
        expect(r.snapped).toBe(false);
        expect(r.target).toEqual({ gridX: 2, gridY: 0 });
        expect(r.costFeet).toBe(10);
    });

    it('snaps to remaining movement and reports the cheaper cost', () => {
        const r = clampMovementDrop({
            turnState: ts('Rakan', { movementUsedFeet: 25 }), // 5 ft left of 30
            creatureName: 'Rakan', speedFeet: 30,
            from: { gridX: 0, gridY: 0 }, to: { gridX: 6, gridY: 0 },
            obstacles: open(), terrain: {}, gridSize: GRID,
        });
        expect(r.snapped).toBe(true);
        expect(r.target.gridX).toBe(1); // only one 5ft cell affordable
        expect(r.costFeet).toBe(5);
    });

    it('a fully-spent budget leaves the token at the start cell', () => {
        const r = clampMovementDrop({
            turnState: ts('Rakan', { movementUsedFeet: 30 }),
            creatureName: 'Rakan', speedFeet: 30,
            from: { gridX: 3, gridY: 3 }, to: { gridX: 8, gridY: 3 },
            obstacles: open(), terrain: {}, gridSize: GRID,
        });
        expect(r.target).toEqual({ gridX: 3, gridY: 3 });
        expect(r.costFeet).toBe(0);
    });
});

describe('clampSelectionOffset (L5-002 GM multi-select)', () => {
    it('leaves a fitting offset untouched', () => {
        expect(clampSelectionOffset({ dx: 2, dy: 1, minBudgetFeet: 30 })).toEqual({ dx: 2, dy: 1, costFeet: 15 });
    });

    it('scales an over-budget offset down to fit', () => {
        const r = clampSelectionOffset({ dx: 4, dy: 4, minBudgetFeet: 15 }); // 8 cells, 3 fit
        expect(Math.abs(r.dx) + Math.abs(r.dy)).toBe(3);
        expect(r.costFeet).toBe(15);
    });

    it('zero budget cancels the whole move', () => {
        expect(clampSelectionOffset({ dx: 5, dy: 5, minBudgetFeet: 0 })).toEqual({ dx: 0, dy: 0, costFeet: 0 });
    });

    it('zero offset is free', () => {
        expect(clampSelectionOffset({ dx: 0, dy: 0, minBudgetFeet: 30 })).toEqual({ dx: 0, dy: 0, costFeet: 0 });
    });
});
