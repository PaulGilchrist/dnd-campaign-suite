import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';
import { addEntry } from '../../ui/logService.js';

export function checkDarkOnesBlessing(characters, creature, finalDamage, isPlayer, wasAlive, isNowUnconscious, campaignName, _attackerName) {
    console.log('[darkOnesBlessing] checkDarkOnesBlessing called, isPlayer:', isPlayer, 'wasAlive:', wasAlive, 'isNowUnconscious:', isNowUnconscious, 'finalDamage:', finalDamage, 'creature:', creature.name, 'campaignName:', campaignName);
    if (wasAlive && isNowUnconscious && finalDamage > 0) {
        console.log('[darkOnesBlessing] Condition met, checking characters for Fiend Patron, characters.length:', characters?.length);
        for (const charStats of characters) {
            const charName = charStats.name;
            console.log('[darkOnesBlessing] Checking character:', charName, 'charStats keys:', Object.keys(charStats));
            const computed = charStats?.computedStats || charStats;
            if (!computed) { console.log('[darkOnesBlessing] No computed stats for', charName); continue; }
            const isFiendPatron = computed.class?.subclass?.name === 'Fiend Patron';
            console.log('[darkOnesBlessing] isFiendPatron:', isFiendPatron, 'subclass:', computed.class?.subclass?.name, 'class:', computed.class?.name, 'level:', computed.level);
            if (!isFiendPatron) continue;
            const rawFeatures = computed.specialActions;
            console.log('[darkOnesBlessing] specialActions:', rawFeatures?.map?.(f => f.name) || rawFeatures);
            if (rawFeatures == null || !Array.isArray(rawFeatures)) { console.error('[applyDamage] characterAdvancement is not an array'); throw new Error('characterAdvancement must be an array'); }
            const feature = rawFeatures.find(f => f.name === "Dark One's Blessing");
            console.log('[darkOnesBlessing] feature found:', !!feature, 'has automation:', !!(feature && feature.automation));
            if (!feature || !feature.automation) continue;

            const allies = getAllyList(charName);
            console.log('[darkOnesBlessing] Allies for', charName, ':', allies, 'creature:', creature.name, 'is ally:', allies.includes(creature.name));
            if (allies.includes(creature.name)) { console.log('[darkOnesBlessing] Creature is ally, skipping'); continue; }

            const chaMod = (() => {
                const cha = computed.abilities?.find(a => a.name === 'Charisma');
                return cha?.bonus || 0;
            })();
            const warlockLevel = (() => {
                const rawClassLevels = computed.class?.class_levels;
                if (rawClassLevels == null || !Array.isArray(rawClassLevels)) { console.error('[applyDamage] class_levels is not an array'); throw new Error('class_levels must be an array'); }
                const cl = rawClassLevels.find(c => c.level === computed.level);
                return cl ? cl.level : computed.level;
            })();
            let amount = chaMod + warlockLevel;
            amount = Math.max(1, amount);
            const existingTempHp = Number(getRuntimeValue(charName, 'tempHp', campaignName) || 0);
            console.log('[darkOnesBlessing] CHA mod:', chaMod, 'warlock level:', warlockLevel, 'amount:', amount, 'existing temp HP:', existingTempHp, 'new temp HP:', Math.max(existingTempHp, amount));
            setRuntimeValue(charName, 'tempHp', Math.max(existingTempHp, amount), campaignName);

            addEntry(campaignName, {
                type: 'ability_use',
                characterName: charName,
                abilityName: "Dark One's Blessing",
                description: `${charName} gained ${amount} temporary hit points from Dark One's Blessing when ${creature.name} was reduced to 0 HP.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[darkOnesBlessing] Error logging:", e); });
        }
    }
}
