import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithCustomToken
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp 
} from "firebase/firestore";

// --- Configuration ---
const firebaseConfig = import.meta.env.FIREBASE_CONFIG;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'fbla-prep-v1';
const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // Provided by environment

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Data ---
const FBLA_TOPICS = [
  "Accounting", "Advertising", "Agribusiness", "Business Communication", "Business Law", 
  "Computer Problem Solving", "Cybersecurity", "Data Analysis", "Economics", 
  "Entrepreneurship", "Healthcare Administration", "Human Resource Management", 
  "Insurance & Risk Management", "Introduction to Business", "Introduction to IT", 
  "Journalism", "Marketing", "Networking Infrastructures", "Organizational Leadership", 
  "Personal Finance", "Project Management", "Public Speaking", 
  "Securities & Investments", "Sports & Entertainment Management", "Supply Chain Management", 
  "UX Design", "Website Design"
];

// --- Shared Components ---

const Icon = ({ name, className = "", size = 20 }) => {
  const pascalName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
    
  const LucideIcon = LucideIcons[pascalName];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} className={className} />;
};

const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false, type = "button" }) => {
  const base = "px-6 py-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 text-sm tracking-wide";
  const variants = {
    primary: "bg-gradient-to-br from-zinc-800 to-black dark:from-zinc-100 dark:to-zinc-300 text-white dark:text-black shadow-lg shadow-zinc-200 dark:shadow-zinc-900/50 hover:shadow-xl disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed",
    secondary: "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800",
    ghost: "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800",
    google: "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm"
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-enter border border-zinc-200 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><Icon name="x" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const SearchableSelect = ({ options, value, onChange, placeholder = "Select..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { if(value) setSearchTerm(value); }, [value]);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative group">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if(e.target.value === "") onChange("");
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full p-4 pl-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-600 transition-all font-medium text-lg placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"><Icon name="search" size={20} /></div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-200" onClick={() => setIsOpen(!isOpen)}>
          <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={20} />
        </div>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-hidden animate-enter">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt}
                onClick={() => { onChange(opt); setSearchTerm(opt); setIsOpen(false); }}
                className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between group transition-colors"
              >
                <span className="text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white font-medium">{opt}</span>
                {value === opt && <Icon name="check" size={16} className="text-emerald-500" />}
              </div>
            ))
          ) : <div className="p-4 text-center text-zinc-400 text-sm">No topics found</div>}
        </div>
      )}
    </div>
  );
};

// --- App Sub-Views (Moved out of App to prevent re-creation bugs) ---

