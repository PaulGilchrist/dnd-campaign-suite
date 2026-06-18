// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WarMagicCantripModal from './WarMagicCantripModal.jsx'

vi.mock('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js', () => ({
    confirmWarMagicCantrip: vi.fn(),
}))

vi.mock('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js', () => ({
    confirmWarMagicSpell: vi.fn(),
}))

const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
const mockCampaignName = 'test-campaign'
const mockOnClose = vi.fn()

const mockAction = {
    name: 'Improved War Magic',
    automation: { type: 'war_magic_cantrip' },
}

const mockOptions = ['Ray of Frost', 'Shocking Grasp']

const mockOptionDetails = {
    'Ray of Frost': { name: 'Ray of Frost', level: 0, casting_time: '1 action', range: '120 ft', description: 'A bolt of freezing energy', damage: '1d8 cold' },
    'Shocking Grasp': { name: 'Shocking Grasp', level: 0, casting_time: '1 action', range: 'Self', description: 'A bolt of lightning', damage: '1d6 lightning' },
    'Burning Hands': { name: 'Burning Hands', level: 1, casting_time: '1 action', range: 'Self', description: 'Burst of flame', damage: '3d6 fire' },
}

function makeProps(overrides) {
    return {
        action: mockAction,
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        options: mockOptions,
        optionDetails: mockOptionDetails,
        onClose: mockOnClose,
        ...(overrides || {}),
    }
}

