// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, confirmWarMagicSpell } from './warMagicSpellHandler.js'
import { addEntry } from '../../../ui/logService.js'
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'
import { getCombatSummary } from '../../../encounters/combatData.js'
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js'
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js'
import { rollD20, rollExpression } from '../../../dice/diceRoller.js'
import { isWithinRange } from '../../../rules/combat/rangeCheck.js'
import { createSaveListener } from '../../common/savePrompt.js'
import { loadSpellData } from '../../../ui/dataLoader.js'

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

vi.mock('../../../ui/utils.js', () => ({
    DEBUG_FORCE_CRIT: false,
}))

const mockCampaignName = 'test-campaign'

function makeSpell(overrides = {}) {
    return {
        name: 'Burning Hands',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        description: 'A flash of flames.',
        damage: '3d6 fire',
        ...overrides,
    }
}

function makeCantrip(overrides = {}) {
    return {
        name: 'Ray of Frost',
        level: 0,
        ...overrides,
    }
}

function makeLevel3Spell(overrides = {}) {
    return {
        name: 'Fireball',
        level: 3,
        ...overrides,
    }
}

function makeAction(overrides = {}) {
    return {
        name: 'War Magic',
        automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
        ...overrides,
    }
}

function makePlayerStats(overrides = {}) {
    return { name: 'TestFighter', rules: '2024', ...overrides }
}

