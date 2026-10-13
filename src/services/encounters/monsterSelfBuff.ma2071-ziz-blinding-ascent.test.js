// MA-2071: Ziz "Blinding Ascent" legendary child — formerly a prose-only
// row (name + description only) that spent a legendary use unconditionally
// and died in the console.error at MonsterCardModal.jsx:776 ("no resolvable
// mechanic") with ZERO invisibility grant (MA-2012/MA-2054 twin). NOW onto
// the LIVE MA-0658/MA-0694 monster_self_buff seam: automation:
// {type:"monster_self_buff", effect:"invisible", rounds:2} mirroring the
// imp/duergar/sprite invisibility byte-shape with the Empyrean Bolster
// rounds:2 legendary-child precedent. rounds:2 is the adjudicated
// approximation of RAW "until the start of his next turn" (round-clock
// granularity: granted in round R it clears at the start of round R+2 —
// processExpirationList currentRound >= appliedRound + rounds; attack/cast
// enders are the family's real enders and are RAW-consistent for
// invisibility; the §398 movement clause "rises into the sun" stays
// unexpressible). Legendary lane: MonsterCardModal.jsx resolveLegendaryRow
// already-active refusal BEFORE the spend (:919), expendLegendaryUse spends
// the shared header pool (:920), then resolveLegendaryRowMechanic routes the
// self-buff child to resolveMonsterSelfBuffRow with storedUses:{} (:763-770)
// — the row authors NO uses/maxUses (§165), so the internal gate is null
// and the seam NEVER double-spends. Refusal slug derives from the ACTION
// NAME (§239): `blinding_ascent_refused` / already_invisible, zero te, zero
// clock. te `invisible` registry entry (MA-0658, targetEffectDefinitions.js)
// is REGISTERED — the stale §195 "absent" note is resolved by the pin below.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSelfBuffRow,
  resolveMonsterSelfBuffRow,
  selfBuffRounds,
  buildSelfBuffGrantLog,
  buildSelfBuffPopup,
} from './monsterSelfBuff.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
import { getEffectDefinition, TARGET_EFFECT_DEFINITIONS } from '../combat/conditions/targetEffectDefinitions.js';
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

const ziz = monstersData.find(m => m.index === 'ziz');
const HEADER = ziz.legendary_actions[0];
const WING = ziz.legendary_actions[1];
const ASCENT = ziz.legendary_actions[2];
const SCREECH = ziz.legendary_actions[3];
const ASCENT_DESC = 'Ziz rises into the sun, becoming invisible until the start of his next turn.';

function makeDeps({ activeTe = null } = {}) {
  const store = { te: [], expirations: [], logs: [] };
  return {
    store,
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te.push({ campaign, target, effect, source, extra });
    }),
    getActiveTargetEffect: vi.fn(() => activeTe),
    addExpiration: vi.fn((entry) => { store.expirations.push(entry); }),
    getRuntimeValue: vi.fn(() => ({})),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
    addEntry: vi.fn((c, entry) => { store.logs.push(entry); return Promise.resolve(); }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-2071 Ziz Blinding Ascent disk data shape — one-field fix, siblings byte-inert', () => {
  it('legendary_actions[0] header keeps its numeric uses:3 counter (§165)', () => {
    expect(HEADER.name).toBe('Legendary Action Uses: 3');
    expect(HEADER.uses).toBe(3);
  });

  it('legendary_actions[2] Blinding Ascent authors monster_self_buff/invisible rounds:2, description byte-unchanged', () => {
    expect(ASCENT.name).toBe('Blinding Ascent');
    expect(ASCENT.description).toBe(ASCENT_DESC);
    expect(ASCENT.automation).toEqual({ type: 'monster_self_buff', effect: 'invisible', rounds: 2 });
    expect(isMonsterSelfBuffRow(ASCENT)).toBe(true);
    expect(selfBuffRounds(ASCENT)).toBe(2);
  });

  it('child authors NO uses/advisory/delegates_to (§165 phantom-counter ban; the row previously had NEITHER fix field — the burn shape)', () => {
    expect(ASCENT.uses).toBeUndefined();
    expect(ASCENT.maxUses).toBeUndefined();
    expect(ASCENT.advisory).toBeUndefined();
    expect(ASCENT.delegates_to).toBeUndefined();
    // no uses → internal gate honestly null; the spend rides the shared legendary header pool only.
    expect(monsterAbilitySaveUsesGate(ASCENT, {})).toBeNull();
  });

  it('automation is byte-identical to the imp/sprite invisibility twins except the adjudicated rounds:2', () => {
    const imp = monstersData.find(m => m.index === 'imp');
    const impInvis = imp.actions.find(a => a.name === 'Invisibility');
    expect(ASCENT.automation.type).toBe(impInvis.automation.type);
    expect(ASCENT.automation.effect).toBe(impInvis.automation.effect);
    expect(ASCENT.automation.rounds).toBe(2); // imp/duergar/sprite ride the rounds:600 backstop; RAW until-next-turn pins 2
    // legendary-child twin: Empyrean Bolster is the proven rounds:2 self-buff child.
    const emp = monstersData.find(m => m.index === 'empyrean');
    expect(emp.legendary_actions[1].automation.type).toBe('monster_self_buff');
    expect(emp.legendary_actions[1].automation.rounds).toBe(2);
  });

  it('te `invisible` IS registered (MA-0658 entry; stale §195 "absent" note disproven) — eye-slash, buff, Spells', () => {
    const def = getEffectDefinition('invisible');
    expect(def).toBeDefined();
    expect(def.effect).toBe('invisible');
    expect(def.icon).toBe('fa-eye-slash');
    expect(def.cls).toBe('effect-buff');
    expect(def.group).toBe('Spells');
    expect(TARGET_EFFECT_DEFINITIONS.filter(d => d.effect === 'invisible')).toHaveLength(1);
  });

  it('Wing delegate and Sky Screech sibling rows stay byte-inert (MA-2072 carry)', () => {
    expect(WING.delegates_to).toBe('Wing');
    expect(WING.automation).toBeUndefined();
    expect(SCREECH.name).toBe('Sky Screech (Costs 2 Actions)');
    expect(SCREECH.automation).toBeUndefined();
  });
});