const LandingView = ({ config, setConfig, errorMsg, generateQuiz }) => (
  <div className="max-w-4xl mx-auto w-full px-6 pt-12 md:pt-20 animate-enter pb-32">
    <div className="text-center mb-16">
      <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-zinc-900 dark:text-white mb-6">Master your event.</h1>
      <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed font-light">Configure your custom simulation environment.</p>
    </div>

    <div className="grid md:grid-cols-12 gap-8">
      <div className="md:col-start-3 md:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl shadow-zinc-200/50 dark:shadow-black/50 transition-all">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-3">
            <Icon name="alert-triangle" size={18} /> {errorMsg}
          </div>
        )}
        
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Topic</label>
            <SearchableSelect options={FBLA_TOPICS} value={config.topic} onChange={(val) => setConfig({...config, topic: val})} placeholder="Type topic..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1 mb-2">Mode</label>
               <div className="grid grid-cols-2 gap-2">
                  {[{ id: 'practice', icon: 'zap', label: 'Practice' }, { id: 'timed', icon: 'clock', label: 'Ranked' }].map(m => (
                    <button 
                      key={m.id}
                      onClick={() => setConfig({ ...config, mode: m.id })}
                      className={`p-3 rounded-xl border text-center transition-all ${config.mode === m.id ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Icon name={m.icon} size={18} />
                        <span className="font-bold text-xs">{m.label}</span>
                      </div>
                    </button>
                  ))}
               </div>
             </div>

             <div>
               <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1 mb-2">Difficulty</label>
               <div className="grid grid-cols-3 gap-2">
                  {['Easy', 'Medium', 'Hard'].map(d => (
                    <button key={d} onClick={() => setConfig({ ...config, difficulty: d })} className={`p-3 rounded-xl border text-center transition-all ${config.difficulty === d ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                      <span className="font-bold text-xs">{d}</span>
                    </button>
                  ))}
               </div>
             </div>
          </div>

          <Button onClick={generateQuiz} disabled={!config.topic} className="w-full py-5 text-base mt-4">Initialize Session <Icon name="arrow-right" size={18} /></Button>
        </div>
      </div>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [view, setView] = useState('landing');
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [config, setConfig] = useState({ 
    topic: '', 
    mode: 'practice', 
    questionCount: 20, 
    duration: 25,
    difficulty: 'Hard'
  });
  const [quizData, setQuizData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);

  // Core Theme Logic
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Auth Lifecycle
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Auth init failed", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Sync History
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'history'), 
      orderBy('date', 'desc'), 
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("History fetch error", err));
    return () => unsubscribe();
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setLoginModalOpen(false);
      showToast("Signed in with Google");
    } catch (err) {
      console.error("Google Auth Error", err);
      showToast("Sign-In failed.", 'error');
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast("Account created!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Signed in successfully");
      }
      setLoginModalOpen(false);
      setEmail(''); setPassword('');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const saveResult = async (score) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), {
        topic: config.topic,
        score: score,
        total: quizData.length,
        mode: config.mode,
        difficulty: config.difficulty,
        date: serverTimestamp()
      });
    } catch (e) { console.error("Save error", e); }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'feedback'), {
        text: feedbackText,
        userId: user ? user.uid : 'anon',
        timestamp: serverTimestamp()
      });
      setFeedbackText("");
      setFeedbackOpen(false);
      showToast("Feedback sent successfully!");
    } catch (e) {
      console.error("Feedback error", e);
      showToast("Could not send feedback.", "error");
    }
  };

  const generateQuiz = async () => {
    setIsLoading(true); setView('loading'); setErrorMsg('');
    const fetchWithRetry = async (retries = 5, delay = 1000) => {
      const systemPrompt = `Create a ${config.difficulty.toLowerCase()} difficulty, competition-level practice test for FBLA "${config.topic}". Generate exactly ${config.questionCount} multiple choice questions. Return ONLY raw JSON. Schema: Array<{ question: string, options: string[], correctAnswerIndex: number, explanation: string }>. IMPORTANT: Keep the explanation short (max 2 sentences).`;
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Generate ${config.questionCount} FBLA ${config.topic} questions.` }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        if (!response.ok) throw new Error("API Error");
        const data = await response.json();
        return JSON.parse(data.candidates[0].content.parts[0].text);
      } catch (err) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, delay));
          return fetchWithRetry(retries - 1, delay * 2);
        }
        throw err;
      }
    };
    try {
      const questions = await fetchWithRetry();
      setQuizData(questions); setCurrentIndex(0); setAnswers({}); setShowExplanation(false);
      if (config.mode === 'timed') setTimeLeft(config.duration * 60);
      setTimeout(() => { setIsLoading(false); setView('testing'); }, 800);
    } catch (err) {
      setIsLoading(false); setErrorMsg("Generation failed. Try again."); setView('landing');
    }
  };

  useEffect(() => {
    let timer;
    if (view === 'testing' && config.mode === 'timed' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => {
        if (prev <= 1) { finishTest(); return 0; }
        return prev - 1;
      }), 1000);
    }
    return () => clearInterval(timer);
  }, [view, config.mode, timeLeft]);

  const finishTest = () => {
    setView('results'); setShowExplanation(true);
    const correct = Object.keys(answers).filter(k => answers[k] === quizData[k].correctAnswerIndex).length;
    const score = Math.round((correct / quizData.length) * 100);
    saveResult(score);
  };

  const resetApp = () => {
    setView('landing'); setQuizData([]); setAnswers({});
  };

  // --- UI Components ---

  const QuizView = () => {
    const currentQ = quizData[currentIndex];
    const progress = ((currentIndex) / quizData.length) * 100;
    return (
      <div className="max-w-3xl mx-auto w-full px-6 pt-8 pb-32 animate-enter">
        <div className="flex items-center justify-between mb-10 sticky top-4 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <button onClick={resetApp} className="text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-2 text-sm font-medium"><Icon name="x" size={18} /> Abort</button>
          <div className="flex items-center gap-6 text-sm font-mono font-medium text-zinc-500 dark:text-zinc-400">
            {config.mode === 'timed' && <div className={`flex items-center gap-2 ${timeLeft < 60 ? 'text-red-500 animate-pulse' : ''}`}><Icon name="timer" size={16} /><span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span></div>}
            <span>{String(currentIndex + 1).padStart(2, '0')} / {quizData.length}</span>
          </div>
        </div>
        <div className="mb-10 px-2">
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight mb-8">{currentQ.question}</h2>
          <div className="space-y-4">
            {currentQ.options.map((opt, idx) => {
              const selected = answers[currentIndex] === idx;
              const correct = currentQ.correctAnswerIndex === idx;
              const revealed = config.mode === 'practice' && showExplanation;
              let style = "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600"; 
              if (selected) style = "border-zinc-900 dark:border-zinc-100 bg-black dark:bg-white text-white dark:text-black";
              if (revealed) {
                if (correct) style = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-400";
                else if (selected && !correct) style = "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-400 opacity-75";
                else style = "opacity-50 border-zinc-100 dark:border-zinc-800";
              }
              return (
                <button key={idx} onClick={() => { if(!(config.mode === 'practice' && showExplanation)) { setAnswers(p => ({...p, [currentIndex]: idx})); if(config.mode === 'practice') setShowExplanation(true); }}} disabled={revealed} className={`w-full p-6 text-left rounded-xl border transition-all flex items-center justify-between ${style}`}>
                  <div className="flex items-center gap-5">
                    <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold shrink-0 ${selected ? 'bg-white/20' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400'}`}>{['A','B','C','D'][idx]}</span>
                    <span className="text-base md:text-lg">{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        {showExplanation && config.mode === 'practice' && (
          <div className="mb-12 p-8 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl animate-enter">
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Analysis</h4>
            <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed text-lg">{currentQ.explanation}</p>
          </div>
        )}
        <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 py-5 px-6 z-30">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button onClick={() => { if(currentIndex > 0) { setCurrentIndex(c => c - 1); setShowExplanation(false); }}} disabled={currentIndex === 0} className="text-zinc-500 disabled:opacity-20 font-medium text-sm px-4 py-2 flex items-center gap-2"><Icon name="arrow-left" size={18} /> Prev</button>
            <Button onClick={currentIndex === quizData.length - 1 ? finishTest : () => { setCurrentIndex(c => c + 1); setShowExplanation(false); }}>{currentIndex === quizData.length - 1 ? 'Finish' : 'Next'} <Icon name="arrow-right" size={18} /></Button>
          </div>
        </div>
      </div>
    );
  };

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;

  return (
    <div className={`flex-grow flex flex-col min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100 transition-colors ${theme}`}>
      {toast && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[70] px-6 py-3 rounded-xl shadow-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 animate-enter">
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      )}

      <nav className="py-6 px-6 md:px-8 flex justify-between items-center max-w-7xl mx-auto w-full z-40">
        <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 cursor-pointer" onClick={resetApp}>
              <div className="w-10 h-10 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center shadow-lg">
                <Icon name="zap" size={20} className="text-white dark:text-zinc-900" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-none tracking-tight text-zinc-900 dark:text-white">FBLA</span>
                <span className="text-[10px] font-bold tracking-[0.3em] text-zinc-400 dark:text-zinc-500">PREP</span>
              </div>
            </div>
            <a href="https://aahanjain.com/fbla_guide.html" target="_blank" className="hidden lg:flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                <Icon name="info" size={16} /> Competition Guide
            </a>
        </div>

        <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Icon name={theme === 'light' ? 'moon' : 'sun'} size={20} /></button>
            {user && !user.isAnonymous ? (
              <button onClick={() => setSidebarOpen(true)} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold">{user.email ? user.email[0].toUpperCase() : 'U'}</button>
            ) : (
              <button onClick={() => setLoginModalOpen(true)} className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold shadow-lg">Login</button>
            )}
        </div>
      </nav>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} history={history} onLoadTopic={(t) => { setConfig({...config, topic: t}); setSidebarOpen(false); }} />
      
      <Modal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} title="Sign In">
        <div className="space-y-4">
          <Button variant="google" onClick={handleGoogleLogin} className="w-full py-3">Sign in with Google</Button>
          <div className="relative text-center"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200"></div></div><span className="relative px-2 bg-white dark:bg-zinc-900 text-sm text-zinc-500">Or Email</span></div>
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border rounded-xl outline-none dark:text-white" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border rounded-xl outline-none dark:text-white" />
            <Button type="submit" className="w-full py-3">{isSignUp ? 'Sign Up' : 'Sign In'}</Button>
          </form>
          <div className="text-center"><button onClick={() => setIsSignUp(!isSignUp)} className="text-sm underline text-zinc-500">{isSignUp ? 'Login instead' : 'Create account'}</button></div>
        </div>
      </Modal>

      <Modal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="Send Feedback">
        <textarea 
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          className="w-full h-32 p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 outline-none resize-none dark:text-white"
          placeholder="What can we improve?..."
        />
        <Button onClick={handleFeedbackSubmit} className="w-full py-3">Submit Feedback</Button>
      </Modal>

      <main className="flex-grow flex flex-col">
        {view === 'landing' && <LandingView config={config} setConfig={setConfig} errorMsg={errorMsg} generateQuiz={generateQuiz} />}
        {view === 'loading' && <div className="flex items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-zinc-900 border-t-transparent animate-spin rounded-full"></div></div>}
        {view === 'testing' && <QuizView />}
        {view === 'results' && <ResultsView score={Math.round((Object.keys(answers).filter(k => answers[k] === quizData[k].correctAnswerIndex).length / quizData.length) * 100)} correct={Object.keys(answers).filter(k => answers[k] === quizData[k].correctAnswerIndex).length} total={quizData.length} onReview={() => { setView('testing'); setCurrentIndex(0); }} onReset={resetApp} />}
      </main>

      <footer className="bg-white dark:bg-zinc-950 border-t py-12 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start">
                <span className="font-bold text-zinc-900 dark:text-white">FBLA Prep Portal</span>
                <span className="text-sm text-zinc-500">Master your competitive events.</span>
            </div>
            <div className="flex items-center gap-8 text-sm font-medium">
                <a href="https://aahanjain.com/fbla_guide.html" target="_blank" className="text-blue-600 hover:underline">Official Competition Guide</a>
                <button onClick={() => setFeedbackOpen(true)} className="text-zinc-500 hover:text-zinc-900">Feedback</button>
                <a href="https://fbla.org" target="_blank" className="text-zinc-500 hover:text-zinc-900">National FBLA</a>
            </div>
        </div>
      </footer>
    </div>
  );
}

