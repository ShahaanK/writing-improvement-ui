import React, { useState } from 'react';
import { FileText, Download, Upload, AlertCircle, CheckCircle, Loader, XCircle, Info, ChevronRight } from 'lucide-react';
import { AnthropicAPI, PracticeQuestion, GradingResult, Issue, Analysis, Message } from './utils/anthropicApi';
import { parseChatLogs, filterMessagesHeuristic, ParsedMessage, getChatLogMetadata, ChatLogMetadata, getConversationRangeStats } from './utils/chatLogParser';
import { PracticeSession, ViewType } from './types';
import PracticeSessionComponent from './components/PracticeSession';

// Progress Stepper Component
const ProgressStepper: React.FC<{
  currentView: ViewType;
  completedSteps: ViewType[];
  onNavigate: (view: ViewType) => void;
}> = ({ currentView, completedSteps, onNavigate }) => {
  const steps: Array<{ id: ViewType; label: string; order: number }> = [
    { id: 'setup', label: 'Setup', order: 1 },
    { id: 'evaluation', label: 'Evaluation', order: 2 },
    { id: 'practice', label: 'Practice', order: 3 },
    { id: 'dashboard', label: 'Dashboard', order: 4 },
    { id: 'reevaluation', label: 'Re-evaluation', order: 5 },
  ];

  const currentOrder = steps.find(s => s.id === currentView)?.order || 1;

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = step.id === currentView;
            const isAccessible = isCompleted || step.order <= currentOrder;
            
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => isAccessible && onNavigate(step.id)}
                  disabled={!isAccessible}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                    isCurrent 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : isCompleted
                      ? 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer'
                      : isAccessible
                      ? 'bg-gray-50 text-gray-700 hover:bg-gray-100 cursor-pointer'
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    isCurrent 
                      ? 'bg-white text-blue-600' 
                      : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {isCompleted ? '✓' : step.order}
                  </div>
                  <span className="font-medium text-sm">{step.label}</span>
                </button>
                {idx < steps.length - 1 && (
                  <ChevronRight className="text-gray-400" size={20} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [apiKey, setApiKey] = useState('');
  const [api, setApi] = useState<AnthropicAPI | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('setup');
  const [completedSteps, setCompletedSteps] = useState<ViewType[]>([]);
  const [baselineAnalysis, setBaselineAnalysis] = useState<Analysis | null>(null);
  const [practiceSessions, setPracticeSessions] = useState<PracticeSession[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 100, stage: '' });
  const [error, setError] = useState('');
  
  // NEW: File metadata and range selection
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileMetadata, setFileMetadata] = useState<ChatLogMetadata | null>(null);
  const [conversationRange, setConversationRange] = useState({ start: 1, end: 100 });
  const [showRangeSelector, setShowRangeSelector] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);

  // Helper function to mark a step as completed
  const markStepCompleted = (step: ViewType) => {
    setCompletedSteps(prev => {
      if (!prev.includes(step)) {
        return [...prev, step];
      }
      return prev;
    });
  };

  // Navigation handler
  const handleNavigate = (view: ViewType) => {
    // Validation before navigation
    if (view === 'evaluation' && !baselineAnalysis) {
      alert('Please complete the evaluation first');
      return;
    }
    if (view === 'practice' && practiceSessions.length === 0) {
      alert('Please generate practice sessions first');
      return;
    }
    setCurrentView(view);
  };

  // ADDED: Missing helper functions
  const updateSession = (sessionId: string, answers: { [key: string]: string }) => {
    setPracticeSessions(prev => 
      prev.map(session => 
        session.session_id === sessionId 
          ? { ...session, user_answers: answers }
          : session
      )
    );
  };

  const gradeSession = (sessionId: string, results: GradingResult[], score: number) => {
    setPracticeSessions(prev =>
      prev.map(session =>
        session.session_id === sessionId
          ? { ...session, grading_results: results, score, completed: true }
          : session
      )
    );
  };

  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    // Validate API key format
    if (!apiKey.startsWith('sk-ant-api03-')) {
      setError('Invalid API key format. Anthropic API keys should start with "sk-ant-api03-"');
      return;
    }

    setValidatingKey(true);
    setError('');

    try {
      const testApi = new AnthropicAPI(apiKey.trim());
      const isValid = await testApi.testConnection();
      
      if (isValid) {
        setApi(testApi);
        setError('');
      } else {
        setError('Connection test failed. Please check your API key and try again.');
      }
    } catch (err: any) {
      console.error('API validation error:', err);
      setError(`API connection failed: ${err.message}`);
    } finally {
      setValidatingKey(false);
    }
  };

  // NEW: Handle file upload and show metadata
  const handleFileUpload = async (file: File) => {
    try {
      setProcessingSteps(['📂 Reading file...']);
      setUploadedFile(file);
      setError('');
      
      const text = await file.text();
      const data = JSON.parse(text);
      
      setProcessingSteps(prev => [...prev, '📊 Analyzing chat log structure...']);
      const metadata = getChatLogMetadata(data);
      setFileMetadata(metadata);
      
      // Set default range to all conversations
      setConversationRange({ start: 1, end: metadata.totalConversations });
      setShowRangeSelector(true);
      
      setProcessingSteps(prev => [
        ...prev, 
        `✓ Found ${metadata.totalConversations} conversations`,
        `✓ Estimated ${metadata.estimatedMessages} total messages`,
        `✓ Date range: ${metadata.dateRange.earliest?.toLocaleDateString()} to ${metadata.dateRange.latest?.toLocaleDateString()}`
      ]);
      
    } catch (err: any) {
      setError('Error reading file. Please ensure it\'s a valid OpenAI chat export JSON.');
      setFileMetadata(null);
      setShowRangeSelector(false);
    }
  };

  const handleEvaluation = async () => {
    if (!api || !uploadedFile || !fileMetadata) {
      setError('Please validate API key and upload a file first');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      setProcessingSteps([]);
      
      const text = await uploadedFile.text();
      const data = JSON.parse(text);
      
      // Step 1: Parse with range selection
      setProgress({ current: 10, total: 100, stage: 'Parsing chat logs...' });
      setProcessingSteps(['📖 Step 1: Parsing chat logs...']);
      
      const parsedMessages: ParsedMessage[] = parseChatLogs(
        data,
        {
          startConversation: conversationRange.start,
          endConversation: conversationRange.end
        },
        (status, current, total) => {
          setProcessingSteps(prev => [...prev.slice(0, -1), `  ${status}`]);
        }
      );
      
      setProcessingSteps(prev => [...prev, `✓ Parsed ${parsedMessages.length} total messages`]);
      
      // Step 2: Filter for writing-related content
      setProgress({ current: 20, total: 100, stage: 'Filtering for writing content...' });
      setProcessingSteps(prev => [...prev, '🔍 Step 2: Filtering for writing-related messages...']);
      
      const filtered = filterMessagesHeuristic(
        parsedMessages,
        (status, current, total) => {
          setProcessingSteps(prev => [...prev.slice(0, -1), `  ${status}`]);
        }
      );
      
      // Limit to 20 for demo/cost efficiency
      const limitedFiltered = filtered.slice(0, 20);
      
      if (limitedFiltered.length === 0) {
        throw new Error('No writing-related messages found in selected range');
      }
      
      setProcessingSteps(prev => [
        ...prev, 
        `✓ Found ${filtered.length} writing messages`,
        `📊 Using ${limitedFiltered.length} messages for Stage 2 confirmation`
      ]);
      
      // Step 3: Stage 2 - LLM Confirmation
      setProgress({ current: 30, total: 100, stage: 'LLM confirmation of relevance...' });
      setProcessingSteps(prev => [...prev, '🤖 Step 3: LLM confirmation filtering...']);
      
      const confirmed = await api.filterRelevantMessagesLLM(
        limitedFiltered.map(msg => ({ id: msg.id, text: msg.text })),
        10, // batch size
        (status) => {
          setProgress(prev => ({ ...prev, stage: status }));
          setProcessingSteps(prev => {
            // If it's a rate limit message, add it as a new step
            if (status.includes('⏸️')) {
              return [...prev, `  ${status}`];
            }
            // Otherwise update the last step
            return [...prev.slice(0, -1), `  ${status}`];
          });
        }
      );
      
      if (confirmed.length === 0) {
        throw new Error('No messages confirmed as writing-related by LLM');
      }
      
      setProcessingSteps(prev => [
        ...prev,
        `✓ Confirmed ${confirmed.length}/${limitedFiltered.length} messages as writing-related`,
        `📊 Proceeding with ${confirmed.length} messages for evaluation`
      ]);
      
      // Step 4: AI Evaluation
      setProgress({ current: 50, total: 100, stage: 'AI evaluation in progress...' });
      setProcessingSteps(prev => [...prev, '📝 Step 4: AI evaluation of writing quality...']);
      
      const evaluations = await api.evaluateBatch(confirmed, (status) => {
        setProgress(prev => ({ ...prev, stage: status }));
        setProcessingSteps(prev => [...prev.slice(0, -1), `  ${status}`]);
      });
      
      setProcessingSteps(prev => [...prev, `✓ Completed evaluation of ${evaluations.length} messages`]);
      
      // Step 5: Pattern Analysis
      setProgress({ current: 80, total: 100, stage: 'Analyzing patterns...' });
      setProcessingSteps(prev => [...prev, '📈 Step 5: Analyzing patterns and identifying issues...']);
      
      const analysis = await api.analyzePatterns(evaluations, (status) => {
        setProcessingSteps(prev => [...prev.slice(0, -1), `  ${status}`]);
      });
      
      setProcessingSteps(prev => [
        ...prev,
        `✓ Identified top issues in grammar, punctuation, and tone`,
        '🎉 Analysis complete!'
      ]);
      
      setProgress({ current: 100, total: 100, stage: 'Complete!' });
      setBaselineAnalysis(analysis);
      
      // Mark evaluation as completed
      markStepCompleted('setup');
      markStepCompleted('evaluation');
      
      setTimeout(() => {
        setProcessing(false);
        setCurrentView('evaluation');
      }, 1500);
      
    } catch (err: any) {
      setError(err.message);
      setProcessing(false);
      setProcessingSteps(prev => [...prev, `❌ Error: ${err.message}`]);
    }
  };

  const generatePracticeSessions = async () => {
    if (!api || !baselineAnalysis) return;
    
    setProcessing(true);
    setProcessingSteps([]);
    setProgress({ current: 0, total: 100, stage: 'Generating practice sessions...' });
    
    try {
      // Step 1: Collect all issues
      setProcessingSteps(['🎯 Step 1: Analyzing evaluation findings...']);
      
      const allIssues = [
        ...baselineAnalysis.top_grammar_issues.map(i => ({ ...i, type: 'grammar' })),
        ...baselineAnalysis.top_punctuation_issues.map(i => ({ ...i, type: 'punctuation' })),
        ...baselineAnalysis.top_tone_issues.map(i => ({ ...i, type: 'tone' }))
      ].sort((a, b) => b.frequency - a.frequency);

      setProcessingSteps(prev => [
        ...prev,
        `✓ Found ${allIssues.length} total issues to address`,
        `  • Grammar: ${baselineAnalysis.top_grammar_issues.length} issues`,
        `  • Punctuation: ${baselineAnalysis.top_punctuation_issues.length} issues`,
        `  • Tone: ${baselineAnalysis.top_tone_issues.length} issues`
      ]);

      const sessions: PracticeSession[] = [];
      const today = new Date();

      // Step 2: Generate each session
      for (let i = 1; i <= 3; i++) {
        setProgress({ current: 10 + (i * 25), total: 100, stage: `Generating session ${i}...` });
        setProcessingSteps(prev => [...prev, `\n📝 Step ${i + 1}: Generating Session ${i} questions...`]);
        
        const questions = await api.generatePracticeQuestions(allIssues, i);
        
        setProcessingSteps(prev => [
          ...prev,
          `  ✓ Created ${questions.length} questions for Session ${i}`,
          `  • Focus: ${i === 1 ? 'Initial Learning' : i === 2 ? 'Consolidation' : 'Retention Test'}`,
          `  • Scheduled: ${new Date(today.getTime() + (i * 2) * 86400000).toLocaleDateString()}`
        ]);
        
        sessions.push({
          session_id: `session_${i}`,
          session_number: i,
          date: new Date(today.getTime() + (i * 2) * 86400000).toISOString().split('T')[0],
          focus: i === 1 ? 'Initial Learning' : i === 2 ? 'Consolidation' : 'Retention Test',
          questions,
          user_answers: {},
          completed: false
        });
      }
      
      setProcessingSteps(prev => [
        ...prev,
        '\n🎉 Practice plan generation complete!',
        `✓ ${sessions.length} sessions ready`,
        `✓ ${sessions.reduce((sum, s) => sum + s.questions.length, 0)} total practice questions`
      ]);
      
      setPracticeSessions(sessions);
      setProgress({ current: 100, total: 100, stage: 'Complete!' });
      
      // Mark practice step as accessible
      markStepCompleted('practice');
      
      setTimeout(() => {
        setProcessing(false);
        setCurrentView('practice');
      }, 1500);
      
    } catch (err: any) {
      setError(err.message);
      setProcessing(false);
      setProcessingSteps(prev => [...prev, `❌ Error: ${err.message}`]);
    }
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
          <div className="flex items-center space-x-3">
            <FileText className="text-blue-600" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Writing Improvement System</h1>
              <p className="text-sm text-gray-600">AI-powered analysis with real Anthropic Claude API</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Stepper */}
      {currentView !== 'setup' && (
        <ProgressStepper
          currentView={currentView}
          completedSteps={completedSteps}
          onNavigate={handleNavigate}
        />
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Setup View */}
        {currentView === 'setup' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Get Started</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anthropic API Key
              </label>
              <div className="flex space-x-3">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={!!api}
                />
                {!api ? (
                  <button
                    onClick={validateApiKey}
                    disabled={validatingKey || !apiKey}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg"
                  >
                    {validatingKey ? <Loader className="animate-spin" size={20} /> : 'Validate'}
                  </button>
                ) : (
                  <div className="flex items-center px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="text-green-600 mr-2" size={20} />
                    <span className="text-green-700 font-medium">Valid</span>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.anthropic.com</a>
              </p>
              <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>🔒 Security Note:</strong> Your API key is only stored in your browser and used for direct API calls. 
                  Never share your API key or use it in production applications visible to untrusted users.
                </p>
              </div>
            </div>

            {api && (
              <>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                  <h3 className="text-lg font-semibold mb-2">Upload Chat Logs</h3>
                  <p className="text-gray-600 mb-4">OpenAI chat export (JSON format)</p>
                  
                  <label className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg cursor-pointer">
                    <Upload size={18} className="mr-2" />
                    Choose File
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} 
                    />
                  </label>
                  
                  {uploadedFile && (
                    <p className="mt-3 text-sm text-green-600 flex items-center justify-center">
                      <CheckCircle size={16} className="mr-2" />
                      {uploadedFile.name}
                    </p>
                  )}
                </div>

                {/* File Metadata Display */}
                {fileMetadata && showRangeSelector && (
                  <div className="mt-6 bg-white border-2 border-blue-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <Info className="text-blue-600 mr-2" size={24} />
                      <h3 className="text-lg font-bold text-gray-800">Chat Log Summary</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-blue-600 font-medium">Total Conversations</p>
                        <p className="text-3xl font-bold text-blue-900">{fileMetadata.totalConversations}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm text-green-600 font-medium">Estimated Messages</p>
                        <p className="text-3xl font-bold text-green-900">~{fileMetadata.estimatedMessages}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <p className="text-sm text-purple-600 font-medium">Date Range</p>
                        <p className="text-sm font-semibold text-purple-900">
                          {fileMetadata.dateRange.earliest?.toLocaleDateString()} <br />
                          to {fileMetadata.dateRange.latest?.toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Conversation Range Selector */}
                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Select Conversation Range to Analyze
                      </label>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Start Conversation</label>
                          <input
                            type="number"
                            min={1}
                            max={fileMetadata.totalConversations}
                            value={conversationRange.start}
                            onChange={(e) => setConversationRange(prev => ({
                              ...prev,
                              start: Math.max(1, Math.min(parseInt(e.target.value) || 1, prev.end))
                            }))}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">End Conversation</label>
                          <input
                            type="number"
                            min={conversationRange.start}
                            max={fileMetadata.totalConversations}
                            value={conversationRange.end}
                            onChange={(e) => setConversationRange(prev => ({
                              ...prev,
                              end: Math.max(prev.start, Math.min(parseInt(e.target.value) || prev.end, fileMetadata.totalConversations))
                            }))}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                        <strong>Selected:</strong> {conversationRange.end - conversationRange.start + 1} conversations 
                        (#{conversationRange.start} to #{conversationRange.end})
                      </div>

                      <button
                        onClick={handleEvaluation}
                        disabled={processing}
                        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors"
                      >
                        {processing ? 'Analyzing...' : 'Start Analysis →'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {processing && (
              <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
                <div className="flex justify-between mb-4">
                  <span className="font-medium text-blue-900">{progress.stage}</span>
                  <span className="text-blue-700 font-semibold">{progress.current}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3 mb-4">
                  <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${progress.current}%` }} />
                </div>
                
                {/* Processing Steps Log */}
                <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto border border-blue-200">
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                    <Loader className="animate-spin mr-2" size={16} />
                    Processing Steps:
                  </h4>
                  <div className="space-y-1 text-sm font-mono">
                    {processingSteps.map((step, idx) => (
                      <div 
                        key={idx} 
                        className={`${
                          step.startsWith('✓') ? 'text-green-600' :
                          step.startsWith('❌') ? 'text-red-600' :
                          step.startsWith('🤖') || step.startsWith('📈') || step.startsWith('🔍') || step.startsWith('📖') ? 'text-blue-700 font-semibold' :
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

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="text-red-600 mr-3" size={20} />
                <p className="text-red-800">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Evaluation View */}
        {currentView === 'evaluation' && baselineAnalysis && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">📊 Writing Evaluation Report</h2>

            {/* FIXED: Overall Summary Box at the TOP */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
              <h3 className="text-xl font-bold text-blue-900 mb-4">Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white rounded-lg p-4 text-center border border-blue-100">
                  <p className="text-sm text-gray-600 font-medium mb-1">Messages Analyzed</p>
                  <p className="text-3xl font-bold text-gray-900">{baselineAnalysis.summary.total_messages}</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center border border-blue-100">
                  <p className="text-sm text-blue-600 font-medium mb-1">Grammar</p>
                  <p className="text-3xl font-bold text-blue-900">
                    {baselineAnalysis.summary.avg_grammar_score.toFixed(1)}
                    <span className="text-lg text-gray-500 font-normal">/5</span>
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center border border-blue-100">
                  <p className="text-sm text-green-600 font-medium mb-1">Punctuation</p>
                  <p className="text-3xl font-bold text-green-900">
                    {baselineAnalysis.summary.avg_punctuation_score.toFixed(1)}
                    <span className="text-lg text-gray-500 font-normal">/5</span>
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center border border-blue-100">
                  <p className="text-sm text-purple-600 font-medium mb-1">Tone</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {baselineAnalysis.summary.avg_tone_score.toFixed(1)}
                    <span className="text-lg text-gray-500 font-normal">/5</span>
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
                <p className="text-sm font-semibold text-gray-700 mb-1">Overall Assessment:</p>
                <p className="text-gray-800">{baselineAnalysis.summary.overall_assessment}</p>
              </div>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <ScoreCard label="Grammar" score={baselineAnalysis.summary.avg_grammar_score} colorClass="bg-blue-500" />
              <ScoreCard label="Punctuation" score={baselineAnalysis.summary.avg_punctuation_score} colorClass="bg-green-500" />
              <ScoreCard label="Tone" score={baselineAnalysis.summary.avg_tone_score} colorClass="bg-purple-500" />
            </div>

            {/* Issues Sections */}
            {(['grammar', 'punctuation', 'tone'] as const).map(cat => {
              const issues = (baselineAnalysis as any)[`top_${cat}_issues`] as Issue[];
              
              const colorMap: Record<'grammar' | 'punctuation' | 'tone', {
                bg: string;
                border: string;
                title: string;
                badge: string;
              }> = {
                grammar: { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-900', badge: 'bg-blue-100 text-blue-700' },
                punctuation: { bg: 'bg-green-50', border: 'border-green-200', title: 'text-green-900', badge: 'bg-green-100 text-green-700' },
                tone: { bg: 'bg-purple-50', border: 'border-purple-200', title: 'text-purple-900', badge: 'bg-purple-100 text-purple-700' }
              };
              
              const colors = colorMap[cat];

              return (
                <div key={cat} className={`mb-6 border-2 ${colors.border} rounded-lg p-6 ${colors.bg}`}>
                  <h3 className={`text-xl font-bold mb-4 capitalize ${colors.title} flex items-center`}>
                    {cat === 'grammar' && '📝 '}
                    {cat === 'punctuation' && '✏️ '}
                    {cat === 'tone' && '🎯 '}
                    Top {cat} Issues
                    <span className={`ml-3 text-sm px-3 py-1 rounded-full ${colors.badge}`}>
                      {issues.length} issue{issues.length !== 1 ? 's' : ''} found
                    </span>
                  </h3>
                  
                  {issues.length === 0 ? (
                    <div className="bg-white rounded-lg p-4 text-center text-gray-500">
                      ✓ No significant {cat} issues detected
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {issues.map((issue: Issue, idx: number) => (
                        <div key={idx} className="bg-white rounded-lg p-4 border-l-4 border-gray-300 hover:border-gray-400 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-gray-800">
                              {idx + 1}. {issue.issue}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded font-semibold ${
                              issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                              issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {issue.severity.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center text-sm text-gray-600 mb-2">
                            <span className="font-medium">Frequency:</span>
                            <span className="ml-2">{issue.frequency} occurrence{issue.frequency !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <p className="text-sm text-gray-700">
                              <span className="font-semibold text-gray-800">💡 Recommendation:</span> {issue.recommendation}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex gap-4">
              <button
                onClick={generatePracticeSessions}
                disabled={processing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 rounded-lg transition-colors"
              >
                {processing ? 'Generating...' : 'Generate Practice Plan →'}
              </button>
              
              {practiceSessions.length > 0 && (
                <button
                  onClick={() => setCurrentView('practice')}
                  className="px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Continue Practice →
                </button>
              )}
            </div>

            {/* Progress display for generating sessions */}
            {processing && processingSteps.length > 0 && (
              <div className="mt-6 bg-blue-50 rounded-lg p-6 border border-blue-200">
                <div className="flex justify-between mb-4">
                  <span className="font-medium text-blue-900">{progress.stage}</span>
                  <span className="text-blue-700 font-semibold">{progress.current}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3 mb-4">
                  <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${progress.current}%` }} />
                </div>
                
                {/* Processing Steps Log */}
                <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto border border-blue-200">
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                    <Loader className="animate-spin mr-2" size={16} />
                    Generation Progress:
                  </h4>
                  <div className="space-y-1 text-sm font-mono">
                    {processingSteps.map((step, idx) => (
                      <div 
                        key={idx} 
                        className={`${
                          step.startsWith('✓') ? 'text-green-600' :
                          step.startsWith('❌') ? 'text-red-600' :
                          step.startsWith('🎯') || step.startsWith('📝') || step.startsWith('🎉') ? 'text-blue-700 font-semibold' :
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
        )}

        {/* Practice View */}
        {currentView === 'practice' && practiceSessions.length > 0 && api && (
          <PracticeSessionComponent
            sessions={practiceSessions}
            onUpdateSession={updateSession}
            onGradeSession={gradeSession}
            api={api}
            onViewDashboard={() => {
              markStepCompleted('dashboard');
              setCurrentView('dashboard');
            }}
          />
        )}

        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">📊 Progress Dashboard</h2>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-200">
                <p className="text-sm text-blue-600 font-medium mb-2">Sessions Completed</p>
                <p className="text-4xl font-bold text-blue-900">
                  {practiceSessions.filter(s => s.completed).length}
                  <span className="text-xl text-gray-500">/{practiceSessions.length}</span>
                </p>
                <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all" 
                    style={{ width: `${(practiceSessions.filter(s => s.completed).length / practiceSessions.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-6 border-2 border-green-200">
                <p className="text-sm text-green-600 font-medium mb-2">Average Score</p>
                <p className="text-4xl font-bold text-green-900">
                  {practiceSessions.filter(s => s.completed).length > 0
                    ? Math.round((practiceSessions.filter(s => s.completed).reduce((sum, s) => sum + (s.score || 0), 0) / practiceSessions.filter(s => s.completed).length) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-green-700 mt-2">
                  Across {practiceSessions.filter(s => s.completed).length} completed session(s)
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-6 border-2 border-purple-200">
                <p className="text-sm text-purple-600 font-medium mb-2">Total Questions</p>
                <p className="text-4xl font-bold text-purple-900">
                  {practiceSessions.reduce((sum, s) => sum + s.questions.length, 0)}
                </p>
                <p className="text-xs text-purple-700 mt-2">
                  {practiceSessions.filter(s => s.completed).reduce((sum, s) => sum + (s.grading_results?.filter(r => r.correct).length || 0), 0)} answered correctly
                </p>
              </div>
            </div>

            {/* Session Progress List */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Session Progress</h3>
              <div className="space-y-3">
                {practiceSessions.map((session, idx) => (
                  <div key={session.session_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        session.completed ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {session.completed ? '✓' : idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">Session {session.session_number}: {session.focus}</p>
                        <p className="text-xs text-gray-600">{session.date}</p>
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

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setCurrentView('practice')}
                className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Back to Practice Sessions
              </button>
              
              <button
                onClick={() => {
                  markStepCompleted('reevaluation');
                  setCurrentView('reevaluation');
                }}
                className="flex-1 px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              >
                Start Re-evaluation →
              </button>
            </div>
          </div>
        )}

        {/* Re-evaluation View */}
        {currentView === 'reevaluation' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">🔄 Re-evaluation</h2>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
              <p className="text-blue-900 mb-4">
                Re-evaluation allows you to measure your writing improvement by analyzing new chat conversations since your baseline evaluation.
              </p>
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> This feature requires uploading an updated chat export file. The system will analyze only new conversations to measure improvement.
              </p>
            </div>
            
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-yellow-900 mb-2">🚧 Coming Soon</h3>
              <p className="text-sm text-yellow-800">
                Re-evaluation functionality is currently under development. For now, you can review your practice session progress in the Dashboard.
              </p>
            </div>

            <button
              onClick={() => setCurrentView('dashboard')}
              className="w-full px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;