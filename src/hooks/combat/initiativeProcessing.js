import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import utils from '../../services/ui/utils.js';
import storage from '../../services/ui/storage.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { clearAllExpirationEffects } from '../../services/rules/effects/expirations.js';
import { clearHuntersMarkConcentration } from '../../services/rules/effects/restRules.js';
import { maybeGrantThiefsReflexesSecondTurn } from '../../services/combat/thiefsReflexesService.js';

export async function processInitiativeRoll({ characterName, campaignName, context, bonus, effectiveD20Roll, r1, r2, setPopupHtml, availableSuperiorityManeuvers, cosmicOmenAppliedBonus, characters }) {
    const firstName = utils.getName(characterName);
    const tandemFtBonus = Number(getRuntimeValue(firstName, 'tandemFootworkBonus', campaignName) ?? 0);
    if (tandemFtBonus > 0) {
        setRuntimeValue(firstName, 'tandemFootworkBonus', 0, campaignName);
    }
    const totalBonus = bonus + tandemFtBonus;
    const combatSummary = await loadCombatSummary(campaignName);
    if (combatSummary) {
        const creature = combatSummary.creatures.find(
            c => c.type === 'player' && c.name === firstName
        );
        if (creature) {
            creature.initiative = String(effectiveD20Roll + totalBonus);
            combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
            // CLA-360: Thief's Reflexes — rolled initiative in round 1 grants the
            // holder's structural second turn at initiative − 10 (spends the use once).
            maybeGrantThiefsReflexesSecondTurn(combatSummary, firstName, campaignName, characters);

            storage.set('combatSummary', combatSummary, campaignName);
        }
    }
    clearAllExpirationEffects(characterName, campaignName);
    // CLA-372: do NOT clear uncannyMetabolismUsed here — it is a once-per-Long-Rest
    // latch; Long Rest (restRules-longRest.js) is its only legitimate reset.

    setPopupHtml({
        type: 'd20',
        rollType: 'initiative',
        name: 'Initiative',
        rolls: [r1, r2],
        bonus: totalBonus,
        characterName,
        campaignName,
        availableSuperiorityManeuvers,
        forcedMode: context?.forcedMode,
        strokeOfLuck: context?.strokeOfLuck,
        bardicInspiration: context?.bardicInspiration,
        bardicInspirationDie: context?.bardicInspirationDie,
        cosmicOmenAppliedBonus,
    });
    window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: { characterName: firstName, roll: effectiveD20Roll + totalBonus } }));
    clearHuntersMarkConcentration(firstName, campaignName);
}
