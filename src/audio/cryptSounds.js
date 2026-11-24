// =====================================================================
// THE FORGOTTEN VILLAGE — SONS DE LA CRIPTA (Fase D.3): síntesi WebAudio, sense fitxers ni dependències
// =====================================================================
// L'AudioContext es crea la primera vegada que se'n demana un so (a partir de la tecla E: gest de l'usuari).
// Sense AudioContext (Node, navegador antic) tot són no-ops: el joc continua igual.
export function createCryptSounds() {
  let ctx = null; let master = null; let failed = false;
  function ensure() {
    if (ctx || failed) return ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { failed = true; return null; }
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination); } catch (e) { failed = true; ctx = null; }
    return ctx;
  }
  function noise(seconds) {
    const n = Math.floor(ctx.sampleRate * seconds); const buf = ctx.createBuffer(1, n, ctx.sampleRate); const d = buf.getChannelData(0);
    let s = 1; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    const src = ctx.createBufferSource(); src.buffer = buf; return src;
  }
  function env(gain, t0, attack, hold, release, peak) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.setValueAtTime(peak, t0 + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  }
  function tone(freq, t0, dur, peak, type = 'sine', slideTo = null) {
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    env(g, t0, 0.01, dur * 0.3, dur * 0.7, peak); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function filtered(seconds, t0, type, f0, f1, peak, attack = 0.05) {
    const src = noise(seconds); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
    f.type = type; f.frequency.setValueAtTime(f0, t0); f.frequency.linearRampToValueAtTime(f1, t0 + seconds);
    env(g, t0, attack, seconds * 0.5, seconds * 0.5 - attack, peak); src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + seconds);
  }
  const SOUNDS = {
    disc(t) { filtered(0.18, t, 'lowpass', 900, 200, 0.5, 0.005); tone(110, t, 0.22, 0.35, 'triangle', 70); },       // clac de pedra
    solved(t) { tone(55, t, 1.6, 0.5, 'sine', 41); tone(82, t + 0.05, 1.2, 0.25, 'sine', 55); filtered(1.2, t, 'lowpass', 400, 120, 0.3); },
    mechanism(t) { filtered(2.2, t, 'lowpass', 220, 90, 0.7, 0.3); tone(38, t, 2.2, 0.5, 'sine', 30); },              // retrunyiment greu
    lid(t) { filtered(2.6, t, 'bandpass', 500, 260, 0.45, 0.2); tone(48, t, 2.6, 0.25, 'sine', 40); },                // arrossegament de pedra
    key(t) { tone(1760, t, 0.5, 0.18, 'sine'); tone(2637, t + 0.02, 0.35, 0.1, 'sine'); filtered(0.08, t, 'highpass', 3000, 3000, 0.2, 0.002); },
    // --- Fase E: mausoleu ---
    slab(t) { filtered(0.26, t, 'lowpass', 750, 150, 0.55, 0.01); tone(88, t, 0.28, 0.3, 'triangle', 58); },        // llosa de pedra que llisca
    door(t) { filtered(3.2, t, 'bandpass', 430, 170, 0.45, 0.4); tone(72, t, 3.2, 0.12, 'sawtooth', 52); },           // roure vell que grinyola
    glow(t) { [330, 392, 440, 523, 587, 659, 784].forEach((f, i) => tone(f, t + i * 0.45, 1.0, 0.11, 'sine')); },     // un to per llosa que s'il·lumina (0,45 s cadascun)
    stone(t) { filtered(5, t, 'lowpass', 270, 70, 0.85, 0.5); tone(34, t, 5, 0.5, 'sine', 27); filtered(1.4, t + 0.1, 'bandpass', 600, 220, 0.3, 0.05); },   // llosa enorme que s'enfonsa
    note(t) { filtered(0.25, t, 'bandpass', 3000, 1800, 0.2, 0.02); },                                               // paper
  };
  return {
    play(name) {
      const c = ensure(); if (!c || !SOUNDS[name]) return;
      try { if (c.state === 'suspended') c.resume(); SOUNDS[name](c.currentTime + 0.01); } catch (e) { /* sense so: no és crític */ }
    },
    available: () => !failed,
  };
}
