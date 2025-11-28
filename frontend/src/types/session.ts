export type Asset = {
  asset_id: string;
  title: string;
  type: 'image' | 'video';
  url: string;
  poster_url?: string;
  duration_sec?: number;
  start_time?: number;  // For video clips - start position in seconds
  end_time?: number;    // For video clips - end position in seconds
};

export type SessionResponse = {
  session_id: string;
  webrtc_url: string;
  asset_manifest: Asset[];
};

export type TranscriptEntry = {
  id: string;
  speaker: 'user' | 'bot';
  text: string;
  timestamp: Date;
  isFinal: boolean;
};

export type BotMessage = {
  type: 'transcript' | 'show_asset' | 'hide_asset' | 'agent_state' | 'pong';
  speaker?: string;
  text?: string;
  is_final?: boolean;
  asset_id?: string;
  asset?: Asset;
  state?: string;
  start_time?: number;  // Override for video clip start position
  end_time?: number;    // Override for video clip end position
};
