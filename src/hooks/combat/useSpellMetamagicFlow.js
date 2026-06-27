import React from 'react'
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from './useMetamagic.js'
import { addEntry } from '../../services/ui/logService.js'
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js'
import { getCombatSummary } from '../../services/encounters/combatData.js'
import { isPsionicSpell, hasPsionicSorcery } from '../../services/rules/spells/metamagicRules.js'
import { confirmRemoveCurse } from '../../services/rules/features/removeCurseService.js'
import {
    applyAidEffect,
    applyHeroesFeastEffect,
    applyLesserRestorationEffect,
    applyMageArmorEffect,
    applyProtectionFromEnergyHandler,
    applyResistanceEffect,
    applyShieldOfFaithEffect,
} from '../../services/automation/index.js'
import { useConfirmableFlow } from './useConfirmableFlow.js'

function getCreatureTargets(excludeName, campaignName) {
  const cs = getCombatSummary(campaignName);
  if (!cs?.creatures) return [];
  return cs.creatures
    .filter(c => c.name !== excludeName)
    .map(c => c.name);
}

export function useSpellMetamagicFlow(playerStats, campaignName, onExecute) {
  const isSorcerer = playerStats?.class?.name === 'Sorcerer';
  const { setPending: cfSetPending, getPending, createConfirmHandler, createSkipHandler, clearPending: cfClearPending } = useConfirmableFlow(playerStats, campaignName);

  const pendingMetamagic = getPending('metamagic');
  const pendingMultiTarget = getPending('multiTarget');
  const pendingAid = getPending('aid');
  const pendingHeroesFeast = getPending('heroesFeast');
  const pendingGreaterRestoration = getPending('greaterRestoration');
  const pendingLesserRestoration = getPending('lesserRestoration');
  const pendingMageArmor = getPending('mageArmor');
  const pendingShieldOfFaith = getPending('shieldOfFaith');
  const pendingProtectionFromEnergy = getPending('protectionFromEnergy');
  const pendingResistance = getPending('resistance');
  const pendingRemoveCurse = getPending('removeCurse');
  const pendingMagicMissile = getPending('magicMissile');

  const gateMetamagic = React.useCallback((spell, metaCtx = {}) => {
    const isGreaterRestoration = (spell.name || '').toLowerCase() === 'greater restoration';
    const isLesserRestoration = (spell.name || '').toLowerCase() === 'lesser restoration';
    const isRemoveCurse = (spell.name || '').toLowerCase() === 'remove curse';
    const isAid = (spell.name || '').toLowerCase() === 'aid';

    if (isLesserRestoration) {
      const cs = getCombatSummary(campaignName);
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        cfSetPending('lesserRestoration', {
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: spell.range || 'Touch',
          creatureTargets,
        });
        return;
      }
    }

    if (isGreaterRestoration) {
      const cs = getCombatSummary(campaignName);
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        cfSetPending('greaterRestoration', {
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: spell.range || 'Touch',
          creatureTargets,
        });
        return;
      }
    }

    if (isRemoveCurse) {
      const cs = getCombatSummary(campaignName);
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        cfSetPending('removeCurse', {
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: spell.range || 'Touch',
          creatureTargets,
        });
        return;
      }
    }

    if (isAid) {
      const cs = getCombatSummary(campaignName);
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        cfSetPending('aid', {
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: spell.range || '30 feet',
          maxTargets: 3,
          creatureTargets,
        });
        return;
      }
    }

    const isHeroesFeast = (spell.name || '').toLowerCase() === "heroes' feast";
    if (isHeroesFeast) {
      const cs = getCombatSummary(campaignName);
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        cfSetPending('heroesFeast', {
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: spell.range || 'Self',
          maxTargets: 12,
          creatureTargets,
        });
        return;
      }
    }

    const isMageArmor = (spell.name || '').toLowerCase() === 'mage armor';
    if (isMageArmor) {
      const cs = getCombatSummary(campaignName);
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        cfSetPending('mageArmor', {
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: spell.range || 'Touch',
          creatureTargets,
        });
        return;
      }
    }

    const isShieldOfFaith = (spell.name || '').toLowerCase() === 'shield of faith';
    if (isShieldOfFaith) {
      const cs = getCombatSummary(campaignName);
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        cfSetPending('shieldOfFaith', {
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: spell.range || '60 feet',
          creatureTargets,
        });
        return;
      }
    }

    const isProtectionFromEnergy = (spell.name || '').toLowerCase() === 'protection from energy';
    if (isProtectionFromEnergy) {
      const cs = getCombatSummary(campaignName);
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        cfSetPending('protectionFromEnergy', {
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: spell.range || 'Touch',
          creatureTargets,
          damageTypes: spell.automation?.damageTypes || ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
        });
        return;
      }
    }

    const isResistance = (spell.name || '').toLowerCase() === 'resistance';
    if (isResistance) {
      const cs = getCombatSummary(campaignName);
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        cfSetPending('resistance', {
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: spell.range || 'Touch',
          creatureTargets,
          damageTypes: ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Radiant', 'Slashing', 'Thunder'],
        });
        return;
      }
    }

    const isMagicMissile = (spell.name || '').toLowerCase() === 'magic missile';
    if (isMagicMissile) {
      const cs = getCombatSummary(campaignName);
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        const slotLevel = spell.level || 1;
        const totalMissiles = 3 + (slotLevel - 1);
        cfSetPending('magicMissile', {
          spell,
          totalMissiles,
          missileDamage: '1d4 + 1',
          creatureTargets,
        });
        return;
      }
    }

    const multiTargetSpread = getMultiTargetSpreadForSpell(playerStats, spell.name);

    if (multiTargetSpread) {
      const creatureTargets = getCreatureTargets(playerStats?.name, campaignName);
      if (creatureTargets.length > 0) {
        cfSetPending('multiTarget', {
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: multiTargetSpread.range || '10 ft',
          creatureTargets,
        });
        return;
      }
    }

    if (!isSorcerer) {
      addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        spellName: spell.name,
        spellLevel: spell.level || 0,
        castingTime: spell.casting_time,
        metamagic: [],
        spCost: 0,
        timestamp: Date.now(),
      });
      onExecute(spell, metaCtx);
      return;
    }

    const spellLevel = spell.level || 0;
    const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
    const isPsionic = isPsionicSpell(playerStats, spell.name);
    const hasPsionic = hasPsionicSorcery(playerStats);

    cfSetPending('metamagic', {
      spell,
      spellName: spell.name,
      spellLevel: spell.level || 0,
      castingTime: spell.casting_time,
      _currentSP: currentSP,
      isPsionic: isPsionic && hasPsionic,
      psionicCost: isPsionic && hasPsionic ? spellLevel : 0,
      _metaCtx: metaCtx,
    });
    }, [isSorcerer, playerStats, campaignName, onExecute, cfSetPending]);

  const handleConfirm = React.useCallback((result) => {
    const pending = pendingMetamagic;
    if (!pending) return;

    cfClearPending('metamagic');

    let totalMetamagicCost = result?.totalCost || 0;
    let psionicCost = 0;

    if (pending.isPsionic && !result?.options?.includes('Subtle Spell')) {
      psionicCost = pending.psionicCost;
    }

    const totalCost = totalMetamagicCost + psionicCost;
    if (totalCost > 0) {
      spendSorceryPoints(playerStats.name, totalCost, campaignName, getMaxSorceryPoints(playerStats));
    }

    const metamagicOptions = result?.options || [];
    if (psionicCost > 0 && !metamagicOptions.includes('Psionic Sorcery')) {
      metamagicOptions.push('Psionic Sorcery');
    }

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: metamagicOptions,
      spCost: totalCost,
      timestamp: Date.now(),
    });

    const metaCtx = { ...pending._metaCtx };
    if (result?.options) {
      if (result.options.includes('Heightened Spell')) metaCtx.metamagicHeighten = true;
      if (result.options.includes('Careful Spell')) metaCtx.metamagicCareful = true;
      if (result.options.includes('Twinned Spell') && result.twinTarget) metaCtx.metamagicTwinTarget = result.twinTarget;
      if (result.options.includes('Distant Spell')) metaCtx.metamagicDistant = true;
    }
    if (psionicCost > 0) {
      metaCtx.psionicSpell = true;
    }

    onExecute(pending.spell, metaCtx);
  }, [pendingMetamagic, playerStats, campaignName, onExecute, cfClearPending]);

  const handleSkip = React.useCallback(() => {
    const pending = pendingMetamagic;
    if (!pending) return;

    cfClearPending('metamagic');

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: [],
      spCost: 0,
      timestamp: Date.now(),
    });

    onExecute(pending.spell, {});
  }, [pendingMetamagic, playerStats.name, campaignName, onExecute, cfClearPending]);

  const handleMultiTargetConfirm = React.useCallback((result) => {
    const pending = pendingMultiTarget;
    if (!pending) return;

    cfClearPending('multiTarget');

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: ['Words of Creation'],
      spCost: 0,
      timestamp: Date.now(),
    });

    const metaCtx = {};
    if (result?.secondTarget) {
      metaCtx.multiTarget = result.secondTarget;
    }

    onExecute(pending.spell, metaCtx);
  }, [pendingMultiTarget, playerStats, campaignName, onExecute, cfClearPending]);

  const handleMultiTargetSkip = React.useCallback(() => {
    const pending = pendingMultiTarget;
    if (!pending) return;

    cfClearPending('multiTarget');

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: [],
      spCost: 0,
      timestamp: Date.now(),
    });

    onExecute(pending.spell, {});
  }, [pendingMultiTarget, playerStats, campaignName, onExecute, cfClearPending]);

  const handleAidConfirm = createConfirmHandler('aid', async (pending, result) => {
    await applyAidEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'aid', range: pending.range, maxTargets: pending.maxTargets } },
      playerStats,
      campaignName,
      null,
      result
    );
  });

  const handleAidSkip = createSkipHandler('aid');

  const handleHeroesFeastConfirm = createConfirmHandler('heroesFeast', async (pending, result) => {
    await applyHeroesFeastEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'heroes_feast', range: pending.range, maxTargets: pending.maxTargets } },
      playerStats,
      campaignName,
      null,
      result
    );
  });

  const handleHeroesFeastSkip = createSkipHandler('heroesFeast');

  const handleGreaterRestorationConfirm = createConfirmHandler('greaterRestoration', async (pending, result) => {
    const { confirmGreaterRestoration } = await import('../../services/rules/features/greaterRestorationService.js');
    await confirmGreaterRestoration(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'greater_restoration', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    );
  });

  const handleGreaterRestorationSkip = createSkipHandler('greaterRestoration');

  const handleLesserRestorationConfirm = createConfirmHandler('lesserRestoration', async (pending, result) => {
    await applyLesserRestorationEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'lesser_restoration', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    );
  });

  const handleLesserRestorationSkip = createSkipHandler('lesserRestoration');

  const handleRemoveCurseConfirm = createConfirmHandler('removeCurse', async (pending, result) => {
    await confirmRemoveCurse(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'remove_curse', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    );
  });

  const handleRemoveCurseSkip = createSkipHandler('removeCurse');

  const handleMageArmorConfirm = createConfirmHandler('mageArmor', async (pending, result) => {
    await applyMageArmorEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'mage_armor', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    );
  });

  const handleMageArmorSkip = createSkipHandler('mageArmor');

  const handleShieldOfFaithConfirm = createConfirmHandler('shieldOfFaith', async (pending, result) => {
    await applyShieldOfFaithEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'shield_of_faith', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    );
  });

  const handleShieldOfFaithSkip = createSkipHandler('shieldOfFaith');

  const handleProtectionFromEnergyConfirm = createConfirmHandler('protectionFromEnergy', async (pending, result) => {
    await applyProtectionFromEnergyHandler(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'protection_from_energy', damageTypes: pending.damageTypes } },
      playerStats,
      campaignName,
      result.targetName,
      result.damageType
    );
  });

  const handleProtectionFromEnergySkip = createSkipHandler('protectionFromEnergy');

  const handleResistanceConfirm = createConfirmHandler('resistance', async (pending, result) => {
    await applyResistanceEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'damage_reduction', reductionExpression: '1d4', damageTypes: [], trigger: 'damage_taken_of_chosen_resistance_type' } },
      playerStats,
      campaignName,
      result.targetName,
      result.damageType
    );
  });

  const handleResistanceSkip = createSkipHandler('resistance');

  const handleMagicMissileConfirm = React.useCallback((result) => {
    const pending = pendingMagicMissile;
    if (!pending) return;

    cfClearPending('magicMissile');

    const { spell } = pending;
    const distribution = result.distribution;

    const hasAnyTargets = Object.values(distribution).some(v => v > 0);
    if (!hasAnyTargets) return;

    const slotLevel = spell.level || 1;
    const finalMetaCtx = { magicMissileDistribution: distribution, slotLevel };
    onExecute(spell, finalMetaCtx);
  }, [pendingMagicMissile, onExecute, cfClearPending]);

  const handleMagicMissileSkip = React.useCallback(() => {
    cfClearPending('magicMissile');
  }, [cfClearPending]);

  return { pendingMetamagic, pendingMultiTarget, pendingAid, pendingHeroesFeast, pendingGreaterRestoration, pendingLesserRestoration, pendingMageArmor, pendingShieldOfFaith, pendingProtectionFromEnergy, pendingResistance, pendingRemoveCurse, pendingMagicMissile, gateMetamagic, handleConfirm, handleSkip, handleMultiTargetConfirm, handleMultiTargetSkip, handleAidConfirm, handleAidSkip, handleHeroesFeastConfirm, handleHeroesFeastSkip, handleGreaterRestorationConfirm, handleGreaterRestorationSkip, handleLesserRestorationConfirm, handleLesserRestorationSkip, handleMageArmorConfirm, handleMageArmorSkip, handleShieldOfFaithConfirm, handleShieldOfFaithSkip, handleProtectionFromEnergyConfirm, handleProtectionFromEnergySkip, handleResistanceConfirm, handleResistanceSkip, handleRemoveCurseConfirm, handleRemoveCurseSkip, handleMagicMissileConfirm, handleMagicMissileSkip };
}
