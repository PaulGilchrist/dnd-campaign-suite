// FT-107: mount-state PRODUCER for the 2024 Mounted Combatant feat.
// Consumers verified live but had zero producers:
//  - conditionEffectsInternal.mountedAndTargetSmaller reads `isMounted` +
//    `mountSize` off the combatSummary creature entry (Mounted Strike
//    advantage, target at least one size smaller than the mount);
//  - reactionBonusHandler (Leap Aside / Veer) reads runtime `mountName` on
//    the rider; hitResolution.runVeerRedirect reads runtime `mountedBy` on
//    the mount.
// This service stamps every leg server-first: rider runtime store gets ONE
// merged write (`mountName` + `mountSize`, §39), the mount runtime store gets
// `mountedBy` (different char store = different endpoint, parallel-safe), and
// the rider's combatSummary creature entry is stamped `isMounted` +
// `mountSize` via the canonical full-store storage.set + cache update
// (wildShapeCreatureBuilder precedent). `rangeToTarget` stays unset — the
// consumer is gridless-lenient with a null range (§42); grid token distance
// adjudication rides the existing map attack-context lane.
import { cloneDeep } from 'lodash';
import { getRuntimeValue, setRuntimeValue, setRuntimeObject } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import storage from '../../ui/storage.js';
import { addEntry } from '../../ui/logService.js';

