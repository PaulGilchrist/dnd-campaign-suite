// @maintained-by-ai
// METAMAGIC / HEALING_POOL / ABILITY_USE CONTENT lane — owns the entry bytes rendered by
// MetamagicEntry (LogSpellEntry.jsx), HealingPoolEntry, and AbilityUseEntry. Routing and
// type→component dispatch (including the metamagic/metamagic_use shared-alias leg and the
// healing/healing_pool icon collision marker) is owned by #879 (LogEntryRendering.test.jsx)
// — never re-proved here; only the CONTENT inside each leaf is pinned. Producer services
// (metamagic point-spend, healing pool draws) own payload shape, not these rendered bytes.
// NOT owned here: Log.jsx container routing (#879), spell.metamagic option list on spell
// entries (LogSpell.test.jsx), psionic_sorcery bytes, death_save type lane (#877).
//
// old->new map (18 -> 10):
//   non-empowered content/full + icon -> T1 exact bytes, spellName distinct from options
//   hides SP cost/remaining when 0/null + hides options when null -> T2 falsy-suppression
//     matrix (+ NEW exhausted leg: remaining 0 renders honest 'Remaining: 0 SP' — the
//     authored `!= null` guard, not a short-circuit leak)
//   metamagic_use renders same as metamagic -> CUT (alias dispatch owned by #879; same
//     component by construction, so bytes are identical to T1)
//   singular "die" + plural "dice" -> T3 dice-count legs inside one empowered byte render
//   positive/negative/neutral classes -> T4 polarity matrix (positive leg already pinned by
//     T3's exact '+8' className)
//   dice pool rolls/diceUsed/dieType + header feature→target -> T5 one dice render with
//     custom names covering both
//   flat pool for empty/undefined rolls -> T6 flat matrix
//   save success + save failure -> T7 save polarity matrix (failure leg also covers the
//     hpGained == null absence guard)
//   death save success + failure -> T8 death-save polarity matrix
//   source tag show/hide -> T9 kept, exact bytes
//   minimal entry -> T10 default-path absence guards plus ability-name byte

import { screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  meta, q, setup, beforeEachSetup,
} from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1700000000000; // fixed epoch — deterministic timestamps (#876)

// Non-empowered "Metamagic Applied" shape (empowered shape lives in log-test-utils meta).
const metaApply = (o = {}) => ({
  id: 'ma', type: 'metamagic', characterName: 'Zar', spellName: 'Fireball',
  options: ['Quickened Spell'], sorceryPointsSpent: 3,
  remainingSorceryPoints: 2, timestamp: TS, ...o,
});

const pool = (o = {}) => ({
  id: 'p', type: 'healing_pool', sourceName: 'Paladin', targetName: 'Rogue',
  featureName: 'Lay on Hands', amount: 5, poolAfter: 20,
  rolls: [], diceUsed: 0, dieType: 6, timestamp: TS, ...o,
});

const abilityUse = (o = {}) => ({
  id: 'au', type: 'ability_use', characterName: 'Paladin',
  abilityName: 'Healing Hands', description: '', timestamp: TS, ...o,
});

