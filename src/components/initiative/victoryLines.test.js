// @maintained-by-ai 2026-11-14
// Number-agreement and line-presence coverage for buildVictoryLines (victory
// banner copy): singular/plural faces of every count-bearing line, the wipe
// vs. survived branch (including defeat-fled honesty: a wipe never claims
// anyone "drove off"), and the foes=0 / partySize=0 / missing-field defaults.

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

describe('buildVictoryLines', () => {
    it('foes line: singular at 1, plural otherwise, omitted entirely at 0', () => {
        expect(buildVictoryLines(stamp({ foes: 1, defeated: 1 })))
            .toContain('1 foe defeated')
        const lone = buildVictoryLines(stamp({ foes: 1, defeated: 1 }))
        expect(lone.some(l => l.includes('All'))).toBe(false)
        expect(lone).toContain('13 of 13 heroes standing')
        expect(buildVictoryLines(stamp({ foes: 2, defeated: 2 })))
            .toContain('All 2 foes defeated')
        expect(buildVictoryLines(stamp({ foes: 3, defeated: 3 })))
            .toContain('All 3 foes defeated')
        const noFoes = buildVictoryLines(stamp({ foes: 0, defeated: 0 }))
        expect(noFoes.some(l => l.includes('foe'))).toBe(false)
    })

    it('fled clause: agrees with the defeated count and defaults it to 0 when missing', () => {
        expect(buildVictoryLines(stamp({ foes: 2, defeated: 1 })))
            .toContain('1 foe defeated · 1 drove off')
        expect(buildVictoryLines(stamp({ foes: 5, defeated: 3 })))
            .toContain('3 foes defeated · 2 drove off')
        const noDefeated = { ...stamp({ foes: 2 }), defeated: undefined }
        expect(buildVictoryLines(noDefeated))
            .toContain('0 foes defeated · 2 drove off')
    })

    it('wipe with surviving foes: never claims "drove off", says "still standing" instead', () => {
        const tpk = buildVictoryLines(stamp({
            wipe: true, rounds: 4, foes: 3, defeated: 1, survivors: 0, partySize: 5,
        }))
        expect(tpk.some(l => l.includes('drove off'))).toBe(false)
        expect(tpk).toContain('1 foe defeated · 2 foes still standing')
        expect(tpk).toContain('The party fell after 4 rounds.')
        expect(tpk).toContain('0 of 5 heroes standing')
        // Singular surviving foe agrees via the same count helper.
        expect(buildVictoryLines(stamp({ wipe: true, foes: 2, defeated: 1, survivors: 0, partySize: 3 })))
            .toContain('1 foe defeated · 1 foe still standing')
        // Zero kills on the wipe still counts honestly: nothing defeated, all standing.
        expect(buildVictoryLines(stamp({ wipe: true, foes: 2, defeated: 0, survivors: 0, partySize: 3 })))
            .toContain('0 foes defeated · 2 foes still standing')
    })

    it('wipe with no surviving foes: mutual-kill defeated line stays honest and unchanged', () => {
        const mutual = buildVictoryLines(stamp({ wipe: true, foes: 2, defeated: 2, survivors: 0, partySize: 4 }))
        expect(mutual.some(l => l.includes('drove off'))).toBe(false)
        expect(mutual.some(l => l.includes('still standing'))).toBe(false)
        expect(mutual).toContain('All 2 foes defeated')
        expect(buildVictoryLines(stamp({ wipe: true, foes: 1, defeated: 1, survivors: 0, partySize: 4 })))
            .toContain('1 foe defeated')
    })

    it('victory branch regression: fled leg renders byte-unchanged while a wipe differs only in the leg', () => {
        expect(buildVictoryLines(stamp({ wipe: false, foes: 4, defeated: 1 })))
            .toEqual([
                'The party survived 1 round!',
                '1 foe defeated · 3 drove off',
                '13 of 13 heroes standing',
            ])
    })

    it('survived line: singular/plural rounds, defaulting missing rounds to 1', () => {
        expect(buildVictoryLines(stamp({ rounds: 1 })))
            .toContain('The party survived 1 round!')
        expect(buildVictoryLines(stamp({ rounds: 2 })))
            .toContain('The party survived 2 rounds!')
        expect(buildVictoryLines({ ...stamp(), rounds: undefined }))
            .toContain('The party survived 1 round!')
    })

    it('wipe line: singular/plural rounds and replaces the survived line', () => {
        const one = buildVictoryLines(stamp({ wipe: true, rounds: 1 }))
        expect(one).toContain('The party fell after 1 round.')
        expect(one.some(l => l.includes('survived'))).toBe(false)
        expect(buildVictoryLines(stamp({ wipe: true, rounds: 4 })))
            .toContain('The party fell after 4 rounds.')
    })

    it('heroes line: fixed "X of Y heroes standing" copy, omitted when partySize is 0', () => {
        expect(buildVictoryLines(stamp({ survivors: 1, partySize: 2 })))
            .toContain('1 of 2 heroes standing')
        const fallen = buildVictoryLines(stamp({ survivors: 0, partySize: 0 }))
        expect(fallen.some(l => l.includes('heroes'))).toBe(false)
    })
})
