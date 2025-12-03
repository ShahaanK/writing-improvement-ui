// Complete Integrated App - Phase 2
// Copy this to src/App.tsx after creating all component files

import React, { useState } from 'react';
import { FileText, Download, Upload, AlertCircle } from 'lucide-react';
import PracticeSessionComponent from './components/PracticeSession';
import ProgressDashboard from './components/ProgressDashboard';
import ReEvaluation from './components/ReEvaluation';

interface Message {
  id: string;
  text: string;
  timestamp: number;
}

interface Issue {
  issue: string;
  frequency: number;
  severity: string;
  recommendation: string;
}

interface Analysis {
  summary: {
    total_messages: number;
    avg_grammar_score: number;
    avg_punctuation_score: number;
    avg_tone_score: number;
    overall_assessment: string;
  };
  top_grammar_issues: Issue[];
  top_punctuation_issues: Issue[];
  top_tone_issues: Issue[];
}

interface PracticeQuestion {
  question_id: string;
  issue_type: string;
  specific_issue: string;
  question_format: 'correction' | 'multiple_choice' | 'writing_prompt';
  question_text: string;
  correct_answer: string;
  options?: string[];
  explanation: string;
}

interface PracticeSession {
  session_id: string;
  session_number: number;
  date: string;
  focus: string;
  questions: PracticeQuestion[];
  user_answers: { [key: string]: string };
  grading_results?: any[];
  score?: number;
  completed: boolean;
}

interface AppState {
  baseline_analysis?: Analysis;
  baseline_conversations: number;
  baseline_timestamp?: number;
  practice_sessions: PracticeSession[];
  followup_analysis?: Analysis;
  current_step: string;
}

