/**
 * Web Audio API Sound Synthesizer for POS Hardware feedback
 * Zero external audio files required, instant latency-free response.
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Standard Retail Barcode Scanner Beep
 * High-pitch (1850Hz) short sharp pulse characteristic of physical USB laser/CCD scanners.
 */
export function playScanBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, ctx.currentTime);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    console.debug('Audio playScanBeep suppressed', e);
  }
}

/**
 * Warning / Out-of-Stock / Not Found Boop
 * Lower frequency double tone to alert cashier immediately without looking up.
 */
export function playErrorBoop() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, ctx.currentTime);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  } catch (e) {
    console.debug('Audio playErrorBoop suppressed', e);
  }
}

/**
 * Checkout Success Register Chime
 * Pleasant multi-tone rising chime simulating cash register drawer opening.
 */
export function playRegisterChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [987.77, 1318.51, 1975.53]; // B5, E6, B6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);

      const startTime = ctx.currentTime + idx * 0.06;
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.16);
    });
  } catch (e) {
    console.debug('Audio playRegisterChime suppressed', e);
  }
}
