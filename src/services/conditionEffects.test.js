import { describe, it, expect } from 'vitest'
import {
  computeConditionEffects,
  getNetAttackMode,
  combineAttackModes,
  CONDITIONS_THAT_CANNOT_ACT,
  CONDITIONS_THAT_SPEED_ZERO,
  hasSaveAdvantage,
} from './conditionEffects.js'

describe('computeConditionEffects', () => {
  it('returns empty effects for no conditions', () => {
    const result = computeConditionEffects([])
    expect(result.attackAdvantageCount).toBe(0)
    expect(result.attackDisadvantageCount).toBe(0)
    expect(result.abilityCheckDisadvantage).toBe(false)
    expect(result.autoFailSaves).toEqual([])
    expect(result.saveDisadvantage).toEqual([])
    expect(result.cannotAct).toBe(false)
    expect(result.speedZero).toBe(false)
    expect(result.concentrationBroken).toBe(false)
    expect(result.targetAdvantageCount).toBe(0)
    expect(result.targetDisadvantageCount).toBe(0)
    expect(result.autoCritWithin5ft).toBe(false)
    expect(result.resistantToAll).toBe(false)
    expect(result.poisonImmune).toBe(false)
  })

  it('handles blinded condition', () => {
    const result = computeConditionEffects(['blinded'])
    expect(result.attackDisadvantageCount).toBe(1)
    expect(result.targetAdvantageCount).toBe(1)
  })

  it('handles frightened condition', () => {
    const result = computeConditionEffects(['frightened'])
    expect(result.attackDisadvantageCount).toBe(1)
    expect(result.abilityCheckDisadvantage).toBe(true)
  })

  it('handles grappled condition', () => {
    const result = computeConditionEffects(['grappled'])
    expect(result.speedZero).toBe(true)
    expect(result.attackDisadvantageCount).toBe(1)
  })

  it('handles incapacitated condition', () => {
    const result = computeConditionEffects(['incapacitated'])
    expect(result.cannotAct).toBe(true)
    expect(result.concentrationBroken).toBe(true)
  })

  it('handles invisible condition', () => {
    const result = computeConditionEffects(['invisible'])
    expect(result.attackAdvantageCount).toBe(1)
    expect(result.targetDisadvantageCount).toBe(1)
  })

  it('handles paralyzed condition', () => {
    const result = computeConditionEffects(['paralyzed'])
    expect(result.cannotAct).toBe(true)
    expect(result.speedZero).toBe(true)
    expect(result.autoFailSaves).toEqual(['str', 'dex'])
    expect(result.targetAdvantageCount).toBe(1)
    expect(result.autoCritWithin5ft).toBe(true)
  })

  it('handles petrified condition', () => {
    const result = computeConditionEffects(['petrified'])
    expect(result.cannotAct).toBe(true)
    expect(result.speedZero).toBe(true)
    expect(result.targetAdvantageCount).toBe(1)
    expect(result.autoFailSaves).toEqual(['str', 'dex'])
    expect(result.resistantToAll).toBe(true)
    expect(result.poisonImmune).toBe(true)
  })

  it('handles poisoned condition', () => {
    const result = computeConditionEffects(['poisoned'])
    expect(result.attackDisadvantageCount).toBe(1)
    expect(result.abilityCheckDisadvantage).toBe(true)
  })

  it('handles prone condition', () => {
    const result = computeConditionEffects(['prone'])
    expect(result.attackDisadvantageCount).toBe(1)
    expect(result.targetAdvantageIfWithin5ft).toBe(true)
    expect(result.targetDisadvantageIfBeyond5ft).toBe(true)
  })

  it('handles restrained condition', () => {
    const result = computeConditionEffects(['restrained'])
    expect(result.speedZero).toBe(true)
    expect(result.attackDisadvantageCount).toBe(1)
    expect(result.targetAdvantageCount).toBe(1)
    expect(result.saveDisadvantage).toEqual(['dex'])
  })

  it('handles stunned condition', () => {
    const result = computeConditionEffects(['stunned'])
    expect(result.cannotAct).toBe(true)
    expect(result.autoFailSaves).toEqual(['str', 'dex'])
    expect(result.targetAdvantageCount).toBe(1)
  })

  it('handles unconscious condition', () => {
    const result = computeConditionEffects(['unconscious'])
    expect(result.cannotAct).toBe(true)
    expect(result.speedZero).toBe(true)
    expect(result.targetAdvantageCount).toBe(1)
    expect(result.autoFailSaves).toEqual(['str', 'dex'])
    expect(result.autoCritWithin5ft).toBe(true)
  })

  it('cancels blinded + invisible (disadvantage + advantage = normal)', () => {
    const result = computeConditionEffects(['blinded', 'invisible'])
    expect(result.attackAdvantageCount).toBe(1)
    expect(result.attackDisadvantageCount).toBe(1)
    expect(result.targetAdvantageCount).toBe(1)
    expect(result.targetDisadvantageCount).toBe(1)
  })

  it('handles multiple conditions stacking disadvantage', () => {
    const result = computeConditionEffects(['blinded', 'poisoned'])
    expect(result.attackDisadvantageCount).toBe(2)
    expect(result.attackAdvantageCount).toBe(0)
  })

  it('handles incapacitated + poisoned (super sets)', () => {
    const result = computeConditionEffects(['incapacitated', 'poisoned'])
    expect(result.cannotAct).toBe(true)
    expect(result.concentrationBroken).toBe(true)
    expect(result.attackDisadvantageCount).toBe(1)
    expect(result.abilityCheckDisadvantage).toBe(true)
  })

  it('ignores unknown conditions', () => {
    const result = computeConditionEffects(['unknown_condition'])
    expect(result.attackAdvantageCount).toBe(0)
    expect(result.attackDisadvantageCount).toBe(0)
  })
})

