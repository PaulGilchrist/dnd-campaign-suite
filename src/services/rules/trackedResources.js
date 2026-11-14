
import { getClassFeatures } from '../character/classFeatures.js'

export const ALL_TRACKED_RESOURCES = [
  'currentHitPoints',
  'hitPoints',
  'sorceryPoints',
  'innateSorceryUses',
  'focusPoints',
  'kiPoints',
  'channelDivinityCharges',
  'bardicInspirationUses',
  'wildShapeUses',
  // improve tracked-resource-ghost-keys (case-dup pass, 2026-11-14): the
  // legacy lower-case feature-name-derived twins 'secondwindUses' /
  // 'actionsurgeUses' are RETIRED from the catalog + seed. The camelCase
  // spellings below are canonical: they are the disk automation-id casing
  // (public/data{,/2024}/classes.json "resourceKey": "secondWindUses"), the
  // TrackedResourceInput UI keys (CharClassFeatures.jsx), the short-rest
  // label keys and the direct handler lane (tacticalMindHandler,
  // restRules-shortRest). The only lowercase consumer left is the
  // automationInfoBuilder derivation (feature.name.toLowerCase()+'Uses',
  // extra_action/initiative) — extraActionHandler writes that runtime row
  // itself on first press (null-tolerant `?? usesMax` gate) and
  // SHORT_REST_RESOURCES re-arms it; a seed row was never required.
  'secondWindUses',
  'actionSurgeUses',
  'actionSurgeUsedThisRound',
  'ragePoints',
  'layOnHandsPool',
  'preserveLifePool',
  'gloriousDefenseUses',
  'superiorityDice',
  'psionicEnergy',
  'telekineticThrustUses',
  'arcaneRecoveryLevels',
  'naturalRecoverySlots',
  'arcaneWardHp',
  'arcaneWardMax',
  'warlockPactMagic',
  'sorcerousRestorationUses',
  'uncannymetabolismUses',
  'rageOfTheGodsUses',
  'warPriestUses',
  'luckyPoints',
  'divineInterventionUses',
  'wholenessofbodyUses',
  'adrenalineRushUses',
  'naturesVeilUses',
  'favoredEnemyUses',
  'stonecunningUses',
  'stonesEnduranceUses',
  'stormsThunderUses',
  'tirelessUses',
  'moonlightStepUses',
  'dreadambushUses',
  'cosmicomenUses',
  // CLA-364 BUG-A: tranceOfOrderUses removed — handler-owned null-as-available
  // latch (warpingimplosionUses pattern); the seed here persisted a grant-time
  // 0 that killed the free once-per-Long-Rest use (see addRestorationAndTranceResources).
  'shortRestHitDice',
  'spell_slots_level_1',
  'spell_slots_level_2',
  'spell_slots_level_3',
  'spell_slots_level_4',
  'spell_slots_level_5',
  'spell_slots_level_6',
  'spell_slots_level_7',
  'spell_slots_level_8',
  'spell_slots_level_9',
  'tamedSurgeUses',
   'featsOfChaosUses',
   'mysticArcanumLevel6',
   'mysticArcanumLevel7',
   'mysticArcanumLevel8',
   'mysticArcanumLevel9',
   'isDead',
    '_Steps_of_the_Fey_freeCastCount',
    'healinglightPool',
 ]

const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// ── Fan-out ownership classification (improve tracked-resource-ghost-keys,
// 2026-11-14 pass — completes the 03e419d35 Pool-key gate) ──────────────────
// Every key computeTrackedResources can create (or LONG_REST_RESOURCES can
// null-re-arm) now falls into exactly one class:
//
// (1) UNIVERSAL — seeded for every character: currentHitPoints, hitPoints,
//     spell_slots_level_1..9, shortRestHitDice. These are core sheet lanes
//     the long/short-rest batches and slot consumers read for ALL characters
//     (a 0 slot row is truthful — the slot ladder genuinely exists at 0);
//     they are not ghosts and keep their unconditional seed + re-arm.
//
// (2) STATICALLY_OWNABLE (GATED_TRACKED_KEYS below) — ownership is decided by
//     a class / subclass / patron / feat / trait / automation predicate that
//     computeTrackedResources already evaluates at load. Seeded ONLY for the
//     owners (CLA-364/03e419d35 owned-only idiom): a non-owner bucket carries
//     ZERO of these keys — no `sorceryPoints: 0`, `ragePoints: 0`,
//     `gloriousDefenseUses: 0`… ghosts fan via the first full-store POST.
//     Key absence is a first-class state in every read path (useTrackedResource
//     .resolveCurrent store → _trackedResources → maxGetter; every handler
//     fallback is `?.current ?? max`/`|| max`-shaped — audited repo-wide).
//     restRules-longRest.js imports this list: a long rest skips the null
//     re-fan for a gated key the resting character does NOT carry in
//     `_trackedResources`, while owners (whose seed put the key in the
//     bucket) keep their byte-identical null re-arm.
//
// (3) HANDLER_OWNED_LATCH (HANDLER_OWNED_LATCH_KEYS below) — never seeded in
//     `_trackedResources`, even for their owners; the value is written
//     lazily by the spending handler and read `stored ?? uses` (null/absent =
//     re-armed/free use). Their CLA-364 lesson (tranceOfOrderUses: a
//     grant-time 0-seed poisoned the store and charged the free
//     once-per-Long-Rest use 5 SP) forbids seeding. They CANNOT be gated by
//     `key in _trackedResources` in the long-rest batch — the OWNER's bucket
//     also lacks the key, so the guard would silently retire the owner's only
//     CLA-130 re-arm ("a latch missing from the LR reset lists dies
//     permanently"). Their unconditional null fan-out is therefore KEPT BY
//     DESIGN (the null-row cost is noise the Admin viewer shows; the dead-use
//     cost of removing it is a regression class already litigated four times:
//     CLA-096/099/130/364).

