import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import cloneDeep from 'lodash/cloneDeep.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { getMonsterSaveBonuses } from '../../../encounters/encounterToInitiative.js';
import { getNextUniqueMonsterName } from '../../../encounters/encounterToInitiative.js';

const MAX_TARGETS_KEY = 'createUndeadMaxTargets';

function getTargetEffects() {
    const stored = getRuntimeValue('campaign', 'targetEffects');
    return stored || [];
}

function getSlotLevel(action) {
    const auto = action.automation;
    if (auto?.slotLevel) return auto.slotLevel;
    if (action.metaCtx?.slotLevel) return action.metaCtx.slotLevel;
    if (action.spell?.level) return action.spell.level;
    return 6;
}

function getMaxTargets(slotLevel) {
    const upcast = { 6: 3, 7: 4, 8: 5, 9: 6 };
    return upcast[slotLevel] || 3;
}

async function loadGhoulMonster() {
    const monsters = await loadMonsters();
    const monster = monsters.find(m => m.index === 'ghoul');
    if (!monster) {
        console.error('[createUndead] Monster "ghoul" not found in monsters.json');
        return null;
    }
    return monster;
}

function buildGhoulEntry(baseName, monster, initiativeValue, existingCreatures) {
    const name = getNextUniqueMonsterName(baseName, existingCreatures);
    const npcHp = monster.hit_points || 10;
    return {
        name,
        type: 'npc',
        monsterType: monster.type || 'Undead',
        initiative: String(initiativeValue - 0.1),
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
                description: `${action.name}: ${maxTargets} ghoul(s) created.`,
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'createUndead',
        payload: {
            action,
            playerStats,
            campaignName,
            maxTargets,
        },
    };
}

function resolveGhoulInitiative(casterCreature) {
    const rawInit = casterCreature?.initiative;
    let initiativeValue = 0;
    if (rawInit !== '' && rawInit !== undefined) {
        initiativeValue = parseInt(rawInit, 10) || 0;
    }
    const casterInitBonus = casterCreature?.initiativeBonus || 0;
    return initiativeValue || (Math.floor(Math.random() * 20) + 1 + casterInitBonus);
}

export async function confirmCreateUndead(action, playerStats, campaignName, { ghoulCount }) {
    if (!playerStats) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Failed to load caster data.',
                automation: action.automation,
            },
        };
    }

    const slotLevel = getSlotLevel(action);
    const maxTargets = getMaxTargets(slotLevel);
    const count = ghoulCount || 1;

    if (count <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No undead created.',
                automation: action.automation,
            },
        };
    }

    const casterName = playerStats.name;
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Failed to load combat summary.',
                automation: action.automation,
            },
        };
    }

    const ghoulMonster = await loadGhoulMonster();
    if (!ghoulMonster) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Failed to load ghoul monster data.',
                automation: action.automation,
            },
        };
    }

    const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
    const initiativeValue = resolveGhoulInitiative(casterCreature);

    let targetEffects = getTargetEffects();
    const creatureNames = [];

    for (let i = 0; i < count; i++) {
        const creature = buildGhoulEntry('Ghoul', ghoulMonster, initiativeValue, combatSummary.creatures);
        combatSummary.creatures.push(creature);
        const existingSummoned = targetEffects.find(te => te.target === creature.name && te.effect === 'summoned' && te.source === casterName);
        if (!existingSummoned) {
            targetEffects.push({ target: creature.name, source: casterName, effect: 'summoned' });
        }
        creatureNames.push(creature.name);
    }

    combatSummary.creatures.sort((a, b) => {
        const aInit = a.initiative === '' || a.initiative === undefined ? 0 : Number(a.initiative);
        const bInit = b.initiative === '' || b.initiative === undefined ? 0 : Number(b.initiative);
        return bInit - aInit;
    });

    storage.set('combatSummary', cloneDeep(combatSummary), campaignName);
    setRuntimeValue('campaign', 'targetEffects', targetEffects, campaignName);
    window.dispatchEvent(new CustomEvent('initiative-rolled'));

    const plural = count > 1 ? 's' : '';
    const ghoulLabel = `${count} Ghoul${plural}`;

    await addEntry(campaignName, {
        type: 'summons',
        characterName: casterName,
        summonName: 'Create Undead',
        description: `${casterName} casts Create Undead (slot level ${slotLevel}), creating ${count} ghoul${plural}.`,
        summonedCreatures: creatureNames,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[createUndeadHandler:log-error]", e); });

    action.metadata = { ...action.metadata, [MAX_TARGETS_KEY]: maxTargets };

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${casterName} casts Create Undead, creating ${ghoulLabel}. They act on your turn, right after you.`,
            automation: action.automation,
        },
        logEntries: [{
            type: 'summons',
            characterName: casterName,
            summonName: 'Create Undead',
            description: `${casterName} casts Create Undead (slot level ${slotLevel}), creating ${count} ghoul${plural}.`,
            summonedCreatures: creatureNames,
            timestamp: Date.now(),
        }],
    };
}

const HANDLER_MODAL = 'createUndead';
const HANDLER_CONFIRM = 'create_undead_confirm';

export { HANDLER_MODAL as modalName, HANDLER_CONFIRM as confirmType };
