// MA-1962: Orcus legendary_actions[2] "Creeping Death (Costs 2 Actions)"
// was a bare name+description prose child — the MA-0510 silent-burn
// fingerprint confirmed live 2026-10-12: the gated "Expend Legendary" chip
// spent exactly 2 (MA-1883 cost lane honest — "Costs 2 Actions" parsed from
// the row NAME) but resolveLegendaryRowMechanic fell to the console.error
// dead-end (MonsterCardModal.jsx:776) — popups[] empty, no zone/vulnerability
// record anywhere: cd zone/area/cylinder/vulnerability key grep 0, top-level
// targetEffects ABSENT, log carried economy facts only.
// Fix: flat advisory fields §253 honest advisory-floor — MA-1944 Ladon
// Vigilant Watch / MA-1936 King Kong Climbing Dash byte-shape twins.
// advisory is inspected BEFORE the numeric/delegate legs (Modal :755), so
// the press becomes an honest record-only popup + ability_use "GM-enforced"
// advisory log while the costs-2 gate keeps spending 2 honestly and the
// MA-0510 console error dies. No necrotic-vulnerability te is registered and
// no zone dict/ticks are built (GM-positioned cylinder = codified advisory
// floor, MA-1060 Kraken precedent family; §70 zone/wall zero-consumer).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  legendaryHeaderAction,
  legendaryActionCost,
  expendLegendaryUse,
  buildLegendaryAdvisoryPopup,
  buildLegendaryAdvisoryLog,
  hasLegendaryCooldownClause,
} from './monsterLegendaryUses.js';
import { isMonsterActionAdvisoryRow } from './monsterActionAdvisory.js';

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ORCUS = monsters.find((m) => m.index === 'orcus');
const DEATH = ORCUS.legendary_actions[2];
const ADVISORY_MESSAGE = "Area Effect: a 60-foot-tall, 10-foot-radius Cylinder of swirling necrotic energy rises from a point Orcus can see within 100 ft. and lasts until the end of his next turn. Creatures in the area have Vulnerability to Necrotic damage — GM-enforced; no cylinder-zone or vulnerability consumer exists in the app. No saving throw, no damage.";