const SIZE_ORDER = ['Fine', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

export const MOUNTED_BY_KEY = 'mountedBy';
export const MOUNT_NAME_KEY = 'mountName';

function findCreature(campaignName, name) {
    const cs = getCombatSummary(campaignName);
    return cs?.creatures?.find(c => c.name === name) || null;
}

// Lenient mount chooser source: initiative combatants that are not players
// and are not already mounted. Keeps any NPC joinable (advisory in the
// chooser when the mount is not a Beast/Vehicle or is too small — canonical
// 2024 RAW wants a mount at least one size larger with suitable anatomy).
export function getMountCandidates(campaignName) {
    const cs = getCombatSummary(campaignName);
    return (cs?.creatures || [])
        .filter(c => c.type !== 'player' && !getRuntimeValue(c.name, MOUNTED_BY_KEY, campaignName))
        .map(c => ({ name: c.name, size: c.size || null, monsterType: c.monsterType || null }));
}

function buildMountAdvisory(mountCreature, riderSize) {
    const notes = [];
    const mountType = String(mountCreature.monsterType || '').toLowerCase();
    if (mountType && mountType !== 'beast' && mountType !== 'vehicle') {
        notes.push(`${mountCreature.name} is not a Beast or Vehicle (GM-advisory)`);
    }
    const mountSizeIdx = SIZE_ORDER.indexOf(mountCreature.size || 'Medium');
    const riderSizeIdx = SIZE_ORDER.indexOf(riderSize || 'Medium');
    if (mountCreature.size && mountSizeIdx !== -1 && riderSizeIdx !== -1 && mountSizeIdx <= riderSizeIdx) {
        notes.push(`a mount should be at least one size larger than the rider (GM-advisory)`);
    }
    return notes.length > 0 ? ` Advisory: ${notes.join('; ')}.` : '';
}

function mountRefusalLog(riderName, reason, mountName) {
    return {
        type: 'automation',
        automationType: 'mount_refused',
        automationDetail: reason,
        characterName: riderName,
        abilityName: 'Mount',
        description: `${riderName} tried to mount${mountName ? ` ${mountName}` : ''} — refused (${reason}). Zero mount state written.`,
        timestamp: Date.now(),
    };
}

function dismountRefusalLog(riderName, reason) {
    return {
        type: 'automation',
        automationType: 'dismount_refused',
        automationDetail: reason,
        characterName: riderName,
        abilityName: 'Dismount',
        description: `${riderName} tried to dismount — refused (${reason}). Zero mount state cleared.`,
        timestamp: Date.now(),
    };
}

function stampCombatSummaryRider(campaignName, riderName, mountName, mountSize) {
    const cs = getCombatSummary(campaignName);
    if (!cs?.creatures) return null;
    const next = cloneDeep(cs);
    const rider = next.creatures.find(c => c.name === riderName);
    const mount = next.creatures.find(c => c.name === mountName);
    if (!rider) return null;
    rider.isMounted = true;
    rider.mountSize = mountSize;
    rider.mountName = mountName;
    if (mount) mount.mountedBy = riderName;
    storage.set('combatSummary', next, campaignName);
    setCombatSummaryCache(next, campaignName);
    return next;
}

// Mount the rider on a combatant. One merged runtime write on the rider
// store, one write on the mount store (different endpoints), one full-store
// combatSummary POST. Returns { ok, advisory } — refusals log
// `mount_refused` with a reason token and write zero state (§41).
export async function mountRider(riderName, mountName, campaignName, riderSize) {
    if (!mountName) {
        await addEntry(campaignName, mountRefusalLog(riderName, 'no_target')).catch((e) => { console.error('[mountService] Error:', e); });
        return { ok: false, reason: 'no_target' };
    }
    const mountCreature = findCreature(campaignName, mountName);
    if (!mountCreature) {
        await addEntry(campaignName, mountRefusalLog(riderName, 'mount_not_in_initiative', mountName)).catch((e) => { console.error('[mountService] Error:', e); });
        return { ok: false, reason: 'mount_not_in_initiative' };
    }
    const mountedBy = getRuntimeValue(mountName, MOUNTED_BY_KEY, campaignName);
    if (mountedBy) {
        await addEntry(campaignName, mountRefusalLog(riderName, `already_mounted_by_${mountedBy}`, mountName)).catch((e) => { console.error('[mountService] Error:', e); });
        return { ok: false, reason: 'already_mounted' };
    }
    const mountSize = mountCreature.size || 'Medium';
    const advisory = buildMountAdvisory(mountCreature, riderSize);

    // One merged write per store (§39): rider store carries mountName +
    // mountSize; the mount store carries mountedBy.
    setRuntimeObject(riderName, { [MOUNT_NAME_KEY]: mountName, mountSize }, campaignName);
    setRuntimeValue(mountName, MOUNTED_BY_KEY, riderName, campaignName);
    stampCombatSummaryRider(campaignName, riderName, mountName, mountSize);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: riderName,
        abilityName: 'Mount',
        description: `${riderName} mounts ${mountName}${advisory}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[mountService] Error:', e); });

    return { ok: true, mountSize, advisory };
}

// Dismount the rider: clears mountName/mountSize on the rider store,
// mountedBy on the mount store, and the combatSummary mount stamp.
export async function dismountRider(riderName, campaignName) {
    const mountName = getRuntimeValue(riderName, MOUNT_NAME_KEY, campaignName);
    if (!mountName) {
        await addEntry(campaignName, dismountRefusalLog(riderName, 'no_mount_active')).catch((e) => { console.error('[mountService] Error:', e); });
        return { ok: false, reason: 'no_mount_active' };
    }

    setRuntimeObject(riderName, { [MOUNT_NAME_KEY]: null, mountSize: null }, campaignName);
    setRuntimeValue(mountName, MOUNTED_BY_KEY, null, campaignName);

    const cs = getCombatSummary(campaignName);
    if (cs?.creatures) {
        const next = cloneDeep(cs);
        const rider = next.creatures.find(c => c.name === riderName);
        const mount = next.creatures.find(c => c.name === mountName);
        if (rider) {
            rider.isMounted = false;
            rider.mountSize = null;
            rider.mountName = null;
        }
        if (mount) mount.mountedBy = null;
        storage.set('combatSummary', next, campaignName);
        setCombatSummaryCache(next, campaignName);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: riderName,
        abilityName: 'Dismount',
        description: `${riderName} dismounts ${mountName}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[mountService] Error:', e); });

    return { ok: true, mountName };
}
