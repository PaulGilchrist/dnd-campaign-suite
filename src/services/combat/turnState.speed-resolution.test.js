// @maintained-by-ai
// Lane: movement-budget speed resolution (bug-movement-budget-caps-all-movers-at-30).
//
// Regression pin: the drag/card budget read the token-only `speedFeet` field
// which NO producer ever stamped, so every mover was capped at
// DEFAULT_SPEED_FEET (30) regardless of sheet speed (Speedy feat +10, mounts,
// 40-ft monsters) while the Initiative header strip honestly showed 40.
// resolveSpeedFeet is the single resolution the map lanes and the per-card
// economy strip now share; monsterSpeedToFeet threads the bestiary walk speed
// onto joined combatSummary rows (`speed`, feet — the shape
// executeAttackRider.applyManeuveringAllyGrant already reads).
//
// Do NOT duplicate: turnState.test.js — remainingMovement/spend primitives;
// movementBudget.test.js — clamp math; usePlayerDragging.speed-resolution
// .test.js — the drag lane consuming this resolver.
import { describe, it, expect } from 'vitest';
import {
    DEFAULT_SPEED_FEET,
    resolveSpeedFeet,
    monsterSpeedToFeet,
} from './turnState.js';

describe('resolveSpeedFeet — movement-budget ceiling resolution', () => {
    const sheet = [{ name: 'EvasiveFighter', computedStats: { speed: 40 } }];

    it('prefers an explicit feet number stamped on the mover (token speedFeet / cs-row speed)', () => {
        expect(resolveSpeedFeet({ name: 'EvasiveFighter', speedFeet: 50 }, sheet)).toBe(50);
        expect(resolveSpeedFeet({ name: 'Wolf', speed: 40 }, [])).toBe(40);
    });

    it('resolves the sheet speed the header strip shows — computedStats.speed wins over authored speed', () => {
        expect(resolveSpeedFeet({ name: 'EvasiveFighter' }, sheet)).toBe(40);
        expect(resolveSpeedFeet(
            { name: 'PlainGuy' },
            [{ name: 'PlainGuy', computedStats: { speed: 35 }, speed: 30 }]
        )).toBe(35);
        expect(resolveSpeedFeet(
            { name: 'AuthoredOnly' },
            [{ name: 'AuthoredOnly', speed: 35 }]
        )).toBe(35);
    });

    it('falls back to the mover id when the token carries no name', () => {
        expect(resolveSpeedFeet({ id: 'EvasiveFighter' }, sheet)).toBe(40);
    });

    it('defaults honestly to 30 when nothing is known (junk values never grant budget)', () => {
        expect(resolveSpeedFeet({ name: 'Ghost' }, sheet)).toBe(DEFAULT_SPEED_FEET);
        expect(resolveSpeedFeet({ name: 'Wolf', speedFeet: 'not-a-number' }, [])).toBe(DEFAULT_SPEED_FEET);
        expect(resolveSpeedFeet({ name: 'Zero', computedStats: undefined }, [{ name: 'Zero', speed: 0 }])).toBe(DEFAULT_SPEED_FEET);
        expect(resolveSpeedFeet(undefined, undefined)).toBe(DEFAULT_SPEED_FEET);
    });
});

describe('monsterSpeedToFeet — bestiary walk speed → movement budget', () => {
    it('parses the monsters.json modes dict (walk is the budget mode)', () => {
        expect(monsterSpeedToFeet({ speed: { walk: '40 ft.' } })).toBe(40);
        expect(monsterSpeedToFeet({ speed: { fly: '60 ft.', walk: '40 ft.' } })).toBe(40);
    });

    it('falls back to other authored modes when no walk exists (fliers/burrowers stay honest)', () => {
        expect(monsterSpeedToFeet({ speed: { fly: '60 ft.', walk: '' } })).toBe(60);
        expect(monsterSpeedToFeet({ speed: { burrow: '15 ft.' } })).toBe(15);
    });

    it('accepts plain string and number shapes', () => {
        expect(monsterSpeedToFeet({ speed: '30 ft.' })).toBe(30);
        expect(monsterSpeedToFeet({ speed: 35 })).toBe(35);
    });

    it('returns null (never a fabricated 0 or 30) when the block authors no usable speed', () => {
        expect(monsterSpeedToFeet({ speed: {} })).toBeNull();
        expect(monsterSpeedToFeet({ speed: { walk: 'varies' } })).toBeNull();
        expect(monsterSpeedToFeet({})).toBeNull();
        expect(monsterSpeedToFeet(undefined)).toBeNull();
    });
});
