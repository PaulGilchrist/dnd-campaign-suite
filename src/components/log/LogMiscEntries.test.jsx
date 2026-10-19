// @maintained-by-ai
// MISC LEAF CONTENT lane — owns the bytes rendered INSIDE the seven misc leaf components:
// RestEntry (LogRestEntry.jsx), AutomationEntry, SaveResultEntry, PsionicSorceryEntry,
// SummonsEntry, SpellEffectEntry, BuffEntry. Routing and type→component dispatch — including
// the short_rest/long_rest shared-alias leg (#879) — is NOT re-proved here; only per-entry
// CONTENT is pinned (one minimal-but-exact content pin per type: title byte + core
// number/name byte + icon/polarity where it distinguishes a leg).
// Producer services own payload shape (save_result producer #871 — RENDER pinned here only);
// summons semantics SP-114 per #833/#837; note content belongs to LogNotes.test.jsx (#879
// migration note) — not here. RestEntry serves both short_rest+long_rest aliases (#879
// shared-alias leg) — CONTENT owned here per the #883 metamagic-lane header.
//
// type → byte-owner:
//   long_rest  → T1 'Long Rest' + fa-moon + '|'-split name display
//   short_rest → T2 'Short Rest' + fa-bed + '. '-split name display (distinct bytes vs T1)
//   rest falsy → T3 message:'' survivor (shell renders, details stays empty)
//   automation → T4 full bytes · T5 fallback chain (creatureName→characterName,
//                name→automationType) · T6 terminal 'Automation' + description falsy
//   save_result→ T7 success bytes (DC line, description HTML) · T8 failure polarity
//                (root modifier + inner span class) + description falsy
//   psionic    → T9 one full pin (title, SP count, slot line, note, fa-brain)
//   summons    → T10 one full pin incl comma-joined creatures list (SP-114)
//   spell_effect → T11 one full pin incl target arrow + effects li count/bytes
//   buff       → T12 added bytes · T13 removed polarity (fa-heart-crack not pinned by #879)
//   T14 falsy-absence matrix — every optional-byte guard across these leaves in one render
//
// old->new map (29 -> 14):
//   rest long + pipe-split -> T1 · rest short + period-split -> T2
//   'handles missing message' -> T3 falsy survivor
//   automation full -> T4 · falls back characterName + automationType -> T5 (one render,
//     both chain legs) · falls back "Automation" + hides description -> T6
//   saveResult success/header -> T7 · failure -> T8 · hides description -> T14
//   psionic full/header -> T9 · hides note -> T14
//   summons full/creatures-comma/header -> T10 · hides creatures+duration -> T14
//   spellEffect full/header -> T11 · hides effects + hides target -> T14
//   buff added/header -> T12 · removed -> T13 · hides reason -> T14

import { describe, it, expect, beforeEach } from 'vitest';
import {
  rest, automation, saveResult, psionic, summons, spellEffect, buff,
  q, setup, beforeEachSetup,
} from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1700000000000; // fixed epoch — deterministic timestamps (#876/#878)

describe('RestEntry', () => {
  beforeEach(beforeEachSetup);

  it('long rest: title, moon icon, pipe-split character name, full message details', () => {
    setup(Log, [rest({ timestamp: TS, type: 'long_rest', message: 'Frodo | HP restored' })]);
    expect(q('.log-character')).toHaveTextContent('Frodo');
    expect(q('.log-name')).toHaveTextContent('Long Rest');
    expect(q('.log-rest i.fa-moon')).toBeInTheDocument();
    expect(q('.log-rest-details')).toHaveTextContent('Frodo | HP restored');
  });

  it('short rest: distinct title, bed icon, period-split character name', () => {
    setup(Log, [rest({ timestamp: TS, type: 'short_rest', message: 'Frodo. Rested well.' })]);
    expect(q('.log-character')).toHaveTextContent('Frodo');
    expect(q('.log-name')).toHaveTextContent('Short Rest');
    expect(q('.log-rest i.fa-bed')).toBeInTheDocument();
    expect(q('.log-rest-details')).toHaveTextContent('Frodo. Rested well.');
  });

  it('empty message still renders the entry shell with empty details', () => {
    setup(Log, [rest({ timestamp: TS, message: '' })]);
    expect(q('.log-rest')).toBeInTheDocument();
    expect(q('.log-rest i.fa-moon')).toBeInTheDocument();
    expect(q('.log-rest-details span')).toBeNull();
  });
});

