// @maintained-by-ai
/**
 * movementBudget.js — pure movement-cost math lane (L5-002 §7.3).
 *
 * Trio split (export-head evidence):
 *  - turnState.js         → economy buckets, caps, spend/refund/reset, remainingMovement (#989 owns budget math)
 *  - chargeEconomy.js     → store bridge: enforcement flags + cloneDeep + setRuntimeValue('campaign','turnState') (#989)
 *  - movementBudget.js    → THIS FILE: grid path cost, terrain multipliers, budget snap/clamp math (zero store writes)
 *
 * Consumers (run this math REAL, tested in their own lanes — wiring only, not re-done here):
 *  - usePlayerDragging.js  → clampMovementDrop (token-drop clamp + enforcement_denied log)
 *  - useSelectMove.js      → clampSelectionOffset (GM multi-select rigid clamp)
 *
 * Math is the SUT: exact foot-feet bytes, hand-derived once per leg; boundary
 * legs pin remaining==cost vs cost+1; purity means the input turnState must
 * survive byte-identical (no writes are this module's job).
 */
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
    it('difficult/rough/swamp double, greater quadruples, plain/missing/undefined single', () => {
        expect(terrainMultiplier({ '2,2': 'difficult' }, 2, 2)).toBe(2);
        expect(terrainMultiplier({ '2,2': 'Rough' }, 2, 2)).toBe(2);   // case-insensitive
        expect(terrainMultiplier({ '2,2': 'swamp' }, 2, 2)).toBe(2);    // alias registry
        expect(terrainMultiplier({ '2,2': 'greater' }, 2, 2)).toBe(4);
        expect(terrainMultiplier({ '2,2': 'plain' }, 2, 2)).toBe(1);
        expect(terrainMultiplier({}, 2, 2)).toBe(1);
        expect(terrainMultiplier(undefined, 2, 2)).toBe(1);               // no-map degradation
    });
});

describe('computePathCost (L5-002)', () => {
    it('charges the ENTERED cell\'s multiplier at exact foot bytes; leaving the origin is free', () => {
        expect(FEET_PER_CELL).toBe(5); // consumer contract (useSelectMove, usePlayerDragging)
        // Open ground: 4 orthogonal steps × 5 ft = 20 ft.
        expect(computePathCost({ from: { gridX: 0, gridY: 0 }, to: { gridX: 4, gridY: 0 }, obstacles: open(), terrain: {}, gridSize: GRID })).toBe(20);
        // Two difficult cells ahead: 2 steps × 5 ft × 2 = 20 ft.
        expect(computePathCost({ from: { gridX: 0, gridY: 0 }, to: { gridX: 2, gridY: 0 }, obstacles: open(), terrain: { '1,0': 'difficult', '2,0': 'difficult' }, gridSize: GRID })).toBe(20);
        // Open step then a greater cell: 5 + 5×4 = 25 ft.
        expect(computePathCost({ from: { gridX: 0, gridY: 0 }, to: { gridX: 2, gridY: 0 }, obstacles: open(), terrain: { '2,0': 'greater' }, gridSize: GRID })).toBe(25);
        // Same cell is free even when the origin itself is difficult (origin never charged).
        expect(computePathCost({ from: { gridX: 3, gridY: 3 }, to: { gridX: 3, gridY: 3 }, obstacles: open(), terrain: { '3,3': 'difficult' }, gridSize: GRID })).toBe(0);
    });

    it('walls force the cheapest legal detour (exact)', () => {
        // Wall at 1,0 blocks the 2-step straight route (10 ft);
        // cheapest detour 0,0→0,1→1,1→2,1→2,0 = 4 steps = 20 ft.
        const cost = computePathCost({ from: { gridX: 0, gridY: 0 }, to: { gridX: 2, gridY: 0 }, obstacles: new Set(['1,0']), terrain: {}, gridSize: GRID });
        expect(cost).toBe(20);
    });

    it('unreachable target and junk endpoints return Infinity', () => {
        const sealed = { from: { gridX: 0, gridY: 0 }, to: { gridX: 5, gridY: 5 }, obstacles: new Set(['1,0', '0,1']), terrain: {}, gridSize: GRID };
        expect(computePathCost(sealed)).toBe(Infinity);           // origin boxed in
        expect(computePathCost({ from: { gridX: 0, gridY: 0 }, to: { gridX: GRID, gridY: 0 }, obstacles: open(), terrain: {}, gridSize: GRID })).toBe(Infinity); // off-grid target
        expect(computePathCost({ from: null, to: { gridX: 1, gridY: 1 }, gridSize: GRID })).toBe(Infinity);
    });
});