describe('MA-1962 disk fingerprint: Orcus Creeping Death flat advisory authored', () => {
  it('row identity byte-locked with advisory + advisory_message after name, before description', () => {
    expect(ORCUS.name).toBe('Orcus');
    expect(DEATH.name).toBe('Creeping Death (Costs 2 Actions)');
    expect(Object.keys(DEATH)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    // Disk-canonical: this child NEVER carried delegates_to (unlike sibling
    // "Attack" → Necrotic Bolt) — the fix MUST NOT add one (MA-1847 axis).
    expect(DEATH.delegates_to).toBeUndefined();
    expect(DEATH.advisory).toBe('creeping_death');
    expect(DEATH.advisory_message).toBe(ADVISORY_MESSAGE);
    expect(DEATH.description).toBe("Area Effect: a 60-foot-tall, 10-foot-radius Cylinder of swirling necrotic energy rises from a point it can see within 100 ft. and lasts until the end of Orcus's next turn. Creatures in the area have Vulnerability to Necrotic damage. No saving throw, no damage.");
  });

  it('advisory_message carries the RAW numerics honestly (cylinder dims + range + duration + vulnerability) and the GM-enforced residual', () => {
    expect(DEATH.advisory_message).toContain('60-foot-tall, 10-foot-radius Cylinder');
    expect(DEATH.advisory_message).toContain('within 100 ft.');
    expect(DEATH.advisory_message).toContain('until the end of his next turn');
    expect(DEATH.advisory_message).toContain('Vulnerability to Necrotic');
    expect(DEATH.advisory_message).toContain('GM-enforced');
    expect(DEATH.advisory_message).toContain('No saving throw, no damage');
  });

  it('row authors NO numeric/mechanic fields — advisory child never rolls (§168 child template, MA-1847 axis closed)', () => {
    expect(DEATH.attack_bonus).toBeUndefined();
    expect(DEATH.save_dc).toBeUndefined();
    expect(DEATH.damage_dice_primary).toBeUndefined();
    expect(DEATH.uses).toBeUndefined();
    expect(DEATH.zone).toBeUndefined();
    // No per-action cooldown clause on this row — boundary economy only.
    expect(hasLegendaryCooldownClause(DEATH)).toBe(false);
  });

  it('Orcus has no monster-side zone surface — advisory is the honest floor (§70, MA-1060 family)', () => {
    expect(ORCUS.reactions).toEqual([]);
    expect(ORCUS.lair_actions).toEqual([]);
  });

  it('advisory arm recognized: predicate true, advisory_message twin wins over MA-0058 invisibility fallback copy', () => {
    expect(isMonsterActionAdvisoryRow(DEATH)).toBe(true);
    const html = buildLegendaryAdvisoryPopup({ monsterName: 'Orcus 1', action: DEATH });
    expect(html).toContain('<div class="mc-prerequisite-refusal">');
    expect(html).toContain('<h3>Legendary Action — Creeping Death (Costs 2 Actions)</h3>');
    expect(html).toContain('Orcus 1 Area Effect: a 60-foot-tall, 10-foot-radius Cylinder');
    expect(html).toContain('Vulnerability to Necrotic damage — GM-enforced; no cylinder-zone or vulnerability consumer exists in the app. No saving throw, no damage.');
    expect(html).not.toContain('casts creeping death on itself');
  });

  it('advisory log is an honest ability_use record naming the row and the GM-enforced residual', () => {
    const entry = buildLegendaryAdvisoryLog({ monsterName: 'Orcus 1', action: DEATH });
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Orcus 1');
    expect(entry.abilityName).toBe('Creeping Death (Costs 2 Actions)');
    expect(entry.description).toBe(`Orcus 1 legendary action Creeping Death (Costs 2 Actions): Orcus 1 ${ADVISORY_MESSAGE}`);
  });
});

describe('MA-1962 advisory Creeping Death rides the shared legendary economy (costs-2 stays live)', () => {
  let store;
  let logs;
  let deps;
  let cs;
  beforeEach(() => {
    store = {};
    logs = [];
    cs = { round: 1, activeCreatureName: 'Bandit 1' };
    deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      getCombatContext: vi.fn(() => Promise.resolve(cs)),
    };
  });

  it('header byte-unchanged uses:3; cost parsed from name = 2 (MA-1883)', () => {
    const header = legendaryHeaderAction(ORCUS);
    expect(header.uses).toBe(3);
    expect(header.name).toBe('Legendary Action Uses: 3');
    expect(legendaryActionCost(DEATH)).toBe(2);
  });

  it('legal-boundary press spends exactly 2 with the honest multi-spend counter log', async () => {
    const r = await expendLegendaryUse({ monsterName: 'Orcus 1', monster: ORCUS, actionName: DEATH.name, action: DEATH, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 1, max: 3 });
    expect(store['Orcus 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].description).toBe("Orcus 1 spends 2 legendary uses for Creeping Death (Costs 2 Actions) after Bandit 1's turn — 1 of 3 left (regain at the start of Orcus 1's turn; 4 in lair advisory).");
  });

  it('same-boundary re-press refuses turn-latch with ZERO extra spend (gate order turn→cost)', async () => {
    await expendLegendaryUse({ monsterName: 'Orcus 1', monster: ORCUS, actionName: DEATH.name, action: DEATH, campaignName: 'test-campaign', deps });
    const refused = await expendLegendaryUse({ monsterName: 'Orcus 1', monster: ORCUS, actionName: DEATH.name, action: DEATH, campaignName: 'test-campaign', deps });
    expect(refused.spent).toBe(false);
    expect(refused.reason).toBe('turn');
    expect(store['Orcus 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(logs.some(e => e.automationType === 'legendary_use_refused')).toBe(true);
  });

  it('cost-floor control at 1-left refuses insufficient-cost with zero spend', async () => {
    store['Orcus 1.monsterLegendaryUses'] = { max: 3, used: 2 };
    const refused = await expendLegendaryUse({ monsterName: 'Orcus 1', monster: ORCUS, actionName: DEATH.name, action: DEATH, campaignName: 'test-campaign', deps });
    expect(refused.spent).toBe(false);
    expect(refused.reason).toBe('insufficient-cost');
    expect(refused.popupHtml).toContain('costs 2 legendary uses but Orcus 1 has only 1 left');
    expect(logs[0].description).toContain('insufficient-cost: costs 2, 1 left');
    expect(store['Orcus 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
  });

  it('insufficient-cost at 0-left refuses exhausted with zero spend', async () => {
    store['Orcus 1.monsterLegendaryUses'] = { max: 3, used: 3 };
    const refused = await expendLegendaryUse({ monsterName: 'Orcus 1', monster: ORCUS, actionName: DEATH.name, action: DEATH, campaignName: 'test-campaign', deps });
    expect(refused.spent).toBe(false);
    expect(store['Orcus 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
  });
});

describe('MA-1962 card siblings intact', () => {
  it('legendary header + Attack delegate byte-locked (not re-added this pass)', () => {
    const header = ORCUS.legendary_actions[0];
    expect(Object.keys(header)).toEqual(['name', 'uses', 'description']);
    expect(header.uses).toBe(3);
    const attack = ORCUS.legendary_actions[1];
    expect(Object.keys(attack)).toEqual(['name', 'delegates_to', 'description']);
    expect(attack.delegates_to).toBe('Necrotic Bolt');
    expect(attack.advisory).toBeUndefined();
  });

  it('MA-1958 Spellcasting markup row byte-locked (today\'s fix untouched)', () => {
    const spellcasting = ORCUS.actions[5];
    expect(spellcasting.name).toBe('Spellcasting');
    expect(spellcasting.description).toBe('Orcus casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23): <strong>At Will:</strong> <em>Detect Magic</em>. <strong>3/Day:</strong> <em>Dispel Magic</em>. <strong>1/Day:</strong> <em>Time Stop</em>.');
    expect(spellcasting.save_dc).toBe(23);
    expect(spellcasting.save_type).toBe('Wisdom');
  });

  it('MA-1959 Wand Spellcasting chip+shell row byte-locked (today\'s fix untouched)', () => {
    const wand = ORCUS.actions[6];
    expect(wand.name).toBe('Wand Spellcasting');
    expect(wand.save_dc).toBe(18);
    expect(wand.save_type).toBe('Wisdom');
    expect(wand.dc_success).toBe('none');
  });

  it('weapon rows byte-locked (delegate master Necrotic Bolt stays numeric)', () => {
    const bolt = ORCUS.actions.find((a) => a.name === 'Necrotic Bolt');
    expect(bolt.attack_bonus).toBeDefined();
    expect(bolt.damage_dice_primary).toBe('5d8 + 7');
    expect(bolt.damage_type_primary).toBe('Necrotic');
  });
});
