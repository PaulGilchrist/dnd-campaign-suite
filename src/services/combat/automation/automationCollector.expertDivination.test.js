// @maintained-by-ai
// CLA-128 supply lane: real Diviner disk data → collector → exact passive row the
// spellCast gate consumes. Consumer lives in spellCastService/execution/helpers.js
// (gate predicate + trigger behavior covered in helpers-expertDivination.test.js and
// spellCastService.featureTriggers.test.js — not re-pinned here). The collector runs
// unmocked, so this also pins the info-builder DISPATCH entry and the router's
// passives-bucket route for expert_divination. Regex machinery stays in
// automationCollector.coverage.test.js.
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures } from './automationCollector.js'
import classes2024 from '../../../../public/data/2024/classes.json'

// Verbatim envelope buildAttackInfo's expert_divination handler emits and
// routeAutomation pushes into passives. effect is hardcoded (disk automation has
// no effect field); casting_time falls back to 'passive' when absent.
const EXPECTED_ROW = {
    type: 'expert_divination',
    name: 'Expert Divination',
    effect: 'expert_divination',
    casting_time: 'passive',
    hasAutomation: true,
}

function findDivinerFeature() {
    const wizard = classes2024.find(c => c.name === 'Wizard')
    const diviner = (wizard.majors || []).find(m => m.name === 'Diviner')
    return (diviner.features || []).find(f => f.name === 'Expert Divination')
}

describe('CLA-128 expert_divination collector lane', () => {
    const feature = findDivinerFeature()

    it('ground-truth 2024 classes.json Diviner row authors expert_divination/passive verbatim', () => {
        expect(feature.automation).toEqual({ type: 'expert_divination', casting_time: 'passive' })
    })

    it('collects the disk passive into passives only, with the exact envelope the spellCast gate matches on name+type', () => {
        const result = collectAutomationFromFeatures([feature], {})
        expect(result.passives).toEqual([EXPECTED_ROW])
        const otherBuckets = Object.keys(result).filter(k => k !== 'passives')
        for (const bucket of otherBuckets) {
            expect(result[bucket], bucket).toEqual([])
        }
    })

    it('defaults casting_time to passive when the automation omits it (synthetic shape)', () => {
        const noCastingTime = { name: 'Expert Divination', automation: { type: 'expert_divination' } }
        const { passives } = collectAutomationFromFeatures([noCastingTime], {})
        expect(passives).toEqual([EXPECTED_ROW])
    })
})
