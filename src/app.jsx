import React, { useState, useEffect, useRef } from 'react';
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
  signOut
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
// Note: Ensure you have a .env file with VITE_GEMINI_API_KEY=your_key
// OR replace this directly with your key string if testing locally.
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE";

const firebaseConfig = {
  apiKey: "AIzaSyAJizcZjCwDS6zcJTHJW6JrjjLUx9WbG1M",
  authDomain: "fbla-prep-portal.firebaseapp.com",
  projectId: "fbla-prep-portal",
  storageBucket: "fbla-prep-portal.firebasestorage.app",
  messagingSenderId: "330555191340",
  appId: "1:330555191340:web:c6fb3c12d3f1e3257e6189",
  measurementId: "G-B9Z9DWPM7Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'fbla-prep-v1';

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

// --- Components ---

// Dynamic Icon Component for Lucide-React
const Icon = ({ name, className = "", size = 20 }) => {
  const pascalName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
    
  const LucideIcon = LucideIcons[pascalName];

  if (!LucideIcon) return null;

  return <LucideIcon size={size} className={className} />;
};

const SplashScreen = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 blur-3xl opacity-20 animate-pulse"></div>
        <div className="relative z-10 flex flex-col items-center animate-enter">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-white/10 animate-float">
            <Icon name="zap" size={40} className="text-black fill-black" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tighter mb-2">FBLA PREP</h1>
          <div className="h-1 w-0 bg-white/50 rounded-full animate-grow-line"></div>
        </div>
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

const Sidebar = ({ isOpen, onClose, user, history, onLoadTopic }) => {
  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose}></div>}
      <div className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} shadow-2xl`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold dark:text-white">Your History</h2>
            <button onClick={onClose}><Icon name="x" size={24} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white" /></button>
          </div>
          
          {!user || user.isAnonymous ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4"><Icon name="user" size={32} className="text-zinc-400" /></div>
              <p className="text-zinc-500 dark:text-zinc-400 mb-4 text-sm">You are in Guest Mode.</p>
              <p className="text-xs text-zinc-400">History saves locally for this session.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {history.length === 0 ? (
                <p className="text-zinc-500 text-center italic mt-10">No history yet.</p>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer" onClick={() => { onLoadTopic(item.topic); onClose(); }}>
                    <div className="flex justify-between mb-2">
                      <span className="font-bold text-sm text-zinc-900 dark:text-white truncate max-w-[120px]">{item.topic}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.score >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>{item.score}%</span>
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
          
          {user && !user.isAnonymous && (
             <button onClick={() => signOut(auth)} className="mt-auto w-full py-3 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                <Icon name="log-out" size={18} /> Sign Out
             </button>
          )}
        </div>
      </div>
    </>
  );
};

const AdPlaceholder = () => (
  <div className="w-full h-32 my-8 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 relative overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/50">
    <span className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">Advertisement</span>
    <span className="text-[10px] opacity-50 mt-1">Place your ad content here</span>
  </div>
);

// --- Main App ---

export default function App() {
  // State
  const [showSplash, setShowSplash] = useState(true);
  
  // Theme State
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
  
  // Login Modal State
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Quiz Config & State
  const [config, setConfig] = useState({ 
    topic: '', 
    mode: 'practice', 
    questionCount: 20, 
    duration: 25,
    difficulty: 'Hard' // Added Difficulty
  });
  const [quizData, setQuizData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);

  // Apply Theme Effect
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Show Toast Helper
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Firebase Logic
  useEffect(() => {
    // Ensure auth state even for guests
    const initAuth = async () => {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Anon auth failed", e);
        }
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Subscribe to history
        const q = query(collection(db, 'artifacts', APP_ID, 'users', u.uid, 'history'), orderBy('date', 'desc'), limit(20));
        const unsubHistory = onSnapshot(q, (snap) => {
          setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.log("History error", err));
        return () => unsubHistory();
      } else {
        setUser(null);
        setHistory([]);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Separate Login Handlers
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setLoginModalOpen(false);
      showToast("Signed in with Google");
    } catch (err) {
      if (err.code === 'auth/unauthorized-domain') {
        showToast("Preview Mode: Domain unauthorized", 'info');
      } else {
        console.error("Google Auth Error", err);
        showToast("Google Sign-In failed.", 'error');
      }
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
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error("Email Auth Error", err);
      showToast(err.message, 'error');
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback'), {
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

  const saveResult = async (score) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'history'), {
        topic: config.topic,
        score: score,
        total: quizData.length,
        mode: config.mode,
        difficulty: config.difficulty,
        date: serverTimestamp()
      });
    } catch (e) { console.error("Save error", e); }
  };

  // Theme toggle
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Quiz Logic
  const generateQuiz = async () => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR_")) {
        showToast("API Key Missing! Check code.", "error");
        return;
    }

    setIsLoading(true);
    setView('loading');
    setErrorMsg('');
    
    const fetchWithRetry = async (retries = 3, delay = 1000) => {
      // Updated Prompt to use Difficulty
      const systemPrompt = `Create a ${config.difficulty.toLowerCase()} difficulty, competition-level practice test for FBLA "${config.topic}". Generate exactly ${config.questionCount} multiple choice questions. Return ONLY raw JSON. Schema: Array<{ question: string, options: string[], correctAnswerIndex: number, explanation: string }>. IMPORTANT: Keep the explanation short, simple, and engaging (max 2 sentences). Avoid long, boring paragraphs.`;
      
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`, {
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
      setQuizData(questions);
      setCurrentIndex(0);
      setAnswers({});
      setShowExplanation(false);
      if (config.mode === 'timed') setTimeLeft(config.duration * 60);
      setTimeout(() => { setIsLoading(false); setView('testing'); }, 800);
    } catch (err) {
      setIsLoading(false);
      setErrorMsg("Please try a smaller number of questions or try again.");
      setView('landing');
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
    setView('results');
    setShowExplanation(true);
    const correct = Object.keys(answers).filter(k => answers[k] === quizData[k].correctAnswerIndex).length;
    const score = Math.round((correct / quizData.length) * 100);
    saveResult(score);
  };

  const resetApp = () => {
    setView('landing');
    setQuizData([]);
    setAnswers({});
  };
  
  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // --- Views ---

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;

  const LandingView = () => (
    <div className="max-w-4xl mx-auto w-full px-6 pt-12 md:pt-20 animate-enter pb-32">
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-zinc-900 dark:text-white mb-6">
          Master your event.
        </h1>
        <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed font-light">
          Configure your custom simulation environment.
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-8">
        <div className="md:col-start-3 md:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl shadow-zinc-200/50 dark:shadow-black/50 theme-transition">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-3">
              <Icon name="alert-triangle" size={18} /> {errorMsg}
            </div>
          )}
          
          <div className="space-y-8">
            <div className="space-y-3">
              <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Topic</label>
              <SearchableSelect options={FBLA_TOPICS} value={config.topic} onChange={(val) => setConfig({...config, topic: val})} placeholder="Type topic (e.g. 'Network')..." />
            </div>

            {/* Mode & Difficulty Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Mode Selection */}
               <div>
                 <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1 mb-2">Mode</label>
                 <div className="grid grid-cols-2 gap-2">
                    {[{ id: 'practice', icon: 'zap', label: 'Practice' }, { id: 'timed', icon: 'clock', label: 'Ranked' }].map(m => (
                      <button 
                        key={m.id}
                        onClick={() => setConfig({ ...config, mode: m.id })}
                        className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                          config.mode === m.id 
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg' 
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Icon name={m.icon} size={18} className={config.mode === m.id ? 'opacity-100' : 'opacity-60'} />
                          <span className="font-bold text-xs">{m.label}</span>
                        </div>
                      </button>
                    ))}
                 </div>
               </div>

               {/* Difficulty Selection */}
               <div>
                 <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1 mb-2">Difficulty</label>
                 <div className="grid grid-cols-3 gap-2">
                    {['Easy', 'Medium', 'Hard'].map(d => (
                      <button 
                        key={d}
                        onClick={() => setConfig({ ...config, difficulty: d })}
                        className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                          config.difficulty === d 
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg' 
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <span className="font-bold text-xs">{d}</span>
                      </button>
                    ))}
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Questions</label>
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">{config.questionCount}</span>
                </div>
                <input type="range" min="5" max="200" step="5" value={config.questionCount} onChange={(e) => setConfig({...config, questionCount: parseInt(e.target.value)})} className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white" />
              </div>

              {config.mode === 'timed' && (
                <div className="space-y-4 animate-enter">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Time (Min)</label>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">{config.duration}m</span>
                  </div>
                  <input type="range" min="5" max="120" step="5" value={config.duration} onChange={(e) => setConfig({...config, duration: parseInt(e.target.value)})} className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white" />
                </div>
              )}
            </div>

            <Button onClick={generateQuiz} disabled={!config.topic} className="w-full py-5 text-base mt-4">Initialize Session <Icon name="arrow-right" size={18} /></Button>
          </div>
        </div>
      </div>
      <AdPlaceholder />
    </div>
  );

  const LoadingView = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-enter">
      <div className="relative w-24 h-24 mb-10">
        <div className="absolute inset-0 border-4 border-zinc-100 dark:border-zinc-800 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-zinc-900 dark:border-zinc-100 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center animate-pulse"><Icon name="cpu" size={32} className="text-zinc-400" /></div>
      </div>
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">Synthesizing</h2>
      <p className="text-zinc-500 dark:text-zinc-400 font-medium">Generating {config.difficulty} questions for <span className="text-zinc-900 dark:text-zinc-200">{config.topic}</span></p>
      <div className="mt-12 space-y-3 w-72">
        {[1,2,3].map(i => <div key={i} className="h-2 rounded-full shimmer-bg w-full opacity-60" style={{ animationDelay: `${i * 0.15}s` }}></div>)}
      </div>
    </div>
  );

  const QuizView = () => {
    const currentQ = quizData[currentIndex];
    const progress = ((currentIndex) / quizData.length) * 100;

    return (
      <div className="max-w-3xl mx-auto w-full px-6 pt-8 pb-32 animate-enter">
        <div className="flex items-center justify-between mb-10 sticky top-4 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <button onClick={resetApp} className="text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-2 text-sm font-medium"><Icon name="x" size={18} /> Abort</button>
          <div className="flex items-center gap-6 text-sm font-mono font-medium text-zinc-500 dark:text-zinc-400">
            {config.mode === 'timed' && <div className={`flex items-center gap-2 ${timeLeft < 60 ? 'text-red-500 animate-pulse' : ''}`}><Icon name="timer" size={16} /><span>{formatTime(timeLeft)}</span></div>}
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
              if (selected) style = "border-zinc-900 dark:border-zinc-100 bg-gradient-to-r from-zinc-800 to-black dark:from-zinc-100 dark:to-white text-white dark:text-black shadow-xl scale-[1.01]";
              if (revealed) {
                if (correct) style = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-400";
                else if (selected && !correct) style = "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-400 opacity-75";
                else style = "opacity-50 grayscale border-zinc-100 dark:border-zinc-800";
              }

              return (
                <button
                  key={idx}
                  onClick={() => { if(view !== 'results' && !(config.mode === 'practice' && showExplanation)) { setAnswers(p => ({...p, [currentIndex]: idx})); if(config.mode === 'practice') setShowExplanation(true); }}}
                  disabled={revealed}
                  className={`w-full p-6 text-left rounded-xl border transition-all duration-300 flex items-center justify-between group relative overflow-hidden ${!selected && !revealed ? 'dark:hover-gradient-dark hover-gradient-light' : ''} ${style}`}
                >
                  <div className="flex items-center gap-5 relative z-10">
                    <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold shrink-0 ${selected ? 'border-transparent bg-white/20 text-current' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400'}`}>{['A','B','C','D'][idx]}</span>
                    <span className="text-base md:text-lg">{opt}</span>
                  </div>
                  <div className="relative z-10">
                    {selected && !revealed && <Icon name="check" size={20} className="opacity-50" />}
                    {revealed && correct && <Icon name="check-circle" size={20} className="text-emerald-600 dark:text-emerald-400" />}
                    {revealed && selected && !correct && <Icon name="x-circle" size={20} className="text-red-500 dark:text-red-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {showExplanation && config.mode === 'practice' && (
          <div className="mb-12 p-8 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl animate-enter relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-zinc-900 dark:bg-zinc-100"></div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3"><Icon name="info" size={14} /> Analysis</h4>
            <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed text-lg">{currentQ.explanation}</p>
          </div>
        )}

        <AdPlaceholder />

        <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 py-5 px-6 z-30 transition-colors duration-300">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="absolute top-0 left-0 h-[3px] bg-zinc-900 dark:bg-zinc-100 transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
            <button onClick={() => { if(currentIndex > 0) { setCurrentIndex(c => c - 1); setShowExplanation(false); }}} disabled={currentIndex === 0} className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-20 transition-colors font-medium text-sm px-4 py-2"><Icon name="arrow-left" size={18} /> Prev</button>
            {config.mode === 'practice' && !showExplanation && currentIndex < quizData.length - 1 ? <span className="hidden md:inline text-xs font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-widest animate-pulse">Waiting for input</span> : (
              <Button onClick={currentIndex === quizData.length - 1 ? finishTest : () => { setCurrentIndex(c => c + 1); setShowExplanation(false); }} className="px-8 py-3">{currentIndex === quizData.length - 1 ? 'Finish' : 'Next'} <Icon name={currentIndex === quizData.length - 1 ? 'flag' : 'arrow-right'} size={18} /></Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ResultsView = () => {
    const correct = Object.keys(answers).filter(k => answers[k] === quizData[k].correctAnswerIndex).length;
    const score = Math.round((correct / quizData.length) * 100);

    return (
      <div className="max-w-2xl mx-auto w-full px-6 pt-20 text-center animate-enter pb-20">
        <div className="mb-10 relative inline-block group cursor-default">
            <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <svg className="w-48 h-48 transform -rotate-90 relative z-10">
              <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-zinc-100 dark:text-zinc-800" />
              <circle cx="96" cy="96" r="80" stroke={score > 75 ? "currentColor" : score > 50 ? "#f59e0b" : "#ef4444"} strokeWidth="12" fill="transparent" strokeDasharray={502} strokeDashoffset={502 - (502 * score) / 100} className={`transition-all duration-1000 ease-out ${score > 75 ? 'text-zinc-900 dark:text-zinc-100' : ''}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
              <span className="text-5xl font-bold tracking-tighter text-zinc-900 dark:text-white">{score}%</span>
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Accuracy</span>
            </div>
        </div>

        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">Session Complete</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mb-12 text-lg">You scored <strong className="text-zinc-900 dark:text-zinc-200">{correct}</strong> / <strong className="text-zinc-900 dark:text-zinc-200">{quizData.length}</strong>.</p>

        <div className="grid grid-cols-2 gap-5 mb-12">
          <Button variant="secondary" onClick={() => { setView('testing'); setCurrentIndex(0); setShowExplanation(true); }} className="py-4">Review</Button>
          <Button onClick={resetApp} className="py-4">New Session</Button>
        </div>
        <AdPlaceholder />
      </div>
    );
  };

  return (
    <div className={`flex-grow flex flex-col min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100 transition-colors duration-300 ${theme}`}>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[70] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'}`}>
          <Icon name={toast.type === 'error' ? 'alert-circle' : 'info'} size={20} />
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      )}

      <nav className="py-6 px-6 md:px-8 flex justify-between items-center max-w-7xl mx-auto w-full z-40">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={resetApp}>
          <div className="relative w-10 h-10 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-lg shadow-zinc-200 dark:shadow-zinc-900/50">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black dark:from-zinc-100 dark:to-zinc-300"></div>
            <Icon name="zap" size={20} className="relative z-10 text-white dark:text-zinc-900" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-none tracking-tight text-zinc-900 dark:text-white">FBLA</span>
            <span className="text-[10px] font-bold tracking-[0.3em] text-zinc-400 dark:text-zinc-500">PREP</span>
          </div>
        </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setFeedbackOpen(true)} className="hidden md:flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              <Icon name="message-square" size={16} /> Feedback
            </button>
            <button onClick={toggleTheme} className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={20} />
            </button>
            {user && !user.isAnonymous ? (
              <button onClick={() => setSidebarOpen(true)} className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                {user.displayName ? user.displayName[0] : 'U'}
              </button>
            ) : (
              <button onClick={() => setLoginModalOpen(true)} className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                {user ? "Guest (Sign In)" : "Login"}
              </button>
            )}
          </div>
      </nav>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} history={history} onLoadTopic={(t) => { setConfig({...config, topic: t}); setSidebarOpen(false); }} />
      
      {/* Feedback Modal */}
      <Modal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="Send Feedback">
        <textarea 
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          className="w-full h-32 p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white resize-none dark:text-white"
          placeholder="What can we improve?..."
        />
        <Button onClick={handleFeedbackSubmit} className="w-full py-3">Submit Feedback</Button>
      </Modal>

      {/* Login Modal */}
      <Modal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} title="Sign In">
        <div className="space-y-4">
          <Button variant="google" onClick={handleGoogleLogin} className="w-full py-3 flex items-center justify-center gap-3">
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/></g></svg>
            Sign in with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200 dark:border-zinc-700"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-zinc-900 text-zinc-500">Or continue with email</span></div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white dark:text-white"
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white dark:text-white"
            />
            <Button type="submit" className="w-full py-3">
              {isSignUp ? 'Sign Up with Email' : 'Sign In with Email'}
            </Button>
          </form>
          
          <div className="text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
          </div>
        </div>
      </Modal>

      <main className="flex-grow flex flex-col">
        {view === 'landing' && <LandingView />}
        {view === 'loading' && <LoadingView />}
        {view === 'testing' && <QuizView />}
        {view === 'results' && <ResultsView />}
      </main>
    </div>
  );
}