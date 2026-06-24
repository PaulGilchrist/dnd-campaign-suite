import React from 'react'
import usePopup from './usePopup.js'
import { DiceRollContext } from './DiceRollContext.js'

export default function useSharedPopup() {
    const { popupHtml, setPopupHtml } = usePopup(() => null)
    const value = React.useMemo(() => ({ popupHtml, setPopupHtml }), [popupHtml])
    return { popupHtml, setPopupHtml, value, Provider: DiceRollContext.Provider }
}
