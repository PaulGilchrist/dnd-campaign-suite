// @maintained-by-ai
// CLA-023 Avatar of Battle — disk-row-to-halving application lane.
// Ticket contract: the 'Avatar of Battle' feature's verbatim automation envelope
// (damageTypes B/P/S) halves matching damage at the compute seam.
// Consulted-bytes census — computeDamageAfterResistances (applyDamage.js:41-50)
// reads ONLY: damageTypes non-empty + each entry non-empty string, then per-type
// lowercased compare against immunities?.some / resistances?.some, floor(raw/2)
// on first match, raw otherwise. Zero-is-data honored (floor(0/2)=0, #945).
// Byte-source: public/data/classes.json subclasses/class_levels/features (5e War
// Domain lv17, description carries 'from nonmagical weapons') and
// public/data/2024/classes.json majors/features (2024 lv17) — exactly one hit per
// disk, pinned below (BY NAME #977). The 5e 'nonmagical' qualifier is NOT modeled
// at this seam — adjudicated, documented ungated-emit in automationPassives.js:327-328.
// fix#356(b) census re-verified at current bytes — magic-weapon signal at the
// applyDamage chokepoint: NONE. applyDamageToTarget options carry isSpellDamage
// only (zero weapon-identity keys across all 72 call sites); the lastAttack stamp
// (applyDamage.js:192-215) carries weaponType melee/ranged/unarmed + isUnarmed-
// Strike but no magic flag; equipment.json property tokens are Ammunition..
// Versatile (no 'magic'); magic-items.json is a catalog never joined to attack
// payloads. Gating the 5e prose without that plumbing means guessing magic from
// damage type alone — forbidden. 2024 disk prose is unconditional ("Resistance to
// Bludgeoning, Piercing, and Slashing damage."), so ungated halving is correct
// for 2024 rows; the 5e-side gate is QUEUED owner architecture (plumbing options
// reported: payload magic flag at attack lanes, or source-tagged resistances).
// Owners cited, not re-driven: producer emit from the envelope
// (getDamageResistances, no store reads) -> automationPassives.stormbornResistance.test.js:141-145;
// generic helper arithmetic (throw-guards, immunity-beats-resistance, floor,
// case-fold, multi-type first-match on hand-authored lists) ->
// combat/applyDamage.helpers.test.js:52-84; 2024 flattener envelope ->
// automationInfoBuilder/core-handlers.test.js:435-451. Re-driving the arithmetic
// here is deliberate: resistances arrive verbatim from disk, so a damageTypes
// regression (drop/rename/reorder in classes.json) fails CLA-023, not only the
// generic lane — no other test loads the 5e disk row.
// Old->new: 10 its -> 2 tests (it.each #903). 'halves Bludgeoning/Piercing/
// Slashing' + 'odd floor 21->10' + 'mixed halves' + 'case-insensitive' ->
// applied-table rows; 'does not halve Fire/Force/Radiant' + 'no types match' ->
// passthrough rows (deduped to owner helpers:61-64, one kept per class as
// disk-driven); added: verbatim disk envelope rows (5e + 2024) and zero-is-data.
// Pure predicates: zero mocks, no timers, no network, no store (#791).
import { describe, it, expect } from 'vitest'
import classes5e from '../../../public/data/classes.json'
import classes2024 from '../../../public/data/2024/classes.json'
import { computeDamageAfterResistances } from './combat/applyDamage.js'

// Single canonical finder: collects every feature object with the exact name byte
// and an automation envelope, at any nesting (subclasses vs majors differ per disk).
function findAutomationByName(tree, name) {
  const hits = []
  ;(function walk(node) {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node && typeof node === 'object') {
      if (node.name === name && node.automation) hits.push(node.automation)
      Object.values(node).forEach(walk)
    }
  })(tree)
  return hits
}

const ENVELOPE_VERBATIM = {
  type: 'resistance',
  damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
  casting_time: 'passive',
}

describe('CLA-023 Avatar of Battle — disk row drives halving', () => {
  it.each([
    ['5e public/data/classes.json', classes5e],
    ['2024 public/data/2024/classes.json', classes2024],
  ])('%s carries exactly one Avatar of Battle row with the verbatim resistance envelope', (_label, disk) => {
    const envelopes = findAutomationByName(disk, 'Avatar of Battle')
    expect(envelopes).toHaveLength(1)
    expect(envelopes[0]).toEqual(ENVELOPE_VERBATIM)
  })

  // Resistances fed verbatim from the 5e disk row — the byte source the ticket owns.
  const resistances = findAutomationByName(classes5e, 'Avatar of Battle')[0].damageTypes

  it.each([
    ['Bludgeoning halved', 20, ['Bludgeoning'], 10],
    ['Piercing halved', 20, ['Piercing'], 10],
    ['Slashing halved', 20, ['Slashing'], 10],
    ['odd damage floor-halved', 21, ['Bludgeoning'], 10],
    ['mixed damage halves on first matching type', 20, ['Bludgeoning', 'Fire'], 10],
    ['lowercase incoming byte still halves (description bytes are lowercase)', 20, ['bludgeoning'], 10],
    ['Fire untouched', 20, ['Fire'], 20],
    ['Force untouched', 20, ['Force'], 20],
    ['Radiant untouched', 20, ['Radiant'], 20],
    ['zero damage is data — stays zero', 0, ['Bludgeoning'], 0],
  ])('%s: %i %j resolves to %i', (_label, rawDamage, damageTypes, expected) => {
    expect(computeDamageAfterResistances(rawDamage, damageTypes, resistances, [])).toBe(expected)
  })
})
