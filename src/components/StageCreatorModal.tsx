import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  GameConfig,
  MASTER_SCALES,
  SOUND_BANKS,
  ScaleBiome,
  SoundBankDef,
  CHROMATIC_12_NOTES,
  computeSmartHslBiomePalette,
  createCustomBiomeFromHsl,
  getAllBiomes,
} from '../game/rules';
import {
  CustomStage,
  StageNoteEvent,
  StageSynthEvent,
  StageBarFlowRule,
  STEPS_PER_BAR,
  STEPS_PER_BEAT,
  AVAILABLE_NOTE_DURATIONS,
  buildBiomePianoRollRows,
  parseMidiBufferToStage,
  getBiomeForBar,
} from '../game/stages';
import { OmniAudioEngine } from '../game/audioEngine';

interface StageCreatorModalProps {
  stages: CustomStage[];
  activeStageId: string;
  cfg: GameConfig;
  audioEngine: OmniAudioEngine;
  isMuted: boolean;
  onSaveStages: (nextStages: CustomStage[], newActiveId?: string) => void;
  onSaveCustomBiomes?: (nextBiomes: ScaleBiome[]) => void;
  onPlayStage: (stage: CustomStage) => void;
  onClose: () => void;
}

interface NoteSnapshotItem {
  id: string;
  origStep: number;
  origRowIdx: number;
  origDurationBeats: number;
}

interface NoteDragState {
  mode: 'move' | 'resize-left' | 'resize-right';
  channel: 'lead' | 'synth';
  anchorNoteId: string;
  startX: number;
  startY: number;
  items: NoteSnapshotItem[];
  hasMoved: boolean;
}

interface MarqueeSelectState {
  active: boolean;
  additive: boolean;
  startStepFloat: number;
  startRowFloat: number;
  curStepFloat: number;
  curRowFloat: number;
}

interface CopiedNoteClip {
  relStep: number;
  freq: number;
  noteName: string;
  durationBeats: number;
}

const CELL_W = 38;
const CELL_H = 28;
const PIANO_KEY_W = 110;
const HEADER_H = 73; // Sticky bar header + step ruler height

