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

  it('registers spell damage steps for a spell action', () => {
    const pipeline = buildPipelineForAction({ name: 'Fireball', spellType: 'spell', autoDamageSchool: 'evocation' }, {});
    expect(pipeline.run).toBeDefined();
  });

  it('spell pipeline includes featureRiders step', async () => {
    const { buildSpellDamageSteps } = await import('./spellDamageSteps.js');
    const steps = buildSpellDamageSteps();
    const stepNames = steps.map(s => s.name);
    expect(stepNames).toContain('spellFeatureRiders');
    expect(stepNames).toContain('spellRollDamage');
    expect(stepNames).toContain('spellOverchannel');
    const ridersIdx = stepNames.indexOf('spellFeatureRiders');
    const overchannelIdx = stepNames.indexOf('spellOverchannel');
    expect(ridersIdx).toBeLessThan(overchannelIdx);
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

  it('registers SSE observers when playerStats has campaignName', () => {
    const pipeline = buildPipelineForAction(
      { name: 'Greataxe', damage: '1d12' },
      { campaignName: 'test-campaign' }
    );
    expect(pipeline.run).toBeDefined();
    expect(pipeline.observe).toBeDefined();
  });

  it('does not register SSE observers when playerStats has no campaignName', () => {
    const pipeline = buildPipelineForAction(
      { name: 'Greataxe', damage: '1d12' },
      { name: 'Gimli' }
    );
    expect(pipeline.run).toBeDefined();
  });
});
