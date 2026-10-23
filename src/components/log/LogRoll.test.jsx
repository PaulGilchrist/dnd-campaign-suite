// @maintained-by-ai
// Lane: LogRollEntry bytes for generic type:'roll' entries (dice values, totals,
// adv/dis legs, attack outcomes, modifiers, save-damage/aoe/damage lanes).
// CUT (owner cited): container type-dispatch → LogEntryRendering.test.jsx (#879);
// death-save selected/discarded bytes (type:'death_save') → LogDeathSave.test.jsx (#877);
// condition-entry DC/ability legs (type:'condition') → LogCondition.test.jsx (#876);
// save_result entry → its own lane (#883); spell roll entry bytes → LogSpell.test.jsx (queued).
// Old→new map: cover(3)+rangeReason-hide+notice-hides+bane/bless/ray/gwf-hides+secondary-hide
// → vanillaRoll/cover + per-lane count pins; condition-save(4)→conditionSave; save-info(3)→saveInfo;
// save-result(7)→saveOutcome; aoe(3)→aoe; damageType-each(4)→damageTypeGate; resistance(2)→resistanceDetails;
// final-damage(2)→finalDamage; attack(6)→hitMiss+crit; nat badges(2)→natBadges; target(3)→targetVariants;
// bane/bless(4)+ray(2)→modifiers; gwf(3)→gwf; bonus(4)→totalBytes; showBothDice(3)→bothDice;
// secondary(2)→secondary; damage-dice(1)→damageDice; icon-each(21 rows)→iconMatrix (9 distinct icons + default).
// Family-standard setup (useLog fake, zero network) from log-test-utils.jsx; fixed timestamps.
import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { roll, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1750000000000; // fixed timestamp — never assert against Date.now() output

// Entries render newest-first (Log.jsx reverses); expect byte arrays in that order.
const textsOf = (sel) => [...document.querySelectorAll(sel)].map((n) => n.textContent.trim());
// Raw bytes, no trim — for labels whose spacing is structural (parent flex gap or
// suffix-conditional literals). #886: trailing-space defects were hidden by textsOf.
const textOfAll = (sel) => [...document.querySelectorAll(sel)].map((n) => n.textContent);

describe('Log > RollEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders header: actor, roll name, and locale-formatted fixed timestamp', () => {
    setup(Log, [roll({ timestamp: TS })]);
    expect(q('.log-entry.log-roll')).toBeInTheDocument();
    expect(q('.log-character').textContent).toBe('Frodo');
    expect(q('.log-name').textContent).toBe('LS Attack');
    expect(q('.log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('formats totals: signed bonus, bonus detail, and plain total bytes', () => {
    setup(Log, [
      roll({ id: 't1', total: 20, bonus: 5 }),
      roll({ id: 't2', total: 13, bonus: -2 }),
      roll({ id: 't3', total: 8, bonus: 3, bonusDetail: 'from bless' }),
      roll({ id: 't4', total: 15, bonus: null }),
    ]);
    expect(textsOf('.log-total')).toEqual(['15', '8+3 from bless', '13-2', '20+5']);
  });

  it('renders a vanilla roll with every optional segment absent', () => {
    setup(Log, [roll()]);
    expect(screen.queryByText(/Cover/i)).not.toBeInTheDocument();
    ['.log-range-reason', '.log-mode-badge', '.log-damage-type', '.log-save-info',
      '.log-save-result', '.log-final-damage', '.log-secondary-damage',
      '.log-resistance-details', '.log-aoe-affect', '.log-condition-save',
      '.log-resistance-notice', '.log-hunter-lore-notice', '.log-bane-penalty',
      '.log-bless-bonus', '.log-gwf', '.log-ray-enfeeblement', '.log-resistance',
      '.log-dice-formula', '.log-dice-values-inline', '.log-nat20', '.log-nat1',
    ].forEach((sel) => expect(q(sel)).not.toBeInTheDocument());
    // core still renders
    expect(screen.getByText('HIT (AC 15)')).toBeInTheDocument();
    expect(q('.log-total').textContent).toBe('20+5');
  });

  it('marks selected/discarded dice for advantage, disadvantage, and plain fallback', () => {
    setup(Log, [
      roll({ id: 'adv', rolls: [17, 9], mode: 'advantage', total: 22 }),
      roll({ id: 'dis', rolls: [3, 15], mode: 'disadvantage', total: 3, bonus: null }),
      roll({ id: 'norm', rolls: [17, 9], mode: 'normal', total: 26 }),
    ]);
    expect(textsOf('.log-die')).toEqual([
      '(26)',
      '(3 selected)', '(15 discarded)',
      '(17 selected)', '(9 discarded)',
    ]);
    expect(textsOf('.log-mode-badge')).toEqual(['DISADVANTAGE', 'ADVANTAGE']);
  });

  it('shows NAT 20 and FUMBLE badges with entry-level classes', () => {
    setup(Log, [roll({ id: 'n20', isNatural20: true }), roll({ id: 'n1', isNatural1: true })]);
    expect(q('.log-roll.log-nat20')).toHaveTextContent('NAT 20');
    expect(q('.log-roll.log-nat1')).toHaveTextContent('FUMBLE');
  });

  it('renders HIT / MISS / AUTO-MISS bytes with AC suffix, and suppresses when hit undefined', () => {
    setup(Log, [
      roll({ id: 'hit', hit: true, targetAc: 16 }),
      roll({ id: 'miss', hit: false, targetAc: null }),
      roll({ id: 'auto', isAutoMiss: true }),
      roll({ id: 'nohit', hit: undefined }),
    ]);
    // Exact bytes, NO trim (#886): the space lives inside the AC-suffix literal so
    // the no-AC label is exactly 'MISS' (no trailing space); suffix arms keep their
    // separator byte.
    expect(textOfAll('.log-hit-miss')).toEqual(['AUTO-MISS (AC 15)', 'MISS', 'HIT (AC 16)']);
    expect(q('.log-hit-miss.log-miss').textContent).toBe('MISS');
    expect(q('.log-hit-miss.log-hit')).toBeInTheDocument();
    expect(q('.log-hit-miss.log-miss')).toBeInTheDocument();
  });

  it('renders Critical Hit, Critical Miss, and natural-1 suppresses crit', () => {
    setup(Log, [
      roll({ id: 'crit', isCrit: true }),
      roll({ id: 'nat1', isCrit: false, isNatural1: true }),
      roll({ id: 'both', isCrit: true, isNatural1: true }),
    ]);
    expect(textOfAll('.log-critical-hit')).toEqual(['Critical Hit!']);
    expect(textOfAll('.log-critical-miss')).toEqual(['Critical Miss!', 'Critical Miss!']);
  });

  it('renders target variants: arrow, vs-target, save-vs-attacker, aoe suppressed', () => {
    setup(Log, [
      roll({ id: 'gen', targetName: 'Orc' }),
      roll({ id: 'sd', rollType: 'save-damage', targetName: 'Gob' }),
      roll({ id: 'sv', rollType: 'save', targetName: 'Wolf', attackerName: 'Goblin' }),
      roll({ id: 'aoe', rollType: 'aoe-damage', targetName: 'Hobgoblin' }),
    ]);
    expect(screen.getByText('→ Orc')).toBeInTheDocument();
    expect(screen.getByText('vs Gob')).toBeInTheDocument();
    expect(screen.getByText('Wolf vs Goblin')).toBeInTheDocument();
    expect(screen.queryByText(/Hobgoblin/i)).not.toBeInTheDocument();
  });

  it('renders modifier badges: bane, bless, enfeeblement, generic subtract rider', () => {
    setup(Log, [roll({ baneRoll: 3, blessRoll: 2, rayOfEnfeebleRoll: 4, subtractDieRoll: 2 })]);
    // Exact bytes, no trim: modifier badges sit in .log-dice-values (flex gap:4px) —
    // leading content spaces removed at source (#886 sibling census).
    expect(q('.log-bane-penalty').textContent).toBe('-1d4 [Bane]: -3');
    expect(q('.log-bless-bonus').textContent).toBe('+1d4 [Bless]: +2');
    expect(q('.log-ray-enfeeblement').textContent).toBe('-1d8 [Enfeeblement]: -4');
    // subtract rider reuses .log-bane-penalty — it renders as the second one
    expect(document.querySelectorAll('.log-bane-penalty')[1].textContent).toBe('-1d6 [Subtract Rider]: -2');
  });

  it('shows GWF original → display dice with rolls fallback', () => {
    setup(Log, [
      roll({ id: 'g1', gwfApplied: true, gwfOriginalRolls: [12, 8], gwfDisplayRolls: [15, 10] }),
      roll({ id: 'g2', gwfApplied: true, gwfOriginalRolls: [1, 3], rolls: [4, 6], gwfDisplayRolls: undefined }),
    ]);
    expect(textsOf('.log-gwf')).toEqual(['GWF: 1, 3 → 4, 6', 'GWF: 12, 8 → 15, 10']);
  });

  it('renders save info bytes and suppresses when saveType or saveDc missing', () => {
    setup(Log, [
      roll({ id: 'si', rollType: 'save-damage', saveType: 'dex', saveDc: 15, mode: 'disadvantage' }),
      roll({ id: 'sinm', rollType: 'save-damage', saveType: 'int', saveDc: 12 }),
      roll({ id: 'no', rollType: 'save-damage' }),
    ]);
    expect(document.querySelectorAll('.log-save-info')).toHaveLength(2);
    expect(document.querySelectorAll('.log-save-info')[1]).toHaveTextContent('DEX save DC 15');
    // newest-first: 'sinm' renders first — exact bytes, no trailing space/nbsp (#886 census)
    expect(q('.log-save-info').textContent).toBe('INT save DC 12');
    expect(screen.getByText('DISADVANTAGE')).toBeInTheDocument();
  });

  it('renders save outcome bytes: saveResult, legacy saveSuccess, dice, and null suppression', () => {
    setup(Log, [
      roll({ id: 'sr1', rollType: 'save-damage', saveResult: 'success', saveRoll: 14, saveBonus: 3 }),
      roll({ id: 'sr2', rollType: 'save-damage', saveResult: 'failure' }),
      roll({ id: 'sr3', rollType: 'save-damage', saveResult: null, saveSuccess: true }),
      roll({ id: 'sr4', rollType: 'save-damage', saveResult: null, saveSuccess: false }),
      roll({ id: 'sr5', rollType: 'save-damage', saveResult: null }),
    ]);
    expect(textsOf('.log-save-result')).toEqual([
      'SAVE FAILURE',
      'SAVE SUCCESS',
      'SAVE FAILURE',
      'SAVE SUCCESS (d20 14+3)',
    ]);
    expect(q('.log-save-result.log-condition-success')).toBeInTheDocument();
    expect(q('.log-save-result.log-condition-failure')).toBeInTheDocument();
  });

  it('renders final damage only when authored', () => {
    setup(Log, [
      roll({ id: 'fd1', rollType: 'save-damage', finalDamage: 5, damageType: 'fire' }),
      roll({ id: 'fd2', rollType: 'save-damage', finalDamage: null, damageType: 'fire' }),
    ]);
    expect(textsOf('.log-final-damage')).toEqual(['→ 5 fire damage']);
  });

  it('renders aoe formula and singular/plural affected counts, zero suppressed', () => {
    setup(Log, [
      roll({ id: 'ao3', rollType: 'aoe-damage', formula: '8d6+0', affectedCount: 3 }),
      roll({ id: 'ao1', rollType: 'aoe-damage', formula: '4d6', affectedCount: 1 }),
      roll({ id: 'ao0', rollType: 'aoe-damage', formula: '2d6', affectedCount: 0 }),
    ]);
    expect(textsOf('.log-dice-formula')).toEqual(['2d6', '4d6', '8d6+0']);
    expect(textsOf('.log-aoe-affect')).toEqual(['1 creature affected', '3 creatures affected']);
  });

  it('shows damage-type badge only on damage roll types', () => {
    setup(Log, [
      roll({ id: 'd1', rollType: 'damage', damageType: 'slashing' }),
      roll({ id: 'd2', rollType: 'save-damage', damageType: 'acid' }),
      roll({ id: 'd3', rollType: 'overchannel-damage', damageType: 'fire' }),
      roll({ id: 'd4', rollType: 'graze-damage', damageType: 'cold' }),
      roll({ id: 'd5', rollType: 'attack', damageType: 'poison' }),
    ]);
    expect(textsOf('.log-damage-type')).toEqual(['cold', 'fire', 'acid', 'slashing']);
  });

  it('renders immune/resistant badges and suppresses empty details', () => {
    setup(Log, [
      roll({ id: 'r1', rollType: 'damage', damageType: 'fire', resistanceDetails: [
        { damageType: 'fire', status: 'immune' },
        { damageType: 'cold', status: 'resistant' },
      ] }),
      roll({ id: 'r2', rollType: 'damage', resistanceDetails: [] }),
    ]);
    expect(document.querySelectorAll('.log-resistance-details')).toHaveLength(1);
    expect(textsOf('.log-immune')).toEqual(['Immune to fire']);
    expect(textsOf('.log-resistant')).toEqual(['Resistant to cold']);
  });

  it('renders resistance and hunter-lore notices with eye icon', () => {
    setup(Log, [roll({ resistanceNotice: 'Half dmg', hunterLoreNotice: 'Orc weakness detected' })]);
    expect(q('.log-resistance-notice').textContent).toBe('Half dmg');
    expect(q('.log-hunter-lore-notice')).toHaveTextContent('Orc weakness detected');
    expect(q('.log-hunter-lore-notice i.fa-eye')).toBeInTheDocument();
  });

  it('renders secondary damage with optional save bytes', () => {
    setup(Log, [
      roll({ id: 's1', secondaryFormula: '2d6', secondaryTotal: 7, secondaryDamageType: 'cold',
        secondarySaveResult: 'success', secondarySaveRoll: 14, secondarySaveBonus: 2 }),
      roll({ id: 's2', secondaryFormula: '1d4', secondaryTotal: 3, secondaryDamageType: 'fire' }),
    ]);
    expect(textsOf('.log-secondary-damage')).toEqual([
      'Secondary:1d43fire',
      'Secondary:2d67coldSAVE SUCCESS (d20 14+2)',
    ]);
    expect(document.querySelectorAll('.log-secondary-damage .log-save-result')).toHaveLength(1);
  });

  it('shows formula, dice values, and bonus-free total for damage rolls', () => {
    setup(Log, [roll({ rollType: 'damage', formula: '8d6', rolls: [5, 3, 6, 2, 4, 1, 6, 5], total: 32, bonus: 5 })]);
    expect(q('.log-dice-formula').textContent).toBe('8d6');
    expect(q('.log-dice-values-inline').textContent).toBe('(5, 3, 6, 2, 4, 1, 6, 5)');
    expect(q('.log-total').textContent).toBe('32');
  });

  it('renders condition save bytes with mode badges on roll entries', () => {
    setup(Log, [
      roll({ id: 'cs1', condition: 'charmed', dc: 15, success: true, mode: 'advantage', advantageSources: ['Bard', 'Paladin'] }),
      roll({ id: 'cs2', condition: 'frightened', dc: 10, success: false, mode: 'disadvantage' }),
    ]);
    const badges = document.querySelectorAll('.log-condition-save');
    expect(badges).toHaveLength(2);
    expect(badges[1]).toHaveTextContent('vs charmed (DC 15): SUCCESS');
    expect(badges[1]).toHaveClass('log-condition-success');
    expect(screen.getByText('ADVANTAGE (Bard, Paladin)')).toBeInTheDocument();
    expect(badges[0]).toHaveTextContent('vs frightened (DC 10): FAILURE');
    expect(badges[0]).toHaveClass('log-condition-failure');
    expect(screen.getByText('DISADVANTAGE')).toBeInTheDocument();
  });

  describe('icon mapping (one row per distinct icon + default)', () => {
    it.each([
      ['attack', 'fa-crosshairs'],
      ['spell_attack', 'fa-wand-magic-sparkles'],
      ['save', 'fa-shield-halved'],
      ['save-polymorph', 'fa-paw'],
      ['save-prismatic-spray-indigo', 'fa-eye'],
      ['save-prismatic-spray-violet', 'fa-door-open'],
      ['initiative', 'fa-bolt'],
      ['damage', 'fa-skull'],
      ['not_a_known_type', 'fa-dice-d20'],
    ])('roll type "%s" uses "%s"', (tp, cls) => {
      setup(Log, [roll({ rollType: tp })]);
      expect(q('.log-icon i')).toHaveClass(cls);
    });
  });
});
