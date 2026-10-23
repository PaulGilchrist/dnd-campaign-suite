import { executeHandler } from '../../automation/index.js';

// Gate + envelope forwarder ONLY. Apply lives on the picker lane: the
// pendingBeaconOfHope confirm route runs beaconOfHopeHandler.applyBeaconOfHopeEffect
// DIRECT (useSimpleSpellHandlers.js:299) — the former confirmBeaconOfHope
// forwarder export had zero production callers and was excised (#1338 dead-export batch).
export async function triggerBeaconOfHope(spell, metaCtx, playerStats, campaignName, mapName) {
    const isBeacon = (spell.name || '').toLowerCase() === 'beacon of hope';
    if (!isBeacon) return null;

    const slotLevel = metaCtx?.slotLevel || spell.level || 3;

    const action = {
        name: 'Beacon of Hope',
        automation: {
            type: 'beacon_of_hope',
            range: spell.range || '30 feet',
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[beaconOfHope] Failed to execute Beacon of Hope handler:', e);
        return null;
    }
}
