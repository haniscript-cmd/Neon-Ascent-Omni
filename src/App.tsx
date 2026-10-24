import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  DEFAULT_CFG,
  DEFAULT_FINE_TUNE,
  FineTuneConfig,
  GameConfig,
  FLOW_THRESHOLDS,
  FLOW_PLATFORMS_PER_STEP,
  BIOME_ALTITUDE_SPAN,
  MASTER_SCALES,
  SOUND_BANKS,
  SoundBankDef,
  NOTES_MAP,
  SEQUENCER_PRESETS,
  RUN_UPGRADES,
  ActivePowerUp,
  ScaleBiome,
  PlatformEntity,
  PlatformArchetype,
  AerialHazardEntity,
  HarmonicOrb,
  ParticlePool,
  computeFlowDynamicDifficulty,
  computeBpmLockedKinematics,
  computeNoteDurationKinematics,
  computeScatteredPlatformPlacement,
  getPlatformThemeColor,
  getFlowMilestoneInfo,
  tickActivePowerUps,
  calculateStyleRank,
  stepSquashStretch,
  shuffleArray,
  pickBiomeChordProgression,
} from './game/rules';
import { OmniAudioEngine } from './game/audioEngine';
import {
  renderGameFrame,
  FloatingTextItem,
  PlayerRenderState,
  BiomeDissolveState,
  ChordComboHudState,
  DyingSequenceState,
  GlitterParticle,
} from './game/renderer';
import {
  CHARACTER_AVATARS,
  CharacterAvatarDef,
  getCharacterById,
  STARTER_UNLOCKED_AVATARS,
} from './game/characters';
import {
  CustomStage,
  DEFAULT_BUILT_IN_STAGES,
  compileStageForGameplay,
  parseMidiBufferToStage,
} from './game/stages';
import CharacterSelectModal, {
  SelectedAvatarMiniBadge,
} from './components/CharacterSelectModal';
import StageCreatorModal from './components/StageCreatorModal';

type ScreenState =
  | 'title'
  | 'playing'
  | 'paused'
  | 'gameover'
  | 'sequencer'
  | 'settings'
  | 'store'
  | 'characters'
  | 'stage_creator';

type GameMode = 'STANDARD' | 'SEQUENCER' | 'MIDI' | 'STAGE';

interface PersistentStats {
  highScore: number;
  maxCombo: number;
  totalOrbs: number;
  runsPlayed: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const NOTE_KEYS = Object.keys(NOTES_MAP);
const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV'] as const;

const FINE_TUNE_SLIDERS: Array<{
  key: keyof FineTuneConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  desc: string;
}> = [
  {
    key: 'flowGainRate',
    label: 'Flow Gain Rate',
    min: 0.2,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Speed at which climbing platforms increases Flow',
  },
  {
    key: 'flowDecayRate',
    label: 'Idle / Stall Flow Decay',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Penalty speed when stalling or waiting on one platform',
  },
  {
    key: 'difficultyRampSpeed',
    label: 'Difficulty Ramp Speed',
    min: 0.2,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'How quickly higher Flow narrows platforms and adds obstacles',
  },
  {
    key: 'maxPlatformWidth',
    label: 'Low-Flow Max Platform Width',
    min: 110,
    max: 240,
    step: 4,
    unit: 'px',
    desc: 'Starting platform width at Flow x0',
  },
  {
    key: 'minPlatformWidth',
    label: 'High-Flow Min Platform Width',
    min: 48,
    max: 150,
    step: 4,
    unit: 'px',
    desc: 'Narrowest platform width at peak Flow',
  },
  {
    key: 'horizontalScatterMult',
    label: 'Horizontal Scatter Spread',
    min: 0.3,
    max: 2.2,
    step: 0.1,
    unit: 'x',
    desc: 'Horizontal zig-zag distance between consecutive platforms',
  },
  {
    key: 'wideLeapSpawnRate',
    label: 'Wide Opposite-Direction Leap Rate',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Frequency of maximum-distance opposite-side platform leaps as Flow rises',
  },
  {
    key: 'orbSpawnRate',
    label: 'Harmonic Orb Spawn Chance',
    min: 0.0,
    max: 1.0,
    step: 0.05,
    unit: '',
    desc: 'Probability of spawning a collectible Orb per platform',
  },
  {
    key: 'orbScatterSpread',
    label: 'Orb Horizontal Offset Spread',
    min: 0.1,
    max: 1.0,
    step: 0.05,
    unit: '',
    desc: 'How far across the platform Orbs scatter horizontally',
  },
  {
    key: 'spikeHazardRate',
    label: 'Platform Spike Hazard Rate',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Multiplier for on-platform red spike frequency',
  },
  {
    key: 'aerialDroneRate',
    label: 'Aerial Drone Hazard Rate',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Multiplier for mid-air patrolling Dissonance Drones',
  },
  {
    key: 'hazardFlowPenalty',
    label: 'Hazard Flow Penalty',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
    desc: 'Flow lost when hitting spikes or aerial drones without shield',
  },
  {
    key: 'powerUpDurationSec',
    label: 'Base Power-Up Duration',
    min: 4,
    max: 35,
    step: 1,
    unit: 's',
    desc: 'Duration in seconds before temporary power-ups expire',
  },
  {
    key: 'chordGateCooldownSteps',
    label: 'Chord Gate Cooldown Steps',
    min: 4,
    max: 40,
    step: 1,
    unit: ' steps',
    desc: 'Platforms between 4-Gate Chord Progression sequences',
  },
  {
    key: 'baseMoveSpeed',
    label: 'Lateral Steering Speed',
    min: 180,
    max: 520,
    step: 10,
    unit: ' px/s',
    desc: 'Constant horizontal movement speed',
  },
  {
    key: 'baseJumpTempo',
    label: 'Base Jump Tempo (Gravity)',
    min: 65,
    max: 150,
    step: 5,
    unit: ' BPM',
    desc: 'Baseline auto-bounce arc tempo in Standard mode',
  },
];

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<OmniAudioEngine>(new OmniAudioEngine());

  // High-frequency HUD DOM refs
  const scoreDomRef = useRef<HTMLDivElement | null>(null);
  const altDomRef = useRef<HTMLSpanElement | null>(null);
  const orbsDomRef = useRef<HTMLSpanElement | null>(null);
  const comboTextDomRef = useRef<HTMLSpanElement | null>(null);
  const milestoneDomRef = useRef<HTMLSpanElement | null>(null);
  const comboBarDomRef = useRef<HTMLDivElement | null>(null);
  const rankBadgeDomRef = useRef<HTMLDivElement | null>(null);
  const biomeTagDomRef = useRef<HTMLDivElement | null>(null);

