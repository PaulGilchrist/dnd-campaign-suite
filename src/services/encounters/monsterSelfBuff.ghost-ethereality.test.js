// MA-0780: Ghost "Ethereality" — formerly a zero-affordance inert row
// (name/description/spellcasting_ability only; spell name grep-zero in both
// spells.json under the pre-rename "Etherealness", so the Spellcasting chip
// route was BLOCKED — fix(A) rejected). NOW rides the SAME MA-0655/0658
// monster_self_buff seam: automation:{type:"monster_self_buff",
// effect:"ethereal", rounds:4800} (8 hours, §37 hours×600). RAW Ethereality
// has NO uses limit on this stat block → no uses/maxUses authored → the
// MA-0020 gate is honestly null (At Will ungated, §57); the already-active
// te refusal (ethereality_refused / already_ethereal) is the only gate.
// Plane-interaction + Border-Ethereal visibility clauses = §70 advisory
// residuals carried in the te description + grant log (§200 adjudication).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  buildSelfBuffGrantLog,
  buildAlreadyEnlargedRefusalLog,
  buildAlreadyEnlargedRefusalPopup,
  selfBuffRounds,
} from './monsterSelfBuff.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
import { TARGET_EFFECT_DEFINITIONS, getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
  KEY: 'pendingExpirations',
}));

const ghost = monstersData.find(m => m.index === 'ghost');
const ETHEREALITY_ROW = ghost.actions.find(a => a.name === 'Ethereality');
const ETH_REAL_DESC = "The ghost casts the <strong>Ethereality</strong> spell, requiring no spell components and using Charisma as the spellcasting ability. The ghost is visible on the Material Plane while on the Border Ethereal and vice versa, but it can't affect or be affected by anything on the other plane.";

function makeDeps({ activeTe = null, storedUses = {} } = {}) {
  const store = { uses: { ...storedUses }, te: null, logs: [] };
  return {
    store,
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te = { campaign, target, effect, source, extra };
    }),
    getActiveTargetEffect: vi.fn(() => activeTe),
    addExpiration: vi.fn(),
    getRuntimeValue: vi.fn(() => store.uses),
    setRuntimeValue: vi.fn((c, k, v) => { store.uses = v; return Promise.resolve(); }),
    addEntry: vi.fn((c, entry) => { store.logs.push(entry); return Promise.resolve(); }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0780 Ethereality disk data shape', () => {
  it('ghost actions[2] authors monster_self_buff automation, name/description byte-preserved, no uses (At Will)', () => {
    expect(ETHEREALITY_ROW.name).toBe('Ethereality');
    expect(ETHEREALITY_ROW.description).toBe(ETH_REAL_DESC);
    expect(ETHEREALITY_ROW.spellcasting_ability).toBe('Charisma');
    expect(ETHEREALITY_ROW.automation).toEqual({ type: 'monster_self_buff', effect: 'ethereal', rounds: 4800 });
    expect(isMonsterSelfBuffRow(ETHEREALITY_ROW)).toBe(true);
    expect(selfBuffRounds(ETHEREALITY_ROW)).toBe(4800);
    // RAW: no uses limit on this stat block → gate stays honestly null.
    expect(ETHEREALITY_ROW.uses).toBeUndefined();
    expect(ETHEREALITY_ROW.maxUses).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(ETHEREALITY_ROW, {})).toBeNull();
  });
});

