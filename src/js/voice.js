// @ts-check
/**
 * Voice search with the Web Speech API (the red microphone button).
 * Supported in Chrome, Edge and Safari; `isVoiceSupported()` lets the UI explain when it isn't.
 * Events used: `result`, `error`, `end` on the SpeechRecognition object.
 */

/** @returns {any} */
function Recognition() {
  const w = /** @type {any} */ (window)
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isVoiceSupported() {
  return typeof window !== 'undefined' && !!Recognition()
}

/**
 * @typedef {Object} VoiceHandlers
 * @property {(text: string, final: boolean) => void} onText   interim and final transcripts
 * @property {(message: string) => void} onError
 * @property {() => void} onEnd
 */

/**
 * Starts listening; returns a function that stops early.
 * @param {VoiceHandlers} h
 * @param {string} [lang]
 * @returns {() => void}
 */
export function startVoiceSearch(h, lang = navigator.language || 'en-IN') {
  const R = Recognition()
  if (!R) {
    h.onError('Voice search isn’t supported in this browser. Try Chrome, Edge or Safari.')
    h.onEnd()
    return () => {}
  }
  const rec = new R()
  rec.lang = lang
  rec.interimResults = true
  rec.maxAlternatives = 1
  rec.continuous = false

  rec.addEventListener('result', (/** @type {any} */ e) => {
    let text = ''
    let final = false
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript
      if (e.results[i].isFinal) final = true
    }
    h.onText(text.trim(), final)
  })
  rec.addEventListener('error', (/** @type {any} */ e) => {
    const messages = /** @type {Record<string, string>} */ ({
      'not-allowed': 'Microphone permission was denied.',
      'no-speech': 'Didn’t hear anything — try again.',
      'audio-capture': 'No microphone was found.',
      network: 'Voice search needs an internet connection.',
    })
    if (e.error !== 'aborted') h.onError(messages[e.error] ?? 'Voice search stopped unexpectedly.')
  })
  rec.addEventListener('end', () => h.onEnd())
  rec.start()
  return () => rec.abort()
}
