import React from 'react';
import { TrendingUp, TrendingDown, Award, Target, Download, CheckCircle, ArrowRight, Minus } from 'lucide-react';
import { 
  PracticeSession, 
  Analysis, 
  Issue, 
  ReEvaluationResult,
  PracticePerformanceSummary 
} from '../types';

interface Props {
  sessions: PracticeSession[];
  baselineAnalysis?: Analysis;
  followupAnalysis?: Analysis;
  reEvaluationResult?: ReEvaluationResult;
  onStartReEvaluation: () => void;
  onBackToPractice: () => void;
}

const ProgressDashboard: React.FC<Props> = ({ 
  sessions, 
  baselineAnalysis, 
  followupAnalysis,
  reEvaluationResult,
  onStartReEvaluation,
  onBackToPractice
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

  // Calculate issue performance from practice sessions
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

  // Check if we have comparison data
  const hasComparison = baselineAnalysis && followupAnalysis;
  const comparison = reEvaluationResult?.comparison;

  const downloadDashboard = () => {
    const dashboardData = {
      generated_at: new Date().toISOString(),
      sessions: completedSessions,
      baseline_analysis: baselineAnalysis,
      followup_analysis: followupAnalysis,
      re_evaluation_result: reEvaluationResult,
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

  // Helper component for score change indicator
  const ChangeIndicator: React.FC<{ change: number; changePercent: number }> = ({ change, changePercent }) => {
    if (Math.abs(changePercent) < 1) {
      return (
        <span className="flex items-center text-gray-500 text-sm">
          <Minus size={14} className="mr-1" />
          No change
        </span>
      );
    }
    if (change > 0) {
      return (
        <span className="flex items-center text-green-600 text-sm font-semibold">
          <TrendingUp size={14} className="mr-1" />
          +{changePercent.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="flex items-center text-red-600 text-sm font-semibold">
        <TrendingDown size={14} className="mr-1" />
        {changePercent.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">📊 Progress Dashboard</h2>
        <p className="text-gray-600">
          {hasComparison 
            ? 'Your complete writing improvement journey with before/after comparison'
            : 'Track your writing improvement journey'
          }
        </p>
      </div>

      {/* Comparison Section (if followup exists) */}
      {hasComparison && comparison && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-lg p-8 border-2 border-green-200">
          <h3 className="text-xl font-bold text-green-900 mb-6 flex items-center">
            <TrendingUp className="mr-2" size={24} />
            Writing Improvement Results
          </h3>
          
          {/* Score Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Grammar */}
            <div className="bg-white rounded-lg p-6 border border-green-200 shadow-sm">
              <p className="text-sm text-blue-600 font-medium mb-2">Grammar</p>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <span className="text-gray-400 text-sm">Baseline: </span>
                  <span className="text-gray-600 font-medium">{comparison.grammar.baseline.toFixed(1)}</span>
                </div>
                <ArrowRight className="text-gray-400" size={16} />
                <div>
                  <span className="text-gray-400 text-sm">Now: </span>
                  <span className="text-2xl font-bold text-blue-900">{comparison.grammar.followup.toFixed(1)}</span>
                  <span className="text-gray-500">/5</span>
                </div>
              </div>
              <ChangeIndicator change={comparison.grammar.change} changePercent={comparison.grammar.changePercent} />
            </div>

            {/* Punctuation */}
            <div className="bg-white rounded-lg p-6 border border-green-200 shadow-sm">
              <p className="text-sm text-green-600 font-medium mb-2">Punctuation</p>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <span className="text-gray-400 text-sm">Baseline: </span>
                  <span className="text-gray-600 font-medium">{comparison.punctuation.baseline.toFixed(1)}</span>
                </div>
                <ArrowRight className="text-gray-400" size={16} />
                <div>
                  <span className="text-gray-400 text-sm">Now: </span>
                  <span className="text-2xl font-bold text-green-900">{comparison.punctuation.followup.toFixed(1)}</span>
                  <span className="text-gray-500">/5</span>
                </div>
              </div>
              <ChangeIndicator change={comparison.punctuation.change} changePercent={comparison.punctuation.changePercent} />
            </div>

            {/* Tone */}
            <div className="bg-white rounded-lg p-6 border border-green-200 shadow-sm">
              <p className="text-sm text-purple-600 font-medium mb-2">Tone</p>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <span className="text-gray-400 text-sm">Baseline: </span>
                  <span className="text-gray-600 font-medium">{comparison.tone.baseline.toFixed(1)}</span>
                </div>
                <ArrowRight className="text-gray-400" size={16} />
                <div>
                  <span className="text-gray-400 text-sm">Now: </span>
                  <span className="text-2xl font-bold text-purple-900">{comparison.tone.followup.toFixed(1)}</span>
                  <span className="text-gray-500">/5</span>
                </div>
              </div>
              <ChangeIndicator change={comparison.tone.change} changePercent={comparison.tone.changePercent} />
            </div>
          </div>

          {/* Overall Improvement Summary */}
          {reEvaluationResult?.overallImprovement && (
            <div className="bg-white rounded-lg p-6 border-l-4 border-green-500">
              <p className="text-sm font-semibold text-gray-700 mb-2">📝 AI Assessment:</p>
              <p className="text-gray-800">{reEvaluationResult.overallImprovement}</p>
            </div>
          )}

          {/* Issue Changes */}
          {reEvaluationResult?.issueComparison && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Resolved Issues */}
              <div className="bg-green-100 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                  <CheckCircle size={16} className="mr-2" />
                  Resolved Issues ({reEvaluationResult.issueComparison.resolved.length})
                </h4>
                {reEvaluationResult.issueComparison.resolved.length > 0 ? (
                  <ul className="text-sm text-green-700 space-y-1">
                    {reEvaluationResult.issueComparison.resolved.slice(0, 3).map((issue, idx) => (
                      <li key={idx} className="truncate">✓ {issue.issue}</li>
                    ))}
                    {reEvaluationResult.issueComparison.resolved.length > 3 && (
                      <li className="text-green-600 font-medium">
                        +{reEvaluationResult.issueComparison.resolved.length - 3} more
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-green-600">Keep practicing to resolve issues!</p>
                )}
              </div>

              {/* Persistent Issues */}
              <div className="bg-yellow-100 rounded-lg p-4 border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">
                  ⚠️ Still Working On ({reEvaluationResult.issueComparison.persistent.length})
                </h4>
                {reEvaluationResult.issueComparison.persistent.length > 0 ? (
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {reEvaluationResult.issueComparison.persistent.slice(0, 3).map((issue, idx) => (
                      <li key={idx} className="truncate">• {issue.issue}</li>
                    ))}
                    {reEvaluationResult.issueComparison.persistent.length > 3 && (
                      <li className="text-yellow-600 font-medium">
                        +{reEvaluationResult.issueComparison.persistent.length - 3} more
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-yellow-600">Great! No persistent issues!</p>
                )}
              </div>

              {/* New Issues */}
              <div className="bg-red-100 rounded-lg p-4 border border-red-200">
                <h4 className="font-semibold text-red-800 mb-2">
                  🆕 New Issues ({reEvaluationResult.issueComparison.newIssues.length})
                </h4>
                {reEvaluationResult.issueComparison.newIssues.length > 0 ? (
                  <ul className="text-sm text-red-700 space-y-1">
                    {reEvaluationResult.issueComparison.newIssues.slice(0, 3).map((issue, idx) => (
                      <li key={idx} className="truncate">• {issue.issue}</li>
                    ))}
                    {reEvaluationResult.issueComparison.newIssues.length > 3 && (
                      <li className="text-red-600 font-medium">
                        +{reEvaluationResult.issueComparison.newIssues.length - 3} more
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-red-600">No new issues detected! 🎉</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Issue Performance from Practice */}
      {sortedIssues.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Practice Performance by Issue</h3>
          <p className="text-sm text-gray-600 mb-6">
            How you performed on each issue type during practice sessions
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

      {/* Baseline Scores (if no followup yet) */}
      {baselineAnalysis && !followupAnalysis && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Baseline Evaluation Scores</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-blue-600 font-medium mb-1">Grammar</p>
              <p className="text-3xl font-bold text-blue-900">
                {baselineAnalysis.summary.avg_grammar_score.toFixed(1)}
                <span className="text-lg text-gray-500">/5</span>
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-sm text-green-600 font-medium mb-1">Punctuation</p>
              <p className="text-3xl font-bold text-green-900">
                {baselineAnalysis.summary.avg_punctuation_score.toFixed(1)}
                <span className="text-lg text-gray-500">/5</span>
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <p className="text-sm text-purple-600 font-medium mb-1">Tone</p>
              <p className="text-3xl font-bold text-purple-900">
                {baselineAnalysis.summary.avg_tone_score.toFixed(1)}
                <span className="text-lg text-gray-500">/5</span>
              </p>
            </div>
          </div>
          <div className="mt-4 bg-gray-50 rounded-lg p-4 border-l-4 border-gray-400">
            <p className="text-sm text-gray-700">{baselineAnalysis.summary.overall_assessment}</p>
          </div>
        </div>
      )}

      {/* Next Steps / Actions */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-8 text-white">
        <h3 className="text-xl font-bold mb-4">
          {hasComparison ? '🎉 Journey Complete!' : 'Next Steps'}
        </h3>
        
        {completedSessions.length < sessions.length ? (
          <div>
            <p className="mb-4">
              Complete remaining practice sessions ({sessions.length - completedSessions.length} left) before re-evaluation.
            </p>
            <button
              onClick={onBackToPractice}
              className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
            >
              Continue Practice →
            </button>
          </div>
        ) : !followupAnalysis ? (
          <div>
            <p className="mb-4">🎉 All practice sessions completed!</p>
            <p className="mb-4 text-blue-100">
              Ready to measure your real-world improvement? Upload new conversations to see how much you've grown.
            </p>
            <button
              onClick={onStartReEvaluation}
              className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
            >
              Start Re-Evaluation →
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-4">
              You've completed the full writing improvement cycle! Review your progress above.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onStartReEvaluation}
                className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
              >
                Run Another Evaluation
              </button>
              <button
                onClick={onBackToPractice}
                className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-400 transition-colors"
              >
                Review Practice Sessions
              </button>
            </div>
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