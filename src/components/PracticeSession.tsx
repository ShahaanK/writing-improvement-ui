import React, { useState } from 'react';
import { CheckCircle, XCircle, Download, Upload, AlertCircle } from 'lucide-react';

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
  user_answers?: { [key: string]: string };
  grading_results?: any[];
  score?: number;
  completed: boolean;
}

interface Props {
  sessions: PracticeSession[];
  onUpdateSession: (sessionId: string, answers: { [key: string]: string }) => void;
  onGradeSession: (sessionId: string, answers: { [key: string]: string }) => void;
  apiKey: string;
}

const PracticeSessionComponent: React.FC<Props> = ({ sessions, onUpdateSession, onGradeSession, apiKey }) => {
  const [activeSession, setActiveSession] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [showResults, setShowResults] = useState(false);

  const currentSession = sessions[activeSession];

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    if (!currentSession) return;
    
    const unanswered = currentSession.questions.filter(q => !answers[q.question_id]);
    
    if (unanswered.length > 0) {
      const proceed = window.confirm(
        `You have ${unanswered.length} unanswered question(s). Submit anyway?`
      );
      if (!proceed) return;
    }
    
    onGradeSession(currentSession.session_id, answers);
    setShowResults(true);
  };

  const downloadSession = () => {
    const sessionData = {
      session_id: currentSession.session_id,
      questions: currentSession.questions,
      user_answers: answers
    };
    
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSession.session_id}_answers.json`;
    a.click();
  };

  const uploadAnswers = async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);
    setAnswers(data.user_answers || {});
  };

  if (!currentSession) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <p className="text-gray-600">No practice sessions available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Tabs */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            {sessions.map((session, idx) => (
              <button
                key={session.session_id}
                onClick={() => {
                  setActiveSession(idx);
                  setShowResults(false);
                }}
                className={`flex-1 px-6 py-4 font-medium transition-colors ${
                  activeSession === idx
                    ? 'bg-blue-600 text-white'
                    : session.completed
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <span>Session {session.session_number}</span>
                  {session.completed && <CheckCircle size={18} />}
                </div>
                <div className="text-xs mt-1 opacity-75">{session.date}</div>
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
            <span>⏱️ Duration: 15 minutes</span>
            <span>📝 Questions: {currentSession.questions.length}</span>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={downloadSession}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-sm"
            >
              <Download size={16} />
              <span>Download</span>
            </button>
            
            <label className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors text-sm">
              <Upload size={16} />
              <span>Upload Answers</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => e.target.files && uploadAnswers(e.target.files[0])}
              />
            </label>
          </div>

          <div className="text-sm text-gray-600">
            Answered: {Object.keys(answers).filter(k => answers[k]).length}/{currentSession.questions.length}
          </div>
        </div>

        {/* Questions Form */}
        {!showResults ? (
          <div className="p-8">
            <div className="space-y-8">
              {currentSession.questions.map((question, idx) => (
                <div key={question.question_id} className="border-2 border-gray-200 rounded-lg p-6 bg-white">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-gray-800 mb-1">
                          {question.question_format === 'correction' && '✏️ Correction Exercise'}
                          {question.question_format === 'multiple_choice' && '🔘 Multiple Choice'}
                          {question.question_format === 'writing_prompt' && '📝 Writing Prompt'}
                        </div>
                        <div className="text-sm text-gray-600">Topic: {question.specific_issue}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-gray-800 whitespace-pre-wrap">{question.question_text}</div>
                  </div>

                  {/* Multiple Choice Options */}
                  {question.question_format === 'multiple_choice' && question.options && (
                    <div className="space-y-2 mb-4">
                      {question.options.map((option, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                        rows={question.question_format === 'writing_prompt' ? 6 : 3}
                        placeholder="Type your answer here..."
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg transition-colors"
            >
              Submit for Grading
            </button>
          </div>
        ) : (
          /* Results View */
          <div className="p-8">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-green-900 mb-1">
                    Score: {currentSession.score ? (currentSession.score * 100).toFixed(0) : 0}%
                  </h3>
                  <p className="text-green-700">
                    {currentSession.grading_results?.filter(r => r.correct).length || 0} / {currentSession.questions.length} correct
                  </p>
                </div>
                <CheckCircle className="text-green-600" size={48} />
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
                        <CheckCircle className="text-green-600" size={24} />
                      ) : (
                        <XCircle className="text-red-600" size={24} />
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
                          {result.grading_method === 'programmatic' && '⚡ Auto'}
                          {result.grading_method === 'similarity' && '≈ Match'}
                          {result.grading_method === 'llm' && '🤖 AI'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-gray-600 font-medium mb-1">Topic: {result.issue}</p>
                    <p className={`${result.correct ? 'text-green-800' : 'text-red-800'}`}>
                      {result.feedback}
                    </p>
                  </div>

                  {!result.correct && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">Correct answer:</span> {result.correct_answer}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">💡 Explanation:</span> {result.explanation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex space-x-4">
              <button
                onClick={() => {
                  setShowResults(false);
                  setAnswers({});
                }}
                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
              >
                Retry Session
              </button>
              
              {activeSession < sessions.length - 1 && (
                <button
                  onClick={() => {
                    setActiveSession(prev => prev + 1);
                    setShowResults(false);
                    setAnswers({});
                  }}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Next Session →
                </button>
              )}

              {activeSession === sessions.length - 1 && sessions.every(s => s.completed) && (
                <button
                  onClick={() => {/* Navigate to dashboard */}}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  View Progress Dashboard →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeSessionComponent;