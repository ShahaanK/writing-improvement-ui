import React, { useState } from 'react';
import { Upload, TrendingUp, AlertCircle, CheckCircle, Loader, Info } from 'lucide-react';

interface Props {
  baselineConversations: number;
  baselineTimestamp: number;
  onRunReEvaluation: (file: File, options: { start?: number; end?: number; mode: 'incremental' | 'range' }) => void;
}

const ReEvaluation: React.FC<Props> = ({ 
  baselineConversations, 
  baselineTimestamp, 
  onRunReEvaluation 
}) => {
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFileMetadata, setNewFileMetadata] = useState<{
    totalConversations: number;
    newConversations: number;
    estimatedMessages: number;
  } | null>(null);
  const [evaluationMode, setEvaluationMode] = useState<'incremental' | 'range'>('incremental');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(100);
  const [analyzing, setAnalyzing] = useState(false);

  const handleFileUpload = async (file: File) => {
    setNewFile(file);
    setAnalyzing(true);
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const logs = Array.isArray(data) ? data : [];
      
      // Count messages in new conversations
      let newConvCount = 0;
      let estimatedMessages = 0;
      
      if (logs.length > baselineConversations) {
        const newConvs = logs.slice(baselineConversations);
        newConvCount = newConvs.length;
        
        // Estimate messages per conversation
        const sampleSize = Math.min(5, newConvs.length);
        const sample = newConvs.slice(0, sampleSize);
        
        sample.forEach(conv => {
          const mapping = conv.mapping || {};
          Object.values(mapping).forEach((node: any) => {
            if (node.message?.author?.role === 'user') {
              estimatedMessages++;
            }
          });
        });
        
        estimatedMessages = Math.round((estimatedMessages / sampleSize) * newConvCount);
      }
      
      setNewFileMetadata({
        totalConversations: logs.length,
        newConversations: newConvCount,
        estimatedMessages: estimatedMessages
      });
      
      setRangeEnd(logs.length);
      
    } catch (err) {
      console.error('Error parsing file:', err);
      alert('Error parsing file. Please ensure it\'s a valid OpenAI chat export JSON file.');
      setNewFile(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStartEvaluation = () => {
    if (!newFile) return;
    
    if (evaluationMode === 'incremental') {
      if (newFileMetadata && newFileMetadata.newConversations === 0) {
        alert('No new conversations found. Try using custom range mode instead.');
        return;
      }
      
      const proceed = window.confirm(
        `This will evaluate ${newFileMetadata?.newConversations} new conversations (approximately ${newFileMetadata?.estimatedMessages} messages).\n\n` +
        `Estimated time: ~${Math.ceil((newFileMetadata?.estimatedMessages || 0) / 20)} minutes\n` +
        `Estimated cost: ~$${((newFileMetadata?.estimatedMessages || 0) * 0.0005).toFixed(2)}\n\n` +
        `Continue?`
      );
      
      if (proceed) {
        onRunReEvaluation(newFile, { mode: 'incremental' });
      }
    } else {
      const count = rangeEnd - rangeStart + 1;
      const estimatedMessages = count * 10; // Rough estimate
      
      const proceed = window.confirm(
        `This will evaluate conversations ${rangeStart} to ${rangeEnd} (${count} conversations).\n\n` +
        `Estimated messages: ~${estimatedMessages}\n` +
        `Estimated time: ~${Math.ceil(estimatedMessages / 20)} minutes\n` +
        `Estimated cost: ~$${(estimatedMessages * 0.0005).toFixed(2)}\n\n` +
        `Continue?`
      );
      
      if (proceed) {
        onRunReEvaluation(newFile, { start: rangeStart, end: rangeEnd, mode: 'range' });
      }
    }
  };

  const baselineDate = baselineTimestamp 
    ? new Date(baselineTimestamp * 1000).toLocaleDateString()
    : 'Unknown';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Re-Evaluation</h2>
        <p className="text-gray-600 mb-6">
          Measure improvement by evaluating new conversations since your baseline
        </p>

        {/* Baseline Info */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <Info className="mr-2" size={20} />
            Baseline Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700 font-medium">Conversations Evaluated:</p>
              <p className="text-blue-900 font-semibold text-xl">{baselineConversations}</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">Last Message Date:</p>
              <p className="text-blue-900 font-semibold text-xl">{baselineDate}</p>
            </div>
          </div>
          <div className="mt-4 bg-blue-100 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              💡 <strong>Tip:</strong> For best results, wait at least 1-2 weeks after completing practice 
              sessions before re-evaluating. This allows you to naturally apply what you've learned.
            </p>
          </div>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Upload New Chat Logs
          </label>
          
          <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            analyzing ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}>
            {analyzing ? (
              <div className="flex flex-col items-center">
                <Loader className="animate-spin text-blue-600 mb-3" size={40} />
                <p className="text-blue-900 font-medium">Analyzing file...</p>
                <p className="text-sm text-blue-700">This may take a moment</p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto mb-3 text-gray-400" size={40} />
                
                <label className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg cursor-pointer transition-colors">
                  <Upload size={18} className="mr-2" />
                  Choose New Chat Log File
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                  />
                </label>
                
                {newFile && !analyzing && (
                  <div className="mt-4 text-sm text-gray-600 flex items-center justify-center">
                    <CheckCircle className="text-green-600 mr-2" size={16} />
                    {newFile.name}
                  </div>
                )}
              </>
            )}
          </div>
          
          <p className="mt-2 text-xs text-gray-500">
            Upload the same or updated OpenAI chat export JSON file
          </p>
        </div>

        {/* New File Metadata */}
        {newFileMetadata && !analyzing && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-green-900 mb-3">📊 File Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-green-700 font-medium">Total Conversations:</p>
                <p className="text-green-900 font-semibold text-2xl">{newFileMetadata.totalConversations}</p>
              </div>
              <div>
                <p className="text-green-700 font-medium">New Conversations:</p>
                <p className="text-green-900 font-semibold text-2xl">
                  {newFileMetadata.newConversations}
                  {newFileMetadata.newConversations === 0 && (
                    <span className="text-yellow-600 text-sm ml-2">⚠️</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-green-700 font-medium">Est. New Messages:</p>
                <p className="text-green-900 font-semibold text-2xl">
                  ~{newFileMetadata.estimatedMessages}
                </p>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <p className="text-gray-600 mb-1">⏱️ Estimated Time:</p>
                <p className="font-semibold text-gray-900">
                  ~{Math.ceil(newFileMetadata.estimatedMessages / 20)} minutes
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <p className="text-gray-600 mb-1">💰 Estimated Cost:</p>
                <p className="font-semibold text-gray-900">
                  ~${(newFileMetadata.estimatedMessages * 0.0005).toFixed(2)}
                </p>
              </div>
            </div>
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
              }`}>
                <input
                  type="radio"
                  name="mode"
                  value="incremental"
                  checked={evaluationMode === 'incremental'}
                  onChange={() => setEvaluationMode('incremental')}
                  className="mt-1 mr-4"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 mb-1 flex items-center">
                    💰 Incremental (Recommended)
                    {newFileMetadata.newConversations === 0 && (
                      <span className="ml-2 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        Not available
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Evaluate only the {newFileMetadata.newConversations} new conversations since baseline
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      ⏱️ ~{Math.ceil(newFileMetadata.estimatedMessages / 20)} min
                    </span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      💵 ~${(newFileMetadata.estimatedMessages * 0.0005).toFixed(2)}
                    </span>
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                      ✓ Best value
                    </span>
                  </div>
                </div>
              </label>

              {/* Range Mode */}
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
                    🎯 Custom Range
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Choose specific conversation range to evaluate
                  </p>
                  
                  {evaluationMode === 'range' && (
                    <div className="mt-3 space-y-3">
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
                      
                      <div className="bg-blue-100 rounded-lg p-3">
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className="text-blue-800">
                            📊 <strong>{rangeEnd - rangeStart + 1}</strong> conversations
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

        {/* Warning Messages */}
        {newFileMetadata && newFileMetadata.newConversations === 0 && evaluationMode === 'incremental' && !analyzing && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 flex items-start mb-6">
            <AlertCircle className="text-yellow-600 mr-3 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-yellow-900 font-medium mb-1">No New Conversations Detected</p>
              <p className="text-sm text-yellow-800">
                The file has the same number of conversations as baseline ({baselineConversations}). 
                Try custom range mode or ensure you have new conversations in your export.
              </p>
            </div>
          </div>
        )}

        {/* Start Evaluation Button */}
        {newFileMetadata && !analyzing && (
          <button
            onClick={handleStartEvaluation}
            disabled={evaluationMode === 'incremental' && newFileMetadata.newConversations === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <TrendingUp size={20} />
            <span>
              {evaluationMode === 'incremental' 
                ? `Evaluate ${newFileMetadata.newConversations} New Conversations`
                : `Evaluate Conversations ${rangeStart}-${rangeEnd}`
              }
            </span>
          </button>
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
              <p className="font-medium text-gray-800">Upload new chat logs</p>
              <p className="text-sm text-gray-600">Can be the same file with more conversations or a new export</p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
            <div>
              <p className="font-medium text-gray-800">Choose evaluation mode</p>
              <p className="text-sm text-gray-600">Incremental (new only) or Custom range (specific conversations)</p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">3</span>
            <div>
              <p className="font-medium text-gray-800">AI evaluates selected conversations</p>
              <p className="text-sm text-gray-600">System processes only the conversations you selected</p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">4</span>
            <div>
              <p className="font-medium text-gray-800">Compare results</p>
              <p className="text-sm text-gray-600">See your improvement in grammar, punctuation, and tone scores</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReEvaluation;