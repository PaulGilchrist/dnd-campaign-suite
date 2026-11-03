// NOTE: near-duplicate of ./sanctuarySave.js (attack path) — diverged signatures;
// merging is a behavioral change, tracked in .opencode/plans/analysis_report.md (Duplication #1).
// This file is the damage path, imported by ../useLoggedDiceRollDamage.js.
import { addEntry } from '../../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { setSavePromptBucket } from '../../../services/automation/common/savePrompt.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import utils from '../../../services/ui/utils.js';

export async function handleSanctuarySave(characterName, campaignName, context, _logEntry) {
    if (context?.targetName && context?.saveDc && context?.saveType) {
        const sanctuaryEffect = (getRuntimeValue('campaign', 'targetEffects') || []).find(
            te => te.effect === 'sanctuary' && te.target === context.targetName && te.source !== characterName
        );
        if (sanctuaryEffect) {
            const sanctuaryCaster = sanctuaryEffect.source;
            const saveDc = sanctuaryEffect.saveDc || (() => {
                console.error('[sanctuary] Missing saveDc on targetEffect for target', context.targetName, '— defaulting to 8');
                return 8;
            })();

            const promptId = utils.guid();
            const pendingSaves = getRuntimeValue('campaign', 'pendingSavePrompts') || {};
            pendingSaves[promptId] = {
                promptId,
                campaignName,
                targetName: characterName,
                attackerName: sanctuaryCaster,
                saveType: 'WIS',
                saveDc: saveDc,
                dcSuccess: 'none',
                disadvantage: false,
                advantage: false,
                condition: 'sanctuary',
                sourceName: sanctuaryCaster,
            };
            setRuntimeValue('campaign', 'pendingSavePrompts', pendingSaves, campaignName);

            sendSavePrompt(campaignName, {
                promptId,
                targetName: characterName,
                attackerName: sanctuaryCaster,
                saveType: 'WIS',
                saveDc: saveDc,
                dcSuccess: 'none',
                disadvantage: false,
                advantage: false,
                condition: 'sanctuary',
                sourceName: sanctuaryCaster,
            });

            const saveResult = await new Promise((resolve) => {
                const handler = (event) => {
                    if (event.detail.promptId !== promptId) return;
                    window.removeEventListener('save-result', handler);
                    const saves = { ...(getRuntimeValue('campaign', 'pendingSavePrompts') || {}) };
                    delete saves[promptId];
                    // Drain-to-evict: resolving the LAST row deletes the bucket
                    // key instead of persisting {} (setSavePromptBucket).
                    setSavePromptBucket(campaignName, 'pendingSavePrompts', saves);
                    resolve(event.detail);
                };
                window.addEventListener('save-result', handler);
            });

            if (!saveResult.success) {
                await addEntry(campaignName, {
                    type: 'save_result',
                    characterName: sanctuaryCaster,
                    targetName: characterName,
                    saveDc: saveDc,
                    saveType: 'WIS',
                    success: false,
                    description: `${characterName} failed WIS save against Sanctuary on ${context.targetName} — attack is lost.`,
                }).catch((e) => { console.error("[sanctuary] Error logging:", e); });
                return { blocked: true, description: `${characterName} failed WIS save against Sanctuary on ${context.targetName}. The spell is lost.` };
            }

            await addEntry(campaignName, {
                type: 'save_result',
                characterName: sanctuaryCaster,
                targetName: characterName,
                saveDc: saveDc,
                saveType: 'WIS',
                success: true,
                description: `${characterName} succeeded on WIS save against Sanctuary on ${context.targetName}.`,
            }).catch((e) => { console.error("[sanctuary] Error logging:", e); });
        }
    }
    return { blocked: false };
}
