import {
  GameConfig,
  FLOW_THRESHOLDS,
  MASTER_SCALES,
  SOUND_BANKS,
  SoundBankDef,
  ScaleBiome,
  SynthHarmonicContext,
  buildExtendedScale,
  computeMelodicNotes,
  computeContextualSynthHarmony,
  pickBiomeChordProgression,
} from './rules';

export interface PlatformNoteResult {
  notes: number[];
  subdivisionRingDelaysSec: number[];
}

export class OmniAudioEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  compressorNode: DynamicsCompressorNode | null = null;
  reverbNode: ConvolverNode | null = null;
  delayLeft: DelayNode | null = null;
  delayRight: DelayNode | null = null;
  delayFeedback: GainNode | null = null;
  delayWet: GainNode | null = null;
  choirBus: GainNode | null = null;
  noiseBuffer: AudioBuffer | null = null;

  private nextPadSwellTime = 0;
  private lastSynthPadFreq: number | undefined = undefined;
  private melodicStepCounter = 0;
  private lastExtendedIdx: number | undefined = undefined;
  private recentFreqHistory: number[] = [];
  private lastNotePlayTime = 0;

  // Adaptive Jump-Rhythm Subdivision Tracking
  private landingTimestamps: number[] = [];
  private avgJumpIntervalSec = 0.58;
  private jumpsSinceSubdivision = 0;
  private nextSubdivisionJumpTarget = 5;

  init(cfg: GameConfig): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Master Studio Compressor + Boosted Output Stage
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = -14;
    this.compressorNode.knee.value = 16;
    this.compressorNode.ratio.value = 3.2;
    this.compressorNode.attack.value = 0.004;
    this.compressorNode.release.value = 0.18;
    this.compressorNode.connect(this.ctx.destination);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = Math.min(1.65, cfg.volMaster * 1.65);
    this.masterGain.connect(this.compressorNode);

    // Stereo Delay for High Flow Atmospheric Depth
    this.delayLeft = this.ctx.createDelay(1.0);
    this.delayRight = this.ctx.createDelay(1.0);
    this.delayFeedback = this.ctx.createGain();
    this.delayWet = this.ctx.createGain();
    const merger = this.ctx.createChannelMerger(2);

    this.delayLeft.delayTime.value = 0.27;
    this.delayRight.delayTime.value = 0.41;
    this.delayFeedback.gain.value = 0.3;
    this.delayWet.gain.value = 0.18;

    this.delayLeft.connect(this.delayRight);
    this.delayRight.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayLeft);

    this.delayLeft.connect(merger, 0, 0);
    this.delayRight.connect(merger, 0, 1);
    merger.connect(this.delayWet);
    this.delayWet.connect(this.masterGain);

    // Warm Hall Reverb
    this.reverbNode = this.ctx.createConvolver();
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * 2.4);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2.6);
      impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * decay;
      impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * decay;
    }
    this.reverbNode.buffer = impulse;
    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = 0.36;
    this.reverbNode.connect(reverbGain);
    reverbGain.connect(this.masterGain);

    // White Noise Buffer for Dash Wind SFX
    const noiseLen = rate * 0.5;
    this.noiseBuffer = this.ctx.createBuffer(1, noiseLen, rate);
    const out = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      out[i] = Math.random() * 2 - 1;
    }

    // Warm Discrete Synth Swell Bus
    this.choirBus = this.ctx.createGain();
    this.choirBus.gain.value = 1.0;
    this.choirBus.connect(this.reverbNode);
    this.choirBus.connect(this.masterGain);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  stopChoir(): void {
    if (!this.ctx || !this.choirBus) return;
    const t = this.ctx.currentTime;
    this.choirBus.gain.setTargetAtTime(0, t, 0.25);
  }

  resetMusicalState(): void {
    this.melodicStepCounter = 0;
    this.lastExtendedIdx = undefined;
    this.lastSynthPadFreq = undefined;
    this.recentFreqHistory = [];
    this.landingTimestamps = [];
    this.avgJumpIntervalSec = 0.58;
    this.jumpsSinceSubdivision = 0;
    this.nextSubdivisionJumpTarget = 5;
  }

  previewNote(freq: number, cfg: GameConfig, bankOverride?: SoundBankDef, durationBeats = 1.0): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const bank = bankOverride || SOUND_BANKS[0];
    const moddedBank: SoundBankDef = {
      ...bank,
      decaySec: Math.max(0.35, Math.min(3.5, bank.decaySec * Math.max(0.5, durationBeats * 0.85))),
    };
    this.triggerVoiceAt(freq, t, 0, 1, 4, cfg, 1.0, moddedBank);
  }

  /**
   * Plays a dedicated Synthesizer Pad Channel note (for the Stage Creator DAW Synth Channel & Custom Stage runs).
   */
  playCustomSynthNote(freq: number, durationSec: number, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.choirBus) return;
    const t = this.ctx.currentTime;
    this.choirBus.gain.setTargetAtTime(1.0, t, 0.1);
    const safeDur = Math.max(0.4, Math.min(8.0, durationSec));
    this.triggerWarmPadSwell(freq, 0.14, Math.max(0.6, cfg.volChoir), safeDur, 0.75);
  }

  /**
   * Plays a platform note with:
   * 1. Active Lo-Fi / Cyberpunk / CRT Sound Bank synthesis
   * 2. Non-repetitive multi-octave melodic contour (wide 7–8+ note leaps at high Flow)
   * 3. Rolling average jump-rhythm tracking
   * 4. 3-note rhythmic subdivision + 3 synchronized player rings triggered ONLY when Flow levels up (`didFlowLevelUp === true`)!
   */
  playPlatformNote(
    biome: ScaleBiome,
    flow: number,
    cfg: GameConfig,
    noteCluster?: number[],
    soundBank?: SoundBankDef,
    didFlowLevelUp = false,
    noteDurationBeats = 1.0
  ): PlatformNoteResult {
    this.init(cfg);
    const baseBank = soundBank || SOUND_BANKS[0];
    const activeBank: SoundBankDef =
      noteDurationBeats !== 1.0
        ? {
            ...baseBank,
            decaySec: Math.max(
              0.38,
              Math.min(3.8, baseBank.decaySec * Math.max(0.55, noteDurationBeats * 0.9))
            ),
          }
        : baseBank;

    if (!this.ctx || !this.masterGain) {
      return { notes: [261.63], subdivisionRingDelaysSec: [] };
    }

    const t = this.ctx.currentTime;
    if (t - this.lastNotePlayTime < 0.06) {
      return { notes: [biome.scale[0] || 261.63], subdivisionRingDelaysSec: [] };
    }
    this.lastNotePlayTime = t;
    this.masterGain.gain.setTargetAtTime(Math.min(1.65, cfg.volMaster * 1.65), t, 0.06);

    // 1. Track player jump rhythm & compute rolling average jump interval
    if (this.landingTimestamps.length > 0) {
      const delta = t - this.landingTimestamps[this.landingTimestamps.length - 1];
      if (delta >= 0.22 && delta <= 1.65) {
        this.avgJumpIntervalSec = this.avgJumpIntervalSec * 0.65 + delta * 0.35;
      }
    }
    this.landingTimestamps.push(t);
    if (this.landingTimestamps.length > 6) {
      this.landingTimestamps.shift();
    }

    // Add stochastic step variation so live gameplay phrases never repeat a static pattern
    this.melodicStepCounter += Math.random() < 0.35 ? 2 : 1;
    const ext = buildExtendedScale(biome.scale);

    let notes: number[];
    if (noteCluster && noteCluster.length > 0) {
      notes = noteCluster;
    } else {
      notes = computeMelodicNotes(
        biome.scale,
        flow,
        this.melodicStepCounter,
        cfg,
        this.lastExtendedIdx
      );

      // Strong anti-loop guard: check against the last 5 played frequencies and mutate interval if repeated
      if (this.recentFreqHistory.includes(notes[0]) && ext.length > 6) {
        const curIdx = ext.findIndex((f) => Math.abs(f - notes[0]) < 1);
        const creativeOffsets =
          flow >= FLOW_THRESHOLDS.CHORD
            ? [-7, -5, -3, 3, 4, 6, 8]
            : [-4, -3, -2, 2, 3, 4, 5];
        const baseIdx = curIdx >= 0 ? curIdx : Math.floor(ext.length * 0.45);
        for (let attempt = 0; attempt < creativeOffsets.length; attempt++) {
          const offset =
            creativeOffsets[(this.melodicStepCounter + attempt * 2) % creativeOffsets.length];
          const candidateIdx = Math.max(2, Math.min(ext.length - 2, baseIdx + offset));
          const candidateFreq = ext[candidateIdx];
          if (!this.recentFreqHistory.slice(-3).includes(candidateFreq)) {
            notes[0] = candidateFreq;
            break;
          }
        }
      }

      const newIdx = ext.findIndex((f) => Math.abs(f - notes[0]) < 1);
      if (newIdx >= 0) {
        this.lastExtendedIdx = newIdx;
      }
      this.recentFreqHistory.push(notes[0]);
      if (this.recentFreqHistory.length > 6) {
        this.recentFreqHistory.shift();
      }
    }

    // Play primary lead melodic voice (or chord cluster if custom stage)
    notes.slice(0, 3).forEach((nFreq, vIdx) => {
      this.triggerVoiceAt(
        nFreq,
        t + vIdx * 0.012,
        vIdx,
        Math.min(3, notes.length),
        flow,
        cfg,
        vIdx === 0 ? 1.08 : 0.72,
        activeBank
      );
    });

    // Subtle harmonic interval accent only on every 3rd step at high Flow in Standard mode
    if (
      (!noteCluster || noteCluster.length === 0) &&
      flow >= FLOW_THRESHOLDS.HARMONIC &&
      notes[1] &&
      cfg.volIntervals > 0 &&
      this.melodicStepCounter % 3 === 0
    ) {
      this.triggerVoiceAt(notes[1], t + 0.018, 1, 2, flow, cfg, 0.52, activeBank);
    }

    // Deep sub-bass pulse on every 3rd step in Flow >= HARMONIC (x3+)
    if (
      flow >= FLOW_THRESHOLDS.HARMONIC &&
      cfg.volBass > 0 &&
      notes[0] &&
      this.melodicStepCounter % 3 === 0
    ) {
      const subOctave = flow >= FLOW_THRESHOLDS.OVERDRIVE ? 0.25 : 0.5;
      this.playDeepBass(notes[0] * subOctave, cfg);
    }

    // 2. Trigger the 3-note subdivision run + 3 synchronized player ring pulses ONLY when Flow increases by a full level!
    let subdivisionRingDelaysSec: number[] = [];
    if (didFlowLevelUp && flow >= 1) {
      subdivisionRingDelaysSec = this.scheduleHalfIntervalSubdivision(
        ext,
        flow,
        cfg,
        t,
        activeBank
      );
    }

    return { notes, subdivisionRingDelaysSec };
  }

  /**
   * Plays one of the 4 harmonic chords in a biome's selected 4-Gate Chord Progression (`progressionVariant`).
   * Combines:
   * 1. Simultaneous 4-voice warm polyphonic synth brass/pad block chord (2.2s sustain + filter bloom)
   * 2. Shimmering upward 5-note chord harp strum (0ms..220ms)
   * 3. Deep resonant sub-bass pedal root
   */
  playChordGate(
    biome: ScaleBiome,
    gateIndex: number,
    cfg: GameConfig,
    soundBank?: SoundBankDef,
    progressionVariant = 0
  ): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const activeBank = soundBank || SOUND_BANKS[0];
    const safeGate = Math.max(0, Math.min(3, gateIndex));
    const prog = pickBiomeChordProgression(biome, progressionVariant);
    const baseChord =
      prog.chords && prog.chords[safeGate]
        ? prog.chords[safeGate]
        : [biome.scale[0] * 0.5, biome.scale[0], biome.scale[2], biome.scale[4] * 2];

    // Ensure distinct, well-spaced chord voicing: Root Bass, Root, 3rd/4th, 5th/7th, Upper 9th/Octave
    const chordVoicing = [
      baseChord[0],
      baseChord[1],
      baseChord[2],
      baseChord[3],
      Number((baseChord[1] * 2.0).toFixed(2)),
    ];

    // 1. Deep resonant sub-bass foundation
    if (cfg.volBass > 0 && chordVoicing[0]) {
      this.playDeepBass(chordVoicing[0], cfg);
    }

    // 2. Simultaneous Warm Polyphonic Synth Block Chord (all chord tones blooming together!)
    const chordBus = this.ctx.createGain();
    const chordFilter = this.ctx.createBiquadFilter();
    chordFilter.type = 'lowpass';
    chordFilter.Q.setValueAtTime(2.5, t);
    chordFilter.frequency.setValueAtTime(480, t);
    chordFilter.frequency.exponentialRampToValueAtTime(4100, t + 0.22);
    chordFilter.frequency.exponentialRampToValueAtTime(580, t + 2.3);

    const chordVol = Math.min(0.42, 0.25 * Math.max(0.5, cfg.volChords));
    chordBus.gain.setValueAtTime(0.0001, t);
    chordBus.gain.linearRampToValueAtTime(chordVol, t + 0.04);
    chordBus.gain.exponentialRampToValueAtTime(0.0008, t + 2.35);

    chordFilter.connect(chordBus);
    chordBus.connect(this.masterGain);
    if (this.reverbNode) chordBus.connect(this.reverbNode);
    if (this.delayLeft) chordBus.connect(this.delayLeft);

    chordVoicing.slice(1).forEach((freq, idx) => {
      if (!this.ctx) return;
      const oscSaw = this.ctx.createOscillator();
      const oscTri = this.ctx.createOscillator();
      const voiceGain = this.ctx.createGain();

      oscSaw.type = 'sawtooth';
      oscTri.type = 'triangle';
      oscSaw.frequency.setValueAtTime(freq, t);
      oscTri.frequency.setValueAtTime(freq, t);
      oscSaw.detune.setValueAtTime(-9 + idx * 4, t);
      oscTri.detune.setValueAtTime(9 - idx * 3, t);

      voiceGain.gain.value = 0.34;
      oscSaw.connect(voiceGain);
      oscTri.connect(voiceGain);
      voiceGain.connect(chordFilter);

      oscSaw.onended = () => {
        oscSaw.disconnect();
        oscTri.disconnect();
        voiceGain.disconnect();
      };

      oscSaw.start(t);
      oscTri.start(t);
      oscSaw.stop(t + 2.4);
      oscTri.stop(t + 2.4);
    });

    // 3. Crystalline upward harp strum across all 5 chord voices for tactile articulation
    chordVoicing.forEach((freq, idx) => {
      const strumStart = t + idx * 0.052;
      this.triggerVoiceAt(
        freq,
        strumStart,
        0,
        chordVoicing.length,
        FLOW_THRESHOLDS.OVERDRIVE,
        cfg,
        1.15,
        activeBank
      );
    });
  }

  /**
   * Plays 3 celebratory reward notes in the biome's key upon completing all 4 Chord Gates!
   */
  playChordCadenceReward(
    biome: ScaleBiome,
    progressionVariant: number,
    cfg: GameConfig,
    soundBank?: SoundBankDef
  ): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const activeBank = soundBank || SOUND_BANKS[0];
    const prog = pickBiomeChordProgression(biome, progressionVariant);
    const finalChord = prog.chords[3] || biome.chords[0];
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;

    // 3 ascending reward notes in the same key/scale resolving to the upper tonic!
    const rewardNotes = [
      finalChord[2] || sc[2] * 1.5,
      sc[Math.min(4, sc.length - 1)] * 2.0,
      sc[0] * 2.0,
    ];

    rewardNotes.forEach((freq, idx) => {
      const noteStart = t + 0.24 + idx * 0.14;
      this.triggerVoiceAt(
        freq,
        noteStart,
        0,
        1,
        FLOW_THRESHOLDS.OVERDRIVE,
        cfg,
        1.3,
        activeBank
      );
    });
  }

  private triggerVoiceAt(
    freq: number,
    startTime: number,
    voiceIdx: number,
    totalVoices: number,
    flow: number,
    cfg: GameConfig,
    gainScale = 1.0,
    bank: SoundBankDef = SOUND_BANKS[0]
  ): void {
    if (!this.ctx || !this.masterGain) return;

    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    // Apply subtle analog tape wow/flutter
    const flutterMult = 1 + Math.sin(startTime * 6.2 + voiceIdx) * bank.tapeFlutter;
    const tunedFreq = freq * flutterMult;

    oscA.type = voiceIdx === 0 ? bank.baseWave : bank.subWave;
    oscB.type = bank.subWave;

    oscA.frequency.setValueAtTime(tunedFreq, startTime);
    oscB.frequency.setValueAtTime(tunedFreq, startTime);
    oscA.detune.setValueAtTime(-bank.detuneCents * 0.5, startTime);
    oscB.detune.setValueAtTime(bank.detuneCents, startTime);

    // Optional 2-Operator FM Metallic / Tine Modulator (e.g., Rhodes, Neo-Tokyo FM Bell, Shibuya Harp)
    let fmModOsc: OscillatorNode | null = null;
    let fmModGain: GainNode | null = null;
    if (bank.fmModDepth > 0 && voiceIdx === 0) {
      fmModOsc = this.ctx.createOscillator();
      fmModGain = this.ctx.createGain();
      fmModOsc.type = 'sine';
      fmModOsc.frequency.setValueAtTime(tunedFreq * bank.fmModRatio, startTime);
      fmModGain.gain.setValueAtTime(bank.fmModDepth, startTime);
      fmModGain.gain.exponentialRampToValueAtTime(0.5, startTime + bank.decaySec * 0.65);
      fmModOsc.connect(fmModGain);
      fmModGain.connect(oscA.frequency);
    }

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(bank.filterQ, startTime);
    const baseCutoff =
      flow >= FLOW_THRESHOLDS.OVERDRIVE
        ? 4200
        : flow >= FLOW_THRESHOLDS.CHORD
        ? 3100
        : flow >= FLOW_THRESHOLDS.HARMONIC
        ? 2300
        : 1750;
    const cutoff = Math.min(7500, Math.max(420, baseCutoff * bank.filterCutoffMult));
    filter.frequency.setValueAtTime(cutoff, startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(260, cutoff * 0.22),
      startTime + bank.decaySec
    );

    let baseVol = 0.21 * gainScale;
    if (totalVoices > 2) baseVol *= 0.76;
    if (voiceIdx === 0) baseVol *= cfg.volNotes;
    else if (voiceIdx === 1) baseVol *= cfg.volIntervals * 0.8;
    else baseVol *= cfg.volChords * 0.72;

    const subMixGain = this.ctx.createGain();
    subMixGain.gain.value = 0.42;

    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(Math.max(0.001, baseVol), startTime + bank.attackSec);
    g.gain.exponentialRampToValueAtTime(0.0008, startTime + bank.decaySec);

    oscA.connect(filter);
    oscB.connect(subMixGain);
    subMixGain.connect(filter);

    filter.connect(g);
    g.connect(this.masterGain);
    if (this.reverbNode) g.connect(this.reverbNode);
    if (flow >= FLOW_THRESHOLDS.CHORD && this.delayLeft && voiceIdx === 0) {
      g.connect(this.delayLeft);
    }

    const stopTime = startTime + bank.decaySec + 0.05;
    oscA.onended = () => {
      oscA.disconnect();
      oscB.disconnect();
      subMixGain.disconnect();
      filter.disconnect();
      g.disconnect();
      if (fmModOsc) fmModOsc.disconnect();
      if (fmModGain) fmModGain.disconnect();
    };

    if (fmModOsc) {
      fmModOsc.start(startTime);
      fmModOsc.stop(stopTime);
    }
    oscA.start(startTime);
    oscB.start(startTime);
    oscA.stop(stopTime);
    oscB.stop(stopTime);
  }

  /**
   * Schedules 3 melodic subdivision notes spaced at rhythmic intervals of the player's jump period,
   * and returns the array of 3 delay offsets (in seconds) so the renderer/simulation can emit
   * 3 synchronized concentric rings from the player!
   */
  private scheduleHalfIntervalSubdivision(
    extScale: number[],
    flow: number,
    cfg: GameConfig,
    baseTime: number,
    bank: SoundBankDef
  ): number[] {
    if (!this.ctx || !this.masterGain || extScale.length === 0) return [];

    // Always 3 notes so the 3 rhythmic player ring pulses lock 1:1 with the 3 subdivision notes
    const subCount = 3;
    const stepInterval = Math.max(
      0.13,
      Math.min(0.28, (this.avgJumpIntervalSec * 0.5) / 1.25)
    );

    const anchorIdx =
      this.lastExtendedIdx !== undefined ? this.lastExtendedIdx : Math.floor(extScale.length * 0.5);

    const contourPatterns = [
      [2, 4, 7],
      [-2, 3, 6],
      [3, 5, 8],
      [4, 7, 9],
      [-3, 2, 5],
    ];
    const pattern = contourPatterns[Math.floor(Math.random() * contourPatterns.length)];
    const delaysSec: number[] = [];

    for (let k = 0; k < subCount; k++) {
      const delayOffset = Number(((k + 1) * stepInterval).toFixed(3));
      delaysSec.push(delayOffset);
      const stepTime = baseTime + delayOffset;
      const targetIdx = Math.max(
        1,
        Math.min(extScale.length - 1, anchorIdx + pattern[k % pattern.length])
      );
      const subFreq = extScale[targetIdx];
      this.triggerVoiceAt(subFreq, stepTime, 0, 1, flow, cfg, 0.74, bank);
    }

    return delaysSec;
  }

  private playDeepBass(freq: number, cfg: GameConfig): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const subFreq = Math.max(52, Math.min(135, freq));
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(subFreq, t);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(230, t);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.24 * cfg.volBass, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.62);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      g.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.65);
  }

  /**
   * Context-Aware Progressive Background Synthesizer Pad:
   * - Active ONLY in 'STANDARD' gameplay mode (disabled in 'SEQUENCER' and 'MIDI').
   * - Inspects the currently played platform note (`harmonicContext.current`), the 2 previous platform
   *   notes (`harmonicContext.prevTwo`), and the 2 upcoming platform notes (`harmonicContext.nextTwo`),
   *   and selects the closest harmonic synth option via `computeContextualSynthHarmony`.
   */
  tickRhythmAndStems(
    gameTimeSec: number,
    flow: number,
    biome: ScaleBiome,
    cfg: GameConfig,
    isPlaying: boolean,
    mode: 'STANDARD' | 'SEQUENCER' | 'MIDI' = 'STANDARD',
    harmonicContext?: SynthHarmonicContext
  ): { beatPulse: number; step16: number } {
    const ambientPulse = Math.sin(gameTimeSec * 1.5) * 0.5 + 0.5;

    if (
      !isPlaying ||
      mode !== 'STANDARD' ||
      !this.ctx ||
      this.ctx.state !== 'running' ||
      !this.choirBus
    ) {
      return { beatPulse: ambientPulse, step16: 0 };
    }

    const t = this.ctx.currentTime;

    if (cfg.volChoir <= 0 || flow < FLOW_THRESHOLDS.HARMONIC) {
      this.choirBus.gain.setTargetAtTime(0.04, t, 0.35);
      return { beatPulse: ambientPulse, step16: 0 };
    }

    const flowIntensity = Math.max(
      0,
      Math.min(1, (flow - FLOW_THRESHOLDS.HARMONIC) / (FLOW_THRESHOLDS.OVERDRIVE - FLOW_THRESHOLDS.HARMONIC + 2))
    );

    const targetBusGain = 0.72 + flowIntensity * 0.78;
    this.choirBus.gain.setTargetAtTime(targetBusGain, t, 0.28);

    if (t >= this.nextPadSwellTime) {
      const noteDuration = 2.4 + flowIntensity * 3.1;
      this.nextPadSwellTime = t + Math.max(2.3, noteDuration * 0.76);

      const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
      const effectiveContext: SynthHarmonicContext = harmonicContext || {
        current: this.recentFreqHistory[this.recentFreqHistory.length - 1],
        prevTwo: this.recentFreqHistory.slice(-3, -1),
        nextTwo: [sc[2], sc[4]],
      };

      const notesToSwell = computeContextualSynthHarmony(
        sc,
        effectiveContext,
        this.lastSynthPadFreq,
        flow >= FLOW_THRESHOLDS.CHORD
      );
      this.lastSynthPadFreq = notesToSwell[0];

      notesToSwell.forEach((freq, idx) => {
        const baseVoiceGain =
          idx === 0
            ? 0.08 + flowIntensity * 0.085
            : 0.06 + flowIntensity * 0.065;
        this.triggerWarmPadSwell(freq, baseVoiceGain, cfg.volChoir, noteDuration, flowIntensity);
      });
    }

    return { beatPulse: ambientPulse, step16: 0 };
  }

  private triggerWarmPadSwell(
    freq: number,
    baseGain: number,
    choirVol: number,
    durationSec: number,
    flowIntensity: number
  ): void {
    if (!this.ctx || !this.choirBus) return;
    const t = this.ctx.currentTime;

    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    oscA.type = 'sine';
    oscB.type = flowIntensity > 0.65 ? 'sawtooth' : 'triangle';
    oscA.frequency.setValueAtTime(freq * 0.997, t);
    oscB.frequency.setValueAtTime(freq * 1.003, t);

    filter.type = 'lowpass';
    const startCutoff = 320 + flowIntensity * 220;
    const peakCutoff = 680 + flowIntensity * 880;
    filter.frequency.setValueAtTime(startCutoff, t);
    filter.frequency.linearRampToValueAtTime(peakCutoff, t + durationSec * 0.35);
    filter.frequency.exponentialRampToValueAtTime(260, t + durationSec);

    const peak = Math.min(0.28, baseGain * choirVol);
    const attackTime = Math.min(1.0, durationSec * 0.24);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attackTime);
    g.gain.exponentialRampToValueAtTime(0.0006, t + durationSec);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(g);
    g.connect(this.choirBus);

    oscA.onended = () => {
      oscA.disconnect();
      oscB.disconnect();
      filter.disconnect();
      g.disconnect();
    };

    oscA.start(t);
    oscB.start(t);
    oscA.stop(t + durationSec + 0.05);
    oscB.stop(t + durationSec + 0.05);
  }

  // --- HARMONICALLY TUNED BIOME-MATCHED SFX ---

  sfxJump(biome: ScaleBiome, cfg: GameConfig, isDouble = false): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
    const startFreq = isDouble ? sc[0] : sc[0] * 0.5;
    const endFreq = isDouble
      ? sc[Math.min(3, sc.length - 1)] * 2
      : sc[Math.min(2, sc.length - 1)];

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.11);
    g.gain.setValueAtTime(0.08 * cfg.volSfx, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.14);
  }

  sfxDash(biome: ScaleBiome, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
    const highHarmony = sc[Math.min(3, sc.length - 1)] * 3;
    const lowRoot = sc[0];

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 3.0;
      filter.frequency.setValueAtTime(highHarmony, t);
      filter.frequency.exponentialRampToValueAtTime(lowRoot, t + 0.18);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.14 * cfg.volSfx, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      noise.connect(filter);
      filter.connect(ng);
      ng.connect(this.masterGain);
      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        ng.disconnect();
      };
      noise.start(t);
      noise.stop(t + 0.21);
    }
  }

  sfxBouncePad(biome: ScaleBiome, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
    const liftNotes = [sc[0], sc[Math.min(4, sc.length - 1)]];
    liftNotes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const start = t + i * 0.045;
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.11 * cfg.volSfx, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
      osc.start(start);
      osc.stop(start + 0.34);
    });
  }

  sfxCrumble(biome: ScaleBiome, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(sc[0], t);
    osc.frequency.exponentialRampToValueAtTime(sc[0] * 0.5, t + 0.08);
    g.gain.setValueAtTime(0.1 * cfg.volSfx, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.1);
  }

  sfxOrbCollect(biome: ScaleBiome, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
    const chord = [sc[0] * 2, sc[Math.min(4, sc.length - 1)] * 2];
    chord.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const st = t + idx * 0.04;
      osc.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(0.1 * cfg.volSfx, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.36);
      osc.connect(g);
      g.connect(this.masterGain);
      if (this.reverbNode) g.connect(this.reverbNode);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
      osc.start(st);
      osc.stop(st + 0.38);
    });
  }

  sfxLevelUp(biome: ScaleBiome, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
    const fanfare = [sc[0], sc[Math.min(2, sc.length - 1)], sc[0] * 2];
    fanfare.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const st = t + idx * 0.06;
      osc.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(0.11 * cfg.volSfx, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.55);
      osc.connect(g);
      g.connect(this.masterGain);
      if (this.reverbNode) g.connect(this.reverbNode);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
      osc.start(st);
      osc.stop(st + 0.58);
    });
  }

  sfxShieldBreak(biome: ScaleBiome, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
    const notes = [sc[Math.min(3, sc.length - 1)], sc[0]];
    notes.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const st = t + idx * 0.05;
      osc.frequency.setValueAtTime(f, st);
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, st + 0.2);
      g.gain.setValueAtTime(0.12 * cfg.volSfx, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
      osc.start(st);
      osc.stop(st + 0.24);
    });
  }

  sfxHazardDamage(biome: ScaleBiome, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
    const notes = [sc[Math.min(1, sc.length - 1)], sc[0] * 0.5];
    notes.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      const st = t + idx * 0.04;
      osc.frequency.setValueAtTime(f, st);
      osc.frequency.exponentialRampToValueAtTime(f * 0.65, st + 0.16);
      g.gain.setValueAtTime(0.1 * cfg.volSfx, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
      osc.start(st);
      osc.stop(st + 0.2);
    });
  }

  sfxComboLost(biome: ScaleBiome, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(sc[0], t);
    osc.frequency.exponentialRampToValueAtTime(sc[0] * 0.25, t + 0.42);
    g.gain.setValueAtTime(0.14 * cfg.volSfx, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.48);
  }

  sfxUiClick(biome: ScaleBiome, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(sc[0] * 2, t);
    osc.frequency.exponentialRampToValueAtTime(
      sc[Math.min(3, sc.length - 1)] * 2,
      t + 0.045
    );
    g.gain.setValueAtTime(0.09 * cfg.volSfx, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.06);
  }

  sfxPlayerShatter(biome: ScaleBiome, cfg: GameConfig): void {
    this.init(cfg);
    if (!this.ctx || !this.masterGain || cfg.volSfx <= 0) return;
    const t = this.ctx.currentTime;
    const sc = biome.scale.length ? biome.scale : MASTER_SCALES[0].scale;

    // 1. Sub-impact boom
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(34, t + 0.42);
    subGain.gain.setValueAtTime(0.24 * cfg.volSfx, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.onended = () => {
      subOsc.disconnect();
      subGain.disconnect();
    };
    subOsc.start(t);
    subOsc.stop(t + 0.46);

    // 2. Sparkling pixel glitter chime cascade
    const sparkleNotes = [sc[0] * 4, sc[2] * 4, sc[4] * 3, sc[1] * 4, sc[0] * 2];
    sparkleNotes.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      const st = t + idx * 0.045;
      osc.frequency.setValueAtTime(f, st);
      osc.frequency.exponentialRampToValueAtTime(f * 0.65, st + 0.18);
      g.gain.setValueAtTime(0.08 * cfg.volSfx, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
      osc.connect(g);
      g.connect(this.masterGain);
      if (this.reverbNode) g.connect(this.reverbNode);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
      osc.start(st);
      osc.stop(st + 0.24);
    });
  }
}