export default function StageCreatorModal({
  stages,
  activeStageId,
  cfg,
  audioEngine,
  isMuted,
  onSaveStages,
  onSaveCustomBiomes,
  onPlayStage,
  onClose,
}: StageCreatorModalProps) {
  const initialStage =
    stages.find((s) => s.id === activeStageId) || stages[0];

  const [viewMode, setViewMode] = useState<'daw' | 'manager' | 'custom_biomes'>('daw');
  const [activeChannel, setActiveChannel] = useState<'lead' | 'synth'>('lead');
  const [toolMode, setToolMode] = useState<'draw' | 'select'>('draw');
  const [selectedDurationBeats, setSelectedDurationBeats] = useState<number>(1.0);
  const [activeBarIdx, setActiveBarIdx] = useState<number>(0);
  const [loopActiveBar, setLoopActiveBar] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string>('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<MarqueeSelectState | null>(null);

  // Custom Biome Builder State (Default: all 12 chromatic keys active!)
  const [cbName, setCbName] = useState<string>('CYBER AURORA');
  const [cbHue, setCbHue] = useState<number>(185);
  const [cbSat, setCbSat] = useState<number>(92);
  const [cbLight, setCbLight] = useState<number>(56);
  const [cbActiveKeys, setCbActiveKeys] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  ]);
  const [cbChordNames, setCbChordNames] = useState<[string, string, string, string]>([
    'Cm9',
    'Abmaj7',
    'Fm9',
    'G7sus4',
  ]);
  const [cbChordIndices, setCbChordIndices] = useState<
    [[number, number, number, number], [number, number, number, number], [number, number, number, number], [number, number, number, number]]
  >([
    [0, 3, 7, 10],
    [8, 0, 3, 7],
    [5, 8, 0, 3],
    [7, 10, 2, 5],
  ]);
  const [cbTripletIndices, setCbTripletIndices] = useState<[number, number, number]>([0, 3, 7]);

  const allBiomes = useMemo(
    () => getAllBiomes(cfg.customBiomes),
    [cfg.customBiomes]
  );

  // Working Stage State in the DAW
  const [draft, setDraft] = useState<CustomStage>(() => ({
    ...initialStage,
    notes: [...initialStage.notes],
    synthNotes: [...(initialStage.synthNotes || [])],
    barFlowRules: [...(initialStage.barFlowRules || [])],
  }));

  // Undo / Redo History Stack
  const historyRef = useRef<CustomStage[]>([]);
  const redoRef = useRef<CustomStage[]>([]);
  const clipboardRef = useRef<CopiedNoteClip[]>([]);

  const pushUndoSnapshot = useCallback((stateToSave: CustomStage) => {
    historyRef.current.push({
      ...stateToSave,
      notes: stateToSave.notes.map((n) => ({ ...n })),
      synthNotes: stateToSave.synthNotes.map((s) => ({ ...s })),
      barFlowRules: stateToSave.barFlowRules.map((r) => ({ ...r })),
    });
    if (historyRef.current.length > 40) {
      historyRef.current.shift();
    }
    redoRef.current = [];
  }, []);

  const flashBanner = useCallback((msg: string) => {
    setStatusBanner(msg);
    window.setTimeout(() => {
      setStatusBanner((prev) => (prev === msg ? '' : prev));
    }, 2200);
  }, []);

  // Live References for Real-Time Playback & Event Listeners
  const draftRef = useRef<CustomStage>(draft);
  draftRef.current = draft;
  const mutedRef = useRef<boolean>(isMuted);
  mutedRef.current = isMuted;
  const cfgRef = useRef<GameConfig>(cfg);
  cfgRef.current = cfg;
  const selectedIdsRef = useRef<string[]>(selectedNoteIds);
  selectedIdsRef.current = selectedNoteIds;
  const activeChannelRef = useRef<'lead' | 'synth'>(activeChannel);
  activeChannelRef.current = activeChannel;
  const activeBarIdxRef = useRef<number>(activeBarIdx);
  activeBarIdxRef.current = activeBarIdx;
  const loopActiveBarRef = useRef<boolean>(loopActiveBar);
  loopActiveBarRef.current = loopActiveBar;

  // Interactive Note Drag & Marquee Selection Refs
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<NoteDragState | null>(null);
  const marqueeRef = useRef<MarqueeSelectState | null>(null);
  const lastPreviewedFreqRef = useRef<number>(0);
  const suppressNextClickRef = useRef<boolean>(false);

  // Live DAW Playback Transport State
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playheadStep, setPlayheadStep] = useState<number>(-1);
  const playTimerRef = useRef<number | null>(null);
  const currentStepRef = useRef<number>(0);

  // Active Biome for the currently focused Bar
  const activeBarBiome: ScaleBiome = useMemo(
    () => getBiomeForBar(draft, activeBarIdx, cfg.customBiomes),
    [draft, activeBarIdx, cfg.customBiomes]
  );

  const selectedBank: SoundBankDef = useMemo(
    () => SOUND_BANKS.find((b) => b.id === draft.soundBankId) || SOUND_BANKS[0],
    [draft.soundBankId]
  );

  // Build 4-octave pitch rows for the currently active Bar's Biome
  const pitchRows = useMemo(
    () => buildBiomePianoRollRows(activeBarBiome),
    [activeBarBiome]
  );
  const pitchRowsRef = useRef(pitchRows);
  pitchRowsRef.current = pitchRows;

  const totalBars = Math.max(1, Math.ceil(draft.totalSteps / STEPS_PER_BAR));

  const findRowIdxForFreq = useCallback((freq: number): number => {
    const rows = pitchRowsRef.current;
    let bestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < rows.length; i++) {
      const d = Math.abs(rows[i].freq - freq);
      if (d < minDiff) {
        minDiff = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, []);

  // Stop preview timer on unmount
  useEffect(() => {
    return () => {
      if (playTimerRef.current !== null) {
        window.clearInterval(playTimerRef.current);
      }
    };
  }, []);

  const stopPreview = useCallback(() => {
    if (playTimerRef.current !== null) {
      window.clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    setIsPlayingPreview(false);
    setPlayheadStep(-1);
  }, []);

  /**
   * Real-time step trigger that always reads `draftRef.current` so any note moved,
   * resized, added, or deleted while playing is heard immediately on the very next step!
   */
  const triggerRealtimeStepAudio = useCallback(
    (stepIdx: number) => {
      const liveDraft = draftRef.current;
      setPlayheadStep(stepIdx);
      const barOfStep = Math.floor(stepIdx / STEPS_PER_BAR);
      setActiveBarIdx(barOfStep);

      if (mutedRef.current) return;

      const liveBank =
        SOUND_BANKS.find((b) => b.id === liveDraft.soundBankId) || SOUND_BANKS[0];

      // Trigger Lead Channel Notes at stepIdx from live draft
      const leadHits = liveDraft.notes.filter((n) => n.step === stepIdx);
      leadHits.forEach((n) => {
        audioEngine.previewNote(n.freq, cfgRef.current, liveBank, n.durationBeats);
      });

      // Trigger Synth Pad Channel Notes at stepIdx from live draft
      const synthHits = liveDraft.synthNotes.filter((s) => s.step === stepIdx);
      synthHits.forEach((s) => {
        const durSec = (60 / Math.max(60, liveDraft.bpm)) * s.durationBeats;
        audioEngine.playCustomSynthNote(s.freq, durSec, cfgRef.current);
      });
    },
    [audioEngine]
  );

  // Dynamically update timer interval if BPM changes during live playback
  useEffect(() => {
    if (!isPlayingPreview) return;
    if (playTimerRef.current !== null) {
      window.clearInterval(playTimerRef.current);
    }
    const stepDurationMs =
      (60 / Math.max(60, draft.bpm) / STEPS_PER_BEAT) * 1000;
    playTimerRef.current = window.setInterval(() => {
      const liveTotal = Math.max(STEPS_PER_BAR, draftRef.current.totalSteps);
      if (loopActiveBarRef.current) {
        const barStart = activeBarIdxRef.current * STEPS_PER_BAR;
        const offsetInBar = (currentStepRef.current - barStart + 1 + STEPS_PER_BAR) % STEPS_PER_BAR;
        currentStepRef.current = Math.min(liveTotal - 1, barStart + offsetInBar);
      } else {
        currentStepRef.current = (currentStepRef.current + 1) % liveTotal;
      }
      triggerRealtimeStepAudio(currentStepRef.current);
    }, stepDurationMs);

    return () => {
      if (playTimerRef.current !== null) {
        window.clearInterval(playTimerRef.current);
      }
    };
  }, [isPlayingPreview, draft.bpm, triggerRealtimeStepAudio]);

  const togglePlayPreview = useCallback(() => {
    if (isPlayingPreview) {
      stopPreview();
      return;
    }
    const startStep = loopActiveBarRef.current
      ? activeBarIdxRef.current * STEPS_PER_BAR
      : playheadStep >= 0
      ? playheadStep
      : 0;
    currentStepRef.current = startStep;
    setIsPlayingPreview(true);
    triggerRealtimeStepAudio(startStep);
  }, [isPlayingPreview, playheadStep, stopPreview, triggerRealtimeStepAudio]);

  // --- PRO PIANO ROLL EDITING ACTIONS (Delete, Undo, Redo, Copy, Paste, Duplicate to Empty Bar, Transpose, Quantize) ---

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) {
      flashBanner('NOTHING TO UNDO');
      return;
    }
    redoRef.current.push({
      ...draftRef.current,
      notes: draftRef.current.notes.map((n) => ({ ...n })),
      synthNotes: draftRef.current.synthNotes.map((s) => ({ ...s })),
      barFlowRules: draftRef.current.barFlowRules.map((r) => ({ ...r })),
    });
    setDraft(prev);
    flashBanner('UNDO');
  }, [flashBanner]);

  const handleRedo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) {
      flashBanner('NOTHING TO REDO');
      return;
    }
    historyRef.current.push({
      ...draftRef.current,
      notes: draftRef.current.notes.map((n) => ({ ...n })),
      synthNotes: draftRef.current.synthNotes.map((s) => ({ ...s })),
      barFlowRules: draftRef.current.barFlowRules.map((r) => ({ ...r })),
    });
    setDraft(next);
    flashBanner('REDO');
  }, [flashBanner]);

  const handleDeleteSelectedNotes = useCallback(() => {
    const sel = selectedIdsRef.current;
    if (sel.length === 0) return;
    pushUndoSnapshot(draftRef.current);
    const idSet = new Set(sel);
    setDraft((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => !idSet.has(n.id)),
      synthNotes: prev.synthNotes.filter((s) => !idSet.has(s.id)),
    }));
    setSelectedNoteIds([]);
    flashBanner(`DELETED ${sel.length} NOTE${sel.length > 1 ? 'S' : ''}`);
  }, [flashBanner, pushUndoSnapshot]);

  const handleSelectAllNotes = useCallback(() => {
    const list =
      activeChannelRef.current === 'lead'
        ? draftRef.current.notes
        : draftRef.current.synthNotes;
    const allIds = list.map((n) => n.id);
    setSelectedNoteIds(allIds);
    flashBanner(`SELECTED ALL (${allIds.length} NOTES)`);
  }, [flashBanner]);

  const handleCopySelectedNotes = useCallback(() => {
    const ch = activeChannelRef.current;
    const pool = ch === 'lead' ? draftRef.current.notes : draftRef.current.synthNotes;
    const selSet = new Set(selectedIdsRef.current);
    const selectedEvents = pool.filter((n) => selSet.has(n.id));

    if (selectedEvents.length === 0) {
      flashBanner('SELECT NOTES FIRST TO COPY');
      return;
    }

    const minStep = Math.min(...selectedEvents.map((n) => n.step));
    clipboardRef.current = selectedEvents.map((n) => ({
      relStep: n.step - minStep,
      freq: n.freq,
      noteName: n.noteName,
      durationBeats: n.durationBeats,
    }));
    flashBanner(`COPIED ${selectedEvents.length} NOTE${selectedEvents.length > 1 ? 'S' : ''}`);
  }, [flashBanner]);

  const handlePasteNotes = useCallback(() => {
    const clips = clipboardRef.current;
    if (clips.length === 0) {
      flashBanner('CLIPBOARD EMPTY');
      return;
    }

    pushUndoSnapshot(draftRef.current);
    const ch = activeChannelRef.current;
    const targetStartStep =
      playheadStep >= 0 ? playheadStep : activeBarIdxRef.current * STEPS_PER_BAR;

    const maxClipRelStep = Math.max(...clips.map((c) => c.relStep));
    const neededSteps = targetStartStep + maxClipRelStep + STEPS_PER_BAR;

    const newIds: string[] = [];
    const createdEvents = clips.map((c, idx) => {
      const id = `${ch}_paste_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
      newIds.push(id);
      return {
        id,
        step: targetStartStep + c.relStep,
        freq: c.freq,
        noteName: c.noteName,
        durationBeats: c.durationBeats,
      };
    });

    setDraft((prev) => {
      const nextTotalSteps = Math.max(
        prev.totalSteps,
        Math.min(128, Math.ceil(neededSteps / STEPS_PER_BAR) * STEPS_PER_BAR)
      );
      const nextBars = Math.ceil(nextTotalSteps / STEPS_PER_BAR);
      const nextRules: StageBarFlowRule[] = Array.from({ length: nextBars }, (_, bIdx) => {
        const existing = prev.barFlowRules.find((r) => r.barIndex === bIdx);
        return (
          existing || {
            barIndex: bIdx,
            minFlow: 0,
            maxFlow: 45,
            biomeId: prev.biomeId,
          }
        );
      });

      return {
        ...prev,
        totalSteps: nextTotalSteps,
        barFlowRules: nextRules,
        notes:
          ch === 'lead'
            ? [
                ...prev.notes.filter(
                  (existing) =>
                    !createdEvents.some(
                      (ce) =>
                        ce.step === existing.step &&
                        Math.abs(ce.freq - existing.freq) < 1.5
                    )
                ),
                ...createdEvents,
              ]
            : prev.notes,
        synthNotes:
          ch === 'synth'
            ? [
                ...prev.synthNotes.filter(
                  (existing) =>
                    !createdEvents.some(
                      (ce) =>
                        ce.step === existing.step &&
                        Math.abs(ce.freq - existing.freq) < 1.5
                    )
                ),
                ...createdEvents,
              ]
            : prev.synthNotes,
      };
    });

    setSelectedNoteIds(newIds);
    setActiveBarIdx(Math.floor(targetStartStep / STEPS_PER_BAR));
    flashBanner(`PASTED ${createdEvents.length} NOTE${createdEvents.length > 1 ? 'S' : ''}`);
  }, [flashBanner, playheadStep, pushUndoSnapshot]);

  /**
   * Ctrl + B: Duplicates selected notes (or all notes in the active bar if none selected)
   * and places them into the NEAREST EMPTY BAR! Automatically adds a bar if all bars have notes.
   */
  const handleDuplicateToNearestEmptyBar = useCallback(() => {
    const live = draftRef.current;
    const ch = activeChannelRef.current;
    const pool = ch === 'lead' ? live.notes : live.synthNotes;
    const selSet = new Set(selectedIdsRef.current);

    let sourceNotes = pool.filter((n) => selSet.has(n.id));
    if (sourceNotes.length === 0) {
      // Fallback: duplicate notes from currently focused bar
      const barStart = activeBarIdxRef.current * STEPS_PER_BAR;
      const barEnd = barStart + STEPS_PER_BAR;
      sourceNotes = pool.filter((n) => n.step >= barStart && n.step < barEnd);
    }

    if (sourceNotes.length === 0) {
      flashBanner('SELECT NOTES OR A BAR WITH NOTES TO DUPLICATE [Ctrl+B]');
      return;
    }

    pushUndoSnapshot(live);

    const minStep = Math.min(...sourceNotes.map((n) => n.step));
    const maxStep = Math.max(...sourceNotes.map((n) => n.step));
    const sourceStartBar = Math.floor(minStep / STEPS_PER_BAR);
    const sourceEndBar = Math.floor(maxStep / STEPS_PER_BAR);
    const barSpan = Math.max(1, sourceEndBar - sourceStartBar + 1);
    const baseBarOffsetStep = sourceStartBar * STEPS_PER_BAR;

    const currentTotalBars = Math.max(1, Math.ceil(live.totalSteps / STEPS_PER_BAR));

    // Find the nearest empty bar (or consecutive empty bar span) starting after sourceEndBar
    const isBarEmpty = (bIdx: number) => {
      const start = bIdx * STEPS_PER_BAR;
      const end = start + STEPS_PER_BAR;
      return !pool.some((n) => n.step >= start && n.step < end);
    };

    let targetBar = -1;
    // Search forward from sourceEndBar + 1 first
    for (let b = sourceEndBar + 1; b < currentTotalBars; b++) {
      if (isBarEmpty(b)) {
        targetBar = b;
        break;
      }
    }
    // If none after, check any earlier empty bar
    if (targetBar === -1) {
      for (let b = 0; b < sourceStartBar; b++) {
        if (isBarEmpty(b)) {
          targetBar = b;
          break;
        }
      }
    }
    // If all existing bars have notes, append a new empty bar at the end!
    if (targetBar === -1) {
      targetBar = currentTotalBars;
    }

    const targetBarStartStep = targetBar * STEPS_PER_BAR;
    const neededTotalBars = Math.max(currentTotalBars, targetBar + barSpan);
    const nextTotalSteps = Math.min(128, neededTotalBars * STEPS_PER_BAR);

    const newIds: string[] = [];
    const duplicatedEvents = sourceNotes
      .map((n, idx) => {
        const relStepFromSourceBar = n.step - baseBarOffsetStep;
        const destStep = targetBarStartStep + relStepFromSourceBar;
        if (destStep >= nextTotalSteps) return null;
        const id = `${ch}_dup_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
        newIds.push(id);
        return {
          id,
          step: destStep,
          freq: n.freq,
          noteName: n.noteName,
          durationBeats: n.durationBeats,
        };
      })
      .filter((x): x is StageNoteEvent => x !== null);

    setDraft((prev) => {
      const finalBars = Math.ceil(nextTotalSteps / STEPS_PER_BAR);
      const nextRules: StageBarFlowRule[] = Array.from({ length: finalBars }, (_, bIdx) => {
        const existing = prev.barFlowRules.find((r) => r.barIndex === bIdx);
        const sourceRule = prev.barFlowRules.find((r) => r.barIndex === sourceStartBar);
        return (
          existing || {
            barIndex: bIdx,
            minFlow: sourceRule?.minFlow ?? 0,
            maxFlow: sourceRule?.maxFlow ?? 45,
            biomeId: sourceRule?.biomeId ?? prev.biomeId,
          }
        );
      });

      return {
        ...prev,
        totalSteps: nextTotalSteps,
        barFlowRules: nextRules,
        notes: ch === 'lead' ? [...prev.notes, ...duplicatedEvents] : prev.notes,
        synthNotes: ch === 'synth' ? [...prev.synthNotes, ...duplicatedEvents] : prev.synthNotes,
      };
    });

    setSelectedNoteIds(newIds);
    setActiveBarIdx(targetBar);
    flashBanner(`DUPLICATED ${duplicatedEvents.length} NOTES -> BAR ${targetBar + 1}`);
  }, [flashBanner, pushUndoSnapshot]);

  /**
   * Transpose selected notes vertically across the biome's scale rows (`deltaRows` < 0 = higher pitch, > 0 = lower pitch)
   * or horizontally across steps (`deltaSteps`).
   */
  const handleTransposeOrNudgeSelected = useCallback(
    (deltaSteps: number, deltaRows: number) => {
      const sel = selectedIdsRef.current;
      if (sel.length === 0) return;

      pushUndoSnapshot(draftRef.current);
      const selSet = new Set(sel);
      const rows = pitchRowsRef.current;
      const maxSteps = draftRef.current.totalSteps;
      let previewFreq = 0;

      setDraft((prev) => {
        const transformList = <T extends StageNoteEvent | StageSynthEvent>(list: T[]): T[] =>
          list.map((item) => {
            if (!selSet.has(item.id)) return item;
            const curRowIdx = findRowIdxForFreq(item.freq);
            const nextRowIdx = Math.max(0, Math.min(rows.length - 1, curRowIdx + deltaRows));
            const targetRow = rows[nextRowIdx] || rows[curRowIdx];
            const nextStep = Math.max(0, Math.min(maxSteps - 1, item.step + deltaSteps));
            if (targetRow) previewFreq = targetRow.freq;
            return {
              ...item,
              step: nextStep,
              freq: targetRow ? targetRow.freq : item.freq,
              noteName: targetRow ? targetRow.noteName : item.noteName,
            };
          });

        return {
          ...prev,
          notes: activeChannelRef.current === 'lead' ? transformList(prev.notes) : prev.notes,
          synthNotes:
            activeChannelRef.current === 'synth'
              ? transformList(prev.synthNotes)
              : prev.synthNotes,
        };
      });

      if (previewFreq > 0 && !mutedRef.current && deltaRows !== 0) {
        const liveBank =
          SOUND_BANKS.find((b) => b.id === draftRef.current.soundBankId) || SOUND_BANKS[0];
        audioEngine.previewNote(previewFreq, cfgRef.current, liveBank, selectedDurationBeats);
      }
    },
    [audioEngine, findRowIdxForFreq, pushUndoSnapshot, selectedDurationBeats]
  );

  const handleQuantizeSelected = useCallback(() => {
    const sel = selectedIdsRef.current;
    pushUndoSnapshot(draftRef.current);
    const selSet = new Set(sel);
    const quantizeAll = sel.length === 0;

    setDraft((prev) => {
      const qList = <T extends StageNoteEvent | StageSynthEvent>(list: T[]): T[] =>
        list.map((item) => {
          if (!quantizeAll && !selSet.has(item.id)) return item;
          const qDur = Math.max(
            0.5,
            Math.round(item.durationBeats * STEPS_PER_BEAT) / STEPS_PER_BEAT
          );
          return {
            ...item,
            step: Math.max(0, Math.round(item.step)),
            durationBeats: Number(qDur.toFixed(2)),
          };
        });

      return {
        ...prev,
        notes: activeChannelRef.current === 'lead' ? qList(prev.notes) : prev.notes,
        synthNotes: activeChannelRef.current === 'synth' ? qList(prev.synthNotes) : prev.synthNotes,
      };
    });

    flashBanner(quantizeAll ? 'QUANTIZED ALL CHANNEL NOTES' : `QUANTIZED ${sel.length} NOTES`);
  }, [flashBanner, pushUndoSnapshot]);

  // --- KEYBOARD SHORTCUTS INSIDE DAW MODAL ---
  useEffect(() => {
    const onDawKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'daw') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      // Space: Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        togglePlayPreview();
        return;
      }

      // Delete / Backspace: Delete selected notes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteSelectedNotes();
        return;
      }

      // Escape: Deselect all notes
      if (e.key === 'Escape') {
        if (selectedIdsRef.current.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedNoteIds([]);
          flashBanner('DESELECTED');
        }
        return;
      }

      // Ctrl + B: Duplicate to nearest empty bar
      if (isCmdOrCtrl && e.code === 'KeyB') {
        e.preventDefault();
        e.stopPropagation();
        handleDuplicateToNearestEmptyBar();
        return;
      }

      // Ctrl + C: Copy selected notes
      if (isCmdOrCtrl && e.code === 'KeyC') {
        e.preventDefault();
        e.stopPropagation();
        handleCopySelectedNotes();
        return;
      }

      // Ctrl + V: Paste notes
      if (isCmdOrCtrl && e.code === 'KeyV') {
        e.preventDefault();
        e.stopPropagation();
        handlePasteNotes();
        return;
      }

      // Ctrl + A: Select All
      if (isCmdOrCtrl && e.code === 'KeyA') {
        e.preventDefault();
        e.stopPropagation();
        handleSelectAllNotes();
        return;
      }

      // Ctrl + Z / Ctrl + Y: Undo / Redo
      if (isCmdOrCtrl && e.code === 'KeyZ') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (isCmdOrCtrl && e.code === 'KeyY') {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
        return;
      }

      // Q: Quantize
      if (!isCmdOrCtrl && e.code === 'KeyQ') {
        e.preventDefault();
        e.stopPropagation();
        handleQuantizeSelected();
        return;
      }

      // Arrow keys: Transpose Pitch (Up/Down, Ctrl+Up/Down for Octave) or Nudge Step (Left/Right)
      if (selectedIdsRef.current.length > 0) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          handleTransposeOrNudgeSelected(0, isCmdOrCtrl ? -7 : -1);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          handleTransposeOrNudgeSelected(0, isCmdOrCtrl ? 7 : 1);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          handleTransposeOrNudgeSelected(-1, 0);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          handleTransposeOrNudgeSelected(1, 0);
          return;
        }
      }
    };

    window.addEventListener('keydown', onDawKeyDown, true);
    return () => window.removeEventListener('keydown', onDawKeyDown, true);
  }, [
    flashBanner,
    handleCopySelectedNotes,
    handleDeleteSelectedNotes,
    handleDuplicateToNearestEmptyBar,
    handlePasteNotes,
    handleQuantizeSelected,
    handleRedo,
    handleSelectAllNotes,
    handleTransposeOrNudgeSelected,
    handleUndo,
    togglePlayPreview,
    viewMode,
  ]);

  // --- GLOBAL MOUSE MOVE / UP LISTENERS FOR MULTI-NOTE DRAG, BOTH-EDGE RESIZE & MARQUEE BOX SELECTION ---
  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      // 1. Check Marquee Box Selection Drag
      const m = marqueeRef.current;
      if (m && m.active && gridScrollRef.current) {
        const rect = gridScrollRef.current.getBoundingClientRect();
        const relX =
          e.clientX - rect.left + gridScrollRef.current.scrollLeft - PIANO_KEY_W;
        const relY =
          e.clientY - rect.top + gridScrollRef.current.scrollTop - HEADER_H;

        const curStepFloat = Math.max(0, relX / CELL_W);
        const curRowFloat = Math.max(0, relY / CELL_H);

        if (
          Math.abs(curStepFloat - m.startStepFloat) > 0.18 ||
          Math.abs(curRowFloat - m.startRowFloat) > 0.18
        ) {
          suppressNextClickRef.current = true;
        }

        const updatedMarquee: MarqueeSelectState = {
          ...m,
          curStepFloat,
          curRowFloat,
        };
        marqueeRef.current = updatedMarquee;
        setMarquee(updatedMarquee);

        const minStep = Math.min(m.startStepFloat, curStepFloat);
        const maxStep = Math.max(m.startStepFloat, curStepFloat);
        const minRow = Math.min(m.startRowFloat, curRowFloat);
        const maxRow = Math.max(m.startRowFloat, curRowFloat);

        const pool =
          activeChannelRef.current === 'lead'
            ? draftRef.current.notes
            : draftRef.current.synthNotes;

        const hitIds: string[] = [];
        for (const ev of pool) {
          const evRow = findRowIdxForFreq(ev.freq);
          const evSpanSteps = Math.max(1, ev.durationBeats * STEPS_PER_BEAT);
          const evStartStep = ev.step;
          const evEndStep = ev.step + evSpanSteps;

          const stepOverlaps = evEndStep >= minStep && evStartStep <= maxStep;
          const rowOverlaps = evRow + 1 >= minRow && evRow <= maxRow;
          if (stepOverlaps && rowOverlaps) {
            hitIds.push(ev.id);
          }
        }

        if (m.additive) {
          setSelectedNoteIds((prev) => Array.from(new Set([...prev, ...hitIds])));
        } else {
          setSelectedNoteIds(hitIds);
        }
        return;
      }

      // 2. Check Multi-Note Move or Left/Right Edge Resize Drag
      const d = dragRef.current;
      if (!d) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        d.hasMoved = true;
        suppressNextClickRef.current = true;
      }

      const deltaSteps = Math.round(dx / CELL_W);
      const deltaRows = Math.round(dy / CELL_H);
      const rows = pitchRowsRef.current;
      const maxSteps = draftRef.current.totalSteps;
      const snapshotMap = new Map<string, NoteSnapshotItem>();
      d.items.forEach((it) => snapshotMap.set(it.id, it));
      const anchorSnap = snapshotMap.get(d.anchorNoteId) || d.items[0];

      if (d.mode === 'move') {
        if (anchorSnap) {
          const anchorNextRowIdx = Math.max(
            0,
            Math.min(rows.length - 1, anchorSnap.origRowIdx + deltaRows)
          );
          const anchorTargetRow = rows[anchorNextRowIdx] || rows[0];
          if (
            anchorTargetRow &&
            Math.abs(anchorTargetRow.freq - lastPreviewedFreqRef.current) > 0.5 &&
            !mutedRef.current
          ) {
            lastPreviewedFreqRef.current = anchorTargetRow.freq;
            const liveBank =
              SOUND_BANKS.find((b) => b.id === draftRef.current.soundBankId) ||
              SOUND_BANKS[0];
            if (d.channel === 'lead') {
              audioEngine.previewNote(
                anchorTargetRow.freq,
                cfgRef.current,
                liveBank,
                anchorSnap.origDurationBeats
              );
            } else {
              audioEngine.playCustomSynthNote(anchorTargetRow.freq, 0.8, cfgRef.current);
            }
          }
          const anchorNextStep = Math.max(
            0,
            Math.min(maxSteps - 1, anchorSnap.origStep + deltaSteps)
          );
          setActiveBarIdx(Math.floor(anchorNextStep / STEPS_PER_BAR));
        }

        setDraft((prev) => {
          const moveList = <T extends StageNoteEvent | StageSynthEvent>(list: T[]): T[] =>
            list.map((item) => {
              const snap = snapshotMap.get(item.id);
              if (!snap) return item;
              const nextStep = Math.max(0, Math.min(maxSteps - 1, snap.origStep + deltaSteps));
              const nextRowIdx = Math.max(
                0,
                Math.min(rows.length - 1, snap.origRowIdx + deltaRows)
              );
              const targetRow = rows[nextRowIdx] || rows[0];
              if (!targetRow) return item;
              return {
                ...item,
                step: nextStep,
                freq: targetRow.freq,
                noteName: targetRow.noteName,
              };
            });

          return {
            ...prev,
            notes: d.channel === 'lead' ? moveList(prev.notes) : prev.notes,
            synthNotes: d.channel === 'synth' ? moveList(prev.synthNotes) : prev.synthNotes,
          };
        });
      } else if (d.mode === 'resize-right') {
        if (anchorSnap) {
          const origSpan = Math.max(1, Math.round(anchorSnap.origDurationBeats * STEPS_PER_BEAT));
          const nextSpan = Math.max(1, Math.min(16, origSpan + deltaSteps));
          setSelectedDurationBeats(Number((nextSpan / STEPS_PER_BEAT).toFixed(2)));
        }

        setDraft((prev) => {
          const resizeRightList = <T extends StageNoteEvent | StageSynthEvent>(list: T[]): T[] =>
            list.map((item) => {
              const snap = snapshotMap.get(item.id);
              if (!snap) return item;
              const origSpanSteps = Math.max(
                1,
                Math.round(snap.origDurationBeats * STEPS_PER_BEAT)
              );
              const nextSpanSteps = Math.max(1, Math.min(16, origSpanSteps + deltaSteps));
              const nextDurationBeats = Number((nextSpanSteps / STEPS_PER_BEAT).toFixed(2));
              return {
                ...item,
                durationBeats: nextDurationBeats,
              };
            });

          return {
            ...prev,
            notes: d.channel === 'lead' ? resizeRightList(prev.notes) : prev.notes,
            synthNotes:
              d.channel === 'synth' ? resizeRightList(prev.synthNotes) : prev.synthNotes,
          };
        });
      } else if (d.mode === 'resize-left') {
        if (anchorSnap) {
          const origSpan = Math.max(1, Math.round(anchorSnap.origDurationBeats * STEPS_PER_BEAT));
          const rightEnd = anchorSnap.origStep + origSpan;
          const nextStart = Math.max(
            Math.max(0, rightEnd - 16),
            Math.min(rightEnd - 1, anchorSnap.origStep + deltaSteps)
          );
          const nextSpan = Math.max(1, rightEnd - nextStart);
          setSelectedDurationBeats(Number((nextSpan / STEPS_PER_BEAT).toFixed(2)));
        }

        setDraft((prev) => {
          const resizeLeftList = <T extends StageNoteEvent | StageSynthEvent>(list: T[]): T[] =>
            list.map((item) => {
              const snap = snapshotMap.get(item.id);
              if (!snap) return item;
              const origSpanSteps = Math.max(
                1,
                Math.round(snap.origDurationBeats * STEPS_PER_BEAT)
              );
              const rightEndStep = snap.origStep + origSpanSteps;
              const maxLeftStep = rightEndStep - 1;
              const minLeftStep = Math.max(0, rightEndStep - 16);
              const nextStartStep = Math.max(
                minLeftStep,
                Math.min(maxLeftStep, snap.origStep + deltaSteps)
              );
              const nextSpanSteps = Math.max(1, rightEndStep - nextStartStep);
              const nextDurationBeats = Number((nextSpanSteps / STEPS_PER_BEAT).toFixed(2));
              return {
                ...item,
                step: nextStartStep,
                durationBeats: nextDurationBeats,
              };
            });

          return {
            ...prev,
            notes: d.channel === 'lead' ? resizeLeftList(prev.notes) : prev.notes,
            synthNotes:
              d.channel === 'synth' ? resizeLeftList(prev.synthNotes) : prev.synthNotes,
          };
        });
      }
    };

    const onWindowMouseUp = () => {
      if (marqueeRef.current) {
        marqueeRef.current = null;
        setMarquee(null);
        setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 40);
      }
      if (dragRef.current) {
        dragRef.current = null;
        setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 40);
      }
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [audioEngine, findRowIdxForFreq]);

  /**
   * Starts a drag operation (`move`, `resize-left`, or `resize-right`) for all selected notes
   * (or selects the clicked note if it wasn't part of the current selection).
   */
  const beginNoteDrag = (
    e: React.MouseEvent,
    mode: NoteDragState['mode'],
    clickedNote: StageNoteEvent | StageSynthEvent
  ) => {
    e.stopPropagation();
    pushUndoSnapshot(draftRef.current);

    const ch = activeChannelRef.current;
    const pool = ch === 'lead' ? draftRef.current.notes : draftRef.current.synthNotes;
    const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;

    let activeSelIds = selectedIdsRef.current;
    if (isAdditive) {
      if (activeSelIds.includes(clickedNote.id)) {
        activeSelIds = activeSelIds.filter((id) => id !== clickedNote.id);
      } else {
        activeSelIds = [...activeSelIds, clickedNote.id];
      }
      setSelectedNoteIds(activeSelIds);
    } else if (!activeSelIds.includes(clickedNote.id)) {
      activeSelIds = [clickedNote.id];
      setSelectedNoteIds(activeSelIds);
    }

    const selSet = new Set(activeSelIds.length > 0 ? activeSelIds : [clickedNote.id]);
    const items: NoteSnapshotItem[] = pool
      .filter((n) => selSet.has(n.id))
      .map((n) => ({
        id: n.id,
        origStep: n.step,
        origRowIdx: findRowIdxForFreq(n.freq),
        origDurationBeats: n.durationBeats,
      }));

    lastPreviewedFreqRef.current = clickedNote.freq;
    dragRef.current = {
      mode,
      channel: ch,
      anchorNoteId: clickedNote.id,
      startX: e.clientX,
      startY: e.clientY,
      items,
      hasMoved: false,
    };
  };

  const snapFreqToBiome = (freq: number, targetBiome: ScaleBiome) => {
    const newRows = buildBiomePianoRollRows(targetBiome);
    let best = newRows[0] || { freq: 261.63, noteName: 'C4' };
    let minDiff = Infinity;
    for (const r of newRows) {
      const d = Math.abs(r.freq - freq);
      if (d < minDiff) {
        minDiff = d;
        best = r;
      }
    }
    return best;
  };

  // Change Biome Key for a SPECIFIC BAR (`barIndex`) independently!
  const handleSelectBarBiome = (barIndex: number, newBiomeId: number) => {
    pushUndoSnapshot(draftRef.current);
    const targetBiome =
      allBiomes.find((b) => b.id === newBiomeId) || MASTER_SCALES[0];
    const barStartStep = barIndex * STEPS_PER_BAR;
    const barEndStep = barStartStep + STEPS_PER_BAR;

    setActiveBarIdx(barIndex);

    setDraft((prev) => {
      const rules = [...(prev.barFlowRules || [])];
      const idx = rules.findIndex((r) => r.barIndex === barIndex);
      if (idx >= 0) {
        rules[idx] = { ...rules[idx], biomeId: newBiomeId };
      } else {
        rules.push({
          barIndex,
          minFlow: 0,
          maxFlow: 45,
          biomeId: newBiomeId,
        });
      }

      return {
        ...prev,
        biomeId: barIndex === 0 ? newBiomeId : prev.biomeId,
        barFlowRules: rules,
        notes: prev.notes.map((n) => {
          if (n.step >= barStartStep && n.step < barEndStep) {
            const snapped = snapFreqToBiome(n.freq, targetBiome);
            return { ...n, freq: snapped.freq, noteName: snapped.noteName };
          }
          return n;
        }),
        synthNotes: prev.synthNotes.map((s) => {
          if (s.step >= barStartStep && s.step < barEndStep) {
            const snapped = snapFreqToBiome(s.freq, targetBiome);
            return { ...s, freq: snapped.freq, noteName: snapped.noteName };
          }
          return s;
        }),
      };
    });
  };

  // Change Stage Default Biome Key (sets all bars)
  const handleSelectGlobalBiome = (newBiomeId: number) => {
    pushUndoSnapshot(draftRef.current);
    const targetBiome =
      allBiomes.find((b) => b.id === newBiomeId) || MASTER_SCALES[0];

    setDraft((prev) => ({
      ...prev,
      biomeId: newBiomeId,
      barFlowRules: (prev.barFlowRules || []).map((r) => ({
        ...r,
        biomeId: newBiomeId,
      })),
      notes: prev.notes.map((n) => {
        const snapped = snapFreqToBiome(n.freq, targetBiome);
        return { ...n, freq: snapped.freq, noteName: snapped.noteName };
      }),
      synthNotes: prev.synthNotes.map((s) => {
        const snapped = snapFreqToBiome(s.freq, targetBiome);
        return { ...s, freq: snapped.freq, noteName: snapped.noteName };
      }),
    }));
  };

  /**
   * Handles clicking on an empty grid cell:
   * - If notes are currently selected (or in Select tool mode), clicking empty space DESELECTS all notes!
   * - Otherwise (in Draw mode with nothing selected), clicking adds a new note at `(stepIdx, rowFreq)` and selects it.
   */
  const handleEmptyCellClick = (stepIdx: number, rowFreq: number, rowNoteName: string) => {
    if (suppressNextClickRef.current) return;
    setActiveBarIdx(Math.floor(stepIdx / STEPS_PER_BAR));

    if (selectedNoteIds.length > 0 || toolMode === 'select') {
      setSelectedNoteIds([]);
      return;
    }

    pushUndoSnapshot(draftRef.current);

    if (activeChannel === 'lead') {
      if (!isMuted) {
        audioEngine.previewNote(rowFreq, cfg, selectedBank, selectedDurationBeats);
      }
      const newNote: StageNoteEvent = {
        id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        step: stepIdx,
        freq: rowFreq,
        noteName: rowNoteName,
        durationBeats: selectedDurationBeats,
      };
      setDraft((prev) => ({
        ...prev,
        notes: [...prev.notes, newNote],
      }));
    } else {
      const synthDur = Math.max(0.5, selectedDurationBeats);
      if (!isMuted) {
        const durSec = (60 / Math.max(60, draft.bpm)) * synthDur;
        audioEngine.playCustomSynthNote(rowFreq, durSec, cfg);
      }
      const newSynth: StageSynthEvent = {
        id: `synth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        step: stepIdx,
        freq: rowFreq,
        noteName: rowNoteName,
        durationBeats: synthDur,
      };
      setDraft((prev) => ({
        ...prev,
        synthNotes: [...prev.synthNotes, newSynth],
      }));
    }
  };

  /**
   * Starts a Marquee Box Selection when dragging across empty grid cells.
   */
  const handleEmptyCellMouseDown = (
    e: React.MouseEvent,
    stepIdx: number,
    rowIdx: number
  ) => {
    if (e.button !== 0) return;
    const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;
    const m: MarqueeSelectState = {
      active: true,
      additive: isAdditive,
      startStepFloat: stepIdx + 0.2,
      startRowFloat: rowIdx + 0.2,
      curStepFloat: stepIdx + 0.2,
      curRowFloat: rowIdx + 0.2,
    };
    marqueeRef.current = m;
  };

  const handleChangeBarFlowRule = (
    barIndex: number,
    field: 'minFlow' | 'maxFlow',
    val: number
  ) => {
    const clamped = Math.max(0, Math.min(45, Math.round(val)));
    setDraft((prev) => {
      const rules = [...(prev.barFlowRules || [])];
      const idx = rules.findIndex((r) => r.barIndex === barIndex);
      if (idx >= 0) {
        rules[idx] = { ...rules[idx], [field]: clamped };
      } else {
        rules.push({
          barIndex,
          minFlow: field === 'minFlow' ? clamped : 0,
          maxFlow: field === 'maxFlow' ? clamped : 45,
          biomeId: prev.biomeId,
        });
      }
      return { ...prev, barFlowRules: rules };
    });
  };

  const handleAdjustSongBars = (deltaBars: number) => {
    pushUndoSnapshot(draftRef.current);
    setDraft((prev) => {
      const nextSteps = Math.max(
        STEPS_PER_BAR,
        Math.min(128, prev.totalSteps + deltaBars * STEPS_PER_BAR)
      );
      const nextBars = Math.ceil(nextSteps / STEPS_PER_BAR);
      const nextRules: StageBarFlowRule[] = Array.from(
        { length: nextBars },
        (_, bIdx) => {
          const existing = prev.barFlowRules.find((r) => r.barIndex === bIdx);
          return (
            existing || {
              barIndex: bIdx,
              minFlow: 0,
              maxFlow: 45,
              biomeId: prev.biomeId,
            }
          );
        }
      );
      return {
        ...prev,
        totalSteps: nextSteps,
        notes: prev.notes.filter((n) => n.step < nextSteps),
        synthNotes: prev.synthNotes.filter((s) => s.step < nextSteps),
        barFlowRules: nextRules,
      };
    });
  };

  const handleSaveCurrentStage = (asNewCopy = false) => {
    const stageToSave: CustomStage = {
      ...draft,
      id: asNewCopy || draft.isBuiltIn ? `stage_custom_${Date.now()}` : draft.id,
      name:
        asNewCopy || draft.isBuiltIn
          ? `${draft.name.replace(/ \(Custom\)$/i, '')} (Custom)`
          : draft.name,
      isBuiltIn: false,
      createdAt: Date.now(),
    };

    const exists = stages.some((s) => s.id === stageToSave.id);
    const nextList = exists
      ? stages.map((s) => (s.id === stageToSave.id ? stageToSave : s))
      : [...stages, stageToSave];

    setDraft(stageToSave);
    onSaveStages(nextList, stageToSave.id);
    flashBanner(`SAVED: ${stageToSave.name}`);
  };

  const handleDeleteStage = (stageId: string) => {
    if (stages.length <= 1) return;
    const filtered = stages.filter((s) => s.id !== stageId);
    const nextActive = filtered[0];
    onSaveStages(filtered, nextActive.id);
    if (draft.id === stageId && nextActive) {
      setDraft({ ...nextActive });
    }
  };

  const handleMidiFileImportToDaw = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const importedStage = parseMidiBufferToStage(
        buf,
        file.name,
        draft.biomeId,
        draft.soundBankId
      );
      pushUndoSnapshot(draftRef.current);
      setDraft(importedStage);
      setSelectedNoteIds([]);
      const nextList = [...stages, importedStage];
      onSaveStages(nextList, importedStage.id);
      flashBanner(`MIDI LOADED: ${importedStage.notes.length} NOTES`);
    } catch {
      flashBanner('MIDI ERROR');
    }
  };

  const selectedSet = useMemo(() => new Set(selectedNoteIds), [selectedNoteIds]);

  return (
    <div
      id="stage-creator-screen"
      className="fixed inset-0 z-50 bg-[#04060d]/98 flex flex-col justify-between p-2.5 md:p-4 overflow-hidden font-pixel text-[9px]"
    >
      {/* Top Studio Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-5"
            style={{ backgroundColor: activeBarBiome.fg }}
          />
          <h2 className="text-xs md:text-sm text-white tracking-wider uppercase">
            # STAGE DAW
          </h2>
          <span
            className="text-[8px] px-1.5 py-0.5 border"
            style={{
              color: activeBarBiome.fg,
              borderColor: activeBarBiome.fg,
            }}
          >
            BAR {activeBarIdx + 1}: {activeBarBiome.name}
          </span>
          {selectedNoteIds.length > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-400 text-cyan-200">
              {selectedNoteIds.length} SELECTED
            </span>
          )}
        </div>

        {/* Primary Transport & Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('daw')}
            className={`px-2 py-1 text-[8px] uppercase border cursor-pointer ${
              viewMode === 'daw'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            🎹 DAW
          </button>

          <button
            type="button"
            onClick={() => {
              stopPreview();
              setViewMode('manager');
            }}
            className={`px-2 py-1 text-[8px] uppercase border cursor-pointer ${
              viewMode === 'manager'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            = LIST ({stages.length})
          </button>

          <button
            type="button"
            data-testid="daw-custom-biomes-btn"
            onClick={() => {
              stopPreview();
              setViewMode('custom_biomes');
            }}
            className={`px-2 py-1 text-[8px] uppercase border cursor-pointer ${
              viewMode === 'custom_biomes'
                ? 'bg-pink-500/25 border-pink-400 text-pink-200'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            🎨 CUSTOM BIOMES ({(cfg.customBiomes || []).length})
          </button>

          <button
            type="button"
            data-testid="daw-play-btn"
            onClick={togglePlayPreview}
            title="Play / Pause Preview [Space]"
            className={`px-2.5 py-1 text-[8px] uppercase cursor-pointer border ${
              isPlayingPreview
                ? 'bg-rose-500 border-rose-300 text-white'
                : 'bg-amber-400 hover:bg-amber-300 border-amber-200 text-slate-950'
            }`}
          >
            {isPlayingPreview ? '⏸ PAUSE [SPACE]' : '▶ PLAY [SPACE]'}
          </button>

          <button
            type="button"
            onClick={() => setLoopActiveBar((v) => !v)}
            title="Loop Focused Bar during Playback"
            className={`px-2 py-1 text-[8px] uppercase border cursor-pointer ${
              loopActiveBar
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            🔁 BAR LOOP
          </button>

          <button
            type="button"
            onClick={() => handleSaveCurrentStage(false)}
            className="px-2.5 py-1 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[8px] uppercase cursor-pointer"
          >
            SAVE
          </button>

          <button
            type="button"
            data-testid="daw-run-btn"
            onClick={() => {
              stopPreview();
              handleSaveCurrentStage(false);
              onPlayStage(draftRef.current);
            }}
            className="px-2.5 py-1 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[8px] uppercase cursor-pointer shadow-[0_0_14px_rgba(0,255,136,0.3)]"
          >
            &gt; RUN
          </button>

          <button
            type="button"
            data-testid="close-daw-btn"
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[8px] uppercase cursor-pointer"
          >
            X
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="mt-1 px-2.5 py-1 bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-[8px]">
          {statusBanner}
        </div>
      )}

      {viewMode === 'daw' ? (
        <>
          {/* Compact Pro DAW Toolbar + Selection & Editing Action Strip */}
          <div className="my-1.5 flex flex-col gap-1.5 bg-slate-950/90 border border-slate-800 p-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
              {/* Stage Name & All-Bar Key Preset */}
              <div className="lg:col-span-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-slate-400 w-12 shrink-0">NAME</span>
                  <input
                    type="text"
                    aria-label="Stage Name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="flex-1 bg-slate-900 border border-slate-700 px-2 py-0.5 text-[8px] text-white"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[8px] text-slate-400 w-12 shrink-0"
                    title="Set All Bars Biome Key"
                  >
                    ALL KEY
                  </span>
                  <select
                    aria-label="Biome Selector"
                    value={draft.biomeId}
                    onChange={(e) => handleSelectGlobalBiome(Number(e.target.value))}
                    className="flex-1 bg-slate-900 border border-slate-700 px-1.5 py-0.5 text-[8px] text-emerald-300"
                  >
                    {allBiomes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.isCustom ? `★ ${b.name}` : b.name} ({b.subtitle})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sound Bank, BPM & Bar Count */}
              <div className="lg:col-span-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-slate-400 w-12 shrink-0">SYNTH</span>
                  <select
                    aria-label="Sound Bank Selector"
                    value={draft.soundBankId}
                    onChange={(e) =>
                      setDraft({ ...draft, soundBankId: e.target.value })
                    }
                    className="flex-1 bg-slate-900 border border-slate-700 px-1.5 py-0.5 text-[8px] text-cyan-300"
                  >
                    {SOUND_BANKS.map((sb) => (
                      <option key={sb.id} value={sb.id}>
                        {sb.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-slate-400">BPM</span>
                    <input
                      type="number"
                      aria-label="Stage BPM"
                      min={60}
                      max={180}
                      value={draft.bpm}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          bpm: Math.max(
                            60,
                            Math.min(180, Number(e.target.value) || 100)
                          ),
                        })
                      }
                      className="w-14 bg-slate-900 border border-slate-700 px-1 py-0.5 text-[8px] text-amber-300"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-slate-400">
                      {totalBars}B ({draft.totalSteps})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdjustSongBars(-1)}
                      className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                      title="Remove Bar"
                    >
                      -B
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustSongBars(1)}
                      className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-emerald-500/60 text-emerald-300 cursor-pointer"
                      title="Add Bar"
                    >
                      +B
                    </button>
                  </div>
                </div>
              </div>

              {/* Channel Switcher, Note Length & MIDI Import */}
              <div className="lg:col-span-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChannel('lead');
                      setSelectedNoteIds([]);
                    }}
                    className={`flex-1 py-0.5 px-1.5 text-[8px] border uppercase cursor-pointer ${
                      activeChannel === 'lead'
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    CH1 LEAD ({draft.notes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChannel('synth');
                      setSelectedNoteIds([]);
                    }}
                    className={`flex-1 py-0.5 px-1.5 text-[8px] border uppercase cursor-pointer ${
                      activeChannel === 'synth'
                        ? 'bg-pink-500/25 border-pink-400 text-pink-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    CH2 PAD ({draft.synthNotes.length})
                  </button>
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[8px] text-slate-400 shrink-0">LEN</span>
                  <select
                    aria-label="Note Duration Beats"
                    value={selectedDurationBeats}
                    onChange={(e) => {
                      const nextDur = parseFloat(e.target.value);
                      setSelectedDurationBeats(nextDur);
                      if (selectedIdsRef.current.length > 0) {
                        pushUndoSnapshot(draftRef.current);
                        const selSet = new Set(selectedIdsRef.current);
                        setDraft((prev) => ({
                          ...prev,
                          notes:
                            activeChannel === 'lead'
                              ? prev.notes.map((n) =>
                                  selSet.has(n.id) ? { ...n, durationBeats: nextDur } : n
                                )
                              : prev.notes,
                          synthNotes:
                            activeChannel === 'synth'
                              ? prev.synthNotes.map((s) =>
                                  selSet.has(s.id) ? { ...s, durationBeats: nextDur } : s
                                )
                              : prev.synthNotes,
                        }));
                      }
                    }}
                    className="flex-1 min-w-0 bg-slate-900 border border-amber-400/70 px-1 py-0.5 text-[8px] text-amber-300 truncate"
                  >
                    {AVAILABLE_NOTE_DURATIONS.map((d) => (
                      <option key={d.beats} value={d.beats}>
                        {d.label} ({d.beats}B)
                      </option>
                    ))}
                  </select>

                  <label
                    htmlFor="daw-midi-upload"
                    className="shrink-0 px-2 py-0.5 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-400 text-pink-200 text-[8px] uppercase cursor-pointer whitespace-nowrap"
                  >
                    +MIDI
                  </label>
                  <input
                    id="daw-midi-upload"
                    type="file"
                    accept=".mid,.midi"
                    onChange={handleMidiFileImportToDaw}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Pro Piano Roll Selection & Editing Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800/90 text-[8px]">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  data-testid="daw-tool-draw"
                  onClick={() => setToolMode('draw')}
                  className={`px-2 py-0.5 border uppercase cursor-pointer ${
                    toolMode === 'draw'
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                  title="Draw / Edit Notes (Drag empty grid to box-select)"
                >
                  ✎ DRAW
                </button>
                <button
                  type="button"
                  data-testid="daw-tool-select"
                  onClick={() => setToolMode('select')}
                  className={`px-2 py-0.5 border uppercase cursor-pointer ${
                    toolMode === 'select'
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                  title="Marquee Box Select Mode"
                >
                  ⬚ SELECT
                </button>

                <span className="text-slate-700 mx-0.5">|</span>

                <button
                  type="button"
                  onClick={handleUndo}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                  title="Undo [Ctrl+Z]"
                >
                  ↶ UNDO
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                  title="Redo [Ctrl+Y]"
                >
                  ↷ REDO
                </button>

                <span className="text-slate-700 mx-0.5">|</span>

                <button
                  type="button"
                  data-testid="daw-copy-btn"
                  onClick={handleCopySelectedNotes}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 cursor-pointer"
                  title="Copy Selected Notes [Ctrl+C]"
                >
                  COPY [C-C]
                </button>
                <button
                  type="button"
                  data-testid="daw-paste-btn"
                  onClick={handlePasteNotes}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 cursor-pointer"
                  title="Paste Notes at Playhead / Focused Bar [Ctrl+V]"
                >
                  PASTE [C-V]
                </button>
                <button
                  type="button"
                  data-testid="daw-dup-bar-btn"
                  onClick={handleDuplicateToNearestEmptyBar}
                  className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400 text-emerald-200 cursor-pointer"
                  title="Duplicate Selected Notes to Nearest Empty Bar [Ctrl+B]"
                >
                  ⧉ DUP TO EMPTY BAR [Ctrl+B]
                </button>
                <button
                  type="button"
                  data-testid="daw-delete-selected-btn"
                  onClick={handleDeleteSelectedNotes}
                  disabled={selectedNoteIds.length === 0}
                  className={`px-2 py-0.5 border uppercase cursor-pointer ${
                    selectedNoteIds.length > 0
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-400 text-rose-200'
                      : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                  title="Delete Selected Notes [Delete]"
                >
                  🗑 DEL [{selectedNoteIds.length}]
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleTransposeOrNudgeSelected(0, -1)}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                  title="Transpose Selected Up 1 Scale Step [↑]"
                >
                  ↑ STEP
                </button>
                <button
                  type="button"
                  onClick={() => handleTransposeOrNudgeSelected(0, 1)}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                  title="Transpose Selected Down 1 Scale Step [↓]"
                >
                  ↓ STEP
                </button>
                <button
                  type="button"
                  onClick={() => handleTransposeOrNudgeSelected(0, -7)}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-amber-500/50 text-amber-300 cursor-pointer"
                  title="Transpose Selected Up 1 Octave [Ctrl+↑]"
                >
                  +OCT
                </button>
                <button
                  type="button"
                  onClick={() => handleTransposeOrNudgeSelected(0, 7)}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-amber-500/50 text-amber-300 cursor-pointer"
                  title="Transpose Selected Down 1 Octave [Ctrl+↓]"
                >
                  -OCT
                </button>
                <button
                  type="button"
                  onClick={handleQuantizeSelected}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-cyan-500/50 text-cyan-300 cursor-pointer"
                  title="Quantize Selected Notes [Q]"
                >
                  QUANT [Q]
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllNotes}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                  title="Select All Notes [Ctrl+A]"
                >
                  ALL [C-A]
                </button>
              </div>
            </div>
          </div>

          {/* 2D Scrollable Multi-Octave Piano Roll Grid with Marquee Selection & Dual-Edge Multi-Resize */}
          <div
            ref={gridScrollRef}
            className="flex-1 overflow-auto border border-slate-800 bg-[#050811] relative select-none"
          >
            <div
              className="inline-block min-w-full relative"
              style={{ width: `${PIANO_KEY_W + draft.totalSteps * CELL_W}px` }}
            >
              {/* Sticky Header 1: Per-Bar Biome Key Selector + Flow Bounds */}
              <div className="sticky top-0 z-20 flex bg-slate-950 border-b border-slate-800">
                <div className="sticky left-0 z-30 w-[110px] shrink-0 bg-slate-950 border-r border-slate-800 px-2 py-1 text-[8px] text-slate-400 flex flex-col justify-center">
                  <span>BAR KEY</span>
                  <span className="text-[7px] text-slate-500">&amp; FLOW</span>
                </div>
                {Array.from({ length: totalBars }, (_, barIdx) => {
                  const rule = draft.barFlowRules.find(
                    (r) => r.barIndex === barIdx
                  ) || {
                    barIndex: barIdx,
                    minFlow: 0,
                    maxFlow: 45,
                    biomeId: draft.biomeId,
                  };
                  const barBiomeId = rule.biomeId ?? draft.biomeId;
                  const barBiome =
                    allBiomes.find((b) => b.id === barBiomeId) ||
                    MASTER_SCALES[0];
                  const isFocusedBar = activeBarIdx === barIdx;

                  return (
                    <div
                      key={barIdx}
                      onClick={() => setActiveBarIdx(barIdx)}
                      style={{ width: `${STEPS_PER_BAR * CELL_W}px` }}
                      className={`shrink-0 border-r border-slate-700 px-1.5 py-1 flex flex-col gap-1 cursor-pointer ${
                        isFocusedBar ? 'bg-slate-900' : 'bg-slate-950/90'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-[8px] font-bold shrink-0"
                          style={{ color: barBiome.fg }}
                        >
                          BAR {barIdx + 1}
                        </span>
                        {/* Per-Bar Biome Key Selector */}
                        <select
                          data-testid={`bar-biome-select-${barIdx}`}
                          aria-label={`Bar ${barIdx + 1} Biome Key`}
                          value={barBiomeId}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleSelectBarBiome(barIdx, Number(e.target.value))
                          }
                          style={{
                            borderColor: barBiome.fg,
                            color: barBiome.fg,
                          }}
                          className="flex-1 min-w-0 bg-slate-950 border px-1 py-0.5 text-[8px] truncate"
                        >
                          {allBiomes.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.isCustom ? `★ ${b.name}` : b.name} ({b.subtitle})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between text-[8px]">
                        <span className="text-slate-400">FLOW</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            aria-label={`Bar ${barIdx + 1} Min Flow`}
                            min={0}
                            max={45}
                            value={rule.minFlow}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleChangeBarFlowRule(
                                barIdx,
                                'minFlow',
                                Number(e.target.value)
                              )
                            }
                            className="w-10 bg-slate-950 border border-slate-700 px-1 py-0.5 text-center text-cyan-300"
                          />
                          <span className="text-slate-500">-</span>
                          <input
                            type="number"
                            aria-label={`Bar ${barIdx + 1} Max Flow`}
                            min={0}
                            max={45}
                            value={rule.maxFlow}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleChangeBarFlowRule(
                                barIdx,
                                'maxFlow',
                                Number(e.target.value)
                              )
                            }
                            className="w-10 bg-slate-950 border border-slate-700 px-1 py-0.5 text-center text-amber-300"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sticky Header 2: Clickable Step Numbers Ruler (Scrub Playhead) */}
              <div className="sticky top-[47px] z-20 flex bg-slate-950 border-b border-slate-800">
                <div className="sticky left-0 z-30 w-[110px] shrink-0 bg-slate-950 border-r border-slate-800 px-2 py-1 text-[8px] text-slate-400">
                  NOTE / STEP
                </div>
                {Array.from({ length: draft.totalSteps }, (_, stepIdx) => {
                  const isBarStart = stepIdx % STEPS_PER_BAR === 0;
                  const isBeatStart = stepIdx % STEPS_PER_BEAT === 0;
                  const isPlayhead = playheadStep === stepIdx;
                  return (
                    <div
                      key={stepIdx}
                      onClick={() => {
                        currentStepRef.current = stepIdx;
                        triggerRealtimeStepAudio(stepIdx);
                      }}
                      title={`Jump Playhead to Step ${stepIdx + 1}`}
                      style={{ width: `${CELL_W}px` }}
                      className={`shrink-0 text-center py-1 text-[8px] border-r cursor-pointer ${
                        isPlayhead
                          ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                          : isBarStart
                          ? 'bg-slate-900 text-emerald-300 border-slate-700 hover:bg-slate-800'
                          : isBeatStart
                          ? 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-900'
                          : 'bg-slate-950 text-slate-600 border-slate-900 hover:bg-slate-900'
                      }`}
                    >
                      {stepIdx + 1}
                    </div>
                  );
                })}
              </div>

              {/* Marquee Box Selection Overlay */}
              {marquee && marquee.active && (
                <div
                  className="pointer-events-none absolute z-30 border-2 border-cyan-300 bg-cyan-400/20"
                  style={{
                    left: `${
                      PIANO_KEY_W +
                      Math.min(marquee.startStepFloat, marquee.curStepFloat) * CELL_W
                    }px`,
                    top: `${
                      HEADER_H +
                      Math.min(marquee.startRowFloat, marquee.curRowFloat) * CELL_H
                    }px`,
                    width: `${Math.max(
                      6,
                      Math.abs(marquee.curStepFloat - marquee.startStepFloat) * CELL_W
                    )}px`,
                    height: `${Math.max(
                      6,
                      Math.abs(marquee.curRowFloat - marquee.startRowFloat) * CELL_H
                    )}px`,
                  }}
                />
              )}

              {/* Multi-Octave Pitch Rows */}
              {pitchRows.map((row, rowIdx) => (
                <div
                  key={`${row.noteName}_${row.freq}`}
                  style={{ height: `${CELL_H}px` }}
                  className={`flex items-center border-b ${
                    row.isRoot ? 'border-slate-700/80' : 'border-slate-900'
                  }`}
                >
                  {/* Sticky Left Piano Key */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isMuted) {
                        if (activeChannel === 'synth') {
                          audioEngine.playCustomSynthNote(row.freq, 1.4, cfg);
                        } else {
                          audioEngine.previewNote(
                            row.freq,
                            cfg,
                            selectedBank,
                            selectedDurationBeats
                          );
                        }
                      }
                    }}
                    className={`sticky left-0 z-10 w-[110px] h-full shrink-0 px-2 flex items-center justify-between border-r border-slate-800 text-left cursor-pointer ${
                      row.isRoot
                        ? 'bg-slate-900 hover:bg-slate-800 text-white'
                        : 'bg-slate-950 hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <span className="text-[8px]">{row.noteName}</span>
                    <span className="text-[7px] text-slate-500">
                      {Math.round(row.freq)}
                    </span>
                  </button>

                  {/* Step Cells across the Song */}
                  {Array.from({ length: draft.totalSteps }, (_, stepIdx) => {
                    const barIdx = Math.floor(stepIdx / STEPS_PER_BAR);
                    const barBiome = getBiomeForBar(draft, barIdx);

                    const leadEvent = draft.notes.find(
                      (n) =>
                        n.step === stepIdx && Math.abs(n.freq - row.freq) < 2.2
                    );
                    const synthEvent = draft.synthNotes.find(
                      (s) =>
                        s.step === stepIdx && Math.abs(s.freq - row.freq) < 2.2
                    );
                    const isBarEnd = (stepIdx + 1) % STEPS_PER_BAR === 0;
                    const isBeatStart = stepIdx % STEPS_PER_BEAT === 0;
                    const isPlayhead = playheadStep === stepIdx;

                    const activeEvent =
                      activeChannel === 'lead' ? leadEvent : synthEvent;
                    const ghostEvent =
                      activeChannel === 'lead' ? synthEvent : leadEvent;
                    const spanCols = activeEvent
                      ? Math.max(
                          1,
                          Math.round(activeEvent.durationBeats * STEPS_PER_BEAT)
                        )
                      : 1;
                    const isNoteSelected = activeEvent
                      ? selectedSet.has(activeEvent.id)
                      : false;

                    return (
                      <div
                        key={stepIdx}
                        style={{ width: `${CELL_W}px` }}
                        onMouseDown={(e) =>
                          handleEmptyCellMouseDown(e, stepIdx, rowIdx)
                        }
                        onClick={() =>
                          handleEmptyCellClick(stepIdx, row.freq, row.noteName)
                        }
                        className={`relative h-full shrink-0 border-r cursor-pointer ${
                          isBarEnd ? 'border-slate-700' : 'border-slate-900/90'
                        } ${
                          isPlayhead
                            ? 'bg-amber-400/15'
                            : row.isRoot
                            ? 'bg-slate-900/55 hover:bg-slate-800/60'
                            : isBeatStart
                            ? 'bg-slate-900/35 hover:bg-slate-800/60'
                            : 'bg-[#050811] hover:bg-slate-900/60'
                        }`}
                      >
                        {/* Ghost indicator of the other channel */}
                        {ghostEvent && !activeEvent && (
                          <div
                            className={`absolute inset-y-1.5 left-0.5 pointer-events-none opacity-45 border ${
                              activeChannel === 'lead'
                                ? 'bg-pink-500/40 border-pink-400'
                                : 'bg-emerald-500/40 border-emerald-400'
                            }`}
                            style={{
                              width: `${Math.max(
                                34,
                                Math.round(
                                  ghostEvent.durationBeats *
                                    STEPS_PER_BEAT *
                                    CELL_W
                                ) - 4
                              )}px`,
                            }}
                          />
                        )}

                        {/* Active Channel Draggable, Selectable & Both-Edge-Resizable Note Block */}
                        {activeEvent && (
                          <div
                            data-note-id={activeEvent.id}
                            onMouseDown={(e) =>
                              beginNoteDrag(e, 'move', activeEvent)
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              pushUndoSnapshot(draftRef.current);
                              setDraft((prev) => ({
                                ...prev,
                                notes:
                                  activeChannel === 'lead'
                                    ? prev.notes.filter((n) => n.id !== activeEvent.id)
                                    : prev.notes,
                                synthNotes:
                                  activeChannel === 'synth'
                                    ? prev.synthNotes.filter(
                                        (s) => s.id !== activeEvent.id
                                      )
                                    : prev.synthNotes,
                              }));
                              setSelectedNoteIds((prev) =>
                                prev.filter((id) => id !== activeEvent.id)
                              );
                            }}
                            style={{
                              width: `${Math.max(34, spanCols * CELL_W - 3)}px`,
                              backgroundColor:
                                activeChannel === 'lead'
                                  ? barBiome.fg
                                  : '#f472b6',
                            }}
                            className={`group absolute top-0.5 bottom-0.5 left-0.5 z-10 px-2.5 flex items-center justify-between text-[8px] text-slate-950 overflow-hidden whitespace-nowrap cursor-move select-none ${
                              isNoteSelected
                                ? 'border-2 border-white ring-2 ring-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]'
                                : 'border border-white/80 shadow-[0_0_6px_rgba(255,255,255,0.25)]'
                            }`}
                            title="Click/Drag to select & move · Shift+Click multi-select · Drag left/right edge to resize all selected · Double-click or [Delete] to remove"
                          >
                            {/* Left Resize Handle (Resizes ALL selected notes from left) */}
                            <div
                              data-resize-handle="left"
                              onMouseDown={(e) =>
                                beginNoteDrag(e, 'resize-left', activeEvent)
                              }
                              className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/35 hover:bg-white/80"
                            />

                            <span className="pointer-events-none truncate font-bold">
                              {row.noteName}
                            </span>
                            <span className="pointer-events-none text-[7px]">
                              {activeEvent.durationBeats}B
                            </span>

                            {/* Right Resize Handle (Resizes ALL selected notes from right) */}
                            <div
                              data-resize-handle="right"
                              onMouseDown={(e) =>
                                beginNoteDrag(e, 'resize-right', activeEvent)
                              }
                              className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/35 hover:bg-white/80"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Pro DAW Shortcut Legend & Footer */}
          <div className="pt-1.5 mt-1 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[7px] text-slate-400">
            <div className="flex flex-wrap items-center gap-2.5">
              <span>⬚ DRAG GRID: BOX SELECT</span>
              <span>CLICK EMPTY: DESELECT / ADD</span>
              <span>&lt;&gt; BOTH EDGES: MULTI-RESIZE</span>
              <span>SPACE: PLAY/PAUSE</span>
              <span>DEL: DELETE</span>
              <span>CTRL+B: DUP TO EMPTY BAR</span>
              <span>CTRL+C/V: COPY/PASTE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  pushUndoSnapshot(draftRef.current);
                  setDraft((prev) => ({
                    ...prev,
                    notes: activeChannel === 'lead' ? [] : prev.notes,
                    synthNotes:
                      activeChannel === 'synth' ? [] : prev.synthNotes,
                  }));
                  setSelectedNoteIds([]);
                }}
                className="px-2 py-0.5 border border-rose-500/60 hover:bg-rose-500/10 text-rose-300 uppercase cursor-pointer"
              >
                🗑 CLEAR CH
              </button>
              <button
                type="button"
                onClick={() => handleSaveCurrentStage(true)}
                className="px-2 py-0.5 border border-cyan-400/60 hover:bg-cyan-500/10 text-cyan-300 uppercase cursor-pointer"
              >
                + SAVE COPY
              </button>
            </div>
          </div>
        </>
      ) : viewMode === 'custom_biomes' ? (
        /* CUSTOM BIOME CREATOR & LIST VIEW */
        <div className="flex-1 overflow-y-auto my-2 space-y-3 pr-1">
          {(() => {
            const smartPalette = computeSmartHslBiomePalette(cbHue, cbSat, cbLight);
            return (
              <div className="p-3 bg-slate-950 border border-pink-400/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 border border-white/60"
                      style={{
                        background: `linear-gradient(135deg, ${smartPalette.fg}, ${smartPalette.horizonColor})`,
                      }}
                    />
                    <span className="text-[10px] text-pink-300 uppercase">
                      🎨 CUSTOM BIOME ARCHITECT (SMART HSL + 12-KEY + CHORDS + TRIPLETS)
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="save-custom-biome-btn"
                    onClick={() => {
                      const created = createCustomBiomeFromHsl({
                        id: 100 + ((cfg.customBiomes || []).length + 1) + Math.floor(Math.random() * 500),
                        name: cbName.trim() || 'CUSTOM BIOME',
                        hue: cbHue,
                        saturation: cbSat,
                        lightness: cbLight,
                        activeChromaticKeys:
                          cbActiveKeys.length > 0
                            ? cbActiveKeys
                            : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
                        chordNames: cbChordNames,
                        chordKeyIndices: cbChordIndices,
                        tripletKeyIndices: cbTripletIndices,
                      });
                      const nextCustomList = [...(cfg.customBiomes || []), created];
                      if (onSaveCustomBiomes) {
                        onSaveCustomBiomes(nextCustomList);
                      }
                      handleSelectBarBiome(activeBarIdx, created.id);
                      flashBanner(`SAVED CUSTOM BIOME: ${created.name}`);
                    }}
                    className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[8px] uppercase cursor-pointer"
                  >
                    + SAVE CUSTOM BIOME
                  </button>
                </div>

                {/* Row 1: Name + Smart HSL Color Sliders & Auto-Gradient Preview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2 bg-slate-900/60 border border-slate-800 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-slate-400 w-20">BIOME NAME</span>
                      <input
                        type="text"
                        aria-label="Custom Biome Name"
                        value={cbName}
                        onChange={(e) => setCbName(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-700 px-2 py-1 text-[9px] text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px]">
                        <span className="text-slate-400">SMART HUE ({cbHue}°)</span>
                        <span style={{ color: smartPalette.fg }}>{smartPalette.fg}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={cbHue}
                        onChange={(e) => setCbHue(Number(e.target.value))}
                        className="w-full accent-pink-400 cursor-pointer"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex justify-between text-[7px] text-slate-400">
                          <span>SATURATION</span>
                          <span>{cbSat}%</span>
                        </div>
                        <input
                          type="range"
                          min={40}
                          max={100}
                          value={cbSat}
                          onChange={(e) => setCbSat(Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[7px] text-slate-400">
                          <span>LIGHTNESS</span>
                          <span>{cbLight}%</span>
                        </div>
                        <input
                          type="range"
                          min={38}
                          max={72}
                          value={cbLight}
                          onChange={(e) => setCbLight(Number(e.target.value))}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Smart HSL Live Gradient Preview */}
                  <div
                    className="p-3 border flex flex-col justify-between"
                    style={{
                      borderColor: smartPalette.fg,
                      background: `linear-gradient(180deg, ${smartPalette.bgAccent} 0%, #050811 65%, ${smartPalette.fg}33 100%)`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-bold uppercase"
                        style={{ color: smartPalette.fg }}
                      >
                        {cbName || 'CUSTOM BIOME'}
                      </span>
                      <span
                        className="text-[8px] px-1.5 py-0.5 border"
                        style={{
                          color: smartPalette.horizonColor,
                          borderColor: smartPalette.horizonColor,
                        }}
                      >
                        SMART HSL AUTO-GRADIENT
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 my-2 text-[7px]">
                      <div className="p-1.5 bg-slate-950/80 border border-slate-800 flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 inline-block shrink-0"
                          style={{ backgroundColor: smartPalette.fg }}
                        />
                        <span className="text-slate-300 truncate">FG {smartPalette.fg}</span>
                      </div>
                      <div className="p-1.5 bg-slate-950/80 border border-slate-800 flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 inline-block shrink-0"
                          style={{ backgroundColor: smartPalette.horizonColor }}
                        />
                        <span className="text-slate-300 truncate">
                          HORIZON {smartPalette.horizonColor}
                        </span>
                      </div>
                      <div className="p-1.5 bg-slate-950/80 border border-slate-800 flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 inline-block shrink-0 border border-slate-600"
                          style={{ backgroundColor: smartPalette.bgAccent }}
                        />
                        <span className="text-slate-300 truncate">BG {smartPalette.bgAccent}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: 12-Note Octave Key Selector (Default: All 12 Active!) */}
                <div className="bg-slate-900/60 border border-slate-800 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-cyan-300 uppercase">
                      🎹 ACTIVE SCALE KEYS ({cbActiveKeys.length}/12 ACTIVE — DEFAULT ALL 12 OCTAVE NOTES)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCbActiveKeys([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
                      }
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-cyan-400/50 text-cyan-200 text-[7px] uppercase cursor-pointer"
                    >
                      ENABLE ALL 12 KEYS
                    </button>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                    {CHROMATIC_12_NOTES.map((n) => {
                      const isKeyOn = cbActiveKeys.includes(n.index);
                      return (
                        <button
                          key={n.index}
                          type="button"
                          onClick={() => {
                            if (!isMuted) {
                              audioEngine.previewNote(n.freq, cfg, selectedBank, 0.5);
                            }
                            setCbActiveKeys((prev) => {
                              if (prev.includes(n.index)) {
                                if (prev.length <= 1) return prev;
                                return prev.filter((k) => k !== n.index);
                              }
                              return [...prev, n.index].sort((a, b) => a - b);
                            });
                          }}
                          style={{
                            borderColor: isKeyOn ? smartPalette.fg : '#1e293b',
                            backgroundColor: isKeyOn ? `${smartPalette.fg}28` : '#050811',
                          }}
                          className={`py-2 px-1 border text-center cursor-pointer flex flex-col items-center gap-0.5 ${
                            isKeyOn ? 'text-white font-bold' : 'text-slate-600'
                          }`}
                        >
                          <span className="text-[8px]">{n.shortName}</span>
                          <span className="text-[6px] text-slate-400">
                            {Math.round(n.freq)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 3: Custom 4-Gate Chord Progression Builder + Custom 3-Note Triplet Selector */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                  <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 p-2.5 space-y-2">
                    <span className="text-[8px] text-emerald-300 uppercase block">
                      ❖ 4-GATE CHORD PROGRESSION BUILDER
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[0, 1, 2, 3].map((gateIdx) => (
                        <div
                          key={gateIdx}
                          className="p-2 bg-slate-950 border border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[8px] text-emerald-400">
                              GATE {gateIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={cbChordNames[gateIdx]}
                              onChange={(e) => {
                                const next = [...cbChordNames] as [
                                  string,
                                  string,
                                  string,
                                  string
                                ];
                                next[gateIdx] = e.target.value;
                                setCbChordNames(next);
                              }}
                              className="w-24 bg-slate-900 border border-slate-700 px-1.5 py-0.5 text-[8px] text-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!isMuted) {
                                  const notes = cbChordIndices[gateIdx].map(
                                    (idx) => CHROMATIC_12_NOTES[idx].freq
                                  );
                                  audioEngine.playPlatformNote(
                                    MASTER_SCALES[0],
                                    14,
                                    cfg,
                                    notes,
                                    selectedBank,
                                    false,
                                    1.0
                                  );
                                }
                              }}
                              className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-[7px] cursor-pointer"
                            >
                              🔊
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {[0, 1, 2, 3].map((voiceIdx) => (
                              <select
                                key={voiceIdx}
                                value={cbChordIndices[gateIdx][voiceIdx]}
                                onChange={(e) => {
                                  const next = cbChordIndices.map((arr) => [
                                    ...arr,
                                  ]) as typeof cbChordIndices;
                                  next[gateIdx][voiceIdx] = Number(e.target.value);
                                  setCbChordIndices(next);
                                }}
                                className="bg-slate-900 border border-slate-700 px-1 py-0.5 text-[7px] text-cyan-200"
                              >
                                {CHROMATIC_12_NOTES.map((n) => (
                                  <option key={n.index} value={n.index}>
                                    {n.shortName}
                                  </option>
                                ))}
                              </select>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom 3-Note Triplet Run Selector */}
                  <div className="bg-slate-900/60 border border-slate-800 p-2.5 flex flex-col justify-between gap-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] text-amber-300 uppercase">
                          ♫ 3-NOTE TRIPLET RUN
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isMuted) {
                              cbTripletIndices.forEach((kIdx, i) => {
                                window.setTimeout(() => {
                                  audioEngine.previewNote(
                                    CHROMATIC_12_NOTES[kIdx].freq,
                                    cfg,
                                    selectedBank,
                                    0.35
                                  );
                                }, i * 130);
                              });
                            }
                          }}
                          className="px-2 py-0.5 bg-amber-500/20 border border-amber-400 text-amber-200 text-[7px] cursor-pointer"
                        >
                          🔊 TEST 3-NOTE
                        </button>
                      </div>
                      <p className="text-[7px] text-slate-400 leading-relaxed">
                        Choose the 3 custom notes played during Flow x6+ 3-note subdivision runs in this biome:
                      </p>
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        {[0, 1, 2].map((tPos) => (
                          <div
                            key={tPos}
                            className="p-1.5 bg-slate-950 border border-slate-800 flex flex-col gap-1"
                          >
                            <span className="text-[7px] text-slate-400">
                              TRIPLET #{tPos + 1}
                            </span>
                            <select
                              value={cbTripletIndices[tPos]}
                              onChange={(e) => {
                                const next = [...cbTripletIndices] as [
                                  number,
                                  number,
                                  number
                                ];
                                next[tPos] = Number(e.target.value);
                                setCbTripletIndices(next);
                              }}
                              className="bg-slate-900 border border-amber-400/60 px-1 py-1 text-[8px] text-amber-200"
                            >
                              {CHROMATIC_12_NOTES.map((n) => (
                                <option key={n.index} value={n.index}>
                                  {n.noteName}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-2 bg-slate-950 border border-slate-800 text-[7px] text-slate-400">
                      Saved custom biomes appear in every BAR KEY dropdown in the DAW and in standard gameplay!
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Saved Custom Biomes List */}
          <div className="space-y-1.5">
            <div className="text-[8px] text-slate-400 uppercase px-1">
              SAVED CUSTOM BIOMES ({(cfg.customBiomes || []).length})
            </div>
            {(cfg.customBiomes || []).length === 0 ? (
              <div className="p-4 bg-slate-950/80 border border-slate-800 text-center text-[8px] text-slate-500">
                No custom biomes saved yet. Configure your Smart HSL color, 12 keys, chords &amp; triplets above and click + SAVE CUSTOM BIOME!
              </div>
            ) : (
              (cfg.customBiomes || []).map((cb) => (
                <div
                  key={cb.id}
                  className="p-2.5 bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-4 h-4 border border-white/50"
                      style={{
                        background: `linear-gradient(135deg, ${cb.fg}, ${cb.horizonColor})`,
                      }}
                    />
                    <div>
                      <div className="text-[9px] text-white flex items-center gap-2">
                        <span style={{ color: cb.fg }}>★ {cb.name}</span>
                        <span className="text-[7px] text-slate-400">
                          ({cb.subtitle})
                        </span>
                      </div>
                      <div className="text-[7px] text-slate-400 mt-0.5">
                        Chords: {cb.chordNames.join(' → ')} · Triplet:{' '}
                        {(cb.tripletNotes || cb.noteNames.slice(0, 3)).join('-')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectBarBiome(activeBarIdx, cb.id);
                        setViewMode('daw');
                        flashBanner(`APPLIED ${cb.name} TO BAR ${activeBarIdx + 1}`);
                      }}
                      className="px-2.5 py-1 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[8px] uppercase cursor-pointer"
                    >
                      USE ON BAR {activeBarIdx + 1}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextList = (cfg.customBiomes || []).filter(
                          (item) => item.id !== cb.id
                        );
                        if (onSaveCustomBiomes) {
                          onSaveCustomBiomes(nextList);
                        }
                      }}
                      className="px-2 py-1 bg-slate-900 hover:bg-rose-950 border border-rose-500/60 text-rose-300 text-[8px] uppercase cursor-pointer"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* STAGE MANAGER LIST VIEW */
        <div className="flex-1 overflow-y-auto my-2 space-y-2 pr-1">
          {stages.map((st) => {
            const b =
              allBiomes.find((m) => m.id === st.biomeId) ||
              MASTER_SCALES[0];
            const sb =
              SOUND_BANKS.find((k) => k.id === st.soundBankId) ||
              SOUND_BANKS[0];
            const isSelected = st.id === draft.id;

            return (
              <div
                key={st.id}
                className={`p-3 border flex flex-wrap items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-slate-900 border-emerald-400'
                    : 'bg-slate-950/90 border-slate-800'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 inline-block"
                      style={{ backgroundColor: b.fg }}
                    />
                    <span className="text-[10px] text-white">{st.name}</span>
                    <span className="text-[8px]" style={{ color: b.fg }}>
                      [{b.name}]
                    </span>
                  </div>
                  <div className="text-[8px] text-slate-400">
                    {sb.name} · {st.bpm} BPM · {st.notes.length} NOTES ·{' '}
                    {Math.ceil(st.totalSteps / STEPS_PER_BAR)} BARS
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPlayStage(st)}
                    className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[8px] uppercase cursor-pointer"
                  >
                    ▶ PLAY
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({
                        ...st,
                        notes: [...st.notes],
                        synthNotes: [...(st.synthNotes || [])],
                        barFlowRules: [...(st.barFlowRules || [])],
                      });
                      setSelectedNoteIds([]);
                      setViewMode('daw');
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-cyan-400/60 text-cyan-200 text-[8px] uppercase cursor-pointer"
                  >
                    ✎ EDIT
                  </button>
                  {stages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteStage(st.id)}
                      className="px-2 py-1.5 bg-slate-900 hover:bg-rose-950/60 border border-rose-500/60 text-rose-400 text-[8px] uppercase cursor-pointer"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
