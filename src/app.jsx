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
  Database 
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc 
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

// Firebase Configuration
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-fbla-app';

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

  const timerRef = useRef(null);
  const apiKey = ""; // The execution environment provides the key at runtime

  // RULE 3: Auth Before Queries
  useEffect(() => {
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
    const systemPrompt = `You are an expert FBLA competitive events coordinator. Generate 50 high-quality, challenging multiple-choice questions for the topic: "${topic}". Core FBLA concepts must be strictly followed. Return ONLY a JSON array of objects.`;
    
    const makeRequest = async () => {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate 50 FBLA ${topic} questions.` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  question: { type: "STRING" },
                  options: { type: "ARRAY", items: { type: "STRING" } },
                  correctAnswer: { type: "NUMBER" },
                  explanation: { type: "STRING" }
                },
                required: ["question", "options", "correctAnswer", "explanation"]
              }
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("API returned an empty response.");
      return JSON.parse(text);
    };

    // Exponential Backoff Implementation
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
    // RULE 1: Strict Paths
    const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'fbla_questions');
    console.log(`Attempting to save ${newQs.length} questions to Firestore...`);
    
    try {
      const batchPromises = newQs.map(q => 
        addDoc(questionsRef, { 
          ...q, 
          topic, 
          createdAt: new Date().toISOString(),
          appId: appId 
        })
      );
      await Promise.all(batchPromises);
      console.log("Successfully saved all questions to database.");
    } catch (err) {
      console.error("Database Save Error:", err);
      throw err; // Re-throw to be caught in fetchQuestions
    }
  };

  const fetchQuestions = async (topic) => {
    if (!user) {
      console.error("Wait for authentication before starting.");
      return;
    }

    setIsLoading(true);
    setIsError(false);
    
    try {
      const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'fbla_questions');
      
      console.log(`Checking database for ${topic} questions...`);
      const querySnapshot = await getDocs(questionsRef);
      
      const allQuestions = querySnapshot.docs
        .map(doc => doc.data())
        .filter(q => q.topic === topic);

      console.log(`Database check complete. Found ${allQuestions.length} existing questions.`);

      if (allQuestions.length >= 50) {
        console.log("Using existing pool from database.");
        const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
        setQuestions(shuffled.slice(0, 50));
        startTest();
      } else {
        console.log("Not enough questions in pool. Generating fresh set with AI...");
        const newQuestions = await generateViaAI(topic);
        console.log("AI Generation successful. Saving new questions...");
        
        await saveToDatabase(newQuestions, topic);
        
        setQuestions(newQuestions);
        startTest();
      }
    } catch (err) {
      console.error("Detailed Fetch/Save Error:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const startTest = () => {
    setView('testing');
    if (testMode === 'timed') startTimer();
  };

  const startTimer = () => {
    setTimeLeft(25 * 60);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleFinishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
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

  const handleFinishTest = () => {
    clearInterval(timerRef.current);
    setView('results');
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) correct++;
    });
    return correct;
  };

  const resetPortal = () => {
    setView('landing');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setTimeLeft(25 * 60);
    clearInterval(timerRef.current);
    setShowFeedback(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetPortal}>
            <div className="bg-[#003366] p-2 rounded-lg">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#003366]">FBLA Prep <span className="text-slate-400 font-normal ml-1">| fbla.aahanjain.com</span></h1>
          </div>
          {view === 'testing' && (
            <div className="flex items-center gap-4 px-4 py-2 rounded-full font-mono text-lg bg-blue-50 text-blue-800">
              <Clock className="w-5 h-5" />
              {testMode === 'timed' ? formatTime(timeLeft) : 'Practice Mode'}
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {view === 'landing' && (
          <div className="text-center">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Master Your Competitive Event</h2>
            <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
              Access the shared FBLA question bank. Select your topic to begin.
            </p>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-left max-w-md mx-auto">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Choose Topic</label>
              <select 
                className="w-full p-3 border border-slate-300 rounded-xl mb-6 focus:ring-2 focus:ring-blue-500 outline-none"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
              >
                <option value="">-- Select Event --</option>
                {FBLA_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <div className="space-y-4">
                <button 
                  disabled={!selectedTopic || !user}
                  onClick={() => { setTestMode('timed'); setView('config'); }}
                  className="w-full flex items-center justify-between bg-[#003366] text-white p-4 rounded-xl font-semibold hover:bg-blue-800 disabled:opacity-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5" />
                    <span>Timed Test (25 Mins)</span>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>

                <button 
                  disabled={!selectedTopic || !user}
                  onClick={() => { setTestMode('practice'); setView('config'); }}
                  className="w-full flex items-center justify-between border-2 border-[#003366] text-[#003366] p-4 rounded-xl font-semibold hover:bg-blue-50 disabled:opacity-30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5" />
                    <span>Practice Mode</span>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              {!user && <p className="text-xs text-red-500 mt-4 text-center animate-pulse">Establishing database connection...</p>}
            </div>
          </div>
        )}

        {view === 'config' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            {!isLoading ? (
              <div className="text-center bg-white p-10 rounded-2xl shadow-xl max-w-lg">
                <h3 className="text-2xl font-bold mb-4">{testMode === 'timed' ? 'Timed Test' : 'Practice Test'}</h3>
                <p className="text-slate-500 mb-8">Ready to begin your session for <strong>{selectedTopic}</strong>?</p>
                <button 
                  onClick={() => fetchQuestions(selectedTopic)}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                >
                  Start Session
                </button>
              </div>
            ) : (
              <div className="text-center">
                <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-700">Syncing Question Bank...</h3>
                <p className="text-slate-400 mt-2">Checking database and AI resources.</p>
              </div>
            )}
            {isError && (
              <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-center">
                <p className="font-bold">Sync Error</p>
                <p className="text-sm">We couldn't load questions. Please check your internet connection or API keys.</p>
                <button onClick={() => setView('landing')} className="mt-4 underline text-sm">Return Home</button>
              </div>
            )}
          </div>
        )}

        {view === 'testing' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center text-sm font-semibold text-slate-500">
              <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
              <span className="flex items-center gap-1"><Database className="w-3 h-3"/> Active Knowledge Base</span>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-xl md:text-2xl font-semibold mb-8 text-slate-800 leading-relaxed">
                {questions[currentQuestionIndex]?.question}
              </h3>

              <div className="grid gap-4">
                {questions[currentQuestionIndex]?.options.map((option, idx) => {
                  let btnClass = "w-full text-left p-5 rounded-xl border-2 transition-all flex items-center justify-between ";
                  const isSelected = userAnswers[currentQuestionIndex] === idx;
                  const isCorrect = idx === questions[currentQuestionIndex].correctAnswer;

                  if (showFeedback) {
                    if (isCorrect) btnClass += "bg-green-50 border-green-500 text-green-900";
                    else if (isSelected) btnClass += "bg-red-50 border-red-500 text-red-900";
                    else btnClass += "border-slate-100 opacity-60";
                  } else {
                    btnClass += isSelected 
                      ? "bg-blue-50 border-blue-600 text-blue-900" 
                      : "bg-white border-slate-200 hover:border-blue-300";
                  }

                  return (
                    <button 
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      disabled={showFeedback}
                      className={btnClass}
                    >
                      <span>{option}</span>
                      {showFeedback && isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                    </button>
                  );
                })}
              </div>

              {showFeedback && (
                <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100 animate-in slide-in-from-top-1">
                  <h4 className="text-blue-900 font-bold mb-2 flex items-center gap-2">Study Guide Notes</h4>
                  <p className="text-blue-800 text-sm mb-4">
                    {questions[currentQuestionIndex].explanation}
                  </p>
                  <button 
                    onClick={() => {
                        setShowFeedback(false);
                        if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
                        else setView('results');
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold"
                  >
                    Next Question
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <button 
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0 || showFeedback}
                className="px-4 py-2 text-slate-500 font-bold disabled:opacity-30 flex items-center gap-1"
              >
                Previous
              </button>
              {testMode === 'timed' && (
                <button 
                  onClick={handleFinishTest}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition-all"
                >
                  Finish Test
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'results' && (
          <div className="text-center max-w-2xl mx-auto">
            <div className="bg-white p-12 rounded-3xl shadow-xl border border-slate-100">
              <Trophy className="w-16 h-16 text-blue-600 mx-auto mb-6" />
              <h2 className="text-3xl font-black text-slate-900 mb-2">Performance Summary</h2>
              <div className="text-6xl font-black text-blue-600 my-8">{calculateScore()} / {questions.length}</div>
              
              <div className="bg-[#003366] p-8 rounded-2xl text-white text-left mb-8 relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-xl font-bold mb-2">Shared Knowledge Base</h4>
                  <p className="text-blue-100 mb-6 text-sm">Every test question is synchronized with our community database to help all FBLA members excel.</p>
                  <button className="w-full bg-yellow-400 text-blue-900 py-3 rounded-xl font-black uppercase tracking-wider text-sm shadow-lg hover:bg-yellow-300">
                    Sign Up for Analytics
                  </button>
                </div>
                <Database className="absolute -bottom-6 -right-6 w-32 h-32 text-blue-800 opacity-20" />
              </div>

              <button onClick={resetPortal} className="text-slate-400 font-bold flex items-center gap-2 mx-auto hover:text-[#003366] transition-colors">
                <Home className="w-4 h-4" /> Start Over
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;