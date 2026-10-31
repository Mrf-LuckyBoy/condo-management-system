'use client'

import { useEffect, useRef, useState } from 'react'

export type ComboboxItem = { id: string | number; label: string }

type ComboboxProps<T extends ComboboxItem> = {
  items: T[]
  onSelect: (item: T | null) => void
  placeholder?: string
  disabled?: boolean
  // Change this value (e.g. a counter) to force-clear the input from the parent.
  resetSignal?: unknown
  emptyText?: string
}

export default function Combobox<T extends ComboboxItem>({
  items,
  onSelect,
  placeholder,
  disabled,
  resetSignal,
  emptyText = 'ไม่พบรายการ',
}: ComboboxProps<T>) {
  const [inputValue, setInputValue] = useState('')
  const [hasSelection, setHasSelection] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the original UI's prop-driven form reset/loading lifecycle.
    setInputValue('')
    setHasSelection(false)
  }, [resetSignal])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = inputValue.trim()
    ? items.filter((item) => item.label.toLowerCase().includes(inputValue.trim().toLowerCase()))
    : items

  function pick(item: T) {
    setInputValue(item.label)
    setHasSelection(true)
    setOpen(false)
    onSelect(item)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value)
    setActiveIndex(-1)
    setOpen(true)
    if (hasSelection) {
      setHasSelection(false)
      onSelect(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) return setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && filtered[activeIndex]) pick(filtered[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="combobox" ref={wrapRef}>
      <input
        type="text"
        className="combobox__input"
        value={inputValue}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && !disabled && (
        <ul className="combobox__list">
          {filtered.length === 0 ? (
            <li className="combobox__empty">{emptyText}</li>
          ) : (
            filtered.map((item, i) => (
              <li
                key={item.id}
                className={'combobox__option' + (i === activeIndex ? ' active' : '')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(item)
                }}
              >
                {item.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
