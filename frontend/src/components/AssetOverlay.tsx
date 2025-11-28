import clsx from 'clsx';
import type { Asset } from '../types/session';
import { VideoPlayer } from './VideoPlayer';
import { getAssetUrl } from '../services/api';

interface AssetOverlayProps {
  asset: Asset;
  startTime?: number;  // Override for video clip start
  endTime?: number;    // Override for video clip end
  className?: string;
}

export function AssetOverlay({ asset, startTime, endTime, className }: AssetOverlayProps) {
  const assetUrl = getAssetUrl(asset.url);

  // Use overrides if provided, otherwise fall back to asset values
  const videoStartTime = startTime ?? asset.start_time;
  const videoEndTime = endTime ?? asset.end_time;

  return (
    <div className={clsx('flex items-center justify-center p-8', className)}>
      {/* Floating card - plasma visible around edges */}
      <div className="bg-black/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 max-w-4xl max-h-[85%] flex flex-col items-center border border-white/10">
        {asset.type === 'video' ? (
          <VideoPlayer
            src={assetUrl}
            poster={asset.poster_url ? getAssetUrl(asset.poster_url) : undefined}
            startTime={videoStartTime}
            endTime={videoEndTime}
          />
        ) : (
          <img
            src={assetUrl}
            alt={asset.title}
            className="max-w-full max-h-[65vh] object-contain rounded-lg"
          />
        )}
        <p className="text-center text-gray-300 mt-4 text-sm">
          {asset.title}
        </p>
      </div>
    </div>
  );
}
