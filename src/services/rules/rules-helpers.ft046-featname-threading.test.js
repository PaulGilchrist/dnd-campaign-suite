// @maintained-by-ai
// FT-046 featName threading (fix d45838a1f: Inspiring Leader wrong temp HP +
// no once-per-rest latch). This lane owns the ONLY unwired face of
// mergeAutomationSpecialActions (rules-helpers.js:21-30): before the fix, the
// merged row omitted `featName: sa.featName` (:27), so CharSpecialActions rows
// reached tempHpBuffHandler with no featName, fell back to action.name
// ("Bolstering Performance"), and could never prefix-match featAbilityChoices
// keys "Inspiring Leader-0" (abilityLookup.js resolveFeatChosenAbility,
// exact case-sensitive startsWith — no normalization on this lane).
// Builder bytes (temp.js:56 feature.featName root read, '' default, auto-level
// drop) are owned verbatim by automationInfoBuilder/temp.test.js; handler
// consumption + latch bytes by tempHpBuffHandler.multiTargetAlly.test.js;
// short-rest re-arm by restRules-shortRest.ft046-inspiring-leader.test.js.
// Pure merge/builder module: zero mocks. Disk scan of public/data/2024/feats.json:
// exactly two disk temp_hp_buff benefits — Inspiring Leader/Bolstering
// Performance and Chef/Bolstering Treats; zero normalized-name collisions.
// No clocks; no dice — synchronous merge plumbing.
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { mergeAutomationSpecialActions } from './rules-helpers.js'
import { tempHandlers } from '../combat/automation/automationInfoBuilder/temp.js'

// Real disk bytes — never hand-authored (#1362).
const diskFeats = JSON.parse(readFileSync('public/data/2024/feats.json', 'utf8'))
const featList = Array.isArray(diskFeats) ? diskFeats : diskFeats.feats
function diskBenefit(featName, benefitName) {
    const feat = featList.find(f => f.name === featName)
    const benefit = feat.benefits.find(b => b.name === benefitName)
    expect(benefit, `disk ${featName}/${benefitName}`).toBeTruthy()
    return benefit
}

describe('FT-046 featName threading through mergeAutomationSpecialActions', () => {
    it('threads disk featName from the tagged feat feature through the real temp_hp_buff builder into the merged row', () => {
        // Provenance exactly as rules.js addFeatFeatures (:211-217) tags rows
        // (featBuffService.js:603 stamps f.featName = feat.name), so the
        // automation row entering merge is real-builder output, not invented.
        const il = diskBenefit('Inspiring Leader', 'Bolstering Performance')
        const feature = {
            name: il.name,
            description: il.description,
            type: 'special',
            source: 'feat',
            automation: il.automation,
            featName: 'Inspiring Leader',
        }
        const info = tempHandlers.temp_hp_buff(feature, {})
        expect(info.featName).toBe('Inspiring Leader')
        const playerStats = { specialActions: [], automation: { specialActions: [info] } }
        mergeAutomationSpecialActions(playerStats)
        expect(playerStats.specialActions).toEqual([{
            name: 'Bolstering Performance',
            description: il.description,
            automation: info,
            featName: 'Inspiring Leader',
            hasAutomation: true,
        }])
        // Identity: merge wraps by reference, never clones (handler mutates-none contract).
        expect(playerStats.specialActions[0].automation).toBe(info)
    })

    it('merges the full survivor set with exact wrapper shape: featName threaded, exact-name rows swallowed, near-miss names NOT normalized', () => {
        const chef = diskBenefit('Chef', 'Bolstering Treats')
        const existingManual = { name: 'Bolstering Performance', description: 'manual note' }
        const playerStats = {
            specialActions: [existingManual],
            automation: {
                specialActions: [
                    // disk real row WITH featName — the FT-046 byte
                    { name: 'Bolstering Performance', description: '', featName: 'Inspiring Leader', type: 'temp_hp_buff', multiTargetAlly: true },
                    // disk real row, second distinct feat — mutually distinguishable near-miss name
                    { name: 'Bolstering Treats', description: chef.description, featName: 'Chef', type: 'temp_hp_buff' },
                    // case near-miss of a survivor: Set match is exact (no toLowerCase/
                    // replace(/[-\s]/g,'') here — unlike rules-fightingStyles.js:235-236);
                    // disk feats.json has zero normalized-name collisions
                    { name: 'bolstering performance', description: '', featName: 'Probe', type: 'temp_hp_buff' },
                    // no featName: the :27 byte still EMITS the key (toStrictEqual pins presence)
                    { name: 'Featureless Row', description: '', type: 'temp_hp_buff' },
                ],
            },
        }
        const inputRows = playerStats.automation.specialActions
        const automationSnapshot = JSON.parse(JSON.stringify(playerStats.automation))
        const manualSnapshot = JSON.parse(JSON.stringify(existingManual))
        mergeAutomationSpecialActions(playerStats)

        expect(playerStats.specialActions.length).toBe(4)
        // Survivor #0 is untouched by identity; the exact-name dup of it
        // (inputRows[0], the FT-046 disk row) is swallowed — the merge's dedup
        // is by `name` only, so a manual row with the same benefit name silently
        // shadows the feat row's featName at this hop (quirk pinned, not fixed).
        expect(playerStats.specialActions[0]).toBe(existingManual)
        // Disk Chef row survives next with its own featName threaded.
        expect(playerStats.specialActions[1]).toEqual({
            name: 'Bolstering Treats',
            description: chef.description,
            automation: inputRows[1],
            featName: 'Chef',
            hasAutomation: true,
        })
        // Exact key set AND order of the wrapper (:27 literal).
        expect(Object.keys(playerStats.specialActions[1])).toEqual(
            ['name', 'description', 'automation', 'featName', 'hasAutomation'])
        // Two distinct "Bolstering*" feats never collapse into one identity.
        // Case near-miss merged as its own row with its own featName (exact-match dedup).
        expect(playerStats.specialActions[2]).toEqual({
            name: 'bolstering performance',
            description: '',
            automation: inputRows[2],
            featName: 'Probe',
            hasAutomation: true,
        })
        // featName key present on every wrapper even when the source row lacks
        // it (undefined threaded, not dropped) — full pin of the last survivor.
        expect(playerStats.specialActions[3]).toStrictEqual({
            name: 'Featureless Row',
            description: '',
            automation: inputRows[3],
            featName: undefined,
            hasAutomation: true,
        })
        // Input purity (#1395): merge never mutates the automation rows it reads.
        expect(JSON.parse(JSON.stringify(playerStats.automation))).toStrictEqual(automationSnapshot)
        expect(playerStats.specialActions[0]).toStrictEqual(manualSnapshot)
    })

    it('no-ops without touching playerStats when there are no automation specialActions', () => {
        const noAutomation = { name: 'TestPaladin', specialActions: [{ name: 'Keep Me' }] }
        mergeAutomationSpecialActions(noAutomation)
        expect(noAutomation).toEqual({ name: 'TestPaladin', specialActions: [{ name: 'Keep Me' }] })
        expect('automation' in noAutomation).toBe(false)

        const emptyList = { name: 'TestPaladin', specialActions: [], automation: { specialActions: [] } }
        mergeAutomationSpecialActions(emptyList)
        // Array is created only when a row is pushed (:26) — stays an empty [] unchanged.
        expect(emptyList.specialActions).toStrictEqual([])

        const noSpecialActionsKey = { name: 'TestPaladin', automation: {} }
        mergeAutomationSpecialActions(noSpecialActionsKey)
        expect('specialActions' in noSpecialActionsKey).toBe(false)
    })
})