describe('getNetAttackMode', () => {
  it('returns normal when counts are equal', () => {
    expect(getNetAttackMode(0, 0)).toBe('normal')
    expect(getNetAttackMode(1, 1)).toBe('normal')
    expect(getNetAttackMode(2, 2)).toBe('normal')
  })

  it('returns advantage when adv > dis', () => {
    expect(getNetAttackMode(1, 0)).toBe('advantage')
    expect(getNetAttackMode(2, 1)).toBe('advantage')
  })

  it('returns disadvantage when dis > adv', () => {
    expect(getNetAttackMode(0, 1)).toBe('disadvantage')
    expect(getNetAttackMode(1, 2)).toBe('disadvantage')
  })
})

describe('combineAttackModes', () => {
  const emptyEffects = () => computeConditionEffects([])
  const effects = (keys) => computeConditionEffects(keys)

  it('returns normal when no conditions', () => {
    expect(combineAttackModes(emptyEffects(), emptyEffects(), 5)).toBe('normal')
  })

  it('combines attacker disadvantage with target advantage', () => {
    const attacker = effects(['poisoned'])
    const target = effects(['paralyzed'])
    expect(combineAttackModes(attacker, target, 5)).toBe('normal')
  })

  it('gives advantage from invisible against blinded', () => {
    const attacker = effects(['invisible'])
    const target = effects(['blinded'])
    expect(combineAttackModes(attacker, target, 5)).toBe('advantage')
  })

  it('gives disadvantage from poisoned against normal target', () => {
    const attacker = effects(['poisoned'])
    const target = emptyEffects()
    expect(combineAttackModes(attacker, target, 5)).toBe('disadvantage')
  })

  it('applies prone within 5ft advantage for melee attacks', () => {
    const attacker = emptyEffects()
    const target = effects(['prone'])
    expect(combineAttackModes(attacker, target, 5)).toBe('advantage')
  })

  it('applies prone beyond 5ft disadvantage for ranged attacks', () => {
    const attacker = emptyEffects()
    const target = effects(['prone'])
    expect(combineAttackModes(attacker, target, 30)).toBe('disadvantage')
  })

  it('prone beyond 5ft cancels with attacker advantage', () => {
    const attacker = effects(['invisible'])
    const target = effects(['prone'])
    expect(combineAttackModes(attacker, target, 30)).toBe('normal')
  })
})

describe('CONDITIONS_THAT_CANNOT_ACT', () => {
  it('includes all conditions that prevent actions', () => {
    expect(CONDITIONS_THAT_CANNOT_ACT.has('incapacitated')).toBe(true)
    expect(CONDITIONS_THAT_CANNOT_ACT.has('paralyzed')).toBe(true)
    expect(CONDITIONS_THAT_CANNOT_ACT.has('petrified')).toBe(true)
    expect(CONDITIONS_THAT_CANNOT_ACT.has('stunned')).toBe(true)
    expect(CONDITIONS_THAT_CANNOT_ACT.has('unconscious')).toBe(true)
  })
})

