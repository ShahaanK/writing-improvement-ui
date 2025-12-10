// Parse OpenAI chat export format
// Handles the complex nested mapping structure

export interface ParsedMessage {
  id: string;
  text: string;
  timestamp: number;
  conversationId: number;
  conversationTitle: string;
}

export interface ParseOptions {
  startConversation?: number;  // 1-indexed
  endConversation?: number;    // 1-indexed (inclusive)
  afterTimestamp?: number;     // Unix timestamp
}

export interface ChatLogMetadata {
  totalConversations: number;
  estimatedMessages: number;
  dateRange: { 
    earliest: Date | null; 
    latest: Date | null;
    earliestTimestamp: number;
    latestTimestamp: number;
  };
  conversationTitles: string[];
  sampleMessages: number;
}

/**
 * Get metadata about chat logs - scans ALL conversations for accurate date range
 * Fast preview to help user select conversation range
 */
export function getChatLogMetadata(jsonData: any): ChatLogMetadata {
  const logs = Array.isArray(jsonData) ? jsonData : [];
  
  let earliestTime = Infinity;
  let latestTime = 0;
  let messageCount = 0;
  const conversationTitles: string[] = [];
  
  // Collect titles from all conversations
  logs.forEach(conv => {
    const title = conv.title || 'Untitled';
    conversationTitles.push(title);
  });
  
  // CRITICAL FIX: Scan ALL conversations to get REAL message count AND date range
  console.log('📅 Scanning all conversations for accurate metadata...');
  logs.forEach((conv, idx) => {
    const mapping = conv.mapping || {};
    Object.values(mapping).forEach((node: any) => {
      const msg = node.message;
      if (msg?.author?.role === 'user' && msg?.create_time) {
        messageCount++; // Count actual messages, not estimate
        earliestTime = Math.min(earliestTime, msg.create_time);
        latestTime = Math.max(latestTime, msg.create_time);
      }
    });
    
    // Progress indicator for large files
    if ((idx + 1) % 100 === 0) {
      console.log(`  Scanned ${idx + 1}/${logs.length} conversations...`);
    }
  });
  
  console.log(`✅ Metadata scan complete: ${messageCount} total messages, ${new Date(earliestTime * 1000).toLocaleDateString()} to ${new Date(latestTime * 1000).toLocaleDateString()}`);
  
  return {
    totalConversations: logs.length,
    estimatedMessages: messageCount, // Now actual count, not estimate
    dateRange: {
      earliest: earliestTime !== Infinity ? new Date(earliestTime * 1000) : null,
      latest: latestTime !== 0 ? new Date(latestTime * 1000) : null,
      earliestTimestamp: earliestTime !== Infinity ? earliestTime : 0,
      latestTimestamp: latestTime !== 0 ? latestTime : 0
    },
    conversationTitles: conversationTitles,
    sampleMessages: messageCount // Keep for backwards compatibility
  };
}

/**
 * Parse OpenAI chat logs and extract user messages
 * Now supports conversation range selection
 */
export function parseChatLogs(
  jsonData: any,
  options: ParseOptions = {},
  onProgress?: (status: string, current: number, total: number) => void
): ParsedMessage[] {
  const logs = Array.isArray(jsonData) ? jsonData : [];
  const messages: ParsedMessage[] = [];
  
  // Apply conversation range filter
  const startIdx = options.startConversation ? options.startConversation - 1 : 0;
  const endIdx = options.endConversation ? options.endConversation : logs.length;
  const selectedLogs = logs.slice(startIdx, endIdx);
  
  if (onProgress) {
    onProgress(
      `Parsing conversations ${startIdx + 1} to ${endIdx}...`,
      0,
      selectedLogs.length
    );
  }
  
  console.log(`📚 Parsing ${selectedLogs.length} conversations (${startIdx + 1} to ${endIdx})`);
  
  selectedLogs.forEach((conversation, convIdx) => {
    const mapping = conversation.mapping || {};
    const conversationTitle = conversation.title || 'Untitled';
    const actualConvIdx = startIdx + convIdx;
    
    if (onProgress && convIdx % 10 === 0) {
      onProgress(
        `Processing conversation ${convIdx + 1}/${selectedLogs.length}: "${conversationTitle.substring(0, 30)}..."`,
        convIdx,
        selectedLogs.length
      );
    }
    
    // Iterate through all nodes in mapping
    Object.values(mapping).forEach((node: any) => {
      const message = node.message;
      
      if (message && message.author && message.author.role === 'user') {
        const content = message.content || {};
        const createTime = message.create_time || 0;
        
        // Filter by timestamp if specified
        if (options.afterTimestamp && createTime <= options.afterTimestamp) {
          return;
        }
        
        // Extract text from parts array
        if (content.parts && Array.isArray(content.parts)) {
          const textParts: string[] = [];
          
          content.parts.forEach((part: any) => {
            if (typeof part === 'string') {
              textParts.push(part);
            } else if (typeof part === 'object') {
              if (part.text) {
                textParts.push(part.text);
              } else if (part.content) {
                textParts.push(String(part.content));
              }
            }
          });
          
          const text = textParts.join(' ').trim();
          
          if (text) {
            messages.push({
              id: `conv_${actualConvIdx}_msg_${messages.length}`,
              text: text,
              timestamp: createTime,
              conversationId: actualConvIdx,
              conversationTitle: conversationTitle
            });
          }
        }
      }
    });
  });
  
  if (onProgress) {
    onProgress(
      `✔ Extracted ${messages.length} user messages from ${selectedLogs.length} conversations`,
      selectedLogs.length,
      selectedLogs.length
    );
  }
  
  console.log(`✔ Extracted ${messages.length} user messages`);
  return messages;
}

