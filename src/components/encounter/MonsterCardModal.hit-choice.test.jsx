// MA-0855: Githzerai Psion Psychic Warp — GM-adjudicated CONDITION CHOICE on
// the monster attack HIT popup (monsters.json hit_choice — Charmed-or-Prone).
// MA-0325 two-handed modal seam mirror: offer forwarded to rollAttack context,
// pick grants ONLY the chosen condition via the canonical activeConditions +
// activeConditionMeta runtime channel (single merged setRuntimeObject per §39),
// logs `condition applied` + `hit_choice_selected`; the UNCHOSEN option is
// never granted; a resolved decision cannot re-fire; an unpicked Done grants
// NOTHING (honest advisory) and the hit_conditions array auto-grant stays
// suppressed (autoDamage.hitClause null). Non-choice rows stay byte-inert.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersJson from '../../../public/data/monsters.json';

const VIAC_OFFER = {
  options: ['charmed', 'prone'],
  label: 'Condition Choice: Charmed or Prone',
  note: 'Prone requires Large or smaller',
  attackName: 'Psychic Warp',
};

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 26, rolls: [7, 7, 6, 6], modifier: 4, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 48, rolls: [7, 7, 6, 6, 7, 7, 6, 6], modifier: 4, formula })),
  rollD20: vi.fn(() => 17),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue() }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn().mockResolvedValue();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
  const _options = [];
  const mockHook = vi.fn((name, campaign, options) => {
    _options.push(options);
    return {
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: _rollAttack,
      rollDamage: _rollDamage,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    };
  });
  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _setPopupHtml,
    __getPopupHtml: () => _popupHtml,
    __getOptions: () => _options[_options.length - 1],
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ attackAdvantageCount: 0, attackDisadvantageCount: 0 })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;
  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn(() => _findCreatureReturn),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => (typeof range === 'number' ? range : 5)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(),
  setRuntimeObject: vi.fn(),
}));

// Stub the popup chain: real chooser gating is covered in
// DiceRollResult.hit-choice.test.jsx; here the buttons drive the resolve.
vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: (props) => {
    const offer = props.popupHtml?.hitChoiceOffer;
    return (
      <div data-testid="popup-stub">
        {offer && <span>{offer.label}</span>}
        <button onClick={() => props.onHitChoice?.('charmed')}>charmed</button>
        <button onClick={() => props.onHitChoice?.('prone')}>prone</button>
      </div>
    );
  },
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { addEntry } from '../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const WARP_ACTION = monstersJson.find((m) => m.index === 'githzerai-psion').actions[1];

const CREATURES = [
  { name: 'Githzerai Psion 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', size: 'Medium' },
];

function hitPopupHtml(overrides = {}) {
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Psychic Warp',
    rolls: [17],
    bonus: 8,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: {
      name: 'Psychic Warp',
      formula: '4d10 + 4',
      damageType: 'Psychic',
      targetName: 'Bandit 1',
      hitClause: null,
      hitChoiceOffer: VIAC_OFFER,
      hitChoice: 'undecided-default',
      source: 'Githzerai Psion 1',
    },
    hitChoiceOffer: VIAC_OFFER,
    ...overrides,
  };
}

function renderPsion(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Githzerai Psion', actions: [WARP_ACTION] });
  damageUtils.__setFindCreatureReturn({ name: 'Githzerai Psion 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Githzerai Psion 1' })} />);
}

function clickChipLink(text = '+8') {
  const link = Array.from(document.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === text);
  expect(link, `Expected ${text} dice link`).toBeTruthy();
  fireEvent.click(link);
}

function clickButton(label) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === label);
  expect(btn, `Expected "${label}" button`).toBeTruthy();
  fireEvent.click(btn);
}

function findLogs(automationType) {
  return addEntry.mock.calls.map((c) => c[1]).filter((e) => e && e.automationType === automationType);
}

function findConditionLog(condition) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.type === 'condition' && e.action === 'applied' && e.condition === condition);
}

function runtimeWrites() {
  return setRuntimeObject.mock.calls.map((c) => ({ name: c[0], payload: c[1], campaign: c[2] }));
}

async function doneWith(autoDamage) {
  const options = useLoggedDiceRoll.__getOptions();
  await options.autoDamageRoll(autoDamage, false);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
  getRuntimeValue.mockReturnValue(null);
});