  const [screen, setScreen] = useState<ScreenState>('title');
  const [storeTab, setStoreTab] = useState<'banks' | 'scales' | 'characters'>('banks');
  const [traditionFilter, setTraditionFilter] = useState<string>('ALL');
  const [gameMode, setGameMode] = useState<GameMode>('STANDARD');
  const [storeOrbInput, setStoreOrbInput] = useState<string>('');
  const [devBundleStatus, setDevBundleStatus] = useState<string>('');
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const [cfg, setCfg] = useState<GameConfig>(() => {
    try {
      const saved = localStorage.getItem('omni_cfg_v8');
      if (saved) {
        const parsed = JSON.parse(saved);
        const validAvatar = CHARACTER_AVATARS.some((a) => a.id === parsed.playerShape)
          ? parsed.playerShape
          : DEFAULT_CFG.playerShape;
        const unlockedAvatars = Array.from(
          new Set([...STARTER_UNLOCKED_AVATARS, ...(parsed.unlockedAvatars || [])])
        );
        return {
          ...DEFAULT_CFG,
          ...parsed,
          playerShape: validAvatar,
          unlockedAvatars,
          fineTune: {
            ...DEFAULT_FINE_TUNE,
            ...(parsed.fineTune || {}),
          },
          unlockedScales: parsed.unlockedScales?.length
            ? parsed.unlockedScales
            : DEFAULT_CFG.unlockedScales,
          enabledScales: parsed.enabledScales?.length
            ? parsed.enabledScales
            : DEFAULT_CFG.enabledScales,
          unlockedSoundBanks: parsed.unlockedSoundBanks?.length
            ? parsed.unlockedSoundBanks
            : DEFAULT_CFG.unlockedSoundBanks,
          enabledSoundBanks: parsed.enabledSoundBanks?.length
            ? parsed.enabledSoundBanks
            : DEFAULT_CFG.enabledSoundBanks,
        };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_CFG, fineTune: { ...DEFAULT_FINE_TUNE } };
  });

  const [customStages, setCustomStages] = useState<CustomStage[]>(() => {
    try {
      const saved = localStorage.getItem('omni_stages_v1');
      if (saved) {
        const parsed: CustomStage[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((s) => s.id));
          const missingDefaults = DEFAULT_BUILT_IN_STAGES.filter((d) => !existingIds.has(d.id));
          return [...parsed, ...missingDefaults];
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_BUILT_IN_STAGES;
  });

  const [activeStageId, setActiveStageId] = useState<string>(
    () => DEFAULT_BUILT_IN_STAGES[0]?.id || 'stage_neon_prelude'
  );

  const [stats, setStats] = useState<PersistentStats>(() => {
    try {
      const saved = localStorage.getItem('omni_stats_v4');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return { highScore: 0, maxCombo: 0, totalOrbs: 60, runsPlayed: 0 };
  });

  const [isMuted, setIsMuted] = useState(false);
  const [midiStatus, setMidiStatus] = useState<string>('');
  const [endSnapshot, setEndSnapshot] = useState<{
    score: number;
    best: number;
    isNewRecord: boolean;
    maxFlow: number;
    altitude: number;
    orbsCollected: number;
    rank: string;
  }>({
    score: 0,
    best: 0,
    isNewRecord: false,
    maxFlow: 0,
    altitude: 0,
    orbsCollected: 0,
    rank: 'D',
  });

  const [seqGrid, setSeqGrid] = useState<string[][]>(() => {
    const initial: string[][] = Array.from({ length: 16 }, () => []);
    const defaultNotes = [
      'C4', 'D4', 'G4', 'C5', 'G4', 'D4', 'F4', 'A4',
      'C4', 'D4', 'G4', 'C5', 'A4', 'G4', 'F4', 'D4',
    ];
    defaultNotes.forEach((n, idx) => {
      initial[idx] = [n];
    });
    return initial;
  });
  const [activePreset, setActivePreset] = useState<string>('cyber_arp');

  const pointerEyeRef = useRef<{ x: number; y: number; activeUntil: number }>({
    x: 300,
    y: 400,
    activeUntil: 0,
  });

  const simRef = useRef<{
    state: ScreenState;
    mode: GameMode;
    cfg: GameConfig;
    isMuted: boolean;
    score: number;
    maxFlowThisRun: number;
    orbsThisRun: number;
    flowEnergy: number;
    combo: number;
    flowSubSteps: number;
    timeSinceLastClimb: number;
    highestPlatformY: number;
    styleMeter: number;
    camY: number;
    viewH: number;
    gameTime: number;
    hitstop: number;
    shake: number;
    aberration: number;
    activeBiomeIdx: number;
    biomeOrder: number[];
    activeSoundBankId: string;
    biomeDissolve: BiomeDissolveState;
    dyingSequence: DyingSequenceState;
    seqData: number[][];
    seqIdx: number;
    activeStage?: CustomStage;
    stageStepCursor: number;
    nextStagePlatformDurRatio: number;
    activeJumpGravity: number;
    shieldRegenTimer: number;
    activePowerUps: ActivePowerUp[];
    pendingRhythmRings: Array<{ triggerAt: number; color: string; maxR: number }>;
    activeChordChainTargetId?: number;
    chordComboHud: ChordComboHudState;
    recentPlayedPlatformNotes: number[];
    chordGatePlan: {
      nextGateStepIndex: number;
      nextGateChordIdx: 0 | 1 | 2 | 3;
      progressionVariant: number;
      prevGatePlatId?: number;
      cooldownSteps: number;
    };
    platformsGeneratedCount: number;
    player: PlayerRenderState & {
      airJumpsLeft: number;
    };
    inputs: {
      left: boolean;
      right: boolean;
      tiltX: number;
      upJustPressed: boolean;
      dashJustPressed: boolean;
    };
    platforms: PlatformEntity[];
    aerialHazards: AerialHazardEntity[];
    orbs: HarmonicOrb[];
    particles: ParticlePool;
    texts: FloatingTextItem[];
    shockwaves: Array<{ x: number; y: number; r: number; maxR: number; color: string; alpha: number }>;
    nextPlatformId: number;
  }>({
    state: 'title',
    mode: 'STANDARD',
    cfg: DEFAULT_CFG,
    isMuted: false,
    score: 0,
    maxFlowThisRun: 0,
    orbsThisRun: 0,
    flowEnergy: 0,
    combo: 0,
    flowSubSteps: 0,
    timeSinceLastClimb: 0,
    highestPlatformY: 782,
    styleMeter: 0,
    camY: 0,
    viewH: 800,
    gameTime: 0,
    hitstop: 0,
    shake: 0,
    aberration: 0,
    activeBiomeIdx: 0,
    biomeOrder: [0, 1, 2, 6],
    activeSoundBankId: 'crt_velvet',
    biomeDissolve: {
      active: false,
      progress: 1,
      fromBiome: MASTER_SCALES[0],
      toBiome: MASTER_SCALES[0],
    },
    dyingSequence: {
      active: false,
      phase: 'none',
      timer: 0,
      dissolveProgress: 0,
      glitters: [],
    },
    seqData: SEQUENCER_PRESETS.cyber_arp.steps,
    seqIdx: 0,
    activeStage: undefined,
    stageStepCursor: 0,
    nextStagePlatformDurRatio: 1.0,
    activeJumpGravity: 1472,
    shieldRegenTimer: 0,
    activePowerUps: [],
    pendingRhythmRings: [],
    activeChordChainTargetId: undefined,
    chordComboHud: {
      active: false,
      completedCount: 0,
      chordNames: MASTER_SCALES[0].chordNames,
      completionFlashTimer: 0,
    },
    recentPlayedPlatformNotes: [],
    chordGatePlan: {
      nextGateStepIndex: -1,
      nextGateChordIdx: 0,
      progressionVariant: 0,
      prevGatePlatId: undefined,
      cooldownSteps: 12,
    },
    platformsGeneratedCount: 0,
    player: {
      x: 288,
      y: 740,
      w: 24,
      h: 24,
      vx: 0,
      vy: 0,
      grounded: false,
      wallSlideDir: 0,
      scaleX: 1,
      scaleY: 1,
      facing: 1,
      eyeLookX: 0,
      eyeLookY: -0.2,
      impactSquashTimer: 0,
      dashCool: 0,
      dashMaxCool: 2.0,
      dashAct: 0,
      hasShield: false,
      doubleJumpReady: false,
      damageGlitchTimer: 0,
      airJumpsLeft: 0,
      trail: [],
      scarfNodes: Array.from({ length: 6 }, () => ({ x: 300, y: 750 })),
    },
    inputs: {
      left: false,
      right: false,
      tiltX: 0,
      upJustPressed: false,
      dashJustPressed: false,
    },
    platforms: [],
    aerialHazards: [],
    orbs: [],
    particles: new ParticlePool(320),
    texts: Array.from({ length: 12 }, () => ({
      active: false,
      text: '',
      x: 0,
      y: 0,
      vy: -1.0,
      life: 0,
      maxLife: 1,
      color: '#ffffff',
      scale: 1,
    })),
    shockwaves: [],
    nextPlatformId: 1,
  });

  useEffect(() => {
    (window as unknown as { __NEON_ASCENT_SIM__?: typeof simRef.current }).__NEON_ASCENT_SIM__ =
      simRef.current;
  }, []);

  useEffect(() => {
    const bodyState =
      screen === 'playing'
        ? 'playing'
        : screen === 'paused'
        ? 'paused'
        : screen === 'gameover'
        ? 'gameover'
        : 'title';
    document.body.dataset.state = bodyState;
    simRef.current.state = screen;
  }, [screen]);

  useEffect(() => {
    simRef.current.cfg = cfg;
    try {
      localStorage.setItem('omni_cfg_v8', JSON.stringify(cfg));
    } catch {
      // ignore
    }
  }, [cfg]);

  useEffect(() => {
    try {
      localStorage.setItem('omni_stages_v1', JSON.stringify(customStages));
    } catch {
      // ignore
    }
  }, [customStages]);

  useEffect(() => {
    try {
      localStorage.setItem('omni_stats_v4', JSON.stringify(stats));
    } catch {
      // ignore
    }
  }, [stats]);

  useEffect(() => {
    simRef.current.isMuted = isMuted;
    if (audioRef.current.masterGain && audioRef.current.ctx) {
      const t = audioRef.current.ctx.currentTime;
      audioRef.current.masterGain.gain.cancelScheduledValues(t);
      audioRef.current.masterGain.gain.setTargetAtTime(
        isMuted ? 0 : Math.min(0.92, cfg.volMaster * 0.92),
        t,
        0.05
      );
    }
  }, [isMuted, cfg.volMaster]);

  // Dynamic 1:1 Square-Pixel Canvas Height Matching (eliminates vertical stretching on tall phones)
  useEffect(() => {
    const syncViewportAspect = () => {
      const el = containerRef.current;
      const cvs = canvasRef.current;
      if (!el || !cvs) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const nextViewH = Math.max(
        640,
        Math.min(1600, Math.round(600 * (rect.height / rect.width)))
      );
      if (cvs.height !== nextViewH) {
        cvs.height = nextViewH;
      }
      const sim = simRef.current;
      const prevViewH = sim.viewH || 800;
      if (prevViewH !== nextViewH) {
        sim.viewH = nextViewH;
        if (sim.state !== 'playing') {
          sim.camY = 800 - nextViewH;
        } else {
          sim.camY += prevViewH - nextViewH;
        }
      }
    };

    syncViewportAspect();
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncViewportAspect())
        : null;
    if (ro && containerRef.current) {
      ro.observe(containerRef.current);
    }
    window.addEventListener('resize', syncViewportAspect);
    window.addEventListener('orientationchange', syncViewportAspect);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', syncViewportAspect);
      window.removeEventListener('orientationchange', syncViewportAspect);
    };
  }, []);

  const getScaleByIndex = useCallback((idx: number, currentCfg: GameConfig): ScaleBiome => {
    const order = simRef.current.biomeOrder;
    const pool =
      order && order.length > 0
        ? order
        : currentCfg.enabledScales.length
        ? currentCfg.enabledScales
        : [0];
    const safeIdx = Math.abs(Math.floor(idx)) % pool.length;
    const id = pool[safeIdx];
    return MASTER_SCALES.find((s) => s.id === id) || MASTER_SCALES[0];
  }, []);

  const getActiveSoundBank = useCallback((currentCfg: GameConfig): SoundBankDef => {
    if (simRef.current.mode === 'STAGE' && simRef.current.activeStage) {
      const matchedStageBank = SOUND_BANKS.find(
        (b) => b.id === simRef.current.activeStage?.soundBankId
      );
      if (matchedStageBank) return matchedStageBank;
    }
    const activeId = simRef.current.activeSoundBankId;
    const matched = SOUND_BANKS.find((b) => b.id === activeId);
    if (matched) return matched;
    const enabledId = currentCfg.enabledSoundBanks[0] || 'crt_velvet';
    return SOUND_BANKS.find((b) => b.id === enabledId) || SOUND_BANKS[0];
  }, []);

  const pickRandomEnabledSoundBankId = useCallback(
    (currentCfg: GameConfig, avoidId?: string): string => {
      const pool = currentCfg.enabledSoundBanks.length
        ? currentCfg.enabledSoundBanks
        : ['crt_velvet'];
      if (pool.length === 1) return pool[0];
      const filtered = avoidId ? pool.filter((id) => id !== avoidId) : pool;
      const candidates = filtered.length > 0 ? filtered : pool;
      return candidates[Math.floor(Math.random() * candidates.length)];
    },
    []
  );

  const spawnFloatingText = useCallback(
    (text: string, x: number, y: number, color: string, scale = 1.0, subtext?: string) => {
      const list = simRef.current.texts;
      for (let i = 0; i < list.length; i++) {
        list[i].active = false;
      }
      const item = list[0];
      item.active = true;
      item.text = text;
      item.subtext = subtext;
      item.x = Math.max(110, Math.min(490, x));
      item.y = y;
      item.vy = -0.9;
      item.life = 0.85;
      item.maxLife = 0.85;
      item.color = color;
      item.scale = scale;
    },
    []
  );

  const spawnShockwave = useCallback((x: number, y: number, color: string, maxR = 75) => {
    const list = simRef.current.shockwaves;
    list.push({ x, y, r: 8, maxR, color, alpha: 0.78 });
    if (list.length > 10) {
      list.shift();
    }
  }, []);

  const syncFlowStateFromEnergy = (sim: typeof simRef.current) => {
    sim.flowEnergy = Math.max(0, Math.min(45, sim.flowEnergy));
    sim.combo = Math.floor(sim.flowEnergy);
    sim.flowSubSteps = Math.round((sim.flowEnergy - sim.combo) * FLOW_PLATFORMS_PER_STEP);
  };

  const downgradeRemainingChordGates = (sim: typeof simRef.current, color = '#fb7185') => {
    let anyDowngraded = false;
    for (let i = 0; i < sim.platforms.length; i++) {
      const pl = sim.platforms[i];
      if (pl.type === 'chord_gate' && !pl.hit) {
        anyDowngraded = true;
        pl.type = 'normal';
        pl.chordGateIndex = undefined;
        pl.chordProgressionVariant = undefined;
        pl.chordNameOverride = undefined;
        pl.nextGateId = undefined;
        pl.nextGateX = undefined;
        pl.nextGateY = undefined;
        sim.particles.burst(pl.x + pl.w * 0.5, pl.y, color, 6, 3.5, 'dust');
      }
    }
    sim.activeChordChainTargetId = undefined;
    sim.chordComboHud.active = false;
    sim.chordComboHud.completedCount = 0;
    sim.chordComboHud.completionFlashTimer = 0;
    if (anyDowngraded || sim.chordGatePlan.nextGateStepIndex >= 0) {
      sim.chordGatePlan = {
        nextGateStepIndex: -1,
        nextGateChordIdx: 0,
        progressionVariant: Math.floor(Math.random() * 4),
        prevGatePlatId: undefined,
        cooldownSteps: Math.max(4, Math.round(sim.cfg.fineTune?.chordGateCooldownSteps ?? 16)),
      };
    }
  };

  const grantTemporaryPowerUp = useCallback(
    (biome: ScaleBiome, reasonLabel: string, forcedId?: ActivePowerUp['id']) => {
      const sim = simRef.current;
      if (sim.activePowerUps.length >= 3) return;

      const available = RUN_UPGRADES.filter(
        (u) => !sim.activePowerUps.some((active) => active.id === u.id)
      );
      if (available.length === 0) return;

      const picked =
        (forcedId && available.find((u) => u.id === forcedId)) ||
        available[Math.floor(Math.random() * available.length)];

      const charPerks = getCharacterById(sim.cfg.playerShape).perks;
      const baseDurMult = (sim.cfg.fineTune?.powerUpDurationSec ?? 14) / 14;
      const finalDurationSec = Math.max(
        4,
        Math.round(picked.durationSec * baseDurMult * charPerks.powerUpDurationMultiplier * 10) / 10
      );

      sim.activePowerUps.push({
        id: picked.id,
        name: picked.name,
        icon: picked.icon,
        remainingSec: finalDurationSec,
        durationSec: finalDurationSec,
      });

      if (picked.id === 'combo_shield') {
        sim.player.hasShield = true;
      }
      if (picked.id === 'double_jump') {
        sim.player.airJumpsLeft = 1;
      }
      if (!sim.isMuted) {
        audioRef.current.sfxLevelUp(biome, sim.cfg);
      }
      spawnShockwave(sim.player.x + 12, sim.player.y + 12, biome.fg, 95);
      spawnFloatingText(
        `${picked.icon} ${picked.name}`,
        300,
        sim.player.y - 32,
        biome.horizonColor,
        1.0,
        reasonLabel
      );
    },
    [spawnFloatingText, spawnShockwave]
  );

  /**
   * Generates strictly ONE clean platform per vertical step.
   * Uses `exactVerticalStep = isStageMode` and `fine.wideLeapSpawnRate` so:
   * 1. Long stage notes never skip or overshoot platforms.
   * 2. Wide opposite-direction platform leaps spawn more frequently as Flow increases.
   */
  const generateWorldUpTo = useCallback(
    (minY: number) => {
      const sim = simRef.current;
      const currentCfg = sim.cfg;
      const fine = currentCfg.fineTune || DEFAULT_FINE_TUNE;
      const charPerks = getCharacterById(currentCfg.playerShape).perks;

      let lastPlat =
        sim.platforms.length > 0
          ? sim.platforms[sim.platforms.length - 1]
          : {
              id: 1,
              x: 200,
              y: 782,
              w: 176,
              targetW: 176,
              centerX: 288,
              type: 'normal' as PlatformArchetype,
            };
      let lastY = lastPlat.y;
      let prevCenterX = lastPlat.centerX ?? lastPlat.x + lastPlat.w * 0.5;
      let prevType: PlatformArchetype = lastPlat.type || 'normal';

      const isStageMode = sim.mode === 'STAGE' && sim.activeStage !== undefined;
      const compiledStageSteps =
        isStageMode && sim.activeStage
          ? compileStageForGameplay(sim.activeStage, sim.combo)
          : [];

      while (lastY > minY - Math.max(420, sim.viewH * 0.55)) {
        const diff = computeFlowDynamicDifficulty(sim.flowEnergy, fine);
        sim.platformsGeneratedCount++;

        if (
          !isStageMode &&
          sim.chordGatePlan.nextGateStepIndex < 0 &&
          sim.combo >= FLOW_THRESHOLDS.SUBDIVISION
        ) {
          if (sim.chordGatePlan.cooldownSteps > 0) {
            sim.chordGatePlan.cooldownSteps--;
          } else {
            sim.chordGatePlan.nextGateStepIndex = sim.platformsGeneratedCount + 2;
            sim.chordGatePlan.nextGateChordIdx = 0;
            sim.chordGatePlan.progressionVariant = Math.floor(Math.random() * 4);
            sim.chordGatePlan.prevGatePlatId = undefined;
          }
        }

        const isChordGateStep =
          !isStageMode &&
          sim.chordGatePlan.nextGateStepIndex === sim.platformsGeneratedCount;

        const widthJitter = isChordGateStep ? 1.08 : 0.92 + Math.random() * 0.16;
        const w = Math.max(
          52,
          Math.round((diff.targetPlatformWidth + charPerks.platformWidthBonusPx) * widthJitter)
        );

        let stepYForThisGap = diff.stepY;
        let stageStepData = undefined;
        let stageNoteKin = undefined;

        if (isStageMode && sim.activeStage && compiledStageSteps.length > 0) {
          const prevDurKin = computeNoteDurationKinematics(
            sim.activeStage.bpm,
            sim.nextStagePlatformDurRatio || 1.0
          );
          stepYForThisGap = prevDurKin.stepY;

          stageStepData =
            compiledStageSteps[sim.stageStepCursor % compiledStageSteps.length];
          sim.stageStepCursor++;
          stageNoteKin = computeNoteDurationKinematics(
            sim.activeStage.bpm,
            stageStepData.durationBeats
          );
          sim.nextStagePlatformDurRatio = stageNoteKin.beatDurationRatio;
        }

        const placed = computeScatteredPlatformPlacement(
          prevCenterX,
          lastY,
          stepYForThisGap,
          w,
          sim.flowEnergy,
          sim.nextPlatformId,
          fine,
          isStageMode
        );
        const x = placed.x;
        lastY = placed.y;
        prevCenterX = placed.centerX;

        const altitudePx = Math.abs(lastY - 782);
        const themeIdx = Math.floor(altitudePx / BIOME_ALTITUDE_SPAN);
        const biome =
          stageStepData?.biomeId !== undefined
            ? MASTER_SCALES.find((b) => b.id === stageStepData.biomeId) ||
              getScaleByIndex(themeIdx, currentCfg)
            : getScaleByIndex(themeIdx, currentCfg);

        let type: PlatformArchetype = 'normal';
        let chordGateIndex: 0 | 1 | 2 | 3 | undefined = undefined;
        let chordProgressionVariant: number | undefined = undefined;
        let chordNameOverride: string | undefined = undefined;

        if (isChordGateStep) {
          type = 'chord_gate';
          chordGateIndex = sim.chordGatePlan.nextGateChordIdx;
          chordProgressionVariant = sim.chordGatePlan.progressionVariant;
          const prog = pickBiomeChordProgression(biome, chordProgressionVariant);
          chordNameOverride = prog.chordNames[chordGateIndex];
        } else if (!isStageMode) {
          const roll = Math.random();
          if (roll < diff.movingPlatformChance) {
            type = 'moving';
          } else if (altitudePx > 450 && roll < diff.movingPlatformChance + 0.09) {
            type = 'bounce';
          } else if (
            altitudePx > 900 &&
            prevType !== 'crumble' &&
            prevType !== 'phase' &&
            roll < diff.movingPlatformChance + 0.16
          ) {
            type = 'crumble';
          } else if (
            altitudePx > 1400 &&
            prevType !== 'phase' &&
            prevType !== 'crumble' &&
            roll < diff.movingPlatformChance + 0.21
          ) {
            type = 'phase';
          }
        } else {
          const roll = Math.random();
          if (roll < diff.movingPlatformChance * 0.65) {
            type = 'moving';
          }
        }
        prevType = type;

        const noteScaleIdx = Math.floor(
          (sim.nextPlatformId * 3 + Math.floor(x / 50)) % Math.max(1, biome.noteNames.length)
        );
        const noteName =
          stageStepData?.label || biome.noteNames[noteScaleIdx] || 'C4';
        const noteFreq =
          stageStepData?.freqs?.[0] ||
          biome.scale[noteScaleIdx % Math.max(1, biome.scale.length)] ||
          261.63;

        const hasHazard =
          type === 'normal' &&
          w >= 104 &&
          altitudePx > 1100 &&
          Math.random() < diff.platformHazardChance;

        const platId = sim.nextPlatformId++;
        const plat: PlatformEntity = {
          id: platId,
          x,
          y: lastY,
          w,
          targetW: w,
          centerX: prevCenterX,
          h: 14,
          type,
          vx: type === 'moving' ? (Math.random() > 0.5 ? 1.15 : -1.15) : 0,
          vy: 0,
          minX: Math.max(18, x - 70),
          maxX: Math.min(582 - w, x + 70),
          hit: false,
          repeatBounces: 0,
          themeIdx,
          noteLabel: noteName,
          noteFreq,
          crumbleTimer: 0,
          broken: false,
          respawnTimer: 0,
          phaseSolid: true,
          hasHazard,
          hazardXOffset: hasHazard ? Math.round(w * 0.38) : 0,
          hazardWidth: hasHazard ? 20 : 0,
          chordGateIndex,
          chordProgressionVariant,
          chordNameOverride,
          beatDurationRatio: stageNoteKin?.beatDurationRatio,
          customStepY: stageNoteKin?.stepY,
          customJumpVelocityPxPerSec: stageNoteKin?.jumpVelocityPxPerSec,
          customGravityPxPerSec2: stageNoteKin?.gravityPxPerSec2,
          customClusterFreqs: stageStepData?.freqs,
          customSynthFreqs: stageStepData?.synthFreqs,
          customSynthDurationSec: stageStepData
            ? stageStepData.synthDurationBeats * (60 / Math.max(60, sim.activeStage?.bpm || 100))
            : undefined,
          customBiomeId: stageStepData?.biomeId,
        };

        if (isChordGateStep) {
          if (sim.chordGatePlan.prevGatePlatId !== undefined) {
            const prevGate = sim.platforms.find(
              (pl) => pl.id === sim.chordGatePlan.prevGatePlatId
            );
            if (prevGate) {
              prevGate.nextGateId = platId;
              prevGate.nextGateX = prevCenterX;
              prevGate.nextGateY = lastY;
            }
          }

          if (sim.chordGatePlan.nextGateChordIdx < 3) {
            sim.chordGatePlan.prevGatePlatId = platId;
            sim.chordGatePlan.nextGateChordIdx = (sim.chordGatePlan.nextGateChordIdx + 1) as
              | 0
              | 1
              | 2
              | 3;
            sim.chordGatePlan.nextGateStepIndex = sim.platformsGeneratedCount + 4;
          } else {
            sim.chordGatePlan.nextGateStepIndex = -1;
            sim.chordGatePlan.nextGateChordIdx = 0;
            sim.chordGatePlan.progressionVariant = Math.floor(Math.random() * 4);
            sim.chordGatePlan.prevGatePlatId = undefined;
            sim.chordGatePlan.cooldownSteps = Math.max(
              4,
              Math.round(fine.chordGateCooldownSteps)
            );
          }
        }

        sim.platforms.push(plat);

        if (
          !isChordGateStep &&
          altitudePx > 950 &&
          Math.random() < diff.aerialHazardChance
        ) {
          const hazardX =
            prevCenterX < 300
              ? Math.round(330 + Math.random() * 210)
              : Math.round(60 + Math.random() * 210);
          const hazardY = Math.round(lastY - stepYForThisGap * 0.52);
          sim.aerialHazards.push({
            id: sim.nextPlatformId++,
            x: hazardX,
            y: hazardY,
            vx: (Math.random() < 0.5 ? 1 : -1) * (42 + diff.flowFactor * 55),
            minX: Math.max(36, hazardX - 65),
            maxX: Math.min(564, hazardX + 65),
            radius: 11,
            active: true,
            phase: Math.random() * Math.PI * 2,
          });
        }

        const orbChance = Math.max(0, Math.min(1, fine.orbSpawnRate));
        if (Math.random() < orbChance) {
          const orbFreq = biome.scale[Math.floor(Math.random() * biome.scale.length)];
          const spread = Math.max(0.1, Math.min(1.0, fine.orbScatterSpread));
          const offsetRatio = 0.5 + (Math.random() - 0.5) * spread;
          sim.orbs.push({
            id: sim.nextPlatformId++,
            x: x + w * Math.max(0.12, Math.min(0.88, offsetRatio)),
            y: lastY - 38 - Math.random() * 12,
            baseY: lastY - 42,
            radius: 6,
            collected: false,
            freq: orbFreq,
            color: biome.horizonColor,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    },
    [getScaleByIndex]
  );

  const startNewRun = useCallback(
    (
      modeOverride?: GameMode,
      customSeq?: number[][],
      fromUserGesture = true,
      stageOverride?: CustomStage
    ) => {
      const sim = simRef.current;
      const activeMode = stageOverride ? 'STAGE' : modeOverride || sim.mode;
      sim.mode = activeMode;
      setGameMode(activeMode);

      if (stageOverride) {
        sim.activeStage = stageOverride;
      } else if (activeMode !== 'STAGE') {
        sim.activeStage = undefined;
      }

      if (customSeq && customSeq.length > 0) {
        sim.seqData = customSeq;
      }

      audioRef.current.resetMusicalState();
      if (activeMode !== 'STANDARD') {
        audioRef.current.stopChoir();
      }

      if (!sim.isMuted && fromUserGesture) {
        audioRef.current.init(sim.cfg);
        audioRef.current.resume();
      }

      if (fromUserGesture && window.innerWidth < 768) {
        const docEl = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        };
        if (!document.fullscreenElement) {
          if (docEl.requestFullscreen) {
            docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
          } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen().catch(() => {});
          }
        }
      }

      const fine = sim.cfg.fineTune || DEFAULT_FINE_TUNE;
      const charPerks = getCharacterById(sim.cfg.playerShape).perks;

      if (activeMode === 'STAGE' && sim.activeStage) {
        sim.biomeOrder = [sim.activeStage.biomeId];
        sim.activeSoundBankId = sim.activeStage.soundBankId;
      } else {
        const enabledScales = sim.cfg.enabledScales.length ? sim.cfg.enabledScales : [0];
        sim.biomeOrder = shuffleArray(enabledScales);
        sim.activeSoundBankId = pickRandomEnabledSoundBankId(sim.cfg);
      }

      const baseBpm =
        activeMode === 'STAGE' && sim.activeStage
          ? sim.activeStage.bpm
          : fine.baseJumpTempo || 100;
      const kin = computeBpmLockedKinematics(baseBpm, 1.0);
      const startBiome = getScaleByIndex(0, sim.cfg);
      const initialDiff = computeFlowDynamicDifficulty(0, fine);

      sim.score = 0;
      sim.maxFlowThisRun = 0;
      sim.orbsThisRun = 0;
      sim.flowEnergy = 0;
      sim.combo = 0;
      sim.flowSubSteps = 0;
      sim.timeSinceLastClimb = 0;
      sim.highestPlatformY = 782;
      sim.styleMeter = 0;
      sim.camY = 800 - (sim.viewH || 800);
      sim.gameTime = 0;
      sim.hitstop = 0;
      sim.shake = 0;
      sim.aberration = 0;
      sim.activeBiomeIdx = 0;
      sim.biomeDissolve = {
        active: false,
        progress: 1,
        fromBiome: startBiome,
        toBiome: startBiome,
      };
      sim.dyingSequence = {
        active: false,
        phase: 'none',
        timer: 0,
        dissolveProgress: 0,
        glitters: [],
      };
      sim.seqIdx = 0;
      sim.stageStepCursor = 0;
      sim.nextStagePlatformDurRatio = 1.0;
      sim.activeJumpGravity = kin.gravityPxPerSec2;
      sim.shieldRegenTimer = 0;
      sim.activePowerUps = [];
      sim.pendingRhythmRings = [];
      sim.activeChordChainTargetId = undefined;
      sim.chordComboHud = {
        active: false,
        completedCount: 0,
        chordNames: startBiome.chordNames,
        completionFlashTimer: 0,
      };
      sim.recentPlayedPlatformNotes = [startBiome.scale[0] || 261.63];
      sim.platformsGeneratedCount = 0;
      sim.chordGatePlan = {
        nextGateStepIndex: -1,
        nextGateChordIdx: 0,
        progressionVariant: Math.floor(Math.random() * 4),
        prevGatePlatId: undefined,
        cooldownSteps: Math.max(4, Math.round(fine.chordGateCooldownSteps * 0.6)),
      };

      sim.player.x = 288;
      sim.player.y = 782 - sim.player.h;
      sim.player.vx = 0;
      sim.player.vy = kin.jumpVelocityPxPerSec;
      sim.player.grounded = false;
      sim.player.wallSlideDir = 0;
      sim.player.scaleX = 0.72;
      sim.player.scaleY = 1.32;
      sim.player.impactSquashTimer = 0;
      sim.player.dashCool = 0;
      sim.player.dashMaxCool = 1.8 * charPerks.dashCooldownMultiplier;
      sim.player.dashAct = 0;
      sim.player.hasShield = charPerks.startWithShield;
      sim.player.doubleJumpReady = charPerks.permanentAirJump;
      sim.player.damageGlitchTimer = 0;
      sim.player.airJumpsLeft = charPerks.permanentAirJump ? 1 : 0;
      sim.player.trail = [];
      sim.player.scarfNodes = Array.from({ length: 6 }, () => ({ x: 300, y: 760 }));

      if (charPerks.startWithShield) {
        sim.activePowerUps.push({
          id: 'combo_shield',
          name: 'Aegis Shield',
          icon: '🛡',
          remainingSec: 25,
          durationSec: 25,
        });
      }

      sim.inputs.left = false;
      sim.inputs.right = false;
      sim.inputs.tiltX = 0;
      sim.inputs.upJustPressed = false;
      sim.inputs.dashJustPressed = false;

      const firstStepW = initialDiff.targetPlatformWidth + charPerks.platformWidthBonusPx;
      const firstStepX = Math.random() < 0.5 ? 95 : 325;

      let firstStepY = 782 - initialDiff.stepY;
      let firstStagePlatFields: Partial<PlatformEntity> = {};

      if (activeMode === 'STAGE' && sim.activeStage) {
        const compiled = compileStageForGameplay(sim.activeStage, 0);
        const firstStep = compiled[0];
        if (firstStep) {
          const firstDurKin = computeNoteDurationKinematics(
            sim.activeStage.bpm,
            firstStep.durationBeats
          );
          sim.stageStepCursor = 1;
          sim.nextStagePlatformDurRatio = firstDurKin.beatDurationRatio;
          firstStagePlatFields = {
            noteLabel: firstStep.label,
            noteFreq: firstStep.freqs[0] || 261.63,
            beatDurationRatio: firstDurKin.beatDurationRatio,
            customStepY: firstDurKin.stepY,
            customJumpVelocityPxPerSec: firstDurKin.jumpVelocityPxPerSec,
            customGravityPxPerSec2: firstDurKin.gravityPxPerSec2,
            customClusterFreqs: firstStep.freqs,
            customSynthFreqs: firstStep.synthFreqs,
            customSynthDurationSec:
              firstStep.synthDurationBeats * (60 / Math.max(60, sim.activeStage.bpm)),
            customBiomeId: firstStep.biomeId,
          };
        }
      }

      sim.platforms = [
        {
          id: 1,
          x: 180,
          y: 770,
          w: 240,
          targetW: 240,
          centerX: 300,
          h: 16,
          type: 'normal',
          vx: 0,
          vy: 0,
          minX: 0,
          maxX: 600,
          hit: true,
          repeatBounces: 0,
          themeIdx: 0,
          noteLabel: `${startBiome.noteNames[0] || 'C4'}`,
          noteFreq: startBiome.scale[0] || 261.63,
          crumbleTimer: 0,
          broken: false,
          respawnTimer: 0,
          phaseSolid: true,
        },
        {
          id: 2,
          x: firstStepX,
          y: firstStepY,
          w: firstStepW,
          targetW: firstStepW,
          centerX: firstStepX + firstStepW * 0.5,
          h: 14,
          type: 'normal',
          vx: 0,
          vy: 0,
          minX: 0,
          maxX: 600,
          hit: false,
          repeatBounces: 0,
          themeIdx: 0,
          noteLabel: startBiome.noteNames[2] || 'Eb4',
          noteFreq: startBiome.scale[2] || 311.13,
          crumbleTimer: 0,
          broken: false,
          respawnTimer: 0,
          phaseSolid: true,
          ...firstStagePlatFields,
        },
      ];
      sim.aerialHazards = [];
      sim.orbs = [
        {
          id: 3,
          x: firstStepX + firstStepW * 0.5,
          y: firstStepY - 40,
          baseY: firstStepY - 40,
          radius: 6,
          collected: false,
          freq: startBiome.scale[4] || 523.25,
          color: startBiome.horizonColor,
          phase: 0,
        },
      ];
      sim.nextPlatformId = 10;
      sim.particles.clear();
      sim.shockwaves = [];
      sim.texts.forEach((t) => (t.active = false));

      generateWorldUpTo(sim.camY - 450);

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setScreen('playing');
    },
    [generateWorldUpTo, getScaleByIndex, pickRandomEnabledSoundBankId]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startNewRun('STANDARD', undefined, false);
    } else {
      simRef.current.biomeOrder = shuffleArray(
        simRef.current.cfg.enabledScales.length ? simRef.current.cfg.enabledScales : [0]
      );
      generateWorldUpTo(-600);
    }
  }, [startNewRun, generateWorldUpTo]);

  // Keyboard & Blur Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const sim = simRef.current;

      if (!sim.isMuted && audioRef.current.ctx?.state === 'suspended') {
        audioRef.current.resume();
      }

      if (e.code === 'KeyM') {
        setIsMuted((m) => !m);
        return;
      }

      if (sim.state === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startNewRun('STANDARD');
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (sim.state === 'playing') {
          audioRef.current.suspend();
          setScreen('paused');
        } else if (sim.state === 'paused') {
          if (!sim.isMuted) audioRef.current.resume();
          setScreen('playing');
        }
        return;
      }

      if (
        e.code === 'KeyR' &&
        (sim.state === 'playing' || sim.state === 'paused' || sim.state === 'gameover')
      ) {
        startNewRun(sim.mode, undefined, true, sim.activeStage);
        return;
      }

      if (sim.state !== 'playing') return;

      if (e.key === 'ArrowLeft' || e.code === 'KeyA') sim.inputs.left = true;
      if (e.key === 'ArrowRight' || e.code === 'KeyD') sim.inputs.right = true;
      if (e.key === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        e.preventDefault();
        sim.inputs.upJustPressed = true;
      }
      if (e.key === 'Shift' || e.code === 'KeyK' || e.code === 'KeyX') {
        sim.inputs.dashJustPressed = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const sim = simRef.current;
      if (e.key === 'ArrowLeft' || e.code === 'KeyA') sim.inputs.left = false;
      if (e.key === 'ArrowRight' || e.code === 'KeyD') sim.inputs.right = false;
    };

    const clearInputs = () => {
      const sim = simRef.current;
      sim.inputs.left = false;
      sim.inputs.right = false;
      sim.inputs.upJustPressed = false;
      sim.inputs.dashJustPressed = false;
    };

    let lastAccelTime = 0;
    let smoothedRawTilt = 0;

    // Primary Low-Latency Hardware Gravity Sensor (60Hz direct accelerometer on Android)
    const onDeviceMotion = (e: DeviceMotionEvent) => {
      const sim = simRef.current;
      if (sim.cfg.tiltControlEnabled === false) {
        sim.inputs.tiltX = 0;
        return;
      }
      const ag = e.accelerationIncludingGravity;
      if (!ag || typeof ag.x !== 'number') return;

      lastAccelTime = performance.now();
      const angle =
        typeof window.screen?.orientation?.angle === 'number'
          ? window.screen.orientation.angle
          : 0;
      let rawG = -ag.x;
      if (angle === 90 && typeof ag.y === 'number') rawG = ag.y;
      else if ((angle === -90 || angle === 270) && typeof ag.y === 'number') rawG = -ag.y;

      // Fast 1-frame responsiveness with minimal anti-jitter blend
      smoothedRawTilt = smoothedRawTilt * 0.2 + rawG * 0.8;

      const deadzoneG = 0.14; // ~0.8 deg micro-deadzone
      const maxG = 2.15; // Full speed at ~12.5 deg comfortable wrist tilt
      if (Math.abs(smoothedRawTilt) <= deadzoneG) {
        sim.inputs.tiltX = 0;
      } else {
        const sign = smoothedRawTilt > 0 ? 1 : -1;
        const linear = Math.min(1, (Math.abs(smoothedRawTilt) - deadzoneG) / (maxG - deadzoneG));
        // Non-linear curve boosts small-to-medium tilt angles for instant response
        const curved = Math.pow(linear, 0.72);
        sim.inputs.tiltX = Number((sign * curved).toFixed(3));
      }
    };

    // Fallback Orientation Sensor (used only if hardware devicemotion is unavailable)
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      const sim = simRef.current;
      if (sim.cfg.tiltControlEnabled === false) {
        sim.inputs.tiltX = 0;
        return;
      }
      if (performance.now() - lastAccelTime < 160) {
        return;
      }
      const angle =
        typeof window.screen?.orientation?.angle === 'number'
          ? window.screen.orientation.angle
          : 0;
      let rawDeg = e.gamma ?? 0;
      if (angle === 90 && e.beta !== null) rawDeg = e.beta;
      else if (angle === -90 || angle === 270) rawDeg = -(e.beta ?? 0);

      const deadzoneDeg = 0.8;
      const maxTiltDeg = 12.0;
      if (Math.abs(rawDeg) <= deadzoneDeg) {
        sim.inputs.tiltX = 0;
      } else {
        const sign = rawDeg > 0 ? 1 : -1;
        const linear = Math.min(1, (Math.abs(rawDeg) - deadzoneDeg) / (maxTiltDeg - deadzoneDeg));
        const curved = Math.pow(linear, 0.72);
        sim.inputs.tiltX = Number((sign * curved).toFixed(3));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    window.addEventListener('devicemotion', onDeviceMotion, { passive: true });
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      window.removeEventListener('devicemotion', onDeviceMotion);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
    };
  }, [startNewRun]);

