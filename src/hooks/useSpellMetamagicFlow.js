import React from 'react'
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from './useMetamagic.js'
import { addEntry } from '../services/ui/logService.js'
import { getMultiTargetSpreadForSpell } from '../services/rules/postCastRiderService.js'
import { getCombatSummary } from '../services/encounters/combatData.js'
import { isPsionicSpell, hasPsionicSorcery } from '../services/rules/metamagicRules.js'

function getCreatureTargets(excludeName) {
  const cs = getCombatSummary();
  if (!cs?.creatures) return [];
  return cs.creatures
    .filter(c => c.name !== excludeName)
    .map(c => c.name);
}

export function useSpellMetamagicFlow(playerStats, campaignName, onExecute) {
  const isSorcerer = playerStats?.class?.name === 'Sorcerer';
  const [pendingMetamagic, setPendingMetamagic] = React.useState(null);
  const [pendingMultiTarget, setPendingMultiTarget] = React.useState(null);
  const [pendingAid, setPendingAid] = React.useState(null);
  const [pendingHeroesFeast, setPendingHeroesFeast] = React.useState(null);
  const [pendingGreaterRestoration, setPendingGreaterRestoration] = React.useState(null);
  const [pendingLesserRestoration, setPendingLesserRestoration] = React.useState(null);
  const [pendingMageArmor, setPendingMageArmor] = React.useState(null);

  const gateMetamagic = React.useCallback((spell) => {
    const isGreaterRestoration = (spell.name || '').toLowerCase() === 'greater restoration';
    const isLesserRestoration = (spell.name || '').toLowerCase() === 'lesser restoration';
    const isAid = (spell.name || '').toLowerCase() === 'aid';

    if (isLesserRestoration) {
      const cs = getCombatSummary();
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        setPendingLesserRestoration({
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
      const cs = getCombatSummary();
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        setPendingGreaterRestoration({
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
      const cs = getCombatSummary();
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        setPendingAid({
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
      const cs = getCombatSummary();
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        setPendingHeroesFeast({
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
      const cs = getCombatSummary();
      const creatureTargets = cs?.creatures
        ?.filter(c => c.name !== playerStats?.name)
        .map(c => c.name) || [];
      if (creatureTargets.length > 0) {
        setPendingMageArmor({
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

    const multiTargetSpread = getMultiTargetSpreadForSpell(playerStats, spell.name);

    if (multiTargetSpread) {
      const creatureTargets = getCreatureTargets(playerStats?.name);
      if (creatureTargets.length > 0) {
        setPendingMultiTarget({
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
      onExecute(spell, {});
      return;
    }

    const spellLevel = spell.level || 0;
    const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
    const isPsionic = isPsionicSpell(playerStats, spell.name);
    const hasPsionic = hasPsionicSorcery(playerStats);

    setPendingMetamagic({
      spell,
      spellName: spell.name,
      spellLevel: spell.level || 0,
      castingTime: spell.casting_time,
      _currentSP: currentSP,
      isPsionic: isPsionic && hasPsionic,
      psionicCost: isPsionic && hasPsionic ? spellLevel : 0,
    });
    }, [isSorcerer, playerStats, campaignName, onExecute]);

  const handleConfirm = React.useCallback((result) => {
    const pending = pendingMetamagic;
    setPendingMetamagic(null);
    if (!pending) return;

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

    const metaCtx = {};
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
  }, [pendingMetamagic, playerStats, campaignName, onExecute]);

  const handleSkip = React.useCallback(() => {
    const pending = pendingMetamagic;
    setPendingMetamagic(null);
    if (!pending) return;

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
  }, [pendingMetamagic, playerStats.name, campaignName, onExecute]);

  const handleMultiTargetConfirm = React.useCallback((result) => {
    const pending = pendingMultiTarget;
    setPendingMultiTarget(null);
    if (!pending) return;

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
  }, [pendingMultiTarget, playerStats, campaignName, onExecute]);

  const handleMultiTargetSkip = React.useCallback(() => {
    const pending = pendingMultiTarget;
    setPendingMultiTarget(null);
    if (!pending) return;

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
  }, [pendingMultiTarget, playerStats, campaignName, onExecute]);

  const handleAidConfirm = React.useCallback(async (result) => {
    const pending = pendingAid;
    setPendingAid(null);
    if (!pending) return;

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

    try {
      const { applyAidEffect } = await import('../services/automation/index.js');
      await applyAidEffect(
        { name: pending.spellName, spell: pending.spell, automation: { type: 'aid', range: pending.range, maxTargets: pending.maxTargets } },
        playerStats,
        campaignName,
        null,
        result
      );
    } catch (e) {
      console.error('[aid] Failed to apply effect:', e);
    }
  }, [pendingAid, playerStats, campaignName]);

  const handleAidSkip = React.useCallback(() => {
    const pending = pendingAid;
    setPendingAid(null);
    if (!pending) return;

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
  }, [pendingAid, playerStats, campaignName]);

  const handleHeroesFeastConfirm = React.useCallback(async (result) => {
    const pending = pendingHeroesFeast;
    setPendingHeroesFeast(null);
    if (!pending) return;

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

    try {
      const { applyHeroesFeastEffect } = await import('../services/automation/index.js');
      await applyHeroesFeastEffect(
        { name: pending.spellName, spell: pending.spell, automation: { type: 'heroes_feast', range: pending.range, maxTargets: pending.maxTargets } },
        playerStats,
        campaignName,
        null,
        result
      );
    } catch (e) {
      console.error("[heroesFeast] Failed to apply effect:", e);
    }
  }, [pendingHeroesFeast, playerStats, campaignName]);

  const handleHeroesFeastSkip = React.useCallback(() => {
    const pending = pendingHeroesFeast;
    setPendingHeroesFeast(null);
    if (!pending) return;

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
  }, [pendingHeroesFeast, playerStats, campaignName]);

  const handleGreaterRestorationConfirm = React.useCallback(async (result) => {
    const pending = pendingGreaterRestoration;
    setPendingGreaterRestoration(null);
    if (!pending) return;

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

    try {
      const { confirmGreaterRestoration } = await import('../services/rules/greaterRestorationService.js');
      await confirmGreaterRestoration(
        { name: pending.spellName, spell: pending.spell, automation: { type: 'greater_restoration', range: pending.range } },
        playerStats,
        campaignName,
        null,
        result
      );
    } catch (e) {
      console.error('[greaterRestoration] Failed to apply effect:', e);
    }
  }, [pendingGreaterRestoration, playerStats, campaignName]);

  const handleGreaterRestorationSkip = React.useCallback(() => {
    const pending = pendingGreaterRestoration;
    setPendingGreaterRestoration(null);
    if (!pending) return;

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
  }, [pendingGreaterRestoration, playerStats, campaignName]);

  const handleLesserRestorationConfirm = React.useCallback(async (result) => {
    const pending = pendingLesserRestoration;
    setPendingLesserRestoration(null);
    if (!pending) return;

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

    try {
      const { applyLesserRestorationEffect } = await import('../services/automation/index.js');
      await applyLesserRestorationEffect(
        { name: pending.spellName, spell: pending.spell, automation: { type: 'lesser_restoration', range: pending.range } },
        playerStats,
        campaignName,
        null,
        result
      );
    } catch (e) {
      console.error('[lesserRestoration] Failed to apply effect:', e);
    }
  }, [pendingLesserRestoration, playerStats, campaignName]);

  const handleLesserRestorationSkip = React.useCallback(() => {
    const pending = pendingLesserRestoration;
    setPendingLesserRestoration(null);
    if (!pending) return;

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
  }, [pendingLesserRestoration, playerStats, campaignName]);

  const handleMageArmorConfirm = React.useCallback(async (result) => {
    const pending = pendingMageArmor;
    setPendingMageArmor(null);
    if (!pending) return;

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

    try {
      const { applyMageArmorEffect } = await import('../services/automation/index.js');
      await applyMageArmorEffect(
        { name: pending.spellName, spell: pending.spell, automation: { type: 'mage_armor', range: pending.range } },
        playerStats,
        campaignName,
        null,
        result
      );
    } catch (e) {
      console.error('[mageArmor] Failed to apply effect:', e);
    }
  }, [pendingMageArmor, playerStats, campaignName]);

  const handleMageArmorSkip = React.useCallback(() => {
    const pending = pendingMageArmor;
    setPendingMageArmor(null);
    if (!pending) return;

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
  }, [pendingMageArmor, playerStats, campaignName]);

  return { pendingMetamagic, pendingMultiTarget, pendingAid, pendingHeroesFeast, pendingGreaterRestoration, pendingLesserRestoration, pendingMageArmor, gateMetamagic, handleConfirm, handleSkip, handleMultiTargetConfirm, handleMultiTargetSkip, handleAidConfirm, handleAidSkip, handleHeroesFeastConfirm, handleHeroesFeastSkip, handleGreaterRestorationConfirm, handleGreaterRestorationSkip, handleLesserRestorationConfirm, handleLesserRestorationSkip, handleMageArmorConfirm, handleMageArmorSkip };
}
