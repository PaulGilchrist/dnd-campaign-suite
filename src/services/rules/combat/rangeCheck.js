import { getDistanceFeet } from './rangeValidation.js';

/**
 * Returns true if target is within range, or if distance/range can't be determined.
 * When in doubt, assume in range.
 */
export function isWithinRange(pos1, pos2, rangeFt) {
    if (rangeFt == null) return true;
    const dist = getDistanceFeet(pos1, pos2);
    return dist == null || dist <= rangeFt;
}

/**
 * Returns true if a pre-computed distance is within range, or if distance/range can't be determined.
 * When in doubt, assume in range.
 */
export function isDistanceInRange(dist, rangeFt) {
    if (rangeFt == null) return true;
    return dist == null || dist <= rangeFt;
}
