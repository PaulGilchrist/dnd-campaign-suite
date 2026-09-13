// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
}))

vi.mock('./concentrationRules.js', () => ({
    rollConcentrationSave: vi.fn(() => ({ roll: 10, success: true })),
    breakConcentration: vi.fn(() => null),
    computeConcentrationDc: vi.fn(),
}))

vi.mock('../auras/auraOfProtection.js', () => ({
    computeAuraBonus: vi.fn(),
}))

vi.mock('../conditions/conditionSaveService.js', () => ({
    getCreatureSaveBonus: vi.fn(),
}))

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}))

vi.mock('../../encounters/combatLoggingService.js', () => ({
    logConditionEvent: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve({})),
}))

vi.mock('../../ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}))

vi.mock('../../rules/effects/expirations.js', () => ({
    clearExpirationEffects: vi.fn(),
}))

vi.mock('../../rules/features/heroismService.js', () => ({
    removeHeroismBuff: vi.fn(),
}))

vi.mock('../summons/summonedCreatureService.js', () => ({
    removeSummonedCreatures: vi.fn(),
}))

vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({
    revertTruePolymorph: vi.fn(),
}))

vi.mock('../conditions/savePromptService.js', () => ({
    clearFleshToStonePrompt: vi.fn(),
}))

import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js'
import { getCombatSummary } from '../../encounters/combatData.js'
import { logConditionEvent } from '../../encounters/combatLoggingService.js'
import { addEntry } from '../../ui/logService.js'
import { clearExpirationEffects } from '../../rules/effects/expirations.js'
import { removeHeroismBuff } from '../../rules/features/heroismService.js'
import { removeSummonedCreatures } from '../summons/summonedCreatureService.js'
import { revertTruePolymorph } from '../../automation/handlers/spells/truePolymorphService.js'
import {
    clearAllConcentrations,
    cleanupConcentrationEffects,
} from './concentrationService.js'

function createCombatSummary(creatures = []) {
    return { round: 1, creatures }
}

describe('clearAllConcentrations', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('clears concentration for the resting creature and cleans up effects', () => {
        const cs = createCombatSummary([
            { name: 'Alice', concentration: { spell: 'Bless', dc: 10 } },
            { name: 'Bob', concentration: { spell: 'Haste', dc: 13 } },
        ])
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockReturnValue([])

        clearAllConcentrations('TestCampaign', 'Alice')

        expect(cs.creatures[0].concentration).toBeNull()
    })

    it('does not modify non-resting creatures', () => {
        const cs = createCombatSummary([
            { name: 'Alice', concentration: { spell: 'Bless', dc: 10 } },
            { name: 'Bob', concentration: { spell: 'Haste', dc: 13 } },
        ])
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockReturnValue([])

        clearAllConcentrations('TestCampaign', 'Alice')

        expect(cs.creatures[1].concentration).toEqual({ spell: 'Haste', dc: 13 })
    })

    it('clears concentration-duration targetEffects from the resting creature', () => {
        const cs = createCombatSummary([
            { name: 'Alice', concentration: { spell: 'Haste', dc: 13 } },
        ])
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') {
                return [
                    { source: 'Alice', duration: 'concentration', effect: 'haste' },
                    { source: 'Bob', duration: 'concentration', effect: 'invisibility' },
                    { source: 'Alice', duration: '1 hour', effect: 'buff' },
                ]
            }
            return null
        })

        clearAllConcentrations('TestCampaign', 'Alice')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ source: 'Bob', duration: 'concentration' }),
                expect.objectContaining({ source: 'Alice', duration: '1 hour' }),
            ]),
            'TestCampaign',
            true
        )
    })

    it('does not call setRuntimeValue for targetEffects when no concentration-duration effects exist', () => {
        const cs = createCombatSummary([
            { name: 'Alice', concentration: { spell: 'Bless', dc: 10 } },
        ])
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return []
            return null
        })

        clearAllConcentrations('TestCampaign', 'Alice')

        expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.anything(), 'TestCampaign', true)
    })

    it('does nothing when combat summary is null', () => {
        getCombatSummary.mockReturnValue(null)

        clearAllConcentrations('TestCampaign', 'Alice')

        expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('saves combatSummary and dispatches event when changes are made', () => {
        const cs = createCombatSummary([
            { name: 'Alice', concentration: { spell: 'Bless', dc: 10 } },
        ])
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockReturnValue([])

        clearAllConcentrations('TestCampaign', 'Alice')

        expect(getCombatSummary).toHaveBeenCalledWith('TestCampaign')
    })
})

