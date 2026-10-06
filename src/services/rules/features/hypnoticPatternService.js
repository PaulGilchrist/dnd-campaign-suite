import { executeHandler } from '../../automation/index.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const HYPNO_CONDITIONS = ['charmed', 'incapacitated', 'speed_zero'];

const HYPNO_DISPLAY_NAMES = { charmed: 'Charmed', incapacitated: 'Incapacitated', speed_zero: 'Speed_zero' };

// SP-069: "The spell ends for an affected creature if it takes any damage."
// Per-creature break: strips ONLY this creature's Hypnotic Pattern conditions and
// logs — other affected creatures keep theirs, caster concentration untouched.
// Fingerprint: Hypnotic Pattern stamps the charmed+incapacitated+speed_zero trio
// together; Confusion charms without incapacitated and domination rides its own
// repeat-save lane, so the trio uniquely identifies hypno-affected creatures.
export function breakHypnoticPatternOnDamage(targetName, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(stored) ? stored : [];
    const lower = conditions.map(c => String(c).toLowerCase());
    if (!(lower.includes('charmed') && lower.includes('incapacitated') && lower.includes('speed_zero'))) {
        return false;
    }

    const filtered = conditions.filter(c => !HYPNO_CONDITIONS.includes(String(c).toLowerCase()));
    setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);

    for (const cond of HYPNO_CONDITIONS) {
        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: HYPNO_DISPLAY_NAMES[cond],
            reason: 'Took damage (Hypnotic Pattern)',
            timestamp: Date.now(),
        }).catch((e) => { console.error('[hypnoticPatternService:log-error]', e); });
    }

    addEntry(campaignName, {
        type: 'automation',
        automation: 'hypnotic_pattern_broken',
        characterName: targetName,
        description: `${targetName} took damage — Hypnotic Pattern ends for it.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[hypnoticPatternService:log-error]', e); });

    return true;
}

export async function triggerHypnoticPattern(spell, metaCtx, playerStats, campaignName, mapName) {
    const isHypnoticPattern = (spell.name || '').toLowerCase() === 'hypnotic pattern';
    if (!isHypnoticPattern) return null;

    let spellSaveDc;
    if (metaCtx?.spellSaveDc == null) {
        if (playerStats.spellAbilities?.saveDc == null) {
          if (playerStats.proficiency == null) {
            console.error('[hypnoticPatternService] triggerHypnoticPattern: playerStats.proficiency is missing')
            throw new Error('playerStats.proficiency is required for hypnotic pattern')
          }
          spellSaveDc = 8 + playerStats.proficiency;
        } else {
          spellSaveDc = playerStats.spellAbilities.saveDc;
        }
      } else {
        spellSaveDc = metaCtx.spellSaveDc;
      }
    if (metaCtx?.slotLevel == null && spell.level == null) {
        console.error('[hypnoticPatternService] triggerHypnoticPattern: slot level is missing (metaCtx.slotLevel and spell.level)')
        throw new Error('slot level is required for hypnotic pattern')
      }
      const slotLevel = metaCtx?.slotLevel || spell.level;

    const action = {
        name: spell.name,
        automation: {
            type: 'hypnotic_pattern',
            saveDc: spellSaveDc,
            saveType: 'WIS',
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[hypnoticPatternService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
