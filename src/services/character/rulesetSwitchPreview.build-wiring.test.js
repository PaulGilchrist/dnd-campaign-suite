// @maintained-by-ai 2026-11-24
/**
 * Wiring lock for the over-cap ledger fix
 * (bug-ruleset-switch-ledger-persists-overcap-feats-skills):
 * buildRulesetSwitchPreview must feed the classification the TARGET
 * ruleset's own feat slot count — getFeatLimits evaluated with
 * `{ ...formData, rules: targetRuleset }`, the exact source WizardStepFeats
 * uses for its "N of M allowed feat(s)" counter — and a legal row past that
 * count must land in the ledger's REMOVED list, not in kept.
 *
 * The loaders and the limits service are mocked: the pure classification
 * matrix lives in rulesetSwitchPreview.test.js /
 * rulesetSwitchPreview.over-cap-feats.test.js; this file pins only the seam.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/dataLoader.js', () => ({
  loadSpells: vi.fn(),
  loadFeatData: vi.fn(),
  loadClassData: vi.fn(),
  loadBackgroundData: vi.fn(),
}));
vi.mock('./featValidation.js', () => ({
  getFeatLimits: vi.fn(),
  normalizeBackgroundFeatName: (name) => String(name || '').replace(/\s*\(.*\)\s*$/, ''),
}));

import {
  loadSpells,
  loadFeatData,
  loadClassData,
  loadBackgroundData,
} from '../ui/dataLoader.js';
import { getFeatLimits } from './featValidation.js';
import { buildRulesetSwitchPreview, DROP_REASONS } from './rulesetSwitchPreview.js';

const FIVE_E_FEATS = [{ name: 'Savage Attacker' }, { name: 'Alert' }];

const draft = {
  rules: '2024',
  level: 1,
  race: { name: 'Human' },
  class: { name: 'Fighter', subclass: { name: 'Champion' } },
  background: 'Soldier',
  spells: [],
  feats: ['Savage Attacker'],
};

beforeEach(() => {
  loadSpells.mockReset().mockResolvedValue([]);
  loadFeatData.mockReset().mockResolvedValue(FIVE_E_FEATS);
  loadClassData.mockReset().mockResolvedValue([{ name: 'Fighter', class_levels: [{ level: 1 }] }]);
  loadBackgroundData.mockReset().mockResolvedValue([]);
  getFeatLimits.mockReset().mockResolvedValue({ allowed: 0, originRequired: false, originFeatLevel: 1, details: '' });
});

describe('buildRulesetSwitchPreview — target-ruleset feat slot math', () => {
  it('evaluates getFeatLimits with the TARGET ruleset applied to the draft', async () => {
    await buildRulesetSwitchPreview(draft, '5e');
    expect(getFeatLimits).toHaveBeenCalledWith(expect.objectContaining({ rules: '5e', level: 1 }));
  });

  it('classifies the name-legal origin feat as an over-cap removal when the target grants 0 slots', async () => {
    const preview = await buildRulesetSwitchPreview(draft, '5e');
    // Savage Attacker EXISTS in the 5e data (name lane) — only the cap drops it.
    expect(preview.feats.kept).toEqual([]);
    expect(preview.feats.dropped).toEqual([{
      name: 'Savage Attacker',
      reason: DROP_REASONS.OVER_CAP,
      detail: 'the 5th Edition (5e) grants no feats at level 1',
    }]);
    // The ledger summary the confirm modal renders: 0 kept, 1 removed (+ the
    // dropped 2024-only background in the overall counts).
    expect(preview.keptCount).toBe(0);
    expect(preview.droppedCount).toBe(2);
  });

  it('keeps the same row when the target cap has room for it', async () => {
    getFeatLimits.mockResolvedValue({ allowed: 1, originRequired: false, originFeatLevel: 1, details: '' });
    const preview = await buildRulesetSwitchPreview(draft, '5e');
    expect(preview.feats.kept).toEqual(['Savage Attacker']);
    expect(preview.feats.dropped).toEqual([]);
  });
});