  // Main 60Hz Simulation & Render Loop
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();

    const hasPowerUp = (id: ActivePowerUp['id']) =>
      simRef.current.activePowerUps.some((p) => p.id === id);

    const stepSimulation = (dt: number) => {
      const sim = simRef.current;
      const c = sim.cfg;
      const fine = c.fineTune || DEFAULT_FINE_TUNE;
      const charPerks = getCharacterById(c.playerShape).perks;
      sim.gameTime += dt;

      // Poll Gamepad API
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0];
      if (gp && sim.state === 'playing' && !sim.dyingSequence.active) {
        const axisX = gp.axes[0] || 0;
        if (axisX < -0.25 || gp.buttons[14]?.pressed) sim.inputs.left = true;
        else if (axisX > 0.25 || gp.buttons[15]?.pressed) sim.inputs.right = true;
        if (gp.buttons[2]?.pressed || gp.buttons[5]?.pressed) {
          sim.inputs.dashJustPressed = true;
        }
      }

      const currentBiomeIdx =
        sim.mode === 'STAGE' && sim.activeStage
          ? 0
          : Math.floor(Math.abs(sim.camY) / BIOME_ALTITUDE_SPAN);
      const biome = getScaleByIndex(currentBiomeIdx, c);

      // Trigger Seamless Bottom-to-Top Dual-Biome Pixelated Dissolve + Random Sound Bank Shift
      if (sim.mode !== 'STAGE' && currentBiomeIdx !== sim.activeBiomeIdx) {
        const prevBiome = getScaleByIndex(sim.activeBiomeIdx, c);
        sim.activeBiomeIdx = currentBiomeIdx;
        sim.activeSoundBankId = pickRandomEnabledSoundBankId(c, sim.activeSoundBankId);
        sim.biomeDissolve = {
          active: true,
          progress: 0,
          fromBiome: prevBiome,
          toBiome: biome,
        };
        grantTemporaryPowerUp(biome, `BIOME · ${biome.name}`);
      }

      if (sim.biomeDissolve.active) {
        sim.biomeDissolve.progress += dt * 0.56;
        if (sim.biomeDissolve.progress >= 1) {
          sim.biomeDissolve.progress = 1;
          sim.biomeDissolve.active = false;
        }
      }

      // Compute 5-Note Harmonic Context for Synthesizer
      const playedHist = sim.recentPlayedPlatformNotes;
      const currentNoteFreq =
        playedHist.length > 0 ? playedHist[playedHist.length - 1] : biome.scale[0];
      const prevTwoFreqs = playedHist.slice(
        Math.max(0, playedHist.length - 3),
        Math.max(0, playedHist.length - 1)
      );
      const nextTwoFreqs: number[] = [];
      for (let i = 0; i < sim.platforms.length; i++) {
        const pl = sim.platforms[i];
        if (!pl.broken && pl.y < sim.player.y - 8 && pl.noteFreq) {
          nextTwoFreqs.push(pl.noteFreq);
          if (nextTwoFreqs.length >= 2) break;
        }
      }

      const { beatPulse: ambientPulse } = audioRef.current.tickRhythmAndStems(
        sim.gameTime,
        sim.combo,
        biome,
        c,
        sim.state === 'playing' && !sim.dyingSequence.active && !sim.isMuted,
        sim.mode === 'STAGE' ? 'MIDI' : sim.mode,
        {
          current: currentNoteFreq,
          prevTwo: prevTwoFreqs,
          nextTwo: nextTwoFreqs,
        }
      );

      // Update reactive eye tracking vector
      const p = sim.player;
      const nowMs = performance.now();
      let targetEyeX = p.facing * 0.45;
      let targetEyeY = Math.max(-0.85, Math.min(0.85, p.vy / 650));

