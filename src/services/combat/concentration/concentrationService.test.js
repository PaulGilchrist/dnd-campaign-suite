// @maintained-by-ai
//
// BASE CANONICAL lane — concentrationService orchestration (family map, all five lanes closed):
//  - concentrationRules.test.js ....................... pure dice math truth-tables (#991) — rules are MOCKED here,
//                                                       consumers-exact calls only (#872), never re-computed.
//  - cleanupConcentrationEffects.test.js .............. REST seam + cleanup filter semantics + filter defects
//                                                       :483/:213-217/:225-227/:450-451/:469 FIXED #990-fix + break-log emitter (#990).
//  - concentrationService.cla107-hex-purge.test.js .... hex purge trigger payload + log (#992).
//  - concentrationService.sp128-er-purge.test.js ...... Expeditious Retreat purge payload + ER wrong-spell leg (#993).
//  - THIS FILE ........................................ roll/save orchestration, break-generic, addConcentration
//                                                       add/track/replace, popup builder, removeTargetEffectsByEffect
//                                                       FACTORY machinery (source|caster channels, one-write guard,
//                                                       keyed-wrapper census), SPELL_RUNTIME_CLEANERS dispatch-table
//                                                       WIRING (map keying only — payload bytes belong to #990/#993).
//  Break canon user-trio #833-#835 owns the *moment* of break; expiry payload exactness is #951.
//
// Mock hygiene: service unmocked (#791); rules collaborators mocked with explicit consumer-exact defaults
// (#872/#940); faithful two-tier store so lane reads see prior writes (#934/#948); zero network — all
// logging/storage collaborators stubbed; campaign-pinned writes (#934); exact bytes (#829); turn-based, no
// wall-clock (#app); guards falsified by zero-match controls (#921); honest titles (#910).
//
// Old -> new map (22 -> 13):
//  roll combined-bonus / collaborator-args / displayRolls-fallback .... -> R1 (+allCreatures roster forwarding pin)
//  roll aura-zero detail / negative bonus ................................. -> R2
//  roll dragon char / dragon store-only / starry result-shape ........... -> R3 (it.each supply-source census;
//                                                                                       starryFormConstellation has no
//                                                                                       own test — store fallback lives here)
//  roll disadvantage args ................................................... -> R4 (+rawRolls-suppression pin)
//  break null+spell / non-mutation / rules-delegate ..................... -> B1
//  break not-found / no-concentration ..................................... -> B2 (+rules-not-called guard falsifier)
//  add trim+id / replace / property-preservation .......................... -> A1 (+id-uniqueness track pin)
//  add not-found .............................................................. -> A2
//  popup exact fields / rolls-wrap / floor-omit ........................... -> P1 (+toHaveProperty absence pin)
//  popup bonusDetail / failure / zero+neg bonus / raw display ........... -> P2
//  bane armed / bane no-match guard ....................................... -> F1 (factory leg; SP-014 caster
//                                                                                       channel + unarmed re-run guard)
//  bane/bless/ray armed trio + blade-ward delegate ........................ -> F2 (keyed-map it.each census — same
//                                                                                       factory, per-key dispatch only)
//  (NEW) dispatch-table wiring ............................................... -> D1 (registered 4-key census +
//                                                                                       unregistered-spell inertness)
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
    const stores = new Map()
    const doc = (storeKey) => {
        if (!stores.has(storeKey)) stores.set(storeKey, {})
        return stores.get(storeKey)
    }
    return { stores, doc, cs: null }
})

// Faithful two-tier store: reads see prior writes, so the te factory's read-filter-write loop is real.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((storeKey, key) => {
        const d = h.doc(storeKey)
        return key === '' ? { ...d } : (d[key] ?? null)
    }),
    setRuntimeValue: vi.fn((storeKey, key, value) => {
        if (key === '') h.stores.set(storeKey, { ...value })
        else h.doc(storeKey)[key] = value
    }),
    getAllStoreKeys: vi.fn(() => Object.keys(h.doc('campaign'))),
}))

// Rules collaborator: consumers-exact mocks — this lane pins HOW the service calls them, never the dice math (#991/#872).
vi.mock('./concentrationRules.js', () => ({
    rollConcentrationSave: vi.fn(() => ({ roll: 10, success: true })),
    breakConcentration: vi.fn(() => null),
    computeConcentrationDc: vi.fn(),
}))

