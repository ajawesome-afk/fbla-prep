import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  Trophy, 
  UserPlus, 
  RefreshCw, 
  Home, 
  GraduationCap, 
  Database,
  Download,
  Eye,
  ArrowLeft
} from 'lucide-react';

// Firebase Imports
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc,
  writeBatch
} from 'firebase/firestore';

const FBLA_TOPICS = [
  "Accounting", "Advanced Accounting", "Advertising", "Agribusiness",
  "Business Communication", "Business Law", "Computer Problem Solving",
  "Cybersecurity", "Data Science & AI", "Economics", "Healthcare Administration",
  "Human Resource Management", "Insurance & Risk Management", "Journalism",
  "Networking Infrastructures", "Organizational Leadership", "Personal Finance",
  "Project Management", "Public Administration & Management", "Real Estate",
  "Retail Management", "Securities & Investments"
];

// Safety-wrapped Firebase Initialization
let auth, db, appId;

try {
  const configStr = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
  const firebaseConfig = JSON.parse(configStr);
  
  if (firebaseConfig.apiKey && getApps().length === 0) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  appId = typeof __app_id !== 'undefined' ? __app_id : 'default-fbla-app';
} catch (e) {
  console.error("Firebase config error:", e);
}

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); 
  const [selectedTopic, setSelectedTopic] = useState('');
  const [testMode, setTestMode] = useState(''); 
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupForm, setSignupForm] = useState({ name: '', email: '' });

  const timerRef = useRef(null);
  const apiKey = ""; // Set this in Vercel as VITE_GEMINI_API_KEY

  useEffect(() => {
    if (!auth) return;
    
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Authentication error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const generateViaAI = async (topic) => {
    const systemPrompt = `You are an expert FBLA competitive events coordinator. Generate 50 high-quality MCQs for the topic: "${topic}". Return ONLY a JSON array of objects.`;
    
    const makeRequest = async () => {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate 50 FBLA ${topic} questions.` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) throw new Error(`Gemini API Error`);
      const result = await response.json();
      return JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text);
    };

    let delay = 1000;
    for (let i = 0; i <= 5; i++) {
      try {
        return await makeRequest();
      } catch (err) {
        if (i === 5) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  };

  const saveToDatabase = async (newQs, topic) => {
    if (!auth || !auth.currentUser || !db) return;
    const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'fbla_questions');
    try {
      const batch = writeBatch(db);
      newQs.forEach((q) => {
        const newDocRef = doc(questionsRef);
        batch.set(newDocRef, { ...q, topic, createdAt: new Date().toISOString(), appId });
      });
      await batch.commit();
    } catch (err) {
      console.error("Firestore Error:", err);
    }
  };

  const fetchQuestions = async (topic) => {
    setIsLoading(true);
    setIsError(false);
    try {
      if (db) {
        const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'fbla_questions');
        const querySnapshot = await getDocs(questionsRef);
        const allQuestions = querySnapshot.docs
          .map(doc => doc.data())
          .filter(q => q.topic === topic);

        if (allQuestions.length >= 50) {
          const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
          setQuestions(shuffled.slice(0, 50));
          startTest();
          setIsLoading(false);
          return;
        }
      }
      
      const newQuestions = await generateViaAI(topic);
      if (db) await saveToDatabase(newQuestions, topic);
      setQuestions(newQuestions);
      startTest();
    } catch (err) {
      console.error(err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const startTest = () => {
    setView('testing');
    if (testMode === 'timed') {
      setTimeLeft(25 * 60);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setView('results');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleAnswer = (optionIndex) => {
    if (showFeedback && testMode === 'practice') return;
    setUserAnswers({ ...userAnswers, [currentQuestionIndex]: optionIndex });
    if (testMode === 'practice') setShowFeedback(true);
    else if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
  };

  const handleDownloadScore = () => {
    const score = calculateScore();
    const content = `FBLA Score Report\nTopic: ${selectedTopic}\nScore: ${score} / 50\nDate: ${new Date().toLocaleString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FBLA_Score_${selectedTopic}.txt`;
    a.click();
  };

  const calculateScore = () => {
    return questions.reduce((acc, q, idx) => (userAnswers[idx] === q.correctAnswer ? acc + 1 : acc), 0);
  };

  const resetPortal = () => {
    clearInterval(timerRef.current);
    setView('landing');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowFeedback(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetPortal}>
            <div className="bg-[#003366] p-2 rounded-lg text-white">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-[#003366]">FBLA Prep</h1>
          </div>
          {view === 'testing' && (
            <div className="flex items-center gap-4 px-4 py-2 rounded-full font-mono bg-blue-50 text-blue-800">
              <Clock className="w-5 h-5" />
              {testMode === 'timed' ? formatTime(timeLeft) : 'Practice'}
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {view === 'landing' && (
          <div className="text-center">
            <h2 className="text-4xl font-extrabold mb-4">FBLA Mastery Portal</h2>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md mx-auto text-left">
              <select className="w-full p-3 border rounded-xl mb-6" value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
                <option value="">-- Choose Topic --</option>
                {FBLA_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button disabled={!selectedTopic} onClick={() => { setTestMode('timed'); setView('config'); }} className="w-full bg-[#003366] text-white p-4 rounded-xl font-bold mb-4 disabled:opacity-50">Timed Test</button>
              <button disabled={!selectedTopic} onClick={() => { setTestMode('practice'); setView('config'); }} className="w-full border-2 border-[#003366] text-[#003366] p-4 rounded-xl font-bold">Practice Mode</button>
            </div>
          </div>
        )}

        {view === 'config' && (
          <div className="text-center">
            {isLoading ? (
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            ) : (
              <div className="bg-white p-10 rounded-2xl shadow-xl max-w-lg mx-auto">
                <h3 className="text-2xl font-bold mb-6">{selectedTopic}</h3>
                <button onClick={() => fetchQuestions(selectedTopic)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold">Start Now</button>
              </div>
            )}
          </div>
        )}

        {view === 'testing' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl border border-slate-200">
              <h3 className="text-xl font-semibold mb-8">{questions[currentQuestionIndex]?.question}</h3>
              <div className="grid gap-4">
                {questions[currentQuestionIndex]?.options.map((opt, idx) => (
                  <button key={idx} onClick={() => handleAnswer(idx)} disabled={showFeedback} className={`p-5 text-left rounded-xl border-2 transition-all ${userAnswers[currentQuestionIndex] === idx ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}>{opt}</button>
                ))}
              </div>
              {showFeedback && (
                <div className="mt-8 p-6 bg-blue-50 rounded-xl">
                  <p className="font-bold text-blue-900 mb-2">Explanation</p>
                  <p className="text-sm mb-4">{questions[currentQuestionIndex].explanation}</p>
                  <button onClick={() => { setShowFeedback(false); if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(c => c + 1); else setView('results'); }} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">Next</button>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-slate-400 font-bold">
              <button onClick={() => setCurrentQuestionIndex(c => Math.max(0, c-1))} disabled={showFeedback}>Previous</button>
              <span>{currentQuestionIndex + 1} / 50</span>
              <button onClick={() => setView('results')} className="text-red-500">Finish</button>
            </div>
          </div>
        )}

        {view === 'results' && (
          <div className="bg-white p-12 rounded-3xl shadow-xl text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-black mb-8">Test Result</h2>
            <div className="text-6xl font-black text-blue-600 mb-10">{calculateScore()} / 50</div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button onClick={handleDownloadScore} className="flex items-center justify-center gap-2 bg-slate-100 p-3 rounded-xl font-bold"><Download className="w-5 h-5" /> Download</button>
              <button onClick={() => isSignedUp ? setView('review') : null} disabled={!isSignedUp} className="flex items-center justify-center gap-2 bg-blue-50 p-3 rounded-xl font-bold disabled:opacity-50"><Eye className="w-5 h-5" /> Review</button>
            </div>
            {!isSignedUp && (
              <div className="bg-[#003366] p-8 rounded-2xl text-white text-left">
                <h4 className="font-bold mb-2">Unlock Detailed Review</h4>
                <p className="text-sm mb-4">Sign up to see which answers were correct.</p>
                <form onSubmit={(e) => { e.preventDefault(); setIsSignedUp(true); }} className="space-y-3">
                  <input required placeholder="Name" className="w-full p-2 rounded text-black" onChange={e => setSignupForm({...signupForm, name: e.target.value})} />
                  <input required placeholder="Email" className="w-full p-2 rounded text-black" onChange={e => setSignupForm({...signupForm, email: e.target.value})} />
                  <button className="w-full bg-yellow-400 text-blue-900 py-2 rounded font-bold">Unlock Now</button>
                </form>
              </div>
            )}
            <button onClick={resetPortal} className="mt-8 text-slate-400 font-bold">Home</button>
          </div>
        )}

        {view === 'review' && (
          <div className="space-y-6">
            <button onClick={() => setView('results')} className="flex items-center gap-2 font-bold text-slate-500"><ArrowLeft className="w-5 h-5" /> Back</button>
            {questions.map((q, idx) => (
              <div key={idx} className={`p-6 bg-white rounded-2xl border-l-4 ${userAnswers[idx] === q.correctAnswer ? 'border-green-500' : 'border-red-500'}`}>
                <p className="font-bold mb-4">{idx + 1}. {q.question}</p>
                <div className="grid gap-2 text-sm mb-4">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className={`p-2 rounded ${oIdx === q.correctAnswer ? 'bg-green-100 text-green-800' : (oIdx === userAnswers[idx] ? 'bg-red-100 text-red-800' : 'text-slate-500')}`}>{opt}</div>
                  ))}
                </div>
                <p className="text-xs text-blue-700 bg-blue-50 p-3 rounded">{q.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;