import { create } from 'zustand';
import type { Asset, TranscriptEntry, SessionResponse } from '../types/session';
import type { AgentState } from '../components/AudioOrb';

type VolumeGetter = () => number;

interface InterviewState {
  // Session
  sessionId: string | null;
  webrtcUrl: string | null;
  assets: Asset[];

  // Connection
  isConnected: boolean;
  isConnecting: boolean;
  isRecording: boolean;

  // Agent state for visualization
  agentState: AgentState;
  getOutputVolume: VolumeGetter;
  getInputVolume: VolumeGetter;

  // Transcript
  transcript: TranscriptEntry[];

  // Asset display
  currentAsset: Asset | null;
  currentAssetStartTime: number | undefined;  // Video clip override
  currentAssetEndTime: number | undefined;    // Video clip override

  // Actions
  initSession: (response: SessionResponse) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setRecording: (recording: boolean) => void;
  setAgentState: (state: AgentState) => void;
  setVolumeGetters: (output: VolumeGetter, input: VolumeGetter) => void;
  addTranscriptEntry: (entry: Omit<TranscriptEntry, 'id'>) => void;
  updateLastTranscript: (speaker: string, text: string, isFinal: boolean) => void;
  showAsset: (assetId: string, asset?: Asset, startTime?: number, endTime?: number) => void;
  hideAsset: () => void;
  reset: () => void;
}

let entryCounter = 0;

// Default no-op volume getter
const defaultVolumeGetter: VolumeGetter = () => 0;

export const useInterviewStore = create<InterviewState>((set, _get) => ({
  sessionId: null,
  webrtcUrl: null,
  assets: [],
  isConnected: false,
  isConnecting: false,
  isRecording: false,
  agentState: 'idle',
  getOutputVolume: defaultVolumeGetter,
  getInputVolume: defaultVolumeGetter,
  transcript: [],
  currentAsset: null,
  currentAssetStartTime: undefined,
  currentAssetEndTime: undefined,

  initSession: (response) => set({
    sessionId: response.session_id,
    webrtcUrl: response.webrtc_url,
    assets: response.asset_manifest,
    transcript: [],
    currentAsset: null,
  }),

  setConnected: (connected) => set({ isConnected: connected, isConnecting: false }),

  setConnecting: (connecting) => set({ isConnecting: connecting }),

  setRecording: (recording) => set({ isRecording: recording }),

  setAgentState: (agentState) => set({ agentState }),

  setVolumeGetters: (getOutputVolume, getInputVolume) => set({
    getOutputVolume,
    getInputVolume,
  }),

  addTranscriptEntry: (entry) => set((state) => ({
    transcript: [
      ...state.transcript,
      { ...entry, id: `entry-${++entryCounter}` }
    ]
  })),

  updateLastTranscript: (speaker, text, isFinal) => set((state) => {
    const transcript = [...state.transcript];

    // Find last entry from same speaker that isn't final
    for (let i = transcript.length - 1; i >= 0; i--) {
      const entry = transcript[i];
      if (entry.speaker === speaker && !entry.isFinal) {
        transcript[i] = { ...entry, text, isFinal };
        return { transcript };
      }
    }

    // No matching entry found, add new one
    return {
      transcript: [
        ...transcript,
        {
          id: `entry-${++entryCounter}`,
          speaker: speaker as 'user' | 'bot',
          text,
          timestamp: new Date(),
          isFinal
        }
      ]
    };
  }),

  showAsset: (assetId, asset, startTime, endTime) => set((state) => {
    // If asset provided directly, use it
    if (asset) {
      return {
        currentAsset: asset,
        currentAssetStartTime: startTime,
        currentAssetEndTime: endTime,
      };
    }
    // Otherwise find in assets list
    const found = state.assets.find(a => a.asset_id === assetId);
    return {
      currentAsset: found || null,
      currentAssetStartTime: startTime,
      currentAssetEndTime: endTime,
    };
  }),

  hideAsset: () => set({
    currentAsset: null,
    currentAssetStartTime: undefined,
    currentAssetEndTime: undefined,
  }),

  reset: () => {
    entryCounter = 0;
    set({
      sessionId: null,
      webrtcUrl: null,
      assets: [],
      isConnected: false,
      isConnecting: false,
      isRecording: false,
      agentState: 'idle',
      getOutputVolume: defaultVolumeGetter,
      getInputVolume: defaultVolumeGetter,
      transcript: [],
      currentAsset: null,
      currentAssetStartTime: undefined,
      currentAssetEndTime: undefined,
    });
  },
}));
