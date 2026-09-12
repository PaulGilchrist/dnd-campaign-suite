import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { findLastAttack, rollbackSpellEffects } from '../../common/damageRollback.js';
import { infoPopup } from '../../common/infoPopup.js';

function looksLikeSpellAttack(attackEvent) {
    return attackEvent.damageFormula ||
           attackEvent.attackName ||
           attackEvent.saveType ||
           attackEvent.rollType === 'spell-save';
}

// CLA-322: reaction-spent round latch check + slot refund. Returns a refusal
// popup when this round's Reaction is spent, null otherwise.
function counterspellRoundRefusal(playerName, featureName, auto, action, campaignName, currentRound) {
    const usedRoundKey = '_Counterspell_usedRound';
    const usedRound = Number(getRuntimeValue(playerName, usedRoundKey, campaignName) ?? 0);
    if (usedRound !== currentRound) return null;

    // The cast path paid the slot before this handler ran — the reaction was
    // not used, so return the charge to keep the slot ledger neutral.
    const refusedLevel = (action.spell?.isUpcast && action.spell?.upcastLevel) || action.spell?.level || 3;
    const refusedKey = `spell_slots_level_${refusedLevel}`;
    if (!action.spell?.freeCastAuthorized) {
        const paidSlots = getRuntimeValue(playerName, refusedKey, campaignName);
        if (paidSlots != null && paidSlots >= 0) {
            setRuntimeValue(playerName, refusedKey, paidSlots + 1, campaignName);
        }
    }
    return infoPopup(featureName, `${featureName} — Reaction already used this round. Spell slot level ${refusedLevel} returned.`, auto);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Counterspell';

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return infoPopup(featureName, `${featureName} requires an active combat. Select a creature in combat and try again.`, auto);
    }

    const lastAttack = await findLastAttack(campaignName);
    if (!lastAttack.attackEvent) {
        return infoPopup(featureName, `${featureName} — No recent attack to counter.`, auto);
    }

    if (!looksLikeSpellAttack(lastAttack.attackEvent)) {
        return infoPopup(featureName, `${featureName} — No spell detected in the most recent attack.`, auto);
    }

    const attackerName = lastAttack.attackEvent.attackerName;
    if (!attackerName) {
        return infoPopup(featureName, `${featureName} — Could not identify the spellcaster.`, auto);
    }

    const attackerCreature = cs.creatures.find(c => c.name === attackerName);
    if (!attackerCreature) {
        return infoPopup(featureName, `${featureName} — ${attackerName} is not in combat.`, auto);
    }

    // CLA-322: reaction-spent round latch (CLA-297 house pattern, stamped on
    // playerStats.name) — a used Counterspell must not re-trigger repeatedly
    // against the same lastAttack; re-arms when the round advances.
    const refusal = counterspellRoundRefusal(playerName, featureName, auto, action, campaignName, cs.round || 1);
    if (refusal) return refusal;
    setRuntimeValue(playerName, '_Counterspell_usedRound', cs.round || 1, campaignName);

    const saveDc = buildSaveDc(auto, playerStats);

    const { promptId } = createSaveListener(campaignName, {
        targetName: attackerName,
        saveType: 'CON',
        saveDc,
        disadvantage: !!action.metaCtx?.metamagicHeighten,
    });

    const spellName = lastAttack.attackEvent.attackName || 'unknown spell';
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName} triggered — Countering ${attackerName}'s '${spellName}'. ${attackerName} must make CON save (DC ${saveDc})`,
        promptId,
    }).catch((e) => { console.error("[counterSpell] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        const spellResult = event.detail.success ? 'succeeded' : 'failed';
        const counterspellResult = event.detail.success ? 'fails to counter' : 'counters';

        window.dispatchEvent(new CustomEvent('counterspell-save-result', {
            detail: {
                promptId,
                attackerName,
                spellName,
                saveDc,
                success: event.detail.success,
                spellResult,
                counterspellResult,
            },
        }));

        if (!event.detail.success) {
            const rolledBack = await rollbackSpellEffects(lastAttack.attackEvent, campaignName, featureName, cs);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                rollType: `save-${auto.type}`,
                targetName: attackerName,
                saveDc,
                saveType: 'CON',
                success: false,
                description: `${attackerName} failed CON save. ${featureName} counters '${spellName}'!`,
            }).catch((e) => { console.error("[counterSpell] Error:", e); });

            if (rolledBack.logDescription) {
                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: featureName,
                    description: rolledBack.logDescription,
                }).catch((e) => { console.error("[counterSpell] Error:", e); });
            }
        } else {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                rollType: `save-${auto.type}`,
                targetName: attackerName,
                saveDc,
                saveType: 'CON',
                success: true,
                description: `${attackerName} succeeded on CON save. ${featureName} fails to counter '${spellName}'.`,
            }).catch((e) => { console.error("[counterSpell] Error:", e); });

            const passives = playerStats.automation?.passives;
            const spellBreaker = passives?.find(p => p.type === 'spell_breaker');
            if (spellBreaker && spellBreaker.slotRetentionSpells?.includes('Counterspell')) {
                // CLA-322: refund keyed by the ACTUAL cast slot level (upcast-safe),
                // not hardcoded level 3, and logged (house rule: every automation logs).
                const castLevel = (action.spell?.isUpcast && action.spell?.upcastLevel) || action.spell?.level || 3;
                const slotKey = `spell_slots_level_${castLevel}`;
                const currentSlots = getRuntimeValue(playerName, slotKey);
                if (currentSlots != null && currentSlots >= 0) {
                    setRuntimeValue(playerName, slotKey, currentSlots + 1, campaignName);
                    addEntry(campaignName, {
                        type: 'ability_use',
                        characterName: playerName,
                        abilityName: 'Spell Breaker',
                        description: `Spell Breaker: Counterspell failed to counter '${spellName}' — spell slot level ${castLevel} refunded.`,
                    }).catch((e) => { console.error('[counterSpell] Error:', e); });
                }
            }
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            targetName: attackerName,
            description: `${attackerName}'s '${spellName}' is being countered — ${attackerName} must make a CON saving throw (DC ${saveDc}).`,
            automation: auto,
        },
    };
}