      if (nowMs < pointerEyeRef.current.activeUntil) {
        const screenPlayerY = p.y - sim.camY;
        const dx = pointerEyeRef.current.x - (p.x + p.w * 0.5);
        const dy = pointerEyeRef.current.y - (screenPlayerY + p.h * 0.5);
        const dist = Math.hypot(dx, dy) || 1;
        targetEyeX = Math.max(-1, Math.min(1, (dx / dist) * Math.min(1, dist / 60)));
        targetEyeY = Math.max(-1, Math.min(1, (dy / dist) * Math.min(1, dist / 60)));
      } else if (Math.abs(sim.inputs.tiltX) > 0.05) {
        targetEyeX = sim.inputs.tiltX;
      }

      p.eyeLookX = (p.eyeLookX ?? 0) + (targetEyeX - (p.eyeLookX ?? 0)) * Math.min(1, dt * 14);
      p.eyeLookY = (p.eyeLookY ?? 0) + (targetEyeY - (p.eyeLookY ?? 0)) * Math.min(1, dt * 14);

      if ((p.impactSquashTimer ?? 0) > 0) {
        p.impactSquashTimer = Math.max(0, (p.impactSquashTimer ?? 0) - dt);
      }

      // Title / Menu screen idle animation
      if (
        sim.state === 'title' ||
        sim.state === 'sequencer' ||
        sim.state === 'settings' ||
        sim.state === 'store' ||
        sim.state === 'characters' ||
        sim.state === 'stage_creator'
      ) {
        sim.player.x = 288 + Math.sin(sim.gameTime * 1.4) * 45;
        const bouncePhase = Math.abs(Math.sin(sim.gameTime * 2.2));
        sim.player.y = 758 - bouncePhase * 55;
        if (bouncePhase < 0.08) {
          sim.player.scaleX = 1.32;
          sim.player.scaleY = 0.72;
        } else {
          sim.player.scaleX = 0.92 + (1 - bouncePhase) * 0.1;
          sim.player.scaleY = 1.12 - (1 - bouncePhase) * 0.12;
        }
        sim.particles.update(dt);
        return ambientPulse;
      }

      if (sim.state !== 'playing') {
        return ambientPulse;
      }

      const frameScale = dt * 60;

      // =========================================================================
      // 3-PHASE DEFEAT SEQUENCE:
      // 1) 'falling' (1.0s): Camera follows falling character downward
      // 2) 'exploding' (0.55s): Character explodes at center screen into sparkling glitters
      // 3) 'dissolving' (0.32s): Fast 16x16px pixelated dissolve into Game Over dialog
      // =========================================================================
      if (sim.dyingSequence.active) {
        sim.dyingSequence.timer += dt;

        // Keep updating particles & shockwaves during the defeat sequence
        sim.particles.update(dt);
        for (let i = 0; i < sim.shockwaves.length; i++) {
          const sw = sim.shockwaves[i];
          sw.r += (sw.maxR - sw.r) * 0.18 * frameScale;
          sw.alpha -= 0.05 * frameScale;
        }

        if (sim.shake > 0.1) {
          sim.camY += (Math.random() - 0.5) * sim.shake;
          sim.shake *= Math.pow(0.86, frameScale);
        } else {
          sim.shake = 0;
        }

        if (sim.dyingSequence.phase === 'falling') {
          // 1-Second Camera-Tracked Downward Fall
          p.vy = Math.max(p.vy, 640) + 980 * dt;
          p.y += p.vy * dt;
          // Gently pull player horizontally toward center X (288) so explosion happens dead-center!
          p.x += (288 - p.x) * Math.min(1, dt * 5.0);
          p.scaleX = 0.76;
          p.scaleY = 1.32;
          p.damageGlitchTimer = 0.4;

          // Follow player downward keeping them centered vertically on screen!
          const centerOffsetY = (sim.viewH || 800) * 0.485;
          const targetFallCamY = p.y - centerOffsetY;
          sim.camY += (targetFallCamY - sim.camY) * Math.min(1, dt * 16);

          p.trail.push({
            x: p.x + p.w * 0.5,
            y: p.y + p.h * 0.5,
            vx: p.vx,
            vy: p.vy,
          });
          if (p.trail.length > 14) p.trail.shift();

          if (sim.dyingSequence.timer >= 1.0) {
            sim.dyingSequence.phase = 'exploding';
            sim.dyingSequence.timer = 0;

            // Snap to exact center of screen & burst into 96 sparkling glitters!
            p.x = 288;
            p.y = sim.camY + centerOffsetY;
            const centerX = p.x + p.w * 0.5;
            const centerY = p.y + p.h * 0.5;

            if (!sim.isMuted) {
              audioRef.current.sfxPlayerShatter(biome, c);
            }
            sim.shake = 14;
            sim.aberration = 1.0;

            spawnShockwave(centerX, centerY, '#ffffff', 160);
            spawnShockwave(centerX, centerY, biome.fg, 220);
            spawnShockwave(centerX, centerY, '#f472b6', 110);

            const glitterColors = [
              '#ffffff',
              biome.fg,
              biome.horizonColor,
              '#fde047',
              '#f472b6',
              '#38bdf8',
              '#a855f7',
              '#fb7185',
            ];
            const glitters: GlitterParticle[] = [];
            for (let g = 0; g < 96; g++) {
              const angle = (Math.PI * 2 * g) / 96 + (Math.random() - 0.5) * 0.25;
              const speed = 70 + Math.random() * 420;
              const maxLife = 0.55 + Math.random() * 0.45;
              glitters.push({
                x: centerX + (Math.random() - 0.5) * 10,
                y: centerY + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 60,
                size: 3 + Math.floor(Math.random() * 5),
                color: glitterColors[g % glitterColors.length],
                life: maxLife,
                maxLife,
                twinklePhase: Math.random() * Math.PI * 2,
              });
            }
            sim.dyingSequence.glitters = glitters;
          }
        } else if (sim.dyingSequence.phase === 'exploding') {
          // Update sparkling glitters outward from center of screen
          for (let i = 0; i < sim.dyingSequence.glitters.length; i++) {
            const g = sim.dyingSequence.glitters[i];
            g.x += g.vx * dt;
            g.y += g.vy * dt;
            g.vy += 280 * dt;
            g.vx *= Math.pow(0.95, frameScale);
            g.life -= dt;
          }

          if (sim.dyingSequence.timer >= 0.55) {
            sim.dyingSequence.phase = 'dissolving';
            sim.dyingSequence.timer = 0;
          }
        } else if (sim.dyingSequence.phase === 'dissolving') {
          for (let i = 0; i < sim.dyingSequence.glitters.length; i++) {
            const g = sim.dyingSequence.glitters[i];
            g.x += g.vx * dt;
            g.y += g.vy * dt;
            g.vy += 280 * dt;
            g.life -= dt;
          }
          sim.dyingSequence.dissolveProgress = Math.min(1, sim.dyingSequence.timer / 0.32);

          if (sim.dyingSequence.timer >= 0.32) {
            const finalAlt = Math.floor(Math.abs(Math.min(0, sim.highestPlatformY - 782)) / 100);
            const styleRank = calculateStyleRank(sim.maxFlowThisRun, sim.styleMeter).rank;

            setStats((prev) => {
              const isNew = sim.score > prev.highScore;
              const next: PersistentStats = {
                highScore: Math.max(prev.highScore, sim.score),
                maxCombo: Math.max(prev.maxCombo, sim.maxFlowThisRun),
                totalOrbs: prev.totalOrbs + sim.orbsThisRun,
                runsPlayed: prev.runsPlayed + 1,
              };
              setEndSnapshot({
                score: Math.round(sim.score),
                best: Math.round(next.highScore),
                isNewRecord: isNew,
                maxFlow: sim.maxFlowThisRun,
                altitude: finalAlt,
                orbsCollected: sim.orbsThisRun,
                rank: styleRank,
              });
              return next;
            });

            sim.dyingSequence.active = false;
            setScreen('gameover');
          }
        }

        return ambientPulse;
      }

      if (sim.hitstop > 0) {
        sim.hitstop -= dt;
        return ambientPulse;
      }

      if (p.damageGlitchTimer > 0) {
        p.damageGlitchTimer = Math.max(0, p.damageGlitchTimer - dt);
      }
      if (sim.chordComboHud.completionFlashTimer > 0) {
        sim.chordComboHud.completionFlashTimer = Math.max(
          0,
          sim.chordComboHud.completionFlashTimer - dt
        );
      }

      // Gold / Rainbow Character Passive Shield Auto-Regeneration
      if (charPerks.autoRegenShieldSec > 0 && !p.hasShield) {
        sim.shieldRegenTimer += dt;
        if (sim.shieldRegenTimer >= charPerks.autoRegenShieldSec) {
          sim.shieldRegenTimer = 0;
          p.hasShield = true;
          if (!hasPowerUp('combo_shield')) {
            sim.activePowerUps.push({
              id: 'combo_shield',
              name: 'Aegis Shield',
              icon: '🛡',
              remainingSec: 20,
              durationSec: 20,
            });
          }
          spawnShockwave(p.x + 12, p.y + 12, biome.horizonColor, 80);
          spawnFloatingText('🛡 SHIELD READY', 300, p.y - 26, '#fde047', 0.95);
        }
      } else {
        sim.shieldRegenTimer = 0;
      }

      // Emit Scheduled 3-Note Subdivision Ring Pulses Centered on Player!
      if (sim.pendingRhythmRings.length > 0) {
        const remainingRings: typeof sim.pendingRhythmRings = [];
        for (let i = 0; i < sim.pendingRhythmRings.length; i++) {
          const item = sim.pendingRhythmRings[i];
          if (sim.gameTime >= item.triggerAt) {
            spawnShockwave(p.x + p.w * 0.5, p.y + p.h * 0.5, item.color, item.maxR);
          } else {
            remainingRings.push(item);
          }
        }
        sim.pendingRhythmRings = remainingRings;
      }

      // Continuous Gradual Flow Decay when not actively climbing
      sim.timeSinceLastClimb += dt;
      if (sim.flowEnergy > 0 && sim.timeSinceLastClimb > 2.2) {
        const decayRate =
          (0.08 + sim.flowEnergy * 0.008) *
          fine.flowDecayRate *
          charPerks.stallDecayMultiplier;
        sim.flowEnergy = Math.max(0, sim.flowEnergy - decayRate * dt);
        syncFlowStateFromEnergy(sim);
      }

      sim.activePowerUps = tickActivePowerUps(sim.activePowerUps, dt);
      if (!hasPowerUp('combo_shield')) {
        p.hasShield = false;
      }

      generateWorldUpTo(sim.camY);

      const flowDiff = computeFlowDynamicDifficulty(sim.flowEnergy, fine);
      const baseBpm =
        sim.mode === 'STAGE' && sim.activeStage
          ? sim.activeStage.bpm
          : fine.baseJumpTempo || 100;
      const kin = computeBpmLockedKinematics(baseBpm, 1.0);
      const activeBank = getActiveSoundBank(c);

      // Dynamically adapt upper platform widths when Flow rises or drops
      for (let i = 0; i < sim.platforms.length; i++) {
        const plat = sim.platforms[i];
        if (plat.id === 1) continue;
        if (!plat.hit && plat.y < p.y - 20) {
          const baseTargetW = flowDiff.targetPlatformWidth + charPerks.platformWidthBonusPx;
          const desiredW =
            plat.type === 'chord_gate'
              ? Math.round(baseTargetW * 1.08)
              : baseTargetW;
          plat.targetW = desiredW;
        }
        if (Math.abs(plat.w - plat.targetW) > 0.4) {
          plat.w += (plat.targetW - plat.w) * Math.min(1, dt * 6.5);
          if (plat.type !== 'moving') {
            plat.x = plat.centerX - plat.w * 0.5;
          }
        } else {
          plat.w = plat.targetW;
        }
      }

      // Check if player missed an active Chord Gate while descending past it -> downgrade to normal platforms!
      if (p.vy > 0) {
        for (let i = 0; i < sim.platforms.length; i++) {
          const pl = sim.platforms[i];
          if (pl.type === 'chord_gate' && !pl.hit) {
            const isTargetGate =
              sim.activeChordChainTargetId !== undefined &&
              pl.id === sim.activeChordChainTargetId;
            const passedBelowGate = p.y > pl.y + 38 && p.y - p.vy * dt <= pl.y + 38;
            if ((isTargetGate && p.y > pl.y + 35) || passedBelowGate) {
              downgradeRemainingChordGates(sim, biome.horizonColor);
              break;
            }
          }
        }
      }

      const inp = sim.inputs;

      // Dash Cooldown & Flow Tier 4 Overdrive + Character Perk Bonus
      const flowDashBonus = sim.combo >= FLOW_THRESHOLDS.OVERDRIVE ? 0.68 : 1.0;
      const maxDashCool =
        (hasPowerUp('dash_capacitor') ? 1.0 : 1.8) *
        flowDashBonus *
        charPerks.dashCooldownMultiplier;
      p.dashMaxCool = maxDashCool;
      if (p.dashCool > 0) p.dashCool = Math.max(0, p.dashCool - dt);

      if (inp.dashJustPressed && p.dashCool <= 0) {
        p.dashAct = 0.18;
        p.dashCool = maxDashCool;
        const dir = inp.left ? -1 : inp.right ? 1 : p.facing;
        p.facing = dir;
        p.vx = dir * 560;
        p.scaleX = 1.42;
        p.scaleY = 0.64;
        sim.aberration = 0.65;
        sim.shake = 3.5;
        if (!sim.isMuted) audioRef.current.sfxDash(biome, c);
        spawnShockwave(
          p.x + p.w * 0.5,
          p.y + p.h * 0.5,
          biome.horizonColor,
          hasPowerUp('dash_capacitor') ? 95 : 65
        );
        sim.particles.burst(p.x + p.w * 0.5, p.y + p.h * 0.5, biome.fg, 8, 5, 'spark');
      }
      inp.dashJustPressed = false;

      // Optional Aero Thruster Mid-Air Boost
      if (inp.upJustPressed) {
        inp.upJustPressed = false;
        if (
          (hasPowerUp('double_jump') || charPerks.permanentAirJump) &&
          p.airJumpsLeft > 0 &&
          p.vy > -100
        ) {
          p.airJumpsLeft--;
          p.vy = kin.jumpVelocityPxPerSec * 0.95;
          sim.activeJumpGravity = kin.gravityPxPerSec2;
          p.scaleX = 0.72;
          p.scaleY = 1.32;
          if (!sim.isMuted) audioRef.current.sfxJump(biome, c, true);
          spawnShockwave(p.x + p.w * 0.5, p.y + p.h, biome.fg, 50);
        }
      }

      // Constant Horizontal Steering Speed
      if (p.dashAct > 0) {
        p.dashAct = Math.max(0, p.dashAct - dt);
        sim.particles.spawn(
          p.x + p.w * 0.5,
          p.y + p.h * 0.5,
          -p.vx * 0.01,
          (Math.random() - 0.5) * 2,
          biome.horizonColor,
          3.5,
          0.25,
          'spark'
        );
      } else {
        const keyAxis = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
        const tiltAxis = c.tiltControlEnabled !== false ? inp.tiltX : 0;
        const isTiltActive = keyAxis === 0 && Math.abs(tiltAxis) > 0.01;
        const combinedAxis = Math.max(-1, Math.min(1, keyAxis !== 0 ? keyAxis : tiltAxis));
        const tiltSpeedBoost = isTiltActive ? 1.38 : 1.0;
        const targetVx = combinedAxis * flowDiff.moveSpeedPxPerSec * tiltSpeedBoost;
        const isReversing = p.vx * targetVx < 0;
        const steerRate = isTiltActive
          ? isReversing
            ? 52
            : 38
          : Math.abs(combinedAxis) > 0.05
          ? 16
          : 11;
        p.vx += (targetVx - p.vx) * Math.min(1, dt * steerRate);
        if (combinedAxis < -0.05) p.facing = -1;
        if (combinedAxis > 0.05) p.facing = 1;
      }

      const activeGravity =
        sim.mode === 'STAGE' && sim.activeJumpGravity > 100
          ? sim.activeJumpGravity
          : kin.gravityPxPerSec2;

      p.vy += activeGravity * dt;
      p.vy = Math.min(p.vy, Math.abs(kin.jumpVelocityPxPerSec) * 1.35);

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Update Tapered Triangular Trail Points Behind Character
      p.trail.push({
        x: p.x + p.w * 0.5,
        y: p.y + p.h * 0.5,
        vx: p.vx,
        vy: p.vy,
      });
      if (p.trail.length > 14) {
        p.trail.shift();
      }

      // Gentle Wall-Bounce on Left/Right Boundaries
      p.wallSlideDir = 0;
      if (p.x <= 6) {
        p.x = 6;
        p.vx = Math.abs(p.vx) * 0.75 + 140;
        p.facing = 1;
        sim.particles.burst(8, p.y + p.h * 0.5, biome.fg, 5, 3.5, 'dust');
      } else if (p.x + p.w >= 594) {
        p.x = 594 - p.w;
        p.vx = -Math.abs(p.vx) * 0.75 - 140;
        p.facing = -1;
        sim.particles.burst(592, p.y + p.h * 0.5, biome.fg, 5, 3.5, 'dust');
      }

      const sq = stepSquashStretch(p.scaleX, p.scaleY, dt);
      p.scaleX = sq.scaleX;
      p.scaleY = sq.scaleY;

