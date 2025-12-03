import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Award, Target, Download } from 'lucide-react';

interface PracticeSession {
  session_id: string;
  session_number: number;
  date: string;
  score?: number;
  grading_results?: any[];
  completed: boolean;
}

interface Analysis {
  summary: {
    avg_grammar_score: number;
    avg_punctuation_score: number;
    avg_tone_score: number;
  };
  top_grammar_issues: Array<{ issue: string; frequency: number }>;
  top_punctuation_issues: Array<{ issue: string; frequency: number }>;
  top_tone_issues: Array<{ issue: string; frequency: number }>;
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
  
  // Prepare session score data for line chart
  const sessionData = completedSessions.map(s => ({
    session: `Session ${s.session_number}`,
    score: s.score ? Math.round(s.score * 100) : 0,
    date: s.date
  }));

  // Prepare comparison data if we have followup
  const comparisonData = baselineAnalysis && followupAnalysis ? [
    {
      category: 'Grammar',
      baseline: baselineAnalysis.summary.avg_grammar_score,
      followup: followupAnalysis.summary.avg_grammar_score
    },
    {
      category: 'Punctuation',
      baseline: baselineAnalysis.summary.avg_punctuation_score,
      followup: followupAnalysis.summary.avg_punctuation_score
    },
    {
      category: 'Tone',
      baseline: baselineAnalysis.summary.avg_tone_score,
      followup: followupAnalysis.summary.avg_tone_score
    }
  ] : null;

  // Calculate improvements
  const improvements = comparisonData ? comparisonData.map(d => ({
    category: d.category,
    improvement: ((d.followup - d.baseline) / d.baseline * 100).toFixed(1)
  })) : null;

  const avgPracticeScore = completedSessions.length > 0
    ? completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Sessions Completed</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {completedSessions.length}<span className="text-xl text-gray-500">/3</span>
              </p>
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
            </div>
            <TrendingUp className="text-green-500" size={40} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Questions</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {completedSessions.reduce((sum, s) => sum + (s.grading_results?.length || 0), 0)}
              </p>
            </div>
            <Target className="text-purple-500" size={40} />
          </div>
        </div>
      </div>

      {/* Practice Session Scores Chart */}
      {sessionData.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Practice Session Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sessionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="session" stroke="#6b7280" />
              <YAxis domain={[0, 100]} stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 6 }}
                name="Score (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Baseline vs Followup Comparison */}
      {comparisonData && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Real Writing Improvement</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="category" stroke="#6b7280" />
              <YAxis domain={[0, 5]} stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              <Bar dataKey="baseline" fill="#94a3b8" name="Baseline" />
              <Bar dataKey="followup" fill="#3b82f6" name="After Practice" />
            </BarChart>
          </ResponsiveContainer>

          {/* Improvement Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            {improvements?.map(imp => (
              <div key={imp.category} className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 font-medium">{imp.category}</p>
                <p className={`text-2xl font-bold mt-1 ${
                  parseFloat(imp.improvement) > 0 ? 'text-green-600' : 
                  parseFloat(imp.improvement) < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {parseFloat(imp.improvement) > 0 ? '+' : ''}{imp.improvement}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issue Performance */}
      {completedSessions.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Performance by Issue</h3>
          
          {(() => {
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

            return (
              <div className="space-y-3">
                {sortedIssues.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{item.issue}</p>
                      <p className="text-sm text-gray-600">{item.correct}/{item.total} correct</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
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
            );
          })()}
        </div>
      )}

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-8 text-white">
        <h3 className="text-xl font-bold mb-4">Next Steps</h3>
        
        {completedSessions.length < 3 ? (
          <div>
            <p className="mb-4">Complete remaining practice sessions for best results!</p>
            <p className="text-sm text-blue-100">
              Spaced repetition works best when you follow the schedule.
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
              Review your progress above. Consider starting a new cycle to continue improving.
            </p>
          </div>
        )}
      </div>

      {/* Download Dashboard */}
      <div className="flex justify-center">
        <button
          onClick={() => {
            const dashboardData = {
              sessions: completedSessions,
              baseline: baselineAnalysis,
              followup: followupAnalysis,
              generated: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(dashboardData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `progress_dashboard_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
          }}
          className="flex items-center space-x-2 px-6 py-3 bg-white text-gray-800 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-medium transition-colors"
        >
          <Download size={18} />
          <span>Download Full Dashboard Data</span>
        </button>
      </div>
    </div>
  );
};

export default ProgressDashboard;