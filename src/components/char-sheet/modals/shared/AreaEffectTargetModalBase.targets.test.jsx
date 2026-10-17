// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./areaEffectModalInstances.js', () => ({
  isApplyBusy: vi.fn(),
  setApplyBusy: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

const campaignName = 'test-campaign';

// Attacker is Wizard1; base roster has no Wizard1 so includeCaster rows add it.
const baseCreatures = [
  { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
  { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { cha: 2 } },
  { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
];

const baseProps = {
  combatSummary: { creatures: baseCreatures },
  attackerName: 'Wizard1',
  attackerPos: { gridX: 10, gridY: 10 },
  saveDc: 14,
  campaignName,
  mapData: null,
  monsters: [],
  featureName: 'Test Effect',
  saveType: 'CHA',
  rangeFeet: 30,
  onClose: vi.fn(),
  characters: [],
  includeCaster: false,
};

// Renders the real base modal and returns the eligible target names its
// renderBody receives — the single observable output of the filtering logic.
function captureTargetNames(props = {}) {
  let capturedCtx = null;
  const renderBody = vi.fn(ctx => {
    capturedCtx = ctx;
    return <div>Captured</div>;
  });
  render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} {...props} />);
  return capturedCtx.eligibleTargets.map(t => t.name);
}

beforeEach(() => {
  vi.resetAllMocks();
  getRuntimeValue.mockReturnValue([]);
});

