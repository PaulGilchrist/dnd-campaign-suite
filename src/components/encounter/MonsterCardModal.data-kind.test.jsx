// @maintained-by-ai
// EO 2026-11-08 backlog: every dice-link chip on a monster card carries a
// `data-kind` attribute accurate to its row type (save / skill / attack /
// spell / legendary / lair / ability / initiative / damage / reaction / aura /
// summon / selfbuff / grantreaction / shapeshift / zone / advisory) so
// automation and keyboard users anchor by kind instead of by `.mc-dice-link`
// INDEX (on the Goblin card indices 0–5 are the six ability cells, 6 is
// Stealth, 7+ are the attacks — a wrong-index press opened an unrelated
// popup). Purely additive: classes, click routing and text are byte-pinned
// alongside the stamp so a regression that drops or mis-stamps a kind — or a
// "cleanup" that renames a class — fails here.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: () => <div className="sp-overlay sphere-picker-stub" />,
}));
vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollAttack: null, rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const rollAttack = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack, rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })) };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Thug 1', creatures: [] })),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 30),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));
const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

const CREATURES = [
  { name: 'Kind Keeper 1', type: 'npc', monsterType: 'aberration', targetName: 'TestPC', currentHp: 90, maxHp: 90, ac: 15, conditions: [] },
  { name: 'Goblin 1', type: 'npc', monsterType: 'humanoid', targetName: 'TestPC', currentHp: 7, maxHp: 7, ac: 15, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} },
];

// One row per chip family — every kind the card can arm renders here.
const keeper = () => makeMonster({
  name: 'Kind Keeper',
  initiative_details: '+2',
  saving_throws: {
    str: { modifier: 5 }, dex: { modifier: 7 }, con: { modifier: 5 },
    int: { modifier: 2 }, wis: { modifier: 3 }, cha: { modifier: 2 },
  },
  skills: { Stealth: { modifier: 6 }, Arcana: { modifier: 2 } },
  actions: [
    { name: 'Scimitar', attack_bonus: 4, damage_dice_primary: '1d6+2', damage_type_primary: 'Slashing', description: 'Melee Weapon Attack: +4 to hit.' },
    { name: 'Fire Breath', save_dc: 15, save_type: 'Dexterity', damage_dice_primary: '7d6', damage_type_primary: 'Fire', description: 'Each creature makes a Dexterity saving throw.' },
    { name: 'Spellcasting', save_dc: 13, save_type: 'Wisdom', description: 'The keeper casts one of the following spells (spell save DC 13):<br><strong>At Will:</strong> <em>Mage Hand</em>, <em>Light</em>' },
  ],
  legendary_actions: [
    { name: 'Legendary Actions', uses: 3, description: 'The keeper takes 3 legendary actions.' },
    { name: 'Flicker', description: 'The keeper teleports 10 feet.' },
  ],
  lair_actions: [
    { name: 'Sand Cloud', save_dc: 15, save_type: 'Constitution', description: 'Blinding sand billows out; CON save or blinded.' },
  ],
});

function renderKeeper() {
  return render(<MonsterCardModal {...makeProps(keeper(), { creatureName: 'Kind Keeper 1', creatures: CREATURES })} />);
}

function chips(kind) {
  return Array.from(document.querySelectorAll(`[data-kind="${kind}"]`));
}

function allDiceLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link'));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MonsterCardModal - data-kind stamps on every dice-link chip', () => {
  it('every .mc-dice-link chip carries a non-empty data-kind (no ambiguous chip)', () => {
    renderKeeper();
    const chips = allDiceLinks();
    expect(chips.length).toBeGreaterThanOrEqual(20);
    for (const chip of chips) {
      expect(chip.dataset.kind, chip.textContent.trim()).toBeTruthy();
    }
  });

  it('kind queries return exactly the expected chip sets per row type', () => {
    renderKeeper();
    // Six Saving Throws defense-row chips + Fire Breath dice+DC pair = 8.
    const saveTexts = chips('save').map(el => el.textContent.trim());
    expect(saveTexts).toHaveLength(8);
    expect(saveTexts.sort()).toEqual(['STR +5', 'DEX +7', 'CON +5', 'INT +2', 'WIS +3', 'CHA +2', '7d6', 'DC 15 Dexterity'].sort());
    expect(chips('skill')).toHaveLength(2);
    expect(chips('skill').map(el => el.textContent.trim())).toEqual([
      expect.stringContaining('Stealth +6'),
      expect.stringContaining('Arcana +2'),
    ]);
    expect(chips('attack')).toHaveLength(1);
    expect(chips('attack')[0].textContent).toContain('+4');
    expect(chips('spell').map(el => el.textContent.trim())).toEqual([
      expect.stringContaining('Mage Hand'),
      expect.stringContaining('Light'),
    ]);
    expect(chips('legendary')).toHaveLength(1);
    expect(chips('legendary')[0].textContent).toContain('Expend Legendary');
    expect(chips('lair')).toHaveLength(1);
    expect(chips('lair')[0].textContent).toContain('DC 15 Constitution');
    expect(chips('initiative')).toHaveLength(1);
    expect(chips('ability')).toHaveLength(6);
  });

  it('data-kind set equals the class-suffix set for spell/legendary/lair variants', () => {
    renderKeeper();
    for (const kind of ['spell', 'legendary', 'lair']) {
      const byKind = chips(kind).map(el => el.textContent.trim()).sort();
      const byClass = Array.from(document.querySelectorAll(`.mc-dice-link-${kind}`)).map(el => el.textContent.trim()).sort();
      expect(byKind).toEqual(byClass);
    }
    // .mc-dice-link-save-clickable chips are a subset of the save-kind set.
    for (const chip of document.querySelectorAll('.mc-dice-link-save-clickable')) {
      expect(chip.dataset.kind).toBe('save');
    }
  });

  it('stamp is additive: existing classes and click routing are unchanged', () => {
    renderKeeper();
    const attack = chips('attack')[0];
    expect(attack.className).toBe('mc-dice-link');
    expect(attack.getAttribute('role')).toBe('button');
    fireEvent.click(attack);
    expect(ROLLERS.rollAttack).toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();

    const dc = chips('save').find(el => el.textContent.includes('DC 15 Dexterity'));
    expect(dc.className).toContain('mc-dice-link-save-clickable');
    fireEvent.click(dc);
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalled();
  });

  it('specialist chips stamp their own kind (aura row)', () => {
    const m = makeMonster({
      name: 'Kind Keeper',
      actions: [{
        name: 'Darkness Aura',
        description: 'Magical darkness spreads from the keeper.',
        zone: { radius_ft: 15, self: true, no_save: true, effect_key: 'lair_darkness' },
      }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Kind Keeper 1', creatures: CREATURES })} />);
    const aura = chips('aura');
    expect(aura).toHaveLength(1);
    expect(aura[0].className).toContain('mc-dice-link-aura');
    expect(allDiceLinks()).toHaveLength(6 + 1); // ability cells + the aura chip only
  });
});

describe('Goblin card census - data-kind replaces the .mc-dice-link index law', () => {
  // EO 2026-11-08 census (app-exploration §"Live monster-card rig"): on the
  // live Goblin card, plain `.mc-dice-link` indices 0–5 are the six ability
  // cells (they open ability-check popups), 6 is Stealth and 7+ are attacks.
  // Locks that shape so kind-queries provably make index-churn moot.
  function renderGoblin() {
    const goblin = monstersData.find(m => m.index === 'goblin');
    const m = makeMonster({ name: 'Goblin', saving_throws: goblin.saving_throws, skills: goblin.skills, actions: goblin.actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Goblin 1', creatures: CREATURES })} />);
  }

  it('every chip carries a kind; ability cells are "ability" (NOT saves), Stealth is the one skill, Scimitar+Shortbow are the attacks', () => {
    renderGoblin();
    const diceLinks = allDiceLinks();
    for (const chip of diceLinks) expect(chip.dataset.kind, chip.textContent.trim()).toBeTruthy();
    expect(chips('ability')).toHaveLength(6);
    expect(chips('skill')).toHaveLength(1);
    expect(chips('skill')[0].textContent).toContain('Stealth');
    expect(chips('attack').map(el => el.textContent.trim())).toEqual(['+4', '+4']);
    expect(chips('save')).toHaveLength(0); // disk goblin authors no saving_throws
    // The EO index law itself: indices 0–5 abilities, 6 skill, 7+ attacks.
    expect(diceLinks.slice(0, 6).map(el => el.dataset.kind)).toEqual(['ability', 'ability', 'ability', 'ability', 'ability', 'ability']);
    expect(diceLinks[6].dataset.kind).toBe('skill');
    expect(diceLinks.slice(7).map(el => el.dataset.kind)).toEqual(['attack', 'attack']);
  });
});
