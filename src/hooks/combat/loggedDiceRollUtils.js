import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasMinDamage } from '../../services/combat/automation/automationService.js';
import { loadMapData } from '../../services/maps/mapsService.js';

export function dispatchUnbreakableMajestySave(campaignName, defenderName, attackerName, saveDc, promptId) {
    sendSavePrompt(campaignName, {
        promptId,
        targetName: attackerName,
        saveType: 'CHA',
        saveDc,
        sourceName: defenderName,
    });
}

export async function readAoeContext(campaignName, overlayId) {
    if (!campaignName || !overlayId) return null;
    try {
        const overlayRes = await fetch(`/spell-overlay?campaign=${encodeURIComponent(campaignName)}`);
        if (!overlayRes.ok) return null;
        const { overlays } = await overlayRes.json();
        const overlay = overlays?.find(o => o.id === overlayId);
        if (!overlay) return null;

        const activeRes = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/active-map`);
        if (!activeRes.ok) return null;
        const { activeMapName } = await activeRes.json();
        if (!activeMapName) return null;

        const mapData = await loadMapData(campaignName, activeMapName);
        if (!mapData) return null;
        return {
            overlay,
            players: mapData.players || [],
            npcs: mapData.placedItems || [],
        };
    } catch (err) {
        console.error('[readAoeContext] Error:', err);
        return null;
    }
}

export function hasPotentCantrip(playerStats) {
    if (!playerStats) return false;
    const passives = playerStats?.automation?.passives || [];
    return passives.some(p => p.type === 'potent_cantrip');
}

export function getShieldAcBonus(characterName, campaignName) {
    const activeBuffs = getRuntimeValue(characterName, 'activeBuffs', campaignName) || [];
    const shieldActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield');
    return shieldActive ? 5 : 0;
}

export function getShieldOfFaithAcBonus(characterName, campaignName) {
    const activeBuffs = getRuntimeValue(characterName, 'activeBuffs', campaignName) || [];
    const shieldOfFaithActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield_of_faith');
    return shieldOfFaithActive ? 2 : 0;
}

export function isMagicMissileImmune(characterName, campaignName) {
    const activeBuffs = getRuntimeValue(characterName, 'activeBuffs', campaignName) || [];
    return Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield');
}

export function getSoulstitchProtectedCreatures(playerName, campaignName) {
    const key = `_${playerName.replace(/\s+/g, '_')}_Soulstitch_Spells_active`;
    const stored = getRuntimeValue(playerName, key, campaignName);
    return Array.isArray(stored) ? stored : [];
}

export function hasSoulstitchProtection(targetName, playerName, campaignName) {
    const protectedList = getSoulstitchProtectedCreatures(playerName, campaignName);
    return protectedList.includes(targetName);
}

export function applyMinDamageAdjustment(rawDamage, rolls, playerStats, damageType) {
    if (!playerStats || !damageType || !rolls || !Array.isArray(rolls) || rolls.length === 0) {
        return rawDamage;
    }
    const hasMin = hasMinDamage(playerStats, damageType);
    if (!hasMin) return rawDamage;
    const onesCount = rolls.filter(r => r === 1).length;
    if (onesCount === 0) return rawDamage;
    return rawDamage + onesCount;
}
