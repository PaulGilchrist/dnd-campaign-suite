// @maintained-by-ai
// The shared AI entity name law (bug-designer-draft-accepts-kind-word-entity-
// name): the designer prompts advertise namingRule() — never the kind word,
// never a placeholder — and this predicate is the enforcement both the server
// validator (validateEntity) and the client approve guard run. Pinned here so
// the vocabulary contract cannot drift from either consumer.
import { describe, it, expect } from 'vitest';
import { NAME_PLACEHOLDERS, nameLawViolation } from './entityNameLaw.js';

describe('nameLawViolation — the prompt law, enforced', () => {
  it('refuses the kind word in any casing / separator spelling', () => {
    for (const name of ['npc', 'NPC', ' Npc ', 'npcs', 'NPCs']) {
      expect(nameLawViolation('npc', name), name).toMatch(/is a kind word/);
    }
    // The mapPlan file-name leak: snake/kebab forms flatten onto the kind word.
    for (const name of ['mapPlan', 'map_plan', 'map-plan', 'Map Plan', 'mapplans']) {
      expect(nameLawViolation('mapPlan', name), name).toMatch(/is a kind word/);
    }
    // Any other kind word is still a shape leak for any kind.
    expect(nameLawViolation('npc', 'quest')).toMatch(/kind word/);
    expect(nameLawViolation('faction', 'settlements')).toMatch(/kind word/);
  });

  it('refuses every advertised placeholder, case- and separator-insensitively', () => {
    for (const p of NAME_PLACEHOLDERS) {
      expect(nameLawViolation('npc', p), p).toMatch(/is a placeholder/);
      expect(nameLawViolation('npc', p.toUpperCase()), p).toMatch(/is a placeholder/);
    }
    expect(nameLawViolation('npc', 'tbd')).toMatch(/placeholder/);
    expect(nameLawViolation('npc', 'Untitled One')).toBeNull(); // not the placeholder itself
    expect(nameLawViolation('npc', 'New npc')).toMatch(/placeholder/);
    expect(nameLawViolation('faction', 'new-faction')).toMatch(/placeholder/);
  });

  it('never false-positives on names that merely CONTAIN a law word', () => {
    for (const name of [
      'Marta Copperkettle', 'Testament of the Deep', 'The Testing Grounds Guild',
      'Questing Light', 'Session of the Damned Keep', 'Encounters Long Forgotten',
      'The Iron Consortium', 'sunken-temple', 'Thornhaven',
    ]) {
      expect(nameLawViolation('npc', name), name).toBeNull();
    }
  });

  it('stays silent on absent/non-string names — that is the schema validator’s error', () => {
    expect(nameLawViolation('npc', undefined)).toBeNull();
    expect(nameLawViolation('npc', null)).toBeNull();
    expect(nameLawViolation('npc', '')).toBeNull();
    expect(nameLawViolation('npc', '   ')).toBeNull();
    expect(nameLawViolation('npc', 123)).toBeNull();
  });

  it('quotes the field it was asked about (mapPlan displayName lane)', () => {
    expect(nameLawViolation('mapPlan', 'npc', 'displayName')).toMatch(/^displayName "npc"/);
  });
});
