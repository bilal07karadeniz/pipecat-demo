import { useState, useCallback } from 'react';
import { useInterviewStore } from '../stores/interviewStore';
import { createSession } from '../services/api';

export function SessionSetup() {
  const initSession = useInterviewStore(state => state.initSession);

  const [prompt, setPrompt] = useState('');
  const [assets, setAssets] = useState<File[]>([]);
  const [kb, setKb] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAssets(Array.from(e.target.files));
    }
  }, []);

  const handleKbChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setKb(e.target.files[0]);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    if (assets.length === 0) {
      setError('Please upload at least one asset');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await createSession(prompt, assets, kb || undefined);
      initSession(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Interview Bot Setup</h1>
          <p className="text-gray-400">
            Configure your voice interview session
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Interview Prompt *
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter the instructions for the interview bot...

Example:
You are interviewing a hiring manager about their staffing needs. Ask about:
1. What positions they need to fill
2. Required skills and experience
3. Timeline for hiring
4. Budget considerations"
            rows={8}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-1">
            Assets *
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Supported: PNG, JPG, WEBP, GIF, PPTX, MP4, WEBM
          </p>
          <input
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.gif,.ppt,.pptx,.pdf,.mp4,.webm"
            onChange={handleAssetChange}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white
                       file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                       file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
          />
          {assets.length > 0 && (
            <p className="mt-2 text-sm text-gray-400">
              {assets.length} file(s) selected: {assets.map(f => f.name).join(', ')}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Knowledge Base (optional)
          </label>
          <input
            type="file"
            accept=".yaml,.yml,.json"
            onChange={handleKbChange}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white
                       file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                       file:bg-gray-600 file:text-white hover:file:bg-gray-500 file:cursor-pointer"
          />
          {kb && (
            <p className="mt-2 text-sm text-gray-400">
              Selected: {kb.name}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed
                     rounded-lg font-medium text-white transition-colors"
        >
          {isLoading ? 'Creating Session...' : 'Start Interview'}
        </button>
      </form>
    </div>
  );
}