vi.mock('../auras/auraOfProtection.js', () => ({ computeAuraBonus: vi.fn() }))
vi.mock('../conditions/conditionSaveService.js', () => ({ getCreatureSaveBonus: vi.fn() }))
vi.mock('../../encounters/combatData.js', () => ({ getCombatSummary: vi.fn(() => h.cs) }))

// Break-cleanup collaborators stubbed so the dispatch census runs byte-quiet and zero-network.
vi.mock('../../rules/effects/expirations.js', () => ({ clearExpirationEffects: vi.fn() }))
vi.mock('../../rules/features/heroismService.js', () => ({ removeHeroismBuff: vi.fn() }))
vi.mock('../summons/summonedCreatureService.js', () => ({ removeSummonedCreatures: vi.fn() }))
vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({ revertTruePolymorph: vi.fn() }))
vi.mock('../conditions/savePromptService.js', () => ({ clearFleshToStonePrompt: vi.fn() }))
vi.mock('../../encounters/combatLoggingService.js', () => ({ logConditionEvent: vi.fn() }))
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }))
vi.mock('../../ui/storage.js', () => ({ default: { set: vi.fn() } }))

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { rollConcentrationSave as rollConcentrationRules, breakConcentration as breakConcentrationRules } from './concentrationRules.js'
import { computeAuraBonus } from '../auras/auraOfProtection.js'
import { getCreatureSaveBonus } from '../conditions/conditionSaveService.js'
import {
    rollConcentrationSave as rollConcentrationSaveSvc,
    breakConcentration as breakConcentrationSvc,
    addConcentration,
    buildConcentrationPopup,
    clearBaneEffects,
    clearBladeWardEffects,
    clearBlessEffects,
    clearRayOfEnfeeblementEffects,
    cleanupConcentrationEffects,
} from './concentrationService.js'

const CAMPAIGN = 'test-campaign'
const DRAGON_BUFF = { name: 'Starry Form', constellation: 'Dragon' }

function createCharacter(name, opts = {}) {
    const { conBonus = 3, activeBuffs = [] } = opts
    return {
        name,
        computedStats: { abilities: [{ name: 'Constitution', bonus: conBonus }] },
        activeBuffs,
    }
}

function teWrites() {
    return vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects')
}

function callsFor(storeKey, key) {
    return vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === storeKey && c[1] === key)
}

beforeEach(() => {
    vi.clearAllMocks()
    h.stores.clear()
    h.cs = null
    // Explicit consumer defaults — every test states any deviation it cares about.
    rollConcentrationRules.mockReturnValue({ roll: 10, success: true })
    breakConcentrationRules.mockReturnValue(null)
    getCreatureSaveBonus.mockResolvedValue(0)
    computeAuraBonus.mockResolvedValue({ bonus: 0 })
})

