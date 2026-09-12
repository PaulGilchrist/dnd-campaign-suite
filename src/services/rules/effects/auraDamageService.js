import { cloneDeep } from 'lodash';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import storage from '../../ui/storage.js';
import { isWithinRange } from '../combat/rangeCheck.js';
import { applyDamageToTarget } from '../combat/applyDamage.js';
import { getCombatSummary, loadCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';

const HOLY_NIMBUS_RANGE = 10;

// Load the combat summary and return a detached copy so mutations never
// alias the live React state object. Returns null when no summary exists.
async function loadDetachedCombatSummary(campaignName) {
    let cachedSummary = getCombatSummary(campaignName);
    if (!cachedSummary) {
        cachedSummary = await loadCombatSummary(campaignName);
    }
    return cachedSummary ? cloneDeep(cachedSummary) : null;
}

// True when this creature should take the aura's damage: not the source,
// passes the target filter, isn't a tracked ally, and is within range.
async function shouldTakeAuraDamage(creature, activeName, range, targetFilter, allyList) {
    const creatureName = utils.getName(creature.name);
    if (creatureName === utils.getName(activeName)) return false;
    if (targetFilter && !targetFilter(creature)) return false;
    if (allyList && allyList.includes(creatureName)) return false;
    return await isWithinRange(activeName, creatureName, range);
}

export async function applyAuraDamage(activeName, playerStats, campaignName, characters = [], options = {}) {
    const { activeKey, damageValue, range, damageType = 'Radiant', targetFilter, allyFilter } = options;

    const isActive = getRuntimeValue(activeName, activeKey, campaignName);
    if (!isActive) return;

    const combatSummary = await loadDetachedCombatSummary(campaignName);
    if (!combatSummary) return;

    const creatures = combatSummary.creatures;
    if (!Array.isArray(creatures)) {
        console.error('expirations: expected creatures to be an array in combatSummary');
        return;
    }

    if (typeof damageValue !== 'number' || !(damageValue > 0)) return;

    const allyList = allyFilter ? getStoredAllyList(activeName) : null;

    for (const creature of creatures) {
        if (!await shouldTakeAuraDamage(creature, activeName, range, targetFilter, allyList)) continue;

        const creatureName = utils.getName(creature.name);
        try {
            applyDamageToTarget(combatSummary, creatureName, damageValue, [damageType], campaignName, characters, { ignoreResistance: false, attackerName: activeName });
        } catch (error) { console.error(`[auraDamage] Failed to apply damage to ${creatureName}:`, error); }
    }

    setCombatSummaryCache(combatSummary, campaignName);
    storage.set('combatSummary', combatSummary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

// The caster's stored ally list, or null when none is recorded.
function getStoredAllyList(name) {
    const storedAllies = getAllyList(name);
    return Array.isArray(storedAllies) && storedAllies.length > 0 ? storedAllies : null;
}

// Holy Nimbus radiant damage: proficiency + Charisma modifier.
function resolveHolyNimbusDamage(character) {
    const chaMod = character.computedStats?.abilities?.find(a => a.name === 'Charisma')?.bonus
        ?? character.abilities?.find(a => a.name === 'Charisma')?.bonus
        ?? 0;
    const prof = character.computedStats?.proficiency ?? character.proficiency ?? 0;
    return prof + chaMod;
}

export async function applyHolyNimbusDamage(activeName, characters, campaignName) {
    const summary = await loadDetachedCombatSummary(campaignName);
    if (!summary) return;

    let damageApplied = false;

    for (const character of characters) {
        const charName = utils.getName(character.name);
        if (!getRuntimeValue(charName, 'holyNimbusActive', campaignName)) continue;

        const allyList = getStoredAllyList(charName);
        if (allyList && allyList.includes(activeName)) continue;

        const damageValue = resolveHolyNimbusDamage(character);
        if (damageValue <= 0) continue;

        const inRange = await isWithinRange(charName, activeName, HOLY_NIMBUS_RANGE);
        if (!inRange) continue;

        try {
            applyDamageToTarget(summary, activeName, damageValue, ['Radiant'], campaignName, characters, { ignoreResistance: false, attackerName: charName });
            damageApplied = true;
        } catch (error) { console.error(`[HolyNimbus] Failed to apply radiant damage to ${activeName}:`, error); }
    }

    if (!damageApplied) return;

    // Update the client cache first so React re-renders off the damaged copy,
    // then persist once through the serialized combatSummary write queue.
    setCombatSummaryCache(summary, campaignName);
    storage.set('combatSummary', summary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}
