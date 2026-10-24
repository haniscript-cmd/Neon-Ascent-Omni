import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  GameConfig,
  MASTER_SCALES,
  SOUND_BANKS,
  ScaleBiome,
  SoundBankDef,
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
  onPlayStage: (stage: CustomStage) => void;
  onClose: () => void;
}

interface NoteDragState {
  mode: 'move' | 'resize-left' | 'resize-right';
  channel: 'lead' | 'synth';
  noteId: string;
  startX: number;
  startY: number;
  origStep: number;
  origRowIdx: number;
  origDurationBeats: number;
  hasMoved: boolean;
}

const CELL_W = 38;
const CELL_H = 28;

export default function StageCreatorModal({
  stages,
  activeStageId,
  cfg,
  audioEngine,
  isMuted,
  onSaveStages,
  onPlayStage,
  onClose,
}: StageCreatorModalProps) {
  const initialStage =
    stages.find((s) => s.id === activeStageId) || stages[0];

  const [viewMode, setViewMode] = useState<'daw' | 'manager'>('daw');
  const [activeChannel, setActiveChannel] = useState<'lead' | 'synth'>('lead');
  const [selectedDurationBeats, setSelectedDurationBeats] = useState<number>(1.0);
  const [activeBarIdx, setActiveBarIdx] = useState<number>(0);
  const [statusBanner, setStatusBanner] = useState<string>('');

  // Working Stage State in the DAW
  const [draft, setDraft] = useState<CustomStage>(() => ({
    ...initialStage,
    notes: [...initialStage.notes],
    synthNotes: [...(initialStage.synthNotes || [])],
    barFlowRules: [...(initialStage.barFlowRules || [])],
  }));

  // Live Reference to `draft` and `isMuted` so Real-Time Playback ALWAYS reflects live edits!
  const draftRef = useRef<CustomStage>(draft);
  draftRef.current = draft;
  const mutedRef = useRef<boolean>(isMuted);
  mutedRef.current = isMuted;
  const cfgRef = useRef<GameConfig>(cfg);
  cfgRef.current = cfg;

  // Interactive Note Drag & Edge Resize State
  const dragRef = useRef<NoteDragState | null>(null);
  const lastPreviewedFreqRef = useRef<number>(0);
  const suppressNextClickRef = useRef<boolean>(false);

  // Live DAW Playback Transport State
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playheadStep, setPlayheadStep] = useState<number>(-1);
  const playTimerRef = useRef<number | null>(null);
  const currentStepRef = useRef<number>(0);

  // Active Biome for the currently focused Bar (or fallback to stage default biomeId)
  const activeBarBiome: ScaleBiome = useMemo(
    () => getBiomeForBar(draft, activeBarIdx),
    [draft, activeBarIdx]
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

  // Stop preview timer on unmount
  useEffect(() => {
    return () => {
      if (playTimerRef.current !== null) {
        window.clearInterval(playTimerRef.current);
      }
    };
  }, []);

  const stopPreview = () => {
    if (playTimerRef.current !== null) {
      window.clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    setIsPlayingPreview(false);
    setPlayheadStep(-1);
  };

  /**
   * Real-time step trigger that always reads `draftRef.current` so any note moved,
   * resized, added, or deleted while playing is heard immediately on the very next step!
   */
  const triggerRealtimeStepAudio = (stepIdx: number) => {
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
  };

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
      currentStepRef.current = (currentStepRef.current + 1) % liveTotal;
      triggerRealtimeStepAudio(currentStepRef.current);
    }, stepDurationMs);

    return () => {
      if (playTimerRef.current !== null) {
        window.clearInterval(playTimerRef.current);
      }
    };
  }, [isPlayingPreview, draft.bpm]);

  const togglePlayPreview = () => {
    if (isPlayingPreview) {
      stopPreview();
      return;
    }
    currentStepRef.current = 0;
    setIsPlayingPreview(true);
    triggerRealtimeStepAudio(0);
  };

  // Global Mouse Move / Up Listeners for Interactive Note Dragging & Edge Resizing
  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
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

      if (d.mode === 'move') {
        const nextStep = Math.max(0, Math.min(maxSteps - 1, d.origStep + deltaSteps));
        const nextRowIdx = Math.max(0, Math.min(rows.length - 1, d.origRowIdx + deltaRows));
        const targetRow = rows[nextRowIdx] || rows[0];
        if (!targetRow) return;

        // Play audio feedback when dragged to a new pitch row
        if (
          Math.abs(targetRow.freq - lastPreviewedFreqRef.current) > 0.5 &&
          !mutedRef.current
        ) {
          lastPreviewedFreqRef.current = targetRow.freq;
          const liveBank =
            SOUND_BANKS.find((b) => b.id === draftRef.current.soundBankId) ||
            SOUND_BANKS[0];
          if (d.channel === 'lead') {
            audioEngine.previewNote(
              targetRow.freq,
              cfgRef.current,
              liveBank,
              d.origDurationBeats
            );
          } else {
            audioEngine.playCustomSynthNote(targetRow.freq, 0.8, cfgRef.current);
          }
        }

        setActiveBarIdx(Math.floor(nextStep / STEPS_PER_BAR));

        setDraft((prev) => {
          if (d.channel === 'lead') {
            return {
              ...prev,
              notes: prev.notes.map((n) =>
                n.id === d.noteId
                  ? {
                      ...n,
                      step: nextStep,
                      freq: targetRow.freq,
                      noteName: targetRow.noteName,
                    }
                  : n
              ),
            };
          } else {
            return {
              ...prev,
              synthNotes: prev.synthNotes.map((s) =>
                s.id === d.noteId
                  ? {
                      ...s,
                      step: nextStep,
                      freq: targetRow.freq,
                      noteName: targetRow.noteName,
                    }
                  : s
              ),
            };
          }
        });
      } else if (d.mode === 'resize-right') {
        const origSpanSteps = Math.max(1, Math.round(d.origDurationBeats * STEPS_PER_BEAT));
        const nextSpanSteps = Math.max(1, Math.min(16, origSpanSteps + deltaSteps));
        const nextDurationBeats = Number((nextSpanSteps / STEPS_PER_BEAT).toFixed(2));
        setSelectedDurationBeats(nextDurationBeats);

        setDraft((prev) => {
          if (d.channel === 'lead') {
            return {
              ...prev,
              notes: prev.notes.map((n) =>
                n.id === d.noteId ? { ...n, durationBeats: nextDurationBeats } : n
              ),
            };
          } else {
            return {
              ...prev,
              synthNotes: prev.synthNotes.map((s) =>
                s.id === d.noteId ? { ...s, durationBeats: nextDurationBeats } : s
              ),
            };
          }
        });
      } else if (d.mode === 'resize-left') {
        const origSpanSteps = Math.max(1, Math.round(d.origDurationBeats * STEPS_PER_BEAT));
        const rightEndStep = d.origStep + origSpanSteps;
        const maxLeftStep = rightEndStep - 1;
        const minLeftStep = Math.max(0, rightEndStep - 16);
        const nextStartStep = Math.max(
          minLeftStep,
          Math.min(maxLeftStep, d.origStep + deltaSteps)
        );
        const nextSpanSteps = Math.max(1, rightEndStep - nextStartStep);
        const nextDurationBeats = Number((nextSpanSteps / STEPS_PER_BEAT).toFixed(2));
        setSelectedDurationBeats(nextDurationBeats);

        setDraft((prev) => {
          if (d.channel === 'lead') {
            return {
              ...prev,
              notes: prev.notes.map((n) =>
                n.id === d.noteId
                  ? { ...n, step: nextStartStep, durationBeats: nextDurationBeats }
                  : n
              ),
            };
          } else {
            return {
              ...prev,
              synthNotes: prev.synthNotes.map((s) =>
                s.id === d.noteId
                  ? { ...s, step: nextStartStep, durationBeats: nextDurationBeats }
                  : s
              ),
            };
          }
        });
      }
    };

    const onWindowMouseUp = () => {
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
  }, [audioEngine]);

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
    const targetBiome =
      MASTER_SCALES.find((b) => b.id === newBiomeId) || MASTER_SCALES[0];
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
        // Also update default biomeId if Bar 1 is changed
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

  // Change Stage Default Biome Key (applies to bars without an override or sets all bars)
  const handleSelectGlobalBiome = (newBiomeId: number) => {
    const targetBiome =
      MASTER_SCALES.find((b) => b.id === newBiomeId) || MASTER_SCALES[0];

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

  const handleToggleCell = (stepIdx: number, rowFreq: number, rowNoteName: string) => {
    if (suppressNextClickRef.current) return;
    setActiveBarIdx(Math.floor(stepIdx / STEPS_PER_BAR));

    if (activeChannel === 'lead') {
      const existing = draft.notes.find(
        (n) => n.step === stepIdx && Math.abs(n.freq - rowFreq) < 1.5
      );
      if (existing) {
        setDraft((prev) => ({
          ...prev,
          notes: prev.notes.filter((n) => n.id !== existing.id),
        }));
      } else {
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
      }
    } else {
      const existing = draft.synthNotes.find(
        (s) => s.step === stepIdx && Math.abs(s.freq - rowFreq) < 1.5
      );
      if (existing) {
        setDraft((prev) => ({
          ...prev,
          synthNotes: prev.synthNotes.filter((s) => s.id !== existing.id),
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
    }
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
    setStatusBanner(`SAVED: ${stageToSave.name}`);
    setTimeout(() => setStatusBanner(''), 2000);
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
      setDraft(importedStage);
      const nextList = [...stages, importedStage];
      onSaveStages(nextList, importedStage.id);
      setStatusBanner(`MIDI LOADED: ${importedStage.notes.length} NOTES`);
      setTimeout(() => setStatusBanner(''), 2500);
    } catch {
      setStatusBanner('MIDI ERROR');
    }
  };

  return (
    <div
      id="stage-creator-screen"
      className="fixed inset-0 z-50 bg-[#04060d]/98 flex flex-col justify-between p-3 md:p-5 overflow-hidden font-pixel text-[9px]"
    >
      {/* Minimal Icon-Driven Studio Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-6"
            style={{ backgroundColor: activeBarBiome.fg }}
          />
          <h2 className="text-xs md:text-sm text-white tracking-wider uppercase">
            # STAGE DAW
          </h2>
          <span
            className="text-[9px] px-1.5 py-0.5 border"
            style={{
              color: activeBarBiome.fg,
              borderColor: activeBarBiome.fg,
            }}
          >
            BAR {activeBarIdx + 1}: {activeBarBiome.name}
          </span>
        </div>

        {/* Minimal Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('daw')}
            className={`px-2.5 py-1.5 text-[9px] uppercase border cursor-pointer ${
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
            className={`px-2.5 py-1.5 text-[9px] uppercase border cursor-pointer ${
              viewMode === 'manager'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            = LIST ({stages.length})
          </button>

          <button
            type="button"
            data-testid="daw-play-btn"
            onClick={togglePlayPreview}
            className={`px-3 py-1.5 text-[9px] uppercase cursor-pointer border ${
              isPlayingPreview
                ? 'bg-rose-500 border-rose-300 text-white'
                : 'bg-amber-400 hover:bg-amber-300 border-amber-200 text-slate-950'
            }`}
          >
            {isPlayingPreview ? '[STOP]' : '> PLAY'}
          </button>

          <button
            type="button"
            onClick={() => handleSaveCurrentStage(false)}
            className="px-2.5 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[9px] uppercase cursor-pointer"
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
            className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[9px] uppercase cursor-pointer shadow-[0_0_14px_rgba(0,255,136,0.3)]"
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
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[9px] uppercase cursor-pointer"
          >
            X
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="mt-1.5 px-2.5 py-1 bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-[9px]">
          {statusBanner}
        </div>
      )}

      {viewMode === 'daw' ? (
        <>
          {/* Compact DAW Toolbar */}
          <div className="my-2 grid grid-cols-1 lg:grid-cols-12 gap-2 bg-slate-950/90 border border-slate-800 p-2.5">
            {/* Stage Name & All-Bar Key Preset */}
            <div className="lg:col-span-4 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] text-slate-400 w-12 shrink-0">NAME</span>
                <input
                  type="text"
                  aria-label="Stage Name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="flex-1 bg-slate-900 border border-slate-700 px-2 py-1 text-[9px] text-white"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[8px] text-slate-400 w-12 shrink-0" title="Set All Bars Biome Key">
                  ALL KEY
                </span>
                <select
                  aria-label="Biome Selector"
                  value={draft.biomeId}
                  onChange={(e) => handleSelectGlobalBiome(Number(e.target.value))}
                  className="flex-1 bg-slate-900 border border-slate-700 px-1.5 py-1 text-[9px] text-emerald-300"
                >
                  {MASTER_SCALES.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.subtitle})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sound Bank, BPM & Bar Count */}
            <div className="lg:col-span-4 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] text-slate-400 w-12 shrink-0">SYNTH</span>
                <select
                  aria-label="Sound Bank Selector"
                  value={draft.soundBankId}
                  onChange={(e) =>
                    setDraft({ ...draft, soundBankId: e.target.value })
                  }
                  className="flex-1 bg-slate-900 border border-slate-700 px-1.5 py-1 text-[9px] text-cyan-300"
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
                    className="w-14 bg-slate-900 border border-slate-700 px-1 py-0.5 text-[9px] text-amber-300"
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
            <div className="lg:col-span-4 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveChannel('lead')}
                  className={`flex-1 py-1 px-1.5 text-[8px] border uppercase cursor-pointer ${
                    activeChannel === 'lead'
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  CH1 LEAD ({draft.notes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChannel('synth')}
                  className={`flex-1 py-1 px-1.5 text-[8px] border uppercase cursor-pointer ${
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
                  onChange={(e) =>
                    setSelectedDurationBeats(parseFloat(e.target.value))
                  }
                  className="flex-1 min-w-0 bg-slate-900 border border-amber-400/70 px-1 py-1 text-[8px] text-amber-300 truncate"
                >
                  {AVAILABLE_NOTE_DURATIONS.map((d) => (
                    <option key={d.beats} value={d.beats}>
                      {d.label} ({d.beats}B)
                    </option>
                  ))}
                </select>

                <label
                  htmlFor="daw-midi-upload"
                  className="shrink-0 px-2 py-1 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-400 text-pink-200 text-[8px] uppercase cursor-pointer whitespace-nowrap"
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

          {/* 2D Scrollable Multi-Octave Piano Roll Grid with Per-Bar Biome Key & Flow Range Headers */}
          <div className="flex-1 overflow-auto border border-slate-800 bg-[#050811] relative">
            <div
              className="inline-block min-w-full"
              style={{ width: `${110 + draft.totalSteps * CELL_W}px` }}
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
                    MASTER_SCALES.find((b) => b.id === barBiomeId) ||
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
                          {MASTER_SCALES.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.subtitle})
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

              {/* Sticky Header 2: Step Numbers */}
              <div className="sticky top-[47px] z-20 flex bg-slate-950 border-b border-slate-800">
                <div className="sticky left-0 z-30 w-[110px] shrink-0 bg-slate-950 border-r border-slate-800 px-2 py-1 text-[8px] text-slate-400">
                  NOTE
                </div>
                {Array.from({ length: draft.totalSteps }, (_, stepIdx) => {
                  const isBarStart = stepIdx % STEPS_PER_BAR === 0;
                  const isBeatStart = stepIdx % STEPS_PER_BEAT === 0;
                  const isPlayhead = playheadStep === stepIdx;
                  return (
                    <div
                      key={stepIdx}
                      style={{ width: `${CELL_W}px` }}
                      className={`shrink-0 text-center py-1 text-[8px] border-r ${
                        isPlayhead
                          ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                          : isBarStart
                          ? 'bg-slate-900 text-emerald-300 border-slate-700'
                          : isBeatStart
                          ? 'bg-slate-950 text-slate-300 border-slate-800'
                          : 'bg-slate-950 text-slate-600 border-slate-900'
                      }`}
                    >
                      {stepIdx + 1}
                    </div>
                  );
                })}
              </div>

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

                    return (
                      <div
                        key={stepIdx}
                        style={{ width: `${CELL_W}px` }}
                        onClick={() =>
                          handleToggleCell(stepIdx, row.freq, row.noteName)
                        }
                        className={`relative h-full shrink-0 border-r cursor-pointer ${
                          isBarEnd ? 'border-slate-700' : 'border-slate-900/90'
                        } ${
                          isPlayhead
                            ? 'bg-amber-400/15'
                            : isBeatStart
                            ? 'bg-slate-900/40 hover:bg-slate-800/60'
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

                        {/* Active Channel Draggable & Edge-Resizable Note Block */}
                        {activeEvent && (
                          <div
                            data-note-id={activeEvent.id}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              lastPreviewedFreqRef.current = activeEvent.freq;
                              dragRef.current = {
                                mode: 'move',
                                channel: activeChannel,
                                noteId: activeEvent.id,
                                startX: e.clientX,
                                startY: e.clientY,
                                origStep: activeEvent.step,
                                origRowIdx: rowIdx,
                                origDurationBeats: activeEvent.durationBeats,
                                hasMoved: false,
                              };
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!suppressNextClickRef.current) {
                                handleToggleCell(stepIdx, row.freq, row.noteName);
                              }
                            }}
                            style={{
                              width: `${Math.max(34, spanCols * CELL_W - 3)}px`,
                              backgroundColor:
                                activeChannel === 'lead'
                                  ? barBiome.fg
                                  : '#f472b6',
                            }}
                            className="group absolute top-0.5 bottom-0.5 left-0.5 z-10 px-2 flex items-center justify-between text-[8px] text-slate-950 border border-white shadow-[0_0_8px_rgba(255,255,255,0.35)] overflow-hidden whitespace-nowrap cursor-move select-none"
                            title="Drag to move · Drag left/right edge to resize · Click to delete"
                          >
                            {/* Left Resize Handle */}
                            <div
                              data-resize-handle="left"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                dragRef.current = {
                                  mode: 'resize-left',
                                  channel: activeChannel,
                                  noteId: activeEvent.id,
                                  startX: e.clientX,
                                  startY: e.clientY,
                                  origStep: activeEvent.step,
                                  origRowIdx: rowIdx,
                                  origDurationBeats: activeEvent.durationBeats,
                                  hasMoved: false,
                                };
                              }}
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-black/25 hover:bg-white/60"
                            />

                            <span className="pointer-events-none truncate">
                              {row.noteName}
                            </span>
                            <span className="pointer-events-none text-[7px]">
                              {activeEvent.durationBeats}B
                            </span>

                            {/* Right Resize Handle */}
                            <div
                              data-resize-handle="right"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                dragRef.current = {
                                  mode: 'resize-right',
                                  channel: activeChannel,
                                  noteId: activeEvent.id,
                                  startX: e.clientX,
                                  startY: e.clientY,
                                  origStep: activeEvent.step,
                                  origRowIdx: rowIdx,
                                  origDurationBeats: activeEvent.durationBeats,
                                  hasMoved: false,
                                };
                              }}
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-black/25 hover:bg-white/60"
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

          {/* Minimal DAW Footer */}
          <div className="pt-2 mt-1.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[8px] text-slate-400">
            <div className="flex items-center gap-3">
              <span>+ CLICK: ADD/DEL</span>
              <span>* DRAG: MOVE</span>
              <span>&lt;&gt; EDGES: RESIZE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    notes: activeChannel === 'lead' ? [] : prev.notes,
                    synthNotes:
                      activeChannel === 'synth' ? [] : prev.synthNotes,
                  }))
                }
                className="px-2.5 py-1 border border-rose-500/60 hover:bg-rose-500/10 text-rose-300 uppercase cursor-pointer"
              >
                🗑 CLEAR CH
              </button>
              <button
                type="button"
                onClick={() => handleSaveCurrentStage(true)}
                className="px-2.5 py-1 border border-cyan-400/60 hover:bg-cyan-500/10 text-cyan-300 uppercase cursor-pointer"
              >
                + SAVE COPY
              </button>
            </div>
          </div>
        </>
      ) : (
        /* STAGE MANAGER LIST VIEW */
        <div className="flex-1 overflow-y-auto my-2 space-y-2 pr-1">
          {stages.map((st) => {
            const b =
              MASTER_SCALES.find((m) => m.id === st.biomeId) ||
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