describe('MetamagicEntry - non-empowered path', () => {
  beforeEach(() => beforeEachSetup());

  it('renders header, spell name, option bytes, SP cost, and remaining SP exactly', () => {
    setup(Log, [metaApply({ options: ['Quickened Spell', 'Careful Spell'] })]);
    expect(q('.log-entry.log-metamagic')).toBeInTheDocument();
    expect(q('.log-metamagic .log-character')).toHaveTextContent('Zar');
    expect(screen.getByText('Metamagic Applied')).toBeInTheDocument();
    expect(q('.log-metamagic i.fa-dice')).toBeInTheDocument();
    expect(q('.log-metamagic-spell')).toHaveTextContent('Spell: Fireball');
    expect(Array.from(document.querySelectorAll('.log-metamagic-option')).map(s => s.textContent))
      .toEqual(['Quickened Spell', 'Careful Spell']);
    expect(q('.log-metamagic-cost')).toHaveTextContent('3 SP');
    expect(q('.log-remaining-sp')).toHaveTextContent('Remaining: 2 SP');
  });

  it('suppresses falsy legs but shows exhausted pool honestly as Remaining: 0 SP', () => {
    // Falsy survivors: null options, zero spent, null remaining -> all hidden.
    setup(Log, [metaApply({
      spellName: 'Misty Step', options: null,
      sorceryPointsSpent: 0, remainingSorceryPoints: null,
    })]);
    expect(screen.getByText('Metamagic Applied')).toBeInTheDocument();
    expect(q('.log-metamagic-spell')).toHaveTextContent('Spell: Misty Step');
    expect(q('.log-metamagic-option')).not.toBeInTheDocument();
    expect(q('.log-metamagic-cost')).not.toBeInTheDocument();
    expect(q('.log-remaining-sp')).not.toBeInTheDocument();

    // Exhausted leg: 0 is authored-visible (guard is `!= null`, not truthiness) —
    // honest 'Remaining: 0 SP', while 0 spent stays suppressed by the `> 0` guard.
    cleanup();
    setup(Log, [metaApply({ sorceryPointsSpent: 0, remainingSorceryPoints: 0 })]);
    expect(q('.log-metamagic-cost')).not.toBeInTheDocument();
    expect(q('.log-remaining-sp')).toHaveTextContent('Remaining: 0 SP');
  });
});

describe('MetamagicEntry - empowered path', () => {
  beforeEach(() => beforeEachSetup());

  it('renders empowered bytes exactly and pluralizes rerolled dice count', () => {
    setup(Log, [meta()]); // Gandalf / Fireball / Orc, 30 -> 38, +8, 2 rerolled
    expect(screen.getByText('Empowered Spell — Fireball')).toBeInTheDocument();
    expect(q('.log-empowered-details .log-target')).toHaveTextContent('→ Orc');
    expect(q('.log-empowered-damage')).toHaveTextContent('30 → 38');
    expect(q('.log-empowered-difference')).toHaveTextContent('+8');
    expect(q('.log-empowered-difference').className)
      .toBe('log-empowered-difference log-empowered-positive');
    expect(q('.log-empowered-dice-info')).toHaveTextContent('Rerolled 2 dice');

    cleanup();
    setup(Log, [meta({ rerolledDiceCount: 1 })]);
    expect(q('.log-empowered-dice-info')).toHaveTextContent('Rerolled 1 die');
  });

  it('maps damageDifference to negative/neutral polarity legs exactly', () => {
    setup(Log, [meta({ damageDifference: -3, newTotal: 27 })]);
    expect(q('.log-empowered-difference')).toHaveTextContent('-3');
    expect(q('.log-empowered-difference').className)
      .toBe('log-empowered-difference log-empowered-negative');

    cleanup();
    setup(Log, [meta({ damageDifference: 0, newTotal: 30 })]);
    expect(q('.log-empowered-difference')).toHaveTextContent('0');
    expect(q('.log-empowered-difference').className)
      .toBe('log-empowered-difference log-empowered-neutral');
  });
});

describe('HealingPoolEntry - dice and flat pool legs', () => {
  beforeEach(() => beforeEachSetup());

  it('renders dice pool header and roll breakdown exactly', () => {
    setup(Log, [pool({
      sourceName: 'Zar', amount: 10, poolAfter: 15,
      rolls: [3, 5, 2], diceUsed: 3, dieType: 6,
    })]);
    expect(q('.log-entry.log-healing')).toBeInTheDocument();
    expect(q('.log-healing .log-character')).toHaveTextContent('Zar');
    expect(q('.log-entry.log-healing .log-name')).toHaveTextContent('Lay on Hands → Rogue (+10 HP)');
    expect(q('.log-hp-delta')).toHaveTextContent('Rolled 3d6:');
    expect(q('.log-dice-rolls')).toHaveTextContent('3 + 5 + 2');
    expect(q('.log-hp-current')).toHaveTextContent('= 10 HP from pool, 15 remaining');
  });

  it('renders flat-pool bytes for both empty and undefined rolls', () => {
    setup(Log, [pool({ rolls: [], amount: 5, poolAfter: 20 })]);
    expect(q('.log-hp-delta')).toHaveTextContent('Used 5 HP point from pool with');
    expect(q('.log-hp-current')).toHaveTextContent('20 remaining');
    expect(q('.log-dice-rolls')).not.toBeInTheDocument();

    cleanup();
    setup(Log, [pool({ rolls: undefined, amount: 3, poolAfter: 17 })]);
    expect(q('.log-hp-delta')).toHaveTextContent('Used 3 HP point from pool with');
    expect(q('.log-hp-current')).toHaveTextContent('17 remaining');
    expect(screen.queryByText(/Rolled/i)).not.toBeInTheDocument();
  });
});