function flowForGate(gateIdx: number): number {
  return FLOW_THRESHOLDS.CHORD + gateIdx * 2;
}

export async function parseMidiBuffer(arrayBuffer: ArrayBuffer): Promise<number[][]> {
  const win = window as unknown as {
    Midi?: new (buf: ArrayBuffer) => {
      tracks: Array<{ notes: Array<{ time: number; midi: number }> }>;
    };
  };

  if (win.Midi) {
    const m = new win.Midi(arrayBuffer);
    const tm = new Map<number, number[]>();
    m.tracks.forEach((t) => {
      t.notes.forEach((n) => {
        const q = Math.floor(n.time * 15);
        if (!tm.has(q)) tm.set(q, []);
        tm.get(q)!.push(440 * Math.pow(2, (n.midi - 69) / 12));
      });
    });
    const keys = Array.from(tm.keys()).sort((a, b) => a - b);
    const out = keys.map((k) => tm.get(k)!.slice(0, 4));
    if (out.length > 0) return out;
  }

  const bytes = new Uint8Array(arrayBuffer);
  const clusters: number[][] = [];
  let currentCluster: number[] = [];
  for (let i = 0; i < bytes.length - 2; i++) {
    const status = bytes[i];
    if ((status & 0xf0) === 0x90) {
      const note = bytes[i + 1];
      const vel = bytes[i + 2];
      if (note >= 24 && note <= 108 && vel > 0 && vel < 128) {
        const freq = 440 * Math.pow(2, (note - 69) / 12);
        currentCluster.push(freq);
        if (currentCluster.length >= 2) {
          clusters.push(currentCluster);
          currentCluster = [];
        }
        i += 2;
      }
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);
  return clusters.length > 0 ? clusters : [[261.63], [329.63], [392.0], [523.25]];
}