describe('rollConcentrationSave — orchestration of rules collaborators', () => {
    it('forwards the full save context, combines save+aura into the rules call, and returns the exact roll result shape', async () => {
        h.cs = { round: 1, creatures: [{ name: 'Ghost' }] }
        rollConcentrationRules.mockReturnValue({ roll: 12, success: true })
        getCreatureSaveBonus.mockResolvedValue(3)
        computeAuraBonus.mockResolvedValue({ bonus: 2, sourceName: 'Paladin' })

        const creature = { name: 'Alice', type: 'player' }
        const characters = [createCharacter('Alice')]
        const getName = (n) => n

        const result = await rollConcentrationSaveSvc({
            creature, concentration: { spell: 'Bless', dc: 10 }, characters,
            campaignNpcs: [], campaignName: CAMPAIGN, mapName: 'DungeonMap', getName,
        })

        // Collaborators get the consumer-exact context, roster forwarded from the combat summary.
        expect(getCreatureSaveBonus).toHaveBeenCalledWith(creature, 'con', characters, [], getName)
        expect(computeAuraBonus).toHaveBeenCalledWith({
            targetName: 'Alice',
            characters,
            campaignName: CAMPAIGN,
            activeMapName: 'DungeonMap',
            allCreatures: [{ name: 'Ghost' }],
        })
        // Service's own arithmetic seam (saveBonus + auraBonus) lands on the rules call; rules math not re-run here.
        expect(rollConcentrationRules).toHaveBeenCalledWith(5, 10, false, false)
        expect(result).toEqual({
            roll: 12,
            success: true,
            bonus: 5,
            bonusDetail: '(+2 aura from Paladin)',
            starryDragonFloor: false,
            displayRolls: [12],
        })
    })

    it('bonusDetail shows only when the aura contributes, negative save bonuses ride the combined total', async () => {
        getCreatureSaveBonus.mockResolvedValue(-2)
        computeAuraBonus.mockResolvedValue({ bonus: 3, sourceName: 'Paladin' })

        const creature = { name: 'Alice', type: 'player' }
        const args = { creature, concentration: { spell: 'Shield', dc: 11 }, characters: [createCharacter('Alice')], campaignNpcs: [], campaignName: CAMPAIGN, mapName: null, getName: (n) => n }

        const negative = await rollConcentrationSaveSvc(args)
        expect(rollConcentrationRules).toHaveBeenCalledWith(1, 11, false, false)
        expect(negative.bonus).toBe(1)
        expect(negative.bonusDetail).toBe('(+3 aura from Paladin)')

        // Zero-aura leg: detail omitted entirely.
        getCreatureSaveBonus.mockResolvedValue(3)
        computeAuraBonus.mockResolvedValue({ bonus: 0 })
        const plain = await rollConcentrationSaveSvc(args)
        expect(plain.bonus).toBe(3)
        expect(plain.bonusDetail).toBeUndefined()
    })

    it.each([
        ['character activeBuffs', true],
        ['runtime store', false],
    ])('Dragon constellation supplied via %s floors the save at the rules call and echoes in the result', async (_label, onCharacter) => {
        const chars = [createCharacter('Alice', { activeBuffs: onCharacter ? [DRAGON_BUFF] : [] })]
        if (!onCharacter) h.doc('Alice').activeBuffs = [DRAGON_BUFF] // starryFormConstellation store fallback — no dedicated test family, pinned here
        rollConcentrationRules.mockReturnValue({ roll: 10, success: true, rawRolls: [4] })
        getCreatureSaveBonus.mockResolvedValue(3)

        const result = await rollConcentrationSaveSvc({
            creature: { name: 'Alice', type: 'player' }, concentration: { spell: 'Shield', dc: 13 },
            characters: chars, campaignNpcs: [], campaignName: CAMPAIGN, mapName: null, getName: (n) => n,
        })

        expect(rollConcentrationRules).toHaveBeenCalledWith(3, 13, true, false)
        expect(result.starryDragonFloor).toBe(true)
        expect(result.displayRolls).toEqual([4]) // raw pre-floor roll surfaces for display
    })

    it('disadvantage forwards to the rules call and suppresses raw-roll display', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 7, success: false, rawRolls: [7, 4] })
        getCreatureSaveBonus.mockResolvedValue(3)

        const result = await rollConcentrationSaveSvc({
            creature: { name: 'Wizard', type: 'player' }, concentration: { spell: 'Bless', dc: 10 },
            characters: [createCharacter('Wizard')], campaignNpcs: [], campaignName: CAMPAIGN, mapName: null, getName: (n) => n, disadvantage: true,
        })

        expect(rollConcentrationRules).toHaveBeenCalledWith(3, 10, false, true)
        expect(result.success).toBe(false)
        expect(result.displayRolls).toEqual([7]) // rawRolls ignored under disadvantage — effective roll only
    })
})

describe('breakConcentration — generic break', () => {
    it('breaks exactly the named creature via the rules delegate, returning its spell, others byte-identical', () => {
        const cs = { round: 1, creatures: [
            { name: 'Alice', type: 'player', concentration: { spell: 'Bless', dc: 10 } },
            { name: 'Bob', type: 'npc', concentration: { spell: 'Haste', dc: 13 } },
        ] }

        expect(breakConcentrationSvc(cs, 'Alice')).toBe('Bless')
        expect(breakConcentrationRules).toHaveBeenCalledTimes(1)
        expect(breakConcentrationRules).toHaveBeenCalledWith({ spell: 'Bless', dc: 10 })
        expect(cs.creatures[0].concentration).toBeNull() // delegate's null return assigned
        expect(cs.creatures[1].concentration).toEqual({ spell: 'Haste', dc: 13 })
    })

    it('unknown creature or absent concentration returns null without touching the rules delegate', () => {
        expect(breakConcentrationSvc({ round: 1, creatures: [] }, 'NonExistent')).toBeNull()
        expect(breakConcentrationSvc({ round: 1, creatures: [{ name: 'Alice', type: 'player' }] }, 'Alice')).toBeNull()
        expect(breakConcentrationSvc({ round: 1, creatures: [{ name: 'Alice', type: 'player', concentration: null }] }, 'Alice')).toBeNull()
        // Guard falsifier (#921): dropping the concentration guard would call rules with undefined here.
        expect(breakConcentrationRules).not.toHaveBeenCalled()
    })
})