// Class (2): seeded owned-only; the long-rest re-arm guard reads this list.
export const GATED_TRACKED_KEYS = [
  // caster lane — owner = the class/subclass the features/classLevel field proves
  'sorceryPoints',            // features.maxSorceryPoints > 0 (Sorcerer lane)
  'innateSorceryUses',        // features.maxInnateSorcery > 0
  'focusPoints',              // classLevel.focus_points / features.maxFocusPoints > 0 (Monk)
  'kiPoints',                 // mirror of focusPoints (Monk)
  'arcaneRecoveryLevels',     // features.arcaneRecoveryLevels > 0 (Wizard)
  'arcaneWardHp',             // arcane_ward passive present (Abjurer/item grant)
  'arcaneWardMax',            // mirror of arcaneWardHp
  // martial lane — owner = Fighter/Barbarian class+level rows, automation grants
  'secondWindUses',           // classLevel.second_wind > 0 (Fighter; canonical casing)
  'actionSurgeUses',          // resolveActionSurgeMax > 0 (Fighter lv2+; canonical casing)
  'ragePoints',               // resolveRageMax > 0 (Barbarian)
  'superiorityDice',          // computeSuperiorityDiceMax > 0 (Battle Master / Superior Technique)
  'psionicEnergy',            // classLevel.energy.required_major match (Psi Warrior/Soulknife)
  'telekineticThrustUses',    // telekinetic_thrust reaction present (CLA-355)
  'adrenalineRushUses',       // bonus_action_dash specialAction present (UA Thief lane)
  // warlock lane — owner = Warlock + patron identity
  'darkOnesLuckUses',         // Fiend patron
  'warlockPactMagic',         // class Warlock (0-row pre-data-row kept for owners)
  'mysticArcanumLevel6',      // class Warlock + features.arcanumLevels (already conditional)
  'mysticArcanumLevel7',
  'mysticArcanumLevel8',
  'mysticArcanumLevel9',
  '_Steps_of_the_Fey_freeCastCount', // 2024 Archfey lv3+ w/ automation grant
  // divine lane — owner = Paladin/Cleric/Bard identities
  'channelDivinityCharges',   // features.maxChannelDivinity > 0
  'bardicInspirationUses',    // class Bard (0-row at CHA 0 kept for owners)
  'layOnHandsPool',           // class Paladin (03e419d35)
  'gloriousDefenseUses',      // class Paladin
  'preserveLifePool',         // Life-domain Cleric (03e419d35)
  'divineInterventionUses',   // Cleric lv10+
  'warPriestUses',            // class Cleric (fix#336S value gate; key now gated too)
  // primal lane — owner = Druid/Ranger circles + identity gates + ancestry traits
  'wildShapeUses',            // features.maxWildShapeUses > 0 (Druid)
  'naturalRecoverySlots',     // Druid at/over the per-edition grant level
  'moonlightStepUses',        // Circle of the Moon Druid
  'cosmicomenUses',           // Circle of the Stars Druid lv6+
  '_Star_Map_freeCastCount',  // Circle of the Stars Druid lv3+
  'naturesVeilUses',          // 2024 Ranger lv14 (fix#134 version guard)
  'favoredEnemyUses',         // class Ranger (fix#346 gate)
  'tirelessUses',             // 2024 Ranger lv10 (fix#134 version guard)
  'stonecunningUses',         // race trait 'Stonecunning' with automation
  'stonesEnduranceUses',      // subrace trait "Stone's Endurance" (Goliath)
  'stormsThunderUses',        // subrace trait "Storm's Thunder" (Goliath)
  // misc lane — owner = automation/feat/class-boost grants
  'sorcerousRestorationUses', // resource_restoration passive present
  'uncannymetabolismUses',    // features.uncannymetabolismUses > 0 (TotM Barbarian lv18)
  'luckyPoints',              // 'Lucky' feat present
  'wholenessofbodyUses',      // Monk lv6+
  'featsOfChaosUses',         // 2024 Wild Magic Sorcery OR feats_of_chaos automation
  // pool lane (03e419d35 — the reference implementation this pass mirrors)
  'healinglightPool',         // Celestial Patron Warlock
]