describe('AutomationEntry', () => {
  beforeEach(beforeEachSetup);

  it('renders creature, action name, description, and icon', () => {
    setup(Log, [automation({ timestamp: TS })]);
    expect(q('.log-character')).toHaveTextContent('Orc');
    expect(q('.log-name')).toHaveTextContent('Melee Attack');
    expect(q('.log-automation-details')).toHaveTextContent('Orc attacks with longsword');
    expect(q('.log-automation i.fa-wand-sparkles')).toBeInTheDocument();
  });

  it('falls back down the chain: characterName for creature, automationType for name', () => {
    setup(Log, [automation({
      timestamp: TS,
      creatureName: null,
      characterName: 'Goblin',
      name: null,
      automationType: 'Passive Defense',
    })]);
    expect(q('.log-character')).toHaveTextContent('Goblin');
    expect(q('.log-name')).toHaveTextContent('Passive Defense');
  });

  it('terminal fallback is "Automation" and blank description renders no span', () => {
    setup(Log, [automation({
      timestamp: TS,
      creatureName: null,
      characterName: null,
      name: null,
      automationType: null,
      description: '',
    })]);
    expect(q('.log-character')).toHaveTextContent('Automation');
    expect(q('.log-name')).toHaveTextContent('Automation');
    expect(q('.log-automation-details span')).toBeNull();
  });
});

describe('SaveResultEntry', () => {
  beforeEach(beforeEachSetup);

  // Producer payload shape owned by #871 — RENDER pinned here only.
  it('success: header, uppercased save type with DC, SUCCESS badge, HTML description', () => {
    setup(Log, [saveResult({
      timestamp: TS,
      saveType: 'wisdom',
      saveDc: 15,
      success: true,
      description: '<p>The target resists the effect.</p>',
    })]);
    expect(q('.log-character')).toHaveTextContent('Frodo');
    expect(q('.log-name')).toHaveTextContent('Saving Throw — Orc');
    expect(q('.log-save-info')).toHaveTextContent('WISDOM save DC 15');
    expect(q('.log-save-result')).toHaveTextContent('SAVE SUCCESS');
    expect(q('.log-save-result-entry i.fa-shield-halved')).toBeInTheDocument();
    expect(q('.log-save-result-description')).toHaveTextContent('The target resists the effect.');
  });

  it('failure: FAILURE badge with failure polarity classes; blank description hidden', () => {
    setup(Log, [saveResult({ timestamp: TS, saveType: 'strength', saveDc: 12, success: false, description: '' })]);
    expect(q('.log-save-result')).toHaveTextContent('SAVE FAILURE');
    expect(q('.log-save-result')).toHaveClass('log-condition-failure');
    expect(q('.log-save-result-entry')).toHaveClass('log-save-result-failure');
    expect(q('.log-save-result-description')).toBeNull();
  });
});

describe('PsionicSorceryEntry', () => {
  beforeEach(beforeEachSetup);

  it('renders spell name, sorcery points spent, slot line, note, and brain icon', () => {
    setup(Log, [psionic({
      timestamp: TS,
      spellName: 'Burning Hands',
      sorceryPointsSpent: 2,
      spellLevel: 2,
      note: 'Using points, not slot',
    })]);
    expect(q('.log-character')).toHaveTextContent('Sorcerer');
    expect(q('.log-name')).toHaveTextContent('Psionic Sorcery — Burning Hands');
    expect(q('.log-psionic-sp-cost')).toHaveTextContent('2 Sorcery Points');
    expect(q('.log-psionic-spell-level')).toHaveTextContent('instead of Level 2 spell slot');
    expect(q('.log-psionic-note')).toHaveTextContent('Using points, not slot');
    expect(q('.log-psionic-sorcery i.fa-brain')).toBeInTheDocument();
  });
});