describe('CONDITIONS_THAT_SPEED_ZERO', () => {
    it('includes all conditions that set speed to 0', () => {
      expect(CONDITIONS_THAT_SPEED_ZERO.has('grappled')).toBe(true)
      expect(CONDITIONS_THAT_SPEED_ZERO.has('paralyzed')).toBe(true)
      expect(CONDITIONS_THAT_SPEED_ZERO.has('petrified')).toBe(true)
      expect(CONDITIONS_THAT_SPEED_ZERO.has('restrained')).toBe(true)
      expect(CONDITIONS_THAT_SPEED_ZERO.has('unconscious')).toBe(true)
     })
  })

describe('hasSaveAdvantage', () => {
    it('returns false for null effects', () => {
      expect(hasSaveAdvantage(null, 'poison')).toBe(false)
     })

    it('returns true when global saveAdvantageCount is positive', () => {
      const effects = computeConditionEffects([])
      effects.saveAdvantageCount = 1;
      expect(hasSaveAdvantage(effects, 'con')).toBe(true);
     })

    it('returns true when condition-specific advantage matches', () => {
      const saveModifiers = [{
          target: 'saving_throw',
       condition: 'poison',
        effect: 'advantage',
       source: 'Dwarven Resilience'
      }];
      const effects = computeConditionEffects(['poisoned'], saveModifiers);
      expect(hasSaveAdvantage(effects, 'poisoned')).toBe(true);
        })

    it('returns false when condition-specific advantage does not match', () => {
      const saveModifiers = [{
          target: 'saving_throw',
       condition: 'poison',
        effect: 'advantage',
       source: 'Dwarven Resilience'
      }];
      const effects = computeConditionEffects(['poisoned'], saveModifiers);
      expect(hasSaveAdvantage(effects, 'con')).toBe(false);
      expect(hasSaveAdvantage(effects, 'str')).toBe(false);
      expect(hasSaveAdvantage(effects, 'dex')).toBe(false);
     })

    it('does not increment global saveAdvantageCount for condition-specific advantage', () => {
      const saveModifiers = [{
          target: 'saving_throw',
       condition: 'poison',
        effect: 'advantage',
       source: 'Dwarven Resilience'
        }];
      const effects = computeConditionEffects(['poisoned'], saveModifiers);
      expect(effects.saveAdvantageCount).toBe(0);
      expect(effects.saveAdvantage).toContain('poisoned');
     })

    it('tracks poisoned condition advantage in saveAdvantage array', () => {
      const saveModifiers = [{
          target: 'saving_throw',
       condition: 'poison',
        effect: 'advantage',
       source: 'Dwarven Resilience'
      }];
      expect(computeConditionEffects([], saveModifiers).saveAdvantage).toEqual([]);
      expect(computeConditionEffects(['poisoned'], saveModifiers).saveAdvantage).toContain('poisoned');
    })

    it('tracks frightened condition advantage in saveAdvantage array', () => {
      const saveModifiers = [{
          target: 'saving_throw',
       condition: 'frightened',
        effect: 'advantage'
      }];
      expect(computeConditionEffects([], saveModifiers).saveAdvantage).toEqual([]);
      expect(computeConditionEffects(['frightened'], saveModifiers).saveAdvantage).toContain('frightened');
     })

    it('tracks charmed condition advantage in saveAdvantage array', () => {
      const saveModifiers = [{
          target: 'saving_throw',
       condition: 'charmed',
        effect: 'advantage'
      }];
      expect(computeConditionEffects([], saveModifiers).saveAdvantage).toEqual([]);
      expect(computeConditionEffects(['charmed'], saveModifiers).saveAdvantage).toContain('charmed');
     })

    it('gives advantage for both global count and condition-specific', () => {
      const effects2 = computeConditionEffects(['poisoned'], [{
          target: 'saving_throw',
       condition: 'poison',
        effect: 'advantage'
       }]);
      effects2.saveAdvantageCount = 1;
      expect(hasSaveAdvantage(effects2, 'con')).toBe(true);
      expect(hasSaveAdvantage(effects2, 'poisoned')).toBe(true);
       })
    })