// Class (3): retained unconditional CLA-130 Long-Rest null re-arm — documented,
// NOT gated (gating them by `in _trackedResources` would retire the owners'
// only re-arm; rationale per family above). Representative registry of the
// load-bearing latches the ghost classification considered and RETIRED from
// gating; the full retained set is "every LONG_REST_RESOURCES key not in
// GATED_TRACKED_KEYS" (pinned by restRules-longRest.test.js).
export const HANDLER_OWNED_LATCH_KEYS = [
  // null-as-available sorcery latches (CLA-364 BUG-A family): a 0-seed kills
  // the free use; null = free use available; never in `_trackedResources`:
  'tranceOfOrderUses', 'warpingimplosionUses', 'restorebalanceUses',
  'restoreBalanceArmed', 'healinghandsUses',
  // lazy dice-pool ledgers — healingPoolHandler derives '<lowername>Pool' at
  // first use (2024/classes.json Barbarian 'Warrior of the Gods'): even the
  // owner never seeds it, so the LR fan is the ONLY re-arm — ungateable:
  'warriorofthegodsPool',
  // automation-derived uses latches written by their spending handler with the
  // `stored ?? uses` fallback (disk resourceKey or feature-name derivation):
  'rageOfTheGodsUses', 'zealousPresenceUses', 'intimidatingPresenceUses',
  'psychicveilUses', 'dreadambushUses', 'tamedSurgeUses', 'thief\'sreflexesUses',
  '_celestialRevelationUses', 'indomitableUses', 'magicalCunningUsed',
  'wildResurgenceReversedThisRest', 'countercharmUses',
  'draconicFlightUsed', 'dragonWingsUses', 'memorizeSpellUsedSinceRest',
  'inspiringLeaderUsedSinceRest',
]

// FS-010: single source of truth for a Fighter's superiority die COUNT.
// Battle Master → level-table dice; non-Battle-Master with the Superior
// Technique fighting style → exactly 1.
function battleMasterDiceMax(playerStats, classLevel, is2024) {
  if (is2024) return classLevel?.superiority_dice || 0
  // fix#346 (#1318) DISCHARGED-STALE-BY-DISK: tiers unchanged. The 5e disk
  // BY-name row classes.json Fighter > subclass 'Battle Master' lv3 'Combat
  // Superiority': "You have four superiority dice, which are d8s... You gain
  // another superiority die at 7th level and one more at 15th level." The
  // rec's 'PHB 11->5/17->6' ladder appears NOWHERE in the 5e disk (no
  // superiority_dice field; the only count text is the lv3 row above). The
  // 2024 disk superiority_dice column (lv7:5, lv15:6, byte-verified) agrees
  // with the same 7/15 law and supplies the 2024 lane via :78.
  if (playerStats.level >= 15) return 6
  if (playerStats.level >= 7) return 5
  return 4
}

export function computeSuperiorityDiceMax(playerStats) {
  if (playerStats?.class?.name !== 'Fighter') return 0
  const is2024 = playerStats.rules === '2024'
  const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level)
  const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name
  if (majorName === 'Battle Master') {
    return battleMasterDiceMax(playerStats, classLevel, is2024)
  }
  if (playerStats.class.fightingStyles?.includes('Superior Technique')) return 1
  return 0
}

function addCoreResources(resources, { playerStats }) {
  const hitPoints = playerStats.hitPoints || 0
  resources.hitPoints = { current: hitPoints, max: hitPoints }
  resources.currentHitPoints = { current: hitPoints, max: hitPoints }

  for (const level of SPELL_SLOT_LEVELS) {
    const key = `spell_slots_level_${level}`
    const max = playerStats.spellAbilities?.[key] ?? 0
    resources[key] = { current: max, max }
  }

  const shortRestHitDice = playerStats.level || 0
  resources.shortRestHitDice = { current: shortRestHitDice, max: shortRestHitDice }
}

function resolveArcaneWardMax(playerStats) {
  const hasArcaneWard = playerStats.automation?.passives?.some(p => p.type === 'arcane_ward' || (p.type === 'passive_rule' && p.effect === 'arcane_ward'))
  // Ownership is the arcane_ward passive grant itself (class-agnostic by
  // design — an item/subclass passive grants the ward for any class). No ward
  // -> null, which the GATED_TRACKED_KEYS seed site reads as "not owned"
  // (a numeric 0 would be a legal owned ward max under a negative INT).
  if (!hasArcaneWard) return null
  const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0
  return (2 * playerStats.level) + intMod
}

// Owned-only seed helper (improve tracked-resource-ghost-keys, 2026-11-14):
// assigns the pool ONLY when the caller's ownership predicate is true —
// the CLA-364/03e419d35 idiom expressed once instead of an `if` per key
// (also keeps every adder under the lint complexity ceiling).
function seedOwnedPool(resources, owned, key, pool) {
  if (owned) resources[key] = pool
}

function seedOwned(resources, owned, key, value) {
  seedOwnedPool(resources, owned, key, { current: value, max: value })
}

