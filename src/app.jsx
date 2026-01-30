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
  GraduationCap
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
  const apiKey = ""; // Set in Vercel environment variables as VITE_GEMINI_API_KEY

  const fetchQuestions = async (topic) => {
    setIsLoading(true);
    setIsError(false);
    
    const systemPrompt = `You are an expert FBLA competitive events coordinator. 
    Generate 50 challenging multiple-choice questions for: "${topic}".
    Return ONLY a JSON array of objects:
    [{ "question": "string", "options": ["A", "B", "C", "D"], "correctAnswer": 0-3, "explanation": "string" }]`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate 50 FBLA questions for the topic: ${topic}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      setQuestions(JSON.parse(text));
      setView('testing');
      if (testMode === 'timed') startTimer();
    } catch (err) {
      console.error(err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
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
            <div className={`flex items-center gap-4 px-4 py-2 rounded-full font-mono text-lg bg-blue-50 text-blue-800`}>
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
              Select your topic to start an AI-powered practice session designed for FBLA success.
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
                  disabled={!selectedTopic}
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
                  disabled={!selectedTopic}
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
            </div>
          </div>
        )}

        {view === 'config' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            {!isLoading ? (
              <div className="text-center bg-white p-10 rounded-2xl shadow-xl max-w-lg">
                <h3 className="text-2xl font-bold mb-4">{testMode === 'timed' ? 'Timed Test' : 'Practice Test'}</h3>
                <p className="text-slate-500 mb-8">Ready to begin your 50-question session for <strong>{selectedTopic}</strong>?</p>
                <button 
                  onClick={() => fetchQuestions(selectedTopic)}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                >
                  Generate & Start
                </button>
              </div>
            ) : (
              <div className="text-center">
                <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-700">Generating Questions...</h3>
              </div>
            )}
            {isError && (
              <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                <span>Failed to load questions. </span>
                <button onClick={() => fetchQuestions(selectedTopic)} className="underline font-bold ml-2">Retry</button>
              </div>
            )}
          </div>
        )}

        {view === 'testing' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center text-sm font-semibold text-slate-500">
              <span>Question {currentQuestionIndex + 1} of 50</span>
              <span>{selectedTopic}</span>
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
                <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
                  <h4 className="text-blue-900 font-bold mb-2 flex items-center gap-2">Explanation</h4>
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

            <div className="flex justify-between">
              <button 
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0 || showFeedback}
                className="px-4 py-2 text-slate-500 font-bold disabled:opacity-30"
              >
                Previous
              </button>
              {testMode === 'timed' && (
                <button 
                  onClick={handleFinishTest}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold"
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
              <h2 className="text-3xl font-black text-slate-900 mb-2">Finished!</h2>
              <div className="text-6xl font-black text-blue-600 my-8">{calculateScore()} / 50</div>
              
              <div className="bg-[#003366] p-8 rounded-2xl text-white text-left mb-8">
                <h4 className="text-xl font-bold mb-2">Want to save these results?</h4>
                <p className="text-blue-100 mb-6 text-sm">Sign up for a free account to track your progress across all FBLA events.</p>
                <button className="w-full bg-yellow-400 text-blue-900 py-3 rounded-xl font-black uppercase tracking-wider text-sm shadow-lg">
                  Create Account
                </button>
              </div>

              <button onClick={resetPortal} className="text-slate-400 font-bold flex items-center gap-2 mx-auto">
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