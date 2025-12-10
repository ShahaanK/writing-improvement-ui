// Anthropic API wrapper for browser-based calls
// Uses Claude Haiku 4.5 for cost-effective, fast responses
// 
// CORRECTED VERSION - Properly maps message IDs through evaluation pipeline
// Following reference implementation: writing_evaluation.py

export interface GradingResult {
  question: number;
  issue: string;
  correct: boolean;
  feedback: string;
  correct_answer: string;
  explanation: string;
  grading_method: 'programmatic' | 'similarity' | 'llm';
}

export interface PracticeQuestion {
  question_id: string;
  issue_type: string;
  specific_issue: string;
  question_format: 'correction' | 'multiple_choice' | 'writing_prompt';
  question_text: string;
  correct_answer: string;
  options?: string[];
  explanation: string;
}

export interface Message {
  id: string;
  text: string;
}

export interface EvaluationResult {
  message_id: string;
  text: string;
  grammar_score: number;
  punctuation_score: number;
  tone_score: number;
  grammar_issues: string[];
  punctuation_issues: string[];
  tone_issues: string[];
}

export interface Issue {
  issue: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface Analysis {
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
  // Metadata for tracking what was evaluated (for re-evaluation deduplication)
  metadata?: {
    evaluation_date: string;
    conversations_range: {
      start: number;  // 1-indexed
      end: number;    // 1-indexed (inclusive)
    };
    total_conversations_evaluated: number;
    messages_evaluated: number;
  };
}

export class AnthropicAPI {
  private apiKey: string;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
  private readonly MODEL = 'claude-haiku-4-5-20251001'; // Haiku 4.5 - fast & cost-effective
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  /**
   * Queue a request to respect rate limits
   */
  private async queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }
  
  /**
   * Process queued requests with rate limiting
   */
  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      // Wait if needed to respect rate limit
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      const request = this.requestQueue.shift();
      if (request) {
        await request();
        this.lastRequestTime = Date.now();
      }
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Get estimated wait time for queued requests
   */
  getEstimatedWaitTime(): number {
    const queuedRequests = this.requestQueue.length;
    return (queuedRequests * this.MIN_REQUEST_INTERVAL) / 1000; // in seconds
  }
  