describe('MA-2071 grant flow — legendary child resolves spend-free on the self-buff seam', () => {
  it('first press: te invisible on self rounds:2, ONE merged clock with remove_target_effect byte-shape, invisible_granted log "2 rounds", popup, zero ability_use (legendary gate spends upstream at Modal :920)', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ASCENT, monsterName: 'Ziz 1', campaignName: 'test-campaign', setPopupHtml, storedUses: {}, deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.effectKey).toBe('invisible');
    expect(result.rounds).toBe(2);
    expect(result.remaining).toBeNull(); // gate null (§165) — no own-use counter
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Ziz 1', 'invisible', 'Ziz 1', expect.objectContaining({ rounds: 2, duration: 'minute', actionName: 'Blinding Ascent' }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Ziz 1',
      targetName: 'Ziz 1',
      campaignName: 'test-campaign',
      rounds: 2,
      effects: [{ type: 'remove_target_effect', effectKey: 'invisible', source: 'Ziz 1', target: 'Ziz 1' }],
    });
    const grant = deps.store.logs.find(e => e.automationType === 'invisible_granted');
    expect(grant).toBeTruthy();
    expect(grant.characterName).toBe('Ziz 1');
    expect(grant.abilityName).toBe('Blinding Ascent');
    expect(grant.description).toContain('armed on itself for 2 rounds');
    expect(deps.store.logs.some(e => e.type === 'ability_use')).toBe(false);
    expect(deps.store.logs.some(e => e.type === 'roll')).toBe(false); // zero-roll record
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Ziz 1 is Invisible');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('turns invisible via Blinding Ascent');
  });

  it('grant/popup copy ride the existing invisibility branch — twin copy, no new effect key, no uses counter', () => {
    const grant = buildSelfBuffGrantLog({ monsterName: 'Ziz 1', action: ASCENT, effectKey: 'invisible', rounds: 2 });
    expect(grant.description).toContain('ends when it attacks, casts a spell');
    expect(grant.description).toContain('§70');
    const popup = buildSelfBuffPopup({ monsterName: 'Ziz 1', action: ASCENT, effectKey: 'invisible', rounds: 2, remaining: null });
    expect(popup).toContain('Ziz 1 is Invisible');
    expect(popup).not.toContain('use(s) left');
  });

  it('refire while active (post-spend lane): blinding_ascent_refused / already_invisible, zero te, zero clock, zero write — already_invisible popup', async () => {
    const deps = makeDeps({ activeTe: { target: 'Ziz 1', effect: 'invisible', source: 'Ziz 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSelfBuffRow({
      action: ASCENT, monsterName: 'Ziz 1', campaignName: 'test-campaign', setPopupHtml, storedUses: {}, deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'already-active' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    const refusal = deps.store.logs.find(e => e.automationType === 'blinding_ascent_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.automationDetail).toBe('already_invisible');
    expect(refusal.characterName).toBe('Ziz 1');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Already Invisible');
  });

  it('re-grant after the rounds:2 clock drops the te re-arms honestly (fresh press, fresh clock)', async () => {
    const deps = makeDeps();
    const first = await resolveMonsterSelfBuffRow({ action: ASCENT, monsterName: 'Ziz 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), storedUses: {}, deps });
    expect(first.resolved).toBe(true);
    const deps2 = makeDeps();
    const second = await resolveMonsterSelfBuffRow({ action: ASCENT, monsterName: 'Ziz 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), storedUses: {}, deps: deps2 });
    expect(second.resolved).toBe(true);
    expect(deps2.registerTargetEffect).toHaveBeenCalledTimes(1);
    expect(deps2.addExpiration).toHaveBeenCalledTimes(1);
  });
});
