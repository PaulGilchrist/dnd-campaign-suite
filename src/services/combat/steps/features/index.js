import { assassinate } from './assassinate.js';
import { stealthAttackCost } from './stealthAttackCost.js';
import { rendMind } from './rendMind.js';
import { colossusSlayer } from './colossusSlayer.js';
import { superiorHuntersPrey } from './superiorHuntersPrey.js';
import { eldritchStrikes } from './eldritchStrikes.js';
import { stalkersFlurry } from './stalkersFlurry.js';
import { crusher } from './crusher.js';
import { slasher } from './slasher.js';
import { piercer } from './piercer.js';
import { tavernBrawler } from './tavernBrawler.js';
import { cantripBonuses } from './cantripBonuses.js';
import { tavernBrawlerPush } from './tavernBrawlerPush.js';
import { sacredWeapon } from './sacredWeapon.js';
import { remarkableAthlete } from './remarkableAthlete.js';
import { huntersMarkDamage } from './huntersMarkDamage.js';
import { hexDamage } from './hexDamage.js';
import { epitomeEmpoweredStrikes } from './epitomeEmpoweredStrikes.js';
import { grappler } from './grappler.js';

export const featureModules = [
  assassinate,
  stealthAttackCost,
  rendMind,
  // FT-090: tavern riders mount first — every module here runs pre-damage
  // inside the featureRiders loop and a modal return PAUSES that loop
  // (FT-074), so ordering still matters for pause-sensitive riders.
  tavernBrawler,
  tavernBrawlerPush,
  // bug-sheet-attack-shield-bash-rider-drops-weapon-damage: shieldBash is
  // GONE from this pre-damage loop. Its save prompt used to park the
  // triggering hit's weapon damage behind the save chain (and a Dismiss —
  // never resolved per the dismiss doctrine — stranded the committed damage
  // forever). It now adjudicates AFTER damage via buildShieldBashRiderStep
  // (attackRollPostDamage.js), mounted only on the attack-roll lane — the
  // spell lane never re-prompts a stale melee lastAttack either.
  colossusSlayer,
  superiorHuntersPrey,
  eldritchStrikes,
  stalkersFlurry,
  crusher,
  slasher,
  piercer,
  cantripBonuses,
  sacredWeapon,
  remarkableAthlete,
  huntersMarkDamage,
  hexDamage,
  epitomeEmpoweredStrikes,
  grappler,
];
