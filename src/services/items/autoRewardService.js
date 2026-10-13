/**
 * L5 Phase 4 (§10.3) — auto rewards (loot + XP).
 *
 * The manual lane already exists: the Initiative loot panel generates loot
 * (lootGenerator) and Award splits encounter XP evenly across the party
 * through normal runtime character state (`xp` per character + log entries).
 * This service is the same lane, fired once at the GM's Clear-Combat gesture
 * (the double-consent close of an encounter): generate loot, award XP, audit.
 *
 * Gated on `enforcement.autoRewards` (default OFF): off ⇒ zero writes,
 * zero traffic — the GM keeps clicking Generate/Award exactly as today.
 * XP semantics are copied from the manual Award lane (floor(total/party)) —
 * no fabricated rules. Downtime progression stays on the existing rest
 * flows (§10.3 note: days of downtime remain GM-kept, see §16 [E]).
 * No timers, engine arithmetic only.
 */
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { resolveEnforcement } from '../combat/canTakeAction.js';
import { generateLootFromCombatSummary } from './lootGenerator.js';
import * as logService from '../ui/logService.js';

/**
 * @returns {Promise<{awarded:boolean, reason?:string, xpPerChar?:number}>}
 */
export async function autoAwardCombatRewards({ campaignName, combatSummary, characters = [] }) {
    if (!campaignName || !combatSummary) return { awarded: false, reason: 'no campaign/combat' };
    const flags = resolveEnforcement(getRuntimeValue('campaign', 'enforcement', campaignName));
    if (!flags.autoRewards) return { awarded: false, reason: 'autoRewards off' };

    // Kills-only honesty: a Clear after a RETREAT must not pay out. Only
    // NPCs on 0 HP count toward loot + XP; the loot generator receives just
    // the fallen roster.
    const defeated = (combatSummary.creatures || []).filter((c) => c.type === 'npc' && Number(c.currentHp ?? c.maxHp ?? 1) <= 0);
    if (defeated.length === 0) return { awarded: false, reason: 'no defeated npcs on the tracker' };
    const closingRoster = { ...combatSummary, creatures: defeated };

    const loot = await generateLootFromCombatSummary(closingRoster, characters, campaignName);
    const numChars = characters.length > 0 ? characters.length : 1;
    const xpPerChar = Math.floor((loot?.totalEncounterXp || 0) / numChars);
    const lootItems = (loot?.lootEntries || []).filter((l) => l && l !== 'No loot for these monsters');

    if (lootItems.length > 0) {
        await logService.addEntry(campaignName, {
            type: 'loot',
            encounterName: 'Combat',
            lootItems,
            xpPerChar,
            totalEncounterXp: loot.totalEncounterXp,
        }).catch((e) => { console.error('[autoRewards] loot log failed:', e); });
    }
    await logService.addEntry(campaignName, {
        type: 'encounter',
        action: 'loot_awarded',
        encounterName: 'Combat',
        xpPerChar,
        totalEncounterXp: loot.totalEncounterXp,
        lootItems,
        auto: true,
    }).catch((e) => { console.error('[autoRewards] award log failed:', e); });

    // Normal character-management lane: same runtime 'xp' key the manual
    // Award button writes through.
    for (const charData of characters) {
        const currentXp = getRuntimeValue(charData.name, 'xp', campaignName) || 0;
        setRuntimeValue(charData.name, 'xp', currentXp + xpPerChar, campaignName);
    }

    await logService.addEntry(campaignName, {
        type: 'automation',
        automationType: 'auto_rewards_awarded',
        description: `Auto-rewards at combat close: ${xpPerChar} XP each to ${characters.length} character${characters.length === 1 ? '' : 's'}`
            + ` (encounter ${loot.totalEncounterXp} XP, ${lootItems.length} loot item${lootItems.length === 1 ? '' : 's'}).`,
    }).catch((e) => { console.error('[autoRewards] audit failed:', e); });

    return { awarded: true, xpPerChar };
}