function addCasterResources(resources, { playerStats, features, classLevel }) {
  // improve tracked-resource-ghost-keys (owned-only pass, CLA-364/03e419d35
  // idiom): every key in this lane is STATICALLY_OWNABLE — seeded only when
  // the ownership predicate below holds. Non-owners get ZERO keys (absence =
  // unowned in every read path), not `: 0` ghosts.
  const maxSP = features?.maxSorceryPoints || 0
  seedOwned(resources, maxSP > 0, 'sorceryPoints', maxSP)

  const maxIS = features?.maxInnateSorcery || 0
  seedOwned(resources, maxIS > 0, 'innateSorceryUses', maxIS)

  const maxFP = classLevel?.focus_points || features?.maxFocusPoints || 0
  seedOwned(resources, maxFP > 0, 'focusPoints', maxFP)
  seedOwned(resources, maxFP > 0, 'kiPoints', maxFP)

  const maxAR = features?.arcaneRecoveryLevels || 0
  seedOwned(resources, maxAR > 0, 'arcaneRecoveryLevels', maxAR)

  const maxWard = resolveArcaneWardMax(playerStats)
  seedOwned(resources, maxWard != null, 'arcaneWardMax', maxWard)
  seedOwned(resources, maxWard != null, 'arcaneWardHp', maxWard)
}

function resolveActionSurgeMax(playerStats, classLevel, is2024) {
  if (playerStats.class?.name !== 'Fighter') return 0
  if (!is2024) return classLevel?.class_specific?.action_surges || 0
  return playerStats.level >= 17 ? 2 : (playerStats.level >= 2 ? 1 : 0)
}

function resolveRageMax(playerStats, classLevel, is2024) {
  if (playerStats.class?.name !== 'Barbarian') return 0
  return is2024
    ? (classLevel?.rages || 0)
    : (classLevel?.class_specific?.rage_count || 0)
}

function resolvePsionicEnergyMax(classLevel, playerStats) {
  const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name
  const hasEnergy = classLevel?.energy && classLevel.energy.required_major === majorName
  return hasEnergy ? (classLevel?.energy?.energy_die_num || 0) : 0
}

// CLA-355: Telekinetic Adept (Psi Warrior lv7) Telekinetic Thrust — once per
// Short or Long Rest (re-arm = null). One use until a rest re-arms it.
function resolveTelekineticThrustMax(playerStats) {
  const hasTelekineticThrust = (playerStats.automation?.reactions ?? [])
    .some(a => a.type === 'telekinetic_thrust')
  return hasTelekineticThrust ? 1 : 0
}

function resolveAdrenalineRushMax(playerStats) {
  const hasAdrenalineRush = (playerStats.automation?.specialActions ?? [])
    .some(a => a.effect === 'bonus_action_dash')
  return hasAdrenalineRush ? (playerStats.proficiency || 0) : 0
}

function addMartialResources(resources, { playerStats, classLevel, is2024 }) {
  // improve tracked-resource-ghost-keys (owned-only pass): all STATICALLY
  // OWNABLE — see GATED_TRACKED_KEYS. Owner rows (e.g. a 5e Fighter whose
  // exact-level class_levels row lacks second_wind) still seed their formula
  // value when the lane's data exists; the ownership predicate decides.
  const maxSW = classLevel?.second_wind || 0
  if (maxSW > 0) {
    resources.secondWindUses = { current: maxSW, max: maxSW }
  }
  // CASE-DUP RETIRED (2026-11-14 criteria pass): the old
  // `resources.secondwindUses` twin seed fanned a second casing of the same
  // latch into every bucket. No consumer reads `secondwindUses` — Second Wind
  // spends through the disk resourceKey 'secondWindUses' (classes.json 5e
  // :5560 / 2024 :4512, healingHandler, tacticalMindHandler, CharSheet
  // handlers, ShortRestModal). camelCase is canonical; twin deleted.

  const maxAS = resolveActionSurgeMax(playerStats, classLevel, is2024)
  if (maxAS > 0) {
    resources.actionSurgeUses = { current: maxAS, max: maxAS }
  }
  // CASE-DUP RETIRED: `actionsurgeUses` (feature-name derivation casing) is
  // no longer SEEDED. Its one live consumer — extraActionHandler spending the
  // automationInfoBuilder-derived resourceKey (diverse.js:24
  // 'Action Surge'->'actionsurgeUses') — is null-tolerant (`getRuntimeValue
  // ?? usesMax`) and writes its own runtime row on first press, re-armed by
  // SHORT_REST_RESOURCES. The UI/tracked lane canonicalizes on camelCase
  // 'actionSurgeUses' (CharClassFeatures TrackedResourceInput).
  // NOTE: seeded value here stays byte-identical for owners; only the twin
  // seed and its registry entry were removed.

  const maxRage = resolveRageMax(playerStats, classLevel, is2024)
  if (maxRage > 0) {
    resources.ragePoints = { current: maxRage, max: maxRage }
  }

  const maxSD = computeSuperiorityDiceMax(playerStats)
  if (maxSD > 0) {
    resources.superiorityDice = { current: maxSD, max: maxSD }
  }

  const maxPE = resolvePsionicEnergyMax(classLevel, playerStats)
  if (maxPE > 0) {
    resources.psionicEnergy = { current: maxPE, max: maxPE }
  }

  const maxTT = resolveTelekineticThrustMax(playerStats)
  if (maxTT > 0) {
    resources.telekineticThrustUses = { current: maxTT, max: maxTT }
  }

  // Ownership = the bonus_action_dash grant itself (a holder with a missing
  // proficiency datum keeps the key at {0,0} — ownership, not value, decides
  // presence, mirroring the layOnHandsPool owner-with-no-level arm).
  const adrenalineOwner = (playerStats.automation?.specialActions ?? [])
    .some(a => a.effect === 'bonus_action_dash')
  if (adrenalineOwner) {
    const maxAR = resolveAdrenalineRushMax(playerStats)
    resources.adrenalineRushUses = { current: maxAR, max: maxAR }
  }
}