describe('AreaEffectTargetModalBase - Eligible Targets', () => {
  describe('initial filtering', () => {
    it.each([
      { includeCaster: true, expected: ['Goblin', 'Orc', 'PlayerAlly', 'Wizard1'] },
      { includeCaster: false, expected: ['Goblin', 'Orc', 'PlayerAlly'] },
    ])('includeCaster=$includeCaster $expected', ({ includeCaster, expected }) => {
      const combatSummary = {
        creatures: [
          ...baseCreatures,
          { name: 'Wizard1', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { int: 4 } },
        ],
      };
      expect(captureTargetNames({ combatSummary, includeCaster })).toEqual(expected);
    });

    // CLA-303 turn-undead validity: join-time monsterType (case-insensitive),
    // dead exclusion, suffix-strip monsters.json fallback, unknown creatures.
    it.each([
      {
        scenario: 'turnUndead=false keeps every non-caster target',
        turnUndead: false,
        creatures: [
          { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22 },
          { name: 'Skeleton 1', type: 'npc', monsterType: 'Undead', currentHp: 13, maxHp: 13 },
        ],
        monsters: [],
        expected: ['Orc', 'Skeleton 1'],
      },
      {
        scenario: 'turnUndead=true uses join-time monsterType case-insensitively and drops dead',
        turnUndead: true,
        creatures: [
          { name: 'Skeleton 1', type: 'npc', monsterType: 'undead', currentHp: 13, maxHp: 13 },
          { name: 'Zombie 1', type: 'npc', monsterType: 'Undead', currentHp: 0, maxHp: 15 },
          { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid', currentHp: 15, maxHp: 15 },
        ],
        monsters: [],
        expected: ['Skeleton 1'],
      },
      {
        scenario: 'turnUndead=true falls back to suffix-strip lookup; keeps undefined-HP undead, drops Humanoid matches and unknowns',
        turnUndead: true,
        creatures: [
          { name: 'Skeleton 1', type: 'npc', currentHp: 13, maxHp: 13 },
          { name: 'Thug 1', type: 'npc', currentHp: 15, maxHp: 15 },
          { name: 'Ghoul', type: 'npc' },
          { name: 'Ghost 2', type: 'npc', currentHp: 9, maxHp: 9 },
        ],
        monsters: [
          { name: 'Skeleton', type: 'Undead' },
          { name: 'Thug', type: 'Humanoid' },
          { name: 'Ghoul', type: 'Undead' },
        ],
        expected: ['Skeleton 1', 'Ghoul'],
      },
    ])('$scenario', ({ turnUndead, creatures, monsters, expected }) => {
      expect(captureTargetNames({ combatSummary: { creatures }, turnUndead, monsters })).toEqual(expected);
    });

    it.each([
      { label: 'null', combatSummary: null },
      { label: 'empty creatures array', combatSummary: { creatures: [] } },
    ])('returns empty targets when combatSummary is $label', ({ combatSummary }) => {
      expect(captureTargetNames({ combatSummary })).toEqual([]);
    });
  });

  // Four near-identical trapped-effects filters in the source (forcecage, maze,
  // banishment, imprisonment) differ only by effect key — cover each key's four branches.
  describe.each(['forcecage', 'maze', 'banishment', 'imprisonment'])('%s blocking', (effect) => {
    const te = (target, source) => ({ effect, target, source });
    it.each([
      {
        // A trapped attacker blocks every target except ones sharing its source.
        scenario: 'attacker and target share the same source — target stays eligible',
        effects: [te('Wizard1', 'SrcA'), te('Goblin', 'SrcA')],
        expected: ['Goblin'],
      },
      {
        scenario: 'attacker and target have different sources — target is blocked',
        effects: [te('Wizard1', 'SrcA'), te('Goblin', 'SrcB')],
        expected: [],
      },
      {
        scenario: 'only the attacker is trapped — every target is blocked',
        effects: [te('Wizard1', 'SrcA')],
        expected: [],
      },
      {
        scenario: 'only the target is trapped — that target is blocked',
        effects: [te('Goblin', 'SrcA')],
        expected: ['Orc', 'PlayerAlly'],
      },
    ])('$scenario', ({ effects, expected }) => {
      getRuntimeValue.mockReturnValue(effects);
      expect(captureTargetNames()).toEqual(expected);
    });
  });

  describe('position-based targeting', () => {
    // Grid: 1 cell = 5ft. Origin cell is (10,10) for all shapes (angle 0 = +x).
    // Shape-over-distance priority is pinned by cells that ARE within the 30ft
    // distance yet shape-excluded: cone target behind (8,10), line target (12,12).
    it.each([
      {
        shape: 'sphere',
        rangeFeet: 30,
        players: { Goblin: [12, 10], PlayerAlly: [13, 13], Orc: [17, 10] }, // 10ft, ~14ft, 35ft
        expected: ['Goblin', 'PlayerAlly'],
      },
      {
        shape: 'cone',
        coneAngle: 90,
        rangeFeet: 30,
        players: { Goblin: [12, 10], Orc: [17, 10], PlayerAlly: [8, 10] }, // in front, beyond range, behind
        expected: ['Goblin'],
      },
      {
        shape: 'line',
        widthFt: 15,
        rangeFeet: 30,
        players: { Goblin: [12, 11], Orc: [12, 12], PlayerAlly: [8, 10] }, // inside width, outside width, behind
        expected: ['Goblin'],
      },
    ])('$shape overlay includes covered cells and excludes uncovered ones', ({ shape, coneAngle, widthFt, rangeFeet, players, expected }) => {
      const mapData = {
        players: Object.entries(players).map(([name, [gridX, gridY]]) => ({ name, gridX, gridY })),
      };
      expect(captureTargetNames({
        mapData,
        shape,
        coneAngle,
        widthFt,
        rangeFeet,
        attackerGridX: 10,
        attackerGridY: 10,
      })).toEqual(expected);
    });

    it('distance-based check filters by range and finds positions in placedItems too', () => {
      const mapData = {
        players: [
          { name: 'Goblin', gridX: 12, gridY: 10 }, // 10ft — in
          { name: 'Orc', gridX: 17, gridY: 10 }, // 35ft — out
          { name: 'PlayerAlly', gridX: 16, gridY: 10 }, // exactly 30ft — in (boundary)
        ],
        placedItems: [
          { name: 'Kobold', gridX: 14, gridY: 10 }, // 20ft via placedItems — in
        ],
      };
      const combatSummary = {
        creatures: [
          ...baseCreatures,
          { name: 'Kobold', type: 'npc', currentHp: 6, maxHp: 6 },
        ],
      };
      expect(captureTargetNames({ combatSummary, mapData, rangeFeet: 30 })).toEqual(['Goblin', 'PlayerAlly', 'Kobold']);
    });

    it.each([
      { label: 'mapData is null', props: { mapData: null } },
      { label: 'attackerPos is null', props: { attackerPos: null, mapData: { players: [{ name: 'Goblin', gridX: 99, gridY: 99 }] } } },
      { label: 'the target has no position on the map', props: { mapData: { players: [] } } },
    ])('includes all targets when position cannot be checked: $label', ({ props }) => {
      expect(captureTargetNames(props)).toEqual(['Goblin', 'Orc', 'PlayerAlly']);
    });
  });
});
