import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary, setCombatSummaryCache } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { setTempHp } from '../buffs/tempHpService.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { getMonsterSaveBonuses } from '../../../encounters/encounterToInitiative.js';

const WILD_SHAPE_EFFECT = 'wild_shape';

function getTargetEffects() {
    const stored = getRuntimeValue('campaign', 'targetEffects');
    return stored || [];
}

function markDruidCreature(combatSummary, druidName, baseMonster) {
    if (!combatSummary?.creatures) return;
    const druidCreature = combatSummary.creatures.find(c => c.name === druidName && c.type === 'player');
    if (druidCreature) {
        druidCreature.wildShapeSource = druidName;
        druidCreature.beastIndex = baseMonster.index;
        druidCreature.beastName = baseMonster.name;
    }
}

function clearDruidCreature(combatSummary, druidName) {
    if (!combatSummary?.creatures) return;
    const druidCreature = combatSummary.creatures.find(c => c.name === druidName && c.type === 'player');
    if (druidCreature?.wildShapeSource) {
        delete druidCreature.wildShapeConSaveBonus;
        delete druidCreature.saving_throws;
        delete druidCreature.wildShapeSource;
        delete druidCreature.beastIndex;
        delete druidCreature.beastName;
        delete druidCreature.lunarFormAction;
    }
    combatSummary.creatures = combatSummary.creatures.filter(c => !(c.wildShapeSource === druidName && c.type !== 'player'));
}

export function cleanupWildShape(druidName, campaignName) {
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        clearDruidCreature(combatSummary, druidName);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummaryCache(combatSummary, campaignName);
    }

    const targetEffects = getTargetEffects();
    const filtered = targetEffects.filter(te => !(te.effect === WILD_SHAPE_EFFECT && te.source === druidName));
    if (filtered.length !== targetEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
    }

    const activeBuffs = getRuntimeValue(druidName, 'activeBuffs') || [];
    setRuntimeValue(druidName, 'activeBuffs', activeBuffs.filter(b => b.effect !== 'shape_shift'), campaignName);

    setRuntimeValue(druidName, 'tempHp', 0, campaignName);
    setRuntimeValue(druidName, 'circleFormsAC', null, campaignName);
}

async function applyCircleOfTheMoon(combatSummary, druidName, baseMonster, druidStats, campaignName) {
    const wis = druidStats.abilities?.find(a => a.name === 'Wisdom');
    const wisMod = wis?.bonus ?? 0;
    const beastAC = typeof baseMonster.armor_class === 'number' ? baseMonster.armor_class : 10;
    const circleFormsAC = Math.max(beastAC, 13 + wisMod);
    setRuntimeValue(druidName, 'circleFormsAC', circleFormsAC, campaignName);

    const monsters = await loadMonsters();
    const baseMonsterData = monsters.find(m => m.index === baseMonster.index);
    if (!baseMonsterData) return;

    const beastSaves = getMonsterSaveBonuses(baseMonsterData);
    const beastConSave = beastSaves.con ?? 0;
    const druidCreature = combatSummary.creatures?.find(c => c.name === druidName && c.type === 'player');
    if (!druidCreature) return;

    druidCreature.wildShapeConSaveBonus = beastConSave + wisMod;
    const saving_throws = {};
    for (const [abbr, bonus] of Object.entries(beastSaves)) {
        saving_throws[abbr] = { modifier: bonus };
    }
    saving_throws.con.modifier = beastConSave + wisMod;
    druidCreature.saving_throws = saving_throws;

    if (druidStats.level >= 14) {
        druidCreature.lunarFormAction = {
            name: 'Lunar Form',
            damage_dice_primary: '2d10',
            damage_type_primary: 'Radiant',
            description: 'Once per turn on a hit with a Wild Shape form attack, you can deal an extra 2d10 Radiant damage to the target.',
        };
    }
}

export async function activateWildShape(druidName, baseMonster, druidStats, campaignName) {
    setRuntimeValue(druidName, 'activeConditions', [], campaignName);

    const combatSummary = await getCombatContext(campaignName) || { creatures: [] };
    clearDruidCreature(combatSummary, druidName);
    markDruidCreature(combatSummary, druidName, baseMonster);

    let amount = druidStats.level || 1;
    const isMoonDruid = druidStats.class?.major?.name === 'Circle of the Moon' || druidStats.class?.subclass?.name === 'Circle of the Moon';
    if (isMoonDruid) amount = 3 * amount;
    setTempHp(druidName, amount, campaignName);

    if (isMoonDruid) {
        await applyCircleOfTheMoon(combatSummary, druidName, baseMonster, druidStats, campaignName);
    }

    await storage.set('combatSummary', combatSummary, campaignName);
    setCombatSummaryCache(combatSummary, campaignName);

    const targetEffects = getTargetEffects();
    const wildShapeEffect = {
        target: druidName,
        source: druidName,
        effect: WILD_SHAPE_EFFECT,
        beastName: baseMonster.name,
    };
    // New-array spread: mutating the store's array in place makes valuesEqual
    // see a===b and silently skip the POST (playbook 44d).
    const updatedTargetEffects = [
        ...targetEffects.filter(te => !(te.effect === WILD_SHAPE_EFFECT && te.target === druidName)),
        wildShapeEffect,
    ];
    setRuntimeValue('campaign', 'targetEffects', updatedTargetEffects, campaignName);

    const maxWS = druidStats.class?.class_levels?.find(cl => cl.level === druidStats.level)?.wild_shape || 0;
    const currentWS = Number(getRuntimeValue(druidName, 'wildShapeUses', campaignName) ?? maxWS);
    setRuntimeValue(druidName, 'wildShapeUses', currentWS - 1, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: druidName,
        abilityName: 'Wild Shape',
        description: `${druidName} activated Wild Shape as ${baseMonster.name} (CR ${baseMonster.challenge_rating}).`,
    }).catch((e) => { console.error("[wildShapeCreatureBuilder:log-error]", e); });

    return { name: baseMonster.name, index: baseMonster.index };
}
