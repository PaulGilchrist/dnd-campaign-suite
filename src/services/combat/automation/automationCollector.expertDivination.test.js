import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { buildAttackInfo } from './automationInfoBuilder.js'
import classes2024 from '../../../../public/data/2024/classes.json'

// CLA-128: the supply side (info-builder DISPATCH + router) was missing an
// entry for expert_divination, so the passive never reached
// playerStats.automation.passives and the spellCast trigger gate
// (spellCastService/execution/helpers.js) always fell through. These tests
// run the REAL unmocked collector against the real Diviner feature data.

function findDivinerFeature() {
    const wizard = classes2024.find(c => c.name === 'Wizard')
    const diviner = (wizard.majors || []).find(m => m.name === 'Diviner')
    return (diviner.features || []).find(f => f.name === 'Expert Divination')
}

describe('CLA-128 expert_divination supply chain', () => {
    const feature = findDivinerFeature()

    it('ground-truth 2024 classes.json declares Expert Divination automation', () => {
        expect(feature).toBeTruthy()
        expect(feature.level).toBe(6)
        expect(feature.automation).toMatchObject({ type: 'expert_divination', casting_time: 'passive' })
    })

    it('buildAttackInfo emits an info object (not null) for expert_divination', () => {
        const info = buildAttackInfo({ ...feature, automation: feature.automation }, {})
        expect(info).not.toBeNull()
        expect(info).toMatchObject({
            type: 'expert_divination',
            name: 'Expert Divination',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('collectAutomationFromFeatures routes the passive into passives[]', () => {
        const result = collectAutomationFromFeatures([feature], {})
        const passive = result.passives.find(p => p.name === 'Expert Divination' && p.type === 'expert_divination')
        expect(passive).toBeTruthy()
    })

    it('satisfies the spellCast trigger gate predicate in helpers.js', () => {
        const { passives } = collectAutomationFromFeatures([feature], {})
        const hasExpertDivination = passives.some(p => p.name === 'Expert Divination' && p.type === 'expert_divination')
        expect(hasExpertDivination).toBe(true)
    })
})
