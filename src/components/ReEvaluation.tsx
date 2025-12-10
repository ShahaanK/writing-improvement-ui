import React, { useState, useEffect } from 'react';
import { Upload, TrendingUp, AlertCircle, CheckCircle, Loader, Info, XCircle } from 'lucide-react';
import { 
  Analysis, 
  PracticeSession, 
  PracticePerformanceSummary,
  ChatLogMetadata 
} from '../types';
import { getChatLogMetadata } from '../utils/chatLogParser';

interface Props {
  baselineAnalysis: Analysis;
  practiceSessions: PracticeSession[];
  onRunReEvaluation: (
    file: File, 
    options: { 
      start: number; 
      end: number; 
      mode: 'incremental' | 'range';
      practicePerformance: PracticePerformanceSummary;
    }
  ) => void;
  processing: boolean;
  progress: { current: number; total: number; stage: string };
  processingSteps: string[];
}

const ReEvaluation: React.FC<Props> = ({ 
  baselineAnalysis,
  practiceSessions,
  onRunReEvaluation,
  processing,
  progress,
  processingSteps
}) => {
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFileMetadata, setNewFileMetadata] = useState<ChatLogMetadata | null>(null);
  const [evaluationMode, setEvaluationMode] = useState<'incremental' | 'range'>('incremental');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(100);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  // Extract baseline conversation range
  const baselineRange = baselineAnalysis.metadata?.conversations_range || { start: 1, end: 0 };
  const baselineEnd = baselineRange.end;

  // Calculate practice performance summary
  const calculatePracticePerformance = (): PracticePerformanceSummary => {
    const completedSessions = practiceSessions.filter(s => s.completed);
    const totalQuestions = completedSessions.reduce((sum, s) => sum + s.questions.length, 0);
    const correctAnswers = completedSessions.reduce((sum, s) => 
      sum + (s.grading_results?.filter(r => r.correct).length || 0), 0
    );

    // Calculate issue-level performance
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

    const issuePerf = Object.entries(issuePerformance).map(([issue, stats]) => ({
      issue,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      correct: stats.correct,
      total: stats.total
    }));

    return {
      total_sessions: practiceSessions.length,
      completed_sessions: completedSessions.length,
      average_score: completedSessions.length > 0 
        ? completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length 
        : 0,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      issue_performance: issuePerf,
      strengths: issuePerf.filter(i => i.accuracy >= 80).map(i => i.issue),
      weaknesses: issuePerf.filter(i => i.accuracy < 60).map(i => i.issue)
    };
  };

  const practicePerformance = calculatePracticePerformance();

  // Calculate new conversations available
  const newConversationsAvailable = newFileMetadata 
    ? Math.max(0, newFileMetadata.totalConversations - baselineEnd)
    : 0;

  // Auto-set incremental range when file is loaded
  useEffect(() => {
    if (newFileMetadata && evaluationMode === 'incremental') {
      setRangeStart(baselineEnd + 1);
      setRangeEnd(newFileMetadata.totalConversations);
    }
  }, [newFileMetadata, evaluationMode, baselineEnd]);

  const handleFileUpload = async (file: File) => {
    setNewFile(file);
    setAnalyzing(true);
    setError('');
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const metadata = getChatLogMetadata(data);
      setNewFileMetadata(metadata);
      
      // Set default range based on mode
      if (evaluationMode === 'incremental') {
        setRangeStart(baselineEnd + 1);
        setRangeEnd(metadata.totalConversations);
      } else {
        setRangeStart(1);
        setRangeEnd(metadata.totalConversations);
      }
      
    } catch (err: any) {
      console.error('Error parsing file:', err);
      setError('Error parsing file. Please ensure it\'s a valid OpenAI chat export JSON file.');
      setNewFile(null);
      setNewFileMetadata(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStartEvaluation = () => {
    if (!newFile || !newFileMetadata) return;
    
    let actualStart = rangeStart;
    let actualEnd = rangeEnd;
    
    if (evaluationMode === 'incremental') {
      // For incremental, only evaluate conversations after baseline
      actualStart = baselineEnd + 1;
      actualEnd = newFileMetadata.totalConversations;
      
      if (actualStart > actualEnd) {
        setError('No new conversations to evaluate. The file has the same or fewer conversations than baseline.');
        return;
      }
    } else {
      // For custom range, check for overlap with baseline and skip already-evaluated
      if (rangeStart <= baselineEnd && rangeEnd > baselineEnd) {
        // Partial overlap - only evaluate the new part
        actualStart = baselineEnd + 1;
        actualEnd = rangeEnd;
      } else if (rangeEnd <= baselineEnd) {
        // Fully within baseline - nothing new to evaluate
        setError(`Conversations ${rangeStart}-${rangeEnd} were already evaluated in baseline. Choose conversations after #${baselineEnd}.`);
        return;
      }
      // If rangeStart > baselineEnd, evaluate the full range (all new)
    }
    
    const conversationCount = actualEnd - actualStart + 1;
    const estimatedMessages = conversationCount * 10; // Rough estimate
    
    const proceed = window.confirm(
      `Re-evaluation Summary:\n\n` +
      `📊 Conversations to evaluate: ${actualStart} to ${actualEnd} (${conversationCount} conversations)\n` +
      `📝 Estimated messages: ~${estimatedMessages}\n` +
      `⏱️ Estimated time: ~${Math.ceil(estimatedMessages / 20)} minutes\n` +
      `💰 Estimated cost: ~$${(estimatedMessages * 0.0005).toFixed(2)}\n\n` +
      `Practice Performance:\n` +
      `✅ Sessions completed: ${practicePerformance.completed_sessions}/${practicePerformance.total_sessions}\n` +
      `📈 Average practice score: ${Math.round(practicePerformance.average_score * 100)}%\n\n` +
      `Continue?`
    );
    
    if (proceed) {
      onRunReEvaluation(newFile, { 
        start: actualStart, 
        end: actualEnd, 
        mode: evaluationMode,
        practicePerformance 
      });
    }
  };

  const baselineDate = baselineAnalysis.metadata?.evaluation_date 
    ? new Date(baselineAnalysis.metadata.evaluation_date).toLocaleDateString()
    : 'Unknown';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">📊 Re-Evaluation</h2>
        <p className="text-gray-600 mb-6">
          Measure your real writing improvement by evaluating new conversations
        </p>

        {/* Baseline Info Card */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <Info className="mr-2" size={20} />
            Baseline Reference
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-blue-700 font-medium text-xs">Conversations Evaluated</p>
              <p className="text-blue-900 font-bold text-xl">
                {baselineRange.start}-{baselineRange.end}
              </p>
              <p className="text-xs text-blue-600">({baselineRange.end - baselineRange.start + 1} total)</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-blue-700 font-medium text-xs">Evaluation Date</p>
              <p className="text-blue-900 font-bold text-lg">{baselineDate}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-blue-700 font-medium text-xs">Baseline Grammar</p>
              <p className="text-blue-900 font-bold text-xl">
                {baselineAnalysis.summary.avg_grammar_score.toFixed(1)}/5
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-blue-700 font-medium text-xs">Messages Analyzed</p>
              <p className="text-blue-900 font-bold text-xl">
                {baselineAnalysis.metadata?.messages_evaluated || baselineAnalysis.summary.total_messages}
              </p>
            </div>
          </div>
        </div>

        {/* Practice Performance Summary */}
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-green-900 mb-3 flex items-center">
            <CheckCircle className="mr-2" size={20} />
            Practice Performance (Will be included in analysis)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-green-700 font-medium text-xs">Sessions Completed</p>
              <p className="text-green-900 font-bold text-xl">
                {practicePerformance.completed_sessions}/{practicePerformance.total_sessions}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-green-700 font-medium text-xs">Average Score</p>
              <p className="text-green-900 font-bold text-xl">
                {Math.round(practicePerformance.average_score * 100)}%
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-green-700 font-medium text-xs">Questions Correct</p>
              <p className="text-green-900 font-bold text-xl">
                {practicePerformance.correct_answers}/{practicePerformance.total_questions}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-green-700 font-medium text-xs">Mastered Issues</p>
              <p className="text-green-900 font-bold text-xl">
                {practicePerformance.strengths.length}
              </p>
            </div>
          </div>
          
          {practicePerformance.weaknesses.length > 0 && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800 font-medium mb-1">⚠️ Areas still needing work:</p>
              <p className="text-sm text-yellow-900">
                {practicePerformance.weaknesses.slice(0, 3).join(', ')}
                {practicePerformance.weaknesses.length > 3 && ` +${practicePerformance.weaknesses.length - 3} more`}
              </p>
            </div>
          )}
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Upload Chat Logs for Re-Evaluation
          </label>
          
          <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            analyzing ? 'border-blue-400 bg-blue-50' : 
            newFile ? 'border-green-400 bg-green-50' :
            'border-gray-300 hover:border-gray-400'
          }`}>
            {analyzing ? (
              <div className="flex flex-col items-center">
                <Loader className="animate-spin text-blue-600 mb-3" size={40} />
                <p className="text-blue-900 font-medium">Analyzing file...</p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto mb-3 text-gray-400" size={40} />
                
                <label className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg cursor-pointer transition-colors">
                  <Upload size={18} className="mr-2" />
                  {newFile ? 'Choose Different File' : 'Choose Chat Log File'}
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                    disabled={processing}
                  />
                </label>
                
                {newFile && (
                  <div className="mt-4 text-sm text-green-600 flex items-center justify-center">
                    <CheckCircle className="mr-2" size={16} />
                    {newFile.name}
                  </div>
                )}
              </>
            )}
          </div>
          
          <p className="mt-2 text-xs text-gray-500">
            Upload the same file with more conversations, or a new export
          </p>
        </div>

        {/* File Analysis Results */}
        {newFileMetadata && !analyzing && (
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-purple-900 mb-3">📁 File Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="text-purple-700 font-medium text-xs">Total Conversations</p>
                <p className="text-purple-900 font-bold text-2xl">{newFileMetadata.totalConversations}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="text-purple-700 font-medium text-xs">New Conversations</p>
                <p className={`font-bold text-2xl ${
                  newConversationsAvailable > 0 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {newConversationsAvailable}
                  {newConversationsAvailable === 0 && ' ⚠️'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="text-purple-700 font-medium text-xs">Already Evaluated</p>
                <p className="text-gray-600 font-bold text-2xl">
                  1-{Math.min(baselineEnd, newFileMetadata.totalConversations)}
                </p>
              </div>
            </div>
            
            {newConversationsAvailable === 0 && (
              <div className="mt-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3 flex items-start">
                <AlertCircle className="text-yellow-600 mr-2 flex-shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-yellow-800">
                  No new conversations found beyond baseline. You can still use Custom Range to re-evaluate 
                  specific conversations, but for measuring improvement, add more conversations to your export.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Evaluation Mode Selection */}
        {newFileMetadata && !analyzing && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Evaluation Mode
            </label>
            
            <div className="space-y-3">
              {/* Incremental Mode */}
              <label className={`flex items-start p-5 border-2 rounded-lg cursor-pointer transition-all ${
                evaluationMode === 'incremental' 
                  ? 'border-blue-500 bg-blue-50 shadow-md' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${newConversationsAvailable === 0 ? 'opacity-50' : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  value="incremental"
                  checked={evaluationMode === 'incremental'}
                  onChange={() => setEvaluationMode('incremental')}
                  disabled={newConversationsAvailable === 0}
                  className="mt-1 mr-4"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 mb-1 flex items-center">
                    🎯 Incremental (Recommended)
                    {newConversationsAvailable === 0 && (
                      <span className="ml-2 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        No new conversations
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    Evaluate only conversations #{baselineEnd + 1} onwards (new since baseline)
                  </p>
                  {newConversationsAvailable > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        📊 {newConversationsAvailable} conversations
                      </span>
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        ⏱️ ~{Math.ceil(newConversationsAvailable * 10 / 20)} min
                      </span>
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                        ✓ Best for measuring improvement
                      </span>
                    </div>
                  )}
                </div>
              </label>

              {/* Custom Range Mode */}
              <label className={`flex items-start p-5 border-2 rounded-lg cursor-pointer transition-all ${
                evaluationMode === 'range' 
                  ? 'border-blue-500 bg-blue-50 shadow-md' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="mode"
                  value="range"
                  checked={evaluationMode === 'range'}
                  onChange={() => setEvaluationMode('range')}
                  className="mt-1 mr-4"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 mb-1">
                    📐 Custom Range
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Choose specific conversation range to evaluate
                  </p>
                  
                  {evaluationMode === 'range' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1 font-medium">
                            From Conversation:
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={newFileMetadata.totalConversations}
                            value={rangeStart}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setRangeStart(Math.max(1, Math.min(val, rangeEnd)));
                            }}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1 font-medium">
                            To Conversation:
                          </label>
                          <input
                            type="number"
                            min={rangeStart}
                            max={newFileMetadata.totalConversations}
                            value={rangeEnd}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || rangeEnd;
                              setRangeEnd(Math.max(rangeStart, Math.min(val, newFileMetadata.totalConversations)));
                            }}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                      
                      {/* Smart overlap detection */}
                      {rangeStart <= baselineEnd && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs">
                          <p className="text-yellow-800">
                            <strong>⚠️ Overlap detected:</strong> Conversations {rangeStart}-{Math.min(rangeEnd, baselineEnd)} were 
                            already evaluated. System will automatically skip these and only evaluate 
                            {rangeEnd > baselineEnd ? ` conversations ${baselineEnd + 1}-${rangeEnd}` : ' (nothing new in this range)'}.
                          </p>
                        </div>
                      )}
                      
                      <div className="bg-blue-100 rounded-lg p-3">
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className="text-blue-800">
                            📊 <strong>{rangeEnd - rangeStart + 1}</strong> conversations selected
                          </span>
                          <span className="text-blue-800">
                            ⏱️ ~{Math.ceil((rangeEnd - rangeStart + 1) * 10 / 20)} min
                          </span>
                          <span className="text-blue-800">
                            💵 ~${((rangeEnd - rangeStart + 1) * 10 * 0.0005).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start">
            <XCircle className="text-red-600 mr-3 flex-shrink-0" size={20} />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Start Button */}
        {newFileMetadata && !analyzing && !processing && (
          <button
            onClick={handleStartEvaluation}
            disabled={evaluationMode === 'incremental' && newConversationsAvailable === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <TrendingUp size={20} />
            <span>
              {evaluationMode === 'incremental' 
                ? `Evaluate ${newConversationsAvailable} New Conversations`
                : `Evaluate Conversations ${rangeStart}-${rangeEnd}`
              }
            </span>
          </button>
        )}

        {/* Processing Progress */}
        {processing && (
          <div className="mt-6 bg-blue-50 rounded-lg p-6 border border-blue-200">
            <div className="flex justify-between mb-4">
              <span className="font-medium text-blue-900">{progress.stage}</span>
              <span className="text-blue-700 font-semibold">{progress.current}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3 mb-4">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all" 
                style={{ width: `${progress.current}%` }} 
              />
            </div>
            
            {/* Processing Steps Log */}
            <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto border border-blue-200">
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                <Loader className="animate-spin mr-2" size={16} />
                Re-evaluation Progress:
              </h4>
              <div className="space-y-1 text-sm font-mono">
                {processingSteps.map((step, idx) => (
                  <div 
                    key={idx} 
                    className={`${
                      step.startsWith('✓') ? 'text-green-600' :
                      step.startsWith('❌') ? 'text-red-600' :
                      step.startsWith('🔄') || step.startsWith('📊') || step.startsWith('🎯') ? 'text-blue-700 font-semibold' :
                      step.startsWith('  ') ? 'text-gray-600 pl-4' :
                      'text-gray-700'
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
          <Info className="mr-2 text-blue-600" size={20} />
          How Re-Evaluation Works
        </h3>
        <div className="space-y-4">
          <div className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">1</span>
            <div>
              <p className="font-medium text-gray-800">Smart Deduplication</p>
              <p className="text-sm text-gray-600">
                System tracks which conversations were already evaluated (#{baselineRange.start}-{baselineRange.end}) 
                and automatically skips them to save time and money.
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
            <div>
              <p className="font-medium text-gray-800">Practice Performance Integration</p>
              <p className="text-sm text-gray-600">
                Your practice session results are factored into the analysis to show correlation 
                between practice and real writing improvement.
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">3</span>
            <div>
              <p className="font-medium text-gray-800">Comparative Analysis</p>
              <p className="text-sm text-gray-600">
                New writing is evaluated using the same criteria as baseline, then compared 
                to identify resolved issues, persistent problems, and new patterns.
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">4</span>
            <div>
              <p className="font-medium text-gray-800">Improvement Report</p>
              <p className="text-sm text-gray-600">
                Dashboard shows side-by-side comparison of baseline vs. followup scores, 
                highlighting areas of improvement and remaining focus areas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReEvaluation;