// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WarMagicSpellModal from './WarMagicSpellModal.jsx'

vi.mock('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js', () => ({
    confirmWarMagicSpell: vi.fn(),
}))

describe('WarMagicSpellModal', () => {
    const mockOnClose = vi.fn()
    const mockAction = {
        name: 'Improved War Magic',
        automation: { type: 'war_magic_spell', maxSpellLevel: 2 },
    }
    const mockPlayerStats = { name: 'TestFighter', rules: '2024' }
    const mockCampaignName = 'test-campaign'
    const mockOptions = ['Burning Hands', 'Shield', 'Web']
    const mockOptionDetails = {
        'Burning Hands': { name: 'Burning Hands', level: 1, casting_time: '1 action', range: 'Self', description: 'Burst of flame', damage: '3d6 fire' },
        'Shield': { name: 'Shield', level: 1, casting_time: '1 reaction', range: 'Self', description: 'Arcane barrier', damage: null },
        'Web': { name: 'Web', level: 2, casting_time: '1 action', range: '60 ft', description: 'Creates areas of webbing', damage: '2d6 bludgeoning' },
    }

    function renderModal(props = {}) {
        return render(
            <WarMagicSpellModal
                action={mockAction}
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                options={mockOptions}
                optionDetails={mockOptionDetails}
                maxSpellLevel={2}
                onClose={mockOnClose}
                {...props}
            />
        )
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('initial render', () => {
        it('renders the action name in the header', () => {
            renderModal()
            expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
        })

        it('renders all spell options with their levels', () => {
            renderModal()
            expect(screen.getByText('Burning Hands')).toBeInTheDocument()
            expect(screen.getByText('Shield')).toBeInTheDocument()
            expect(screen.getByText('Web')).toBeInTheDocument()
            expect(screen.getAllByText(/Level 1/)).toHaveLength(2)
            expect(screen.getByText('Level 2')).toBeInTheDocument()
        })

        it('shows the correct prompt text with max spell level', () => {
            renderModal()
            expect(screen.getByText(/Replace one attack with a Wizard spell of level 1–2/)).toBeInTheDocument()
        })

        it('disables confirm button when no spell is selected', () => {
            renderModal()
            expect(screen.getByRole('button', { name: /replace attack/i })).toBeDisabled()
        })

        it('renders cancel button', () => {
            renderModal()
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
        })

        it('renders casting times on options that have them', () => {
            renderModal()
            expect(screen.getAllByText(/1 action/)).toHaveLength(2)
            expect(screen.getByText(/1 reaction/)).toBeInTheDocument()
        })

        it('renders options without casting time gracefully when detail is missing', () => {
            const detailsWithoutCastingTime = {
                'Burning Hands': { name: 'Burning Hands', level: 1 },
            }
            renderModal({ options: ['Burning Hands'], optionDetails: detailsWithoutCastingTime })
            expect(screen.getByText('Burning Hands')).toBeInTheDocument()
            expect(screen.getByText('Level 1')).toBeInTheDocument()
        })
    })

    describe('spell selection', () => {
        it('enables confirm button after selecting a spell', () => {
            renderModal()
            fireEvent.click(screen.getByText('Web'))
            expect(screen.getByRole('button', { name: /replace attack/i })).toBeEnabled()
        })

        it('allows switching selection to a different spell', () => {
            renderModal()
            fireEvent.click(screen.getByText('Web'))
            expect(screen.getByRole('button', { name: /replace attack/i })).toBeEnabled()

            fireEvent.click(screen.getByText('Shield'))
            expect(screen.getByRole('button', { name: /replace attack/i })).toBeEnabled()
        })

        it('renders the modal with no spell options when options array is empty', () => {
            renderModal({ options: [] })
            expect(screen.getByText('Improved War Magic')).toBeInTheDocument()
            expect(screen.queryAllByText(/Level/)).toHaveLength(0)
        })
    })

    describe('overlay interactions', () => {
        it('calls onClose when the overlay background is clicked', () => {
            renderModal()
            const overlay = document.querySelector('.sp-overlay')
            fireEvent.click(overlay)
            expect(mockOnClose).toHaveBeenCalledOnce()
        })

        it('does not call onClose when the modal content is clicked', () => {
            renderModal()
            const modal = document.querySelector('.sp-modal')
            fireEvent.click(modal)
            expect(mockOnClose).not.toHaveBeenCalled()
        })
    })

    describe('cancel action', () => {
        it('calls onClose when Cancel button is clicked', () => {
            renderModal()
            fireEvent.click(screen.getByText('Cancel'))
            expect(mockOnClose).toHaveBeenCalledOnce()
        })
    })

    describe('confirmation flow', () => {
        it('calls confirmWarMagicSpell with correct arguments and shows result on confirm', async () => {
            const { confirmWarMagicSpell } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js')
            confirmWarMagicSpell.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Improved War Magic',
                    description: 'Replaced one attack with the level 2 spell Web.',
                },
            })

            renderModal()
            fireEvent.click(screen.getByText('Web'))
            fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

            await expect(confirmWarMagicSpell).toHaveBeenCalledWith(
                mockAction,
                mockPlayerStats,
                mockCampaignName,
                'Web'
            )
        })

        it('shows Done button after confirmation', async () => {
            const { confirmWarMagicSpell } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js')
            confirmWarMagicSpell.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Improved War Magic',
                    description: 'Replaced one attack with the level 2 spell Web.',
                },
            })

            renderModal()
            fireEvent.click(screen.getByText('Web'))
            fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

            await expect(screen.findByText('Done')).resolves.toBeInTheDocument()
        })

        it('displays the result description from the handler', async () => {
            const { confirmWarMagicSpell } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js')
            confirmWarMagicSpell.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Improved War Magic',
                    description: 'Custom result message.',
                },
            })

            renderModal()
            fireEvent.click(screen.getByText('Web'))
            fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

            await expect(screen.findByText('Custom result message.')).resolves.toBeInTheDocument()
        })

        it('calls onClose when Done button is clicked after confirmation', async () => {
            const { confirmWarMagicSpell } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js')
            confirmWarMagicSpell.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Improved War Magic',
                    description: 'Replaced one attack with the level 2 spell Web.',
                },
            })

            renderModal()
            fireEvent.click(screen.getByText('Web'))
            fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

            await screen.findByText('Done')
            fireEvent.click(screen.getByText('Done'))
            expect(mockOnClose).toHaveBeenCalledOnce()
        })

        it('renders the wizard hat icon in the result state', async () => {
            const { confirmWarMagicSpell } = await import('../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js')
            confirmWarMagicSpell.mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Improved War Magic',
                    description: 'Done.',
                },
            })

            renderModal()
            fireEvent.click(screen.getByText('Web'))
            fireEvent.click(screen.getByRole('button', { name: /replace attack/i }))

            await screen.findByText('Done')
            const icon = document.querySelector('.sp-header i.fa-solid.fa-hat-wizard')
            expect(icon).toBeInTheDocument()
        })
    })

    describe('edge cases', () => {
        it('shows a different max spell level in the prompt', () => {
            renderModal({ maxSpellLevel: 3 })
            expect(screen.getByText(/Replace one attack with a Wizard spell of level 1–3/)).toBeInTheDocument()
        })

        it('renders options with only a name in optionDetails', () => {
            const minimalDetails = {
                'Burning Hands': { name: 'Burning Hands' },
            }
            renderModal({ options: ['Burning Hands'], optionDetails: minimalDetails })
            expect(screen.getByText('Burning Hands')).toBeInTheDocument()
            expect(screen.queryByText(/Level/)).not.toBeInTheDocument()
        })
    })
})
