import React from 'react'

export const DiceRollContext = React.createContext({
    popupHtml: null,
    setPopupHtml: () => {},
    _isShared: false,
})

export function useDiceRollPopup() {
    return React.useContext(DiceRollContext)
}
