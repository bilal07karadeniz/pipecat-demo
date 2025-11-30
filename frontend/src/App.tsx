import { useEffect, useState } from 'react';
import './index.css';
import { useInterviewStore } from './stores/interviewStore';
import { SessionSetup } from './components/SessionSetup';
import { InterviewApp } from './components/InterviewApp';

function App() {
  const sessionId = useInterviewStore(state => state.sessionId);
  const initSession = useInterviewStore(state => state.initSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check URL for session parameter
    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get('session');

    if (urlSessionId && !sessionId) {
      // Load existing session from API
      fetch(`/api/sessions/${urlSessionId}`)
        .then(res => {
          if (!res.ok) throw new Error('Session not found');
          return res.json();
        })
        .then(data => {
          initSession({
            session_id: data.session_id,
            webrtc_url: data.webrtc_url,
            asset_manifest: data.asset_manifest,
          });
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-red-500 mb-4">Error: {error}</div>
          <a href="/" className="text-blue-400 hover:underline">Go to setup page</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {sessionId ? <InterviewApp /> : <SessionSetup />}
    </div>
  );
}

export default App;