function matchesPatron(playerStats, names) {
  return names.includes(playerStats.class?.major?.name) || names.includes(playerStats.class?.subclass?.name)
}

function addFiendBlessing(resources, { playerStats, isWarlock, charisma, is2024 }) {
  const isFiendPatron = isWarlock && matchesPatron(playerStats, ['Fiend', 'Fiend Patron'])
  // improve tracked-resource-ghost-keys (owned-only pass): Fiend-owned key —
  // non-Fiend buckets now carry NO darkOnesLuckUses row.
  // fix#346 (#1532): seed per the disk BY-name rows, ruleset-split.
  // 5e/classes.json Warlock > subclass 'Fiend' lv6 'Dark One's Own Luck':
  // "Once you use this feature, you can't use it again until you finish a
  // short or long rest." -> EXACTLY ONE use, no CHA-scaled pool.
  // 2024/classes.json Warlock > major 'Fiend Patron' lv6 'Dark One's Own
  // Luck': "Uses = Charisma modifier (minimum once). Regain on Long Rest."
  // -> CHA-scaling seed belongs to the 2024 ruleset ONLY.
  const maxDOL = isFiendPatron ? (is2024 ? Math.max(charisma?.bonus || 0, 1) : 1) : 0
  if (isFiendPatron) {
    resources.darkOnesLuckUses = { current: maxDOL, max: maxDOL }
  }
}

function arcanumPool(levelUses) {
  const value = levelUses || 0
  return { current: value, max: value }
}

function addPactAndArcanum(resources, { features, classLevel, is2024, isWarlock }) {
  // Owned-only (GATED_TRACKED_KEYS): Pact Magic is a Warlock class feature.
  // A Warlock whose class_levels row lacks the pact fields keeps the key at
  // {0,0} — ownership decides presence, the formula decides value.
  if (isWarlock) {
    const pactSlots = is2024 ? (classLevel?.pact_slot_levels || 0) : (classLevel?.class_specific?.pact_slots || 0)
    resources.warlockPactMagic = { current: pactSlots, max: pactSlots }
  }

  // Mystic Arcanum: one free cast per long rest for levels 6-9
  if (isWarlock && features?.arcanumLevels) {
    resources.mysticArcanumLevel6 = arcanumPool(features.arcanumLevels.level6)
    resources.mysticArcanumLevel7 = arcanumPool(features.arcanumLevels.level7)
    resources.mysticArcanumLevel8 = arcanumPool(features.arcanumLevels.level8)
    resources.mysticArcanumLevel9 = arcanumPool(features.arcanumLevels.level9)
  }
}

function addPatronPoolResources(resources, { playerStats, isWarlock, charisma, is2024 }) {
  // Healing Light: Celestial Patron dice pool (1 + warlock level dice).
  // improve tracked-resource-ghost-keys (CLA-364 idiom, :411-417): the key is
  // seeded ONLY when owned. The old unconditional seed fan-ed
  // `healinglightPool: 0` into every non-Celestial bucket (persisted by the
  // first full-store POST after campaign-select). Key absence is a
  // first-class state in every read path (useTrackedResource.resolveCurrent
  // store → _trackedResources → maxGetter; resourceCheck null-tolerant).
  const isCelestialPatron = isWarlock && matchesPatron(playerStats, ['Celestial Patron'])
  if (isCelestialPatron) {
    const maxHealingLight = 1 + (playerStats.level || 0)
    resources.healinglightPool = { current: maxHealingLight, max: maxHealingLight }
  }

  const isWarlockArchfey = isWarlock && matchesPatron(playerStats, ['Archfey Patron'])
  const hasStepsOfTheFey = (playerStats.automation?.bonusActions ?? []).some(a => a.type === 'steps_of_the_fey')
  // fix#346 (#1533): explicit disk floor. 2024/classes.json Warlock > major
  // 'Archfey Patron' lv3 'Steps of the Fey': "You can cast Misty Step
  // without expending a spell slot a number of times equal to your Charisma
  // modifier (minimum of once), and you regain all expended uses when you
  // finish a Long Rest" (automation.uses_expression 'CHA modifier_min_1').
  // The rec's lv6 floor is REFUTED by the disk BY-name row: the grant sits
  // at lv3 (2024 majors grant at lv3). 5e/classes.json carries NO 'Steps of
  // the Fey' row at ANY level (grep: sole file hit is 2024/classes.json) ->
  // 5e seeds 0, the tireless/naturesVeil version-guard idiom (fix#134).
  const stepsAllowed = isWarlockArchfey && is2024 && playerStats.level >= 3 && hasStepsOfTheFey
  // Owned-only (GATED_TRACKED_KEYS): the latch belongs to the 2024-Archfey
  // lv3+ grant; every other bucket gets NO key (its handler read path is
  // `featureFreeCastCount ?? uses` — null/absent = re-armed, and only an
  // owner ever mounts the Steps row that spends it).
  if (stepsAllowed) {
    const maxStepsOfTheFey = Math.max(charisma?.bonus || 0, 1)
    resources._Steps_of_the_Fey_freeCastCount = { current: maxStepsOfTheFey, max: maxStepsOfTheFey }
  }
}

