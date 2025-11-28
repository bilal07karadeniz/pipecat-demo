import './index.css';
import { useInterviewStore } from './stores/interviewStore';
import { SessionSetup } from './components/SessionSetup';
import { InterviewApp } from './components/InterviewApp';

function App() {
  const sessionId = useInterviewStore(state => state.sessionId);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {sessionId ? <InterviewApp /> : <SessionSetup />}
    </div>
  );
}

export default App;
