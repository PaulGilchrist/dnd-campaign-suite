// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WarMagicCantripModal from './WarMagicCantripModal.jsx'
import * as cantripHandler from '../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js'

vi.mock('../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js', () => ({
    confirmWarMagicCantrip: vi.fn(),
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
    })

    describe('initial render', () => {
        it('renders the modal with action name, cantrip options, prompt text, and buttons', () => {
            render(<WarMagicCantripModal {...makeProps()} />)
            expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
            expect(screen.getByText(/Replace one attack with a Wizard cantrip/)).toBeInTheDocument()
            expect(screen.getByText('Ray of Frost')).toBeInTheDocument()
            expect(screen.getByText('Shocking Grasp')).toBeInTheDocument()
            expect(screen.getByText('Cancel')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /replace attack/i })).toBeInTheDocument()
        })

        it('renders casting time next to cantrip names when optionDetails includes them', () => {
            render(<WarMagicCantripModal {...makeProps()} />)
            expect(screen.queryAllByText('(1 action)')).toHaveLength(2)
        })

        it('renders cantrip name without casting time span when optionDetails is missing', () => {
            render(<WarMagicCantripModal {...makeProps({ optionDetails: {} })} />)
            expect(screen.getByText('Ray of Frost')).toBeInTheDocument()
            expect(screen.queryByText('Ray of Frost (1 action)')).not.toBeInTheDocument()
        })
    })

    describe('selection behavior', () => {
        it('disables confirm button when no cantrip is selected, enables after selection, and switches selection', () => {
            render(<WarMagicCantripModal {...makeProps()} />)
            expect(screen.getByRole('button', { name: /replace attack/i })).toBeDisabled()
            fireEvent.click(screen.getByText('Ray of Frost'))
            expect(screen.getByRole('button', { name: /replace attack/i })).toBeEnabled()
            fireEvent.click(screen.getByText('Shocking Grasp'))
            expect(screen.getByRole('button', { name: /replace attack/i })).toBeEnabled()
        })
    })

    describe('cancel', () => {
        it('calls onClose when Cancel is clicked', () => {
            render(<WarMagicCantripModal {...makeProps()} />)
            fireEvent.click(screen.getByText('Cancel'))
            expect(mockOnClose).toHaveBeenCalledOnce()
        })
    })

    describe('confirmation flow', () => {
        it('calls confirmWarMagicCantrip with correct args and shows result state with Done button and description', async () => {
            cantripHandler.confirmWarMagicCantrip.mockResolvedValue({
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

            await waitFor(() => {
                expect(cantripHandler.confirmWarMagicCantrip).toHaveBeenCalledWith(
                    mockAction,
                    mockPlayerStats,
                    mockCampaignName,
                    'Ray of Frost'
                )
                expect(screen.getByText('Done')).toBeInTheDocument()
                expect(screen.getByText('Replaced one attack with the cantrip Ray of Frost.')).toBeInTheDocument()
            })
        })

        it('does not show result state when handler returns null', async () => {
            cantripHandler.confirmWarMagicCantrip.mockResolvedValue(null)

            render(<WarMagicCantripModal {...makeProps()} />)
            fireEvent.click(screen.getByText('Ray of Frost'))
            fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

            await waitFor(() => {
                expect(screen.queryByText('Done')).not.toBeInTheDocument()
            })
        })
    })

    describe('closing from result state', () => {
        function renderWithResult() {
            cantripHandler.confirmWarMagicCantrip.mockResolvedValue({
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
        }

        it('closes when Done is clicked but not when the overlay backdrop is clicked', async () => {
            renderWithResult()
            await waitFor(() => screen.getByText('Done'))
            fireEvent.click(document.querySelector('.sp-overlay'))
            expect(mockOnClose).not.toHaveBeenCalled()
            expect(screen.getByText('Done')).toBeInTheDocument()
            fireEvent.click(screen.getByText('Done'))
            expect(mockOnClose).toHaveBeenCalledOnce()
        })

        it('does not close when clicking inside the modal content', async () => {
            renderWithResult()
            await waitFor(() => screen.getByText('Done'))
            fireEvent.click(screen.getByText('Improved War Magic'))
            expect(mockOnClose).not.toHaveBeenCalled()
        })
    })

    describe('edge cases', () => {
        it('renders without cantrip options when options array is empty and disables confirm button', () => {
            render(<WarMagicCantripModal {...makeProps({ options: [] })} />)
            expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
            expect(screen.getByText(/Replace one attack with a Wizard cantrip/)).toBeInTheDocument()
            expect(screen.queryAllByText(/Ray of Frost|Shocking Grasp/)).toHaveLength(0)
            expect(screen.getByRole('button', { name: /replace attack/i })).toBeDisabled()
        })
    })
})