function App() {
  const [apiKey, setApiKey] = useState('');
  const [currentView, setCurrentView] = useState<'setup' | 'evaluation' | 'practice' | 'dashboard' | 'reevaluation'>('setup');
  const [appState, setAppState] = useState<AppState>({
    practice_sessions: [],
    baseline_conversations: 0,
    current_step: 'upload'
  });
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });
  const [error, setError] = useState('');

  // Utility functions
  const parseChatLogs = (jsonData: any, startConv?: number, endConv?: number): Message[] => {
    const logs = Array.isArray(jsonData) ? jsonData : [];
    const start = startConv ? startConv - 1 : 0;
    const end = endConv || logs.length;
    const selectedLogs = logs.slice(start, end);
    
    const messages: Message[] = [];
    selectedLogs.forEach((conv, idx) => {
      const mapping = conv.mapping || {};
      Object.values(mapping).forEach((node: any) => {
        const msg = node.message;
        if (msg?.author?.role === 'user' && msg?.content?.parts) {
          const text = msg.content.parts
            .map((p: any) => typeof p === 'string' ? p : p.text || '')
            .join(' ').trim();
          
          if (text) {
            messages.push({ id: `msg_${idx}_${messages.length}`, text, timestamp: msg.create_time || 0 });
          }
        }
      });
    });
    
    return messages;
  };

  const filterMessages = (messages: Message[]): Message[] => {
    const writingKw = ['grammar', 'punctuation', 'writing', 'edit', 'essay', 'email'];
    const excludeKw = ['debug this', 'solve for', 'calculate'];
    
    return messages.filter(msg => {
      const text = msg.text.toLowerCase();
      const words = msg.text.split(/\s+/).length;
      
      if (words < 10) return false;
      if (writingKw.some(kw => text.includes(kw))) return true;
      if (excludeKw.some(kw => text.includes(kw))) return false;
      
      return msg.text.includes('.') && words >= 20;
    });
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const words1 = new Set(str1.replace(/[.,!?;:]/g, '').split(/\s+/));
    const words2 = new Set(str2.replace(/[.,!?;:]/g, '').split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  };

  // Initial evaluation
  const handleEvaluation = async (file: File) => {
    try {
      setProcessing(true);
      setError('');
      
      const text = await file.text();
      const data = JSON.parse(text);
      const totalConv = Array.isArray(data) ? data.length : 0;
      
      setProgress({ current: 10, total: 100, stage: 'Parsing chat logs...' });
      const messages = parseChatLogs(data, 1, Math.min(100, totalConv));
      
      setProgress({ current: 30, total: 100, stage: 'Filtering messages...' });
      const filtered = filterMessages(messages);
      
      if (filtered.length === 0) {
        throw new Error('No writing-related messages found');
      }
      
      setProgress({ current: 60, total: 100, stage: `Evaluating ${filtered.length} messages...` });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock analysis - TODO: Replace with real API calls
      const analysis: Analysis = {
        summary: {
          total_messages: filtered.length,
          avg_grammar_score: 2.8 + Math.random() * 0.5,
          avg_punctuation_score: 3.1 + Math.random() * 0.5,
          avg_tone_score: 3.5 + Math.random() * 0.4,
          overall_assessment: 'Moderate proficiency with recurring patterns in grammar and punctuation.'
        },
        top_grammar_issues: [
          { issue: 'Subject-verb agreement errors', frequency: 12, severity: 'high', recommendation: 'Review plural subjects like "data", "criteria"' },
          { issue: 'Pronoun case errors', frequency: 8, severity: 'medium', recommendation: 'Use "me" not "I" after prepositions' },
          { issue: 'Comma splices', frequency: 7, severity: 'high', recommendation: 'Use semicolons or periods between independent clauses' },
          { issue: 'Homophone confusion (their/there/they\'re)', frequency: 5, severity: 'medium', recommendation: 'Their=possessive, They\'re=they are, There=location' },
          { issue: 'Inconsistent verb tense', frequency: 4, severity: 'low', recommendation: 'Maintain consistent tense within paragraphs' }
        ],
        top_punctuation_issues: [
          { issue: 'Missing commas after introductory phrases', frequency: 10, severity: 'medium', recommendation: 'Add commas after "However,", "First,"' },
          { issue: 'Comma splices joining independent clauses', frequency: 9, severity: 'high', recommendation: 'Use semicolons or periods' },
          { issue: 'Apostrophe misuse (its vs it\'s)', frequency: 6, severity: 'medium', recommendation: 'Its=possessive, It\'s=it is' },
          { issue: 'Missing or misplaced quotation marks', frequency: 4, severity: 'low', recommendation: 'Periods go inside quotes' },
          { issue: 'Semicolon usage errors', frequency: 3, severity: 'low', recommendation: 'Use between related independent clauses' }
        ],
        top_tone_issues: [
          { issue: 'Overly casual language', frequency: 8, severity: 'medium', recommendation: 'Avoid contractions in formal writing' },
          { issue: 'Excessive use of absolutes (always/never)', frequency: 7, severity: 'medium', recommendation: 'Use "often", "rarely" instead' },
          { issue: 'Wordiness and redundancy', frequency: 6, severity: 'low', recommendation: 'Eliminate phrases like "due to the fact that"' },
          { issue: 'Vague or imprecise language', frequency: 5, severity: 'medium', recommendation: 'Replace "very", "really" with specific terms' },
          { issue: 'Inconsistent formality level', frequency: 4, severity: 'low', recommendation: 'Maintain consistent professional tone' }
        ]
      };
      
      setProgress({ current: 100, total: 100, stage: 'Complete!' });
      
      setAppState({
        baseline_analysis: analysis,
        baseline_conversations: Math.min(100, totalConv),
        baseline_timestamp: Math.max(...messages.map(m => m.timestamp)),
        practice_sessions: [],
        current_step: 'evaluation'
      });
      
      setCurrentView('evaluation');
      setProcessing(false);
      
    } catch (err: any) {
      setError(err.message);
      setProcessing(false);
    }
  };

  // Generate practice sessions
  const generatePracticeSessions = async () => {
    if (!appState.baseline_analysis) return;
    
    setProcessing(true);
    setProgress({ current: 0, total: 100, stage: 'Generating practice sessions...' });
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const today = new Date();
    const sessions: PracticeSession[] = [1, 2, 3].map(num => ({
      session_id: `session_${num}`,
      session_number: num,
      date: new Date(today.getTime() + (num === 1 ? 1 : num === 2 ? 3 : 7) * 86400000).toISOString().split('T')[0],
      focus: num === 1 ? 'Initial learning' : num === 2 ? 'Consolidation' : 'Retention test',
      questions: [
        {
          question_id: `s${num}_q1`,
          issue_type: 'grammar',
          specific_issue: appState.baseline_analysis!.top_grammar_issues[0].issue,
          question_format: 'correction',
          question_text: `Correct this sentence:\n\nThe data shows significant results in ${num === 1 ? 'our' : num === 2 ? 'their' : 'the'} study.`,
          correct_answer: 'The data show significant results in the study.',
          explanation: '"Data" is plural'
        },
        {
          question_id: `s${num}_q2`,
          issue_type: 'grammar',
          specific_issue: appState.baseline_analysis!.top_grammar_issues[0].issue,
          question_format: 'multiple_choice',
          question_text: 'Which is correct?',
          correct_answer: 'B',
          options: ['A) The criteria was met', 'B) The criteria were met', 'C) The criterion were met', 'D) The criterias was met'],
          explanation: '"Criteria" is plural'
        }
      ],
      user_answers: {},
      completed: false
    }));
    
    setAppState(prev => ({
      ...prev,
      practice_sessions: sessions,
      current_step: 'practice'
    }));
    
    setProgress({ current: 100, total: 100, stage: 'Complete!' });
    setTimeout(() => {
      setProcessing(false);
      setCurrentView('practice');
    }, 500);
  };

  // Grade session
  const gradeSession = (sessionId: string, answers: { [key: string]: string }) => {
    const sessionIdx = appState.practice_sessions.findIndex(s => s.session_id === sessionId);
    if (sessionIdx === -1) return;
    
    const session = appState.practice_sessions[sessionIdx];
    const results: any[] = [];
    let correctCount = 0;
    
    session.questions.forEach((q, idx) => {
      const userAnswer = answers[q.question_id] || '';
      let isCorrect = false;
      let feedback = '';
      let gradingMethod = 'programmatic';
      
      if (!userAnswer) {
        feedback = 'No answer provided';
      } else if (q.question_format === 'multiple_choice') {
        const userLetter = userAnswer.toUpperCase()[0];
        const correctLetter = q.correct_answer.toUpperCase()[0];
        isCorrect = userLetter === correctLetter;
        feedback = isCorrect ? 'Correct! ✓' : `Incorrect. Correct: ${correctLetter}`;
      } else {
        const similarity = calculateSimilarity(userAnswer.toLowerCase(), q.correct_answer.toLowerCase());
        if (similarity > 0.85) {
          isCorrect = true;
          feedback = 'Correct! ✓';
          gradingMethod = 'similarity';
        } else {
          feedback = 'Review the correct answer';
          gradingMethod = 'llm';
        }
      }
      
      if (isCorrect) correctCount++;
      
      results.push({
        question: idx + 1,
        issue: q.specific_issue,
        correct: isCorrect,
        feedback,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        grading_method: gradingMethod
      });
    });
    
    const score = correctCount / session.questions.length;
    
    const updatedSessions = [...appState.practice_sessions];
    updatedSessions[sessionIdx] = {
      ...session,
      user_answers: answers,
      grading_results: results,
      score,
      completed: true
    };
    
    setAppState(prev => ({ ...prev, practice_sessions: updatedSessions }));
  };

  // Update session answers
  const updateSession = (sessionId: string, answers: { [key: string]: string }) => {
    const sessionIdx = appState.practice_sessions.findIndex(s => s.session_id === sessionId);
    if (sessionIdx === -1) return;
    
    const updatedSessions = [...appState.practice_sessions];
    updatedSessions[sessionIdx] = {
      ...updatedSessions[sessionIdx],
      user_answers: answers
    };
    
    setAppState(prev => ({ ...prev, practice_sessions: updatedSessions }));
  };

  // Handle re-evaluation
  const handleReEvaluation = async (file: File, options: { start?: number; end?: number; mode: string }) => {
    try {
      setProcessing(true);
      setError('');
      
      const text = await file.text();
      const data = JSON.parse(text);
      
      let messages: Message[];
      if (options.mode === 'incremental') {
        // Only messages after baseline
        const allMessages = parseChatLogs(data);
        messages = allMessages.filter(m => m.timestamp > (appState.baseline_timestamp || 0));
      } else {
        // Custom range
        messages = parseChatLogs(data, options.start, options.end);
      }
      
      const filtered = filterMessages(messages);
      
      // Mock followup analysis
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const followupAnalysis: Analysis = {
        summary: {
          total_messages: filtered.length,
          avg_grammar_score: (appState.baseline_analysis?.summary.avg_grammar_score || 3) + 0.5 + Math.random() * 0.3,
          avg_punctuation_score: (appState.baseline_analysis?.summary.avg_punctuation_score || 3) + 0.4 + Math.random() * 0.3,
          avg_tone_score: (appState.baseline_analysis?.summary.avg_tone_score || 3) + 0.3 + Math.random() * 0.2,
          overall_assessment: 'Noticeable improvement across all categories!'
        },
        top_grammar_issues: appState.baseline_analysis?.top_grammar_issues.map(i => ({
          ...i,
          frequency: Math.max(0, i.frequency - Math.floor(Math.random() * 5))
        })) || [],
        top_punctuation_issues: appState.baseline_analysis?.top_punctuation_issues.map(i => ({
          ...i,
          frequency: Math.max(0, i.frequency - Math.floor(Math.random() * 4))
        })) || [],
        top_tone_issues: appState.baseline_analysis?.top_tone_issues.map(i => ({
          ...i,
          frequency: Math.max(0, i.frequency - Math.floor(Math.random() * 3))
        })) || []
      };
      
      setAppState(prev => ({
        ...prev,
        followup_analysis: followupAnalysis,
        current_step: 'complete'
      }));
      
      setCurrentView('dashboard');
      setProcessing(false);
      
    } catch (err: any) {
      setError(err.message);
      setProcessing(false);
    }
  };

  const downloadState = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `writing_state_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const uploadState = async (file: File) => {
    const text = await file.text();
    const state = JSON.parse(text);
    setAppState(state);
    
    if (state.followup_analysis) setCurrentView('dashboard');
    else if (state.practice_sessions.length > 0) setCurrentView('practice');
    else if (state.baseline_analysis) setCurrentView('evaluation');
    else setCurrentView('setup');
  };

  const ScoreCard = ({ label, score, colorClass }: { label: string; score: number; colorClass: string }) => (
    <div className="bg-white rounded-lg p-6 border-2 border-gray-200">
      <div className="text-sm font-medium text-gray-600 mb-2">{label}</div>
      <div className="text-4xl font-bold text-gray-900 mb-3">
        {score.toFixed(1)}<span className="text-xl text-gray-500 font-normal">/5</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${(score / 5) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="text-blue-600" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Writing Improvement System</h1>
                <p className="text-sm text-gray-600">AI-powered analysis, practice, and progress tracking</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                {[
                  { id: 'setup', label: 'Upload' },
                  { id: 'evaluation', label: 'Report' },
                  { id: 'practice', label: 'Practice' },
                  { id: 'dashboard', label: 'Progress' },
                  { id: 'reevaluation', label: 'Re-Eval' }
                ].map(nav => {
                  const enabled = 
                    nav.id === 'setup' || 
                    (nav.id === 'evaluation' && appState.baseline_analysis) ||
                    (nav.id === 'practice' && appState.practice_sessions.length > 0) ||
                    (nav.id === 'dashboard' && appState.practice_sessions.some(s => s.completed)) ||
                    (nav.id === 'reevaluation' && appState.practice_sessions.filter(s => s.completed).length === 3);
                  
                  return (
                    <button
                      key={nav.id}
                      onClick={() => enabled && setCurrentView(nav.id as any)}
                      disabled={!enabled}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentView === nav.id ? 'bg-blue-600 text-white' :
                        enabled ? 'text-gray-700 hover:bg-gray-200' :
                        'text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {nav.label}
                    </button>
                  );
                })}
              </div>

              <button onClick={downloadState} disabled={!appState.baseline_analysis} className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg">
                <Download size={18} />
              </button>
              
              <label className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer">
                <Upload size={18} />
                <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files && uploadState(e.target.files[0])} />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Setup View */}
        {currentView === 'setup' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Get Started</h2>
            
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">Anthropic API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="mt-2 text-sm text-gray-500">Session only • Never saved</p>
            </div>

            {apiKey && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                <h3 className="text-lg font-semibold mb-2">Upload Chat Logs</h3>
                <p className="text-gray-600 mb-4">OpenAI chat export (JSON only)</p>
                
                <label className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg cursor-pointer">
                  <Upload size={18} className="mr-2" />
                  Choose File
                  <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files && handleEvaluation(e.target.files[0])} />
                </label>
              </div>
            )}

            {processing && (
              <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
                <div className="flex justify-between mb-4">
                  <span className="font-medium text-blue-900">{progress.stage}</span>
                  <span className="text-blue-700 font-semibold">{progress.current}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3">
                  <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${progress.current}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="text-red-600 mr-3" size={20} />
                <p className="text-red-800">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Evaluation View */}
        {currentView === 'evaluation' && appState.baseline_analysis && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex justify-between mb-6">
              <h2 className="text-2xl font-bold">Evaluation Report</h2>
              <button onClick={() => {/* download logic */}} className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
                <Download size={18} />
                <span className="text-sm">Download</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <ScoreCard label="Grammar" score={appState.baseline_analysis.summary.avg_grammar_score} colorClass="bg-blue-500" />
              <ScoreCard label="Punctuation" score={appState.baseline_analysis.summary.avg_punctuation_score} colorClass="bg-green-500" />
              <ScoreCard label="Tone" score={appState.baseline_analysis.summary.avg_tone_score} colorClass="bg-purple-500" />
            </div>

            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-blue-900 mb-2">Overall Assessment</h3>
              <p className="text-blue-800">{appState.baseline_analysis.summary.overall_assessment}</p>
            </div>

            {['grammar', 'punctuation', 'tone'].map(cat => (
              <div key={cat} className="mb-6 border-2 border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4 capitalize">Top {cat} Issues</h3>
                {(appState.baseline_analysis as any)[`top_${cat}_issues`].map((issue: Issue, idx: number) => (
                  <div key={idx} className="mb-3 bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold">{idx + 1}. {issue.issue}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                        issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {issue.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Frequency: {issue.frequency}</p>
                    <p className="text-sm text-gray-700 mt-1">💡 {issue.recommendation}</p>
                  </div>
                ))}
              </div>
            ))}

            <button
              onClick={generatePracticeSessions}
              disabled={processing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 rounded-lg"
            >
              {processing ? 'Generating...' : 'Generate Practice Plan →'}
            </button>
          </div>
        )}

        {/* Practice View */}
        {currentView === 'practice' && (
          <PracticeSessionComponent
            sessions={appState.practice_sessions}
            onUpdateSession={updateSession}
            onGradeSession={gradeSession}
            apiKey={apiKey}
          />
        )}

        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <ProgressDashboard
            sessions={appState.practice_sessions}
            baselineAnalysis={appState.baseline_analysis}
            followupAnalysis={appState.followup_analysis}
            onStartReEvaluation={() => setCurrentView('reevaluation')}
          />
        )}

        {/* Re-Evaluation View */}
        {currentView === 'reevaluation' && (
          <ReEvaluation
            baselineConversations={appState.baseline_conversations}
            baselineTimestamp={appState.baseline_timestamp || 0}
            onRunReEvaluation={handleReEvaluation}
          />
        )}
      </div>
    </div>
  );
}

export default App;