function addWarlockResources(resources, ctx) {
  const isWarlock = ctx.playerStats.class?.name === 'Warlock'
  const scoped = { ...ctx, isWarlock }
  addFiendBlessing(resources, scoped)
  addPactAndArcanum(resources, scoped)
  addPatronPoolResources(resources, scoped)
}

function addChannelAndInspiration(resources, { playerStats, features, charisma }) {
  // Owned-only pass (GATED_TRACKED_KEYS): feature-driven keys appear only
  // when the feature actually grants them.
  const maxCD = features?.maxChannelDivinity || 0
  if (maxCD > 0) {
    resources.channelDivinityCharges = { current: maxCD, max: maxCD }
  }

  const isBard = playerStats.class?.name === 'Bard'
  if (isBard) {
    // Owner with a CHA bonus of 0 keeps the {0,0} row (ownership decides
    // presence; the bardic lane's `stored ?? maxBI` reads tolerate absence
    // anyway — the row is kept byte-identical for owners).
    const maxBI = charisma?.bonus || 0
    resources.bardicInspirationUses = { current: maxBI, max: maxBI }
  }
}

function addPaladinDivineResources(resources, { playerStats, charisma }) {
  const isPaladin = playerStats.class?.name === 'Paladin'
  // improve tracked-resource-ghost-keys (CLA-364 idiom): owned-only seed —
  // non-paladins no longer fan `layOnHandsPool: 0` into their buckets.
  if (isPaladin) {
    const maxLoH = 5 * (playerStats.level || 0)
    resources.layOnHandsPool = { current: maxLoH, max: maxLoH }
  }

  const maxGD = isPaladin ? Math.max(charisma?.bonus || 0, 1) : 0
  // Owned-only pass: Glorious Defense is a Paladin reaction (extend the
  // layOnHandsPool gate above — same class predicate).
  if (isPaladin) {
    resources.gloriousDefenseUses = { current: maxGD, max: maxGD }
  }
}

function addClericDivineResources(resources, { playerStats }) {
  const isCleric = playerStats.class?.name === 'Cleric'
  // Owned-only pass (GATED_TRACKED_KEYS): Divine Intervention is a lv10
  // cleric feature — below grant / off-class the key is ABSENT.
  seedOwned(resources, isCleric && playerStats.level >= 10, 'divineInterventionUses', 1)

  const isLifeDomain = (playerStats.class?.major?.name === 'Life Domain') || (playerStats.class?.subclass?.name === 'Life Domain')
  // improve tracked-resource-ghost-keys (CLA-364 idiom): owned-only seed —
  // non-Life-clerics no longer fan `preserveLifePool: 0` into their buckets.
  if (isCleric && isLifeDomain) {
    const maxPL = 5 * (playerStats.level || 0)
    resources.preserveLifePool = { current: maxPL, max: maxPL }
  }

  const wis = playerStats.abilities?.find(a => a.name === 'Wisdom')
  // War Priest is a cleric domain resource — gate like sibling pools above
  // (fix#336S/#1531: was seeded for EVERY class, shadowing non-clerics with a
  // phantom {current:1,max:1} pool; improve ghost-keys pass: the value gate
  // becomes a KEY gate — non-clerics now carry no row at all, and the
  // CLA-382 long-rest "superset" null re-arm only fires for clerics, whose
  // seed puts the key in `_trackedResources`).
  const maxWP = isCleric ? (wis ? Math.max(wis.bonus, 1) : 1) : 0
  seedOwned(resources, isCleric, 'warPriestUses', maxWP)
}

function addDivineResources(resources, ctx) {
  addChannelAndInspiration(resources, ctx)
  addPaladinDivineResources(resources, ctx)
  addClericDivineResources(resources, ctx)
}

