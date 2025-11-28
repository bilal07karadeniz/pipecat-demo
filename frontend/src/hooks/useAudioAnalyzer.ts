import { useRef, useCallback } from 'react';

interface AudioAnalyzer {
  setupAnalyzer: (stream: MediaStream) => void;
  getVolume: () => number;
  cleanup: () => void;
}

/**
 * Hook for analyzing audio streams and getting volume levels.
 * Used for audio-reactive visualizations.
 */
export function useAudioAnalyzer(): AudioAnalyzer {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const setupAnalyzer = useCallback((stream: MediaStream) => {
    // Cleanup existing analyzer
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Create new audio context
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    // Create analyzer node
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    analyzer.smoothingTimeConstant = 0.8;
    analyzerRef.current = analyzer;

    // Create data array for frequency data
    const bufferLength = analyzer.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    // Connect stream to analyzer
    const source = audioContext.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyzer);
  }, []);

  const getVolume = useCallback((): number => {
    if (!analyzerRef.current || !dataArrayRef.current) {
      return 0;
    }

    // Get frequency data
    analyzerRef.current.getByteFrequencyData(dataArrayRef.current as Uint8Array<ArrayBuffer>);

    // Calculate average volume (0-255 range)
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const average = sum / dataArrayRef.current.length;

    // Normalize to 0-1 range with some amplification
    return Math.min(1, average / 128);
  }, []);

  const cleanup = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyzerRef.current = null;
    dataArrayRef.current = null;
  }, []);

  return {
    setupAnalyzer,
    getVolume,
    cleanup,
  };
}

/**
 * Creates a standalone audio analyzer (non-hook version for store).
 */
export function createAudioAnalyzer(): AudioAnalyzer {
  let audioContext: AudioContext | null = null;
  let analyzer: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let dataArray: Uint8Array | null = null;

  const setupAnalyzer = (stream: MediaStream) => {
    // Cleanup existing
    if (audioContext) {
      audioContext.close();
    }

    // Create new audio context
    audioContext = new AudioContext();

    // Create analyzer node
    analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    analyzer.smoothingTimeConstant = 0.8;

    // Create data array
    const bufferLength = analyzer.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // Connect stream to analyzer
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyzer);
  };

  const getVolume = (): number => {
    if (!analyzer || !dataArray) {
      return 0;
    }

    analyzer.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;

    return Math.min(1, average / 128);
  };

  const cleanup = () => {
    if (source) {
      source.disconnect();
      source = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    analyzer = null;
    dataArray = null;
  };

  return {
    setupAnalyzer,
    getVolume,
    cleanup,
  };
}