      // Update Mid-Air Obstacles & Check Collision
      for (let i = 0; i < sim.aerialHazards.length; i++) {
        const ah = sim.aerialHazards[i];
        if (!ah.active) continue;
        ah.x += ah.vx * dt;
        if (ah.x < ah.minX || ah.x > ah.maxX) {
          ah.vx *= -1;
          ah.x = Math.max(ah.minX, Math.min(ah.maxX, ah.x));
        }

        if (p.dashAct <= 0) {
          const dx = p.x + p.w * 0.5 - ah.x;
          const dy = p.y + p.h * 0.5 - ah.y;
          if (Math.hypot(dx, dy) < p.w * 0.5 + ah.radius - 2) {
            ah.active = false;
            if (p.hasShield) {
              p.hasShield = false;
              sim.activePowerUps = sim.activePowerUps.filter((u) => u.id !== 'combo_shield');
              if (!sim.isMuted) audioRef.current.sfxShieldBreak(biome, c);
              spawnFloatingText('🛡 BLOCKED', 300, p.y - 24, biome.horizonColor, 1.0);
            } else {
              if (!sim.isMuted) audioRef.current.sfxHazardDamage(biome, c);
              const droneLoss = Number(
                (1.2 * fine.hazardFlowPenalty * charPerks.hazardPenaltyMultiplier).toFixed(1)
              );
              sim.flowEnergy = Math.max(0, sim.flowEnergy - droneLoss);
              syncFlowStateFromEnergy(sim);
              sim.styleMeter = Math.max(0, sim.styleMeter - 25);
              p.damageGlitchTimer = 0.65;
              sim.shake = 5;
              sim.aberration = 0.75;
              sim.particles.burst(ah.x, ah.y, '#fb7185', 12, 5, 'spark');
              spawnFloatingText(`-${droneLoss} FLOW`, 300, p.y - 24, '#fb7185', 1.0);
            }
          }
        }
      }

      // Update Platforms & Auto-Bounce Collisions
      p.grounded = false;