  /**
   * Get number of requests in queue
   */
  getQueueLength(): number {
    return this.requestQueue.length;
  }
  
  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callClaude('Respond with just "OK"', 10);
      console.log('âœ… API connection successful');
      return true;
    } catch (error: any) {
      console.error('âŒ API connection failed:', error.message);
      return false;
    }
  }
  
  /**
   * Call Claude API with a prompt
   */
  async callClaude(
    prompt: string,
    maxTokens: number = 4000,
    onProgress?: (status: string) => void
  ): Promise<string> {
    return this.queueRequest(async () => {
      if (onProgress) {
        onProgress('Sending request to Claude...');
      }
      
      const requestBody = {
        model: this.MODEL,
        max_tokens: maxTokens,
        messages: [
          { role: 'user', content: prompt }
        ]
      };
      
      console.log('Making API request...');
      console.log('Model:', this.MODEL);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        throw new Error(
          `API Error ${response.status}: ${errorData.error?.message || errorData.message || response.statusText}`
        );
      }
      
      const data = await response.json();
      
      if (onProgress) {
        onProgress('Response received');
      }
      
      // Extract text from response
      const textContent = data.content.find((block: any) => block.type === 'text');
      return textContent ? textContent.text : '';
    });
  }
  
  /**
   * Stage 2: LLM Confirmation Filtering (Batched)
   * Confirms that heuristically-filtered messages are actually writing-related
   * Reference: lines 247-340 in writing_evaluation.py
   */
  async filterRelevantMessagesLLM(
    messages: Message[],
    batchSize: number = 10,
    onProgress?: (status: string) => void
  ): Promise<Message[]> {
    const totalBatches = Math.ceil(messages.length / batchSize);
    const relevant: Message[] = [];
    
    if (onProgress) {
      onProgress(`Stage 2: LLM confirmation (${totalBatches} batches)...`);
    }
    
    console.log(`ðŸ¤– Stage 2: LLM Confirmation - ${messages.length} messages in ${totalBatches} batches`);
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      if (onProgress) {
        onProgress(`Confirming batch ${batchNum}/${totalBatches}...`);
      }
      
      // Build batch classification prompt
      const messagesText = batch
        .map((msg, idx) => {
          // Keep more context - 800 chars instead of 400
          const textPreview = msg.text.length > 800 ? msg.text.substring(0, 800) + '...' : msg.text;
          return `---MESSAGE ${idx + 1}---\n${textPreview}\n`;
        })
        .join('\n');
      
      const prompt = `Classify each of the following ${batch.length} messages for writing quality evaluation.

CRITICAL: Be INCLUSIVE - we want to evaluate ANY text where writing quality matters.

A message is RELEVANT (return true) if it contains:
- ANY written text with complete sentences
- Emails, messages, letters, or communication
- Essays, reports, documents, or academic writing
- Creative writing (stories, narratives, descriptions)
- Professional writing (proposals, presentations, statements)
- ANY text where grammar, punctuation, or tone can be assessed
- Requests for writing help, editing, or proofreading

A message is NOT RELEVANT (return false) ONLY if it is:
- Pure code debugging (no prose)
- Pure math problems (equations only, no explanation)
- Very short (<10 words)
- No complete sentences at all

DEFAULT TO TRUE when in doubt - we prefer false positives over false negatives.

Messages to evaluate:
${messagesText}

Respond with ONLY a valid JSON array of ${batch.length} boolean values (true/false), in SAME ORDER.
NO markdown, NO explanations:

[true, false, true, ...]`;
      
      try {
        const response = await this.callClaude(prompt, 500, onProgress);
        const cleanedResponse = this.cleanJSONResponse(response);
        
        console.log(`  Raw response (first 200 chars): ${response.substring(0, 200)}`);
        console.log(`  Cleaned response: ${cleanedResponse}`);
        
        const results = JSON.parse(cleanedResponse);
        
        // Ensure we have the right number of results
        if (!Array.isArray(results) || results.length !== batch.length) {
          console.warn(`âš ï¸ Expected ${batch.length} results, got ${Array.isArray(results) ? results.length : 'non-array'}. Keeping all in batch.`);
          relevant.push(...batch);
        } else {
          // Filter relevant messages
          batch.forEach((msg, idx) => {
            if (results[idx] === true) {
              relevant.push(msg);
            }
          });
          
          const relevantCount = results.filter((r: boolean) => r === true).length;
          console.log(`  âœ… Batch ${batchNum}: ${relevantCount}/${batch.length} confirmed relevant`);
        }
        
      } catch (error) {
        console.error(`  âŒ Error processing batch ${batchNum}:`, error);
        console.error(`  Error details:`, error instanceof Error ? error.message : String(error));
        console.log(`  Defaulting to keeping all messages in this batch`);
        relevant.push(...batch);
      }
      
      // Rate limit: Wait 60 seconds after every 4 batches (5 req/min limit)
      if (batchNum % 4 === 0 && batchNum < totalBatches) {
        if (onProgress) {
          onProgress(`â¸ï¸ Rate limit: Waiting 60 seconds... (${batchNum}/${totalBatches} batches complete)`);
        }
        console.log(`  â¸ï¸ Rate limit: Waiting 60 seconds... (${batchNum}/${totalBatches} batches complete)`);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
    
    const confirmationRate = (relevant.length / messages.length) * 100;
    console.log(`\nâœ… Stage 2 Complete!`);
    console.log(`  â€¢ Confirmed relevant: ${relevant.length}`);
    console.log(`  â€¢ Filtered out: ${messages.length - relevant.length}`);
    console.log(`  â€¢ Confirmation rate: ${confirmationRate.toFixed(1)}%\n`);
    
    return relevant;
  }
  
  /**
   * Stage 3: Batch evaluation - PROPERLY MAPS MESSAGE IDs
   * This is the CRITICAL FIX - ensures message_id and text are preserved
   * Returns EvaluationResult[] with proper structure
   */
  async evaluateBatch(
    messages: Message[],
    onProgress?: (status: string) => void
  ): Promise<EvaluationResult[]> {
    const batchSize = 5; // Process 5 messages per API call
    const allResults: EvaluationResult[] = [];
    const totalBatches = Math.ceil(messages.length / batchSize);
    
    console.log(`\nðŸ“Š Stage 3: Detailed Evaluation - ${messages.length} messages in ${totalBatches} batches`);
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      if (onProgress) {
        onProgress(`Evaluating batch ${batchNum}/${totalBatches} (messages ${i + 1}-${Math.min(i + batchSize, messages.length)})...`);
      }
      
      // Build evaluation prompt with numbered messages
      const messagesText = batch
        .map((msg, idx) => `---MESSAGE ${idx + 1}---\n${msg.text}\n`)
        .join('\n');
      
      const prompt = `You are a writing evaluation expert. Analyze each of the following ${batch.length} messages for grammar, punctuation, and tone quality.

For EACH message, provide:
1. Grammar Score (1-5): 1=many errors, 5=perfect grammar
2. Punctuation Score (1-5): 1=many errors, 5=perfect punctuation
3. Tone Score (1-5): 1=very inappropriate, 5=perfectly appropriate
4. Specific issues found (be concise)

Messages:
${messagesText}

Respond with ONLY a valid JSON array of ${batch.length} evaluation objects in the SAME ORDER as the messages.
NO markdown, NO explanations, ONLY the JSON array:

[
  {
    "message_number": 1,
    "grammar_score": 3,
    "punctuation_score": 4,
    "tone_score": 4,
    "grammar_issues": ["subject-verb disagreement in sentence 2", "tense inconsistency"],
    "punctuation_issues": ["missing comma after introductory phrase"],
    "tone_issues": ["slightly too casual for context"]
  }
]`;
      
      let response = '';
      let cleanedResponse = '';
      
      try {
        response = await this.callClaude(prompt, 4000, onProgress);
        cleanedResponse = this.cleanJSONResponse(response);
        
        console.log(`\nðŸ”¥ Batch ${batchNum} Raw Response (first 600 chars):`);
        console.log(response.substring(0, 600));
        console.log(`\nðŸ§¹ Batch ${batchNum} Cleaned Response (first 600 chars):`);
        console.log(cleanedResponse.substring(0, 600));
        console.log(`\nðŸ” Attempting to parse...`);
        
        const batchResults = JSON.parse(cleanedResponse);
        
        if (!Array.isArray(batchResults)) {
          throw new Error('API did not return an array');
        }
        
        // CRITICAL FIX: Map API results back to original messages with IDs and text
        for (let j = 0; j < batch.length; j++) {
          const originalMessage = batch[j];
          const apiResult = batchResults[j];
          
          if (apiResult) {
            // Properly construct EvaluationResult with message_id and text
            allResults.push({
              message_id: originalMessage.id,
              text: originalMessage.text,
              grammar_score: apiResult.grammar_score || 3,
              punctuation_score: apiResult.punctuation_score || 3,
              tone_score: apiResult.tone_score || 3,
              grammar_issues: apiResult.grammar_issues || [],
              punctuation_issues: apiResult.punctuation_issues || [],
              tone_issues: apiResult.tone_issues || []
            });
          } else {
            // Fallback if API didn't return enough results
            allResults.push({
              message_id: originalMessage.id,
              text: originalMessage.text,
              grammar_score: 3,
              punctuation_score: 3,
              tone_score: 3,
              grammar_issues: ['Error: No evaluation returned'],
              punctuation_issues: [],
              tone_issues: []
            });
          }
        }
        
        console.log(`  âœ… Batch ${batchNum}: Successfully parsed ${batchResults.length} results`);
        console.log(`     Mapped to ${batch.length} messages with IDs`);
        
      } catch (error) {
        console.error(`  âŒ Error parsing batch ${batchNum} results:`, error);
        console.error('ðŸ“„ Full raw response:', response);
        console.error('ðŸ§¹ Full cleaned response:', cleanedResponse);
        
        // Add placeholder results for failed batch with proper message mapping
        for (let j = 0; j < batch.length; j++) {
          const originalMessage = batch[j];
          allResults.push({
            message_id: originalMessage.id,
            text: originalMessage.text,
            grammar_score: 3,
            punctuation_score: 3,
            tone_score: 3,
            grammar_issues: ['Error evaluating this message'],
            punctuation_issues: [],
            tone_issues: []
          });
        }
      }
      
      // Rate limit: Wait 60 seconds after every 4 batches (5 req/min limit)
      if (batchNum % 4 === 0 && batchNum < totalBatches) {
        if (onProgress) {
          onProgress(`â¸ï¸ Rate limit: Waiting 60 seconds... (${batchNum}/${totalBatches} batches complete)`);
        }
        console.log(`  â¸ï¸ Rate limit: Waiting 60 seconds... (${batchNum}/${totalBatches} batches complete)`);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
    
    console.log(`\nâœ… Stage 3 Complete!`);
    console.log(`  â€¢ Total evaluations: ${allResults.length}`);
    console.log(`  â€¢ All messages have message_id and text preserved`);
    
    // Validate that all results have required fields
    const invalidResults = allResults.filter(r => !r.message_id || !r.text);
    if (invalidResults.length > 0) {
      console.warn(`âš ï¸ WARNING: ${invalidResults.length} results missing message_id or text`);
    }
    
    return allResults;
  }
  
  /**
   * Analyze patterns from evaluations
   * Matches reference implementation: lines 420-579 in writing_evaluation.py
   */
  async analyzePatterns(
    evaluations: EvaluationResult[],
    onProgress?: (status: string) => void
  ): Promise<Analysis> {
    const grammarScores = evaluations.map(e => e.grammar_score);
    const punctuationScores = evaluations.map(e => e.punctuation_score);
    const toneScores = evaluations.map(e => e.tone_score);
    
    const avgGrammar = grammarScores.reduce((a, b) => a + b, 0) / grammarScores.length;
    const avgPunctuation = punctuationScores.reduce((a, b) => a + b, 0) / punctuationScores.length;
    const avgTone = toneScores.reduce((a, b) => a + b, 0) / toneScores.length;
    
    const allGrammarIssues = evaluations.flatMap(e => e.grammar_issues || []);
    const allPunctuationIssues = evaluations.flatMap(e => e.punctuation_issues || []);
    const allToneIssues = evaluations.flatMap(e => e.tone_issues || []);
    
    if (onProgress) {
      onProgress('Analyzing patterns and identifying top issues...');
    }
    
    // Prompt matches reference implementation strategy (lines 420-544)
    const prompt = `You are a writing analysis expert. Based on the evaluation data below, identify the TOP recurring issues in EACH category.

CRITICAL REQUIREMENTS (must follow exactly):
1. Provide BETWEEN 1-5 issues per category (grammar, punctuation, tone)
2. Each category MUST have at least 1 issue
3. Count issue frequency by GROUPING similar/related issues together
4. Provide specific, actionable recommendations
5. Order by frequency (most common first)
6. Use severity levels: "high" (>5 occurrences), "medium" (3-5 occurrences), "low" (<3 occurrences)

Data Summary:
- Total Messages Evaluated: ${evaluations.length}
- Average Grammar Score: ${avgGrammar.toFixed(2)}/5
- Average Punctuation Score: ${avgPunctuation.toFixed(2)}/5
- Average Tone Score: ${avgTone.toFixed(2)}/5

All Grammar Issues Found (${allGrammarIssues.length} total):
${JSON.stringify(allGrammarIssues, null, 2)}

All Punctuation Issues Found (${allPunctuationIssues.length} total):
${JSON.stringify(allPunctuationIssues, null, 2)}

All Tone Issues Found (${allToneIssues.length} total):
${JSON.stringify(allToneIssues, null, 2)}

TASK: Analyze the issues above, count frequency by grouping similar issues, and identify the top patterns (1-5 per category).

Respond with ONLY valid JSON (no markdown, no preamble, no explanation):

{
  "summary": {
    "total_messages": ${evaluations.length},
    "avg_grammar_score": ${parseFloat(avgGrammar.toFixed(2))},
    "avg_punctuation_score": ${parseFloat(avgPunctuation.toFixed(2))},
    "avg_tone_score": ${parseFloat(avgTone.toFixed(2))},
    "overall_assessment": "2-3 sentence assessment of overall writing quality and main areas for improvement"
  },
  "top_grammar_issues": [
    {"issue": "clear description of pattern", "frequency": 8, "severity": "high", "recommendation": "specific actionable advice"}
  ],
  "top_punctuation_issues": [
    {"issue": "clear description of pattern", "frequency": 7, "severity": "high", "recommendation": "specific actionable advice"}
  ],
  "top_tone_issues": [
    {"issue": "clear description of pattern", "frequency": 6, "severity": "high", "recommendation": "specific actionable advice"}
  ]
}`;
    
    try {
      const response = await this.callClaude(prompt, 4000, onProgress);
      const cleanedResponse = this.cleanJSONResponse(response);
      const analysis = JSON.parse(cleanedResponse);
      
      // CRITICAL: Validate that we got at least 1 issue per category (matches reference lines 547-567)
      if (!analysis.top_grammar_issues || analysis.top_grammar_issues.length < 1) {
        console.warn('âš ï¸ No grammar issues returned by API, generating fallback');
        analysis.top_grammar_issues = this.generateFallbackIssues(allGrammarIssues, 'grammar').slice(0, 5);
      }
      if (!analysis.top_punctuation_issues || analysis.top_punctuation_issues.length < 1) {
        console.warn('âš ï¸ No punctuation issues returned by API, generating fallback');
        analysis.top_punctuation_issues = this.generateFallbackIssues(allPunctuationIssues, 'punctuation').slice(0, 5);
      }
      if (!analysis.top_tone_issues || analysis.top_tone_issues.length < 1) {
        console.warn('âš ï¸ No tone issues returned by API, generating fallback');
        analysis.top_tone_issues = this.generateFallbackIssues(allToneIssues, 'tone').slice(0, 5);
      }
      
      // Cap at 5 issues per category (reference line 570)
      analysis.top_grammar_issues = analysis.top_grammar_issues.slice(0, 5);
      analysis.top_punctuation_issues = analysis.top_punctuation_issues.slice(0, 5);
      analysis.top_tone_issues = analysis.top_tone_issues.slice(0, 5);
      
      console.log(`âœ… Analysis complete:
  â€¢ Grammar issues: ${analysis.top_grammar_issues.length}
  â€¢ Punctuation issues: ${analysis.top_punctuation_issues.length}
  â€¢ Tone issues: ${analysis.top_tone_issues.length}`);
      
      return analysis;
    } catch (error) {
      console.error('âŒ Error analyzing patterns:', error);
      // Return fallback analysis with at least 1 issue per category (max 5)
      return {
        summary: {
          total_messages: evaluations.length,
          avg_grammar_score: avgGrammar,
          avg_punctuation_score: avgPunctuation,
          avg_tone_score: avgTone,
          overall_assessment: 'Analysis completed with partial data due to parsing error.'
        },
        top_grammar_issues: this.generateFallbackIssues(allGrammarIssues, 'grammar').slice(0, 5),
        top_punctuation_issues: this.generateFallbackIssues(allPunctuationIssues, 'punctuation').slice(0, 5),
        top_tone_issues: this.generateFallbackIssues(allToneIssues, 'tone').slice(0, 5)
      };
    }
  }
  
  /**
   * Generate practice questions in batch
   */
  async generatePracticeQuestions(
    issues: Issue[],
    sessionNumber: number,
    difficulty: string = 'medium',
    onProgress?: (status: string) => void
  ): Promise<PracticeQuestion[]> {
    // Take top 3 issues to focus on
    const topIssues = issues.slice(0, 3);
    
    const issuesText = topIssues
      .map((issue, idx) => `${idx + 1}. ${issue.issue}\n   Severity: ${issue.severity}\n   Fix: ${issue.recommendation}`)
      .join('\n\n');
    
    if (onProgress) {
      onProgress(`Generating practice questions for session ${sessionNumber}...`);
    }
    
    const prompt = `Generate practice questions for writing improvement - Session ${sessionNumber}.

Difficulty Level: ${difficulty}
Focus on these issues:
${issuesText}

Create 2 questions for EACH issue (6 total):
- 1 correction exercise (show incorrect sentence, user corrects it)
- 1 multiple choice question (4 options, one correct)

IMPORTANT: Make questions UNIQUE to session ${sessionNumber}. Use different examples than previous sessions.

Respond with ONLY valid JSON array (no markdown):

[
  {
    "question_id": "s${sessionNumber}_q1",
    "issue_type": "grammar",
    "specific_issue": "subject-verb agreement",
    "question_format": "correction",
    "question_text": "Correct this sentence:\\n\\nThe data shows significant results.",
    "correct_answer": "The data show significant results.",
    "explanation": "Data is plural, so use 'show' not 'shows'"
  },
  {
    "question_id": "s${sessionNumber}_q2",
    "issue_type": "grammar",
    "specific_issue": "subject-verb agreement",
    "question_format": "multiple_choice",
    "question_text": "Which sentence is correct?",
    "correct_answer": "B",
    "options": [
      "A) The team are winning",
      "B) The team is winning",
      "C) The teams is winning",
      "D) The team were winning"
    ],
    "explanation": "Team is singular collective noun, use 'is'"
  }
]`;
    
    try {
      const response = await this.callClaude(prompt, 4000, onProgress);
      const cleanedResponse = this.cleanJSONResponse(response);
      const questions = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array');
      }
      
      return questions;
    } catch (error) {
      console.error('Error generating questions:', error);
      // Return fallback questions
      return this.generateFallbackQuestions(topIssues, sessionNumber);
    }
  }
  
  /**
   * Grade practice session answers
   */
  async gradePracticeSession(
    questions: PracticeQuestion[],
    userAnswers: { [key: string]: string },
    onProgress?: (status: string) => void
  ): Promise<GradingResult[]> {
    const results: GradingResult[] = [];
    const needsLLM: Array<{ idx: number; question: PracticeQuestion; answer: string }> = [];
    
    // First pass: Programmatic grading for clear cases
    questions.forEach((q, idx) => {
      const userAnswer = userAnswers[q.question_id] || '';
      
      // No answer provided
      if (!userAnswer.trim()) {
        results.push({
          question: idx + 1,
          issue: q.specific_issue,
          correct: false,
          feedback: 'No answer provided',
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          grading_method: 'programmatic'
        });
        return;
      }
      
      // Multiple choice - exact match
      if (q.question_format === 'multiple_choice') {
        const userLetter = this.extractLetter(userAnswer);
        const correctLetter = this.extractLetter(q.correct_answer);
        
        const isCorrect = userLetter === correctLetter;
        
        results.push({
          question: idx + 1,
          issue: q.specific_issue,
          correct: isCorrect,
          feedback: isCorrect ? 'Correct! âœ“' : `Incorrect. The correct answer is ${correctLetter}.`,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          grading_method: 'programmatic'
        });
        return;
      }
      
      // Correction - check similarity first
      if (q.question_format === 'correction' || q.question_format === 'writing_prompt') {
        const similarity = this.calculateSimilarity(
          userAnswer.toLowerCase(),
          q.correct_answer.toLowerCase()
        );
        
        if (similarity > 0.90) {
          results.push({
            question: idx + 1,
            issue: q.specific_issue,
            correct: true,
            feedback: 'Correct! âœ“',
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            grading_method: 'similarity'
          });
          return;
        } else if (similarity > 0.75 && q.question_format === 'correction') {
          results.push({
            question: idx + 1,
            issue: q.specific_issue,
            correct: true,
            feedback: 'Correct! Minor wording differences are acceptable. âœ“',
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            grading_method: 'similarity'
          });
          return;
        }
      }
      
      // Needs LLM evaluation
      needsLLM.push({ idx: idx + 1, question: q, answer: userAnswer });
    });
    
    // Second pass: LLM grading for subjective questions
    if (needsLLM.length > 0) {
      if (onProgress) {
        onProgress(`AI grading ${needsLLM.length} subjective answer(s)...`);
      }
      
      const qaText = needsLLM
        .map(item => `---QUESTION ${item.idx}---
Issue Focus: ${item.question.specific_issue}
Question: ${item.question.question_text}
Correct Answer: ${item.question.correct_answer}
User Answer: ${item.answer}`)
        .join('\n\n');
      
      const prompt = `Grade these ${needsLLM.length} writing questions. Be lenient - accept answers that demonstrate understanding even if wording differs.

${qaText}

For each question, determine if the user's answer is correct and provide brief feedback.

Respond with ONLY valid JSON array of ${needsLLM.length} results in SAME ORDER (no markdown):

[
  {
    "question_number": 1,
    "is_correct": true,
    "feedback": "Correct! Your answer demonstrates proper understanding."
  }
]`;
      
      try {
        const response = await this.callClaude(prompt, 2000, onProgress);
        const cleanedResponse = this.cleanJSONResponse(response);
        const llmGrades = JSON.parse(cleanedResponse);
        
        needsLLM.forEach((item, i) => {
          const grade = llmGrades[i] || { is_correct: false, feedback: 'Unable to grade' };
          results.push({
            question: item.idx,
            issue: item.question.specific_issue,
            correct: grade.is_correct,
            feedback: grade.feedback,
            correct_answer: item.question.correct_answer,
            explanation: item.question.explanation,
            grading_method: 'llm'
          });
        });
      } catch (error) {
        console.error('Error grading with LLM:', error);
        // Add fallback results
        needsLLM.forEach((item) => {
          results.push({
            question: item.idx,
            issue: item.question.specific_issue,
            correct: false,
            feedback: 'Unable to grade automatically. Please review the correct answer.',
            correct_answer: item.question.correct_answer,
            explanation: item.question.explanation,
            grading_method: 'llm'
          });
        });
      }
    }
    
    // Sort by question number
    return results.sort((a, b) => a.question - b.question);
  }
  
  /**
   * Clean JSON response by removing markdown and extra text
   * ROBUST VERSION - handles all markdown fence variations
   */
  private cleanJSONResponse(response: string): string {
    let cleaned = response.trim();
    
    // Step 1: Remove ALL markdown code fences (```json, ```, etc.)
    // This handles multiple variations and locations
    cleaned = cleaned.replace(/```json\s*/g, '');
    cleaned = cleaned.replace(/```\s*/g, '');
    cleaned = cleaned.trim();
    
    // Step 2: Find the FIRST valid JSON start character
    const jsonStartBracket = cleaned.indexOf('[');
    const jsonStartBrace = cleaned.indexOf('{');
    
    let jsonStart = -1;
    if (jsonStartBracket >= 0 && jsonStartBrace >= 0) {
      jsonStart = Math.min(jsonStartBracket, jsonStartBrace);
    } else if (jsonStartBracket >= 0) {
      jsonStart = jsonStartBracket;
    } else if (jsonStartBrace >= 0) {
      jsonStart = jsonStartBrace;
    }
    
    if (jsonStart > 0) {
      cleaned = cleaned.substring(jsonStart);
    }
    
    // Step 3: Find the LAST valid JSON end character that matches the start
    const startsWithBracket = cleaned.trim().startsWith('[');
    const startsWithBrace = cleaned.trim().startsWith('{');
    
    let jsonEnd = -1;
    if (startsWithBracket) {
      jsonEnd = cleaned.lastIndexOf(']');
    } else if (startsWithBrace) {
      jsonEnd = cleaned.lastIndexOf('}');
    }
    
    if (jsonEnd > 0 && jsonEnd < cleaned.length - 1) {
      cleaned = cleaned.substring(0, jsonEnd + 1);
    }
    
    // Step 4: Final trim and validation
    cleaned = cleaned.trim();
    
    // Log for debugging
    if (!cleaned.startsWith('[') && !cleaned.startsWith('{')) {
      console.warn('âš ï¸ Cleaned JSON does not start with [ or {:', cleaned.substring(0, 50));
    }
    if (!cleaned.endsWith(']') && !cleaned.endsWith('}')) {
      console.warn('âš ï¸ Cleaned JSON does not end with ] or }:', cleaned.substring(cleaned.length - 50));
    }
    
    return cleaned;
  }
  
  /**
   * Extract letter from multiple choice answer
   */
  private extractLetter(text: string): string {
    const match = text.toUpperCase().match(/\b([A-D])\)?/);
    return match ? match[1] : text.toUpperCase().trim()[0] || '';
  }
  
  /**
   * Calculate Jaccard similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Remove punctuation
    const clean1 = str1.replace(/[.,!?;:]/g, '');
    const clean2 = str2.replace(/[.,!?;:]/g, '');
    
    const words1 = new Set(clean1.split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(clean2.split(/\s+/).filter(w => w.length > 0));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    if (union.size === 0) return 0;
    
    return intersection.size / union.size;
  }
  
  /**
   * Generate fallback issues when API fails
   * Ensures at least 1 issue per category (matches reference implementation)
   */
  private generateFallbackIssues(issues: string[], category: string): Issue[] {
    const issueCounts = new Map<string, number>();
    
    // Count frequency of each unique issue
    issues.forEach(issue => {
      const normalized = issue.toLowerCase().trim();
      if (normalized) {
        issueCounts.set(normalized, (issueCounts.get(normalized) || 0) + 1);
      }
    });
    
    // If no issues found, create a generic one
    if (issueCounts.size === 0) {
      return [{
        issue: `Minor ${category} inconsistencies detected`,
        frequency: 1,
        severity: 'low',
        recommendation: `Review ${category} rules and best practices`
      }];
    }
    
    // Sort by frequency and take top 5
    const sorted = Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    return sorted.map(([issue, frequency]) => ({
      issue: issue,
      frequency: frequency,
      severity: frequency > 5 ? 'high' : frequency > 2 ? 'medium' : 'low',
      recommendation: `Review and practice ${category} rules related to: ${issue}`
    }));
  }

  /**
   * Generate comparison analysis between baseline and followup evaluations
   * Includes practice performance context for holistic assessment
   */
  async generateComparisonAnalysis(
    baselineAnalysis: Analysis,
    followupAnalysis: Analysis,
    practicePerformance: {
      completed_sessions: number;
      total_sessions: number;
      average_score: number;
      strengths: string[];
      weaknesses: string[];
    },
    onProgress?: (status: string) => void
  ): Promise<{
    comparison: {
      grammar: { baseline: number; followup: number; change: number; changePercent: number };
      punctuation: { baseline: number; followup: number; change: number; changePercent: number };
      tone: { baseline: number; followup: number; change: number; changePercent: number };
    };
    issueComparison: {
      resolved: Issue[];
      persistent: Issue[];
      newIssues: Issue[];
    };
    overallImprovement: string;
  }> {
    if (onProgress) {
      onProgress('Generating comparison analysis...');
    }

    // Calculate score changes
    const comparison = {
      grammar: {
        baseline: baselineAnalysis.summary.avg_grammar_score,
        followup: followupAnalysis.summary.avg_grammar_score,
        change: followupAnalysis.summary.avg_grammar_score - baselineAnalysis.summary.avg_grammar_score,
        changePercent: ((followupAnalysis.summary.avg_grammar_score - baselineAnalysis.summary.avg_grammar_score) / baselineAnalysis.summary.avg_grammar_score) * 100
      },
      punctuation: {
        baseline: baselineAnalysis.summary.avg_punctuation_score,
        followup: followupAnalysis.summary.avg_punctuation_score,
        change: followupAnalysis.summary.avg_punctuation_score - baselineAnalysis.summary.avg_punctuation_score,
        changePercent: ((followupAnalysis.summary.avg_punctuation_score - baselineAnalysis.summary.avg_punctuation_score) / baselineAnalysis.summary.avg_punctuation_score) * 100
      },
      tone: {
        baseline: baselineAnalysis.summary.avg_tone_score,
        followup: followupAnalysis.summary.avg_tone_score,
        change: followupAnalysis.summary.avg_tone_score - baselineAnalysis.summary.avg_tone_score,
        changePercent: ((followupAnalysis.summary.avg_tone_score - baselineAnalysis.summary.avg_tone_score) / baselineAnalysis.summary.avg_tone_score) * 100
      }
    };

    // Compare issues - find resolved, persistent, and new
    const baselineIssueNames = new Set([
      ...baselineAnalysis.top_grammar_issues.map(i => i.issue.toLowerCase()),
      ...baselineAnalysis.top_punctuation_issues.map(i => i.issue.toLowerCase()),
      ...baselineAnalysis.top_tone_issues.map(i => i.issue.toLowerCase())
    ]);

    const followupIssueNames = new Set([
      ...followupAnalysis.top_grammar_issues.map(i => i.issue.toLowerCase()),
      ...followupAnalysis.top_punctuation_issues.map(i => i.issue.toLowerCase()),
      ...followupAnalysis.top_tone_issues.map(i => i.issue.toLowerCase())
    ]);

    const allBaselineIssues = [
      ...baselineAnalysis.top_grammar_issues,
      ...baselineAnalysis.top_punctuation_issues,
      ...baselineAnalysis.top_tone_issues
    ];

    const allFollowupIssues = [
      ...followupAnalysis.top_grammar_issues,
      ...followupAnalysis.top_punctuation_issues,
      ...followupAnalysis.top_tone_issues
    ];

    // Issues in baseline but not in followup = resolved
    const resolved = allBaselineIssues.filter(
      issue => !followupIssueNames.has(issue.issue.toLowerCase())
    );

    // Issues in both = persistent
    const persistent = allFollowupIssues.filter(
      issue => baselineIssueNames.has(issue.issue.toLowerCase())
    );

    // Issues in followup but not in baseline = new
    const newIssues = allFollowupIssues.filter(
      issue => !baselineIssueNames.has(issue.issue.toLowerCase())
    );

    // Generate AI summary of improvement
    const prompt = `Analyze this writing improvement data and provide a brief, encouraging assessment (2-3 sentences).

BASELINE SCORES:
- Grammar: ${baselineAnalysis.summary.avg_grammar_score.toFixed(2)}/5
- Punctuation: ${baselineAnalysis.summary.avg_punctuation_score.toFixed(2)}/5
- Tone: ${baselineAnalysis.summary.avg_tone_score.toFixed(2)}/5

FOLLOWUP SCORES:
- Grammar: ${followupAnalysis.summary.avg_grammar_score.toFixed(2)}/5 (${comparison.grammar.change >= 0 ? '+' : ''}${comparison.grammar.changePercent.toFixed(1)}%)
- Punctuation: ${followupAnalysis.summary.avg_punctuation_score.toFixed(2)}/5 (${comparison.punctuation.change >= 0 ? '+' : ''}${comparison.punctuation.changePercent.toFixed(1)}%)
- Tone: ${followupAnalysis.summary.avg_tone_score.toFixed(2)}/5 (${comparison.tone.change >= 0 ? '+' : ''}${comparison.tone.changePercent.toFixed(1)}%)

PRACTICE PERFORMANCE:
- Sessions completed: ${practicePerformance.completed_sessions}/${practicePerformance.total_sessions}
- Average practice score: ${Math.round(practicePerformance.average_score * 100)}%
- Mastered areas: ${practicePerformance.strengths.join(', ') || 'None yet'}
- Areas still challenging: ${practicePerformance.weaknesses.join(', ') || 'None'}

ISSUE CHANGES:
- Resolved issues: ${resolved.length} (${resolved.slice(0, 3).map(i => i.issue).join(', ')})
- Persistent issues: ${persistent.length}
- New issues: ${newIssues.length}

Provide a personalized, encouraging assessment that:
1. Highlights specific improvements made
2. Connects practice performance to real writing improvement
3. Suggests next focus area if needed

Respond with ONLY the assessment text (no JSON, no markdown):`;

    let overallImprovement = '';
    
    try {
      overallImprovement = await this.callClaude(prompt, 500, onProgress);
      overallImprovement = overallImprovement.trim();
    } catch (error) {
      console.error('Error generating improvement summary:', error);
      // Generate fallback summary
      const avgChange = (comparison.grammar.changePercent + comparison.punctuation.changePercent + comparison.tone.changePercent) / 3;
      if (avgChange > 5) {
        overallImprovement = `Great progress! Your writing scores improved by an average of ${avgChange.toFixed(1)}%. ${resolved.length > 0 ? `You've successfully resolved ${resolved.length} issue(s) from your baseline.` : ''} Keep up the excellent work!`;
      } else if (avgChange > 0) {
        overallImprovement = `You're making steady progress. Your scores show modest improvement, and your practice is paying off. Focus on the persistent issues to see more gains.`;
      } else {
        overallImprovement = `Your scores are stable. Continue practicing the identified issues, and consider reviewing the areas where you scored lower in practice sessions.`;
      }
    }

    return {
      comparison,
      issueComparison: {
        resolved,
        persistent,
        newIssues
      },
      overallImprovement
    };
  }
  
  /**
   * Generate fallback questions when API fails
   */
  private generateFallbackQuestions(issues: Issue[], sessionNumber: number): PracticeQuestion[] {
    const questions: PracticeQuestion[] = [];
    
    issues.slice(0, 3).forEach((issue, idx) => {
      questions.push({
        question_id: `s${sessionNumber}_q${idx * 2 + 1}`,
        issue_type: 'grammar',
        specific_issue: issue.issue,
        question_format: 'correction',
        question_text: `Review and correct any issues related to: ${issue.issue}\n\nExample sentence will be provided.`,
        correct_answer: 'See explanation for guidance',
        explanation: issue.recommendation
      });
      
      questions.push({
        question_id: `s${sessionNumber}_q${idx * 2 + 2}`,
        issue_type: 'grammar',
        specific_issue: issue.issue,
        question_format: 'multiple_choice',
        question_text: `Which demonstrates correct usage of: ${issue.issue}?`,
        correct_answer: 'A',
        options: [
          'A) Correct usage example',
          'B) Incorrect usage',
          'C) Incorrect usage',
          'D) Incorrect usage'
        ],
        explanation: issue.recommendation
      });
    });
    
    return questions;
  }
}