describe('snapToBudget (L5-002)', () => {
    it('returns the target itself when the budget exactly covers it', () => {
        // Boundary leg: budget == cost (4 cells, exact 20 ft of 20) fits with nothing to spare.
        expect(snapToBudget({ from: { gridX: 0, gridY: 0 }, to: { gridX: 4, gridY: 0 }, budgetFeet: 20, obstacles: open(), terrain: {}, gridSize: GRID })).toEqual({ x: 4, y: 0, costFeet: 20, steps: 4 });
    });

    it('stops short at the farthest affordable cell — open and terrain-weighted', () => {
        // Open: want 8 cells (40 ft) with 15 ft budget → 3 cells, exactly 15 ft spent.
        expect(snapToBudget({ from: { gridX: 0, gridY: 0 }, to: { gridX: 8, gridY: 0 }, budgetFeet: 15, obstacles: open(), terrain: {}, gridSize: GRID })).toEqual({ x: 3, y: 0, costFeet: 15, steps: 3 });
        // Difficult cell ahead: (1,0) costs 10; (2,0) would cost 15 > 12 budget → stops at cell 1.
        expect(snapToBudget({ from: { gridX: 0, gridY: 0 }, to: { gridX: 2, gridY: 0 }, budgetFeet: 12, obstacles: open(), terrain: { '1,0': 'difficult' }, gridSize: GRID })).toEqual({ x: 1, y: 0, costFeet: 10, steps: 1 });
    });

    it('zero budget leaves the creature at the origin', () => {
        expect(snapToBudget({ from: { gridX: 4, gridY: 4 }, to: { gridX: 9, gridY: 4 }, budgetFeet: 0, obstacles: open(), terrain: {}, gridSize: GRID })).toEqual({ x: 4, y: 4, costFeet: 0, steps: 0 });
    });
});

describe('clampMovementDrop (L5-002)', () => {
    const ts = (name, over) => ({ [name]: { ...getTurnState({}, name), ...over } });

    it('clamps a drop along the remaining-budget seam — exact bytes, input never mutated', () => {
        const state = ts('Rakan', { movementUsedFeet: 0 });
        const drop = (to, over = {}) => clampMovementDrop({
            turnState: ts('Rakan', over), creatureName: 'Rakan', speedFeet: 30,
            from: { gridX: 0, gridY: 0 }, to, obstacles: open(), terrain: {}, gridSize: GRID,
        });

        // Fits: passthrough with exact cost, not snapped.
        expect(drop({ gridX: 2, gridY: 0 })).toEqual({ target: { gridX: 2, gridY: 0 }, costFeet: 10, snapped: false });
        // Boundary leg: remaining == cost (25 used → 5 ft left; 1 cell = exactly 5 ft) → passthrough.
        expect(drop({ gridX: 1, gridY: 0 }, { movementUsedFeet: 25 })).toEqual({ target: { gridX: 1, gridY: 0 }, costFeet: 5, snapped: false });
        // Over-spend: 20 used → 10 ft left vs 30 ft wanted → snap to 2 cells, 10 ft.
        expect(drop({ gridX: 6, gridY: 0 }, { movementUsedFeet: 20 })).toEqual({ target: { gridX: 2, gridY: 0 }, costFeet: 10, snapped: true });
        // Fully spent: token stays put, nothing charged.
        expect(drop({ gridX: 3, gridY: 0 }, { movementUsedFeet: 30 })).toEqual({ target: { gridX: 0, gridY: 0 }, costFeet: 0, snapped: true });
        // Unreachable target: stays at origin, flagged (callers route the deny log off this).
        expect(clampMovementDrop({
            turnState: ts('Rakan', {}), creatureName: 'Rakan', speedFeet: 30,
            from: { gridX: 0, gridY: 0 }, to: { gridX: 5, gridY: 5 }, obstacles: new Set(['1,0', '0,1']), terrain: {}, gridSize: GRID,
        })).toEqual({ target: { gridX: 0, gridY: 0 }, costFeet: 0, snapped: true, unreachable: true });

        // Pure math: the store-shaped input must survive byte-identical (writes belong to chargeEconomy).
        expect(state).toEqual(ts('Rakan', { movementUsedFeet: 0 }));
    });
});

describe('clampSelectionOffset (L5-002 GM multi-select)', () => {
    it('passes a fitting offset through at exact cost; zero offset is free', () => {
        expect(clampSelectionOffset({ dx: 2, dy: 1, minBudgetFeet: 30 })).toEqual({ dx: 2, dy: 1, costFeet: 15 });
        // Boundary leg: cells == maxCells (3 vs 15/5) → untouched, exact fit.
        expect(clampSelectionOffset({ dx: 3, dy: 0, minBudgetFeet: 15 })).toEqual({ dx: 3, dy: 0, costFeet: 15 });
        expect(clampSelectionOffset({ dx: 0, dy: 0, minBudgetFeet: 30 })).toEqual({ dx: 0, dy: 0, costFeet: 0 });
    });

    it('scales an over-budget offset down, keeps sign, cancels at zero/negative budget', () => {
        // 8 cells wanted, 3 affordable (15 ft): trunc to (1,1), leftover 1 lands on dominant axis.
        expect(clampSelectionOffset({ dx: 4, dy: 4, minBudgetFeet: 15 })).toEqual({ dx: 2, dy: 1, costFeet: 15 });
        // Negative dx keeps its sign through the scale.
        expect(clampSelectionOffset({ dx: -4, dy: 4, minBudgetFeet: 15 })).toEqual({ dx: -2, dy: 1, costFeet: 15 });
        // Zero budget cancels the whole move; negative budget floors to zero.
        expect(clampSelectionOffset({ dx: 5, dy: 5, minBudgetFeet: 0 })).toEqual({ dx: 0, dy: 0, costFeet: 0 });
        expect(clampSelectionOffset({ dx: 5, dy: 5, minBudgetFeet: -20 })).toEqual({ dx: 0, dy: 0, costFeet: 0 });
    });
});
