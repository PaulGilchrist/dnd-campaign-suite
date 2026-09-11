import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { parseMagicItemName } from '../../../rules/core/attackCalc.js';
import { addEntry } from '../../../ui/logService.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { checkOncePerTurnWithSkip } from '../../../automation/common/oncePerTurn.js';
import { addCondition } from '../../../../services/combat/conditions/conditionSaveService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

// FT-082 collateral: restore the stashed base weapon attack as campaign
// lastAttack after the Shield Bash save resolution clobbered it with a
// save record ({attackName:'Shield Bash', damageType:null}). Without this,
// Slasher Hamstring (slashing_damage_hit) falsely refuses on shield holders
// within the same turn. Clears the stash afterwards.
export async function restoreBaseAttackAfterBash(playerStats, campaignName) {
  const stash = getRuntimeValue(playerStats.name, '_shieldBashBaseAttack', campaignName);
  // A valid stash is the base attack object; ignore null/arrays/empty.
  if (!stash || typeof stash !== 'object' || Array.isArray(stash) || !stash.attackName) return;
  if (stash.attackName !== 'Shield Bash') {
    await setRuntimeValue('campaign', 'lastAttack', stash, campaignName);
  }
  await setRuntimeValue(playerStats.name, '_shieldBashBaseAttack', null, campaignName);
}

function hasShieldEquipped(playerStats) {
  return playerStats.inventory?.equipped?.some(itemName => {
    const { baseName } = parseMagicItemName(itemName);
    const eq = playerStats.equipment?.find(e => e.name === baseName);
    return eq && (eq.armor_category === 'Shield' || eq.equipment_category === 'Shield');
  });
}

function isShieldBashAttackValid(lastAttack, playerStats) {
  return !!lastAttack?.hit &&
    lastAttack.attackerName === playerStats.name &&
    lastAttack.weaponType === 'melee' &&
    !!lastAttack.targetName;
}

function resolveShieldBashSaveDc(passives, hasNewStyle, playerStats) {
  const shieldBashPassive = hasNewStyle
    ? passives.find(p => p.type === 'attack_rider' && p.effect === 'push_or_prone')
    : passives.find(p => p.type === 'attack_rider' && p.trigger === 'melee_hit_with_shield_equipped');

  if (shieldBashPassive?.automation) {
    return buildSaveDc(shieldBashPassive.automation, playerStats);
  }
  return 8 + (playerStats.abilities?.find(a => a.name === 'Strength')?.bonus || 0) + (playerStats.proficiency || 0);
}

function logShieldBashSaveResult(ctx, saveResult, targetName, saveDc, success) {
  addEntry(ctx.campaignName, {
    type: 'roll',
    name: 'Shield Bash',
    characterName: ctx.playerStats.name,
    rollType: 'save-damage',
    targetName,
    saveDc,
    saveType: 'STR',
    saveResult: success ? 'success' : 'failure',
    total: saveResult.total ?? 0,
    rolls: [saveResult.roll ?? 0],
    bonus: saveResult.saveBonus ?? 0,
    formula: `1d20${saveResult.saveBonus !== 0 ? '+' + saveResult.saveBonus : ''}`,
    description: `${targetName} ${success ? 'succeeded' : 'failed'} the STR save (DC ${saveDc}).${!success ? ' Shield Bash effect applied.' : ''}`,
    timestamp: Date.now(),
  }).catch((e) => { console.error("[shieldBash:log-error]", e); });
}