describe('AbilityUseEntry - save, death save, source, minimal', () => {
  beforeEach(() => beforeEachSetup());

  it('renders save details success and failure legs exactly', () => {
    setup(Log, [abilityUse({
      abilityName: 'Second Wind', saveRoll: 14, saveBonus: 3,
      saveTotal: 17, saveDc: 15, saveSuccess: true, hpGained: 5,
    })]);
    expect(q('.log-entry.log-ability-use .log-name')).toHaveTextContent('Second Wind');
    expect(q('.log-ability-save-details')).toBeInTheDocument();
    expect(q('.log-ability-save-details .log-die')).toHaveTextContent('(14)');
    expect(q('.log-save-info')).toHaveTextContent('+3 = 17 vs DC 15');
    expect(q('.log-save-result')).toHaveTextContent('SUCCESS');
    expect(q('.log-save-result')).toHaveClass('log-condition-success');
    expect(q('.log-hp-gained')).toHaveTextContent('+5 HP');

    // Failure leg without hpGained also pins the `!= null` absence guard.
    cleanup();
    setup(Log, [abilityUse({
      abilityName: 'Test Ability', saveRoll: 8, saveBonus: 2,
      saveTotal: 10, saveDc: 15, saveSuccess: false,
    })]);
    expect(q('.log-save-result')).toHaveTextContent('FAILURE');
    expect(q('.log-save-result')).toHaveClass('log-condition-failure');
    expect(q('.log-hp-gained')).not.toBeInTheDocument();
  });

  it('renders death save success and failure legs exactly', () => {
    setup(Log, [abilityUse({ abilityName: 'Stabilize', deathSaveRoll: 16, deathSaveSuccess: true })]);
    expect(q('.log-ability-death-save')).toBeInTheDocument();
    expect(q('.log-ability-death-save')).toHaveTextContent('Death Save:');
    expect(q('.log-ability-death-save .log-die')).toHaveTextContent('(16)');
    expect(q('.log-ability-death-save .log-die')).toHaveClass('log-die-selected');
    expect(q('.log-ability-death-save .log-save-result')).toHaveTextContent('SUCCESS');
    expect(q('.log-ability-death-save .log-save-result')).toHaveClass('log-condition-success');
    expect(q('.log-ability-death-save i.fa-skull-crossbones')).toBeInTheDocument();

    cleanup();
    setup(Log, [abilityUse({ abilityName: 'Stabilize', deathSaveRoll: 8, deathSaveSuccess: false })]);
    expect(q('.log-ability-death-save .log-die')).toHaveTextContent('(8)');
    expect(q('.log-ability-death-save .log-die')).not.toHaveClass('log-die-selected');
    expect(q('.log-ability-death-save .log-save-result')).toHaveTextContent('FAILURE');
    expect(q('.log-ability-death-save .log-save-result')).toHaveClass('log-condition-failure');
  });

  it('shows source tag only when it differs from the ability name', () => {
    setup(Log, [abilityUse({ abilityName: 'Second Wind', source: 'Fighter Level 2' })]);
    expect(q('.log-source-tag')).toHaveTextContent('Fighter Level 2');

    cleanup();
    setup(Log, [abilityUse({ abilityName: 'Second Wind', source: 'Second Wind' })]);
    expect(q('.log-source-tag')).not.toBeInTheDocument();
  });

  it('renders a minimal entry with header byte and no save or death-save blocks', () => {
    setup(Log, [abilityUse()]);
    expect(q('.log-entry.log-ability-use')).toBeInTheDocument();
    expect(q('.log-entry.log-ability-use .log-name')).toHaveTextContent('Healing Hands');
    expect(q('.log-ability-save-details')).not.toBeInTheDocument();
    expect(q('.log-ability-death-save')).not.toBeInTheDocument();
    expect(q('.log-source-tag')).not.toBeInTheDocument();
  });
});