describe('SummonsEntry', () => {
  beforeEach(beforeEachSetup);

  // SP-114 summon semantics per #833/#837 — rendered bytes pinned here.
  it('renders summon name, HTML description, comma-joined creatures, and duration', () => {
    setup(Log, [summons({
      timestamp: TS,
      summonName: 'Small Spider',
      description: '<p>A spider appears</p>',
      summonedCreatures: ['Small Spider', 'Wolf'],
      duration: '1 hour',
    })]);
    expect(q('.log-character')).toHaveTextContent('Wizard');
    expect(q('.log-name')).toHaveTextContent('Summons — Small Spider');
    expect(q('.log-summons i.fa-horse')).toBeInTheDocument();
    expect(q('.log-summons-description')).toHaveTextContent('A spider appears');
    expect(q('.log-summons-label')).toHaveTextContent('Creatures:');
    expect(q('.log-summons-creatures')).toHaveTextContent(/Creatures:Small Spider, Wolf/);
    expect(q('.log-summons-duration')).toHaveTextContent('Duration: 1 hour');
  });
});

describe('SpellEffectEntry', () => {
  beforeEach(beforeEachSetup);

  it('renders spell name, target arrow, effects list bytes, and medical icon', () => {
    setup(Log, [spellEffect({
      timestamp: TS,
      effects: ['Roll d4 on attack rolls', 'Roll d4 on saving throws'],
    })]);
    expect(q('.log-character')).toHaveTextContent('Cleric');
    expect(q('.log-name')).toHaveTextContent('Bless');
    expect(q('.log-target')).toHaveTextContent('→ Party');
    expect(q('.log-spell-effect i.fa-hand-holding-medical')).toBeInTheDocument();
    const items = document.querySelectorAll('.log-effects-list li');
    expect(items.length).toBe(2);
    expect(items[0]).toHaveTextContent('Roll d4 on attack rolls');
  });
});

describe('BuffEntry', () => {
  beforeEach(beforeEachSetup);

  it('added: title, buff name, reason, heart icon', () => {
    setup(Log, [buff({ timestamp: TS })]);
    expect(q('.log-character')).toHaveTextContent('Frodo');
    expect(q('.log-name')).toHaveTextContent('Effect Added');
    expect(q('.log-buff i.fa-heart')).toBeInTheDocument();
    expect(q('.log-buff-name')).toHaveTextContent('Blessing');
    expect(q('.log-buff-reason')).toHaveTextContent('— Cleric cast bless');
  });

  it('removed: distinct title, crack icon, removed class', () => {
    setup(Log, [buff({ timestamp: TS, action: 'removed', reason: 'Duration expired' })]);
    expect(q('.log-name')).toHaveTextContent('Effect Removed');
    expect(q('.log-buff i.fa-heart-crack')).toBeInTheDocument();
    expect(q('.log-buff')).toHaveClass('log-buff-removed');
    expect(q('.log-buff-reason')).toHaveTextContent('— Duration expired');
  });
});

describe('optional-byte falsy absence matrix', () => {
  beforeEach(beforeEachSetup);

  // Every optional guard across the misc leaves in one render; root presences are anchors
  // against vacuous passes, not routing re-proof (#879 owns dispatch).
  it('suppresses optional note, summons sections, effects list, target, and buff reason', () => {
    setup(Log, [
      psionic({ id: 'm1', timestamp: TS, note: '' }),
      summons({ id: 'm2', timestamp: TS + 1, summonedCreatures: [], duration: '', description: '' }),
      spellEffect({ id: 'm3', timestamp: TS + 2, effects: [], targetName: '' }),
      buff({ id: 'm4', timestamp: TS + 3, reason: '' }),
    ]);
    expect(q('.log-psionic-sorcery')).toBeInTheDocument();
    expect(q('.log-summons')).toBeInTheDocument();
    expect(q('.log-spell-effect')).toBeInTheDocument();
    expect(q('.log-buff')).toBeInTheDocument();
    expect(q('.log-psionic-note')).toBeNull();
    expect(q('.log-summons-description')).toBeNull();
    expect(q('.log-summons-creatures')).toBeNull();
    expect(q('.log-summons-duration')).toBeNull();
    expect(q('.log-effects-list')).toBeNull();
    expect(q('.log-target')).toBeNull();
    expect(q('.log-buff-reason')).toBeNull();
  });
});