describe('MA-0780 te `ethereal` registry', () => {
  it('registered exactly once, Spells group, buff badge, plane-clause advisory in description', () => {
    const def = getEffectDefinition('ethereal');
    expect(def).toBeDefined();
    expect(def.label).toBe('Ethereal');
    expect(def.icon).toBe('fa-ghost');
    expect(def.cls).toBe('effect-buff');
    expect(def.group).toBe('Spells');
    expect(def.fields).toEqual(['source']);
    expect(TARGET_EFFECT_DEFINITIONS.filter(d => d.effect === 'ethereal')).toHaveLength(1);
    expect(def.description).toMatch(/Border Ethereal/i);
    expect(def.description).toMatch(/can't affect or be affected by anything on the other plane/i);
    expect(def.description).toMatch(/§70/);
  });
});

describe('MA-0780 Ethereality grant flow (At Will, no spend)', () => {
  it('first click: NO gate/no ability_use spend, registers te ethereal on self, ONE merged rounds:4800 clock, grant log + popup', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ETHEREALITY_ROW,
      monsterName: 'Ghost 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.effectKey).toBe('ethereal');
    expect(result.remaining).toBeNull();
    expect(deps.store.uses).toEqual({});
    expect(deps.store.logs.some(e => e.type === 'ability_use')).toBe(false);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Ghost 1', 'ethereal', 'Ghost 1', expect.objectContaining({ rounds: 4800 }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Ghost 1',
      targetName: 'Ghost 1',
      campaignName: 'test-campaign',
      rounds: 4800,
      effects: [{ type: 'remove_target_effect', effectKey: 'ethereal', source: 'Ghost 1', target: 'Ghost 1' }],
    });
    const grant = deps.store.logs.find(e => e.automationType === 'ethereal_granted');
    expect(grant).toBeTruthy();
    expect(grant.characterName).toBe('Ghost 1');
    expect(grant.abilityName).toBe('Ethereality');
    expect(grant.description).toContain('4800 rounds (8 hours)');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Border Ethereal'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('At Will'));
  });

  it('grant prose is ethereal-specific — never the invisibility else-branch copy', () => {
    const grant = buildSelfBuffGrantLog({ monsterName: 'Ghost', action: ETHEREALITY_ROW, effectKey: 'ethereal', rounds: 4800 });
    expect(grant.description).toContain('Border Ethereal');
    expect(grant.description).toContain('§70');
    expect(grant.description).not.toContain('turns invisible');
    expect(grant.description).not.toContain('ends when it attacks');
    expect(grant.description).not.toContain('bolstered');
  });

  it('already ethereal: refuses zero-spend, zero te, zero clock, ethereality_refused + already_ethereal', async () => {
    const deps = makeDeps({ activeTe: { target: 'Ghost 1', effect: 'ethereal', source: 'Ghost 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ETHEREALITY_ROW,
      monsterName: 'Ghost 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'already-active' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    const refusal = deps.store.logs.find(e => e.automationType === 'ethereality_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.automationDetail).toBe('already_ethereal');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Already Ethereal'));
    expect(buildAlreadyEnlargedRefusalPopup({ monsterName: 'Ghost 1', action: ETHEREALITY_ROW, effectKey: 'ethereal' })).toContain('already ethereal');
    expect(buildAlreadyEnlargedRefusalLog({ monsterName: 'Ghost', action: ETHEREALITY_ROW, effectKey: 'ethereal' }).description).toContain('zero use spent');
  });

  it('enlarged/invisible twins keep their byte-identical grant copy (no branch bleed)', () => {
    const duergar = monstersData.find(m => m.index === 'duergar');
    const enlargeRow = duergar.actions.find(a => a.name === 'Enlarge');
    const invisRow = duergar.actions.find(a => a.name === 'Invisibility');
    const enlargeGrant = buildSelfBuffGrantLog({ monsterName: 'Duergar', action: enlargeRow, effectKey: 'enlarged', rounds: 10 });
    expect(enlargeGrant.description).toContain('for 10 rounds (1 minute) — damage dice on Strength-based weapon attacks doubled');
    const invisGrant = buildSelfBuffGrantLog({ monsterName: 'Duergar', action: invisRow, effectKey: 'invisible', rounds: 600 });
    expect(invisGrant.description).toContain('600 rounds (1 hour)');
    expect(invisGrant.description).toContain('ends when it attacks, casts a spell, or uses its Enlarge');
  });
});
