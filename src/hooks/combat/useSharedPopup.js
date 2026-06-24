import React from 'react'
import usePopup from './usePopup.js'
import { DiceRollContext } from './DiceRollContext.js'

export default function useSharedPopup() {
    const { popupHtml, setPopupHtml } = usePopup(() => null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const value = React.useMemo(() => ({ popupHtml, setPopupHtml }), [popupHtml])
    return { popupHtml, setPopupHtml, value, Provider: DiceRollContext.Provider }
}
