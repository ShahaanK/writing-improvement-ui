import React from 'react';
import { TrendingUp, Award, Target, Download, CheckCircle } from 'lucide-react';

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

interface GradingResult {
  question: number;
  issue: string;
  correct: boolean;
  feedback: string;
  correct_answer: string;
  explanation: string;
  grading_method: 'programmatic' | 'similarity' | 'llm';
}

interface PracticeSession {
  session_id: string;
  session_number: number;
  date: string;
  focus: string;
  questions: PracticeQuestion[];
  user_answers?: { [key: string]: string };
  grading_results?: GradingResult[];
  score?: number;
  completed: boolean;
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

interface Props {
  sessions: PracticeSession[];
  baselineAnalysis?: Analysis;
  followupAnalysis?: Analysis;
  onStartReEvaluation: () => void;
}

const ProgressDashboard: React.FC<Props> = ({ 
  sessions, 
  baselineAnalysis, 
  followupAnalysis,
  onStartReEvaluation 
}) => {
  const completedSessions = sessions.filter(s => s.completed);
  
  // Calculate average practice score
  const avgPracticeScore = completedSessions.length > 0
    ? completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length
    : 0;

  // Calculate total questions answered
  const totalQuestions = completedSessions.reduce((sum, s) => sum + (s.questions?.length || 0), 0);
  const totalCorrect = completedSessions.reduce((sum, s) => {
    return sum + (s.grading_results?.filter(r => r.correct).length || 0);
  }, 0);

  // Prepare comparison data if we have followup
  const hasFollowup = baselineAnalysis && followupAnalysis;
  const improvements = hasFollowup ? [
    {
      category: 'Grammar',
      baseline: baselineAnalysis.summary.avg_grammar_score,
      followup: followupAnalysis.summary.avg_grammar_score,
      improvement: ((followupAnalysis.summary.avg_grammar_score - baselineAnalysis.summary.avg_grammar_score) / baselineAnalysis.summary.avg_grammar_score * 100).toFixed(1)
    },
    {
      category: 'Punctuation',
      baseline: baselineAnalysis.summary.avg_punctuation_score,
      followup: followupAnalysis.summary.avg_punctuation_score,
      improvement: ((followupAnalysis.summary.avg_punctuation_score - baselineAnalysis.summary.avg_punctuation_score) / baselineAnalysis.summary.avg_punctuation_score * 100).toFixed(1)
    },
    {
      category: 'Tone',
      baseline: baselineAnalysis.summary.avg_tone_score,
      followup: followupAnalysis.summary.avg_tone_score,
      improvement: ((followupAnalysis.summary.avg_tone_score - baselineAnalysis.summary.avg_tone_score) / baselineAnalysis.summary.avg_tone_score * 100).toFixed(1)
    }
  ] : null;

  // Calculate issue performance
  const issuePerformance: { [key: string]: { correct: number; total: number } } = {};
  
  completedSessions.forEach(session => {
    session.grading_results?.forEach(result => {
      if (!issuePerformance[result.issue]) {
        issuePerformance[result.issue] = { correct: 0, total: 0 };
      }
      issuePerformance[result.issue].total += 1;
      if (result.correct) {
        issuePerformance[result.issue].correct += 1;
      }
    });
  });

  const sortedIssues = Object.entries(issuePerformance)
    .map(([issue, stats]) => ({
      issue,
      accuracy: (stats.correct / stats.total) * 100,
      correct: stats.correct,
      total: stats.total
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const downloadDashboard = () => {
    const dashboardData = {
      generated_at: new Date().toISOString(),
      sessions: completedSessions,
      baseline_analysis: baselineAnalysis,
      followup_analysis: followupAnalysis,
      statistics: {
        avg_practice_score: avgPracticeScore,
        total_questions: totalQuestions,
        total_correct: totalCorrect,
        completion_rate: completedSessions.length / sessions.length
      },
      issue_performance: sortedIssues
    };
    
    const blob = new Blob([JSON.stringify(dashboardData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `progress_dashboard_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Progress Dashboard</h2>
        <p className="text-gray-600">Track your writing improvement journey</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Sessions Completed</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {completedSessions.length}<span className="text-xl text-gray-500">/{sessions.length}</span>
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all" 
                  style={{ width: `${(completedSessions.length / sessions.length) * 100}%` }}
                />
              </div>
            </div>
            <Award className="text-blue-500" size={40} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Avg Practice Score</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {Math.round(avgPracticeScore * 100)}<span className="text-xl text-gray-500">%</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {totalCorrect} / {totalQuestions} correct
              </p>
            </div>
            <TrendingUp className="text-green-500" size={40} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Questions</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {totalQuestions}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Across {completedSessions.length} session{completedSessions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Target className="text-purple-500" size={40} />
          </div>
        </div>
      </div>

      {/* Session Progress */}
      {completedSessions.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Session Performance</h3>
          <div className="space-y-3">
            {sessions.map((session, idx) => (
              <div key={session.session_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    session.completed ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {session.completed ? <CheckCircle size={20} /> : idx + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Session {session.session_number}</p>
                    <p className="text-sm text-gray-600">{session.focus}</p>
                    <p className="text-xs text-gray-500">{session.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  {session.completed && session.score !== undefined ? (
                    <>
                      <p className="text-2xl font-bold text-gray-900">
                        {Math.round(session.score * 100)}%
                      </p>
                      <p className="text-xs text-gray-600">
                        {session.grading_results?.filter(r => r.correct).length} / {session.questions.length}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Not completed</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Baseline vs Followup Comparison */}
      {improvements && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Real Writing Improvement</h3>
          <p className="text-sm text-gray-600 mb-6">
            Comparison of your writing before and after practice sessions
          </p>
          
          <div className="space-y-4">
            {improvements.map(imp => (
              <div key={imp.category} className="border-2 border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-800">{imp.category}</span>
                  <span className={`text-lg font-bold ${
                    parseFloat(imp.improvement) > 0 ? 'text-green-600' : 
                    parseFloat(imp.improvement) < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {parseFloat(imp.improvement) > 0 ? '+' : ''}{imp.improvement}%
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Baseline</span>
                      <span>{imp.baseline.toFixed(1)}/5</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gray-400 h-2 rounded-full" 
                        style={{ width: `${(imp.baseline / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>After Practice</span>
                      <span>{imp.followup.toFixed(1)}/5</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${(imp.followup / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issue Performance */}
      {sortedIssues.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Performance by Issue Type</h3>
          <p className="text-sm text-gray-600 mb-6">
            Your accuracy on different writing issues (lowest to highest)
          </p>
          
          <div className="space-y-3">
            {sortedIssues.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{item.issue}</p>
                  <p className="text-sm text-gray-600">{item.correct}/{item.total} correct</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        item.accuracy >= 80 ? 'bg-green-500' :
                        item.accuracy >= 60 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${item.accuracy}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-12 text-right">
                    {item.accuracy.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-8 text-white">
        <h3 className="text-xl font-bold mb-4">Next Steps</h3>
        
        {completedSessions.length < sessions.length ? (
          <div>
            <p className="mb-4">
              Complete remaining practice sessions ({sessions.length - completedSessions.length} left)
            </p>
            <p className="text-sm text-blue-100">
              Spaced repetition works best when you follow the schedule consistently.
            </p>
          </div>
        ) : !followupAnalysis ? (
          <div>
            <p className="mb-4">🎉 All practice sessions completed!</p>
            <p className="mb-4">Ready to measure your real-world improvement?</p>
            <button
              onClick={onStartReEvaluation}
              className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
            >
              Start Re-Evaluation →
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-4">✅ Complete cycle finished!</p>
            <p className="text-sm text-blue-100">
              Congratulations! You've completed the full improvement cycle. Review your progress above.
            </p>
          </div>
        )}
      </div>

      {/* Download Dashboard */}
      <div className="flex justify-center">
        <button
          onClick={downloadDashboard}
          className="flex items-center space-x-2 px-6 py-3 bg-white text-gray-800 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Download size={18} />
          <span>Download Dashboard Data</span>
        </button>
      </div>
    </div>
  );
};

export default ProgressDashboard;