describe('addConcentration — track/start', () => {
    it('tracks a trimmed spell with a unique id, replacing any prior concentration without disturbing the creature', () => {
        const cs = { round: 1, creatures: [{ name: 'Alice', type: 'player', concentration: null, hp: 25, maxHp: 30 }] }

        addConcentration(cs, 'Alice', '  Bless  ', 10)
        const first = cs.creatures[0].concentration
        expect(first).toEqual({ id: expect.any(String), spell: 'Bless', dc: 10, target: null })
        expect(cs.creatures[0].hp).toBe(25)
        expect(cs.creatures[0].maxHp).toBe(30)

        addConcentration(cs, 'Alice', 'Haste', 13)
        expect(cs.creatures[0].concentration.spell).toBe('Haste')
        expect(cs.creatures[0].concentration.dc).toBe(13)
        expect(cs.creatures[0].concentration.id).not.toBe(first.id) // fresh tracking id per start
    })

    it('adding to an unknown creature is a silent no-op', () => {
        const cs = { round: 1, creatures: [] }
        expect(addConcentration(cs, 'NonExistent', 'Bless', 10)).toBeUndefined()
        expect(cs.creatures).toEqual([])
    })
})

describe('buildConcentrationPopup — popup payload', () => {
    it('builds the exact d20 condition-save popup shape, wrapping the roll and omitting the Dragon floor key when inactive', () => {
        const popup = buildConcentrationPopup({ roll: 12, bonus: 5, bonusDetail: undefined, spellName: 'Bless', dc: 10, success: true })

        expect(popup).toEqual({
            type: 'd20',
            rollType: 'condition-save',
            name: 'Concentration',
            rolls: [12],
            bonus: 5,
            bonusDetail: undefined,
            condition: 'Bless',
            dc: 10,
            success: true,
            targetName: null,
            targetAc: null,
            hit: undefined,
        })
        expect(popup).not.toHaveProperty('starryDragonFloor')
    })

    it('layers raw display rolls, Dragon floor, bonusDetail, failure and zero/negative bonus onto the payload', () => {
        const floor = buildConcentrationPopup({ roll: 10, bonus: 0, bonusDetail: '+3 aura from Paladin', spellName: 'Bless', dc: 13, success: true, starryDragonFloor: true, displayRolls: [4] })
        expect(floor.rolls).toEqual([4])
        expect(floor.starryDragonFloor).toBe(true)
        expect(floor.bonusDetail).toBe('+3 aura from Paladin')
        expect(floor.bonus).toBe(0)

        const failed = buildConcentrationPopup({ roll: 5, bonus: -2, spellName: 'Armor', dc: 14, success: false })
        expect(failed.success).toBe(false)
        expect(failed.bonus).toBe(-2)
        expect(failed.rolls).toEqual([5])
        expect(failed).not.toHaveProperty('starryDragonFloor')
    })
})