function addRangerPrimalResources(resources, { playerStats, wis, is2024 }) {
  const isRanger = playerStats.class?.name === 'Ranger'
  // fix#134 (#1533): RULESET-GATED — Tireless/"Nature's Veil" rows exist
  // ONLY in the 2024 disk (public/data/2024/classes.json Ranger class_levels
  // lv10 'Tireless' / lv14 "Nature's Veil"). 5e/classes.json Ranger lv10 is
  // 'Hide in Plain Sight'/'Natural Explorer' and lv14 is 'Favored Enemy'/
  // 'Vanish' — no row either edition-side, so a 5e Ranger seeds 0
  // (version-guard house idiom, featsOfChaosResources :373). Consumers that
  // honor the seeded pool: tirelessHandler.js/naturesVeilHandler.js read
  // playerStats._trackedResources[key].current as the authoritative max.
  // improve tracked-resource-ghost-keys (owned-only pass): all three are
  // STATICALLY OWNABLE Ranger keys — non-Ranger buckets now carry none of
  // them (GATED_TRACKED_KEYS).
  const naturesVeilAllowed = isRanger && is2024 && playerStats.level >= 14
  if (naturesVeilAllowed) {
    resources.naturesVeilUses = wisGatedPool(wis)
  }

  const favoredEnemyValue = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level)?.favored_enemy || 0
  // fix#346 (#1532): Favored Enemy is a ranger resource — gate like the
  // warPriest sibling above (:276, fix#336S idiom); improve ghost-keys pass
  // widens the value gate to a KEY gate.
  // Disk: 2024/classes.json Ranger class_levels carry the count BY-level
  // (lv1 favored_enemy:2 ... lv17:6, byte-verified); 5e/classes.json Ranger
  // has no favored_enemy field (class_specific.favored_enemies is TYPES
  // known, not uses). Non-Rangers carry NO row, never a phantom >=1 pool.
  if (isRanger) {
    const favoredEnemyMax = Math.max(1, favoredEnemyValue)
    resources.favoredEnemyUses = { current: favoredEnemyMax, max: favoredEnemyMax }
  }

  const tirelessAllowed = isRanger && is2024 && playerStats.level >= 10
  if (tirelessAllowed) {
    resources.tirelessUses = wisGatedPool(wis)
  }
}

// WIS-gated use pool: max(WIS bonus, 1). Callers gate the key itself on the
// circle/class/level owner predicate (GATED_TRACKED_KEYS) before assigning.
function wisGatedPool(wis) {
  const value = Math.max(wis?.bonus || 0, 1)
  return { current: value, max: value }
}

function addDruidPrimalResources(resources, { playerStats, features, wis, is2024 }) {
  // Owned-only pass (GATED_TRACKED_KEYS): Druid-circle identities decide the
  // keys; non-Druids carry none of these rows.
  const maxWS = features?.maxWildShapeUses || 0
  seedOwned(resources, maxWS > 0, 'wildShapeUses', maxWS)

  const isDruid = playerStats.class?.name === 'Druid'
  // fix#134 (#1532): half-level recovery is ROUNDING-RULESET-AWARE per the
  // disk rows — 5e/classes.json Druid 'Land' lv2 'Natural Recovery':
  // "combined level that is equal to or less than half your druid level
  // (rounded up)" -> CEIL (lv5 = 3; old floor seeded 2, captured pre-fix).
  // 2024/classes.json 'Circle of the Land' lv6: "combined levels equal to or
  // less than half your Druid level" — no round-up clause; integer slot
  // levels <= half -> FLOOR (lv7 = 3). Grant level per row (5e lv2,
  // 2024 lv6): below grant the key is ABSENT (the feature is not owned yet).
  const nrLevel = playerStats.level || 0
  const maxNR = isDruid
    ? (is2024
      ? (nrLevel >= 6 ? Math.floor(nrLevel / 2) : 0)
      : (nrLevel >= 2 ? Math.ceil(nrLevel / 2) : 0))
    : 0
  seedOwned(resources, maxNR > 0, 'naturalRecoverySlots', maxNR)

  const isMoonCircle = isDruid && matchesPatron(playerStats, ['Circle of the Moon'])
  seedOwnedPool(resources, isMoonCircle, 'moonlightStepUses', wisGatedPool(wis))

  // #1532-b DISPROVEN-BYTE-CITED: disk law for cosmicomenUses IS the WIS
  // gate — 2024/classes.json Circle of the Stars lv6 'Cosmic Omen': "You can
  // use this Reaction a number of times equal to your Wisdom modifier
  // (minimum of once), and you regain all expended uses when you finish a
  // Long Rest" + automation.uses_expression "WIS modifier". The ONE-per-Long-
  // Rest law governs a DIFFERENT key: exactly one omen roll arms
  // cosmicOmenEffect each Long Rest (restRules-longRest.js
  // resetStarMapOnLongRest :519-535). Capping this seed to 1 would
  // contradict the disk; consumers honor max (cosmicOmenHandler.js :11-31,
  // TrackedResourceInput.jsx max={max} :13).
  const isStarsCircle = isDruid && matchesPatron(playerStats, ['Circle of the Stars'])
  seedOwnedPool(resources, isStarsCircle && playerStats.level >= 6, 'cosmicomenUses', wisGatedPool(wis))

  // Star Map free-cast latch: owned-only like cosmicomen (the disk grant is
  // lv3; resetStarMapOnLongRest re-writes the owner's value at LR anyway).
  seedOwnedPool(resources, isStarsCircle && playerStats.level >= 3, '_Star_Map_freeCastCount', wisGatedPool(wis))
}

function hasAncestralTrait(playerStats, traitName, fromSubrace) {
  const traits = (fromSubrace ? playerStats.race?.subrace?.traits : playerStats.race?.traits) || []
  return traits.some(t => t.name === traitName && t.automation)
}

