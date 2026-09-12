import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';
import { addEntry } from '../../ui/logService.js';

function resolveFiendBlessingFeature(computed) {
    const isFiendPatron = computed.class?.subclass?.name === 'Fiend Patron';
    if (!isFiendPatron) return null;
    const rawFeatures = computed.specialActions;
    if (rawFeatures == null || !Array.isArray(rawFeatures)) { console.error('[applyDamage] characterAdvancement is not an array'); throw new Error('characterAdvancement must be an array'); }
    const feature = rawFeatures.find(f => f.name === "Dark One's Blessing");
    if (!feature || !feature.automation) return null;
    return feature;
}

function resolveCharismaMod(computed) {
    const cha = computed.abilities?.find(a => a.name === 'Charisma');
    return cha?.bonus || 0;
}

function resolveWarlockLevel(computed) {
    const rawClassLevels = computed.class?.class_levels;
    if (rawClassLevels == null || !Array.isArray(rawClassLevels)) { console.error('[applyDamage] class_levels is not an array'); throw new Error('class_levels must be an array'); }
    const cl = rawClassLevels.find(c => c.level === computed.level);
    return cl ? cl.level : computed.level;
}

function grantDarkOnesBlessing(charStats, creature, campaignName) {
    const charName = charStats.name;
    const computed = charStats?.computedStats || charStats;
    if (!computed) return;
    if (!resolveFiendBlessingFeature(computed)) return;

    const allies = getAllyList(charName);
    if (allies.includes(creature.name)) return;

    const amount = Math.max(1, resolveCharismaMod(computed) + resolveWarlockLevel(computed));
    const existingTempHp = Number(getRuntimeValue(charName, 'tempHp', campaignName) || 0);
    setRuntimeValue(charName, 'tempHp', Math.max(existingTempHp, amount), campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: charName,
        abilityName: "Dark One's Blessing",
        description: `${charName} gained ${amount} temporary hit points from Dark One's Blessing when ${creature.name} was reduced to 0 HP.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[darkOnesBlessing] Error logging:", e); });
}

export function checkDarkOnesBlessing({ characters, creature, finalDamage, wasAlive, isNowUnconscious, campaignName }) {
    if (!(wasAlive && isNowUnconscious && finalDamage > 0)) return;
    for (const charStats of characters) {
        grantDarkOnesBlessing(charStats, creature, campaignName);
    }
}
