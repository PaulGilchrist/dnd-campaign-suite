import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasMinDamage } from '../../services/combat/automation/automationService.js';

export function dispatchUnbreakableMajestySave(campaignName, defenderName, attackerName, saveDc, promptId) {
    sendSavePrompt(campaignName, {
        promptId,
        targetName: attackerName,
        saveType: 'CHA',
        saveDc,
        sourceName: defenderName,
    });
}

export function readAoeContext(campaignName) {
  try {
    const stored = localStorage.getItem(`aoeContext-${campaignName}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
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
