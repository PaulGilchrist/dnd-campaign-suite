import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getAllyList } from '../useAllySelection.js';
import { getCsAndTargets, extractMaxTargets, resolveHumanoids, resolveBeasts, makePending, isSpareTheDyingTarget } from './spellGateHelpers.js';
import { isCreatureDead } from '../../services/shared/hpModifier.js';

// ── Spell gate handlers ──────────────────────────────────────────────────────
// All gates take a single options object:
// { spell, campaignName, cfSetPending, playerStats, metaCtx, characters, isSorcerer, setPopupHtml }

function gateForesight({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { includeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('foresight', makePending('foresight', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateSanctuary({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { includeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('sanctuary', makePending('sanctuary', spell, { range: spell.range || '30 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateProtectionFromEvilAndGood({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { includeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('protectionFromEvilAndGood', makePending('protectionFromEvilAndGood', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateProtectionFromPoison({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { includeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('protectionFromPoison', makePending('protectionFromPoison', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateStoneSkin({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('stoneSkin', makePending('stoneSkin', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateHoldMonster({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { excludeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('holdMonster', makePending('holdMonster', spell, {
      range: spell.range || '90 feet',
      creatureTargets,
      maxTargets: extractMaxTargets(spell),
    }));
    return true;
  }
  return false;
}

async function gateHoldPerson({ spell, campaignName, cfSetPending, playerStats }) {
  const targets = await resolveHumanoids(campaignName, playerStats.name);
  if (targets.length > 0) {
    cfSetPending('holdPerson', makePending('holdPerson', spell, {
      range: spell.range || '60 feet',
      creatureTargets: targets,
      maxTargets: extractMaxTargets(spell),
    }));
    return true;
  }
  return false;
}

function gatePolymorph({ spell, campaignName, cfSetPending, characters }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('polymorph', makePending('polymorph', spell, {
      range: spell.range || '60 feet',
      creatureTargets,
      maxTargets: 1,
      characters,
    }));
    return true;
  }
  return false;
}

function gateShapechange({ spell, campaignName, cfSetPending, playerStats, characters, isSorcerer }) {
  if (!isSorcerer) return false;
  const { creatureTargets } = getCsAndTargets(campaignName, { includeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('shapechange', makePending('shapechange', spell, {
      range: spell.range || 'Self',
      creatureTargets,
      maxTargets: 1,
      characters,
    }));
    return true;
  }
  return false;
}

function gateAnimalShapes({ spell, campaignName, cfSetPending, playerStats, characters }) {
  const allies = getAllyList(playerStats.name);
  const cs = getCombatSummary(campaignName);
  if (!cs?.creatures) {
    console.error(`Creature targets empty for ${spell?.name || 'unknown'}: cs=${cs ? 'exists' : 'null'}, characters.length=undefined`);
  }
  const creatureTargets = cs?.creatures
    ?.filter(c => allies.some(a => a.toLowerCase() === c.name.toLowerCase()))
    ?.map(c => c.name) || [];
  if (creatureTargets.length > 0) {
    cfSetPending('animalShapes', makePending('animalShapes', spell, {
      range: spell.range || '30 feet',
      creatureTargets,
      maxCR: 4,
      characters,
    }));
    return true;
  }
  return false;
}

function gateTruePolymorph({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('truePolymorph', makePending('truePolymorph', spell, {
      range: spell.range || '30 feet',
      creatureTargets,
    }));
    return true;
  }
  return false;
}

async function gateCharmPerson({ spell, campaignName, cfSetPending, playerStats }) {
  const targets = await resolveHumanoids(campaignName, playerStats.name);
  if (targets.length > 0) {
    cfSetPending('charmPerson', makePending('charmPerson', spell, {
      range: spell.range || '30 feet',
      creatureTargets: targets,
      maxTargets: extractMaxTargets(spell),
    }));
    return true;
  }
  return false;
}

function gateCharmMonster({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { excludeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('charmMonster', makePending('charmMonster', spell, {
      range: spell.range || '30 feet',
      creatureTargets,
      maxTargets: extractMaxTargets(spell),
    }));
    return true;
  }
  return false;
}

function gateBanishment({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { excludeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('banishment', makePending('banishment', spell, {
      range: spell.range || '30 feet',
      creatureTargets,
      maxTargets: extractMaxTargets(spell),
    }));
    return true;
  }
  return false;
}

function gatePrismaticSpray({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { excludeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('prismatic_spray', makePending('prismatic_spray', spell, {
      range: spell.range || 'Self',
      creatureTargets,
      maxTargets: null,
    }));
    return true;
  }
  return false;
}

function gateLesserRestoration({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('lesserRestoration', makePending('lesserRestoration', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateGreaterRestoration({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('greaterRestoration', makePending('greaterRestoration', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateRemoveCurse({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('removeCurse', makePending('removeCurse', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateAid({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('aid', makePending('aid', spell, { range: spell.range || '30 feet', maxTargets: 3, creatureTargets }));
    return true;
  }
  return false;
}

function gateBane({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('bane', makePending('bane', spell, { range: spell.range || '30 feet', maxTargets: 3, creatureTargets }));
    return true;
  }
  return false;
}

function gateBless({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('bless', makePending('bless', spell, { range: spell.range || '30 feet', maxTargets: 3, creatureTargets }));
    return true;
  }
  return false;
}

function gateHolyAura({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('holyAura', makePending('holyAura', spell, {
      spellLevel: 8,
      range: spell.range || 'Self',
      creatureTargets,
    }));
    return true;
  }
  return false;
}

function gateFaerieFire({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { excludeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('faerieFire', makePending('faerieFire', spell, {
      spellLevel: spell.level || 1,
      range: spell.range || '60 feet',
      creatureTargets,
    }));
    return true;
  }
  return false;
}

function gateSlow({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('slow', makePending('slow', spell, { range: spell.range || '50 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateHaste({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('haste', makePending('haste', spell, { range: spell.range || '30 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateEnhanceAbility({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { includeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('enhanceAbility', makePending('enhanceAbility', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateBarkskin({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('barkskin', makePending('barkskin', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateInvisibility({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('invisibility', makePending('invisibility', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateGreaterInvisibility({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('greaterInvisibility', makePending('greaterInvisibility', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateFeignDeath({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('feignDeath', makePending('feignDeath', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateHeal({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('heal', makePending('heal', spell, { range: spell.range || '60 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateLongstrider({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('longstrider', makePending('longstrider', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

// SP-110: Spare the Dying can only target a living creature at 0 Hit Points.
// Canonical HP truth: PCs via the runtime store, monsters via cs.currentHp
// (pitfall 29). Returns true even when no valid target exists (refusal popup)
// so the cast never falls through to the generic path — mirrors gateRevivify.
function gateSpareTheDying({ spell, campaignName, cfSetPending, playerStats, setPopupHtml }) {
  const { cs, creatureTargets } = getCsAndTargets(campaignName, { excludeCaster: true, casterName: playerStats.name });
  const dyingTargets = creatureTargets.filter(name => isSpareTheDyingTarget(cs, name));
  if (dyingTargets.length > 0) {
    cfSetPending('spareTheDying', makePending('spareTheDying', spell, { range: spell.range || '15 feet', creatureTargets: dyingTargets }));
    return true;
  }
  if (setPopupHtml) {
    setPopupHtml({
      type: 'automation_info',
      name: spell.name,
      automationType: 'spareTheDying',
      description: 'No living creature at 0 Hit Points is in range. Spare the Dying can only target a living creature that has 0 Hit Points, and has no effect on undead or constructs.',
    });
  }
  return true;
}

function gatePassWithoutTrace({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('passWithoutTrace', makePending('passWithoutTrace', spell, { range: spell.range || 'Self', creatureTargets }));
    return true;
  }
  return false;
}

function gateBeaconOfHope({ spell, campaignName, cfSetPending, characters }) {
  let { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length === 0 && characters.length > 0) {
    creatureTargets = characters.map(c => c.name);
  }
  if (creatureTargets.length > 0) {
    cfSetPending('beaconOfHope', makePending('beaconOfHope', spell, { range: spell.range || '30 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateHeroesFeast({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('heroesFeast', makePending('heroesFeast', spell, {
      range: spell.range || 'Self',
      maxTargets: 12,
      creatureTargets,
    }));
    return true;
  }
  return false;
}

function gateMageArmor({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('mageArmor', makePending('mageArmor', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateProtectionFromEnergy({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('protectionFromEnergy', makePending('protectionFromEnergy', spell, {
      range: spell.range || 'Touch',
      creatureTargets,
      damageTypes: spell.automation?.damageTypes || ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
    }));
    return true;
  }
  return false;
}

function gateResistance({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('resistance', makePending('resistance', spell, {
      range: spell.range || 'Touch',
      creatureTargets,
      damageTypes: ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Radiant', 'Slashing', 'Thunder'],
    }));
    return true;
  }
  return false;
}

function gateMagicMissile({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    const slotLevel = spell.level || 1;
    const totalMissiles = 3 + (slotLevel - 1);
    cfSetPending('magicMissile', {
      spell,
      totalMissiles,
      missileDamage: '1d4 + 1',
      creatureTargets,
    });
    return true;
  }
  return false;
}

function gateGlobe({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('globe', makePending('globe', spell, { range: spell.range || 'Self', creatureTargets }));
    return true;
  }
  return false;
}

function gateAntimagicField({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('antimagicField', makePending('antimagicField', spell, { range: spell.range || 'Self (10-foot radius)', creatureTargets }));
    return true;
  }
  return false;
}

function gateForcecage({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('forcecage', makePending('forcecage', spell, { range: spell.range || '100 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateStinkingCloud({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('stinkingCloud', makePending('stinkingCloud', spell, { range: spell.range || '90 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateConfusion({ spell, campaignName, cfSetPending, metaCtx }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('confusion', makePending('confusion', spell, {
      range: spell.range || '90 feet',
      creatureTargets,
      spellSaveDc: metaCtx?.spellSaveDc,
      metamagicHeighten: metaCtx?.metamagicHeighten,
    }));
    return true;
  }
  return false;
}

function gateWeb({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('web', makePending('web', spell, { range: spell.range || '60 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateSleetStorm({ spell, campaignName, cfSetPending, metaCtx }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('sleetStorm', makePending('sleetStorm', spell, {
      range: spell.range || '150 feet',
      creatureTargets,
      spellSaveDc: metaCtx?.spellSaveDc,
    }));
    return true;
  }
  return false;
}

async function gateAnimalFriendship({ spell, campaignName, cfSetPending }) {
  const beastTargets = await resolveBeasts(campaignName);
  if (beastTargets.length > 0) {
    cfSetPending('animalFriendship', makePending('animalFriendship', spell, {
      range: spell.range || '30 feet',
      rangeFt: 30,
      creatureTargets: beastTargets,
    }));
    return true;
  }
  return false;
}

function gateRegenerate({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('regenerate', makePending('regenerate', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateHealingWord({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('healingWord', makePending('healingWord', spell, { range: spell.range || '60 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateCureWounds({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('cureWounds', makePending('cureWounds', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

// SP-100: Revivify only targets creatures that have died within the last minute.
// PCs are dead per the runtime store (isDead / currentHitPoints — combatSummary
// player stubs are 1/1 placeholders, pitfall 37); monsters are dead per their
// combatSummary currentHp (real HP is carried there, CLA-303). Monsters are
// INCLUDED: Revivify RAW works on any creature reduced to 0 Hit Points.
// Returns true even when no dead creature exists (refusal popup) so the cast
// never falls through to the generic path that would spend the slot + diamond.
function gateRevivify({ spell, campaignName, cfSetPending, playerStats, setPopupHtml }) {
  const { cs, creatureTargets } = getCsAndTargets(campaignName, { excludeCaster: true, casterName: playerStats.name });
  const deadTargets = creatureTargets.filter(name => isCreatureDead(cs, name));
  if (deadTargets.length > 0) {
    cfSetPending('revivify', makePending('revivify', spell, { range: spell.range || 'Touch', creatureTargets: deadTargets }));
    return true;
  }
  if (setPopupHtml) {
    setPopupHtml({
      type: 'automation_info',
      name: spell.name,
      automationType: 'revivify',
      description: 'No creature has died within the last minute. Revivify can only target a creature that has died.',
    });
  }
  return true;
}

function gateAuraOfLife({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('auraOfLife', makePending('auraOfLife', spell, { range: spell.range || '30 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateAuraOfPurity({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('auraOfPurity', makePending('auraOfPurity', spell, { range: spell.range || '30 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateCircleOfPower({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('circleOfPower', makePending('circleOfPower', spell, { range: spell.range || '30 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateCompulsion({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('compulsion', makePending('compulsion', spell, { range: spell.range || '30 feet', creatureTargets }));
    return true;
  }
  return false;
}

function gateAuraOfVitality({ spell, campaignName, cfSetPending, metaCtx }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    const extra = metaCtx?.freeCastUsed ? { isFreeCast: true } : {};
    cfSetPending('auraOfVitality', makePending('auraOfVitality', spell, {
      range: spell.range || '30 feet',
      creatureTargets,
      ...extra,
    }));
    return true;
  }
  return false;
}

function gateDeathWard({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('deathWard', makePending('deathWard', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateHeroism({ spell, campaignName, cfSetPending }) {
  const { creatureTargets } = getCsAndTargets(campaignName);
  if (creatureTargets.length > 0) {
    cfSetPending('heroism', makePending('heroism', spell, { range: spell.range || 'Touch', creatureTargets }));
    return true;
  }
  return false;
}

function gateHex({ spell, campaignName, cfSetPending, playerStats }) {
  const { creatureTargets } = getCsAndTargets(campaignName, { excludeCaster: true, casterName: playerStats.name });
  if (creatureTargets.length > 0) {
    cfSetPending('hex', makePending('hex', spell, {
      range: spell.range || '90 feet',
      creatureTargets,
      maxTargets: 1,
    }));
    return true;
  }
  return false;
}

// ── Registry ─────────────────────────────────────────────────────────────────

const spellGateMap = {
  'foresight': gateForesight,
  'sanctuary': gateSanctuary,
  'protection from evil and good': gateProtectionFromEvilAndGood,
  'protection from poison': gateProtectionFromPoison,
  'stone skin': gateStoneSkin,
  'hold monster': gateHoldMonster,
  'hold person': gateHoldPerson,
  'polymorph': gatePolymorph,
  'shapechange': gateShapechange,
  'animal shapes': gateAnimalShapes,
  'true polymorph': gateTruePolymorph,
  'charm person': gateCharmPerson,
  'charm monster': gateCharmMonster,
  'banishment': gateBanishment,
  'prismatic spray': gatePrismaticSpray,
  'lesser restoration': gateLesserRestoration,
  'greater restoration': gateGreaterRestoration,
  'remove curse': gateRemoveCurse,
  'aid': gateAid,
  'bane': gateBane,
  'bless': gateBless,
  'holy aura': gateHolyAura,
  'faerie fire': gateFaerieFire,
  'slow': gateSlow,
  'haste': gateHaste,
  'enhance ability': gateEnhanceAbility,
  'barkskin': gateBarkskin,
  'invisibility': gateInvisibility,
  'greater invisibility': gateGreaterInvisibility,
  'feign death': gateFeignDeath,
  'heal': gateHeal,
  'longstrider': gateLongstrider,
  'spare the dying': gateSpareTheDying,
  'pass without trace': gatePassWithoutTrace,
  'beacon of hope': gateBeaconOfHope,
  "heroes' feast": gateHeroesFeast,
  'mage armor': gateMageArmor,
  'protection from energy': gateProtectionFromEnergy,
  'resistance': gateResistance,
  'magic missile': gateMagicMissile,
  'globe of invulnerability': gateGlobe,
  'antimagic field': gateAntimagicField,
  'forcecage': gateForcecage,
  'stinking cloud': gateStinkingCloud,
  'confusion': gateConfusion,
  'web': gateWeb,
  'sleet storm': gateSleetStorm,
  'animal friendship': gateAnimalFriendship,
  'regenerate': gateRegenerate,
  'healing word': gateHealingWord,
  'cure wounds': gateCureWounds,
  'revivify': gateRevivify,
  'aura of life': gateAuraOfLife,
  'aura of purity': gateAuraOfPurity,
  'circle of power': gateCircleOfPower,
  'compulsion': gateCompulsion,
  'aura of vitality': gateAuraOfVitality,
  'death ward': gateDeathWard,
  'heroism': gateHeroism,
  'hex': gateHex,
};

// ── Public API ───────────────────────────────────────────────────────────────

export function tryGateSpell(spellName, campaignName, cfSetPending, extra = {}) {
  const normalized = (spellName || '').toLowerCase();
  const handler = spellGateMap[normalized];
  if (!handler) return false;

  const { spell, metaCtx, playerStats, characters, isSorcerer, setPopupHtml } = extra;
  return handler({ spell, campaignName, cfSetPending, playerStats, metaCtx, characters, isSorcerer, setPopupHtml });
}
