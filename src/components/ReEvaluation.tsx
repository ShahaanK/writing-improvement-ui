import React, { useState } from 'react';
import { Upload, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface Props {
  baselineConversations: number;
  baselineTimestamp: number;
  onRunReEvaluation: (file: File, options: { start?: number; end?: number; mode: 'incremental' | 'range' }) => void;
}

const ReEvaluation: React.FC<Props> = ({ baselineConversations, baselineTimestamp, onRunReEvaluation }) => {
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFileMetadata, setNewFileMetadata] = useState<{
    totalConversations: number;
    newConversations: number;
  } | null>(null);
  const [evaluationMode, setEvaluationMode] = useState<'incremental' | 'range'>('incremental');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(100);

  const handleFileUpload = async (file: File) => {
    setNewFile(file);
    
    // Parse file to get metadata
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const logs = Array.isArray(data) ? data : [];
      
      setNewFileMetadata({
        totalConversations: logs.length,
        newConversations: Math.max(0, logs.length - baselineConversations)
      });
      
      setRangeEnd(logs.length);
      
    } catch (err) {
      console.error('Error parsing file:', err);
    }
  };

  const handleStartEvaluation = () => {
    if (!newFile) return;
    
    if (evaluationMode === 'incremental') {
      const proceed = window.confirm(
        `This will evaluate ${newFileMetadata?.newConversations} new conversations.\n\nEstimated time: ~${Math.ceil((newFileMetadata?.newConversations || 0) / 100)}  minutes\n\nContinue?`
      );
      
      if (proceed) {
        onRunReEvaluation(newFile, { mode: 'incremental' });
      }
    } else {
      const count = rangeEnd - rangeStart + 1;
      const proceed = window.confirm(
        `This will evaluate conversations ${rangeStart} to ${rangeEnd} (${count} total).\n\nEstimated time: ~${Math.ceil(count / 100)} minutes\n\nContinue?`
      );
      
      if (proceed) {
        onRunReEvaluation(newFile, { start: rangeStart, end: rangeEnd, mode: 'range' });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Re-Evaluation</h2>
        <p className="text-gray-600 mb-6">
          Measure improvement by evaluating new conversations since your baseline
        </p>

        {/* Baseline Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">Baseline Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700 font-medium">Conversations Evaluated:</p>
              <p className="text-blue-900 font-semibold text-lg">{baselineConversations}</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">Last Message Date:</p>
              <p className="text-blue-900 font-semibold text-lg">
                {new Date(baselineTimestamp * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Upload New Chat Logs
          </label>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
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
            
            {newFile && (
              <div className="mt-4 text-sm text-gray-600">
                <CheckCircle className="inline text-green-600 mr-2" size={16} />
                {newFile.name}
              </div>
            )}
          </div>
        </div>

        {/* New File Metadata */}
        {newFileMetadata && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-green-900 mb-3">New File Analysis</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-green-700 font-medium">Total Conversations:</p>
                <p className="text-green-900 font-semibold text-xl">{newFileMetadata.totalConversations}</p>
              </div>
              <div>
                <p className="text-green-700 font-medium">New Conversations:</p>
                <p className="text-green-900 font-semibold text-xl">{newFileMetadata.newConversations}</p>
              </div>
              <div>
                <p className="text-green-700 font-medium">Estimated Cost:</p>
                <p className="text-green-900 font-semibold text-xl">
                  ${(newFileMetadata.newConversations * 0.002).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Evaluation Mode Selection */}
        {newFileMetadata && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Evaluation Mode
            </label>
            
            <div className="space-y-3">
              {/* Incremental Mode */}
              <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                evaluationMode === 'incremental' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="mode"
                  value="incremental"
                  checked={evaluationMode === 'incremental'}
                  onChange={() => setEvaluationMode('incremental')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 mb-1">
                    💰 Incremental (Recommended)
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    Evaluate only the {newFileMetadata.newConversations} new conversations since baseline
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>⏱️ ~{Math.ceil(newFileMetadata.newConversations / 20)} min</span>
                    <span>💵 ~${(newFileMetadata.newConversations * 0.002).toFixed(2)}</span>
                    <span className="text-green-600 font-medium">Best value</span>
                  </div>
                </div>
              </label>

              {/* Range Mode */}
              <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                evaluationMode === 'range' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="mode"
                  value="range"
                  checked={evaluationMode === 'range'}
                  onChange={() => setEvaluationMode('range')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 mb-1">
                    🎯 Custom Range
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Choose specific conversation range to evaluate
                  </p>
                  
                  {evaluationMode === 'range' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">From Conversation:</label>
                        <input
                          type="number"
                          min={1}
                          max={newFileMetadata.totalConversations}
                          value={rangeStart}
                          onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">To Conversation:</label>
                        <input
                          type="number"
                          min={rangeStart}
                          max={newFileMetadata.totalConversations}
                          value={rangeEnd}
                          onChange={(e) => setRangeEnd(parseInt(e.target.value) || rangeEnd)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  )}
                  
                  {evaluationMode === 'range' && (
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <span>📊 {rangeEnd - rangeStart + 1} conversations</span>
                      <span>⏱️ ~{Math.ceil((rangeEnd - rangeStart + 1) / 20)} min</span>
                      <span>💵 ~${((rangeEnd - rangeStart + 1) * 0.002).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Warning Messages */}
        {newFileMetadata && newFileMetadata.newConversations === 0 && evaluationMode === 'incremental' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start mb-6">
            <AlertCircle className="text-yellow-600 mr-3 flex-shrink-0" size={20} />
            <div>
              <p className="text-yellow-900 font-medium mb-1">No New Conversations Detected</p>
              <p className="text-sm text-yellow-800">
                The new file has the same number of conversations as baseline. 
                Try custom range mode or ensure you have new conversations.
              </p>
            </div>
          </div>
        )}

        {/* Start Evaluation Button */}
        {newFileMetadata && (
          <button
            onClick={handleStartEvaluation}
            disabled={evaluationMode === 'incremental' && newFileMetadata.newConversations === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors"
          >
            {evaluationMode === 'incremental' 
              ? `Evaluate ${newFileMetadata.newConversations} New Conversations`
              : `Evaluate Conversations ${rangeStart}-${rangeEnd}`
            }
          </button>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-800 mb-3">How Re-Evaluation Works</h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">1</span>
            <p><span className="font-medium">Upload new chat logs</span> - Can be same file with more conversations or new export</p>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">2</span>
            <p><span className="font-medium">Choose mode</span> - Incremental (new only) or Custom range (specific conversations)</p>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">3</span>
            <p><span className="font-medium">Evaluate</span> - System processes only selected conversations</p>
          </div>
          <div className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">4</span>
            <p><span className="font-medium">Compare</span> - See improvement in grammar, punctuation, and tone</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReEvaluation;