/**
 * @fileoverview Regression tests for the homepage landing check that gates the
 * scrollable features slab. The workspace never leaves `/`, so the guard has to
 * key off the chat state as well as the route — otherwise a screen of marketing
 * copy stays scrollable underneath a submitted conversation.
 */
import { describe, it, expect } from 'vitest'
import { isHomeLandingState } from '../home-landing'

/** The untouched homepage: research view, nothing submitted. */
const landing = { pathname: '/', activeView: 'research', chatTurnCount: 0 }

describe('isHomeLandingState', () => {
  it('shows the features on the untouched homepage', () => {
    expect(isHomeLandingState(landing)).toBe(true)
  })

  it('hides the features once a chat has been submitted', () => {
    expect(isHomeLandingState({ ...landing, chatTurnCount: 1 })).toBe(false)
    expect(isHomeLandingState({ ...landing, chatTurnCount: 4 })).toBe(false)
  })

  it('hides the features outside the research view', () => {
    expect(isHomeLandingState({ ...landing, activeView: 'docs' })).toBe(false)
  })

  it('hides the features off the homepage route', () => {
    expect(isHomeLandingState({ ...landing, pathname: '/features' })).toBe(false)
    expect(isHomeLandingState({ ...landing, pathname: null })).toBe(false)
  })
})
