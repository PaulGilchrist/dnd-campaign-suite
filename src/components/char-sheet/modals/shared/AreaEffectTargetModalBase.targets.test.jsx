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

const baseCombatSummary = {
  creatures: [
    { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { cha: 2 } },
    { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
  ],
};

const baseProps = {
  combatSummary: baseCombatSummary,
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AreaEffectTargetModalBase - Eligible Targets', () => {
  describe('initial filtering', () => {
    it('includes or excludes the caster based on includeCaster flag', () => {
      getRuntimeValue.mockReturnValue([]);
      const wizardCreature = { name: 'Wizard1', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { int: 4 } };
      const combatSummary = { creatures: [...baseCombatSummary.creatures, wizardCreature] };
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} combatSummary={combatSummary} includeCaster={true} renderBody={renderBody} />);
      const targetNames = capturedCtx.eligibleTargets.map(t => t.name);
      expect(targetNames).toContain('Wizard1');
      expect(targetNames).toContain('Goblin');

      vi.resetAllMocks();
      getRuntimeValue.mockReturnValue([]);
      capturedCtx = null;
      renderBody.mockClear();
      render(<AreaEffectTargetModalBase {...baseProps} combatSummary={combatSummary} includeCaster={false} renderBody={renderBody} />);
      const targetNames2 = capturedCtx.eligibleTargets.map(t => t.name);
      expect(targetNames2).not.toContain('Wizard1');
      expect(targetNames2).toContain('Goblin');
    });

    it('filters to undead only when turnUndead is true, otherwise returns all non-caster targets', () => {
      getRuntimeValue.mockReturnValue([]);
      const monsters = [
        { name: 'Goblin', type: 'Undead' },
        { name: 'Orc', type: 'npc' },
        { name: 'PlayerAlly', type: 'Undead' },
      ];
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'Undead', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
          { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { cha: 2 } },
          { name: 'PlayerAlly', type: 'Undead', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
        ],
      };
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} combatSummary={combatSummary} turnUndead={true} monsters={monsters} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toEqual(['Goblin', 'PlayerAlly']);

      vi.resetAllMocks();
      getRuntimeValue.mockReturnValue([]);
      capturedCtx = null;
      renderBody.mockClear();
      render(<AreaEffectTargetModalBase {...baseProps} combatSummary={combatSummary} turnUndead={false} monsters={monsters} renderBody={renderBody} />);
      const targetNames2 = capturedCtx.eligibleTargets.map(t => t.name);
      expect(targetNames2).not.toContain('Wizard1');
      expect(targetNames2).toContain('Goblin');
    });

    describe('CLA-303: EB suffixed names + monsterType-at-join + dead exclusion', () => {
      function capture(turnUndeadProps) {
        getRuntimeValue.mockReturnValue([]);
        let capturedCtx = null;
        const renderBody = vi.fn(() => {
          capturedCtx = renderBody.mock.calls.at(-1)[0];
          return <div>Captured</div>;
        });
        render(<AreaEffectTargetModalBase {...baseProps} turnUndead={true} renderBody={renderBody} {...turnUndeadProps} />);
        return capturedCtx.eligibleTargets.map(t => t.name);
      }

      it('makes EB suffixed creatures eligible via monsterType carried at join time', () => {
        const combatSummary = {
          creatures: [
            { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid', currentHp: 15, maxHp: 15 },
            { name: 'Skeleton 1', type: 'npc', monsterType: 'Undead', currentHp: 13, maxHp: 13 },
            { name: 'Zombie 1', type: 'npc', monsterType: 'Undead', currentHp: 15, maxHp: 15 },
          ],
        };
        const names = capture({ combatSummary, monsters: [] });
        expect(names).toEqual(['Skeleton 1', 'Zombie 1']);
      });

      it('falls back to suffix-strip monsters.json lookup when monsterType is absent', () => {
        const combatSummary = {
          creatures: [
            { name: 'Skeleton 1', type: 'npc', currentHp: 13, maxHp: 13 },
            { name: 'Thug 1', type: 'npc', currentHp: 15, maxHp: 15 },
          ],
        };
        const monsters = [
          { name: 'Skeleton', type: 'Undead' },
          { name: 'Thug', type: 'Humanoid' },
        ];
        const names = capture({ combatSummary, monsters });
        expect(names).toEqual(['Skeleton 1']);
      });

      it('excludes undead creatures at 0 hit points', () => {
        const combatSummary = {
          creatures: [
            { name: 'Skeleton 1', type: 'npc', monsterType: 'Undead', currentHp: 13, maxHp: 13 },
            { name: 'Zombie 1', type: 'npc', monsterType: 'Undead', currentHp: 0, maxHp: 15 },
          ],
        };
        const names = capture({ combatSummary, monsters: [] });
        expect(names).toEqual(['Skeleton 1']);
      });

      it('keeps undead eligible when currentHp is undefined (players/minimal creatures)', () => {
        const combatSummary = {
          creatures: [
            { name: 'Skeleton', type: 'npc' },
          ],
        };
        const names = capture({ combatSummary, monsters: [{ name: 'Skeleton', type: 'Undead' }] });
        expect(names).toEqual(['Skeleton']);
      });

      it('matches monsterType case-insensitively', () => {
        const combatSummary = {
          creatures: [
            { name: 'Zombie 1', type: 'npc', monsterType: 'undead', currentHp: 15, maxHp: 15 },
          ],
        };
        const names = capture({ combatSummary, monsters: [] });
        expect(names).toEqual(['Zombie 1']);
      });
    });

    it.each([
      { label: 'no creatures property', combatSummary: {} },
      { label: 'null combatSummary', combatSummary: null },
      { label: 'empty creatures array', combatSummary: { creatures: [] } },
    ])('returns empty array when combatSummary is $label', ({ combatSummary }) => {
      getRuntimeValue.mockReturnValue([]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} combatSummary={combatSummary} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets).toEqual([]);
    });
  });

  describe('forcecage blocking', () => {
    it('excludes target when both attacker and target are forcecaged with different sources', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'forcecage', target: 'Wizard1', source: 'CageA' },
        { effect: 'forcecage', target: 'Goblin', source: 'CageB' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).not.toContain('Goblin');
    });

    it('includes target when both attacker and target are forcecaged with same source', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'forcecage', target: 'Wizard1', source: 'CageA' },
        { effect: 'forcecage', target: 'Goblin', source: 'CageA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('excludes all targets when only the attacker is forcecaged', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'forcecage', target: 'Wizard1', source: 'CageA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets).toEqual([]);
    });

    it('excludes target when only the target is forcecaged', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'forcecage', target: 'Goblin', source: 'CageA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).not.toContain('Goblin');
    });
  });

  describe('maze blocking', () => {
    it('excludes target when both attacker and target are maze blocked with different sources', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'maze', target: 'Wizard1', source: 'MazeA' },
        { effect: 'maze', target: 'Goblin', source: 'MazeB' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).not.toContain('Goblin');
    });

    it('includes target when both attacker and target are maze blocked with same source', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'maze', target: 'Wizard1', source: 'MazeA' },
        { effect: 'maze', target: 'Goblin', source: 'MazeA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('excludes all targets when only the attacker is maze blocked', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'maze', target: 'Wizard1', source: 'MazeA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets).toEqual([]);
    });

    it('excludes target when only the target is maze blocked', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'maze', target: 'Goblin', source: 'MazeA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).not.toContain('Goblin');
    });
  });

  describe('banishment blocking', () => {
    it('excludes target when both attacker and target are banished with different sources', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'banishment', target: 'Wizard1', source: 'BanishA' },
        { effect: 'banishment', target: 'Goblin', source: 'BanishB' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).not.toContain('Goblin');
    });

    it('includes target when both attacker and target are banished with same source', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'banishment', target: 'Wizard1', source: 'BanishA' },
        { effect: 'banishment', target: 'Goblin', source: 'BanishA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('excludes all targets when only the attacker is banished', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'banishment', target: 'Wizard1', source: 'BanishA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets).toEqual([]);
    });

    it('excludes target when only the target is banished', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'banishment', target: 'Goblin', source: 'BanishA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).not.toContain('Goblin');
    });
  });

  describe('imprisonment blocking', () => {
    it('excludes target when both attacker and target are imprisoned with different sources', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard1', source: 'ImpA' },
        { effect: 'imprisonment', target: 'Goblin', source: 'ImpB' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).not.toContain('Goblin');
    });

    it('includes target when both attacker and target are imprisoned with same source', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard1', source: 'ImpA' },
        { effect: 'imprisonment', target: 'Goblin', source: 'ImpA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('excludes all targets when only the attacker is imprisoned', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard1', source: 'ImpA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets).toEqual([]);
    });

    it('excludes target when only the target is imprisoned', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Goblin', source: 'ImpA' },
      ]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).not.toContain('Goblin');
    });
  });

  describe('overlay-based targeting', () => {
    it('uses shape-based overlay hit test when shape is provided', () => {
      getRuntimeValue.mockReturnValue([]);
      const mapData = {
        players: [
          { name: 'Goblin', gridX: 10, gridY: 10 },
        ],
      };
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(
        <AreaEffectTargetModalBase
          {...baseProps}
          mapData={mapData}
          shape="sphere"
          attackerGridX={10}
          attackerGridY={10}
          rangeFeet={30}
          renderBody={renderBody}
        />
      );
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('uses distance-based check when shape is not provided', () => {
      getRuntimeValue.mockReturnValue([]);
      const mapData = {
        players: [
          { name: 'Goblin', gridX: 10, gridY: 10 },
        ],
      };
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(
        <AreaEffectTargetModalBase
          {...baseProps}
          mapData={mapData}
          attackerPos={{ gridX: 10, gridY: 10 }}
          rangeFeet={30}
          renderBody={renderBody}
        />
      );
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('includes target when target has no position on map', () => {
      getRuntimeValue.mockReturnValue([]);
      const mapData = {
        players: [],
      };
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} mapData={mapData} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('includes target when mapData is null', () => {
      getRuntimeValue.mockReturnValue([]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} mapData={null} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('includes target when attackerPos is null', () => {
      getRuntimeValue.mockReturnValue([]);
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} attackerPos={null} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('looks up target position from placedItems', () => {
      getRuntimeValue.mockReturnValue([]);
      const mapData = {
        players: [],
        placedItems: [
          { name: 'Goblin', gridX: 12, gridY: 12 },
        ],
      };
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(<AreaEffectTargetModalBase {...baseProps} mapData={mapData} renderBody={renderBody} />);
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('prioritizes shape-based overlay when both shape and attackerPos are provided', () => {
      getRuntimeValue.mockReturnValue([]);
      const mapData = {
        players: [
          { name: 'Goblin', gridX: 10, gridY: 10 },
        ],
      };
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(
        <AreaEffectTargetModalBase
          {...baseProps}
          mapData={mapData}
          shape="cone"
          attackerGridX={10}
          attackerGridY={10}
          coneAngle={90}
          rangeFeet={30}
          attackerPos={{ gridX: 10, gridY: 10 }}
          renderBody={renderBody}
        />
      );
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });

    it('uses widthFt parameter with shape-based overlay', () => {
      getRuntimeValue.mockReturnValue([]);
      const mapData = {
        players: [
          { name: 'Goblin', gridX: 10, gridY: 10 },
        ],
      };
      let capturedCtx = null;
      const renderBody = vi.fn(() => {
        capturedCtx = renderBody.mock.calls.at(-1)[0];
        return <div>Captured</div>;
      });
      render(
        <AreaEffectTargetModalBase
          {...baseProps}
          mapData={mapData}
          shape="line"
          attackerGridX={10}
          attackerGridY={10}
          widthFt={10}
          rangeFeet={30}
          renderBody={renderBody}
        />
      );
      expect(capturedCtx.eligibleTargets.map(t => t.name)).toContain('Goblin');
    });
  });
});