      for (let i = 0; i < sim.platforms.length; i++) {
        const plat = sim.platforms[i];

        if (plat.type === 'moving') {
          plat.x += plat.vx * frameScale;
          if (plat.x < plat.minX || plat.x > plat.maxX) {
            plat.vx *= -1;
            plat.x = Math.max(plat.minX, Math.min(plat.maxX, plat.x));
          }
          plat.centerX = plat.x + plat.w * 0.5;
        }

        if (plat.type === 'phase') {
          plat.phaseSolid = Math.floor(sim.gameTime * 1.1) % 4 !== 3;
        }

        if (plat.type === 'crumble') {
          if (plat.broken) {
            plat.respawnTimer -= dt;
            if (plat.respawnTimer <= 0) {
              plat.broken = false;
              plat.crumbleTimer = 0;
              plat.hit = false;
              plat.repeatBounces = 0;
            }
            continue;
          } else if (plat.crumbleTimer > 0) {
            plat.crumbleTimer -= dt;
            if (plat.crumbleTimer <= 0) {
              plat.broken = true;
              plat.respawnTimer = 3.0;
              if (!sim.isMuted) audioRef.current.sfxCrumble(biome, c);
              sim.particles.burst(plat.x + plat.w * 0.5, plat.y, biome.fg, 8, 3.5, 'dust');
              continue;
            }
          }
        }

        if (
          p.vy >= 0 &&
          !plat.broken &&
          (plat.type !== 'phase' || plat.phaseSolid)
        ) {
          const overlapX = p.x + p.w > plat.x - 3 && p.x < plat.x + plat.w + 3;
          const prevBottom = p.y + p.h - p.vy * dt;
          const overlapY = p.y + p.h >= plat.y && prevBottom <= plat.y + 24;

          if (overlapX && overlapY) {
            // If in STAGE mode and this platform has a per-bar `customBiomeId`, transition to it!
            let activePlatBiome = biome;
            if (sim.mode === 'STAGE' && plat.customBiomeId !== undefined) {
              const targetBarBiome =
                MASTER_SCALES.find((s) => s.id === plat.customBiomeId) || biome;
              activePlatBiome = targetBarBiome;
              if (sim.biomeOrder[0] !== plat.customBiomeId) {
                const prevBarBiome =
                  MASTER_SCALES.find((s) => s.id === sim.biomeOrder[0]) || biome;
                sim.biomeOrder = [plat.customBiomeId];
                sim.biomeDissolve = {
                  active: true,
                  progress: 0,
                  fromBiome: prevBarBiome,
                  toBiome: targetBarBiome,
                };
              }
            }

            const pCol = getPlatformThemeColor(
              activePlatBiome,
              plat.type,
              c.useBiomes,
              c.fixedColor
            );

            // Check On-Platform Dissonance Spike collision
            if (
              plat.hasHazard &&
              plat.hazardWidth &&
              plat.hazardXOffset !== undefined &&
              p.dashAct <= 0
            ) {
              const hx = plat.x + plat.hazardXOffset;
              if (p.x + p.w > hx + 2 && p.x < hx + plat.hazardWidth - 2) {
                plat.hasHazard = false;
                if (p.hasShield) {
                  p.hasShield = false;
                  sim.activePowerUps = sim.activePowerUps.filter((u) => u.id !== 'combo_shield');
                  if (!sim.isMuted) audioRef.current.sfxShieldBreak(activePlatBiome, c);
                  spawnFloatingText('🛡 BLOCKED', 300, p.y - 24, activePlatBiome.horizonColor, 1.0);
                } else {
                  if (!sim.isMuted) audioRef.current.sfxHazardDamage(activePlatBiome, c);
                  const spikeLoss = Number(
                    (1.0 * fine.hazardFlowPenalty * charPerks.hazardPenaltyMultiplier).toFixed(1)
                  );
                  sim.flowEnergy = Math.max(0, sim.flowEnergy - spikeLoss);
                  syncFlowStateFromEnergy(sim);
                  sim.styleMeter = Math.max(0, sim.styleMeter - 22);
                  p.damageGlitchTimer = 0.55;
                  sim.shake = 4.5;
                  sim.aberration = 0.65;
                  spawnFloatingText(`-${spikeLoss} FLOW`, 300, p.y - 24, '#fb7185', 1.0);
                }
              }
            }

            // AUTO-BOUNCE + Elastic Impact Squash-and-Stretch
            p.y = plat.y - p.h;
            p.impactSquashTimer = 0.095;
            p.airJumpsLeft =
              hasPowerUp('double_jump') || charPerks.permanentAirJump ? 1 : 0;

            if (plat.type === 'crumble' && plat.crumbleTimer <= 0) {
              plat.crumbleTimer = 0.15;
            }

            // 4-GATE HARMONIC CHORD PROGRESSION PORTAL TRIGGER
            if (plat.type === 'chord_gate') {
              const gateIdx = plat.chordGateIndex ?? 0;
              const variantIdx = plat.chordProgressionVariant ?? 0;
              const prog = pickBiomeChordProgression(activePlatBiome, variantIdx);
              const roman = ROMAN_NUMERALS[gateIdx % 4];
              const chordName =
                plat.chordNameOverride || prog.chordNames[gateIdx % 4] || 'HARMONY';
              plat.hit = true;
              sim.timeSinceLastClimb = 0;
              if (plat.y < sim.highestPlatformY) {
                sim.highestPlatformY = plat.y;
              }

              sim.chordComboHud = {
                active: gateIdx < 3,
                completedCount: gateIdx + 1,
                chordNames: prog.chordNames,
                completionFlashTimer: gateIdx === 3 ? 2.4 : 0,
              };

              const baseChordTone = prog.chords[gateIdx % 4]?.[1] || activePlatBiome.scale[0];
              sim.recentPlayedPlatformNotes.push(baseChordTone);
              if (sim.recentPlayedPlatformNotes.length > 6) {
                sim.recentPlayedPlatformNotes.shift();
              }

              const prevComboGate = sim.combo;
              sim.flowEnergy = Math.min(
                45,
                sim.flowEnergy +
                  (gateIdx === 3 ? 0.65 : 0.25) * fine.flowGainRate * charPerks.flowGainMultiplier
              );
              syncFlowStateFromEnergy(sim);
              const didGateLevelUp = sim.combo > prevComboGate && sim.combo >= 1;

              if (sim.combo > sim.maxFlowThisRun) sim.maxFlowThisRun = sim.combo;
              sim.styleMeter = Math.min(100, sim.styleMeter + (gateIdx === 3 ? 24 : 12));
              sim.score += Math.round(
                (gateIdx === 3 ? 25 : 4 + gateIdx * 3) * charPerks.scoreMultiplier
              );

              if (!sim.isMuted) {
                audioRef.current.playChordGate(
                  activePlatBiome,
                  gateIdx,
                  c,
                  activeBank,
                  variantIdx
                );
                if (gateIdx === 3) {
                  audioRef.current.playChordCadenceReward(
                    activePlatBiome,
                    variantIdx,
                    c,
                    activeBank
                  );
                } else if (didGateLevelUp) {
                  const res = audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    undefined,
                    activeBank,
                    true
                  );
                  res.subdivisionRingDelaysSec.forEach((delaySec, idx) => {
                    sim.pendingRhythmRings.push({
                      triggerAt: sim.gameTime + delaySec,
                      color: idx % 2 === 0 ? activePlatBiome.horizonColor : activePlatBiome.fg,
                      maxR: 54 + idx * 18,
                    });
                  });
                }
              }

              if (gateIdx === 3) {
                if (charPerks.chordGateBonusOrbs > 0) {
                  sim.orbsThisRun += charPerks.chordGateBonusOrbs;
                }
                grantTemporaryPowerUp(activePlatBiome, `4-GATE CADENCE`);
                if (charPerks.chordGateDoublePowerUp) {
                  grantTemporaryPowerUp(
                    activePlatBiome,
                    getCharacterById(c.playerShape).perkTitle
                  );
                }
              } else {
                spawnShockwave(plat.x + plat.w * 0.5, plat.y, activePlatBiome.horizonColor, 115);
                sim.particles.burst(plat.x + plat.w * 0.5, plat.y, activePlatBiome.fg, 14, 5.5, 'spark');
                spawnFloatingText(
                  `${roman} · ${chordName}`,
                  300,
                  plat.y - 36,
                  activePlatBiome.horizonColor,
                  1.0,
                  `${gateIdx + 1}/4`
                );
              }

              generateWorldUpTo(plat.y - 900);

              if (gateIdx < 3 && plat.nextGateId !== undefined) {
                const nextGate = sim.platforms.find((pl) => pl.id === plat.nextGateId);
                if (nextGate) {
                  sim.activeChordChainTargetId = nextGate.id;
                  const verticalSpan = Math.max(380, Math.abs(plat.y - nextGate.y));
                  const boostApex = verticalSpan + 78;
                  sim.activeJumpGravity = kin.gravityPxPerSec2;
                  p.vy = -Math.sqrt(2 * kin.gravityPxPerSec2 * boostApex);
                  p.scaleX = 0.64;
                  p.scaleY = 1.42;
                  break;
                }
              }

              sim.activeChordChainTargetId = undefined;
              sim.activeJumpGravity = kin.gravityPxPerSec2;
              p.vy = kin.bouncePadVelocityPxPerSec * 1.05;
              p.scaleX = 0.66;
              p.scaleY = 1.38;
              break;
            }

            if (
              sim.activeChordChainTargetId !== undefined ||
              sim.platforms.some(
                (pl) => pl.type === 'chord_gate' && !pl.hit && pl.y >= plat.y - 20
              )
            ) {
              downgradeRemainingChordGates(sim, activePlatBiome.horizonColor);
            }

            // Launch velocity & duration-proportional gravity
            if (
              sim.mode === 'STAGE' &&
              plat.customJumpVelocityPxPerSec !== undefined &&
              plat.customGravityPxPerSec2 !== undefined
            ) {
              p.vy = plat.customJumpVelocityPxPerSec;
              sim.activeJumpGravity = plat.customGravityPxPerSec2;
              p.scaleX = 0.72;
              p.scaleY = 1.32;
            } else if (plat.type === 'bounce') {
              p.vy = kin.bouncePadVelocityPxPerSec;
              sim.activeJumpGravity = kin.gravityPxPerSec2;
              p.scaleX = 0.64;
              p.scaleY = 1.4;
              sim.shake = 3.5;
              if (!sim.isMuted) audioRef.current.sfxBouncePad(activePlatBiome, c);
              spawnShockwave(p.x + p.w * 0.5, plat.y, pCol, 75);
              sim.particles.burst(p.x + p.w * 0.5, plat.y, pCol, 10, 5, 'spark');
            } else {
              p.vy = kin.jumpVelocityPxPerSec;
              sim.activeJumpGravity = kin.gravityPxPerSec2;
              p.scaleX = 0.72;
              p.scaleY = 1.32;
            }

            if (!plat.hit) {
              plat.hit = true;
              plat.repeatBounces = 0;

              const isClimbingUp = plat.y <= sim.highestPlatformY + 25;
              if (plat.y < sim.highestPlatformY) {
                sim.highestPlatformY = plat.y;
              }

              let didFlowLevelUp = false;

              if (isClimbingUp) {
                sim.timeSinceLastClimb = 0;
                const prevCombo = sim.combo;
                const stepGain =
                  (plat.type === 'bounce' ? 2 : 1) *
                  fine.flowGainRate *
                  charPerks.flowGainMultiplier;
                sim.flowEnergy = Math.min(
                  20,
                  sim.flowEnergy + stepGain / FLOW_PLATFORMS_PER_STEP
                );
                syncFlowStateFromEnergy(sim);

                didFlowLevelUp = sim.combo > prevCombo && sim.combo >= 1;

                if (sim.combo > sim.maxFlowThisRun) sim.maxFlowThisRun = sim.combo;
                sim.styleMeter = Math.min(100, sim.styleMeter + 3 * stepGain);

                const auraMult = hasPowerUp('rhythm_aura') ? 1.5 : 1.0;
                const styleInfo = calculateStyleRank(sim.combo, sim.styleMeter);
                const rawStepPoints =
                  (0.7 + Math.min(1.5, sim.combo * 0.12)) *
                  styleInfo.multiplier *
                  auraMult *
                  charPerks.scoreMultiplier;
                sim.score += Math.max(1, Math.round(rawStepPoints));

                if (prevCombo < FLOW_THRESHOLDS.HARMONIC && sim.combo >= FLOW_THRESHOLDS.HARMONIC) {
                  sim.score += 5;
                  if (!sim.isMuted) audioRef.current.sfxLevelUp(activePlatBiome, c);
                  spawnFloatingText(
                    `FLOW x${FLOW_THRESHOLDS.HARMONIC}`,
                    300,
                    plat.y - 36,
                    activePlatBiome.horizonColor,
                    1.0
                  );
                  spawnShockwave(p.x + 10, plat.y, activePlatBiome.fg, 90);
                } else if (
                  prevCombo < FLOW_THRESHOLDS.SUBDIVISION &&
                  sim.combo >= FLOW_THRESHOLDS.SUBDIVISION
                ) {
                  sim.score += 8;
                  if (!sim.isMuted) audioRef.current.sfxLevelUp(activePlatBiome, c);
                  spawnFloatingText(
                    `FLOW x${FLOW_THRESHOLDS.SUBDIVISION}`,
                    300,
                    plat.y - 36,
                    activePlatBiome.horizonColor,
                    1.0
                  );
                  spawnShockwave(p.x + 10, plat.y, activePlatBiome.horizonColor, 95);
                } else if (prevCombo < FLOW_THRESHOLDS.CHORD && sim.combo >= FLOW_THRESHOLDS.CHORD) {
                  sim.score += 12;
                  grantTemporaryPowerUp(
                    activePlatBiome,
                    `FLOW x${FLOW_THRESHOLDS.CHORD}`,
                    'combo_shield'
                  );
                } else if (
                  prevCombo < FLOW_THRESHOLDS.OVERDRIVE &&
                  sim.combo >= FLOW_THRESHOLDS.OVERDRIVE
                ) {
                  sim.score += 25;
                  grantTemporaryPowerUp(
                    activePlatBiome,
                    `OMNI x${FLOW_THRESHOLDS.OVERDRIVE}`
                  );
                }
              } else {
                const dropDistPx = plat.y - sim.highestPlatformY;
                const platformsMissed = Math.floor(dropDistPx / Math.max(100, flowDiff.stepY));
                if (platformsMissed >= 2) {
                  const penalty =
                    Math.min(3.2, platformsMissed * 0.65) *
                    fine.flowDecayRate *
                    charPerks.stallDecayMultiplier;
                  sim.flowEnergy = Math.max(0, sim.flowEnergy - penalty);
                  syncFlowStateFromEnergy(sim);
                  sim.highestPlatformY = plat.y;
                  spawnFloatingText(
                    `-${penalty.toFixed(1)} FLOW`,
                    300,
                    plat.y - 28,
                    '#fb7185',
                    0.95
                  );
                }
              }

              sim.particles.burst(p.x + p.w * 0.5, plat.y, pCol, 7, 4, 'dust');

              if (!sim.isMuted) {
                let res;
                if (sim.mode === 'STAGE') {
                  const cluster = plat.customClusterFreqs || [plat.noteFreq || 261.63];
                  res = audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    cluster,
                    activeBank,
                    didFlowLevelUp,
                    plat.beatDurationRatio || 1.0
                  );
                  if (plat.customSynthFreqs && plat.customSynthFreqs.length > 0) {
                    plat.customSynthFreqs.forEach((sFreq) => {
                      audioRef.current.playCustomSynthNote(
                        sFreq,
                        plat.customSynthDurationSec || 1.2,
                        c
                      );
                    });
                  }
                } else if (sim.mode === 'SEQUENCER' || sim.mode === 'MIDI') {
                  const cluster = sim.seqData[sim.seqIdx % sim.seqData.length] || [261.63];
                  res = audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    cluster,
                    activeBank,
                    didFlowLevelUp
                  );
                  sim.seqIdx = (sim.seqIdx + 1) % Math.max(1, sim.seqData.length);
                } else {
                  res = audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    undefined,
                    activeBank,
                    didFlowLevelUp
                  );
                }
                if (res.notes[0]) {
                  plat.noteFreq = res.notes[0];
                  sim.recentPlayedPlatformNotes.push(res.notes[0]);
                  if (sim.recentPlayedPlatformNotes.length > 6) {
                    sim.recentPlayedPlatformNotes.shift();
                  }
                }
                if (res.subdivisionRingDelaysSec.length > 0) {
                  res.subdivisionRingDelaysSec.forEach((delaySec, idx) => {
                    sim.pendingRhythmRings.push({
                      triggerAt: sim.gameTime + delaySec,
                      color:
                        idx % 2 === 0
                          ? activePlatBiome.horizonColor
                          : activePlatBiome.fg,
                      maxR: 54 + idx * 18,
                    });
                  });
                }
              } else if (plat.noteFreq) {
                sim.recentPlayedPlatformNotes.push(plat.noteFreq);
                if (sim.recentPlayedPlatformNotes.length > 6) {
                  sim.recentPlayedPlatformNotes.shift();
                }
              }
            } else {
              plat.repeatBounces = (plat.repeatBounces || 0) + 1;
              const dropDistPx = plat.y - sim.highestPlatformY;
              const platformsMissed = Math.floor(dropDistPx / Math.max(100, flowDiff.stepY));

              if (platformsMissed >= 2) {
                const dropPenalty =
                  Math.min(3.5, platformsMissed * 0.7) *
                  fine.flowDecayRate *
                  charPerks.stallDecayMultiplier;
                sim.flowEnergy = Math.max(0, sim.flowEnergy - dropPenalty);
                syncFlowStateFromEnergy(sim);
                sim.highestPlatformY = plat.y;
                sim.styleMeter = Math.max(0, sim.styleMeter - 18);
                spawnFloatingText(
                  `-${dropPenalty.toFixed(1)} FLOW`,
                  300,
                  plat.y - 28,
                  '#fb7185',
                  0.95
                );
              } else if (plat.repeatBounces >= 1) {
                const stallPenalty =
                  0.42 *
                  Math.min(3, plat.repeatBounces) *
                  fine.flowDecayRate *
                  charPerks.stallDecayMultiplier;
                sim.flowEnergy = Math.max(0, sim.flowEnergy - stallPenalty);
                syncFlowStateFromEnergy(sim);
                sim.styleMeter = Math.max(0, sim.styleMeter - 10);
              }

              if (!sim.isMuted) {
                if (sim.mode === 'STAGE') {
                  const cluster = plat.customClusterFreqs || [plat.noteFreq || 261.63];
                  audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    cluster,
                    activeBank,
                    false
                  );
                } else if (sim.mode === 'SEQUENCER' || sim.mode === 'MIDI') {
                  const cluster = sim.seqData[sim.seqIdx % sim.seqData.length] || [261.63];
                  audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    cluster,
                    activeBank,
                    false
                  );
                } else {
                  audioRef.current.playPlatformNote(
                    activePlatBiome,
                    sim.combo,
                    c,
                    undefined,
                    activeBank,
                    false
                  );
                }
              }
              sim.particles.burst(p.x + p.w * 0.5, plat.y, pCol, 4, 2.5, 'dust');
            }
            break;
          }
        }
      }

      // Collectible Harmonic Orbs & Magnet Power-Up + Avatar Perks
      const magnetRadius =
        (hasPowerUp('orb_magnet') ? 175 : 42) + charPerks.bonusMagnetRadiusPx;
      for (let i = 0; i < sim.orbs.length; i++) {
        const orb = sim.orbs[i];
        if (orb.collected) continue;
        const dx = p.x + p.w * 0.5 - orb.x;
        const dy = p.y + p.h * 0.5 - orb.y;
        const dist = Math.hypot(dx, dy);

        if (dist < magnetRadius && dist > 1) {
          orb.x += (dx / dist) * 390 * dt;
          orb.y += (dy / dist) * 390 * dt;
        }

        if (dist < p.w * 0.8 + orb.radius) {
          orb.collected = true;
          const orbGain = Math.random() < charPerks.doubleOrbChance ? 2 : 1;
          sim.orbsThisRun += orbGain;
          sim.flowEnergy = Math.min(
            45,
            sim.flowEnergy + 0.14 * fine.flowGainRate * charPerks.flowGainMultiplier
          );
          syncFlowStateFromEnergy(sim);
          if (sim.combo > sim.maxFlowThisRun) sim.maxFlowThisRun = sim.combo;
          sim.styleMeter = Math.min(100, sim.styleMeter + 6);
          sim.score += Math.round(orbGain * charPerks.scoreMultiplier);
          if (!sim.isMuted) audioRef.current.sfxOrbCollect(biome, c);
          sim.particles.burst(orb.x, orb.y, biome.horizonColor, 10, 4.5, 'spark');

          if (sim.orbsThisRun % 6 === 0) {
            grantTemporaryPowerUp(biome, 'ORB BONUS');
          }
        }
      }

      // ONE-WAY UPWARD CAMERA TRACKING DURING NORMAL PLAY
      const viewH = sim.viewH || 800;
      const targetCamY = p.y - viewH * 0.56;
      if (targetCamY < sim.camY) {
        sim.camY += (targetCamY - sim.camY) * Math.min(1, dt * 8.5);
      }

      if (sim.shake > 0.1) {
        sim.camY += (Math.random() - 0.5) * sim.shake;
        sim.shake *= Math.pow(0.86, frameScale);
      } else {
        sim.shake = 0;
      }

      if (sim.aberration > 0.02) {
        sim.aberration *= Math.pow(0.88, frameScale);
      } else {
        sim.aberration = 0;
      }

      const currentAlt = Math.floor(Math.abs(Math.min(0, p.y - 782)) / 100);
      if (currentAlt > sim.score) sim.score = currentAlt;

      // Optimized culling
      const cullBottomY = sim.camY + viewH + 60;
      if (sim.platforms.length > 0 && sim.platforms[0].y >= cullBottomY) {
        sim.platforms = sim.platforms.filter((pl) => pl.y < cullBottomY);
      }
      if (sim.aerialHazards.length > 16) {
        sim.aerialHazards = sim.aerialHazards.filter((ah) => ah.active && ah.y < cullBottomY);
      }
      if (sim.orbs.length > 24) {
        sim.orbs = sim.orbs.filter((o) => !o.collected && o.y < cullBottomY);
      }

      // Update Particles, Shockwaves & Texts
      sim.particles.update(dt);
      for (let i = 0; i < sim.shockwaves.length; i++) {
        const sw = sim.shockwaves[i];
        sw.r += (sw.maxR - sw.r) * 0.18 * frameScale;
        sw.alpha -= 0.05 * frameScale;
      }
      for (let i = 0; i < sim.texts.length; i++) {
        const ft = sim.texts[i];
        if (!ft.active) continue;
        ft.y += ft.vy * frameScale;
        ft.life -= 0.025 * frameScale;
        if (ft.life <= 0) ft.active = false;
      }

      // Shield Fall Rescue at bottom of screen
      if (p.vy > 0 && p.y > sim.camY + viewH - 40 && p.hasShield) {
        p.hasShield = false;
        sim.activePowerUps = sim.activePowerUps.filter((u) => u.id !== 'combo_shield');
        sim.activeJumpGravity = kin.gravityPxPerSec2;
        p.vy = kin.bouncePadVelocityPxPerSec * 1.1;
        if (!sim.isMuted) audioRef.current.sfxShieldBreak(biome, c);
        spawnShockwave(p.x + 12, p.y, biome.horizonColor, 100);
        spawnFloatingText('🛡 SAVED', 300, p.y - 25, biome.horizonColor, 1.05);
      }

      // Trigger 3-Phase Fall -> Center-Screen Shatter/Glitter -> Pixelated Dissolve Defeat Sequence!
      if (p.vy > 0 && p.y > sim.camY + viewH - 15 && !p.hasShield && !sim.dyingSequence.active) {
        audioRef.current.stopChoir();
        if (!sim.isMuted) audioRef.current.sfxComboLost(biome, c);
        sim.dyingSequence = {
          active: true,
          phase: 'falling',
          timer: 0,
          dissolveProgress: 0,
          glitters: [],
        };
      }

      // Direct DOM HUD updates (Minimal Icon-Driven Format)
      const milestoneInfo = getFlowMilestoneInfo(sim.combo, sim.flowSubSteps);
      const rankObj = calculateStyleRank(sim.combo, sim.styleMeter);

      if (scoreDomRef.current) {
        scoreDomRef.current.textContent = String(Math.round(sim.score)).padStart(4, '0');
      }
      if (altDomRef.current) {
        altDomRef.current.textContent = `${currentAlt}M`;
      }
      if (orbsDomRef.current) {
        orbsDomRef.current.textContent = `${sim.orbsThisRun}`;
      }
      if (comboTextDomRef.current) {
        comboTextDomRef.current.textContent = `FLOW x${sim.combo}`;
        comboTextDomRef.current.style.color = biome.fg;
      }
      if (milestoneDomRef.current) {
        milestoneDomRef.current.textContent = `>x${milestoneInfo.nextThreshold}`;
      }
      if (comboBarDomRef.current) {
        comboBarDomRef.current.style.width = `${milestoneInfo.progressPct.toFixed(1)}%`;
        comboBarDomRef.current.style.backgroundColor = biome.fg;
      }
      if (rankBadgeDomRef.current) {
        rankBadgeDomRef.current.textContent = rankObj.rank;
        rankBadgeDomRef.current.style.color = biome.fg;
        rankBadgeDomRef.current.style.borderColor = biome.fg;
      }
      if (biomeTagDomRef.current) {
        biomeTagDomRef.current.textContent = c.useBiomes
          ? `${biome.name} · ${biome.subtitle}`
          : `${activeBank.name}`;
        biomeTagDomRef.current.style.color = c.useBiomes ? biome.fg : c.fixedColor;
      }

      return ambientPulse;
    };

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dynPace = computeFlowDynamicDifficulty(
        simRef.current.flowEnergy,
        simRef.current.cfg.fineTune
      ).paceMultiplier;
      const clampedDt = Math.min(0.04, Math.max(0.001, rawDt)) * dynPace;

      const ambientPulse = stepSimulation(clampedDt);

      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      const sim = simRef.current;
      const biome = getScaleByIndex(sim.activeBiomeIdx, sim.cfg);

      renderGameFrame(
        ctx,
        600,
        sim.viewH || 800,
        sim.camY,
        sim.gameTime,
        ambientPulse,
        sim.combo,
        biome,
        sim.cfg,
        sim.player,
        sim.platforms,
        sim.orbs,
        sim.particles,
        sim.texts,
        sim.aberration,
        sim.shockwaves,
        MASTER_SCALES,
        sim.activePowerUps,
        sim.biomeDissolve,
        sim.aerialHazards,
        sim.chordComboHud,
        sim.dyingSequence
      );
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    generateWorldUpTo,
    getActiveSoundBank,
    getScaleByIndex,
    grantTemporaryPowerUp,
    pickRandomEnabledSoundBankId,
    spawnFloatingText,
    spawnShockwave,
  ]);

  // --- STORE UNLOCK & TOGGLE HANDLERS ---
  const handleUnlockSoundBank = (bank: SoundBankDef) => {
    if (cfg.unlockedSoundBanks.includes(bank.id)) return;
    if (stats.totalOrbs < bank.costOrbs) return;
    setStats((prev) => ({ ...prev, totalOrbs: prev.totalOrbs - bank.costOrbs }));
    setCfg((prev) => ({
      ...prev,
      unlockedSoundBanks: [...prev.unlockedSoundBanks, bank.id],
      enabledSoundBanks: [...prev.enabledSoundBanks, bank.id],
    }));
    if (!isMuted) {
      audioRef.current.previewNote(392.0, cfg, bank);
    }
  };

  const handleToggleSoundBank = (bankId: string, enabled: boolean) => {
    setCfg((prev) => {
      const next = enabled
        ? Array.from(new Set([...prev.enabledSoundBanks, bankId]))
        : prev.enabledSoundBanks.filter((id) => id !== bankId);
      return {
        ...prev,
        enabledSoundBanks: next.length > 0 ? next : [prev.unlockedSoundBanks[0] || 'crt_velvet'],
      };
    });
  };

  const handleUnlockScale = (scaleBiome: ScaleBiome) => {
    if (cfg.unlockedScales.includes(scaleBiome.id)) return;
    if (stats.totalOrbs < scaleBiome.costOrbs) return;
    setStats((prev) => ({ ...prev, totalOrbs: prev.totalOrbs - scaleBiome.costOrbs }));
    setCfg((prev) => ({
      ...prev,
      unlockedScales: [...prev.unlockedScales, scaleBiome.id],
      enabledScales: [...prev.enabledScales, scaleBiome.id],
    }));
    if (!isMuted) {
      audioRef.current.playChordGate(scaleBiome, 0, cfg, getActiveSoundBank(cfg));
    }
  };

  const handleToggleScale = (scaleId: number, enabled: boolean) => {
    setCfg((prev) => {
      const next = enabled
        ? Array.from(new Set([...prev.enabledScales, scaleId]))
        : prev.enabledScales.filter((id) => id !== scaleId);
      return {
        ...prev,
        enabledScales: next.length > 0 ? next : [prev.unlockedScales[0] ?? 0],
      };
    });
  };

  const handleSelectAvatar = (avatarId: CharacterAvatarDef['id']) => {
    setCfg((prev) => ({ ...prev, playerShape: avatarId }));
    if (!isMuted) {
      audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
    }
  };

  const handleUnlockAvatar = (avatar: CharacterAvatarDef) => {
    if (cfg.unlockedAvatars.includes(avatar.id)) return;
    if (stats.totalOrbs < avatar.costOrbs) return;
    setStats((prev) => ({ ...prev, totalOrbs: prev.totalOrbs - avatar.costOrbs }));
    setCfg((prev) => ({
      ...prev,
      unlockedAvatars: Array.from(new Set([...prev.unlockedAvatars, avatar.id])),
      playerShape: avatar.id,
    }));
    if (!isMuted) {
      audioRef.current.sfxLevelUp(MASTER_SCALES[0], cfg);
    }
  };

  const handleSetExactOrbs = (orbs: number) => {
    setStats((prev) => ({ ...prev, totalOrbs: Math.max(0, Math.round(orbs)) }));
  };

  const toggleSeqCell = (stepIdx: number, noteKey: string) => {
    const freq = NOTES_MAP[noteKey];
    if (!isMuted && freq) {
      audioRef.current.previewNote(freq, cfg, getActiveSoundBank(cfg));
    }
    setSeqGrid((prev) => {
      const next = prev.map((col) => [...col]);
      const col = next[stepIdx];
      if (col.includes(noteKey)) {
        next[stepIdx] = col.filter((k) => k !== noteKey);
      } else {
        next[stepIdx] = [...col, noteKey].slice(-3);
      }
      return next;
    });
  };

  const applyPreset = (presetKey: string) => {
    const preset = SEQUENCER_PRESETS[presetKey];
    if (!preset) return;
    setActivePreset(presetKey);
    setCfg((prev) => ({ ...prev, synthWaveform: preset.wave }));
    const newGrid: string[][] = Array.from({ length: 16 }, () => []);
    preset.steps.forEach((freqs, stepIdx) => {
      const matchedKeys: string[] = [];
      freqs.forEach((f) => {
        let closestKey = 'C4';
        let minDiff = Infinity;
        for (const [k, nf] of Object.entries(NOTES_MAP)) {
          const diff = Math.abs(nf - f);
          if (diff < minDiff) {
            minDiff = diff;
            closestKey = k;
          }
        }
        if (!matchedKeys.includes(closestKey)) matchedKeys.push(closestKey);
      });
      newGrid[stepIdx] = matchedKeys;
    });
    setSeqGrid(newGrid);
    if (!isMuted && preset.steps[0]?.[0]) {
      audioRef.current.previewNote(preset.steps[0][0], cfg, getActiveSoundBank(cfg));
    }
  };

  const startSequencerRun = () => {
    const compiledSteps: number[][] = [];
    seqGrid.forEach((col) => {
      if (col.length > 0) {
        compiledSteps.push(col.map((k) => NOTES_MAP[k] || 261.63));
      }
    });
    if (compiledSteps.length === 0) {
      compiledSteps.push([261.63], [329.63], [392.0], [523.25]);
    }
    startNewRun('SEQUENCER', compiledSteps);
  };

  const handleMidiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMidiStatus(`LOADING ${file.name.toUpperCase()}...`);
    try {
      const buf = await file.arrayBuffer();
      const importedStage = parseMidiBufferToStage(
        buf,
        file.name,
        cfg.enabledScales[0] ?? 0,
        cfg.enabledSoundBanks[0] ?? 'crt_velvet'
      );
      setCustomStages((prev) => [importedStage, ...prev]);
      setActiveStageId(importedStage.id);
      setMidiStatus(`READY: ${importedStage.notes.length} NOTES`);
      setTimeout(() => {
        startNewRun('STAGE', undefined, true, importedStage);
      }, 380);
    } catch {
      setMidiStatus('MIDI ERROR');
    }
  };

  // --- DEVELOPER CONFIG + CUSTOM STAGES BUNDLE EXPORT / IMPORT ---
  const buildDeveloperBundleObject = () => ({
    bundleType: 'NEON_ASCENT_OMNI_DEV_BUNDLE_V1',
    exportedAt: new Date().toISOString(),
    fineTune: cfg.fineTune || DEFAULT_FINE_TUNE,
    audioMixer: {
      volMaster: cfg.volMaster,
      volNotes: cfg.volNotes,
      volIntervals: cfg.volIntervals,
      volChords: cfg.volChords,
      volBass: cfg.volBass,
      volChoir: cfg.volChoir,
    },
    playerShape: cfg.playerShape,
    customStages,
  });

  const handleExportDevBundleFile = () => {
    const bundle = buildDeveloperBundleObject();
    const jsonText = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Neon_Ascent_Omni_Dev_Bundle.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDevBundleStatus(
      `EXPORTED DEV BUNDLE (${customStages.length} STAGES + 16 FINE-TUNE PARAMS)`
    );
  };

  const handleCopyDevBundleClipboard = async () => {
    try {
      const jsonText = JSON.stringify(buildDeveloperBundleObject(), null, 2);
      await navigator.clipboard.writeText(jsonText);
      setDevBundleStatus('COPIED DEV BUNDLE JSON TO CLIPBOARD!');
    } catch {
      setDevBundleStatus('CLIPBOARD COPY FAILED — USE DOWNLOAD BUTTON');
    }
  };

  const handleImportDevBundleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.fineTune) {
        setCfg((prev) => ({
          ...prev,
          fineTune: {
            ...DEFAULT_FINE_TUNE,
            ...parsed.fineTune,
          },
          ...(parsed.audioMixer || {}),
        }));
      }
      if (Array.isArray(parsed.customStages) && parsed.customStages.length > 0) {
        setCustomStages(parsed.customStages);
        setActiveStageId(parsed.customStages[0].id);
      }
      setDevBundleStatus(`IMPORTED BUNDLE FROM ${file.name.toUpperCase()}`);
    } catch {
      setDevBundleStatus('INVALID DEV BUNDLE JSON FILE');
    }
    e.target.value = '';
  };

  const selectedAvatarDef = getCharacterById(cfg.playerShape);
  const uniqueTraditions = ['ALL', ...Array.from(new Set(MASTER_SCALES.map((s) => s.tradition)))];
  const filteredScales =
    traditionFilter === 'ALL'
      ? MASTER_SCALES
      : MASTER_SCALES.filter((s) => s.tradition === traditionFilter);

  return (
    <main className="fixed inset-0 w-full h-full bg-[#04050a] flex items-center justify-center overflow-hidden select-none font-pixel">
      {/* Core Game Viewport: Fullscreen Edge-to-Edge on Mobile, 600x800 Cabinet on Desktop */}
      <div
        ref={containerRef}
        id="game-container"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const vh = simRef.current.viewH || 800;
          pointerEyeRef.current = {
            x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * 600,
            y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * vh,
            activeUntil: performance.now() + 2500,
          };
        }}
        className="relative w-full h-full md:max-w-[600px] md:max-h-[800px] md:border md:border-slate-800 bg-[#04050a] shadow-[0_0_90px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          id="canvas"
          data-testid="game-canvas"
          width={600}
          height={800}
          className="block w-full h-full"
        />

        {cfg.crtScanlines && (
          <div className="pointer-events-none absolute inset-0 crt-scanlines crt-vignette z-10" />
        )}

        {/* --- MINIMAL ICON-FIRST PLAYING HUD --- */}
        <div
          id="ui-hud"
          className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-200 ${
            screen === 'playing' || screen === 'paused' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Compact Top-Left Score & Icon Metrics */}
          <div className="absolute top-3.5 left-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <div
                ref={scoreDomRef}
                id="score"
                className="text-lg text-white drop-shadow-[0_2px_0_#000]"
              >
                0000
              </div>
              <div className="text-[9px] text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">
                  +<span ref={altDomRef}>0M</span>
                </span>
                <span className="text-amber-400">
                  *<span ref={orbsDomRef}>0</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                ref={comboTextDomRef}
                id="combo-meter"
                className="text-[9px] text-emerald-300"
              >
                FLOW x0
              </span>
              <span ref={milestoneDomRef} className="text-[8px] text-slate-400">
                &gt;x3
              </span>
            </div>

            <div className="relative w-36 h-1.5 bg-slate-900/90 border border-slate-700/80 overflow-hidden">
              <div
                ref={comboBarDomRef}
                id="combo-bar-fill"
                className="relative h-full bg-emerald-400 transition-none"
                style={{ width: '0%' }}
              />
            </div>
          </div>

          {/* Compact Top-Right Grade Badge & System Icon Buttons */}
          <div className="absolute top-3.5 right-4 flex items-center gap-1.5">
            <div
              ref={rankBadgeDomRef}
              className="text-sm px-2 py-1 border-2 border-slate-600 bg-slate-950/90 text-slate-300"
              title="Style Grade"
            >
              D
            </div>

            <div className="pointer-events-auto flex items-center gap-1">
              <button
                type="button"
                tabIndex={-1}
                aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setIsMuted((m) => !m);
                }}
                className="w-7 h-7 flex items-center justify-center bg-slate-900/90 border border-slate-700 hover:border-white text-slate-200 transition-colors cursor-pointer"
                title="Mute [M]"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                  {isMuted ? (
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  ) : (
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game"
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (screen === 'playing') {
                    audioRef.current.suspend();
                    setScreen('paused');
                  } else if (screen === 'paused') {
                    if (!isMuted) audioRef.current.resume();
                    setScreen('playing');
                  }
                }}
                className="w-7 h-7 flex items-center justify-center bg-slate-900/90 border border-slate-700 hover:border-white text-slate-200 transition-colors cursor-pointer"
                title="Pause [P]"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart Run"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startNewRun(gameMode, undefined, true, simRef.current.activeStage);
                }}
                className="w-7 h-7 flex items-center justify-center bg-slate-900/90 border border-slate-700 hover:border-white text-slate-200 transition-colors cursor-pointer"
                title="Restart [R]"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bottom-Right Compact Biome & Key Indicator */}
          <div
            ref={biomeTagDomRef}
            id="biome-tag"
            className="absolute bottom-3.5 right-4 text-[8px] tracking-wider uppercase text-emerald-400 opacity-85"
          >
            NEON GRID · C Minor Nine
          </div>

          {/* Mobile Touch Controls */}
          <div className="pointer-events-auto md:hidden absolute bottom-12 inset-x-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Move Left"
                onTouchStart={(e) => {
                  e.preventDefault();
                  simRef.current.inputs.left = true;
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  simRef.current.inputs.left = false;
                }}
                className="w-16 h-14 bg-slate-900/80 border border-slate-600 active:border-emerald-400 text-white text-sm flex items-center justify-center"
              >
                ◀
              </button>
              <button
                type="button"
                aria-label="Move Right"
                onTouchStart={(e) => {
                  e.preventDefault();
                  simRef.current.inputs.right = true;
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  simRef.current.inputs.right = false;
                }}
                className="w-16 h-14 bg-slate-900/80 border border-slate-600 active:border-emerald-400 text-white text-sm flex items-center justify-center"
              >
                ▶
              </button>
            </div>
            <button
              type="button"
              aria-label="Phase Dash"
              onTouchStart={(e) => {
                e.preventDefault();
                simRef.current.inputs.dashJustPressed = true;
              }}
              className="w-20 h-14 bg-slate-900/80 border border-emerald-500 active:bg-emerald-500/30 text-emerald-300 text-[10px] flex items-center justify-center"
            >
              ⚡DASH
            </button>
          </div>
        </div>

        {/* --- MINIMAL ICON-FIRST TITLE SCREEN OVERLAY --- */}
        {screen === 'title' && (
          <div
            id="start-screen"
            className="absolute inset-0 z-30 bg-[#04050a]/84 flex flex-col items-center justify-between py-6 px-5 text-center"
          >
            {/* Top Minimal Icon Bar */}
            <div className="w-full flex items-center justify-between text-[9px] text-slate-300 border-b border-slate-800/80 pb-3">
              <span title="High Score">
                BEST <strong className="text-amber-400">{stats.highScore}</strong>
              </span>
              <span title="Max Flow">
                FLOW <strong className="text-emerald-400">x{stats.maxCombo}</strong>
              </span>
              <span title="Harmonic Orbs">
                ORBS <strong className="text-cyan-400">{stats.totalOrbs}</strong>
              </span>
            </div>

            <div className="my-auto flex flex-col items-center max-w-xs w-full">
              <svg
                viewBox="0 0 460 105"
                className="w-full max-w-[360px] h-auto mb-3 overflow-visible"
                role="img"
                aria-label="Neon Ascent: Omni"
              >
                <defs>
                  <linearGradient id="omniTitleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00ff88" />
                    <stop offset="50%" stopColor="#00d4ff" />
                    <stop offset="100%" stopColor="#ff2a85" />
                  </linearGradient>
                </defs>
                <rect
                  x="216"
                  y="8"
                  width="28"
                  height="28"
                  fill="none"
                  stroke="url(#omniTitleGrad)"
                  strokeWidth="3"
                />
                <rect x="225" y="17" width="10" height="10" fill="#00ff88" />
                <line x1="60" y1="22" x2="198" y2="22" stroke="#1e293b" strokeWidth="2" />
                <line x1="262" y1="22" x2="400" y2="22" stroke="#1e293b" strokeWidth="2" />
                <text
                  x="230"
                  y="72"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontFamily="'Press Start 2P', monospace"
                  fontSize="24"
                  letterSpacing="3"
                >
                  NEON ASCENT
                </text>
                <text
                  x="230"
                  y="96"
                  textAnchor="middle"
                  fill="url(#omniTitleGrad)"
                  fontFamily="'Press Start 2P', monospace"
                  fontSize="10"
                  letterSpacing="5"
                >
                  OMNI EDITION
                </text>
              </svg>

              <div className="flex flex-col items-center gap-2 w-full mt-1">
                {/* Primary Play Action */}
                <button
                  type="button"
                  data-start="true"
                  data-testid="start-play-btn"
                  onClick={() => startNewRun('STANDARD')}
                  className="w-full py-3.5 px-6 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs tracking-wider uppercase transition-transform active:scale-95 cursor-pointer shadow-[0_0_25px_rgba(0,255,136,0.35)]"
                >
                  &gt; PLAY
                </button>

                {/* Compact Selected Character Button */}
                <button
                  type="button"
                  id="open-characters-btn"
                  data-testid="open-characters-btn"
                  onClick={() => {
                    if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                    setScreen('characters');
                  }}
                  className="w-full py-2 px-3 bg-slate-900/95 hover:bg-slate-800 border border-cyan-400/75 hover:border-cyan-300 transition-colors cursor-pointer flex items-center justify-between gap-2 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <SelectedAvatarMiniBadge
                      avatarId={cfg.playerShape}
                      primaryColor="#00ff88"
                      horizonColor="#00d4ff"
                    />
                    <div className="min-w-0">
                      <div className="text-[9px] text-white uppercase truncate">
                        {selectedAvatarDef.name}
                      </div>
                      <div className="text-[7px] text-cyan-300 truncate mt-0.5">
                        * {selectedAvatarDef.perkTitle}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] text-cyan-300 shrink-0">&gt;</span>
                </button>

                {/* Minimal 2x2 Icon Grid for Stage DAW, Store, 16-Seq & MIDI */}
                <div className="grid grid-cols-2 gap-2 w-full">
                  <button
                    type="button"
                    id="open-stage-creator-btn"
                    data-testid="open-stage-creator-btn"
                    onClick={() => {
                      if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                      setScreen('stage_creator');
                    }}
                    className="py-2.5 px-3 bg-slate-900/95 hover:bg-slate-800 border border-emerald-400/80 hover:border-emerald-300 text-emerald-300 text-[9px] uppercase transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>🎹 DAW</span>
                    <span className="text-[8px] text-slate-400">{customStages.length}</span>
                  </button>

                  <button
                    type="button"
                    id="open-store-btn"
                    data-testid="open-store-btn"
                    onClick={() => {
                      if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                      setScreen('store');
                    }}
                    className="py-2.5 px-3 bg-slate-900/95 hover:bg-slate-800 border border-amber-400/80 hover:border-amber-300 text-amber-300 text-[9px] uppercase transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>🛒 SHOP</span>
                    <span className="text-[8px] text-cyan-300">{stats.totalOrbs}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                      setScreen('sequencer');
                    }}
                    className="py-2.5 px-3 bg-slate-900/90 hover:bg-slate-800 border border-slate-600 hover:border-cyan-400 text-cyan-300 text-[9px] uppercase transition-colors cursor-pointer"
                  >
                    🎛 16-SEQ
                  </button>

                  <label
                    htmlFor="midi-upload-input"
                    className="py-2.5 px-3 bg-slate-900/90 hover:bg-slate-800 border border-slate-600 hover:border-pink-400 text-pink-300 text-[9px] uppercase transition-colors cursor-pointer text-center"
                  >
                    📂 +MIDI
                  </label>
                  <input
                    id="midi-upload-input"
                    type="file"
                    accept=".mid,.midi"
                    onChange={handleMidiUpload}
                    className="hidden"
                  />
                </div>

                {/* Config / Export / Install Row */}
                <div className="flex items-center justify-center gap-2 w-full">
                  <button
                    type="button"
                    id="open-settings-btn"
                    data-testid="open-settings-btn"
                    onClick={() => {
                      if (!isMuted) audioRef.current.sfxUiClick(MASTER_SCALES[0], cfg);
                      setScreen('settings');
                    }}
                    className="flex-1 py-2 px-2.5 bg-transparent hover:bg-slate-900 border border-slate-700 hover:border-white text-slate-300 text-[8px] uppercase transition-colors cursor-pointer"
                  >
                    # FINE-TUNE
                  </button>

                  <button
                    type="button"
                    onClick={handleExportDevBundleFile}
                    className="py-2 px-2.5 bg-transparent hover:bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-300 text-[8px] uppercase transition-colors cursor-pointer"
                    title="Export Dev Bundle (.JSON)"
                  >
                    .JSON
                  </button>

                  {deferredInstallPrompt && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deferredInstallPrompt.prompt();
                        await deferredInstallPrompt.userChoice;
                        setDeferredInstallPrompt(null);
                      }}
                      className="py-2 px-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400 text-emerald-300 text-[8px] uppercase cursor-pointer"
                      title="Install App on Android / Desktop"
                    >
                      📲 APP
                    </button>
                  )}
                </div>
              </div>

              {midiStatus && (
                <div className="mt-2 text-[8px] text-amber-400">{midiStatus}</div>
              )}
            </div>

            {/* Minimal Icon Legend */}
            <div className="flex items-center justify-center gap-4 text-[8px] text-slate-400">
              <span>&lt;&gt; STEER</span>
              <span>TILT</span>
              <span>SHIFT DASH</span>
            </div>
          </div>
        )}

        {/* --- REACTIVE-EYE CHARACTER SELECTOR MODAL --- */}
        {screen === 'characters' && (
          <CharacterSelectModal
            selectedAvatarId={cfg.playerShape}
            unlockedAvatars={cfg.unlockedAvatars}
            totalOrbs={stats.totalOrbs}
            primaryColor="#00ff88"
            horizonColor="#00d4ff"
            onSelectAvatar={handleSelectAvatar}
            onUnlockAvatar={handleUnlockAvatar}
            onSetOrbs={handleSetExactOrbs}
            onClose={() => setScreen('title')}
          />
        )}

        {/* --- CREATE STAGE (DAW PIANO ROLL & STAGE MANAGER) MODAL --- */}
        {screen === 'stage_creator' && (
          <StageCreatorModal
            stages={customStages}
            activeStageId={activeStageId}
            cfg={cfg}
            audioEngine={audioRef.current}
            isMuted={isMuted}
            onSaveStages={(nextStages, nextActiveId) => {
              setCustomStages(nextStages);
              if (nextActiveId) setActiveStageId(nextActiveId);
            }}
            onPlayStage={(stage) => {
              setActiveStageId(stage.id);
              startNewRun('STAGE', undefined, true, stage);
            }}
            onClose={() => setScreen('title')}
          />
        )}

        {/* --- MINIMAL ICON-DRIVEN HARMONIC STORE MODAL --- */}
        {screen === 'store' && (
          <div
            id="store-screen"
            className="absolute inset-0 z-30 bg-[#05070f]/96 flex flex-col justify-between p-4 overflow-hidden text-[9px]"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">🛒</span>
                <h2 className="text-xs text-white tracking-wider uppercase">
                  SHOP
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 bg-slate-900 border border-amber-400/60 text-[9px] text-amber-300">
                  ● <strong id="store-orb-count">{stats.totalOrbs}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setScreen('title')}
                  className="px-3 py-1.5 bg-emerald-400 text-slate-950 text-[9px] uppercase cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Store Category Tabs + Orb Set / Reset Input */}
            <div className="flex flex-wrap items-center justify-between gap-2 my-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStoreTab('banks')}
                  className={`px-2 py-1.5 text-[8px] uppercase border cursor-pointer ${
                    storeTab === 'banks'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  🔊 SYNTH ({cfg.unlockedSoundBanks.length}/{SOUND_BANKS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStoreTab('scales')}
                  className={`px-2 py-1.5 text-[8px] uppercase border cursor-pointer ${
                    storeTab === 'scales'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  ♫ KEYS ({cfg.unlockedScales.length}/{MASTER_SCALES.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStoreTab('characters')}
                  className={`px-2 py-1.5 text-[8px] uppercase border cursor-pointer ${
                    storeTab === 'characters'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  ◈ AVATARS ({cfg.unlockedAvatars.length}/{CHARACTER_AVATARS.length})
                </button>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={999999}
                  placeholder="Orbs..."
                  value={storeOrbInput}
                  onChange={(e) => setStoreOrbInput(e.target.value)}
                  className="w-20 px-1.5 py-1 bg-slate-950 border border-slate-700 text-[8px] text-amber-300"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = parseInt(storeOrbInput, 10);
                    if (!Number.isNaN(val)) {
                      handleSetExactOrbs(val);
                      setStoreOrbInput('');
                    }
                  }}
                  className="px-2 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[8px] uppercase cursor-pointer"
                >
                  SET
                </button>
              </div>
            </div>

            {storeTab === 'banks' ? (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {SOUND_BANKS.map((bank) => {
                  const unlocked = cfg.unlockedSoundBanks.includes(bank.id);
                  const enabled = cfg.enabledSoundBanks.includes(bank.id);
                  const canAfford = stats.totalOrbs >= bank.costOrbs;

                  return (
                    <div
                      key={bank.id}
                      className={`p-2.5 border flex items-center justify-between gap-2 ${
                        unlocked
                          ? 'bg-slate-900/75 border-slate-700'
                          : 'bg-slate-950/80 border-slate-800/80'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-white">{bank.name}</span>
                          <span className="text-[7px] px-1 py-0.5 bg-slate-800 text-cyan-300 border border-slate-700">
                            {bank.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => audioRef.current.previewNote(329.63, cfg, bank)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[8px] text-slate-200 cursor-pointer"
                          title="Listen"
                        >
                          ▶
                        </button>

                        {unlocked ? (
                          <label className="flex items-center gap-1 px-2 py-1 bg-slate-950 border border-emerald-500/50 text-[8px] text-emerald-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) => handleToggleSoundBank(bank.id, e.target.checked)}
                              className="accent-emerald-400"
                            />
                            <span>ON</span>
                          </label>
                        ) : (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => handleUnlockSoundBank(bank)}
                            className={`px-2 py-1 text-[8px] border cursor-pointer ${
                              canAfford
                                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300'
                                : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {bank.costOrbs}●
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : storeTab === 'scales' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex flex-wrap items-center gap-1 mb-2">
                  {uniqueTraditions.map((tr) => (
                    <button
                      key={tr}
                      type="button"
                      onClick={() => setTraditionFilter(tr)}
                      className={`px-1.5 py-0.5 text-[7px] border cursor-pointer ${
                        traditionFilter === tr
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {tr}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {filteredScales.map((sc) => {
                    const unlocked = cfg.unlockedScales.includes(sc.id);
                    const enabled = cfg.enabledScales.includes(sc.id);
                    const canAfford = stats.totalOrbs >= sc.costOrbs;

                    return (
                      <div
                        key={sc.id}
                        className={`p-2 border flex items-center justify-between gap-2 ${
                          unlocked
                            ? 'bg-slate-900/75 border-slate-700'
                            : 'bg-slate-950/80 border-slate-800/80'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span style={{ color: sc.fg }} className="text-[9px]">
                              {sc.name}
                            </span>
                            <span className="text-[7px] text-slate-300">{sc.subtitle}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              audioRef.current.playChordGate(sc, 0, cfg, getActiveSoundBank(cfg))
                            }
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[8px] text-slate-200 cursor-pointer"
                          >
                            ▶
                          </button>

                          {unlocked ? (
                            <label className="flex items-center gap-1 px-2 py-1 bg-slate-950 border border-emerald-500/50 text-[8px] text-emerald-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => handleToggleScale(sc.id, e.target.checked)}
                                className="accent-emerald-400"
                              />
                              <span>ON</span>
                            </label>
                          ) : (
                            <button
                              type="button"
                              disabled={!canAfford}
                              onClick={() => handleUnlockScale(sc)}
                              className={`px-2 py-1 text-[8px] border cursor-pointer ${
                                canAfford
                                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300'
                                  : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              {sc.costOrbs}●
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {CHARACTER_AVATARS.map((av) => {
                  const unlocked = cfg.unlockedAvatars.includes(av.id);
                  const isEquipped = cfg.playerShape === av.id;
                  const canAfford = stats.totalOrbs >= av.costOrbs;

                  return (
                    <div
                      key={av.id}
                      className={`p-2 border flex items-center justify-between gap-2 ${
                        isEquipped
                          ? 'bg-emerald-950/30 border-emerald-400'
                          : unlocked
                          ? 'bg-slate-900/75 border-slate-700'
                          : 'bg-slate-950/80 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <SelectedAvatarMiniBadge
                          avatarId={av.id}
                          primaryColor="#00ff88"
                          horizonColor="#00d4ff"
                        />
                        <div className="min-w-0">
                          <div className="text-[9px] text-white truncate">{av.name}</div>
                          <div className="text-[7px] text-emerald-300 truncate mt-0.5">
                            {av.perkTitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {unlocked ? (
                          <button
                            type="button"
                            onClick={() => handleSelectAvatar(av.id)}
                            className={`px-2.5 py-1 text-[8px] border uppercase cursor-pointer ${
                              isEquipped
                                ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                                : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
                            }`}
                          >
                            {isEquipped ? '✓' : 'USE'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => handleUnlockAvatar(av)}
                            className={`px-2 py-1 text-[8px] border cursor-pointer ${
                              canAfford
                                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300'
                                : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {av.costOrbs}●
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- 16-STEP VISUAL PIANO ROLL SEQUENCER MODAL --- */}
        {screen === 'sequencer' && (
          <div
            id="piano-screen"
            className="absolute inset-0 z-30 bg-[#060810]/96 flex flex-col justify-between p-4 overflow-y-auto text-[9px]"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h2 className="text-xs text-white tracking-wider uppercase">
                🎛 16-STEP SEQ
              </h2>
              <button
                type="button"
                onClick={() => setScreen('title')}
                className="px-3 py-1.5 border border-slate-700 hover:border-white text-[9px] text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="my-2 flex flex-wrap items-center gap-1.5">
              {Object.entries(SEQUENCER_PRESETS).map(([key, pr]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className={`px-2 py-1 text-[8px] border transition-colors cursor-pointer whitespace-nowrap ${
                    activePreset === key
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {pr.name}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-x-auto border border-slate-800 bg-slate-950/90 p-2">
              <div className="min-w-[510px]">
                <div className="grid grid-cols-[44px_repeat(16,1fr)] gap-1 mb-1 text-[8px] text-slate-500 text-center">
                  <div>♪</div>
                  {Array.from({ length: 16 }, (_, s) => (
                    <div key={s} className={s % 4 === 0 ? 'text-emerald-400' : ''}>
                      {s + 1}
                    </div>
                  ))}
                </div>

                {[...NOTE_KEYS].reverse().map((noteKey) => (
                  <div
                    key={noteKey}
                    className="grid grid-cols-[44px_repeat(16,1fr)] gap-1 mb-1 items-center"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        audioRef.current.previewNote(
                          NOTES_MAP[noteKey],
                          cfg,
                          getActiveSoundBank(cfg)
                        )
                      }
                      className="text-[8px] text-left px-1 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                    >
                      {noteKey}
                    </button>
                    {Array.from({ length: 16 }, (_, stepIdx) => {
                      const isActive = seqGrid[stepIdx]?.includes(noteKey);
                      return (
                        <button
                          key={stepIdx}
                          type="button"
                          aria-label={`Step ${stepIdx + 1} Note ${noteKey}`}
                          onClick={() => toggleSeqCell(stepIdx, noteKey)}
                          className={`h-5 border transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-emerald-400 border-white shadow-[0_0_8px_#00ff88]'
                              : stepIdx % 4 === 0
                              ? 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                              : 'bg-slate-950 border-slate-900 hover:border-slate-700'
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSeqGrid(Array.from({ length: 16 }, () => []))}
                className="px-3 py-2 border border-rose-500/70 hover:bg-rose-500/10 text-rose-400 text-[9px] uppercase cursor-pointer"
              >
                🗑 CLEAR
              </button>

              <button
                type="button"
                onClick={startSequencerRun}
                className="px-5 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[9px] uppercase cursor-pointer shadow-[0_0_20px_rgba(0,255,136,0.3)]"
              >
                ▶ PLAY SEQ
              </button>
            </div>
          </div>
        )}

        {/* --- SYSTEM CONFIG & DEVELOPER FINE-TUNE SLIDERS (FULL 16 SLIDERS PRESERVED) --- */}
        {screen === 'settings' && (
          <div
            id="settings-screen"
            className="absolute inset-0 z-30 bg-[#060810]/96 flex flex-col justify-between p-4 overflow-y-auto text-[9px]"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
              <div>
                <h2 className="text-xs text-white tracking-wider uppercase">
                  ⚙ FINE-TUNE &amp; CONFIG
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setScreen('title')}
                className="px-3 py-1.5 bg-emerald-400 text-slate-950 text-[9px] uppercase cursor-pointer"
              >
                ✓ DONE
              </button>
            </div>

            <div className="space-y-3.5 my-2.5 text-[9px]">
              {/* 01. Developer Bundle Export / Import */}
              <div className="bg-slate-900/80 border border-emerald-500/50 p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <span className="text-emerald-400 uppercase">
                    01. Dev Bundle (.JSON)
                  </span>
                  <span className="text-[8px] text-slate-400">
                    {customStages.length} Stages
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    id="export-dev-bundle-btn"
                    onClick={handleExportDevBundleFile}
                    className="px-2.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[8px] uppercase cursor-pointer"
                  >
                    ⬇ DOWNLOAD .JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyDevBundleClipboard}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-cyan-400/70 text-cyan-300 text-[8px] uppercase cursor-pointer"
                  >
                    📋 COPY
                  </button>
                  <label
                    htmlFor="import-dev-bundle-input"
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-amber-400/70 text-amber-300 text-[8px] uppercase cursor-pointer"
                  >
                    📂 IMPORT
                  </label>
                  <input
                    id="import-dev-bundle-input"
                    type="file"
                    accept=".json,.txt"
                    onChange={handleImportDevBundleFile}
                    className="hidden"
                  />
                </div>
                {devBundleStatus && (
                  <div className="text-[8px] text-amber-300 pt-1">{devBundleStatus}</div>
                )}
              </div>

              {/* 02. 16 Developer Fine-Tune Sliders */}
              <div className="bg-slate-900/60 border border-slate-800 p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <span className="text-cyan-400 uppercase">
                    02. Fine-Tune Parameters (16 Sliders)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCfg((prev) => ({
                        ...prev,
                        fineTune: { ...DEFAULT_FINE_TUNE },
                      }));
                      setDevBundleStatus('RESET ALL 16 SLIDERS TO DEFAULT');
                    }}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[8px] text-amber-300 cursor-pointer"
                  >
                    RESET
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  {FINE_TUNE_SLIDERS.map((sl) => {
                    const currentVal =
                      (cfg.fineTune && cfg.fineTune[sl.key]) ?? DEFAULT_FINE_TUNE[sl.key];
                    return (
                      <div
                        key={sl.key}
                        className="p-2 bg-slate-950/70 border border-slate-800/80 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white text-[8px]">{sl.label}</span>
                          <span className="text-emerald-300 text-[8px]">
                            {currentVal}
                            {sl.unit}
                          </span>
                        </div>
                        <div className="text-[7px] text-slate-400">{sl.desc}</div>
                        <input
                          type="range"
                          min={sl.min}
                          max={sl.max}
                          step={sl.step}
                          value={currentVal}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCfg((prev) => ({
                              ...prev,
                              fineTune: {
                                ...(prev.fineTune || DEFAULT_FINE_TUNE),
                                [sl.key]: val,
                              },
                            }));
                          }}
                          className="w-full accent-cyan-400 mt-0.5"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 03. Harmonic Web Audio Mixer */}
              <div className="bg-slate-900/60 border border-slate-800 p-3 space-y-2">
                <div className="text-pink-400 uppercase border-b border-slate-800 pb-1">
                  03. Audio Mixer
                </div>
                <div className="flex items-center justify-between">
                  <span>Master Gain</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={cfg.volMaster}
                    onChange={(e) => setCfg({ ...cfg, volMaster: parseFloat(e.target.value) })}
                    className="w-32 accent-pink-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Lead Pluck Notes</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={cfg.volNotes}
                    onChange={(e) => setCfg({ ...cfg, volNotes: parseFloat(e.target.value) })}
                    className="w-32 accent-pink-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Sub-Bass &amp; 5ths</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={cfg.volIntervals}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        volIntervals: parseFloat(e.target.value),
                        volBass: parseFloat(e.target.value),
                      })
                    }
                    className="w-32 accent-pink-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Chord Gates</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={cfg.volChords}
                    onChange={(e) => setCfg({ ...cfg, volChords: parseFloat(e.target.value) })}
                    className="w-32 accent-pink-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Synth Pad</span>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={cfg.volChoir}
                    onChange={(e) => setCfg({ ...cfg, volChoir: parseFloat(e.target.value) })}
                    className="w-32 accent-pink-400"
                  />
                </div>
              </div>

              {/* 04. Cyber-Biomes, Sensors & Post-Processing */}
              <div className="bg-slate-900/60 border border-slate-800 p-3 space-y-2">
                <div className="text-amber-400 uppercase border-b border-slate-800 pb-1">
                  04. Sensors &amp; Visuals
                </div>
                <div className="flex items-center justify-between">
                  <span>Android Gravity Tilt</span>
                  <input
                    type="checkbox"
                    checked={cfg.tiltControlEnabled !== false}
                    onChange={(e) =>
                      setCfg({ ...cfg, tiltControlEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Dynamic Biomes</span>
                  <input
                    type="checkbox"
                    checked={cfg.useBiomes}
                    onChange={(e) => setCfg({ ...cfg, useBiomes: e.target.checked })}
                    className="w-4 h-4 accent-emerald-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>CRT Scanlines</span>
                  <input
                    type="checkbox"
                    checked={cfg.crtScanlines}
                    onChange={(e) => setCfg({ ...cfg, crtScanlines: e.target.checked })}
                    className="w-4 h-4 accent-emerald-400"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- MINIMAL PAUSE MODAL --- */}
        {screen === 'paused' && (
          <div
            id="pause-screen"
            className="absolute inset-0 z-30 bg-[#04050a]/90 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-full max-w-xs border border-slate-700 bg-slate-950 p-5">
              <h2 className="text-base text-white mb-5">⏸ PAUSED</h2>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!isMuted) audioRef.current.resume();
                    setScreen('playing');
                  }}
                  className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[10px] uppercase cursor-pointer"
                >
                  ▶ RESUME
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startNewRun(gameMode, undefined, true, simRef.current.activeStage)
                  }
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-[10px] uppercase cursor-pointer"
                >
                  ↻ RESTART
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioRef.current.stopChoir();
                    setScreen('title');
                  }}
                  className="w-full py-3 bg-transparent hover:bg-rose-950/40 border border-rose-500/60 text-rose-400 text-[10px] uppercase cursor-pointer"
                >
                  ⌂ MENU
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- MINIMAL GAME OVER MODAL WITH FAST PIXELATED DISSOLVE REVEAL --- */}
        {screen === 'gameover' && (
          <div
            id="game-over-screen"
            data-testid="game-over-screen"
            className="pixel-dissolve-enter absolute inset-0 z-30 bg-[#04050a]/92 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-full max-w-sm border-2 border-slate-700 bg-slate-950 p-5">
              <h2
                id="go-msg"
                className={`text-base mb-5 ${
                  endSnapshot.isNewRecord ? 'text-amber-400' : 'text-rose-500'
                }`}
              >
                {endSnapshot.isNewRecord ? '* NEW RECORD!' : '* SHATTERED *'}
              </h2>

              <div className="grid grid-cols-3 gap-2 mb-5 text-[9px]">
                <div className="bg-slate-900 border border-slate-800 p-2.5">
                  <div className="text-[7px] text-slate-400">SCORE</div>
                  <div id="go-score" className="text-sm text-white mt-1">
                    {endSnapshot.score}
                  </div>
                  <div className="text-[7px] text-amber-400 mt-1">
                    BEST {endSnapshot.best}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5">
                  <div className="text-[7px] text-slate-400">FLOW</div>
                  <div className="text-sm text-emerald-400 mt-1">
                    x{endSnapshot.maxFlow}
                  </div>
                  <div className="text-[7px] text-slate-400 mt-1">
                    +{endSnapshot.altitude}M
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5">
                  <div className="text-[7px] text-slate-400">RANK</div>
                  <div className="text-sm text-cyan-400 mt-1">
                    {endSnapshot.rank}
                  </div>
                  <div className="text-[7px] text-amber-300 mt-1">
                    *{endSnapshot.orbsCollected}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  data-start="true"
                  onClick={() =>
                    startNewRun(gameMode, undefined, true, simRef.current.activeStage)
                  }
                  className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[10px] uppercase cursor-pointer"
                >
                  &gt; RETRY
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScreen('store')}
                    className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-amber-400/70 text-amber-300 text-[9px] uppercase cursor-pointer"
                  >
                    SHOP ({stats.totalOrbs})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreen('title')}
                    className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[9px] uppercase cursor-pointer"
                  >
                    MENU
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