// --- Specific Sub-Components ---

const ResultsView = ({ score, correct, total, onReview, onReset }) => (
  <div className="max-w-2xl mx-auto w-full px-6 pt-20 text-center animate-enter pb-20">
    <h2 className="text-5xl font-bold tracking-tighter text-zinc-900 dark:text-white mb-4">{score}%</h2>
    <p className="text-zinc-500 dark:text-zinc-400 mb-12 text-lg">You scored <strong className="text-zinc-900 dark:text-zinc-200">{correct}</strong> / {total}.</p>
    <div className="grid grid-cols-2 gap-5">
      <Button variant="secondary" onClick={onReview}>Review</Button>
      <Button onClick={onReset}>New Session</Button>
    </div>
  </div>
);

const Sidebar = ({ isOpen, onClose, user, history, onLoadTopic }) => (
  <>
    {isOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose}></div>}
    <div className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} shadow-2xl`}>
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-bold dark:text-white">Your History</h2>
          <button onClick={onClose}><Icon name="x" size={24} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white" /></button>
        </div>
        {!user ? (
          <div className="text-center py-10">
            <Icon name="user-x" size={32} className="text-zinc-400 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">Waiting for login...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            {history.length === 0 ? (
              <p className="text-zinc-400 text-center text-sm italic py-10">No history found.</p>
            ) : (
              history.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-900/50 cursor-pointer" onClick={() => { onLoadTopic(item.topic); onClose(); }}>
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-sm text-zinc-900 dark:text-white truncate">{item.topic}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200'}`}>{item.score}%</span>
                  </div>
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <Icon name="calendar" size={12} />
                    {item.date ? new Date(item.date.seconds * 1000).toLocaleDateString() : 'Just now'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {user && <button onClick={() => signOut(auth)} className="mt-auto w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold flex items-center justify-center gap-2"><Icon name="log-out" size={18} /> Sign Out</button>}
      </div>
    </div>
  </>
);

const SplashScreen = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2200);
    return () => clearTimeout(timer);
  }, [onComplete]);
  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="relative z-10 flex flex-col items-center animate-enter">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 animate-float">
          <Icon name="zap" size={40} className="text-black" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tighter">FBLA PREP</h1>
      </div>
    </div>
  );
};