import { describe, it, expect } from 'vitest';
import {
    computeClosedDoors,
    computeMovementObstacles,
    computeReachable,
    findNearestValid,
} from './reachability.js';

describe('computeClosedDoors', () => {
    it('should return an empty set with no items', () => {
        expect(computeClosedDoors([]).size).toBe(0);
    });

    it('should return an empty set for null items', () => {
        expect(computeClosedDoors(null).size).toBe(0);
    });

    it('should collect closed door cells', () => {
        const doors = computeClosedDoors([
            { type: 'door', open: false, gridX: 1, gridY: 2 },
            { type: 'door', open: false, gridX: 4, gridY: 5 },
        ]);
        expect(doors).toContain('1,2');
        expect(doors).toContain('4,5');
        expect(doors.size).toBe(2);
    });

    it('should ignore open doors', () => {
        const doors = computeClosedDoors([
            { type: 'door', open: true, gridX: 1, gridY: 2 },
        ]);
        expect(doors.size).toBe(0);
    });

    it('should ignore non-door items', () => {
        const doors = computeClosedDoors([
            { type: 'table', open: false, gridX: 1, gridY: 2 },
            { type: 'secretDoor', open: false, gridX: 2, gridY: 2 },
        ]);
        expect(doors.size).toBe(0);
    });
});

describe('computeMovementObstacles', () => {
    it('should include painted walls', () => {
        const obstacles = computeMovementObstacles(new Set(['1,1']), []);
        expect(obstacles.has('1,1')).toBe(true);
    });

    it('should handle null walls', () => {
        const obstacles = computeMovementObstacles(null, []);
        expect(obstacles.size).toBe(0);
    });

    it('should treat a hidden secret door as a wall', () => {
        const obstacles = computeMovementObstacles(new Set(), [
            { type: 'secretDoor', gridX: 2, gridY: 3, visible: false },
        ]);
        expect(obstacles.has('2,3')).toBe(true);
    });

    it('should treat a discovered secret door as passable', () => {
        const obstacles = computeMovementObstacles(new Set(['2,3']), [
            { type: 'secretDoor', gridX: 2, gridY: 3, visible: true },
        ]);
        expect(obstacles.has('2,3')).toBe(false);
    });

    it('should include closed doors', () => {
        const obstacles = computeMovementObstacles(new Set(), [
            { type: 'door', open: false, gridX: 3, gridY: 4 },
        ]);
        expect(obstacles.has('3,4')).toBe(true);
    });

    it('should exclude open doors', () => {
        const obstacles = computeMovementObstacles(new Set(), [
            { type: 'door', open: true, gridX: 3, gridY: 4 },
        ]);
        expect(obstacles.has('3,4')).toBe(false);
    });

    it('should combine walls and closed doors', () => {
        const obstacles = computeMovementObstacles(new Set(['1,1']), [
            { type: 'door', open: false, gridX: 2, gridY: 2 },
        ]);
        expect(obstacles.has('1,1')).toBe(true);
        expect(obstacles.has('2,2')).toBe(true);
        expect(obstacles.size).toBe(2);
    });
});

describe('computeReachable', () => {
    const gridSize = 5;

    it('should return only the start cell when the start cell is blocked', () => {
        const reachable = computeReachable(2, 2, new Set(['2,2']), gridSize);
        expect(reachable.size).toBe(1);
        expect(reachable.has('2,2')).toBe(true);
    });

    it('should flood fill the entire open grid', () => {
        const reachable = computeReachable(0, 0, new Set(), gridSize);
        expect(reachable.size).toBe(gridSize * gridSize);
    });

    it('should include the start cell', () => {
        const reachable = computeReachable(2, 2, new Set(), gridSize);
        expect(reachable.has('2,2')).toBe(true);
    });

    it('should stop at walls', () => {
        const wall = new Set();
        for (let y = 0; y < gridSize; y++) wall.add(`2,${y}`);
        const reachable = computeReachable(0, 0, wall, gridSize);
        expect(reachable.size).toBe(2 * gridSize);
        for (let y = 0; y < gridSize; y++) {
            expect(reachable.has(`0,${y}`)).toBe(true);
            expect(reachable.has(`1,${y}`)).toBe(true);
            expect(reachable.has(`3,${y}`)).toBe(false);
            expect(reachable.has(`4,${y}`)).toBe(false);
        }
    });

    it('should treat closed doors as blocking via movement obstacles', () => {
        const obstacles = computeMovementObstacles(new Set(), [
            { type: 'door', open: false, gridX: 2, gridY: 2 },
        ]);
        const reachable = computeReachable(0, 0, obstacles, gridSize);
        expect(reachable.has('2,2')).toBe(false);
        // the door blocks the cell but does not partition the room
        expect(reachable.size).toBe(gridSize * gridSize - 1);
    });

    it('should not leave the grid from an edge start', () => {
        const reachable = computeReachable(4, 4, new Set(), gridSize);
        expect(reachable.has('4,4')).toBe(true);
        expect(reachable.has('5,4')).toBe(false);
        expect(reachable.has('4,5')).toBe(false);
    });

    it('should clamp an out-of-bounds start cell', () => {
        const reachable = computeReachable(-3, 7, new Set(), gridSize);
        expect(reachable.has('0,4')).toBe(true);
    });

    it('should return an empty set for invalid grid sizes', () => {
        expect(computeReachable(1, 1, new Set(), 0).size).toBe(0);
        expect(computeReachable(1, 1, new Set(), null).size).toBe(0);
    });
});

describe('findNearestValid', () => {
    const gridSize = 5;

    it('should return the start cell when it is valid', () => {
        const found = findNearestValid(1, 1, () => true, gridSize);
        expect(found).toEqual({ x: 1, y: 1 });
    });

    it('should return the nearest valid cell at shortest distance', () => {
        const found = findNearestValid(
            0, 0,
            (x, y) => (x === 1 && y === 0) || (x === 0 && y === 2),
            gridSize
        );
        expect(found).toEqual({ x: 1, y: 0 });
    });

    it('should search beyond invalid cells', () => {
        const found = findNearestValid(
            0, 0,
            (x, y) => x === 2 && y === 1,
            gridSize
        );
        expect(found).toEqual({ x: 2, y: 1 });
    });

    it('should return null when no cell is valid', () => {
        const found = findNearestValid(0, 0, () => false, gridSize);
        expect(found).toBeNull();
    });

    it('should clamp an out-of-bounds start cell', () => {
        const found = findNearestValid(-2, 9, () => true, gridSize);
        expect(found).toEqual({ x: 0, y: 4 });
    });

    it('should return null for invalid grid sizes', () => {
        expect(findNearestValid(1, 1, () => true, 0)).toBeNull();
        expect(findNearestValid(1, 1, () => true, null)).toBeNull();
    });
});