describe('cleanupConcentrationEffects', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('calls removeSummonedCreatures with caster name and campaign', () => {
        getRuntimeValue.mockReturnValue([])
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Haste', 'TestCampaign')

        expect(removeSummonedCreatures).toHaveBeenCalledWith('Alice', 'TestCampaign')
    })

    it('reverts object transforms when concentration breaks', () => {
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'object_transform', target: 'Bob' },
            { source: 'Alice', duration: 'concentration', effect: 'haste', target: 'Charlie' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            return null
        })
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Haste', 'TestCampaign')

        expect(revertTruePolymorph).toHaveBeenCalledWith('Bob', 'TestCampaign')
    })

    it('handles object transform with array target', () => {
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'object_transform', target: ['Bob', 'item'] },
        ]
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            return null
        })
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Haste', 'TestCampaign')

        expect(revertTruePolymorph).toHaveBeenCalledWith('Bob', 'TestCampaign')
    })

    it('removes concentration-duration targetEffects for the caster', () => {
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'haste' },
            { source: 'Bob', duration: 'concentration', effect: 'invisibility' },
            { source: 'Alice', duration: '1 hour', effect: 'buff' },
        ]
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            return null
        })
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Haste', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ source: 'Bob', duration: 'concentration' }),
                expect.objectContaining({ source: 'Alice', duration: '1 hour' }),
            ]),
            'TestCampaign',
            true
        )
    })

    it('clears activeInvisibility when concentration breaks', () => {
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'invisibility', target: 'Bob' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'campaign' && prop === '_activeInvisibility_Bob') return 'Alice'
            if (key === 'campaign' && prop === '') return { _activeInvisibility_Bob: 'Alice' }
            return null
        })
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Invisibility', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            '',
            expect.objectContaining({}),
            'TestCampaign'
        )
    })

    it('clears activeGreaterInvisibility when concentration breaks', () => {
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'greater_invisibility', target: 'Bob' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'campaign' && prop === '_activeGreaterInvisibility_Bob') return 'Alice'
            if (key === 'campaign' && prop === '') return { _activeGreaterInvisibility_Bob: 'Alice' }
            return null
        })
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Greater Invisibility', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            '',
            expect.objectContaining({}),
            'TestCampaign'
        )
    })

    it('restores suppressed conditions from calm_emotions immunity-mode effects', () => {
        const targetEffects = [
            {
                source: 'Alice', duration: 'concentration', effect: 'calm_emotions',
                mode: 'immunity', suppressedConditions: ['frightened'], target: 'Bob',
            },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeConditions') return []
            return null
        })
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Calm Emotions', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Bob',
            'activeConditions',
            expect.arrayContaining(['frightened']),
            'TestCampaign'
        )
    })

    it('does not re-add suppressed conditions that already exist', () => {
        const targetEffects = [
            {
                source: 'Alice', duration: 'concentration', effect: 'calm_emotions',
                mode: 'immunity', suppressedConditions: ['frightened'], target: 'Bob',
            },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeConditions') return ['frightened']
            return null
        })
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Calm Emotions', 'TestCampaign')

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bob',
            'activeConditions',
            expect.arrayContaining(['frightened']),
            'TestCampaign'
        )
    })

    it('removes Calm Emotions activeBuffs from all creatures', () => {
        const cs = createCombatSummary([
            { name: 'Bob' },
            { name: 'Charlie' },
        ])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'calm_emotions', target: 'Bob' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeConditions') return []
            if (key === 'Bob' && prop === 'activeBuffs') return [{ name: 'Calm Emotions', source: 'Alice' }]
            if (key === 'Charlie' && prop === 'activeBuffs') return [{ name: 'Calm Emotions', source: 'Alice' }, { name: 'Haste' }]
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Calm Emotions', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Bob',
            'activeBuffs',
            [],
            expect.any(String)
        )
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Charlie',
            'activeBuffs',
            expect.arrayContaining([expect.objectContaining({ name: 'Haste' })]),
            expect.any(String)
        )
    })

    it('removes conditions from targetEffects with condition field', () => {
        const cs = createCombatSummary([{ name: 'Bob' }])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'some_effect', target: 'Bob', condition: 'Paralyzed' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeConditions') return ['Paralyzed']
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Some Effect', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Bob',
            'activeConditions',
            [],
            'TestCampaign'
        )
        expect(logConditionEvent).toHaveBeenCalledWith({
            campaignName: 'TestCampaign',
            action: 'removed',
            creatureName: 'Bob',
            conditionLabel: 'Paralyzed',
            dc: 'Concentration lost by Alice'
        })
    })

    it('removes conditions from targetEffects with conditions array', () => {
        const cs = createCombatSummary([{ name: 'Bob' }])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'some_effect', target: 'Bob', conditions: ['Prone', 'Incapacitated'] },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeConditions') return ['Prone', 'Incapacitated', 'Poisoned']
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Some Effect', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Bob',
            'activeConditions',
            expect.arrayContaining(['Poisoned']),
            'TestCampaign'
        )
        expect(logConditionEvent).toHaveBeenCalledWith({
            campaignName: 'TestCampaign',
            action: 'removed',
            creatureName: 'Bob',
            conditionLabel: expect.any(String),
            dc: 'Concentration lost by Alice'
        })
    })

    it('does not remove conditions if target still has another effect with same condition', () => {
        const cs = createCombatSummary([{ name: 'Bob' }])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'effect1', target: 'Bob', condition: 'Paralyzed' },
            { source: 'Charlie', duration: 'concentration', effect: 'effect2', target: 'Bob', condition: 'Paralyzed' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeConditions') return ['Paralyzed']
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Effect1', 'TestCampaign')

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bob',
            'activeConditions',
            [],
            'TestCampaign'
        )
    })

    it('clears pendingExpirations for the caster', () => {
        const targetEffects = []
        const expirations = [
            { effects: ['exp1'], target: 'Bob', casterName: 'Alice' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Alice' && prop === 'pendingExpirations') return expirations
            return null
        })
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Haste', 'TestCampaign')

        expect(clearExpirationEffects).toHaveBeenCalledWith(['exp1'], 'Bob', 'Alice', 'TestCampaign')
        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'pendingExpirations', [], 'TestCampaign')
    })

    it('clears aura_of_life buffs and HP protection from all creatures', () => {
        const cs = createCombatSummary([
            { name: 'Bob' },
            { name: 'Charlie' },
        ])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'aura_of_life' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeBuffs') return [{ name: 'Aura of Life', sourceCharacter: 'Alice' }]
            if (key === 'Charlie' && prop === 'activeBuffs') return [{ name: 'Haste' }]
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Aura of Life', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'auraOfLifeHpMaxProtected', false, 'TestCampaign')
    })

    it('clears aura_of_purity buffs and save advantage conditions from all creatures', () => {
        const cs = createCombatSummary([
            { name: 'Bob' },
        ])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'aura_of_purity' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeBuffs') return [{ name: 'Aura of Purity', sourceCharacter: 'Alice' }]
            if (key === 'Bob' && prop === 'auraOfPuritySaveAdvantageConditions') return ['frightened']
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Aura of Purity', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'auraOfPuritySaveAdvantageConditions', [], 'TestCampaign')
    })

    it('clears resistance runtime values when spell is Resistance', () => {
        const cs = createCombatSummary([
            { name: 'Bob' },
            { name: 'Charlie' },
        ])
        const targetEffects = []
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'resistanceChosenDamageType') return 'fire'
            if (key === 'Bob' && prop === 'resistanceUsedThisTurn') return true
            if (key === 'Charlie' && prop === 'resistanceChosenDamageType') return null
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Resistance', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'resistanceChosenDamageType', null, 'TestCampaign')
        expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'resistanceUsedThisTurn', false, 'TestCampaign')
    })

    it('clears protection from energy runtime values when spell is Protection from Energy', () => {
        const cs = createCombatSummary([{ name: 'Bob' }])
        const targetEffects = []
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'protectionFromEnergyDamageType') return 'cold'
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Protection from Energy', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'protectionFromEnergyDamageType', null, 'TestCampaign')
    })

    it('clears stone skin runtime values when spell is Stone Skin', () => {
        const cs = createCombatSummary([{ name: 'Bob' }])
        const targetEffects = []
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'stoneSkinDamageTypes') return ['piercing']
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Stone Skin', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'stoneSkinDamageTypes', null, 'TestCampaign')
    })

    it('cleans up protection from poison targetEffects and activeBuffs', () => {
        const cs = createCombatSummary([{ name: 'Bob' }])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'protection_from_poison', target: 'Bob' },
            { source: 'Charlie', duration: 'concentration', effect: 'haste', target: 'Bob' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeBuffs') return [{ name: 'Protection from Poison', sourceCharacter: 'Alice' }]
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Protection from Poison', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ source: 'Charlie' }),
            ]),
            'TestCampaign',
            true
        )
    })

    it('cleans up resilient sphere targetEffects for the caster', () => {
        const cs = createCombatSummary([])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'resilient_sphere', target: 'Bob' },
            { source: 'Charlie', duration: 'concentration', effect: 'haste', target: 'Dave' },
        ]
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Resilient Sphere', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ source: 'Charlie' }),
            ]),
            'TestCampaign',
            true
        )
    })

    it('cleans up faerie fire targetEffects and activeBuffs for the caster', () => {
        const cs = createCombatSummary([{ name: 'Bob' }])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'faerie_fire', target: 'Bob' },
            { source: 'Charlie', duration: 'concentration', effect: 'haste', target: 'Dave' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeBuffs') return [{ name: 'Faerie Fire', source: 'Alice' }]
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Faerie Fire', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ source: 'Charlie' }),
            ]),
            'TestCampaign',
            true
        )
        expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'activeBuffs', [], expect.any(String))
    })

    it('cleans up tasha hideous laughter targetEffects and conditions for the caster', () => {
        const cs = createCombatSummary([{ name: 'Bob' }])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'tashas_hideous_laughter', target: 'Bob' },
            { source: 'Charlie', duration: 'concentration', effect: 'haste', target: 'Dave' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeConditions') return ['Prone', 'Incapacitated', 'Poisoned']
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Tasha\'s Hideous Laughter', 'TestCampaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ source: 'Charlie' }),
            ]),
            'TestCampaign',
            true
        )
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Bob',
            'activeConditions',
            expect.arrayContaining(['Poisoned']),
            'TestCampaign'
        )
    })

    it('does not call setRuntimeValue when no concentration-duration effects exist', () => {
        getRuntimeValue.mockReturnValue([])
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Haste', 'TestCampaign')

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.anything(),
            'TestCampaign',
            true
        )
    })

    it('calls removeHeroismBuff for the caster', () => {
        getRuntimeValue.mockReturnValue([])
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Heroism', 'TestCampaign')

        expect(removeHeroismBuff).toHaveBeenCalledWith('Alice', 'TestCampaign')
    })

    it('calls addEntry for fleshToStone cleanup when flesh_to_stone effect exists', () => {
        const allKeys = ['_fleshToStone_Bob']
        getAllStoreKeys.mockReturnValue(allKeys)
        const targetEffects = [
            { target: 'Bob', effect: 'flesh_to_stone', source: 'Alice' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === '_fleshToStone_Bob') return { casterName: 'Alice' }
            if (key === 'Bob' && prop === 'activeConditions') return ['restrained']
            return null
        })
        getCombatSummary.mockReturnValue(null)

        cleanupConcentrationEffects('Alice', 'Flesh to Stone', 'TestCampaign')

        expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'Alice',
            abilityName: 'Flesh to Stone',
            description: 'Concentration broken; Flesh to Stone ends.',
        }))
    })

    it('cleans up all spell-specific effects in order', () => {
        const cs = createCombatSummary([{ name: 'Bob' }])
        const targetEffects = [
            { source: 'Alice', duration: 'concentration', effect: 'object_transform', target: 'Bob' },
            { source: 'Alice', duration: 'concentration', effect: 'holy_aura' },
        ]
        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects
            if (key === 'Bob' && prop === 'activeBuffs') return [{ name: 'Holy Aura', sourceCharacter: 'Alice' }]
            return null
        })
        getCombatSummary.mockReturnValue(cs)

        cleanupConcentrationEffects('Alice', 'Holy Aura', 'TestCampaign')

        expect(revertTruePolymorph).toHaveBeenCalled()
        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'holyAuraTargets', [], 'TestCampaign')
        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'holyAuraSaveDc', null, 'TestCampaign')
    })
})
