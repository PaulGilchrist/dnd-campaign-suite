// CLA-381: War Magic cantrip half now live-resolves (mirrors the verified
// warMagicSpellHandler.confirmWarMagicSpell template) — the old tests asserted
// the popup+log stub shape and have been rewritten against the real flow.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, confirmWarMagicCantrip } from './warMagicCantripHandler.js'

vi.mock('../../../ui/dataLoader.js', () => ({
    loadSpellData: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}))

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}))

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}))

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ round: 1 })),
    getTargetFromAttacker: vi.fn(),
}))

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}))

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
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

async function setupConfirmMocks({ latchRound = 0, target = { name: 'Wight 1' }, inRange = true, spells = [fireBolt, rayOfFrost] } = {}) {
    const m = await mods()
    m.loadSpellData.mockResolvedValue(spells)
    m.getCombatContext.mockResolvedValue({ round: 1 })
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
    }
}

describe('warMagicCantripHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handle', () => {
        it('returns a modal listing ONLY the caster-known cantrips', async () => {
            const { loadSpellData } = await mods()
            loadSpellData.mockResolvedValue([fireBolt, rayOfFrost, acidSplash, { name: 'Burning Hands', level: 1 }])

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            expect(result.type).toBe('modal')
            expect(result.modalName).toBe('warMagicCantrip')
            expect(result.payload.options).toEqual(['Fire Bolt', 'Ray of Frost'])
            expect(result.payload.spellListKey).toBe('wizard_cantrips')
            expect(result.payload.campaignName).toBe(mockCampaignName)
        })

        it('includes all spell detail fields in optionDetails', async () => {
            const { loadSpellData } = await mods()
            loadSpellData.mockResolvedValue([fireBolt])

            const result = await handle(makeAction(), makePlayerStats({ spells: ['Fire Bolt'] }), mockCampaignName)

            expect(result.payload.optionDetails['Fire Bolt']).toEqual({
                name: 'Fire Bolt',
                level: 0,
                casting_time: 'Action',
                range: '120 feet',
                description: 'A mote of fire.',
                damage: fireBolt.damage,
            })
        })

        it('defaults missing spell fields to sensible values', async () => {
            const { loadSpellData } = await mods()
            loadSpellData.mockResolvedValue([{ name: 'Spare Cantrip', level: 0 }])

            const result = await handle(makeAction(), makePlayerStats({ spells: ['Spare Cantrip'] }), mockCampaignName)

            const details = result.payload.optionDetails['Spare Cantrip']
            expect(details.casting_time).toBe('1 action')
            expect(details.range).toBe('')
            expect(details.description).toBe('')
            expect(details.damage).toBeNull()
        })

        it('accepts playerStats.spells entries as objects with names', async () => {
            const { loadSpellData } = await mods()
            loadSpellData.mockResolvedValue([fireBolt, acidSplash])

            const result = await handle(makeAction(), makePlayerStats({ spells: [{ name: 'Fire Bolt', prepared: 'Always' }] }), mockCampaignName)

            expect(result.payload.options).toEqual(['Fire Bolt'])
        })

        it('uses custom spellListKey from automation when specified', async () => {
            const { loadSpellData } = await mods()
            loadSpellData.mockResolvedValue([fireBolt])

            const result = await handle(
                makeAction({ automation: { type: 'war_magic_cantrip', spellList: 'sorcerer_cantrips' } }),
                makePlayerStats({ spells: ['Fire Bolt'] }),
                mockCampaignName
            )

            expect(result.payload.spellListKey).toBe('sorcerer_cantrips')
        })

        it('refuses with a logged popup when no known cantrips are available', async () => {
            const { loadSpellData, addEntry } = await mods()
            loadSpellData.mockResolvedValue([acidSplash])

            const result = await handle(makeAction(), makePlayerStats({ spells: [] }), mockCampaignName)

            expect(result.type).toBe('popup')
            expect(result.payload.description).toContain('No known Wizard cantrips available')
            const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'war_magic_refused')
            expect(refusal).toBeDefined()
            expect(refusal.type).toBe('automation')
            expect(refusal.characterName).toBe('TestFighter')
        })

        it('refuses the row click once the latch is stamped this round', async () => {
            const { loadSpellData, getRuntimeValue, addEntry } = await mods()
            loadSpellData.mockResolvedValue([fireBolt])
            getRuntimeValue.mockImplementation((_key, subKey) => (subKey === '_War_Magic_usedRound' ? 1 : null))

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            expect(result.type).toBe('popup')
            expect(result.payload.description).toContain('Once per turn')
            expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'war_magic_refused')).toBe(true)
        })
    })

    describe('confirmWarMagicCantrip', () => {
        beforeEach(() => {
            vi.clearAllMocks()
        })

        it('returns an error popup when no cantrip is selected', async () => {
            const { applyDamageToTarget, setRuntimeValue } = await mods()

            for (const badValue of [null, undefined, '']) {
                const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, badValue)
                expect(result.type).toBe('popup')
                expect(result.payload.type).toBe('automation_info')
                expect(result.payload.description).toBe('No cantrip selected.')
            }
            expect(applyDamageToTarget).not.toHaveBeenCalled()
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('returns an error popup when the selected cantrip cannot be found', async () => {
            const { loadSpellData } = await mods()
            loadSpellData.mockResolvedValue([])
            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Unknown Cantrip')
            expect(result.payload.description).toContain('not found')
        })

        it('refuses an unknown (not-prepared) cantrip with a log and no resolution', async () => {
            const { loadSpellData, addEntry, applyDamageToTarget, setRuntimeValue } = await mods()
            loadSpellData.mockResolvedValue([acidSplash])

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Acid Splash')

            expect(result.payload.description).toContain('not a cantrip you have prepared')
            expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'war_magic_refused')).toBe(true)
            expect(applyDamageToTarget).not.toHaveBeenCalled()
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('refuses a second use in the same round and spends nothing', async () => {
            await setupConfirmMocks({ latchRound: 1 })
            const { addEntry, applyDamageToTarget, setRuntimeValue } = await mods()

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Fire Bolt')

            expect(result.payload.description).toContain('Once per turn')
            expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'war_magic_refused')).toBe(true)
            expect(applyDamageToTarget).not.toHaveBeenCalled()
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('refuses when no target is armed on the initiative card', async () => {
            await setupConfirmMocks({ target: null })
            const { getCombatSummary, addEntry, applyDamageToTarget, setRuntimeValue } = await mods()
            getCombatSummary.mockReturnValue(combatSummary)

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Fire Bolt')

            expect(result.payload.description).toContain('requires a target')
            expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'war_magic_refused')).toBe(true)
            expect(applyDamageToTarget).not.toHaveBeenCalled()
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('refuses when the armed target is out of range', async () => {
            await setupConfirmMocks({ inRange: false })
            const { getCombatSummary, addEntry, applyDamageToTarget, setRuntimeValue } = await mods()
            getCombatSummary.mockReturnValue(combatSummary)

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Fire Bolt')

            expect(result.payload.description).toContain('out of range')
            expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'war_magic_refused')).toBe(true)
            expect(applyDamageToTarget).not.toHaveBeenCalled()
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('rolls the spell attack vs the armed target, applies damage, and writes lastAttack via applyDamageToTarget', async () => {
            await setupConfirmMocks()
            const { getCombatSummary, rollExpression, applyDamageToTarget, addEntry } = await mods()
            getCombatSummary.mockReturnValue(combatSummary)

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Fire Bolt')

            // d20(15)+10=25 vs AC 11 → hit; cantrip die scales at lv18 → 4d10
            expect(rollExpression).toHaveBeenCalledWith('4d10')
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                combatSummary, 'Wight 1', 22, ['Fire'], mockCampaignName, [], false, 'TestFighter')
            const entries = addEntry.mock.calls.map(c => c[1])
            const attackLog = entries.find(e => e.rollType === 'attack')
            expect(attackLog).toBeDefined()
            expect(attackLog.targetName).toBe('Wight 1')
            expect(attackLog.targetAc).toBe(11)
            expect(attackLog.total).toBe(25)
            expect(attackLog.hit).toBe(true)
            const damageLog = entries.find(e => e.rollType === 'damage')
            expect(damageLog).toBeDefined()
            expect(damageLog.damageType).toBe('Fire')
            expect(damageLog.finalDamage).toBe(22)
            expect(result.payload.description).toContain('HIT')
            expect(result.payload.description).toContain('No spell slot consumed')
        })

        it('scales the cantrip die by character level (lv1 → 1d10)', async () => {
            await setupConfirmMocks()
            const { getCombatSummary, rollExpression } = await mods()
            getCombatSummary.mockReturnValue(combatSummary)

            await confirmWarMagicCantrip(makeAction(), makePlayerStats({ level: 1 }), mockCampaignName, 'Fire Bolt')

            expect(rollExpression).toHaveBeenCalledWith('1d10')
        })

        it('logs miss without damage on a natural miss', async () => {
            await setupConfirmMocks()
            const { getCombatSummary, rollD20, applyDamageToTarget, addEntry } = await mods()
            getCombatSummary.mockReturnValue(combatSummary)
            rollD20.mockReturnValue(1)

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Fire Bolt')

            const attackLog = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'attack')
            expect(attackLog.hit).toBe(false)
            expect(applyDamageToTarget).not.toHaveBeenCalled()
            expect(result.payload.description).toContain('MISS')
        })

        it('stamps the once-per-turn latch at the trigger and logs ability_use with no slot spend', async () => {
            await setupConfirmMocks()
            const { getCombatSummary, setRuntimeValue, addEntry } = await mods()
            getCombatSummary.mockReturnValue(combatSummary)

            await confirmWarMagicCantrip(makeAction({ name: 'Improved War Magic' }), makePlayerStats(), mockCampaignName, 'Fire Bolt')

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_War_Magic_usedRound', 1, mockCampaignName)
            expect(setRuntimeValue.mock.calls.some(c => String(c[1]).startsWith('spell_slots_level_'))).toBe(false)
            expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Improved War Magic',
                description: 'Improved War Magic: Replaced attack with cantrip "Fire Bolt"',
            })
            // latch stamp precedes the damage application (CLA-371 ordering)
            const { applyDamageToTarget } = await mods()
            const order = []
            const latchStub = vi.fn(async (...args) => { if (args[1] === '_War_Magic_usedRound') order.push('latch') })
            setRuntimeValue.mockImplementation(latchStub)
            applyDamageToTarget.mockImplementation(async (...args) => { order.push('apply'); return { finalDamage: args[2] } })

            await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Ray of Frost')

            expect(order).toEqual(['latch', 'apply'])
        })

        it('runs the save path for save cantrips: no damage on success, half damage on a failed half save', async () => {
            await setupConfirmMocks({ spells: [sacredFlame] })
            const { getCombatSummary, createSaveListener, applyDamageToTarget, addEntry } = await mods()
            getCombatSummary.mockReturnValue(combatSummary)
            createSaveListener.mockReturnValue({ promptId: 'p1', promise: Promise.resolve({ success: true }) })

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats({ spells: ['Sacred Flame'] }), mockCampaignName, 'Sacred Flame')

            expect(createSaveListener).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
                targetName: 'Wight 1',
                saveType: 'DEX',
            }))
            expect(applyDamageToTarget).not.toHaveBeenCalled()
            expect(result.payload.description).toContain('saved')
            expect(addEntry.mock.calls.map(c => c[1]).some(e => e.rollType === 'attack')).toBe(false)
        })

        it('applies half damage on a failed half save', async () => {
            await setupConfirmMocks({ spells: [sacredFlame] })
            const { getCombatSummary, createSaveListener, applyDamageToTarget } = await mods()
            getCombatSummary.mockReturnValue(combatSummary)
            createSaveListener.mockReturnValue({ promptId: 'p2', promise: Promise.resolve({ success: false }) })

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats({ spells: ['Sacred Flame'] }), mockCampaignName, 'Sacred Flame')

            // rollExpression total 22 → half 11 applied
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                combatSummary, 'Wight 1', 11, ['Radiant'], mockCampaignName, [], false, 'TestFighter')
            expect(result.payload.description).toContain('failed the save')
        })

        it('returns a popup with the automation config', async () => {
            await setupConfirmMocks()
            const { getCombatSummary } = await mods()
            getCombatSummary.mockReturnValue(combatSummary)
            const action = makeAction({ automation: { type: 'war_magic_cantrip', spellList: 'wizard_cantrips' } })
            const result = await confirmWarMagicCantrip(action, makePlayerStats(), mockCampaignName, 'Fire Bolt')

            expect(result.type).toBe('popup')
            expect(result.payload.name).toBe('War Magic')
            expect(result.payload.automationType).toBe('war_magic_cantrip')
            expect(result.payload.automation).toEqual(action.automation)
        })

        it('does not throw when addEntry rejects', async () => {
            await setupConfirmMocks()
            const { addEntry, getCombatSummary } = await mods()
            getCombatSummary.mockReturnValue(combatSummary)
            addEntry.mockRejectedValue(new Error('log failed'))

            const result = await confirmWarMagicCantrip(makeAction(), makePlayerStats(), mockCampaignName, 'Fire Bolt')

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
        })
    })
})
