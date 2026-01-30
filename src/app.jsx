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
  ArrowLeft
} from 'lucide-react';

const FBLA_TOPICS = [
  "Accounting", "Advanced Accounting", "Advertising", "Agribusiness",
  "Business Communication", "Business Law", "Computer Problem Solving",
  "Cybersecurity", "Data Science & AI", "Economics", "Healthcare Administration",
  "Human Resource Management", "Insurance & Risk Management", "Journalism",
  "Networking Infrastructures", "Organizational Leadership", "Personal Finance",
  "Project Management", "Public Administration & Management", "Real Estate",
  "Retail Management", "Securities & Investments"
];

const App = () => {
  const [view, setView] = useState('landing'); // landing, config, testing, results, review
  const [selectedTopic, setSelectedTopic] = useState('');
  const [testMode, setTestMode] = useState(''); // timed, practice
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

  const timerRef = useRef(null);
  
  /**
   * API Key Configuration:
   * The execution environment provides the key at runtime. 
   * Always set to an empty string here to ensure compatibility with the preview environment.
   */
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 

  const generateViaAI = async (topic) => {
    const systemPrompt = `You are an expert FBLA competitive events coordinator. Generate 50 high-quality MCQs for the topic: "${topic}". 
    Return ONLY a JSON array of objects with keys: question, options (array of 4 strings), correctAnswer (index 0-3), and explanation.`;
    
    const makeRequest = async () => {
      // Use the apiKey variable which is provided by the execution environment at runtime
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
        const errData = await response.json();
        throw new Error(errData.error?.message || `API Error: ${response.status}`);
      }
      
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("AI returned an empty response.");
      return JSON.parse(text);
    };

    // Retry logic with exponential backoff
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

  const fetchQuestions = async (topic) => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    
    try {
      const newQuestions = await generateViaAI(topic);
      setQuestions(newQuestions);
      startTest();
    } catch (err) {
      console.error("Generation error:", err);
      setIsError(true);
      setErrorMessage(err.message || "An unexpected error occurred while loading questions.");
    } finally {
      setIsLoading(false);
    }
  };

  const startTest = () => {
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
    const content = `FBLA Score Report\n-----------------\nTopic: ${selectedTopic}\nScore: ${score} / ${questions.length}\nDate: ${new Date().toLocaleString()}\n\nPrepared by aahanjain.com/fbla`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FBLA_Score_${selectedTopic.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const calculateScore = () => {
    return questions.reduce((acc, q, idx) => (userAnswers[idx] === q.correctAnswer ? acc + 1 : acc), 0);
  };

  const resetPortal = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setView('landing');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowFeedback(false);
    setIsError(false);
    setErrorMessage('');
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
          
          {(view === 'testing' || view === 'review') && (
            <div className="flex items-center gap-4 px-4 py-2 rounded-full font-mono bg-blue-50 text-blue-800">
              <Clock className="w-5 h-5" />
              {view === 'review' ? 'Review Mode' : (testMode === 'timed' ? formatTime(timeLeft) : 'Practice')}
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {view === 'landing' && (
          <div className="text-center animate-in fade-in duration-500">
            <h2 className="text-4xl font-extrabold mb-4 text-slate-900">FBLA Mastery Portal</h2>
            <p className="text-slate-600 mb-8 max-w-lg mx-auto">Prepare for your competitive events with custom generated tests modeled after national guidelines.</p>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md mx-auto text-left">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select Event Topic</label>
              <select className="w-full p-3 border rounded-xl mb-6 outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
                <option value="">-- Choose Topic --</option>
                {FBLA_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button disabled={!selectedTopic} onClick={() => { setTestMode('timed'); setView('config'); }} className="w-full bg-[#003366] text-white p-4 rounded-xl font-bold mb-4 disabled:opacity-50 hover:bg-blue-800 transition-colors shadow-sm">Timed Test (25m)</button>
              <button disabled={!selectedTopic} onClick={() => { setTestMode('practice'); setView('config'); }} className="w-full border-2 border-[#003366] text-[#003366] p-4 rounded-xl font-bold hover:bg-blue-50 transition-colors">Practice Mode</button>
            </div>
          </div>
        )}

        {view === 'config' && (
          <div className="text-center animate-in zoom-in-95 duration-300">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="w-16 h-16 text-blue-600 animate-spin" />
                <p className="font-bold text-slate-500 tracking-wide uppercase">Assembling Questions...</p>
              </div>
            ) : (
              <div className="bg-white p-10 rounded-2xl shadow-xl max-w-lg mx-auto border border-slate-100">
                <h3 className="text-2xl font-bold mb-2 text-slate-800">{selectedTopic}</h3>
                <p className="text-slate-500 mb-8">50 Questions • {testMode === 'timed' ? '25 Minutes' : 'Untimed'}</p>
                
                {isError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3 text-left">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="font-bold mb-1 text-red-800 uppercase tracking-wide text-xs">Generation Error</p>
                      <p className="opacity-90 leading-relaxed">{errorMessage}</p>
                    </div>
                  </div>
                )}
                
                <button onClick={() => fetchQuestions(selectedTopic)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg">
                  {isError ? "Try Again" : "Start Now"}
                </button>
                <button onClick={() => setView('landing')} className="mt-4 text-slate-400 font-bold hover:text-slate-600">Cancel</button>
              </div>
            )}
          </div>
        )}

        {view === 'testing' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 h-1 bg-blue-600 transition-all duration-500" style={{ width: `${((currentQuestionIndex + 1) / (questions.length || 1)) * 100}%` }}></div>
              <h3 className="text-xl font-semibold mb-8 text-slate-800 leading-relaxed leading-tight">{questions[currentQuestionIndex]?.question}</h3>
              <div className="grid gap-4">
                {questions[currentQuestionIndex]?.options.map((opt, idx) => (
                  <button key={idx} onClick={() => handleAnswer(idx)} disabled={showFeedback} className={`p-5 text-left rounded-xl border-2 transition-all flex justify-between items-center group ${userAnswers[currentQuestionIndex] === idx ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}>
                    <span>{opt}</span>
                    {userAnswers[currentQuestionIndex] === idx && !showFeedback && <CheckCircle className="w-5 h-5 text-blue-600" />}
                  </button>
                ))}
              </div>
              {showFeedback && (
                <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center gap-2 font-bold text-blue-900 mb-2 text-sm uppercase tracking-wide">
                    <BookOpen className="w-4 h-4" /> Study Insight
                  </div>
                  <p className="text-sm text-blue-800 mb-6 leading-relaxed italic opacity-90">{questions[currentQuestionIndex].explanation}</p>
                  <button onClick={() => { setShowFeedback(false); if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(c => c + 1); else setView('results'); }} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md">Continue</button>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-slate-400 font-bold px-2">
              <button onClick={() => setCurrentQuestionIndex(c => Math.max(0, c-1))} disabled={showFeedback || currentQuestionIndex === 0} className="hover:text-slate-700 disabled:opacity-30">Previous</button>
              <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-mono">Question {currentQuestionIndex + 1} / {questions.length}</span>
              <button onClick={() => setView('results')} className="text-red-400 hover:text-red-600">Finish Early</button>
            </div>
          </div>
        )}

        {view === 'results' && (
          <div className="bg-white p-12 rounded-3xl shadow-xl text-center max-w-2xl mx-auto animate-in zoom-in-95 duration-500 border border-slate-100">
            <Trophy className="w-20 h-20 text-blue-600 mx-auto mb-6" />
            <h2 className="text-3xl font-black mb-2 text-slate-900">Event Result</h2>
            <p className="text-slate-500 mb-8 uppercase tracking-widest text-sm font-bold">{selectedTopic}</p>
            <div className="text-7xl font-black text-blue-600 mb-10">{calculateScore()} <span className="text-2xl text-slate-300">/ {questions.length}</span></div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button onClick={handleDownloadScore} className="flex items-center justify-center gap-2 bg-slate-100 p-4 rounded-xl font-bold hover:bg-slate-200 transition-all text-slate-700 border border-slate-200"><Download className="w-5 h-5" /> Download Report</button>
              <button onClick={() => isSignedUp ? setView('review') : null} disabled={!isSignedUp} className="flex items-center justify-center gap-2 bg-blue-50 p-4 rounded-xl font-bold disabled:opacity-50 hover:bg-blue-100 transition-all text-blue-700 border border-blue-100"><Eye className="w-5 h-5" /> {isSignedUp ? 'Review Answers' : 'Review Locked'}</button>
            </div>
            {!isSignedUp && (
              <div className="bg-[#003366] p-8 rounded-2xl text-white text-left shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="font-bold mb-2 flex items-center gap-2 text-lg"><UserPlus className="w-5 h-5 text-yellow-400" /> Unlock Detailed Review</h4>
                  <p className="text-sm opacity-80 mb-6 leading-relaxed">Register your session for free to view correct answers and detailed study explanations for every question in this attempt.</p>
                  <form onSubmit={(e) => { e.preventDefault(); setIsSignedUp(true); }} className="space-y-4">
                    <input required placeholder="Full Name" className="w-full p-3 rounded-xl text-black outline-none focus:ring-2 focus:ring-yellow-400 transition-all" value={signupForm.name} onChange={e => setSignupForm({...signupForm, name: e.target.value})} />
                    <input required type="email" placeholder="Email Address" className="w-full p-3 rounded-xl text-black outline-none focus:ring-2 focus:ring-yellow-400 transition-all" value={signupForm.email} onChange={e => setSignupForm({...signupForm, email: e.target.value})} />
                    <button type="submit" className="w-full bg-yellow-400 text-blue-900 py-3 rounded-xl font-black uppercase tracking-wider text-sm shadow-md hover:bg-yellow-300 transition-all active:scale-95">Unlock Detailed Review</button>
                  </form>
                </div>
              </div>
            )}
            <button onClick={resetPortal} className="mt-8 text-slate-400 font-bold hover:text-[#003366] transition-colors">Return to Dashboard</button>
          </div>
        )}

        {view === 'review' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500 pb-20">
            <div className="flex items-center justify-between sticky top-20 bg-slate-50/90 backdrop-blur-sm py-4 z-40">
              <button onClick={() => setView('results')} className="flex items-center gap-2 font-bold text-slate-500 hover:text-slate-800 bg-white px-4 py-2 rounded-lg border border-slate-200 transition-all"><ArrowLeft className="w-5 h-5" /> Back to Results</button>
              <div className="text-sm font-bold text-blue-900 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">Review for {signupForm.name}</div>
            </div>
            {questions.map((q, idx) => (
              <div key={idx} className={`p-8 bg-white rounded-2xl border-l-8 shadow-sm ${userAnswers[idx] === q.correctAnswer ? 'border-green-500' : 'border-red-500'}`}>
                <p className="font-bold mb-6 text-slate-800 text-lg leading-relaxed">{idx + 1}. {q.question}</p>
                <div className="grid gap-3 text-sm mb-6">
                  {q.options.map((opt, oIdx) => {
                    let containerClass = "p-4 rounded-xl border-2 flex items-center justify-between ";
                    if (oIdx === q.correctAnswer) containerClass += "bg-green-50 border-green-200 text-green-900 font-bold";
                    else if (oIdx === userAnswers[idx] && userAnswers[idx] !== q.correctAnswer) containerClass += "bg-red-50 border-red-200 text-red-900 font-bold";
                    else containerClass += "border-slate-50 text-slate-500";
                    
                    return (
                      <div key={oIdx} className={containerClass}>
                        <span>{opt}</span>
                        {oIdx === q.correctAnswer && <CheckCircle className="w-4 h-4" />}
                        {oIdx === userAnswers[idx] && userAnswers[idx] !== q.correctAnswer && <AlertCircle className="w-4 h-4" />}
                      </div>
                    );
                  })}
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 font-bold text-blue-900 mb-1 text-sm uppercase tracking-wider">
                    <BookOpen className="w-4 h-4" /> Study Guide
                  </div>
                  <p className="text-sm text-blue-800 leading-relaxed italic opacity-90 font-medium">{q.explanation}</p>
                </div>
              </div>
            ))}
            <div className="text-center py-10">
              <button onClick={resetPortal} className="bg-[#003366] text-white px-10 py-4 rounded-2xl font-black shadow-lg hover:bg-blue-800 transition-all uppercase tracking-widest text-sm">Start New Event Practice</button>
            </div>
          </div>
        )}
      </main>
      <footer className="text-center py-10 text-slate-400 text-xs">
        <p>&copy; 2026 aahanjain.com/fbla. Empowering Future Business Leaders.</p>
      </footer>
    </div>
  );
};

export default App;