/**
 * Filter messages using heuristics (Stage 1)
 * Identifies messages that appear to be writing-related
 * PERMISSIVE: Minimize false negatives - let LLM make final call
 */
export function filterMessagesHeuristic(
  messages: ParsedMessage[],
  onProgress?: (status: string, current: number, total: number) => void
): ParsedMessage[] {
  if (onProgress) {
    onProgress('🔍 Stage 1: Permissive heuristic filtering...', 0, messages.length);
  }
  
  console.log(`🔍 Stage 1 Filtering: ${messages.length} messages (PERMISSIVE STRATEGY)`);
  
  // Strong indicators of writing-related content (from Python reference)
  const writingKeywords = [
    // Core writing & editing
    'write', 'writing', 'edit', 'editing', 'proofread', 'revise',
    'revision', 'rewrite', 'rephrase', 'grammar', 'punctuation',
    'tone', 'sentence', 'paragraph', 'draft', 'feedback', 'format',
    
    // Academic writing
    'essay', 'paper', 'report', 'document', 'analysis', 'argument',
    'summary', 'thesis', 'dissertation', 'abstract', 'introduction',
    'conclusion', 'reflection', 'response', 'notes', 'jot notes',
    'chapter summary', 'quote integration', 'bibliography',
    'reference', 'citation', 'cite', 'peer review', 'manuscript',
    'publication', 'academic', 'formal', 'professional',
    
    // Creative writing
    'story', 'scene', 'narrative', 'creative', 'prompt',
    
    // Professional writing
    'email', 'letter', 'cover letter', 'linkedin', 'message',
    'statement', 'personal statement', 'supplementary essay',
    'application writing', 'proposal', 'presentation', 'speech',
    
    // Common writing task phrases
    'expand', 'shorten', 'make it human', 'sound more human'
  ];
  
  // Only filter EXTREMELY obvious non-writing content
  const excludeKeywords = [
    // Coding & technical
    'debug this code', 'syntax error', 'compile error', 'stack trace',
    'test coverage', 'unit test', 'function definition',
    'code', 'python', 'javascript', 'sql', 'html', 'css', 'racket',
    'algorithm', 'compute', 'compile', 'schema', 'erd', 'erd diagram',
    'normal form', '1nf', '2nf', '3nf', 'query',
    
    // Math / calculation
    'solve for x', 'calculate the', 'find the derivative',
    'solve this equation', 'what is the integral',
    'limit', 'derivative', 'vector', 'matrix', 'complex number',
    
    // Physics / science
    'velocity', 'acceleration', 'force', 'momentum', 'energy',
    'projectile', 'work', 'kinetic', 'potential',
    'molecule', 'reaction', 'glycolysis', 'atp',
    
    // Fitness
    'workout routine', 'sets and reps', 'bench press program',
    'workout', 'squat', 'deadlift', 'reps', 'sets', 'cardio',
    
    // Tests & quizzes
    'quiz', 'test', 'multiple choice', 'practice problems',
    'solve for', 'answer key',
    
    // Entertainment
    'recipe for', 'how to cook', 'movie recommendation',
    'game walkthrough', 'song lyrics', 'game', 'movie', 'song', 'video'
  ];
  
  const filtered: ParsedMessage[] = [];
  const stats = {
    too_short: 0,
    obvious_non_writing: 0,
    has_writing_keywords: 0,
    looks_like_prose: 0
  };
  
  messages.forEach((msg, idx) => {
    if (onProgress && idx % 50 === 0) {
      onProgress(
        `Analyzing message ${idx + 1}/${messages.length}...`,
        idx,
        messages.length
      );
    }
    
    const text = msg.text.toLowerCase();
    const wordCount = msg.text.split(/\s+/).length;
    
    // Only filter extremely short messages
    if (wordCount < 10) {
      stats.too_short++;
      return;
    }
    
    // PRIORITY 1: If mentions writing explicitly, KEEP IT
    const hasWritingKeywords = writingKeywords.some(kw => text.includes(kw));
    if (hasWritingKeywords) {
      filtered.push(msg);
      stats.has_writing_keywords++;
      return; // Skip all other checks
    }
    
    // PRIORITY 2: Check for OBVIOUS non-writing only
    const isObviouslyNotWriting = excludeKeywords.some(kw => text.includes(kw));
    if (isObviouslyNotWriting) {
      stats.obvious_non_writing++;
      return;
    }
    
    // PRIORITY 3: Keep anything that looks like prose/formal text
    // Be very permissive - let Stage 2 (LLM) make final call
    const hasPunctuation = msg.text.includes('.');
    const multipleSentences = (msg.text.match(/\./g) || []).length >= 2;
    const longEnough = wordCount >= 15; // Lowered from 20
    const hasQuestionMark = msg.text.includes('?');
    
    if ((hasPunctuation && longEnough) || multipleSentences || (hasQuestionMark && wordCount >= 15)) {
      filtered.push(msg);
      stats.looks_like_prose++;
    }
  });
  
  const passRate = (filtered.length / messages.length) * 100;
  
  if (onProgress) {
    onProgress(
      `✔ Stage 1: ${filtered.length}/${messages.length} passed (${passRate.toFixed(1)}% - permissive)`,
      messages.length,
      messages.length
    );
  }
  
  console.log(`📊 Stage 1 Results:
  • Filtered (too short): ${stats.too_short}
  • Filtered (obvious non-writing): ${stats.obvious_non_writing}
  • Passed (writing keywords): ${stats.has_writing_keywords}
  • Passed (looks like prose): ${stats.looks_like_prose}
  • Total passed: ${filtered.length} (${passRate.toFixed(1)}%)
  • Strategy: Permissive - let AI confirm in Stage 2`);
  
  return filtered;
}

