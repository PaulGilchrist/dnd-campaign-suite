// @maintained-by-ai 2026-11-26 — deterministic: all dependencies mocked at module boundaries (bare vi.fn()
// factories — default impls installed in beforeEach, never factory-baked),
// full-shape result/log pins for this handler's own composition, exact-string
// popup pins, no timers/DOM; no churn required when the app changes.
// CLA-381: War Magic cantrip half live-resolves (latch gate, chooser filter,
// attack/save resolution, damage apply, zero slot spend). The spell lane
// (slot payment, weapon-attack rider) is owned by the warMagicSpellHandler twin.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, confirmWarMagicCantrip } from './warMagicCantripHandler.js'

vi.mock('../../../ui/dataLoader.js', () => ({
    loadSpellData: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(),
}))

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}))

vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}))

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}))

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}))

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}))

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}))

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(),
}))

vi.mock('../../common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
    buildSaveDc: vi.fn(),
}))

vi.mock('../../../rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}))

const mockCampaignName = 'test-campaign'

const fireBolt = {
    name: 'Fire Bolt',
    level: 0,
    casting_time: 'Action',
    range: '120 feet',
    description: 'A mote of fire.',
    attack_type: 'ranged',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 0: '1d10', 5: '2d10', 11: '3d10', 17: '4d10' } },
    dc: null,
}

const rayOfFrost = {
    name: 'Ray of Frost',
    level: 0,
    casting_time: 'Action',
    range: '120 feet',
    description: 'A freezing beam.',
    attack_type: 'ranged',
    damage: { damage_type: 'Cold', damage_at_slot_level: { 0: '1d8', 11: '2d8', 17: '3d8' } },
    dc: null,
}

const sacredFlame = {
    name: 'Sacred Flame',
    level: 0,
    casting_time: 'Action',
    range: '60 feet',
    description: 'Radiant flame.',
    damage: { damage_type: 'Radiant', damage_at_slot_level: { 0: '1d8', 17: '4d8' } },
    dc: { dc_type: 'DEX', dc_success: 'half' },
}

const acidSplash = {
    name: 'Acid Splash',
    level: 0,
    casting_time: 'Action',
    range: '60 feet',
    description: 'Bead of acid.',
    damage: { damage_type: 'Acid', damage_at_slot_level: { 0: '1d6', 17: '3d6' } },
    dc: { dc_type: 'DEX', dc_success: 'half' },
}

const combatSummary = {
    round: 1,
    creatures: [
        { name: 'TestFighter', type: 'player', targetName: 'Wight 1' },
        { name: 'Wight 1', type: 'npc', ac: 11, currentHp: 32 },
    ],
}

function makeAction(overrides = {}) {
    return {
        name: 'War Magic',
        automation: { type: 'war_magic_cantrip', spellList: 'wizard_cantrips' },
        ...overrides,
    }
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestFighter',
        rules: '2024',
        level: 18,
        spells: ['Fire Bolt', 'Ray of Frost'],
        spellAbilities: { toHit: 10 },
        ...overrides,
    }
}

async function mods() {
    return {
        loadSpellData: (await import('../../../ui/dataLoader.js')).loadSpellData,
        addEntry: (await import('../../../ui/logService.js')).addEntry,
        rollD20: (await import('../../../dice/diceRoller.js')).rollD20,
        rollExpression: (await import('../../../dice/diceRoller.js')).rollExpression,
        getRuntimeValue: (await import('../../../../hooks/runtime/useRuntimeState.js')).getRuntimeValue,
        setRuntimeValue: (await import('../../../../hooks/runtime/useRuntimeState.js')).setRuntimeValue,
        getCombatSummary: (await import('../../../encounters/combatData.js')).getCombatSummary,
        getCombatContext: (await import('../../../rules/combat/damageUtils.js')).getCombatContext,
        getTargetFromAttacker: (await import('../../../rules/combat/damageUtils.js')).getTargetFromAttacker,
        applyDamageToTarget: (await import('../../../rules/combat/applyDamage.js')).applyDamageToTarget,
        isWithinRange: (await import('../../../rules/combat/rangeCheck.js')).isWithinRange,
        createSaveListener: (await import('../../common/savePrompt.js')).createSaveListener,
        endInvisibilityOnHostileAction: (await import('../../../rules/features/invisibilityService.js')).endInvisibilityOnHostileAction,
    }
}

