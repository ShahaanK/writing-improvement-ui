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

/**
 * Parse OpenAI chat logs and extract user messages
 */
export function parseChatLogs(
  jsonData: any,
  options: ParseOptions = {}
): ParsedMessage[] {
  const logs = Array.isArray(jsonData) ? jsonData : [];
  const messages: ParsedMessage[] = [];
  
  // Apply conversation range filter
  const startIdx = options.startConversation ? options.startConversation - 1 : 0;
  const endIdx = options.endConversation ? options.endConversation : logs.length;
  const selectedLogs = logs.slice(startIdx, endIdx);
  
  console.log(`Parsing conversations ${startIdx + 1} to ${endIdx} (${selectedLogs.length} total)`);
  
  selectedLogs.forEach((conversation, convIdx) => {
    const mapping = conversation.mapping || {};
    const conversationTitle = conversation.title || 'Untitled';
    const actualConvIdx = startIdx + convIdx;
    
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
  
  console.log(`Extracted ${messages.length} user messages`);
  return messages;
}

/**
 * Get metadata about chat logs without parsing all messages
 */
export function getChatLogMetadata(jsonData: any): {
  totalConversations: number;
  estimatedMessages: number;
  dateRange: { earliest: Date | null; latest: Date | null };
} {
  const logs = Array.isArray(jsonData) ? jsonData : [];
  
  let earliestTime = Infinity;
  let latestTime = 0;
  let messageCount = 0;
  
  // Sample first 10 conversations to estimate
  const sample = logs.slice(0, Math.min(10, logs.length));
  
  sample.forEach(conv => {
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
  
  // Estimate total messages
  const avgMessagesPerConv = messageCount / sample.length;
  const estimatedTotal = Math.round(avgMessagesPerConv * logs.length);
  
  return {
    totalConversations: logs.length,
    estimatedMessages: estimatedTotal,
    dateRange: {
      earliest: earliestTime !== Infinity ? new Date(earliestTime * 1000) : null,
      latest: latestTime !== 0 ? new Date(latestTime * 1000) : null
    }
  };
}

/**
 * Filter messages using heuristics (Stage 1)
 */
export function filterMessagesHeuristic(messages: ParsedMessage[]): ParsedMessage[] {
  const writingKeywords = [
    'grammar', 'punctuation', 'tone', 'writing', 'edit', 'proofread',
    'essay', 'paper', 'report', 'email', 'letter', 'document',
    'sentence', 'paragraph', 'draft', 'revision', 'feedback',
    'formal', 'professional', 'academic', 'thesis', 'dissertation'
  ];
  
  const excludeKeywords = [
    'debug this code', 'solve for x', 'calculate the', 'syntax error',
    'workout routine', 'recipe for', 'game walkthrough'
  ];
  
  return messages.filter(msg => {
    const text = msg.text.toLowerCase();
    const wordCount = msg.text.split(/\s+/).length;
    
    // Too short
    if (wordCount < 10) return false;
    
    // Has writing keywords - keep regardless
    const hasWritingKw = writingKeywords.some(kw => text.includes(kw));
    if (hasWritingKw) return true;
    
    // Has exclude keywords - filter out
    if (excludeKeywords.some(kw => text.includes(kw))) return false;
    
    // Looks like prose
    const hasPunctuation = msg.text.includes('.') && msg.text.length > 50;
    const multipleSentences = (msg.text.match(/\./g) || []).length >= 2;
    const longEnough = wordCount >= 20;
    
    return hasPunctuation && multipleSentences && longEnough;
  });
}

/**
 * Get new messages since a baseline timestamp
 */
export function getNewMessagesSince(
  allMessages: ParsedMessage[],
  baselineTimestamp: number
): ParsedMessage[] {
  return allMessages.filter(msg => msg.timestamp > baselineTimestamp);
}