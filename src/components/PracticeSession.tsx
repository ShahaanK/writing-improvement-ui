import React, { useState } from 'react';
import { CheckCircle, XCircle, Download, Upload, AlertCircle, Loader } from 'lucide-react';
import { AnthropicAPI } from '../utils/anthropicApi';
import { PracticeSession, GradingResult, PracticeQuestion } from '../types';

interface Props {
  sessions: PracticeSession[];
  onUpdateSession: (sessionId: string, answers: { [key: string]: string }) => void;
  onGradeSession: (sessionId: string, results: GradingResult[], score: number) => void;
  api: AnthropicAPI;
  onViewDashboard: () => void;
}

const PracticeSessionComponent: React.FC<Props> = ({ 
  sessions, 
  onUpdateSession, 
  onGradeSession, 
  api,
  onViewDashboard
}) => {
  const [activeSession, setActiveSession] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [showResults, setShowResults] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradingProgress, setGradingProgress] = useState('');

  const currentSession = sessions[activeSession];

  // Load existing answers when switching sessions
  React.useEffect(() => {
    if (currentSession?.user_answers) {
      setAnswers(currentSession.user_answers);
    } else {
      setAnswers({});
    }
    setShowResults(currentSession?.completed || false);
  }, [activeSession, currentSession]);

  const handleAnswerChange = (questionId: string, value: string) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    // Auto-save answers
    onUpdateSession(currentSession.session_id, newAnswers);
  };

  const handleSubmit = async () => {
    if (!currentSession) return;
    
    const unanswered = currentSession.questions.filter(q => !answers[q.question_id]?.trim());
    
    if (unanswered.length > 0) {
      const proceed = window.confirm(
        `You have ${unanswered.length} unanswered question(s). Submit anyway?`
      );
      if (!proceed) return;
    }
    
    setGrading(true);
    setGradingProgress('Starting grading process...');
    
    try {
      // Use the API to grade the session
      const results = await api.gradePracticeSession(
        currentSession.questions,
        answers,
        (status) => setGradingProgress(status)
      );
      
      // Calculate score
      const correctCount = results.filter(r => r.correct).length;
      const score = correctCount / results.length;
      
      // Update the session with results
      onGradeSession(currentSession.session_id, results, score);
      
      setShowResults(true);
      setGradingProgress('Grading complete!');
      
    } catch (error: any) {
      console.error('Grading error:', error);
      alert(`Grading failed: ${error.message}. Please try again.`);
    } finally {
      setTimeout(() => {
        setGrading(false);
        setGradingProgress('');
      }, 1000);
    }
  };

  const downloadSession = () => {
    const sessionData = {
      session_id: currentSession.session_id,
      session_number: currentSession.session_number,
      date: currentSession.date,
      questions: currentSession.questions,
      user_answers: answers,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${currentSession.session_number}_answers_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadAnswers = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.session_id !== currentSession.session_id) {
        alert('Warning: This file is from a different session. Answers may not match questions.');
      }
      
      setAnswers(data.user_answers || {});
      onUpdateSession(currentSession.session_id, data.user_answers || {});
      
    } catch (error) {
      alert('Error loading file. Please ensure it\'s a valid JSON file.');
    }
  };

  const resetSession = () => {
    const proceed = window.confirm(
      'This will clear all your answers and results for this session. Continue?'
    );
    
    if (proceed) {
      setAnswers({});
      setShowResults(false);
      onUpdateSession(currentSession.session_id, {});
    }
  };

  if (!currentSession) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <p className="text-gray-600">No practice sessions available</p>
      </div>
    );
  }

  const completedCount = sessions.filter(s => s.completed).length;

  return (
    <div className="space-y-6">
      {/* Progress Summary Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2">Practice Sessions</h3>
            <p className="text-blue-100">
              {completedCount} of {sessions.length} sessions completed
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{Math.round((completedCount / sessions.length) * 100)}%</div>
            <p className="text-sm text-blue-100">Progress</p>
          </div>
        </div>
        
        {/* Quick Navigation */}
        <div className="mt-4 pt-4 border-t border-blue-400 flex gap-3">
          <button
            onClick={onViewDashboard}
            className="px-4 py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
          >
            📊 View Dashboard
          </button>
          {completedCount < sessions.length && (
            <div className="flex items-center text-sm text-blue-100">
              <AlertCircle size={16} className="mr-2" />
              Complete all sessions for best results
            </div>
          )}
        </div>
      </div>

      {/* Session Tabs */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            {sessions.map((session, idx) => (
              <button
                key={session.session_id}
                onClick={() => {
                  if (!grading) {
                    setActiveSession(idx);
                  }
                }}
                disabled={grading}
                className={`flex-1 px-6 py-4 font-medium transition-colors ${
                  activeSession === idx
                    ? 'bg-blue-600 text-white'
                    : session.completed
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                } ${grading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <span>Session {session.session_number}</span>
                  {session.completed && <CheckCircle size={18} />}
                </div>
                <div className="text-xs mt-1 opacity-75">{session.date}</div>
                {session.score !== undefined && (
                  <div className="text-xs mt-1 font-bold">
                    {Math.round(session.score * 100)}%
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Session Header */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Session {currentSession.session_number}: {currentSession.focus}
          </h2>
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <span>📅 Scheduled: {currentSession.date}</span>
            <span>⏱️ Duration: ~15 minutes</span>
            <span>📝 Questions: {currentSession.questions.length}</span>
            {currentSession.completed && currentSession.score !== undefined && (
              <span className="font-bold text-green-600">
                ✓ Score: {Math.round(currentSession.score * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Actions Bar */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={downloadSession}
              disabled={grading}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
            >
              <Download size={16} />
              <span>Download</span>
            </button>
            
            <label className={`flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-sm ${
              grading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}>
              <Upload size={16} />
              <span>Upload</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                disabled={grading}
                onChange={(e) => e.target.files && uploadAnswers(e.target.files[0])}
              />
            </label>

            {showResults && (
              <button
                onClick={resetSession}
                disabled={grading}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
              >
                <XCircle size={16} />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="text-sm text-gray-600">
            Answered: {Object.keys(answers).filter(k => answers[k]?.trim()).length}/{currentSession.questions.length}
          </div>
        </div>

        {/* Grading Progress */}
        {grading && (
          <div className="p-6 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center space-x-3">
              <Loader className="animate-spin text-blue-600" size={24} />
              <div className="flex-1">
                <p className="font-medium text-blue-900">Grading in progress...</p>
                <p className="text-sm text-blue-700">{gradingProgress}</p>
              </div>
            </div>
          </div>
        )}

        {/* Questions Form */}
        {!showResults ? (
          <div className="p-8">
            <div className="space-y-8">
              {currentSession.questions.map((question, idx) => (
                <div key={question.question_id} className="border-2 border-gray-200 rounded-lg p-6 bg-white hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-gray-800 mb-1">
                          {question.question_format === 'correction' && '✏️ Correction Exercise'}
                          {question.question_format === 'multiple_choice' && '📘 Multiple Choice'}
                          {question.question_format === 'writing_prompt' && '📄 Writing Prompt'}
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Focus:</span> {question.specific_issue}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-gray-800 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-200">
                      {question.question_text}
                    </div>
                  </div>

                  {/* Multiple Choice Options */}
                  {question.question_format === 'multiple_choice' && question.options && (
                    <div className="space-y-2 mb-4">
                      {question.options.map((option, optIdx) => (
                        <label
                          key={optIdx}
                          className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                            answers[question.question_id] === option
                              ? 'bg-blue-100 border-2 border-blue-500'
                              : 'bg-gray-50 border-2 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="radio"
                            name={question.question_id}
                            value={option}
                            checked={answers[question.question_id] === option}
                            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
                            className="mr-3"
                          />
                          <span className="text-gray-800">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Text Answer */}
                  {(question.question_format === 'correction' || question.question_format === 'writing_prompt') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Answer:
                      </label>
                      <textarea
                        value={answers[question.question_id] || ''}
                        onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                        rows={question.question_format === 'writing_prompt' ? 8 : 3}
                        placeholder="Type your answer here..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {(answers[question.question_id] || '').length} characters
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={grading}
              className="mt-8 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {grading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  <span>Grading with AI...</span>
                </>
              ) : (
                <span>Submit for Grading</span>
              )}
            </button>
          </div>
        ) : (
          /* Results View */
          <div className="p-8">
            <div className={`border-2 rounded-lg p-6 mb-8 ${
              (currentSession.score || 0) >= 0.8 ? 'bg-green-50 border-green-200' :
              (currentSession.score || 0) >= 0.6 ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-xl font-bold mb-1 ${
                    (currentSession.score || 0) >= 0.8 ? 'text-green-900' :
                    (currentSession.score || 0) >= 0.6 ? 'text-yellow-900' :
                    'text-red-900'
                  }`}>
                    Score: {currentSession.score ? Math.round(currentSession.score * 100) : 0}%
                  </h3>
                  <p className={`${
                    (currentSession.score || 0) >= 0.8 ? 'text-green-700' :
                    (currentSession.score || 0) >= 0.6 ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {currentSession.grading_results?.filter(r => r.correct).length || 0} / {currentSession.questions.length} correct
                  </p>
                  {(currentSession.score || 0) >= 0.8 && (
                    <p className="text-green-600 text-sm mt-1">🎉 Excellent work!</p>
                  )}
                  {(currentSession.score || 0) >= 0.6 && (currentSession.score || 0) < 0.8 && (
                    <p className="text-yellow-600 text-sm mt-1">👍 Good progress!</p>
                  )}
                  {(currentSession.score || 0) < 0.6 && (
                    <p className="text-red-600 text-sm mt-1">📚 Keep practicing!</p>
                  )}
                </div>
                <CheckCircle className={`${
                  (currentSession.score || 0) >= 0.8 ? 'text-green-600' :
                  (currentSession.score || 0) >= 0.6 ? 'text-yellow-600' :
                  'text-red-600'
                }`} size={48} />
              </div>
            </div>

            {/* Detailed Results */}
            <div className="space-y-6">
              {currentSession.grading_results?.map((result, idx) => (
                <div
                  key={idx}
                  className={`border-2 rounded-lg p-6 ${
                    result.correct
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {result.correct ? (
                        <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                      ) : (
                        <XCircle className="text-red-600 flex-shrink-0" size={24} />
                      )}
                      <div>
                        <span className="font-semibold text-gray-800">
                          Question {result.question}
                        </span>
                        <span className={`ml-3 text-xs px-2 py-1 rounded ${
                          result.grading_method === 'programmatic' ? 'bg-blue-100 text-blue-700' :
                          result.grading_method === 'similarity' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {result.grading_method === 'programmatic' && '⚡ Auto-graded'}
                          {result.grading_method === 'similarity' && '≈ Pattern match'}
                          {result.grading_method === 'llm' && '🤖 AI-graded'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-gray-600 font-medium mb-1">
                      <span className="font-semibold">Focus area:</span> {result.issue}
                    </p>
                    <p className={`font-medium ${result.correct ? 'text-green-800' : 'text-red-800'}`}>
                      {result.feedback}
                    </p>
                  </div>

                  {!result.correct && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">✓ Correct answer:</span> {result.correct_answer}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">💡 Explanation:</span> {result.explanation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                onClick={resetSession}
                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
              >
                Retry Session
              </button>
              
              {activeSession < sessions.length - 1 && (
                <button
                  onClick={() => {
                    setActiveSession(prev => prev + 1);
                  }}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Next Session →
                </button>
              )}

              {/* Always show dashboard button */}
              <button
                onClick={onViewDashboard}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                View Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeSessionComponent;