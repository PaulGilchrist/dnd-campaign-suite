import { screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  rest, automation, saveResult, psionic, summons, spellEffect, buff,
  q, setup, beforeEachSetup,
} from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('RestEntry - long and short rest', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders long rest with moon icon and correct classes', () => {
    setup(Log, [rest({
      type: 'long_rest',
      message: 'Full rest | HP restored',
    })]);
    expect(screen.getByText(/Long Rest/i)).toBeInTheDocument();
    expect(q('.log-entry.log-rest.log-rest-long')).toBeInTheDocument();
    expect(q('.log-rest i.fa-moon')).toBeInTheDocument();
    expect(q('.log-rest-details')).toHaveTextContent(/Full rest/i);
  });

  it('renders short rest with bed icon and correct classes', () => {
    setup(Log, [rest({
      type: 'short_rest',
      message: 'Short rest | Minor recovery',
    })]);
    expect(q('.log-name')).toHaveTextContent(/Short Rest/i);
    expect(q('.log-entry.log-rest.log-rest-short')).toBeInTheDocument();
    expect(q('.log-rest i.fa-bed')).toBeInTheDocument();
    expect(q('.log-rest-details')).toHaveTextContent(/Short rest/i);
  });

  it('uses first segment before pipe as character name display', () => {
    setup(Log, [rest({
      type: 'long_rest',
      message: 'Frodo | HP restored',
    })]);
    expect(q('.log-character')).toHaveTextContent(/Frodo/i);
  });

  it('uses first segment before period-space as character name display', () => {
    setup(Log, [rest({
      type: 'long_rest',
      message: 'Frodo. Rested well.',
    })]);
    expect(q('.log-character')).toHaveTextContent(/Frodo/i);
  });

  it('handles missing message gracefully', () => {
    setup(Log, [rest({
      message: '',
    })]);
    expect(q('.log-rest')).toBeInTheDocument();
    expect(q('.log-rest i.fa-moon')).toBeInTheDocument();
  });
});

describe('AutomationEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders creatureName, name, and description', () => {
    setup(Log, [automation({
      creatureName: 'Orc',
      name: 'Melee Attack',
      description: 'Orc attacks with longsword',
    })]);
    expect(q('.log-character')).toHaveTextContent(/Orc/i);
    expect(q('.log-name')).toHaveTextContent(/Melee Attack/i);
    expect(q('.log-automation-details')).toHaveTextContent(/Orc attacks with longsword/i);
    expect(q('.log-automation')).toBeInTheDocument();
    expect(q('.log-automation i.fa-wand-sparkles')).toBeInTheDocument();
  });

  it('falls back to characterName when creatureName missing', () => {
    setup(Log, [automation({
      creatureName: null,
      characterName: 'Goblin',
      name: 'Hit',
    })]);
    expect(q('.log-character')).toHaveTextContent(/Goblin/i);
  });

  it('falls back to "Automation" when both missing', () => {
    setup(Log, [automation({
      creatureName: null,
      characterName: null,
      name: null,
    })]);
    expect(q('.log-character')).toHaveTextContent(/Automation/i);
    expect(q('.log-name')).toHaveTextContent(/Automation/i);
  });

  it('falls back to automationType when name is missing', () => {
    setup(Log, [automation({
      name: null,
      automationType: 'Passive Defense',
    })]);
    expect(q('.log-name')).toHaveTextContent(/Passive Defense/i);
  });

  it('hides description when not present', () => {
    setup(Log, [automation({
      description: '',
    })]);
    expect(q('.log-automation-details')).toBeInTheDocument();
    expect(screen.queryByText(/automation/i)).not.toBeInTheDocument();
  });
});

describe('SaveResultEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders save type, DC, success/failure, and description', () => {
    setup(Log, [saveResult({
      saveType: 'wisdom',
      saveDc: 15,
      success: true,
      description: '<p>The target resists the effect.</p>',
    })]);
    expect(screen.getByText(/WISDOM save DC 15/i)).toBeInTheDocument();
    expect(screen.getByText(/SAVE SUCCESS/i)).toBeInTheDocument();
    expect(q('.log-save-result-entry.log-save-result-success')).toBeInTheDocument();
    expect(q('.log-save-result-entry i.fa-shield-halved')).toBeInTheDocument();
    expect(q('.log-save-result-description')).toBeInTheDocument();
  });

  it('shows failure state', () => {
    setup(Log, [saveResult({
      saveType: 'strength',
      saveDc: 12,
      success: false,
    })]);
    expect(screen.getByText(/SAVE FAILURE/i)).toBeInTheDocument();
    expect(q('.log-save-result-entry.log-save-result-failure')).toBeInTheDocument();
  });

  it('hides description when not present', () => {
    setup(Log, [saveResult({
      description: '',
    })]);
    expect(q('.log-save-result-description')).not.toBeInTheDocument();
  });

  it('renders character name and target name in header', () => {
    setup(Log, [saveResult({
      characterName: 'Frodo',
      targetName: 'Orc',
    })]);
    expect(q('.log-character')).toHaveTextContent(/Frodo/i);
    expect(q('.log-name')).toHaveTextContent(/Saving Throw — Orc/i);
  });
});

describe('PsionicSorceryEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders spell name, sorcery points, spell level, and note', () => {
    setup(Log, [psionic({
      spellName: 'Burning Hands',
      sorceryPointsSpent: 2,
      spellLevel: 2,
      note: 'Using Sorcery Points instead of slot',
    })]);
    expect(screen.getByText(/Psionic Sorcery — Burning Hands/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Sorcery Points/i)).toBeInTheDocument();
    expect(screen.getByText(/instead of Level 2 spell slot/i)).toBeInTheDocument();
    expect(screen.getByText(/Using Sorcery Points instead of slot/i)).toBeInTheDocument();
    expect(q('.log-psionic-sorcery')).toBeInTheDocument();
    expect(q('.log-psionic-sorcery i.fa-brain')).toBeInTheDocument();
  });

  it('hides note when empty', () => {
    setup(Log, [psionic({
      note: '',
    })]);
    expect(q('.log-psionic-note')).not.toBeInTheDocument();
  });

  it('renders character name in header', () => {
    setup(Log, [psionic({
      characterName: 'Sorcerer',
    })]);
    expect(q('.log-character')).toHaveTextContent(/Sorcerer/i);
  });
});

describe('SummonsEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders summon name, description, creatures list, and duration', () => {
    setup(Log, [summons({
      summonName: 'Small Spider',
      description: '<p>A spider appears</p>',
      summonedCreatures: ['Small Spider x2'],
      duration: '1 hour',
    })]);
    expect(screen.getByText(/Summons — Small Spider/i)).toBeInTheDocument();
    expect(q('.log-summons')).toBeInTheDocument();
    expect(q('.log-summons i.fa-horse')).toBeInTheDocument();
    expect(q('.log-summons-description')).toBeInTheDocument();
    expect(q('.log-summons-creatures')).toBeInTheDocument();
    expect(screen.getByText(/Creatures:/i)).toBeInTheDocument();
    expect(screen.getByText(/Small Spider x2/i)).toBeInTheDocument();
    expect(screen.getByText(/Duration: 1 hour/i)).toBeInTheDocument();
  });

  it('hides creatures and duration when not present', () => {
    setup(Log, [summons({
      summonedCreatures: [],
      duration: '',
    })]);
    expect(q('.log-summons-creatures')).not.toBeInTheDocument();
    expect(q('.log-summons-duration')).not.toBeInTheDocument();
  });

  it('renders character name in header', () => {
    setup(Log, [summons({
      characterName: 'Wizard',
    })]);
    expect(q('.log-character')).toHaveTextContent(/Wizard/i);
  });

  it('renders multiple creatures separated by comma', () => {
    setup(Log, [summons({
      summonedCreatures: ['Wolf', 'Bear', 'Eagle'],
    })]);
    expect(q('.log-summons-creatures')).toHaveTextContent(/Wolf, Bear, Eagle/i);
  });
});

describe('SpellEffectEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders spell name, target, effects list, and medical icon', () => {
    setup(Log, [spellEffect({
      spellName: 'Bless',
      targetName: 'Party',
      effects: ['Roll d4 on attack rolls', 'Roll d4 on saving throws'],
    })]);
    expect(screen.getByText(/Bless/i)).toBeInTheDocument();
    expect(screen.getByText(/→ Party/i)).toBeInTheDocument();
    expect(q('.log-spell-effect')).toBeInTheDocument();
    expect(q('.log-spell-effect i.fa-hand-holding-medical')).toBeInTheDocument();
    expect(q('.log-effects-list')).toBeInTheDocument();
    expect(document.querySelectorAll('.log-effects-list li').length).toBe(2);
  });

  it('hides effects when empty', () => {
    setup(Log, [spellEffect({
      effects: [],
    })]);
    expect(q('.log-effects-list')).not.toBeInTheDocument();
  });

  it('hides target when not present', () => {
    setup(Log, [spellEffect({
      targetName: '',
    })]);
    expect(screen.queryByText(/→ /i)).not.toBeInTheDocument();
  });

  it('renders character name in header', () => {
    setup(Log, [spellEffect({
      characterName: 'Cleric',
    })]);
    expect(q('.log-character')).toHaveTextContent(/Cleric/i);
  });
});

describe('BuffEntry - added and removed', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders added buff with heart icon', () => {
    setup(Log, [buff({
      buffName: 'Blessing',
      reason: 'Cleric cast bless',
      action: 'added',
    })]);
    expect(screen.getByText(/Effect Added/i)).toBeInTheDocument();
    expect(screen.getByText(/Blessing/i)).toBeInTheDocument();
    expect(screen.getByText(/— Cleric cast bless/i)).toBeInTheDocument();
    expect(q('.log-entry.log-buff.log-buff-added')).toBeInTheDocument();
    expect(q('.log-buff i.fa-heart')).toBeInTheDocument();
  });

  it('renders removed buff with heart-crack icon', () => {
    setup(Log, [buff({
      buffName: 'Blessing',
      reason: 'Duration expired',
      action: 'removed',
    })]);
    expect(screen.getByText(/Effect Removed/i)).toBeInTheDocument();
    expect(q('.log-entry.log-buff.log-buff-removed')).toBeInTheDocument();
    expect(q('.log-buff i.fa-heart-crack')).toBeInTheDocument();
  });

  it('hides reason when not present', () => {
    setup(Log, [buff({
      reason: '',
    })]);
    expect(screen.queryByText(/— /i)).not.toBeInTheDocument();
  });

  it('renders character name and buff name in header', () => {
    setup(Log, [buff({
      characterName: 'Frodo',
      buffName: 'Blessing',
    })]);
    expect(q('.log-character')).toHaveTextContent(/Frodo/i);
    expect(q('.log-buff-name')).toHaveTextContent(/Blessing/i);
  });
});
