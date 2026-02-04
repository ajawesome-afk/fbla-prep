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
  Download,
  Eye,
  ArrowLeft,
  Database,
  Cpu,
  Wifi,
  WifiOff,
  LogIn,
  History,
  Calendar
} from 'lucide-react';

// Firebase Imports
import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc,
  writeBatch,
  addDoc,
  onSnapshot,
  query
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

// --- FIREBASE INITIALIZATION ----
const firebaseConfig = import.meta.env.FIREBASE_CONFIG;

let auth, db, appId;

if (getApps().length === 0) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  const app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'fbla-prep-portal';
appId = rawAppId.replace(/\//g, '_');

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); 
  const [selectedTopic, setSelectedTopic] = useState('');
  const [testMode, setTestMode] = useState(''); 
  const [sourceMode, setSourceMode] = useState('ai'); 
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupForm, setSignupForm] = useState({ name: '', email: '' });
  const [history, setHistory] = useState([]);

  const timerRef = useRef(null);
  //const apiKey = ""; // Runtime provides this
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 

  // RULE 3: Auth first, then set up listeners
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && !u.isAnonymous) {
        setIsSignedUp(true);
        setSignupForm({ 
          name: u.displayName || u.email?.split('@')[0] || 'Student', 
          email: u.email || '' 
        });
      }
    });
    
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(console.error);
    }
    
    return () => unsubscribe();
  }, []);

  // Fetch History: Follow Rule 1 (Paths) and Rule 2 (No Complex Queries)
  useEffect(() => {
    if (!user) return;

    const historyRef = collection(db, 'artifacts', appId, 'users', user.uid, 'history');
    
    const unsub = onSnapshot(historyRef, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Rule 2: Sort in memory instead of using orderBy()
      const sortedDocs = docs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setHistory(sortedDocs.slice(0, 10)); // Keep last 10
    }, (err) => {
      console.error("History fetch error:", err);
    });

    return () => unsub();
  }, [user]);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      setIsError(false);
      setIsLoading(true);
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Sign-In Error:", err);
      setIsError(true);
      setErrorMessage(err.code === 'auth/unauthorized-domain' 
        ? "Domain unauthorized. Add to Firebase Console > Auth > Settings."
        : "Failed to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveQuestionsToFirebase = async (newQs, topic) => {
    if (!user || !db) return;
    const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'fbla_questions');
    const batch = writeBatch(db);
    newQs.forEach((q) => {
      const newDocRef = doc(questionsRef);
      batch.set(newDocRef, { ...q, topic, createdAt: new Date().toISOString(), isAiGenerated: true });
    });
    try { await batch.commit(); } catch (err) { console.warn("Auto-save failed:", err.message); }
  };

  const saveScoreToFirebase = async (scoreData) => {
    if (!user || !db) return;
    
    // Save to private user history following RULE 1
    const resultsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'history');
    try {
      await addDoc(resultsRef, { 
        ...scoreData, 
        timestamp: new Date().toISOString(),
        isGuest: user.isAnonymous 
      });
    } catch (err) { console.error("Score save failed:", err.message); }
  };

  const fetchFromFirebase = async (topic) => {
    if (!user || !db) throw new Error("Database not connected.");
    const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'fbla_questions');
    try {
      const snapshot = await getDocs(questionsRef);
      const allQs = snapshot.docs.map(doc => doc.data()).filter(q => q.topic === topic);
      if (allQs.length === 0) throw new Error(`Community bank for ${topic} is empty. Use AI Mode.`);
      return [...allQs].sort(() => 0.5 - Math.random()).slice(0, 50);
    } catch (err) {
      throw err;
    }
  };

  const generateViaAI = async (topic) => {
    const systemPrompt = `Expert FBLA coordinator. Generate 50 MCQs for: "${topic}". Return ONLY a JSON array of objects with keys: question, options (4 strings), correctAnswer (index 0-3), and explanation.`;
    const makeRequest = async () => {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate 50 FBLA questions for ${topic}.` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (!response.ok) throw new Error(`Gemini Service error: ${response.status}`);
      const result = await response.json();
      return JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text);
    };
    
    let delay = 1000;
    for (let i = 0; i <= 3; i++) {
      try { return await makeRequest(); } catch (err) {
        if (i === 3) throw err;
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  };

  const handleStartSession = async (topic) => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    try {
      let fetchedQuestions = [];
      if (sourceMode === 'ai') {
        fetchedQuestions = await generateViaAI(topic);
        saveQuestionsToFirebase(fetchedQuestions, topic);
      } else {
        fetchedQuestions = await fetchFromFirebase(topic);
      }
      setQuestions(fetchedQuestions);
      setView('testing');
      if (testMode === 'timed') {
        setTimeLeft(25 * 60);
        if (timerRef.current) clearInterval(timerRef.current);
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
    } catch (err) {
      setIsError(true);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (idx) => {
    if (showFeedback && testMode === 'practice') return;
    setUserAnswers({ ...userAnswers, [currentQuestionIndex]: idx });
    if (testMode === 'practice') setShowFeedback(true);
    else if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
  };

  const finishTestManually = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setView('results');
    // Auto-save history if user is signed up
    if (isSignedUp) {
      saveScoreToFirebase({
        userName: signupForm.name,
        userEmail: signupForm.email,
        score: calculateScore(),
        total: questions.length,
        topic: selectedTopic,
        mode: testMode
      });
    }
  };

  const calculateScore = () => questions.reduce((acc, q, idx) => (userAnswers[idx] === q.correctAnswer ? acc + 1 : acc), 0);

  const resetPortal = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setView('landing');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowFeedback(false);
    setIsError(false);
  };

  const handleManualSignup = (e) => {
    e.preventDefault();
    if (signupForm.name && signupForm.email) {
      setIsSignedUp(true);
      saveScoreToFirebase({
        userName: signupForm.name,
        userEmail: signupForm.email,
        score: calculateScore(),
        total: questions.length,
        topic: selectedTopic,
        mode: testMode
      });
    }
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
          <div className="flex items-center gap-4">
            {(view === 'testing' || view === 'review') && (
              <div className="flex items-center gap-4 px-4 py-2 rounded-full font-mono bg-blue-50 text-blue-800 border border-blue-100 uppercase text-xs font-bold shadow-sm">
                <Clock className="w-4 h-4 text-blue-600" />
                {view === 'review' ? 'Review' : (testMode === 'timed' ? Math.floor(timeLeft/60)+":"+(timeLeft%60).toString().padStart(2,'0') : 'Practice')}
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
              {user ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-400 animate-pulse" />}
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{user ? 'Sync Active' : 'Connecting'}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {view === 'landing' && (
          <div className="animate-in fade-in duration-500 grid md:grid-cols-3 gap-8 items-start">
            <div className="md:col-span-2">
              <h2 className="text-4xl font-extrabold mb-4 text-slate-900 leading-tight">Master Your Event</h2>
              <p className="text-slate-600 mb-10 italic font-medium opacity-80">Generate sets with AI or pull from the Community Bank.</p>
              
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-left">
                <div className="mb-8">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Engine Selection</label>
                  <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                    <button onClick={() => setSourceMode('ai')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${sourceMode === 'ai' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Cpu className="w-4 h-4" /> AI Engine</button>
                    <button onClick={() => setSourceMode('database')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${sourceMode === 'database' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Database className="w-4 h-4" /> Community</button>
                  </div>
                </div>

                <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest px-1">Event Topic</label>
                <select className="w-full p-3.5 border border-slate-200 rounded-xl mb-8 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-700 bg-slate-50" value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
                  <option value="">-- Choose Topic --</option>
                  {FBLA_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <div className="space-y-3">
                  <button disabled={!selectedTopic || !user} onClick={() => { setTestMode('timed'); setView('config'); }} className="w-full bg-[#003366] text-white p-4 rounded-2xl font-bold disabled:opacity-50 hover:bg-blue-800 transition-all shadow-md flex items-center justify-between group">
                    <span>Timed Test (25m)</span><ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button disabled={!selectedTopic || !user} onClick={() => { setTestMode('practice'); setView('config'); }} className="w-full border-2 border-[#003366] text-[#003366] p-4 rounded-2xl font-bold hover:bg-blue-50 transition-all flex items-center justify-between group">
                    <span>Practice Mode</span><ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* History Sidebar */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Recent History</h3>
              </div>
              
              {!user || user.isAnonymous ? (
                <div className="text-center py-6 px-2">
                  <a href="/fbla_guide.html">Learn about FBLA Competitions</a>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">Sign in with Google to save your scores and study progress permanently.</p>
                  <button onClick={handleGoogleSignIn} className="w-full py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                    <LogIn className="w-4 h-4 text-[#4285F4]" /> Sign In
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic text-center py-4">No sessions recorded yet.</p>
                  ) : (
                    history.map(item => (
                      <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors cursor-default">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-bold text-slate-700 truncate max-w-[100px]">{item.topic}</span>
                          <span className="text-[10px] font-black text-blue-600">{item.score}%</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-slate-400">
                          <Calendar className="w-2.5 h-2.5" />
                          {new Date(item.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'config' && (
          <div className="text-center animate-in zoom-in-95 duration-300">
            {isLoading ? (
              <div className="flex flex-col items-center gap-6 py-12">
                <RefreshCw className="w-16 h-16 text-blue-600 animate-spin" />
                <div className="space-y-2">
                    <p className="font-black text-slate-800 tracking-wide uppercase text-lg">Assembling Session...</p>
                    <p className="text-slate-400 text-sm">{sourceMode === 'ai' ? 'Consulting Gemini Engine' : 'Syncing with Firestore'}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white p-10 rounded-2xl shadow-xl max-w-lg mx-auto border border-slate-100">
                <h3 className="text-2xl font-bold mb-2 text-slate-800 uppercase tracking-tight">{selectedTopic}</h3>
                <div className="flex justify-center gap-2 mb-10">
                   <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-full border border-blue-100">{sourceMode === 'ai' ? 'AI Generated' : 'Community Bank'}</span>
                   <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-black uppercase rounded-full border border-slate-100">50 Questions</span>
                </div>
                {isError && <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3 text-left"><AlertCircle className="w-5 h-5 flex-shrink-0" /><div><p className="font-bold mb-1 tracking-tight">Access Error</p><p className="opacity-90 leading-tight">{errorMessage}</p></div></div>}
                <button onClick={() => handleStartSession(selectedTopic)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-blue-200 transition-all active:scale-[0.98]">Begin Session</button>
                <button onClick={() => setView('landing')} className="mt-6 text-slate-400 font-bold hover:text-slate-600 uppercase text-xs tracking-widest transition-colors">Go Back</button>
              </div>
            )}
          </div>
        )}

        {view === 'testing' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 h-1.5 bg-blue-600 transition-all duration-500" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}></div>
              <h3 className="text-xl md:text-2xl font-semibold mb-10 text-slate-800 leading-relaxed">{questions[currentQuestionIndex]?.question}</h3>
              <div className="grid gap-4">
                {questions[currentQuestionIndex]?.options.map((opt, idx) => (
                  <button key={idx} onClick={() => handleAnswer(idx)} disabled={showFeedback} className={`p-5 text-left rounded-2xl border-2 transition-all flex justify-between items-center group ${userAnswers[currentQuestionIndex] === idx ? 'border-blue-600 bg-blue-50 text-blue-900 font-medium' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}>
                    <span>{opt}</span>
                    {userAnswers[currentQuestionIndex] === idx && !showFeedback && <CheckCircle className="w-5 h-5 text-blue-600" />}
                  </button>
                ))}
              </div>
              {showFeedback && (
                <div className="mt-10 p-6 bg-blue-50 rounded-2xl border border-blue-100 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center gap-2 font-bold text-blue-900 mb-2 text-sm uppercase tracking-wide"><BookOpen className="w-4 h-4" /> Study Insight</div>
                  <p className="text-sm text-blue-800 mb-8 leading-relaxed italic opacity-90">{questions[currentQuestionIndex].explanation}</p>
                  <button onClick={() => { setShowFeedback(false); if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(c => c + 1); else finishTestManually(); }} className="bg-blue-600 text-white px-10 py-3.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all">Next Question</button>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-slate-400 font-bold px-2">
              <button onClick={() => { setCurrentQuestionIndex(c => Math.max(0, c-1)); setShowFeedback(false); }} disabled={showFeedback || currentQuestionIndex === 0} className="hover:text-slate-700 disabled:opacity-30 flex items-center gap-2 font-bold"><ArrowLeft className="w-4 h-4" /> Back</button>
              <span className="bg-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-tighter">Item {currentQuestionIndex + 1} / {questions.length}</span>
              <button onClick={finishTestManually} className="text-red-400 hover:text-red-600 font-bold">Finish Early</button>
            </div>
          </div>
        )}

        {view === 'results' && (
          <div className="bg-white p-12 rounded-3xl shadow-xl text-center max-w-2xl mx-auto border border-slate-100 animate-in zoom-in-95">
            <Trophy className="w-20 h-20 text-blue-600 mx-auto mb-6" />
            <h2 className="text-3xl font-black mb-2 text-slate-900 leading-tight">Session Complete</h2>
            <p className="text-slate-500 mb-10 uppercase tracking-widest text-sm font-bold">{selectedTopic}</p>
            <div className="text-7xl font-black text-blue-600 mb-10">{calculateScore()} <span className="text-2xl text-slate-300">/ {questions.length}</span></div>
            <div className="grid grid-cols-2 gap-4 mb-10">
              <button onClick={handleDownloadScore} className="flex items-center justify-center gap-2 bg-slate-100 p-4 rounded-xl font-bold hover:bg-slate-200 transition-all text-slate-700 border border-slate-200"><Download className="w-5 h-5" /> Download report</button>
              <button onClick={() => setView('review')} className="flex items-center justify-center gap-2 bg-blue-50 p-4 rounded-xl font-bold hover:bg-blue-100 transition-all text-blue-700 border border-blue-100"><Eye className="w-5 h-5" /> Review Answers</button>
            </div>
            {!isSignedUp && (
              <div className="bg-[#003366] p-8 rounded-2xl text-white text-left shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="font-bold mb-2 flex items-center gap-2 text-lg"><UserPlus className="w-5 h-5 text-yellow-400" /> Save Results Permanently</h4>
                  
                  <button 
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full bg-white text-slate-800 flex items-center justify-center gap-3 py-3 rounded-xl font-bold mb-6 hover:bg-slate-50 transition-all active:scale-95 shadow-lg disabled:opacity-50"
                  >
                    <LogIn className="w-5 h-5 text-[#4285F4]" /> Register with Google
                  </button>

                  <div className="flex items-center gap-3 mb-6 opacity-30">
                    <div className="h-px bg-white flex-1"></div>
                    <span className="text-xs font-black uppercase">Or Manual Signup</span>
                    <div className="h-px bg-white flex-1"></div>
                  </div>

                  <form onSubmit={handleManualSignup} className="space-y-4">
                    <input required placeholder="Full Name" className="w-full p-3.5 rounded-xl text-black outline-none focus:ring-2 focus:ring-yellow-400 transition-all font-medium" value={signupForm.name} onChange={e => setSignupForm({...signupForm, name: e.target.value})} />
                    <input required type="email" placeholder="Email Address" className="w-full p-3.5 rounded-xl text-black outline-none focus:ring-2 focus:ring-yellow-400 transition-all font-medium" value={signupForm.email} onChange={e => setSignupForm({...signupForm, email: e.target.value})} />
                    <button type="submit" className="w-full bg-yellow-400 text-blue-900 py-3.5 rounded-xl font-black uppercase tracking-wider text-sm shadow-md hover:bg-yellow-300 transition-all active:scale-95">Register & Save</button>
                  </form>
                </div>
                <Database className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10" />
              </div>
            )}
            <button onClick={resetPortal} className="mt-10 text-slate-400 font-bold hover:text-[#003366] transition-colors uppercase text-xs tracking-widest font-black tracking-widest">Return to Dashboard</button>
          </div>
        )}

        {view === 'review' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500 pb-20">
            <div className="flex items-center justify-between sticky top-20 bg-slate-50/90 backdrop-blur-sm py-4 z-40 border-b border-slate-200 -mx-6 px-6 mb-4">
              <button onClick={() => setView('results')} className="flex items-center gap-2 font-bold text-slate-500 hover:text-slate-800 bg-white px-5 py-2.5 rounded-xl border border-slate-200 transition-all shadow-sm"><ArrowLeft className="w-5 h-5" /> Back</button>
              <div className="text-sm font-bold text-blue-900 bg-blue-50 px-5 py-2.5 rounded-xl border border-blue-100 uppercase tracking-widest font-black">Reviewing Session</div>
            </div>
            {questions.map((q, idx) => (
              <div key={idx} className={`p-8 bg-white rounded-3xl border-l-8 shadow-sm ${userAnswers[idx] === q.correctAnswer ? 'border-green-500' : 'border-red-500'}`}>
                <p className="font-bold mb-8 text-slate-800 text-lg leading-relaxed">{idx + 1}. {q.question}</p>
                <div className="grid gap-3 text-sm mb-8">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className={`p-4 rounded-xl border-2 flex items-center justify-between ${oIdx === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-900 font-bold shadow-sm' : (oIdx === userAnswers[idx] ? 'bg-red-50 border-red-200 text-red-900 font-bold' : 'border-slate-50 text-slate-500')}`}>
                      <span>{opt}</span>
                      {oIdx === q.correctAnswer && <CheckCircle className="w-4 h-4" />}
                      {oIdx === userAnswers[idx] && oIdx !== q.correctAnswer && <AlertCircle className="w-4 h-4" />}
                    </div>
                  ))}
                </div>
                <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 shadow-inner">
                  <div className="flex items-center gap-2 font-bold text-blue-900 mb-2 text-xs uppercase tracking-widest"><BookOpen className="w-4 h-4" /> Study Insight</div>
                  <p className="text-sm text-blue-800 leading-relaxed italic opacity-95 font-medium">{q.explanation}</p>
                </div>
              </div>
            ))}
            <div className="text-center py-10"><button onClick={resetPortal} className="bg-[#003366] text-white px-12 py-4 rounded-2xl font-black shadow-lg hover:bg-blue-800 transition-all uppercase tracking-widest text-sm">Start New Event Practice</button></div>
          </div>
        )}
      </main>
      <footer className="text-center py-10 text-slate-400 text-xs">
        <p className="font-bold mb-2 uppercase tracking-tighter">&copy; 2026 fbla.aahanjain.com • Master Your Competition  • <a href="/fbla_guide.html">Learn about FBLA Competitions</a></p>
      </footer>
    </div>
  );
};

export default App;
