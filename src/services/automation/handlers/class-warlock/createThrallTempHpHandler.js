import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { setTempHpOnKey } from '../buffs/tempHpService.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

// CLA-066: 2024 runtime shape — classes.json stores patron features FLAT
// under majors[].features (Warlock.subclasses=[]), so runtime
// class.subclass is `{ name }` only. Scan the automation-collected shape
// first (the collector flattens majors correctly), then raw feature lists
// including the flat major/subclass features.
function thrallFeatureMarkers(playerStats) {
    const automation = playerStats?.automation || {};
    const klasses = playerStats?.class || {};
    const subclass = klasses.subclass || {};
    return [
        ...(automation.specialActions || []),
        ...(automation.passives || []),
        ...(klasses.class_levels || []).flatMap(cl => cl.features || []),
        ...(subclass.class_levels || []).flatMap(cl => cl.features || []),
        ...(subclass.features || []),
        ...(klasses.major?.features || []),
    ];
}

function hasCreateThrallFeature(playerStats) {
    return thrallFeatureMarkers(playerStats).some(m =>
        m && (m.type === 'create_thrall' || m.effect === 'create_thrall_temp_hp' || m.name === 'Create Thrall')
    );
}

// CLA-066: canonical math is Warlock level + Charisma modifier — the old
// - floor((level-1)/2) fold produced 11 instead of 17 at lv14/+3.
function evaluateThrallTempHp(expr) {
    try {
        const result = new Function(`"use strict"; return (${expr})`)();
        if (typeof result === 'number' && !isNaN(result)) {
            return Math.max(0, result);
        }
        return 0;
    } catch (_e) {
        // If expression evaluation fails, try rolling
        const dieRoll = rollExpression(expr);
        return dieRoll?.total || 0;
    }
}

function findAberrantCompanion(cs) {
    return cs.creatures.find(c =>
        c.name && (
            c.name.includes('Aberrant Spirit') ||
            c.name.includes('Aberration') ||
            c.name.toLowerCase().includes('aberration')
        )
    );
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Create Thrall';

    // Check if the feature is available (Warlock level 14+)
    if (!hasCreateThrallFeature(playerStats)) {
        return null;
    }

    // Resolve temp HP expression
    const tempHpExpression = auto.tempHpExpression || 'warlock level + CHA modifier';
    const level = playerStats.level || 1;
    const abilities = Array.isArray(playerStats.abilities) ? playerStats.abilities : [];
    const chaMod = abilities.find(a => a.name === 'Charisma')?.bonus || 0;

    const expr = tempHpExpression
        .replace(/warlock level/gi, level)
        .replace(/warlock_level/gi, level)
        .replace(/level/gi, level)
        .replace(/CHA modifier/gi, chaMod)
        .replace(/charisma modifier/gi, chaMod);

    const tempHp = evaluateThrallTempHp(expr);

    if (tempHp <= 0) {
        return null;
    }

    // Find the summoned companion in combat context
    const cs = await getCombatContext(campaignName);
    if (!cs || !cs.creatures) {
        return null;
    }

    // Look for the Aberrant Spirit companion
    const companion = findAberrantCompanion(cs);

    if (!companion) {
        return null;
    }

    // CLA-066: canonical `tempHp` runtime key (initiative/MonsterCard read
    // tempHp — the old `_<Name>_tempHp` key had zero consumers) +
    // replace-if-larger via tempHpService.
    const existing = Number(getRuntimeValue(companion.name, 'tempHp') || 0);
    const finalAmount = setTempHpOnKey(companion.name, 'tempHp', tempHp, campaignName);

    if (finalAmount <= existing) {
        // No increase — the summon-time stamp already stands; stay quiet
        // (turn-start re-arms are idempotent, no repeat popup/log spam).
        return null;
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName}: ${companion.name} gains ${finalAmount} Temporary Hit Points.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[createThrallTempHp] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName}: ${companion.name} gains ${finalAmount} Temporary Hit Points.`,
            automation: auto,
        },
    };
}
