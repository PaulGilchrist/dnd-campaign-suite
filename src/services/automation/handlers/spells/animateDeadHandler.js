import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import cloneDeep from 'lodash/cloneDeep.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { getMonsterSaveBonuses } from '../../../encounters/encounterToInitiative.js';
import { infoPopup } from '../../common/infoPopup.js';

const MAX_TARGETS_KEY = 'animateDeadMaxTargets';

function getTargetEffects() {
    const stored = getRuntimeValue('campaign', 'targetEffects');
    return stored || [];
}

function getSlotLevel(action) {
    const auto = action.automation;
    if (auto?.slotLevel) return auto.slotLevel;
    if (action.metaCtx?.slotLevel) return action.metaCtx.slotLevel;
    if (action.spell?.level) return action.spell.level;
    return 3;
}

function getMaxTargets(slotLevel) {
    const upcast = { 3: 1, 4: 3, 5: 5, 6: 7, 7: 9, 8: 11, 9: 13 };
    return upcast[slotLevel] || 1;
}

async function loadMonsterData(monsterIndex) {
    const monsters = await loadMonsters();
    const monster = monsters.find(m => m.index === monsterIndex);
    if (!monster) {
        console.error(`[animateDead] Monster "${monsterIndex}" not found in monsters.json`);
        return null;
    }
    return monster;
}

function buildCreatureEntry(baseName, monster, initiativeValue, index) {
    const name = index === 0 ? baseName : `${baseName} ${index + 1}`;
    const npcHp = monster.hit_points || 10;
    return {
        name,
        type: 'npc',
        monsterType: monster.type || 'Undead',
        initiative: String(initiativeValue),
        targetName: null,
        ac: typeof monster.armor_class === 'number' ? monster.armor_class : 10,
        resistances: monster.damage_resistances || [],
        immunities: monster.damage_immunities || monster.immunities || [],
        concentration: null,
        maxHp: npcHp,
        currentHp: npcHp,
        saveBonuses: getMonsterSaveBonuses(monster),
        monsterIndex: monster.index,
    };
}

export async function handle(action, playerStats, campaignName) {
    const slotLevel = getSlotLevel(action);
    const maxTargets = getMaxTargets(slotLevel);

    const stored = action.metadata?.[MAX_TARGETS_KEY];
    if (stored === maxTargets) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: ${maxTargets} undead creature(s) created.`,
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'animateDead',
        payload: {
            action,
            playerStats,
            campaignName,
            maxTargets,
        },
    };
}

function summonSwarm(combatSummary, targetEffects, creatureNames, baseName, monster, initiativeValue, count, casterName) {
    for (let i = 0; i < (count || 0); i++) {
        const creature = buildCreatureEntry(baseName, monster, initiativeValue, i);
        combatSummary.creatures.push(creature);
        const existingSummoned = targetEffects.find(te => te.target === creature.name && te.effect === 'summoned' && te.source === casterName);
        if (!existingSummoned) {
            targetEffects.push({ target: creature.name, source: casterName, effect: 'summoned' });
        }
        creatureNames.push(creature.name);
    }
}

function pluralCountLabel(count, singular) {
    return count > 0 ? `${count} ${singular}${count > 1 ? 's' : ''}` : '';
}

export async function confirmAnimateDead(action, playerStats, campaignName, { zombieCount, skeletonCount }) {
    const slotLevel = getSlotLevel(action);
    const maxTargets = getMaxTargets(slotLevel);
    const total = (zombieCount || 0) + (skeletonCount || 0);

    if (total <= 0) {
        return infoPopup(action.name, 'No undead created.', action.automation);
    }

    const casterName = playerStats.name;
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) {
        return infoPopup(action.name, 'Failed to load combat summary.', action.automation);
    }

    const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
    let initiativeValue = 0;
    if (casterCreature?.initiative !== '' && casterCreature?.initiative !== undefined) {
        initiativeValue = parseInt(casterCreature.initiative, 10) || 0;
    }

    const casterInitBonus = casterCreature?.initiativeBonus || 0;
    initiativeValue = initiativeValue || (Math.floor(Math.random() * 20) + 1 + casterInitBonus);

    const skeletonMonster = await loadMonsterData('skeleton');
    if (!skeletonMonster) {
        return infoPopup(action.name, 'Failed to load skeleton monster data.', action.automation);
    }

    const zombieMonster = await loadMonsterData('zombie');
    if (!zombieMonster) {
        return infoPopup(action.name, 'Failed to load zombie monster data.', action.automation);
    }

    let targetEffects = getTargetEffects();
    const creatureNames = [];

    summonSwarm(combatSummary, targetEffects, creatureNames, 'Skeleton', skeletonMonster, initiativeValue, skeletonCount, casterName);
    summonSwarm(combatSummary, targetEffects, creatureNames, 'Zombie', zombieMonster, initiativeValue, zombieCount, casterName);

    combatSummary.creatures.sort((a, b) => {
        const aInit = a.initiative === '' || a.initiative === undefined ? 0 : parseInt(a.initiative, 10);
        const bInit = b.initiative === '' || b.initiative === undefined ? 0 : parseInt(b.initiative, 10);
        return bInit - aInit;
    });

    storage.set('combatSummary', cloneDeep(combatSummary), campaignName);
    setRuntimeValue('campaign', 'targetEffects', targetEffects, campaignName);
    window.dispatchEvent(new CustomEvent('initiative-rolled'));

    const zombieLabel = pluralCountLabel(zombieCount, 'Zombie');
    const skeletonLabel = pluralCountLabel(skeletonCount, 'Skeleton');
    const creatureList = [zombieLabel, skeletonLabel].filter(Boolean).join(' and ');

    await addEntry(campaignName, {
        type: 'summons',
        characterName: casterName,
        summonName: 'Animate Dead',
        description: `${casterName} casts Animate Dead (slot level ${slotLevel}), creating ${total} undead creature(s).`,
        summonedCreatures: creatureNames,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[animateDeadHandler:log-error]", e); });

    action.metadata = { ...action.metadata, [MAX_TARGETS_KEY]: maxTargets };

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${casterName} casts Animate Dead, creating ${creatureList}. They act on your turn, right after you.`,
            automation: action.automation,
        },
        logEntries: [{
            type: 'summons',
            characterName: casterName,
            summonName: 'Animate Dead',
            description: `${casterName} casts Animate Dead (slot level ${slotLevel}), creating ${total} undead creature(s).`,
            summonedCreatures: creatureNames,
            timestamp: Date.now(),
        }],
    };
}

const HANDLER_MODAL = 'animateDead';
const HANDLER_CONFIRM = 'animate_dead_confirm';

export { HANDLER_MODAL as modalName, HANDLER_CONFIRM as confirmType };
