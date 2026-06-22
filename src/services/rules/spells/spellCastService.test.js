import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => undefined),
}))

// Import after mocks are set up
import { refundSpellBreakerSlot } from './spellCastService.js'

describe('spellCastService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('refundSpellBreakerSlot', () => {
    it('refunds a spell slot when currentSlots >= 0', async () => {
      const { setRuntimeValue, getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue(2)
      refundSpellBreakerSlot('Wizard1', 3, 'camp')
      expect(setRuntimeValue).toHaveBeenCalledWith('Wizard1', 'spell_slots_level_3', 3, 'camp')
    })

    it('does not refund when currentSlots is null', async () => {
      const { setRuntimeValue, getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue(null)
      refundSpellBreakerSlot('Wizard1', 3, 'camp')
      expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('does not refund when currentSlots is negative', async () => {
      const { setRuntimeValue, getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue(-1)
      refundSpellBreakerSlot('Wizard1', 3, 'camp')
      expect(setRuntimeValue).not.toHaveBeenCalled()
    })
  })
})
