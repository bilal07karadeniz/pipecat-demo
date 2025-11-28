import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useInterviewStore } from '../stores/interviewStore';
import { PlasmaBackground } from './PlasmaBackground';
import { AssetOverlay } from './AssetOverlay';
import { AudioOrb, hasWebGLSupport } from './AudioOrb';

interface VisualPanelProps {
  className?: string;
}

export function VisualPanel({ className }: VisualPanelProps) {
  const currentAsset = useInterviewStore(state => state.currentAsset);
  const currentAssetStartTime = useInterviewStore(state => state.currentAssetStartTime);
  const currentAssetEndTime = useInterviewStore(state => state.currentAssetEndTime);
  const agentState = useInterviewStore(state => state.agentState);
  const getOutputVolume = useInterviewStore(state => state.getOutputVolume);
  const getInputVolume = useInterviewStore(state => state.getInputVolume);

  const [supportsWebGL, setSupportsWebGL] = useState(true);

  useEffect(() => {
    setSupportsWebGL(hasWebGLSupport());
  }, []);

  return (
    <div className={clsx('relative overflow-hidden', className)}>
      {/* Audio-reactive orb (WebGL) or Plasma background fallback */}
      {supportsWebGL ? (
        <div className="absolute inset-0">
          <AudioOrb
            agentState={agentState}
            getOutputVolume={getOutputVolume}
            getInputVolume={getInputVolume}
          />
        </div>
      ) : (
        <PlasmaBackground className="absolute inset-0" />
      )}

      {/* Asset overlay - shown when asset is active */}
      {currentAsset && (
        <AssetOverlay
          asset={currentAsset}
          startTime={currentAssetStartTime}
          endTime={currentAssetEndTime}
          className="absolute inset-0 z-10"
        />
      )}
    </div>
  );
}
