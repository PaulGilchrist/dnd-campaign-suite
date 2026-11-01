import { triggerPostCastSelfHeals } from '../spells/postCastHealService.js';
import { createMassHealSpellTrigger } from './massHealSpellFactory.js';

const MASS_CURE_WOUNDS_NAME = 'Mass Cure Wounds';

// Disk 5e spells.json:6691 'Choose up to six creatures in a 30-foot-radius
// sphere centered on that point.' — no friendly/allies wording, so hostile
// creatures inside the AoE stay RAW-eligible (#1384 choice-clause verdict).
// defaultMaxTargets 6 is the disk-text fallback ('up to six creatures'): this
// row carries no automation.maxTargets; a disk value would win.
// #1384 selection law runs in the shared factory: candidates pass canonical
// isWithinRange(caster, name, rangeToFeet(spell.range)) — disk '60 feet'
// enforced, no hardcoded feet; the sphere's point-of-origin selection lives
// upstream. Lawful pool keeps combatSummary array order.

// CLA-038: post-cast self-heal passives (e.g. Blessed Healer) fire when
// this mass heal restored HP to at least one creature other than the caster.
// UNIQUE vs the Mass Healing Word twin: that lane never imports
// postCastHealService and fires no blessed-healer rider.
async function maybeTriggerBlessedHealer({ spell, results, casterName, playerStats, slotLevel, campaignName, mapName }) {
    if (!results.some(r => r.healAmount > 0 && r.targetName !== casterName)) {
        return;
    }
    await triggerPostCastSelfHeals(spell, { slotLevel, targetNames: results.map(r => r.targetName) }, playerStats, campaignName, mapName).catch(e => {
        console.error('[massCureWoundsService] Post-cast self-heal failed:', e);
    });
}

// fix#349 #1384: the lowercase dispatch at triggerSpells.js `spell.name.toLowerCase() ===
// 'mass cure wounds'` reaches the factory gate with any casing; it folds BOTH
// sides (fix#109 precedent) so case-drift casts land instead of nulling.
export const triggerMassCureWounds = createMassHealSpellTrigger({
    spellName: MASS_CURE_WOUNDS_NAME,
    defaultSlotLevel: 5,
    defaultMaxTargets: 6,
    serviceTag: '[massCureWoundsService]',
    logTag: '[massCureWounds]',
    postCastSelfHeal: maybeTriggerBlessedHealer,
});