describe('warMagicSpellHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('handle', () => {
        it('returns a modal with filtered spell options and payload structure', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                makeSpell({ name: 'Burning Hands' }),
                makeSpell({ name: 'Web', level: 2 }),
                makeCantrip(),
                makeLevel3Spell(),
            ])

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            expect(result.type).toBe('modal')
            expect(result.modalName).toBe('warMagicSpell')
            expect(result.payload.options).toEqual(['Burning Hands', 'Web'])
            expect(result.payload.spellListKey).toBe('wizard_spells')
            expect(result.payload.maxSpellLevel).toBe(2)
            expect(result.payload.action).toBeInstanceOf(Object)
            expect(result.payload.playerStats).toEqual(makePlayerStats())
            expect(result.payload.campaignName).toBe(mockCampaignName)
        })

        it('includes all spell detail fields in optionDetails', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            const spell = makeSpell({ name: 'Burning Hands' })
            loadSpellData.mockResolvedValue([spell])

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            const details = result.payload.optionDetails['Burning Hands']
            expect(details).toEqual({
                name: 'Burning Hands',
                level: 1,
                casting_time: '1 action',
                range: 'Self',
                description: 'A flash of flames.',
                damage: '3d6 fire',
            })
        })

        it('defaults all optional spell fields when missing', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([makeSpell({
                name: 'Sparse Spell',
                level: 1,
                casting_time: undefined,
                range: undefined,
                description: undefined,
                damage: undefined,
            })])

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            const details = result.payload.optionDetails['Sparse Spell']
            expect(details.casting_time).toBe('1 action')
            expect(details.range).toBe('')
            expect(details.description).toBe('')
            expect(details.damage).toBeNull()
        })

        it('filters out cantrips and spells above maxSpellLevel', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                makeCantrip({ name: 'Ray of Frost' }),
                makeSpell({ name: 'Burning Hands', level: 1 }),
                makeLevel3Spell({ name: 'Fireball' }),
                makeSpell({ name: 'Mystery Spell', level: undefined }),
                makeSpell({ name: 'Negative Spell', level: -1 }),
            ])

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            expect(result.payload.options).toEqual(['Burning Hands'])
        })

        it('returns an info popup when the spell list is null or empty', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue(null)

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toBe('No Wizard spells available.')
        })

        it('returns an info popup when no eligible spells remain after filtering', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([makeCantrip(), makeLevel3Spell()])

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName)

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
            expect(result.payload.description).toBe('No Wizard spells of level 1-2 available.')
        })

        it('uses custom spellListKey and maxSpellLevel from automation config', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                makeSpell({ name: 'Burning Hands', level: 1 }),
                makeSpell({ name: 'Fireball', level: 3 }),
            ])

            const result = await handle(
                makeAction({ automation: { type: 'war_magic_spell', maxSpellLevel: 3, spellList: 'sorcerer_spells' } }),
                makePlayerStats(),
                mockCampaignName
            )

            expect(result.payload.spellListKey).toBe('sorcerer_spells')
            expect(result.payload.maxSpellLevel).toBe(3)
            expect(result.payload.options).toEqual(['Burning Hands', 'Fireball'])
        })

        it('defaults spellListKey and maxSpellLevel when automation has no config', async () => {
            const { loadSpellData } = await import('../../../ui/dataLoader.js')
            loadSpellData.mockResolvedValue([
                makeSpell({ name: 'Burning Hands', level: 2 }),
                makeSpell({ name: 'Fireball', level: 3 }),
            ])

            const result = await handle(
                makeAction({ automation: { type: 'war_magic_spell' } }),
                makePlayerStats(),
                mockCampaignName
            )

            expect(result.payload.spellListKey).toBe('wizard_spells')
            expect(result.payload.maxSpellLevel).toBe(2)
            expect(result.payload.options).toEqual(['Burning Hands'])
        })
    })

    describe('confirmWarMagicSpell', () => {
        const magicMissile = {
            name: 'Magic Missile',
            level: 1,
            casting_time: 'Action',
            range: '120 feet',
            description: 'Three darts of force.',
            damage: { damage_type: 'Force', damage_at_slot_level: { 1: '1d4 + 1' } },
            dc: null,
        }

        const burningHands = {
            name: 'Burning Hands',
            level: 1,
            casting_time: 'Action',
            range: 'Self',
            description: 'A fan of flame.',
            damage: { damage_type: 'Fire', damage_at_slot_level: { 1: '3d6' } },
            dc: { dc_type: 'DEX', dc_success: 'half' },
        }

        const combatSummary = {
            creatures: [
                { name: 'TestFighter', targetName: 'Wight 1' },
                { name: 'Wight 1', ac: 12, currentHp: 50, maxHp: 58 },
            ],
        }

        function setupConfirmMocks(spell = magicMissile) {
            loadSpellData.mockResolvedValue([spell])
            getCombatSummary.mockReturnValue(combatSummary)
            getTargetFromAttacker.mockReturnValue({ name: 'Wight 1' })
            isWithinRange.mockResolvedValue(true)
            getRuntimeValue.mockImplementation((_key, subKey) => {
                if (subKey === 'spell_slots_level_1') return 3
                if (subKey === 'characters') return []
                if (subKey === 'activeBuffs') return []
                return null
            })
            rollD20.mockReturnValue(15)
            rollExpression.mockImplementation(() => ({ total: 5, rolls: [4, 1], modifier: 1 }))
            applyDamageToTarget.mockImplementation((_cs, _t, raw) => ({ finalDamage: raw }))
        }

        beforeEach(() => {
            vi.clearAllMocks()
        })

        it('returns an error popup when no spell is selected', async () => {
            const action = makeAction()

            for (const badValue of [null, undefined, '']) {
                const result = await confirmWarMagicSpell(action, makePlayerStats(), mockCampaignName, badValue)
                expect(result.type).toBe('popup')
                expect(result.payload.type).toBe('automation_info')
                expect(result.payload.description).toBe('No spell selected.')
            }
        })

        it('returns an error popup when the selected spell cannot be found', async () => {
            loadSpellData.mockResolvedValue([])
            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, 'Unknown Spell')
            expect(result.payload.description).toContain('not found')
        })

        it('requires a target from the initiative card and does not spend a slot without one', async () => {
            setupConfirmMocks()
            getTargetFromAttacker.mockReturnValue(null)

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, 'Magic Missile')

            expect(result.payload.description).toContain('requires a target')
            expect(setRuntimeValue).not.toHaveBeenCalled()
            expect(applyDamageToTarget).not.toHaveBeenCalled()
        })

        it('does not spend a slot or deal damage when the target is out of range', async () => {
            setupConfirmMocks()
            isWithinRange.mockResolvedValue(false)

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, 'Magic Missile')

            expect(result.payload.description).toContain('out of range')
            expect(setRuntimeValue).not.toHaveBeenCalled()
            expect(applyDamageToTarget).not.toHaveBeenCalled()
        })

        it('does not spend a slot when none are available', async () => {
            setupConfirmMocks()
            getRuntimeValue.mockImplementation((_key, subKey) => {
                if (subKey === 'spell_slots_level_1') return 0
                if (subKey === 'characters') return []
                if (subKey === 'activeBuffs') return []
                return null
            })

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, 'Magic Missile')

            expect(result.payload.description).toContain('No level 1 spell slots available')
            expect(setRuntimeValue).not.toHaveBeenCalled()
        })

        it('spends the spell slot on confirm', async () => {
            setupConfirmMocks()

            await confirmWarMagicSpell(makeAction({ name: 'Improved War Magic' }), makePlayerStats(), mockCampaignName, 'Magic Missile')

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'spell_slots_level_1', 2, mockCampaignName)
        })

        it('resolves Magic Missile auto-hit spell damage against the card target', async () => {
            setupConfirmMocks()

            const result = await confirmWarMagicSpell(makeAction({ name: 'Improved War Magic' }), makePlayerStats(), mockCampaignName, 'Magic Missile')

            // 3 darts × (1d4+1 → 5) = 15 raw spell damage applied to the card target
            expect(applyDamageToTarget).toHaveBeenCalledWith(combatSummary, 'Wight 1', 15, ['Force'], mockCampaignName, [], { ignoreResistance: false, attackerName: 'TestFighter' })
            expect(result.payload.description).toContain('15')
            expect(result.payload.description).toContain('Force')
        })

        it('grants and rolls one weapon attack against the same target on confirm', async () => {
            setupConfirmMocks()
            const stats = makePlayerStats({ attacks: [{ hitBonus: 5, damage: '1d6+2', damageType: 'Piercing' }] })

            const result = await confirmWarMagicSpell(makeAction({ name: 'Improved War Magic' }), stats, mockCampaignName, 'Magic Missile')

            // d20(15) + 5 = 20 vs AC 12 → hit, weapon damage 5 applied
            expect(applyDamageToTarget).toHaveBeenCalledWith(combatSummary, 'Wight 1', 5, ['Piercing'], mockCampaignName, [], { ignoreResistance: false, attackerName: 'TestFighter' })
            expect(result.payload.description).toContain('Weapon attack: Hit')
            expect(result.payload.description).toContain('20 vs AC 12')
            const attackLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'roll' && e.rollType === 'attack')
            expect(attackLog).toBeDefined()
            expect(attackLog.targetName).toBe('Wight 1')
            expect(attackLog.targetAc).toBe(12)
            expect(attackLog.hit).toBe(true)
        })

        it('logs slot expenditure, spell damage, and the weapon attack', async () => {
            setupConfirmMocks()

            await confirmWarMagicSpell(makeAction({ name: 'Improved War Magic' }), makePlayerStats(), mockCampaignName, 'Magic Missile')

            const entries = addEntry.mock.calls.map(c => c[1])
            expect(entries.some(e => e.type === 'ability_use' && e.characterName === 'TestFighter'
                && /Expended a level 1 spell slot to cast "Magic Missile" at Wight 1/.test(e.description))).toBe(true)
            expect(entries.some(e => e.type === 'roll' && e.rollType === 'damage'
                && e.targetName === 'Wight 1' && e.damageType === 'Force' && e.finalDamage === 15)).toBe(true)
            expect(entries.some(e => e.type === 'roll' && e.rollType === 'attack'
                && e.targetName === 'Wight 1' && e.hit === true)).toBe(true)
            // applyDamageToTarget is awaited for the spell and the weapon attack
            // (applyDamageToTarget logs its own hp_change entries internally)
            expect(applyDamageToTarget).toHaveBeenCalledTimes(2)
        })

        it('rolls a saving throw prompt for save spells and deals no damage on a successful save', async () => {
            setupConfirmMocks(burningHands)
            createSaveListener.mockReturnValue({ promptId: 'p1', promise: Promise.resolve({ success: true }) })

            const result = await confirmWarMagicSpell(makeAction(), makePlayerStats(), mockCampaignName, 'Burning Hands')

            expect(createSaveListener).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
                targetName: 'Wight 1',
                saveType: 'DEX',
            }))
            // No spell damage on a save success — only the weapon attack applies damage
            expect(applyDamageToTarget).toHaveBeenCalledTimes(1)
            expect(result.type).toBe('popup')
        })

        it('returns a popup with the automation config', async () => {
            setupConfirmMocks()
            const action = makeAction({ automation: { type: 'war_magic_spell', maxSpellLevel: 3, spellList: 'wizard_spells' } })
            const result = await confirmWarMagicSpell(action, makePlayerStats(), mockCampaignName, 'Magic Missile')

            expect(result.type).toBe('popup')
            expect(result.payload.name).toBe('War Magic')
            expect(result.payload.automationType).toBe('war_magic_spell')
            expect(result.payload.automation).toEqual(action.automation)
        })

        it('does not throw when addEntry rejects', async () => {
            setupConfirmMocks()
            addEntry.mockRejectedValue(new Error('log failed'))

            const action = makeAction()
            const result = await confirmWarMagicSpell(action, makePlayerStats(), mockCampaignName, 'Magic Missile')

            expect(result.type).toBe('popup')
            expect(result.payload.type).toBe('automation_info')
        })
    })
})
