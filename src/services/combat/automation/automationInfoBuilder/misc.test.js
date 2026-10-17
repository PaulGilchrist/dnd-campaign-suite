// @maintained-by-ai
import { describe, it, expect } from 'vitest'
import { coreHandlers } from './core-handlers.js'
import { classFeatureHandlers } from './class-feature-handlers.js'
import { elementalHandlers } from './elemental-handlers.js'
import { utilityHandlers } from './utility-handlers.js'
import { miscHandlers } from './misc.js'

// misc.js is a pure aggregator:
//   miscHandlers = { ...coreHandlers, ...classFeatureHandlers, ...elementalHandlers, ...utilityHandlers }
// These tests pin THAT merge contract only. Unit-handler envelopes are pinned by each
// unit's own test file (core-handlers.test.js, class-feature-handlers.test.js,
// elemental-handlers.test.js, utility-handlers.test.js); the full facade delegation
// table is pinned by automationInfoBuilder.test.js. (Previous tests here re-pinned
// coreHandlers envelopes — removed as duplicates of core-handlers.test.js.)

// Spread order matters: a later map shadows an earlier one on key collision.
const SOURCE_MAPS = [
    ['coreHandlers', coreHandlers],
    ['classFeatureHandlers', classFeatureHandlers],
    ['elementalHandlers', elementalHandlers],
    ['utilityHandlers', utilityHandlers],
]

describe('miscHandlers – aggregation contract', () => {
    // Winner per key = last source map containing it (Object-spread semantics, same
    // first-insert position rule as Map.set).
    const winnerByKey = new Map()
    for (const [, map] of SOURCE_MAPS) {
        for (const key of Object.keys(map)) winnerByKey.set(key, map[key])
    }

    it('is exactly the union of the four unit maps — same keys, same order, same function references, nothing added', () => {
        expect(Object.keys(miscHandlers)).toEqual([...winnerByKey.keys()])
        for (const [key, winningFn] of winnerByKey) {
            expect(miscHandlers[key]).toBe(winningFn)
        }
    })

    it('has zero key collisions across the four unit maps (72 = 59+6+5+2)', () => {
        const allKeys = SOURCE_MAPS.flatMap(([, map]) => Object.keys(map))
        const uniqueKeys = new Set(allKeys)
        // Detector: if a future key lands in two unit maps this fails, forcing a deliberate
        // decision about the merge order above (later-map-wins) instead of a silent shadow.
        expect(allKeys.length).toBe(72)
        expect(uniqueKeys.size).toBe(72)
    })
})