export const shieldBash = {
  name: 'shieldBash',
  condition: (ctx) => !!ctx.playerStats.automation?.passives,
  handler: async (ctx, prevData) => {
    const passives = ctx.playerStats.automation?.passives || [];

    // Check for old-style (5e) or new-style (2024) Shield Bash
    const hasOldStyle = passives.some(
      p => p.type === 'attack_rider' && p.trigger === 'melee_hit_with_shield_equipped' && p.options?.length > 0
    );
    const hasNewStyle = passives.some(
      p => p.type === 'attack_rider' && p.effect === 'push_or_prone' && p.oncePerTurn
    );

    if (!hasOldStyle && !hasNewStyle) return null;

    // Validate lastAttack: must be player's melee weapon attack that hit
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', ctx.campaignName);

    if (!isShieldBashAttackValid(lastAttack, ctx.playerStats)) return { data: prevData };

    const targetName = lastAttack.targetName;

    // FT-074: target must be within 5 ft (lenient true when gridless/unplaced)
    const withinFive = await isWithinRange(ctx.playerStats.name, targetName, 5);
    if (!withinFive) return { data: prevData };

    if (!hasShieldEquipped(ctx.playerStats)) return { data: prevData };

    // Check oncePerTurn with skip support
    const usedKey = '_Shield_Bash_usedRound';
    const skipKey = '_Shield_Bash_skippedRound';
    const skipResult = await checkOncePerTurnWithSkip('Shield Bash', usedKey, skipKey, ctx.playerStats, ctx.campaignName);
    if (skipResult) return { data: prevData };

    // Build save DC: 8 + STR modifier + proficiency bonus
    const saveDc = resolveShieldBashSaveDc(passives, hasNewStyle, ctx.playerStats);

    // FT-082 collateral: resolving the bash save overwrites campaign lastAttack
    // with a save record ({attackName:'Shield Bash', damageType:null}), which
    // makes same-turn slashing riders (Slasher Hamstring) falsely refuse on
    // shield holders. Stash the base weapon attack here and restore it after
    // the bash resolves (step success path below / applyShieldBashEffect).
    await setRuntimeValue(ctx.playerStats.name, '_shieldBashBaseAttack', lastAttack, ctx.campaignName);

    // Create STR save prompt
    const { promise } = createSaveListener(ctx.campaignName, {
      targetName,
      saveType: 'STR',
      saveDc,
      dcSuccess: false,
      sourceName: 'Shield Bash',
    });

    addEntry(ctx.campaignName, {
      type: 'roll',
      name: 'Shield Bash',
      characterName: ctx.playerStats.name,
      rollType: 'save-damage',
      targetName,
      saveDc,
      saveType: 'STR',
      description: `Shield Bash: ${targetName} must make a STR saving throw (DC ${saveDc}).`,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[shieldBash:log-error]", e); });

    const saveResult = await promise;
    const success = saveResult.success;

    logShieldBashSaveResult(ctx, saveResult, targetName, saveDc, success);

    if (success) {
      // FT-082 collateral: put the base slashing attack back as lastAttack.
      await restoreBaseAttackAfterBash(ctx.playerStats, ctx.campaignName);
      return { data: prevData };
    }

    // On failed save — show modal for push/prone/skip choice
    return {
      modal: {
        type: 'shieldBash',
        props: {
          action: {
            name: 'Shield Bash',
            options: [
              { name: 'Push', effect: 'push', value: 5 },
              { name: 'Prone', effect: 'prone' },
            ],
          },
          playerStats: ctx.playerStats,
          campaignName: ctx.campaignName,
          targetName,
          saveDc,
        },
      },
      data: prevData,
    };
  },
};

export async function applyShieldBashEffect(action, playerStats, campaignName, targetName, chosenOption, saveDc) {
  const auto = action.automation || {};
  const effs = getRuntimeValue('campaign', 'targetEffects') || [];
  const storedEffects = [...effs];

  // FT-082 collateral: the bash save resolution clobbered campaign
  // lastAttack — restore the base weapon attack so same-turn slashing
  // riders (Slasher Hamstring) stay correctly gated on shield holders.
  // Runs for every modal outcome (skip/Push/Prone).
  await restoreBaseAttackAfterBash(playerStats, campaignName);

  if (chosenOption === 'skip') {
    addEntry(campaignName, {
      type: 'ability_use',
      characterName: playerStats.name,
      abilityName: 'Shield Bash',
      description: `Shield Bash: skipped (no effect, use not consumed).`,
    }).catch((e) => { console.error("[shieldBash:log-error]", e); });
    return null;
  }

  if (chosenOption === 'Push') {
    const newEffect = {
      target: targetName,
      source: 'Shield Bash',
      option: 'Push',
      effect: 'push',
      value: 5,
      duration: 'instant',
    };
    setRuntimeValue('campaign', 'targetEffects', [...storedEffects, newEffect], campaignName);

    addEntry(campaignName, {
      type: 'ability_use',
      characterName: playerStats.name,
      abilityName: 'Shield Bash',
      description: `Shield Bash used against ${targetName}: pushed 5 ft.`,
    }).catch((e) => { console.error("[shieldBash:log-error]", e); });
  } else if (chosenOption === 'Prone') {
    const newEffect = {
      target: targetName,
      source: 'Shield Bash',
      option: 'Prone',
      effect: 'prone_and_push',
      value: 5,
      duration: 'until_start_of_next_turn',
      saveType: 'STR',
      saveDc,
      saveAbility: 'STR',
    };
    setRuntimeValue('campaign', 'targetEffects', [...storedEffects, newEffect], campaignName);

    const cs = await getCombatContext(campaignName);
    const conditionDef = { key: 'prone', label: 'Prone' };
    addCondition(cs, targetName, conditionDef, saveDc, 'STR', getRuntimeValue, setRuntimeValue, campaignName, playerStats);

    addEntry(campaignName, {
      type: 'ability_use',
      characterName: playerStats.name,
      abilityName: 'Shield Bash',
      description: `Shield Bash used against ${targetName}: target has Prone condition.`,
    }).catch((e) => { console.error("[shieldBash:log-error]", e); });
  }

  // Mark oncePerTurn as used — stamp the holder's name (FT-074): the
  // cs.activeCreatureName mirror can be stale mid-combat and corrupt re-arm.
  const cs = await getCombatContext(campaignName);
  const currentRound = cs?.round || 1;
  await setRuntimeValue(playerStats.name, '_Shield_Bash_usedRound', { round: currentRound, activeCreature: playerStats.name }, campaignName);

  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Shield Bash',
      description: chosenOption === 'skip'
        ? `Shield Bash: ${targetName} was not affected (skipped).`
        : `Shield Bash: ${targetName} ${chosenOption === 'Push' ? 'pushed 5 ft' : 'has Prone condition'}.`,
      automation: auto,
    },
  };
}
