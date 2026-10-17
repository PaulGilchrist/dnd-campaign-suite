// @maintained-by-ai
// CLA-301 collector seam (family #2087): the temp_buff + effect 'sacred_weapon' fingerprint in
// SPECIAL_AUTOMATIONS must push the passive_buff marker that the live consumer
// steps/features/sacredWeapon.js:10 gates on (passives.find(p => p.name === 'Sacred Weapon'
// && p.effect === 'sacred_weapon')) while fallThrough keeps the row itself routed to
// specialActions with its Normal/Radiant picker options intact.
// Both arms run VERBATIM disk rows from public/data/2024/classes.json (Oath of Devotion lv3):
// the Sacred Weapon row plus its same-shape Channel Divinity foil Vow of Enmity proves the
// marker comes from the effect fingerprint alone — a fabricated-name fixture was purged here
// (verdict per #2086-sibling disk-anchor checks).
// Cited, not re-pinned (non-overlap): row click + fingerprint delegation + full row envelope →
// automation/sacredWeaponRowActivation.test.js (#2001); builder options/default units →
// automationInfoBuilder/temp.test.js; handler internals → sacredWeaponHandler.test.js;
// bucket tables → automationCollector.types.test.js / automationRouter.js:242.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { makePlayerStats } from './automationService.test-utils.js'

const ps = makePlayerStats()

function findDiskFeature(featureName) {
    const classes = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'))
    let found = null
    const walk = node => {
        if (found || !node) return
        if (Array.isArray(node)) { node.forEach(walk); return }
        if (typeof node !== 'object') return
        if (node.name === featureName && node.automation) { found = node; return }
        Object.values(node).forEach(walk)
    }
    walk(classes)
    if (!found) throw new Error(`disk feature ${featureName} missing from public/data/2024/classes.json`)
    return found
}

describe('collectAutomationFromFeatures – sacred_weapon passive marker (CLA-301)', () => {
    it('disk Sacred Weapon row: exact one passive_buff marker AND the row still routed with both picker options', () => {
        const feature = findDiskFeature('Sacred Weapon')
        // Anchor: the row under test exists on disk with the collector fingerprint.
        expect(feature.automation).toMatchObject({ type: 'temp_buff', effect: 'sacred_weapon', resourceCost: 'channel_divinity' })

        const result = collectAutomationFromFeatures([feature], ps)

        // Set-exactness: exactly one marker in passives (fallThrough must not double-push),
        // envelope verbatim — name + effect are the consumer's lookup gate.
        expect(result.passives).toEqual([{
            type: 'passive_buff',
            name: 'Sacred Weapon',
            effect: 'sacred_weapon',
            hasAutomation: true,
        }])
        // fallThrough: the row reaches specialActions (router temp_buff bucket) exactly once,
        // carrying the Normal/Radiant choices the damage-type picker consumes.
        expect(result.specialActions).toHaveLength(1)
        const row = result.specialActions[0]
        expect(row).toMatchObject({
            type: 'temp_buff',
            name: 'Sacred Weapon',
            effect: 'sacred_weapon',
            duration: '10_minutes',
            resourceCost: 'channel_divinity',
        })
        expect(row.options).toEqual(feature.automation.options)
    })

    it('disk Channel Divinity foil (Vow of Enmity): same temp_buff shape, no sacred_weapon marker, row still routed', () => {
        const feature = findDiskFeature('Vow of Enmity')
        const result = collectAutomationFromFeatures([feature], ps)
        // Fingerprint negative: only effect 'sacred_weapon' earns the marker — passives stays
        // empty while the foil routes cleanly through the generic temp_buff path.
        expect(result.passives).toEqual([])
        expect(result.specialActions).toHaveLength(1)
        expect(result.specialActions[0]).toMatchObject({ type: 'temp_buff', name: 'Vow of Enmity', effect: 'vow_of_enmity' })
    })
})