/**
 * Get new messages since a baseline timestamp
 * Useful for re-evaluation after practice sessions
 */
export function getNewMessagesSince(
  allMessages: ParsedMessage[],
  baselineTimestamp: number,
  onProgress?: (status: string) => void
): ParsedMessage[] {
  if (onProgress) {
    onProgress('🔍 Finding messages newer than baseline...');
  }
  
  const baselineDate = new Date(baselineTimestamp * 1000).toLocaleDateString();
  console.log(`🔍 Finding messages after ${baselineDate}...`);
  
  const newMessages = allMessages.filter(msg => msg.timestamp > baselineTimestamp);
  
  if (onProgress) {
    onProgress(`✔ Found ${newMessages.length} new messages since baseline`);
  }
  
  console.log(`✔ Found ${newMessages.length} new messages`);
  return newMessages;
}

/**
 * Get conversation statistics for a range
 * Useful for displaying info to user before processing
 */
export function getConversationRangeStats(
  jsonData: any,
  startConv: number,
  endConv: number
): {
  conversationCount: number;
  estimatedMessages: number;
  titles: string[];
  dateRange: { earliest: Date | null; latest: Date | null };
} {
  const logs = Array.isArray(jsonData) ? jsonData : [];
  const startIdx = startConv - 1;
  const endIdx = Math.min(endConv, logs.length);
  const selectedLogs = logs.slice(startIdx, endIdx);
  
  let earliestTime = Infinity;
  let latestTime = 0;
  let messageCount = 0;
  const titles: string[] = [];
  
  selectedLogs.forEach(conv => {
    titles.push(conv.title || 'Untitled');
    const mapping = conv.mapping || {};
    
    Object.values(mapping).forEach((node: any) => {
      const msg = node.message;
      if (msg?.author?.role === 'user' && msg?.create_time) {
        messageCount++;
        earliestTime = Math.min(earliestTime, msg.create_time);
        latestTime = Math.max(latestTime, msg.create_time);
      }
    });
  });
  
  return {
    conversationCount: selectedLogs.length,
    estimatedMessages: messageCount,
    titles: titles,
    dateRange: {
      earliest: earliestTime !== Infinity ? new Date(earliestTime * 1000) : null,
      latest: latestTime !== 0 ? new Date(latestTime * 1000) : null
    }
  };
}