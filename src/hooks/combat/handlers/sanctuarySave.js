// NOTE: near-duplicate of ./handleSanctuarySave.js (damage path) — diverged signatures;
// merging is a behavioral change, tracked in .opencode/plans/analysis_report.md (Duplication #1).
// This file is the attack path, imported by ../useLoggedDiceRollAttack.js.
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import utils from '../../../services/ui/utils.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { addTargetResult } from '../../../services/automation/common/damageRollback.js';
import { addEntry } from '../../../services/ui/logService.js';

export async function handleSanctuarySave(attackerName, targetName, campaignName, setPopupHtml, _logEntry) {
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const sanctuaryEffect = allTargetEffects.find(
        te => te.effect === 'sanctuary' && te.target === targetName && te.source !== attackerName
    );
    if (!sanctuaryEffect) return true;

    const sanctuaryCaster = sanctuaryEffect.source;
    const saveDc = sanctuaryEffect.saveDc || (() => {
        console.error('[sanctuary] Missing saveDc on targetEffect for target', targetName, '— defaulting to 8');
        return 8;
    })();

    const promptId = utils.guid();
    const pendingSaves = getRuntimeValue('campaign', 'pendingSavePrompts') || {};
    pendingSaves[promptId] = {
        promptId,
        campaignName,
        targetName: attackerName,
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
        targetName: attackerName,
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
            const saves = getRuntimeValue('campaign', 'pendingSavePrompts') || {};
            delete saves[promptId];
            setRuntimeValue('campaign', 'pendingSavePrompts', saves, campaignName);
            resolve(event.detail);
        };
        window.addEventListener('save-result', handler);
    });

    if (!saveResult.success) {
        await addTargetResult(campaignName, {
            targetName: attackerName,
            saveResult: 'failure',
            roll: saveResult.roll ?? 0,
            total: saveResult.total ?? 0,
            conditions: ['sanctuary'],
            appliedDamage: 0,
        });
        await addEntry(campaignName, {
            type: 'save_result',
            characterName: sanctuaryCaster,
            targetName: attackerName,
            saveDc: saveDc,
            saveType: 'WIS',
            success: false,
            description: `${attackerName} failed WIS save against Sanctuary on ${targetName} — attack is lost.`,
        }).catch((e) => { console.error("[sanctuary] Error logging:", e); });
        setPopupHtml({
            type: 'automation_info',
            name: 'Sanctuary',
            description: `${attackerName} failed WIS save against Sanctuary on ${targetName}. The attack is lost.`,
        });
        return false;
    }

    await addTargetResult(campaignName, {
        targetName: attackerName,
        saveResult: 'success',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [],
        appliedDamage: 0,
    });
    await addEntry(campaignName, {
        type: 'save_result',
        characterName: sanctuaryCaster,
        targetName: attackerName,
        saveDc: saveDc,
        saveType: 'WIS',
        success: true,
        description: `${attackerName} succeeded on WIS save against Sanctuary on ${targetName} — attack proceeds.`,
    }).catch((e) => { console.error("[sanctuary] Error logging:", e); });

    return true;
}
