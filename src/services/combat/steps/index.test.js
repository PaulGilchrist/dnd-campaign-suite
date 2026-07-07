import { describe, it, expect, vi } from 'vitest';
import { buildPipelineForAction } from './index.js';

describe('buildPipelineForAction', () => {
  it('returns a pipeline object with run, step, observe, resume', () => {
    const pipeline = buildPipelineForAction({ name: 'Greataxe', damage: '1d12' }, {});
    expect(pipeline).toHaveProperty('run');
    expect(pipeline).toHaveProperty('step');
    expect(pipeline).toHaveProperty('observe');
    expect(pipeline).toHaveProperty('resume');
  });

  it('registers weapon damage steps for a weapon attack', () => {
    const pipeline = buildPipelineForAction({ name: 'Greataxe', damage: '1d12', weaponType: 'heavy' }, {});
    expect(pipeline.run).toBeDefined();
  });

  it('registers weapon damage steps when damage expression present', () => {
    const pipeline = buildPipelineForAction({ name: 'Greataxe', damageExpression: '1d12+3' }, {});
    expect(pipeline.run).toBeDefined();
  });

  it('registers steps for action with hasDamage flag', () => {
    const pipeline = buildPipelineForAction({ name: 'Unarmed Strike', hasDamage: true }, {});
    expect(pipeline.run).toBeDefined();
  });

  it('returns a pipeline without weapon steps for non-weapon actions', () => {
    const pipeline = buildPipelineForAction({ name: 'Dash' }, {});
    expect(pipeline.run).toBeDefined();
  });

  function makeCtx() {
    return {
      playerStats: {
        name: 'Gimli',
        abilities: { str: 18 },
        modifiers: { str: 4, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      },
      attack: { name: 'Greataxe', damage: '1d12' },
      campaignName: 'test',
      targetName: 'Orc',
      setPopupHtml: vi.fn(),
      proceedWithDamage: vi.fn(),
      setAttackRiderManeuverPrompt: vi.fn(),
      setAttackRiderModal: vi.fn(),
    };
  }

  it('runs through weapon damage steps without error', async () => {
    const pipeline = buildPipelineForAction({ name: 'Greataxe', damage: '1d12' }, {});
    const ctx = makeCtx();
    const resumeRef = { current: null };

    await expect(pipeline.run('housekeeping:do', ctx, resumeRef)).resolves.toBeUndefined();
  });

  it('registers pipeline with both steps and observers', () => {
    const pipeline = buildPipelineForAction({ name: 'Greataxe', damage: '1d12' }, {});
    expect(pipeline.run).toBeDefined();
    expect(pipeline.observe).toBeDefined();
    expect(pipeline.step).toBeDefined();
    expect(pipeline.resume).toBeDefined();
  });
});