describe('removeTargetEffectsByEffect — te factory machinery', () => {
    it('factory leg drains the caster-keyed tes across source AND caster channels with one campaign-pinned write, then writes nothing when re-run unarmed', () => {
        const OWN_SRC = { effect: 'bane_penalty', source: 'Alice', target: 'Bob' }
        const OWN_CHANNEL = { effect: 'bane_penalty', caster: 'Alice', target: 'Eve' } // SP-014: producer stamps te.caster
        const OWN_KEY_OTHER = { effect: 'bane_penalty', source: 'Charlie' }
        const OWN_CASTER_OTHER_KEY = { effect: 'bless_bonus', source: 'Alice' }
        const FOREIGN = { effect: 'faerie_fire', source: 'Dan' }
        h.doc('campaign').targetEffects = [OWN_SRC, OWN_CHANNEL, OWN_KEY_OTHER, OWN_CASTER_OTHER_KEY, FOREIGN]

        clearBaneEffects(CAMPAIGN, 'Alice')

        expect(teWrites()).toEqual([['campaign', 'targetEffects', [OWN_KEY_OTHER, OWN_CASTER_OTHER_KEY, FOREIGN], CAMPAIGN, true]])
        expect(h.doc('campaign').targetEffects).toEqual([OWN_KEY_OTHER, OWN_CASTER_OTHER_KEY, FOREIGN])

        // Unarmed re-run (#921): no remaining match ⇒ zero additional writes.
        vi.mocked(setRuntimeValue).mockClear()
        clearBaneEffects(CAMPAIGN, 'Alice')
        expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it.each([
        ['clearBaneEffects', 'bane_penalty'],
        ['clearBladeWardEffects', 'bane_penalty'], // Blade Ward alias — same key as bane by design
        ['clearBlessEffects', 'bless_bonus'],
        ['clearRayOfEnfeeblementEffects', 'ray_of_enfeeble_debuff'],
    ])('%s drains exactly its own effect key for the caster', (fnName, key) => {
        const ALL_KEYS = ['bane_penalty', 'bless_bonus', 'ray_of_enfeeble_debuff']
        const seed = ALL_KEYS.flatMap(k => [
            { effect: k, source: 'Alice', target: 'Bob' },
            { effect: k, source: 'Charlie' },
        ])
        seed.push({ effect: 'holy_aura', source: 'Alice' })
        h.doc('campaign').targetEffects = seed
        const clear = { clearBaneEffects, clearBladeWardEffects, clearBlessEffects, clearRayOfEnfeeblementEffects }[fnName]

        clear(CAMPAIGN, 'Alice')

        const survivors = seed.filter(te => !(te.effect === key && te.source === 'Alice'))
        expect(teWrites()).toEqual([['campaign', 'targetEffects', survivors, CAMPAIGN, true]])
    })
})

describe('SPELL_RUNTIME_CLEANERS — dispatch-table wiring', () => {
    // Map wiring/order only — purge payload depth is owned by #990 (chosen-damage) and #993 (ER).
    const DISPATCH = [
        ['Resistance', 'resistanceChosenDamageType', 'fire'],
        ['Protection from Energy', 'protectionFromEnergyDamageType', 'cold'],
        ['Stone Skin', 'stoneSkinDamageTypes', ['bludgeoning']],
        ['Expeditious Retreat', 'expeditiousRetreatActive', true],
    ]
    const MARKERS = Object.fromEntries(DISPATCH.map(([, key, marker]) => [key, marker]))

    it('every registered spell name dispatches exactly its own cleaner key; an unregistered spell dispatches none of them', async () => {
        h.cs = { round: 1, creatures: [{ name: 'Bob' }] }

        // Unregistered spell: the whole table stays inert (registration guard, #921).
        Object.assign(h.doc('Bob'), MARKERS)
        await cleanupConcentrationEffects('Alice', 'Fireball', CAMPAIGN)
        expect(h.doc('Bob')).toEqual(MARKERS)
        expect(callsFor('Bob', 'resistanceChosenDamageType')).toHaveLength(0)
        expect(callsFor('Bob', 'protectionFromEnergyDamageType')).toHaveLength(0)
        expect(callsFor('Bob', 'stoneSkinDamageTypes')).toHaveLength(0)
        expect(callsFor('Bob', 'expeditiousRetreatActive')).toHaveLength(0)

        // Registered key-by-key: each spell fires ONLY its own marker (cross-key falsifiers stay byte-intact).
        for (const [spellName, key] of DISPATCH) {
            h.stores.clear()
            h.doc('campaign').targetEffects = []
            Object.assign(h.doc('Bob'), MARKERS)
            vi.mocked(setRuntimeValue).mockClear()

            await cleanupConcentrationEffects('Alice', spellName, CAMPAIGN)

            expect(h.doc('Bob')[key]).toBe(null) // marker nulled — payload depth owned by #990/#993
            const otherKeys = Object.keys(MARKERS).filter(k => k !== key)
            expect(otherKeys.every(k => h.doc('Bob')[k] === MARKERS[k])).toBe(true)
            const cleanerWrites = otherKeys.reduce((n, k) => n + callsFor('Bob', k).length, 0)
            expect(cleanerWrites).toBe(0) // exactly one cleaner fired — no cross-dispatch
        }
    })
})
