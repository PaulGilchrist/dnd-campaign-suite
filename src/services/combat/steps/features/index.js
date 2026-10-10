import { assassinate } from './assassinate.js';
import { stealthAttackCost } from './stealthAttackCost.js';
import { rendMind } from './rendMind.js';
import { shieldBash } from './shieldBash.js';
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
  // FT-090: tavern riders mount BEFORE shieldBash — shieldBash offers a
  // chooser modal that PAUSES featureRiders (FT-074) and resumes from its
  // emit, so every module ordered after it is skipped for that attack.
  // Unarmed hits on shield-holders stranded tavern push/reroll forever.
  tavernBrawler,
  tavernBrawlerPush,
  shieldBash,
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