describe('WarMagicCantripModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // ── Initial render ──

    it('renders the modal overlay', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument()
    })

    it('renders the modal structure (sp-overlay, sp-modal, sp-header, sp-body, sp-actions)', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument()
        expect(document.querySelector('.sp-modal')).toBeInTheDocument()
        expect(document.querySelector('.sp-header')).toBeInTheDocument()
        expect(document.querySelector('.sp-body')).toBeInTheDocument()
        expect(document.querySelector('.sp-actions')).toBeInTheDocument()
    })

    it('renders the action name in the header', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
    })

    it('renders the wizard hat icon in the header', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        const icon = document.querySelector('.fa-solid.fa-hat-wizard')
        expect(icon).toBeInTheDocument()
    })

    it('renders all cantrip options', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.getByText('Ray of Frost')).toBeInTheDocument()
        expect(screen.getByText('Shocking Grasp')).toBeInTheDocument()
    })

    it('renders the prompt text', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.getByText(/Replace one attack with a Wizard cantrip/)).toBeInTheDocument()
    })

    it('shows casting time for each cantrip', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.getAllByText(/\(1 action\)/)).toHaveLength(2)
    })

    it('renders the Cancel button', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('renders the Replace Attack button with a bolt icon', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        const btn = screen.getByRole('button', { name: /replace attack/i })
        expect(btn).toBeInTheDocument()
        expect(btn.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument()
    })

    // ── Selection behavior ──

    it('has no option selected initially', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        expect(screen.queryByText('Ray of Frost').parentElement).not.toHaveStyle({ border: '2px solid #007bff' })
    })

    it('highlights the selected option with border and background color', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        fireEvent.click(screen.getByText('Shocking Grasp'))
        const selectedEl = screen.getByText('Shocking Grasp').parentElement
        expect(selectedEl).toHaveStyle({ border: '2px solid #007bff', backgroundColor: '#e8f0fe' })
    })

    it('deselects previous option when a different one is selected', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        fireEvent.click(screen.getByText('Ray of Frost'))
        const firstEl = screen.getByText('Ray of Frost').parentElement
        expect(firstEl).toHaveStyle({ border: '2px solid #007bff' })
        fireEvent.click(screen.getByText('Shocking Grasp'))
        expect(firstEl).not.toHaveStyle({ border: '2px solid #007bff' })
    })

    // ── Confirm button state ──

    it('disables confirm button when no selection', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toBeDisabled()
    })

    it('enables confirm button after selection', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        fireEvent.click(screen.getByText('Ray of Frost'))
        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toBeEnabled()
    })

    // ── Cancel behavior ──

    it('calls onClose when Cancel is clicked', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        fireEvent.click(screen.getByText('Cancel'))
        expect(mockOnClose).toHaveBeenCalled()
    })

    // ── Overlay click to dismiss ──

    it('calls onClose when clicking the overlay background', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        const overlay = document.querySelector('.sp-overlay')
        fireEvent.click(overlay)
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('does NOT close when clicking inside the modal content', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        const modal = document.querySelector('.sp-modal')
        fireEvent.click(modal)
        expect(mockOnClose).not.toHaveBeenCalled()
    })

    // ── Confirmation flow ──

    it('calls confirm handler with correct args when a cantrip is selected and confirmed', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(confirmWarMagicCantrip).toHaveBeenCalledWith(
                mockAction,
                mockPlayerStats,
                mockCampaignName,
                'Ray of Frost'
            )
        })
    })

    it('shows result state with Done button after confirmation', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })
    })

    it('hides selection options after confirmation', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.queryByText(/Replace one attack with a Wizard cantrip/)).not.toBeInTheDocument()
        })
    })

    it('hides the Replace Attack button after confirmation', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.queryByRole('button', { name: /replace attack/i })).not.toBeInTheDocument()
        })
    })

    it('hides the Cancel button after confirmation', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
        })
    })

    // ── Result state ──

    it('renders result payload description as HTML via dangerouslySetInnerHTML', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip <b>Ray of Frost</b>.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            const bodyDiv = document.querySelector('.sp-body')
            expect(bodyDiv.innerHTML).toContain('<b>Ray of Frost</b>')
        })
    })

    it('renders the wizard hat icon in the result header', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Done.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            const icon = document.querySelector('.sp-header .fa-solid.fa-hat-wizard')
            expect(icon).toBeInTheDocument()
        })
    })

    it('renders Done button with sp-roll-btn class in result state', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Done.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            const doneBtn = screen.getByRole('button', { name: 'Done' })
            expect(doneBtn.classList.contains('sp-roll-btn')).toBe(true)
        })
    })

    // ── Close from result state ──

    it('calls onClose when Done is clicked after confirmation', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Replaced one attack with the cantrip Ray of Frost.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Done'))
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('calls onClose when clicking the overlay in result state', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Done.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })

        const overlay = document.querySelector('.sp-overlay')
        fireEvent.click(overlay)
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('does NOT close when clicking inside modal in result state', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Improved War Magic',
                description: 'Done.',
            },
        })

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument()
        })

        const modal = document.querySelector('.sp-modal')
        fireEvent.click(modal)
        expect(mockOnClose).not.toHaveBeenCalled()
    })

    // ── Edge cases: empty options ──

    it('renders with no cantrip options when options array is empty', () => {
        render(<WarMagicCantripModal {...makeProps({ options: [] })} />)
        expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
        expect(screen.getByText(/Replace one attack with a Wizard cantrip/)).toBeInTheDocument()
        expect(screen.queryAllByText(/Ray of Frost|Shocking Grasp/)).toHaveLength(0)
    })

    it('disables confirm button when there are no options', () => {
        render(<WarMagicCantripModal {...makeProps({ options: [] })} />)
        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toBeDisabled()
    })

    // ── Edge cases: missing optionDetails ──

    it('renders cantrip name without casting_time span when optionDetails is missing', () => {
        render(<WarMagicCantripModal {...makeProps({ optionDetails: {} })} />)
        expect(screen.getByText('Ray of Frost')).toBeInTheDocument()
        // No casting time should appear since optionDetails is empty
        expect(screen.queryAllByText(/\(1 action\)/)).toHaveLength(0)
    })

    // ── Edge cases: handler returns no result ──

    it('does not show result state when handler returns null', async () => {
        const { confirmWarMagicCantrip } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js')
        confirmWarMagicCantrip.mockResolvedValue(null)

        render(<WarMagicCantripModal {...makeProps()} />)

        fireEvent.click(screen.getByText('Ray of Frost'))
        fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

        await vi.waitFor(() => {
            expect(screen.queryByText('Done')).not.toBeInTheDocument()
        })
    })

    // ── Button classes ──

    it('Replace Attack button has sp-roll-btn class', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        const btn = screen.getByRole('button', { name: /replace attack/i })
        expect(btn.classList.contains('sp-roll-btn')).toBe(true)
    })

    it('Cancel button has sp-dismiss-btn class', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        const btn = screen.getByRole('button', { name: 'Cancel' })
        expect(btn.classList.contains('sp-dismiss-btn')).toBe(true)
    })

    // ── Disabled button styling ──

    it('applies opacity style to confirm button when disabled', () => {
        render(<WarMagicCantripModal {...makeProps()} />)
        const confirmBtn = screen.getByRole('button', { name: /replace attack/i })
        expect(confirmBtn).toHaveStyle({ opacity: 0.5, cursor: 'not-allowed' })
    })
})
