// Number-agreement coverage for buildVictoryLines (victory banner copy).
// Singular AND plural faces of every count-bearing line: rounds (wipe +
// survived), full-kill foes line, partial-kill/fled clause, heroes line.

import { describe, it, expect } from 'vitest'
import { buildVictoryLines } from './victoryLines.js'

const stamp = (overrides) => ({
    stamp: 1,
    rounds: 1,
    foes: 1,
    defeated: 1,
    survivors: 13,
    partySize: 13,
    wipe: false,
    ...overrides,
})

describe('buildVictoryLines number agreement', () => {
    it('uses singular "foe" when exactly 1 foe (all defeated)', () => {
        const lines = buildVictoryLines(stamp({ foes: 1, defeated: 1 }))
        expect(lines).toContain('All 1 foe defeated')
        expect(lines.join('\n')).not.toContain('foes defeated')
    })

    it('keeps plural "foes" for counts other than 1 (byte-identical copy)', () => {
        expect(buildVictoryLines(stamp({ foes: 2, defeated: 2 })))
            .toContain('All 2 foes defeated')
        expect(buildVictoryLines(stamp({ foes: 3, defeated: 3 })))
            .toContain('All 3 foes defeated')
    })

    it('omits the foes line entirely when there were no foes', () => {
        const lines = buildVictoryLines(stamp({ foes: 0, defeated: 0 }))
        expect(lines.some(l => l.includes('foe'))).toBe(false)
    })

    it('applies singular agreement to the defeated count in the fled clause', () => {
        const lines = buildVictoryLines(stamp({ foes: 2, defeated: 1 }))
        expect(lines).toContain('1 foe defeated · 1 drove off')
    })

    it('keeps plural and byte-identical fled clause for counts other than 1', () => {
        expect(buildVictoryLines(stamp({ foes: 5, defeated: 3 })))
            .toContain('3 foes defeated · 2 drove off')
        expect(buildVictoryLines(stamp({ foes: 4, defeated: 0 })))
            .toContain('0 foes defeated · 4 drove off')
    })

    it('survived-rounds line agrees singular and plural (regression)', () => {
        expect(buildVictoryLines(stamp({ rounds: 1 })))
            .toContain('The party survived 1 round!')
        expect(buildVictoryLines(stamp({ rounds: 2 })))
            .toContain('The party survived 2 rounds!')
    })

    it('wipe line agrees singular and plural (regression)', () => {
        expect(buildVictoryLines(stamp({ wipe: true, rounds: 1, foes: 0 })))
            .toContain('The party fell after 1 round.')
        expect(buildVictoryLines(stamp({ wipe: true, rounds: 4, foes: 0 })))
            .toContain('The party fell after 4 rounds.')
    })

    it('defaults missing rounds to 1 with singular wording', () => {
        const noRounds = { stamp: 1, foes: 0, defeated: 0, survivors: 13, partySize: 13, wipe: false }
        expect(buildVictoryLines(noRounds)).toContain('The party survived 1 round!')
    })

    it('keeps the heroes line copy unchanged (regression)', () => {
        expect(buildVictoryLines(stamp({ survivors: 13, partySize: 13 })))
            .toContain('13 of 13 heroes standing')
        expect(buildVictoryLines(stamp({ survivors: 1, partySize: 2 })))
            .toContain('1 of 2 heroes standing')
    })
})
