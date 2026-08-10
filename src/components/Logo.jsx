import React from 'react'

/**
 * Audis Brand Logo Component
 * Uses the user's custom PNG logo assets.
 * 
 * @param {Object} props
 * @param {string} [props.className='h-8 w-auto']
 * @param {'light'|'dark'} [props.variant='light'] - 'light' (white for dark backgrounds) or 'dark' (dark for bright backgrounds)
 */
export default function AudisLogo({ className = 'h-8 w-auto', variant = 'light' }) {
  const logoSrc = variant === 'dark' ? '/assets/logo_dark.png' : '/assets/logo_light.png'

  return (
    <img
      src={logoSrc}
      alt="Audis Logo"
      className={`object-contain transition-opacity duration-200 ${className}`}
    />
  )
}
