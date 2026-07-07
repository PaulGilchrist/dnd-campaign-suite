import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export function checkDarkOnesBlessing(characters, creature, finalDamage, isPlayer, wasAlive, isNowUnconscious, campaignName) {
    if (!isPlayer && wasAlive && isNowUnconscious && finalDamage > 0) {
        const allCharacters = characters;
        for (const charStats of allCharacters) {
            const computed = charStats?.computedStats || charStats;
            if (!computed) continue;
            const isFiendPatron = computed.class?.subclass?.name === 'Fiend Patron';
            if (!isFiendPatron) continue;
            const rawFeatures = computed.characterAdvancement;
            if (rawFeatures == null || !Array.isArray(rawFeatures)) { console.error('[applyDamage] characterAdvancement is not an array'); throw new Error('characterAdvancement must be an array'); }
            const features = rawFeatures;
            const feature = features.find(f => f.name === "Dark One's Blessing");
            if (!feature || !feature.automation) continue;
            const chaMod = (() => {
                const cha = computed.abilities?.find(a => a.name === 'Charisma');
                return cha ? Math.floor((cha.score - 10) / 2) : 0;
            })();
            const warlockLevel = (() => {
                const rawClassLevels = computed.class?.class_levels;
                if (rawClassLevels == null || !Array.isArray(rawClassLevels)) { console.error('[applyDamage] class_levels is not an array'); throw new Error('class_levels must be an array'); }
                const cl = rawClassLevels.find(c => c.level === computed.level);
                return cl ? cl.level : computed.level;
            })();
            let amount = chaMod + warlockLevel;
            amount = Math.max(1, amount);
            const existingTempHp = Number(getRuntimeValue(charStats.name, 'tempHp', campaignName) || 0);
            setRuntimeValue(charStats.name, 'tempHp', existingTempHp + amount, campaignName);
        }
    }
}
