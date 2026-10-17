// @maintained-by-ai
// ── FAMILY SPLIT MAP (automationInfoBuilder family) ─────────────────────────
// automationInfoBuilder.js (flat) is a PURE FACADE: it spreads 21 domain
// handler maps into DISPATCH and routes on feature.automation.type
// (misc.js itself re-aggregates core-handlers.js, class-feature-handlers.js,
// elemental-handlers.js, utility-handlers.js, so all 25 unit modules ride in).
//
// Lanes:
//   • THIS FILE (facade lane): the null/early-return contract and a full
//     delegation table — every registered type routed through buildAttackInfo
//     must produce EXACTLY what its domain handler unit produces. No per-type
//     value pins here (those would duplicate unit homes = fabricated pins).
//   • automationInfoBuilder/<domain>.test.js (unit lanes, canonical homes for
//     per-type envelopes/defaults/calcs, called directly on the handler map):
//     save_attack → save.test.js · healing → healing.test.js (#2090 string-vs-
//     evaluated canonical) · bardic_inspiration → bardic.test.js · combat_stance
//     → combatStance.test.js · reaction_* incl. glorious_defense/beguiling_
//     defenses/reaction_counterspell → reaction.test.js · temp_buff → temp.test.js
//     · passive renames → passive.test.js · free_spell → spell.test.js ·
//     damage_bonus/damage feat-gate/GWF → damage.test.js · attack_rider →
//     attack.test.js · extra_action → diverse.test.js · auto_effect & other
//     core handlers → core-handlers.test.js (via miscHandlers) · resource_pool
//     → resource.test.js · initiative_action → initiative.test.js.
//   • Superiority/maneuver executors (mn003/mn004 naming) → combatSuperiority
//     lanes; superiorDefense canonical at 2024 Warrior lv18. Collector lane
//     map: automationCollector.* headers (#2082). Mock-factory lane:
//     createMockAutomationExpressions (#2092) — not needed here: this facade
//     runs the REAL modules, which is strictly stronger.
import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.test-utils.js'
import { attackHandlers } from './automationInfoBuilder/attack.js'
import { bardicHandlers } from './automationInfoBuilder/bardic.js'
import { combatStanceHandlers } from './automationInfoBuilder/combatStance.js'
import { combatSuperiorityHandlers } from './automationInfoBuilder/combatSuperiority.js'
import { conditionalHandlers } from './automationInfoBuilder/conditional.js'
import { damageHandlers } from './automationInfoBuilder/damage.js'
import { diverseHandlers } from './automationInfoBuilder/diverse.js'
import { healingHandlers } from './automationInfoBuilder/healing.js'
import { initiativeHandlers } from './automationInfoBuilder/initiative.js'
import { miscHandlers } from './automationInfoBuilder/misc.js'
import { natureHandlers } from './automationInfoBuilder/nature.js'
import { passiveHandlers } from './automationInfoBuilder/passive.js'
import { primalHandlers } from './automationInfoBuilder/primal.js'
import { psionicHandlers } from './automationInfoBuilder/psionic.js'
import { reactionHandlers } from './automationInfoBuilder/reaction.js'
import { resourceHandlers } from './automationInfoBuilder/resource.js'
import { saveHandlers } from './automationInfoBuilder/save.js'
import { sorceryHandlers } from './automationInfoBuilder/sorcery.js'
import { spellHandlers } from './automationInfoBuilder/spell.js'
import { starryHandlers } from './automationInfoBuilder/starry.js'
import { tempHandlers } from './automationInfoBuilder/temp.js'

// Same 21 maps, same spread order, as DISPATCH in automationInfoBuilder.js.
const DOMAIN_MAPS = {
    attackHandlers,
    bardicHandlers,
    combatStanceHandlers,
    combatSuperiorityHandlers,
    conditionalHandlers,
    damageHandlers,
    diverseHandlers,
    healingHandlers,
    initiativeHandlers,
    miscHandlers,
    natureHandlers,
    passiveHandlers,
    primalHandlers,
    psionicHandlers,
    reactionHandlers,
    resourceHandlers,
    saveHandlers,
    sorceryHandlers,
    spellHandlers,
    starryHandlers,
    tempHandlers,
}

const REGISTRY = Object.entries(DOMAIN_MAPS).flatMap(([domain, handlers]) =>
    Object.keys(handlers).map(type => ({ domain, type })))

describe('buildAttackInfo (facade)', () => {
    it('returns null when there is no automation or no handler for the type', () => {
        expect(buildAttackInfo({ name: 'No Automation' }, BASE_STATS)).toBeNull()
        expect(buildAttackInfo({ name: 'Null Auto', automation: null }, BASE_STATS)).toBeNull()
        expect(buildAttackInfo({ name: 'Undefined Auto', automation: undefined }, BASE_STATS)).toBeNull()
        expect(buildAttackInfo(makeFeature({ foo: 'bar' }), BASE_STATS)).toBeNull()
        expect(buildAttackInfo(makeFeature({ type: 'nonexistent_type' }), BASE_STATS)).toBeNull()
    })

    it('delegates every registered automation type to its domain handler unchanged', () => {
        // Registry sanity: type keys must be unique across maps, else the facade's
        // object-spread silently shadows earlier registrations.
        const types = REGISTRY.map(r => r.type)
        expect(new Set(types).size).toBe(types.length)
        // Liveness floor: the facade carries the whole builder registry (~250 types).
        expect(types.length).toBeGreaterThanOrEqual(240)

        for (const { domain, type } of REGISTRY) {
            const feature = makeFeature({ type })
            const direct = DOMAIN_MAPS[domain][type](feature, BASE_STATS)
            const viaFacade = buildAttackInfo(feature, BASE_STATS)
            // Delegation equality: wrong route, dropped module, or post-processing
            // in the facade all fail here. Per-type VALUES (incl. legitimate type
            // renames like passive_buff→passive_rule) are pinned by unit homes.
            expect(viaFacade, `${domain}.${type}`).toEqual(direct)
            if (direct === null) {
                // Only documented null-for-bare-feature: damage's feat-source gate
                // (canonical: damage.test.js). New bare-null handlers must be probed.
                expect(type, `unexpected bare-null handler in ${domain}`).toBe('damage')
            }
        }
    })
})