describe('MA-0855 offer forwarding', () => {
  it('forwards hitChoiceOffer to the attack roll context and SUPPRESSES the array hit-clause', () => {
    renderPsion();
    clickChipLink('+8');
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.hitChoiceOffer).toMatchObject({ options: ['charmed', 'prone'], attackName: 'Psychic Warp' });
    // suppression: the Charmed+Prone array auto-grant collapses to null
    expect(ctx.hitClause).toBeNull();
  });

  it('stays byte-inert (no offer) for hit_conditions rows WITHOUT hit_choice (MA-0841)', () => {
    const strike = monstersJson.find((m) => m.index === 'githyanki-dracomancer').actions[1];
    const m = makeMonster({ name: 'Githyanki Dracomancer', actions: [strike] });
    damageUtils.__setFindCreatureReturn({ name: 'Githyanki Dracomancer 1', targetName: 'Bandit 1', conditions: [] });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Githyanki Dracomancer 1', targetName: 'Bandit 1' }, { name: 'Bandit 1' }], creatureName: 'Githyanki Dracomancer 1' })} />);
    clickChipLink('+10');
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.hitChoiceOffer).toBeNull();
    expect(ctx.hitClause).toEqual({ conditions: ['frightened'], escapeDc: null, attackName: 'Draconic Strike', targetEffect: null });
  });
});

describe('MA-0855 chooser resolution on HIT popup', () => {
  it('pick Charmed: grants Charmed ONLY via merged runtime write + logs; Prone never granted', async () => {
    renderPsion(hitPopupHtml());
    clickButton('charmed');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().hitChoiceResolved).toBe('charmed');
    });
    const writes = runtimeWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].name).toBe('Bandit 1');
    expect(writes[0].payload).toEqual({
      activeConditions: ['charmed'],
      activeConditionMeta: { charmed: { source: 'Githzerai Psion 1', dc: null } },
    });
    expect(findConditionLog('Charmed')).toBeTruthy();
    expect(findConditionLog('Prone')).toBeFalsy();
    const selected = findLogs('hit_choice_selected');
    expect(selected).toHaveLength(1);
    expect(selected[0].description).toContain('Charmed');
    expect(selected[0].description).toContain('Prone');
    expect(selected[0].description).toContain('only Charmed applied');
    expect(useLoggedDiceRoll.__getPopupHtml().autoDamage.hitChoice).toBe('selected');
  });

  it('pick Prone: grants Prone ONLY; Charmed never granted', async () => {
    renderPsion(hitPopupHtml());
    clickButton('prone');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().hitChoiceResolved).toBe('prone');
    });
    expect(setRuntimeObject).toHaveBeenCalledTimes(1);
    expect(setRuntimeObject.mock.calls[0][1]).toEqual({
      activeConditions: ['prone'],
      activeConditionMeta: { prone: { source: 'Githzerai Psion 1', dc: null } },
    });
    expect(findConditionLog('Prone')).toBeTruthy();
    expect(findConditionLog('Charmed')).toBeFalsy();
    expect(findLogs('hit_choice_selected')).toHaveLength(1);
  });

  it('a resolved decision cannot re-fire the chooser (no second grant/log)', async () => {
    renderPsion(hitPopupHtml({ hitChoiceResolved: 'charmed' }));
    clickButton('charmed');
    await new Promise((r) => setTimeout(r, 0));
    expect(setRuntimeObject).not.toHaveBeenCalled();
    expect(findLogs('hit_choice_selected')).toHaveLength(0);
  });
});

describe('MA-0855 Done auto-damage resolution', () => {
  it('unpicked Done grants NOTHING extra and logs the honest undecided advisory', async () => {
    renderPsion(hitPopupHtml());
    await doneWith({ ...hitPopupHtml().autoDamage });
    expect(rollDamage).toHaveBeenCalled();
    expect(rollDamage.mock.calls[0][0].formula).toBe('4d10 + 4');
    expect(setRuntimeObject).not.toHaveBeenCalled();
    expect(findConditionLog('Charmed')).toBeFalsy();
    expect(findConditionLog('Prone')).toBeFalsy();
    const advisory = findLogs('hit_choice_undecided');
    expect(advisory).toHaveLength(1);
    expect(advisory[0].description).toContain('no condition granted');
  });

  it('pick then Done: condition granted once at pick, no undecided advisory', async () => {
    renderPsion(hitPopupHtml());
    clickButton('charmed');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().hitChoiceResolved).toBe('charmed');
    });
    await doneWith({ ...useLoggedDiceRoll.__getPopupHtml().autoDamage });
    expect(rollDamage).toHaveBeenCalled();
    expect(setRuntimeObject).toHaveBeenCalledTimes(1);
    expect(findLogs('hit_choice_selected')).toHaveLength(1);
    expect(findLogs('hit_choice_undecided')).toHaveLength(0);
  });
});
