import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Cpu, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft,
  Server,
  PlusCircle
} from 'lucide-react';

// Firebase Imports
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc,
  writeBatch,
  getDocs
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

// Firebase Initialization Logic using environment globals
let auth, db, appId;

try {
  // Use platform-provided __firebase_config global
  const firebaseConfig = JSON.parse(__firebase_config);
  
  if (getApps().length === 0) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    const app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  }

  // Sanitization for appId to ensure correct Firestore path segments
  const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'fbla-prep-portal';
  appId = rawAppId.replace(/\//g, '_'); 
} catch (e) {
  console.error("Firebase Initialization Failed:", e);
}

const AdminUtility = () => {
  const [user, setUser] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [status, setStatus] = useState('idle'); // idle, generating, saving, success, error
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState({ count: 0 });

  // The execution environment provides the key at runtime via an empty string initialization
  //const apiKey = ""; 
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const checkExistingCount = async (topic) => {
    if (!db || !user) return;
    try {
      const qRef = collection(db, 'artifacts', appId, 'public', 'data', 'fbla_questions');
      const snap = await getDocs(qRef);
      const count = snap.docs.filter(d => d.data().topic === topic).length;
      setStats({ count });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedTopic && user) checkExistingCount(selectedTopic);
  }, [selectedTopic, user]);

  const generateAndStore = async () => {
    if (!selectedTopic || !db || !user) return;
    
    setStatus('generating');
    setMessage(`Consulting Gemini AI to create 50 professional questions for ${selectedTopic}...`);

    try {
      // 1. Generate via Gemini
      const systemPrompt = `You are a high-level FBLA competitive events judge. 
      Generate 50 difficult multiple-choice questions for the topic: "${selectedTopic}". 
      Format: JSON array of objects with keys: question, options (4 strings), correctAnswer (index 0-3), and explanation.`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Generate 50 questions." }] }],
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

      if (!response.ok) throw new Error("Gemini API failed to respond. Check if the AI model is available.");
      
      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("AI returned an empty response.");
      
      const questions = JSON.parse(rawText);

      // 2. Save to Firebase
      setStatus('saving');
      setMessage(`AI Generation complete. Committing ${questions.length} questions to Firestore batch...`);

      const batch = writeBatch(db);
      const qRef = collection(db, 'artifacts', appId, 'public', 'data', 'fbla_questions');

      questions.forEach((q) => {
        const newDoc = doc(qRef);
        batch.set(newDoc, {
          ...q,
          topic: selectedTopic,
          createdAt: new Date().toISOString(),
          isAiGenerated: true,
          adminSeeded: true
        });
      });

      await batch.commit();
      
      setStatus('success');
      setMessage(`Success! 50 new questions added to "${selectedTopic}".`);
      checkExistingCount(selectedTopic);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || "An unknown error occurred during processing.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-900/20">
              <Server className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white uppercase italic">Bank Architect</h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Database className="w-3 h-3 text-green-500" /> 
                Live Connection
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter ${user ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500 animate-pulse'}`}>
              {user ? 'Auth Active' : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
          <div className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <PlusCircle className="text-blue-500 w-5 h-5" />
              <h2 className="text-lg font-bold text-white">Community Seeding Tool</h2>
            </div>

            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Select an event category to generate 50 professional-grade MCQs and commit them directly to the Firestore knowledge base.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">FBLA Event Category</label>
                <select 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  disabled={status === 'generating' || status === 'saving'}
                >
                  <option value="">-- Choose Target Topic --</option>
                  {FBLA_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {selectedTopic && (
                <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 animate-in fade-in zoom-in-95">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Items in Repository</p>
                    <p className="text-xl font-black text-white">{stats.count} Questions</p>
                  </div>
                  <div className="text-slate-600">
                    <Database className="w-8 h-8 opacity-20" />
                  </div>
                </div>
              )}

              <button
                onClick={generateAndStore}
                disabled={!selectedTopic || !user || status === 'generating' || status === 'saving'}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-600/10 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
              >
                {(status === 'generating' || status === 'saving') ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <Cpu className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                )}
                {status === 'generating' ? 'AI DRAFTING...' : status === 'saving' ? 'WRITING TO DB...' : 'GENERATE 50 QUESTIONS'}
              </button>
            </div>
          </div>

          {/* Feedback Area */}
          {(status === 'success' || status === 'error' || status === 'generating' || status === 'saving') && (
            <div className={`p-6 border-t border-slate-700 transition-colors ${status === 'success' ? 'bg-green-500/5' : status === 'error' ? 'bg-red-500/5' : 'bg-blue-500/5'}`}>
              <div className="flex items-start gap-4">
                {status === 'success' && <CheckCircle className="text-green-500 w-6 h-6 flex-shrink-0" />}
                {status === 'error' && <AlertCircle className="text-red-500 w-6 h-6 flex-shrink-0" />}
                {(status === 'generating' || status === 'saving') && <RefreshCw className="text-blue-500 w-6 h-6 flex-shrink-0 animate-spin" />}
                
                <div className="flex-1">
                  <p className={`font-bold mb-1 ${status === 'success' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
                    {status.toUpperCase()}
                  </p>
                  <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-12 text-center text-slate-500">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-50 underline decoration-blue-500/50 underline-offset-4">Authorized Seeding Utility</p>
          <div className="flex justify-center items-center gap-4">
            <button 
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-1 text-xs font-bold hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Return to Main Portal
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AdminUtility;