const logEntries = addEntryMock => addEntryMock.mock.calls.map(c => c[1])

const sawRefusal = addEntryMock =>
    logEntries(addEntryMock).some(e => e.automationType === 'war_magic_refused')

async function setupConfirmMocks({ latchRound = 0, target = { name: 'Wight 1' }, inRange = true, spells = [fireBolt, rayOfFrost] } = {}) {
    const m = await mods()
    m.loadSpellData.mockResolvedValue(spells)
    m.getCombatContext.mockResolvedValue({ round: 1 })
    m.getCombatSummary.mockReturnValue(combatSummary)
    m.getTargetFromAttacker.mockReturnValue(target)
    m.isWithinRange.mockResolvedValue(inRange)
    m.getRuntimeValue.mockImplementation((_key, subKey) => {
        if (subKey === '_War_Magic_usedRound') return latchRound
        if (subKey === 'characters') return []
        return null
    })
    m.rollD20.mockReturnValue(15)
    m.rollExpression.mockImplementation(() => ({ total: 22, rolls: [6, 6, 5, 5], modifier: 0 }))
    m.applyDamageToTarget.mockImplementation((_cs, _t, raw) => ({ finalDamage: raw }))
}

describe('warMagicCantripHandler', () => {
    beforeEach(async () => {
        vi.resetAllMocks()
        const m = await mods()
        m.addEntry.mockResolvedValue(undefined)
        m.setRuntimeValue.mockResolvedValue(undefined)
        m.getCombatContext.mockResolvedValue({ round: 1 })
        m.isWithinRange.mockResolvedValue(true)
        m.getRuntimeValue.mockReturnValue(null)
    })

    describe('handle (chooser)', () => {
        it('opens the chooser with a full-shape payload offering only known, level-0, action-casting cantrips', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const m = await mods()
            m.loadSpellData.mockResolvedValue([
                fireBolt,
                rayOfFrost,
                { name: 'Old Bolt', level: 0, casting_time: '1 action' }, // 5e token; missing fields default
                acidSplash,                                                // known-list miss
                { name: 'Burning Hands', level: 1, casting_time: 'Action' },
                { name: 'Teleportation Step', level: 0, casting_time: 'Bonus Action' },
                { name: 'Ghost Bolt', level: 0 },                           // malformed: no casting_time
            ])
            const playerStats = makePlayerStats({
                spells: ['Fire Bolt', 'Ray of Frost', 'Old Bolt', 'Burning Hands', 'Teleportation Step', 'Ghost Bolt'],
            })
            const action = makeAction()

            const result = await handle(action, playerStats, mockCampaignName)

            expect(result).toEqual({
                type: 'modal',
                modalName: 'warMagicCantrip',
                payload: {
                    action,
                    playerStats,
                    campaignName: mockCampaignName,
                    options: ['Fire Bolt', 'Ray of Frost', 'Old Bolt'],
                    optionDetails: {
                        'Fire Bolt': {
                            name: 'Fire Bolt', level: 0, casting_time: 'Action',
                            range: '120 feet', description: 'A mote of fire.', damage: fireBolt.damage,
                        },
                        'Ray of Frost': {
                            name: 'Ray of Frost', level: 0, casting_time: 'Action',
                            range: '120 feet', description: 'A freezing beam.', damage: rayOfFrost.damage,
                        },
                        'Old Bolt': {
                            name: 'Old Bolt', level: 0, casting_time: '1 action',
                            range: '', description: '', damage: null,
                        },
                    },
                    spellListKey: 'wizard_cantrips',
                },
            })
            // malformed row excluded LOUDLY (no-fallbacks law), not silently offered
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('Ghost Bolt'))
            spy.mockRestore()
        })

        it('accepts playerStats.spells entries as objects with names', async () => {
            const m = await mods()
            m.loadSpellData.mockResolvedValue([fireBolt, acidSplash])

            const result = await handle(makeAction(), makePlayerStats({ spells: [{ name: 'Fire Bolt', prepared: 'Always' }] }), mockCampaignName)

            expect(result.payload.options).toEqual(['Fire Bolt'])
        })

        it('uses custom spellListKey from automation when specified', async () => {
            const m = await mods()
            m.loadSpellData.mockResolvedValue([fireBolt])

            const result = await handle(
                makeAction({ automation: { type: 'war_magic_cantrip', spellList: 'sorcerer_cantrips' } }),
                makePlayerStats({ spells: ['Fire Bolt'] }),
                mockCampaignName
            )

            expect(result.payload.spellListKey).toBe('sorcerer_cantrips')
        })

        it('refuses with a full-shape logged popup when no known cantrips qualify', async () => {
            const m = await mods()
            m.loadSpellData.mockResolvedValue([acidSplash])
            const action = makeAction()

            const result = await handle(action, makePlayerStats({ spells: [] }), mockCampaignName)

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Magic',
                    description: 'War Magic — No known Wizard cantrips available.',
                    automation: action.automation,
                },
            })
            expect(logEntries(m.addEntry).find(e => e.automationType === 'war_magic_refused')).toEqual({
                type: 'automation',
                characterName: 'TestFighter',
                automationType: 'war_magic_refused',
                name: 'War Magic',
                description: 'War Magic: No known Wizard cantrips available.',
                timestamp: expect.any(Number),
            })
        })

        it('refuses the row click once the latch is stamped this round, before touching spell data', async () => {
            const m = await mods()
            m.getRuntimeValue.mockImplementation((_key, subKey) => (subKey === '_War_Magic_usedRound' ? 1 : null))

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            expect(result.type).toBe('popup')
            expect(result.payload.description).toBe('War Magic — Once per turn — attack already replaced with a cantrip this turn.')
            expect(sawRefusal(m.addEntry)).toBe(true)
            // CLA-381 gate runs before the chooser loads its spell list
            expect(m.loadSpellData.mock.calls).toEqual([])
        })
    })

    describe('confirmWarMagicCantrip', () => {
        it.each([
            [null, 'No cantrip selected.'],
            [undefined, 'No cantrip selected.'],
            ['', 'No cantrip selected.'],
            ['Unknown Cantrip', 'Cantrip "Unknown Cantrip" not found.'],
        ])('refuses selection %s with %j and writes nothing', async (selection, description) => {
            await setupConfirmMocks()
            const m = await mods()

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, selection)

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'War Magic', description },
            })
            expect(m.addEntry.mock.calls).toEqual([])
            expect(m.setRuntimeValue.mock.calls).toEqual([])
            expect(m.applyDamageToTarget.mock.calls).toEqual([])
        })

        it.each([
            {
                label: 'a cantrip that is not prepared',
                setup: { spells: [acidSplash] },
                known: [],
                spellName: 'Acid Splash',
                description: 'War Magic — Acid Splash is not a cantrip you have prepared.',
            },
            {
                label: 'a second use in the same round',
                setup: { latchRound: 1 },
                known: ['Fire Bolt'],
                spellName: 'Fire Bolt',
                description: 'War Magic — Once per turn — attack already replaced with a cantrip this turn.',
            },
            {
                label: 'no target armed on the initiative card',
                setup: { target: null },
                known: ['Fire Bolt'],
                spellName: 'Fire Bolt',
                description: 'War Magic — requires a target — set the Target dropdown on your initiative card first.',
            },
            {
                label: 'an armed target out of range',
                setup: { inRange: false },
                known: ['Fire Bolt'],
                spellName: 'Fire Bolt',
                description: 'War Magic — Wight 1 is out of range for Fire Bolt (120 feet).',
            },
            {
                label: 'a non-action cantrip (defense-in-depth, before the latch)',
                setup: { spells: [{ ...fireBolt, name: 'Teleportation Step', casting_time: 'Bonus Action' }] },
                known: ['Teleportation Step'],
                spellName: 'Teleportation Step',
                description: 'War Magic — Teleportation Step casts as Bonus Action — War Magic replaces the Attack action, so only action-casting cantrips qualify.',
            },
        ])('refuses $label with a logged refusal and zero spend', async ({ setup, known, spellName, description }) => {
            await setupConfirmMocks(setup)
            const m = await mods()

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats({ spells: known }), mockCampaignName, spellName)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toBe(description)
            expect(sawRefusal(m.addEntry)).toBe(true)
            expect(m.setRuntimeValue.mock.calls).toEqual([])
            expect(m.applyDamageToTarget.mock.calls).toEqual([])
        })

        it('resolves a spell-attack cantrip end-to-end with full-shape logs and popup', async () => {
            await setupConfirmMocks()
            const m = await mods()
            const action = makeAction()

            const result = await confirmWarMagicCantrip(action, makePlayerStats(), mockCampaignName, 'Fire Bolt')

            // d20(15)+10=25 vs AC 11 → hit; die scales at lv18 → 4d10 (real resolveSpellDamageAtLevel)
            expect(m.rollExpression).toHaveBeenCalledWith('4d10')
            expect(m.applyDamageToTarget).toHaveBeenCalledWith(combatSummary, 'Wight 1', 22, ['Fire'], { campaignName: mockCampaignName, characters: [], ignoreResistance: false, attackerName: 'TestFighter' })
            expect(m.endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestFighter', mockCampaignName)
            expect(logEntries(m.addEntry).find(e => e.rollType === 'attack')).toEqual({
                type: 'roll',
                characterName: 'TestFighter',
                rollType: 'attack',
                name: 'Fire Bolt (Wight 1)',
                rolls: [15],
                total: 25,
                bonus: 10,
                isNatural20: false,
                isNatural1: false,
                targetName: 'Wight 1',
                targetAc: 11,
                damageType: 'Fire',
                hit: true,
                timestamp: expect.any(Number),
            })
            expect(logEntries(m.addEntry).find(e => e.rollType === 'damage')).toEqual({
                type: 'roll',
                characterName: 'TestFighter',
                rollType: 'damage',
                name: 'Fire Bolt (Wight 1)',
                formula: '4d10',
                rolls: [6, 6, 5, 5],
                total: 22,
                damageType: 'Fire',
                targetName: 'Wight 1',
                finalDamage: 22,
                timestamp: expect.any(Number),
            })
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Magic',
                    automationType: 'war_magic_cantrip',
                    description: '<b>War Magic</b>: Cast <b>Fire Bolt</b> at <b>Wight 1</b>. 15 + 10 = 25 vs AC 11 — HIT. Dealt <b>22</b> Fire damage.<br/>No spell slot consumed (cantrip).',
                    automation: action.automation,
                },
            })
        })

        it.each([
            [1, '1d10'],
            [5, '2d10'],
            [11, '3d10'],
        ])('scales the Fire Bolt die at level %i to %s', async (level, formula) => {
            await setupConfirmMocks()
            const m = await mods()

            await confirmWarMagicCantrip(makeAction(), makePlayerStats({ level }), mockCampaignName, 'Fire Bolt')

            expect(m.rollExpression).toHaveBeenCalledWith(formula)
        })

        it('logs a natural-1 miss and rolls or deals nothing', async () => {
            await setupConfirmMocks()
            const m = await mods()
            m.rollD20.mockReturnValue(1)

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Fire Bolt')

            expect(result.payload.description).toBe('<b>War Magic</b>: Cast <b>Fire Bolt</b> at <b>Wight 1</b>. 1 + 10 = 11 vs AC 11 — MISS. No damage dealt.<br/>No spell slot consumed (cantrip).')
            const attackLog = logEntries(m.addEntry).find(e => e.rollType === 'attack')
            expect(attackLog.hit).toBe(false)
            expect(attackLog.isNatural1).toBe(true)
            expect(m.rollExpression.mock.calls).toEqual([])
            expect(m.applyDamageToTarget.mock.calls).toEqual([])
            expect(m.endInvisibilityOnHostileAction.mock.calls).toEqual([])
        })

        it('commits the latch before resolution and logs ability_use with no slot spend', async () => {
            await setupConfirmMocks()
            const m = await mods()
            const order = []
            m.setRuntimeValue.mockImplementation(async (_name, subKey) => {
                if (subKey === '_War_Magic_usedRound') order.push('latch')
            })
            m.applyDamageToTarget.mockImplementation(async (_cs, _t, raw) => {
                order.push('apply')
                return { finalDamage: raw }
            })

            await confirmWarMagicCantrip(makeAction({ name: 'Improved War Magic' }), makePlayerStats(), mockCampaignName, 'Fire Bolt')

            // CLA-371 lesson: awaited latch stamp at the TRIGGER precedes resolution
            expect(order).toEqual(['latch', 'apply'])
            expect(m.addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Improved War Magic',
                description: 'Improved War Magic: Replaced attack with cantrip "Fire Bolt"',
            })
            expect(m.setRuntimeValue.mock.calls.some(c => String(c[1]).startsWith('spell_slots_level_'))).toBe(false)
        })

        it.each([
            {
                label: 'a successful save rolls no damage',
                promise: () => Promise.resolve({ success: true }),
                description: '<b>War Magic</b>: Cast <b>Sacred Flame</b> at <b>Wight 1</b>. Wight 1 saved — no damage. No damage dealt.<br/>No spell slot consumed (cantrip).',
                expectedRolls: [],
                expectedApplyCalls: [],
                expectedInvisibility: 0,
            },
            {
                label: 'a failed half save applies halved damage',
                promise: () => Promise.resolve({ success: false }),
                description: '<b>War Magic</b>: Cast <b>Sacred Flame</b> at <b>Wight 1</b>. Wight 1 failed the save. Dealt <b>11</b> Radiant damage.<br/>No spell slot consumed (cantrip).',
                // lv18 → 4d8; mocked total 22 → floor-half 11
                expectedRolls: [['4d8']],
                expectedApplyCalls: [[combatSummary, 'Wight 1', 11, ['Radiant'], { campaignName: mockCampaignName, characters: [], ignoreResistance: false, attackerName: 'TestFighter' }]],
                expectedInvisibility: 1,
            },
            {
                label: 'a dismissed prompt deals nothing but stays spent',
                promise: () => Promise.reject(new Error('dismissed')),
                description: '<b>War Magic</b>: Cast <b>Sacred Flame</b> at <b>Wight 1</b>. Save prompt dismissed. No damage dealt.<br/>No spell slot consumed (cantrip).',
                expectedRolls: [],
                expectedApplyCalls: [],
                expectedInvisibility: 0,
            },
        ])('runs the save lane for save cantrips: $label', async ({ promise, description, expectedRolls, expectedApplyCalls, expectedInvisibility }) => {
            await setupConfirmMocks({ spells: [sacredFlame] })
            const m = await mods()
            m.createSaveListener.mockReturnValue({ promptId: 'p', promise: promise() })

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats({ spells: ['Sacred Flame'] }), mockCampaignName, 'Sacred Flame')

            expect(result.payload.description).toBe(description)
            expect(m.rollExpression.mock.calls).toEqual(expectedRolls)
            expect(m.applyDamageToTarget.mock.calls).toEqual(expectedApplyCalls)
            expect(m.endInvisibilityOnHostileAction.mock.calls.length).toBe(expectedInvisibility)
        })

        it('arms the save prompt with full DC context and never rolls an attack for a save cantrip', async () => {
            await setupConfirmMocks({ spells: [sacredFlame] })
            const m = await mods()
            m.createSaveListener.mockReturnValue({ promptId: 'p', promise: Promise.resolve({ success: true }) })

            await confirmWarMagicCantrip(makeAction(), makePlayerStats({ spells: ['Sacred Flame'] }), mockCampaignName, 'Sacred Flame')

            expect(m.createSaveListener).toHaveBeenCalledTimes(1)
            // saveDc falls back to 8 + proficiency (unset here → 8)
            expect(m.createSaveListener).toHaveBeenCalledWith(mockCampaignName, {
                targetName: 'Wight 1',
                attackerName: 'TestFighter',
                saveType: 'DEX',
                saveDc: 8,
                sourceName: 'War Magic — Sacred Flame',
            })
            expect(logEntries(m.addEntry).some(e => e.rollType === 'attack')).toBe(false)
        })

        it('does not throw when addEntry rejects', async () => {
            await setupConfirmMocks()
            const m = await mods()
            m.addEntry.mockRejectedValue(new Error('log failed'))

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Fire Bolt')

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
        })
    })
})