function addAncestralPrimalResources(resources, { playerStats }) {
  // Owned-only pass (GATED_TRACKED_KEYS): ancestry-trait keys appear only in
  // buckets whose race/subrace actually carries the automated trait.
  if (hasAncestralTrait(playerStats, 'Stonecunning', false)) {
    const maxSC = playerStats.proficiency || 0
    resources.stonecunningUses = { current: maxSC, max: maxSC }
  }

  if (hasAncestralTrait(playerStats, "Stone's Endurance", true)) {
    const maxSE = playerStats.proficiency || 0
    resources.stonesEnduranceUses = { current: maxSE, max: maxSE }
  }

  if (hasAncestralTrait(playerStats, "Storm's Thunder", true)) {
    const maxST = playerStats.proficiency || 0
    resources.stormsThunderUses = { current: maxST, max: maxST }
  }
}

function addPrimalResources(resources, ctx) {
  addDruidPrimalResources(resources, ctx)
  addRangerPrimalResources(resources, ctx)
  addAncestralPrimalResources(resources, ctx)
}

function addRestorationAndTranceResources(resources, { playerStats, features }) {
  const hasRestoration = (playerStats.automation?.passives ?? [])
    .some(a => a.type === 'resource_restoration')
  // Owned-only pass (GATED_TRACKED_KEYS): the passive grant is the ownership.
  if (hasRestoration) {
    resources.sorcerousRestorationUses = { current: 1, max: 1 }
  }

  // CLA-364 BUG-A: tranceOfOrderUses is deliberately NOT seeded here — see
  // HANDLER_OWNED_LATCH_KEYS (class (3)): handler-owned null-as-available
  // latch, null = free use available, Long Rest null re-arm via
  // LONG_REST_RESOURCES (restRules-constants.js). A 0-seed at grant time
  // poisoned the store (seeded once per campaign load, App.jsx:327; persisted
  // by every full-store POST; applyServerOverride re-applied the stuck 0), so
  // the first-press null-as-available fallback in tranceOfOrderHandler never
  // fired and the free once-per-Long-Rest use cost 5 SP. Mirrors the
  // warpingimplosionUses pattern.

  const maxUM = (features?.uncannymetabolismUses || 0)
  if (maxUM > 0) {
    resources.uncannymetabolismUses = { current: maxUM, max: maxUM }
  }
}

function addLuckyAndMonkResources(resources, { playerStats }) {
  const isLucky = (playerStats.feats || []).some(f =>
    f?.toLowerCase?.().includes('lucky')
  )
  // Owned-only pass (GATED_TRACKED_KEYS): the feat IS the ownership; a holder
  // with a missing proficiency datum keeps the {0,0} row.
  if (isLucky) {
    const maxLP = playerStats.proficiency || 0
    resources.luckyPoints = { current: maxLP, max: maxLP }
  }

  const isMonk = playerStats.class?.name === 'Monk'
  if (isMonk && playerStats.level >= 6) {
    resources.wholenessofbodyUses = { current: 1, max: 1 }
  }
}

function addFeatsOfChaosResources(resources, { playerStats, is2024 }) {
  const isWildMagic = playerStats.class?.subclass?.name === 'Wild Magic Sorcery'
  const isWildMagic2024 = is2024 && isWildMagic
  const hasFeatsOfChaos = (playerStats.automation?.specialActions ?? []).some(a => a.type === 'feats_of_chaos') ||
    (playerStats.automation?.passives ?? []).some(a => a.type === 'feats_of_chaos')
  // Owned-only pass (GATED_TRACKED_KEYS): 2024-subclass OR automation grant
  // is the ownership (the class-agnostic automation arm stays — a stamped
  // feats_of_chaos entry owns the latch regardless of class).
  if (isWildMagic2024 || hasFeatsOfChaos) {
    resources.featsOfChaosUses = { current: 1, max: 1 }
  }
}

function addMiscResources(resources, ctx) {
  addRestorationAndTranceResources(resources, ctx)
  addLuckyAndMonkResources(resources, ctx)
  addFeatsOfChaosResources(resources, ctx)
}

export function computeTrackedResources(playerStats) {
  if (!playerStats) return {}
  const features = getClassFeatures(playerStats)
  const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level)
  const ctx = {
    playerStats,
    features,
    classLevel,
    is2024: playerStats.rules === '2024',
    charisma: playerStats.abilities?.find(a => a.name === 'Charisma'),
    wis: playerStats.abilities?.find(a => a.name === 'Wisdom'),
  }
  const resources = {}

  addCoreResources(resources, ctx)
  addCasterResources(resources, ctx)
  addMartialResources(resources, ctx)
  addWarlockResources(resources, ctx)
  addDivineResources(resources, ctx)
  addPrimalResources(resources, ctx)
  addMiscResources(resources, ctx)

  return resources
}

export function applyServerOverride(computedResources, serverData) {
  if (!serverData || typeof serverData !== 'object') return { ...computedResources }
  const merged = { ...computedResources }
  for (const [key, serverValue] of Object.entries(serverData)) {
    if (key in merged) {
      if (serverValue != null) {
        merged[key] = { ...merged[key], current: serverValue }
      }
    } else if (ALL_TRACKED_RESOURCES.includes(key)) {
      if (serverValue != null) {
        merged[key] = { current: serverValue, max: serverValue }
      }
    }
  }
  return merged
}

export function trackedResourcesToStoreEntries(trackedResources) {
  const entries = {}
  for (const [key, { current }] of Object.entries(trackedResources)) {
    entries[key] = current
  }
  return entries
}
