// Anthropic API wrapper for browser-based calls

// Anthropic API wrapper for browser-based calls

import Anthropic from '@anthropic-ai/sdk';
import { GradingResult, PracticeQuestion } from '../types';  // ← ADD THIS LINE

export class AnthropicAPI {
  private client: Anthropic;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 12000; // 12 seconds (5 per minute)
  
  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Required for browser usage
    });
  }
  
  /**
   * Queue a request to respect rate limits (5 req/min)
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
      
      const message = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [
          { role: 'user', content: prompt }
        ]
      });
      
      if (onProgress) {
        onProgress('Response received');
      }
      
      // Extract text from response
      const textContent = message.content.find(block => block.type === 'text');
      return textContent ? (textContent as any).text : '';
    });
  }
  
  /**
   * Batch evaluation - multiple messages in one call
   */
  async evaluateBatch(
    messages: Array<{ id: string; text: string }>,
    onProgress?: (status: string) => void
  ): Promise<any[]> {
    const messagesText = messages
      .map((msg, idx) => `---MESSAGE ${idx + 1}---\n${msg.text}\n`)
      .join('\n');
    
    const prompt = `You are a writing evaluation expert. Analyze each of the following ${messages.length} messages.

For EACH message, provide:
1. Grammar Score (1-5): 1=poor, 5=excellent
2. Punctuation Score (1-5): 1=poor, 5=excellent  
3. Tone Score (1-5): 1=inappropriate/unprofessional, 5=excellent
4. Specific issues found

Messages:
${messagesText}

Respond with a JSON array of ${messages.length} evaluation objects in the SAME ORDER.
ONLY valid JSON, no markdown:

[
  {
    "message_number": 1,
    "grammar_score": <1-5>,
    "punctuation_score": <1-5>,
    "tone_score": <1-5>,
    "grammar_issues": ["issue1", "issue2"],
    "punctuation_issues": ["issue1"],
    "tone_issues": ["issue1"]
  },
  ...
]
`;
    
    const response = await this.callClaude(prompt, 4000, onProgress);
    
    // Clean and parse response
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.split('\n').slice(1).join('\n');
      cleaned = cleaned.replace(/```$/, '');
    }
    
    return JSON.parse(cleaned);
  }
  
  /**
   * Analyze patterns from evaluations
   */
  async analyzePatterns(
    evaluations: any[],
    onProgress?: (status: string) => void
  ): Promise<any> {
    const grammarScores = evaluations.map(e => e.grammar_score);
    const punctuationScores = evaluations.map(e => e.punctuation_score);
    const toneScores = evaluations.map(e => e.tone_score);
    
    const avgGrammar = grammarScores.reduce((a, b) => a + b, 0) / grammarScores.length;
    const avgPunctuation = punctuationScores.reduce((a, b) => a + b, 0) / punctuationScores.length;
    const avgTone = toneScores.reduce((a, b) => a + b, 0) / toneScores.length;
    
    const allGrammarIssues = evaluations.flatMap(e => e.grammar_issues);
    const allPunctuationIssues = evaluations.flatMap(e => e.punctuation_issues);
    const allToneIssues = evaluations.flatMap(e => e.tone_issues);
    
    const prompt = `Analyze writing evaluation data and identify TOP 5 issues per category.

Data:
- Total Messages: ${evaluations.length}
- Avg Grammar: ${avgGrammar.toFixed(2)}/5
- Avg Punctuation: ${avgPunctuation.toFixed(2)}/5
- Avg Tone: ${avgTone.toFixed(2)}/5

Grammar Issues: ${JSON.stringify(allGrammarIssues.slice(0, 100))}
Punctuation Issues: ${JSON.stringify(allPunctuationIssues.slice(0, 100))}
Tone Issues: ${JSON.stringify(allToneIssues.slice(0, 100))}

Respond ONLY with valid JSON:
{
  "summary": {
    "total_messages": ${evaluations.length},
    "avg_grammar_score": ${avgGrammar.toFixed(2)},
    "avg_punctuation_score": ${avgPunctuation.toFixed(2)},
    "avg_tone_score": ${avgTone.toFixed(2)},
    "overall_assessment": "<assessment>"
  },
  "top_grammar_issues": [
    {"issue": "<desc>", "frequency": <n>, "severity": "<low/medium/high>", "recommendation": "<fix>"},
    ...5 total
  ],
  "top_punctuation_issues": [...5 total],
  "top_tone_issues": [...5 total]
}
`;
    
    const response = await this.callClaude(prompt, 4000, onProgress);
    
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.split('\n').slice(1).join('\n');
      cleaned = cleaned.replace(/```$/, '');
    }
    
    return JSON.parse(cleaned);
  }
  
  /**
   * Generate practice questions in batch
   */
  async generatePracticeQuestions(
    issues: any[],
    sessionNumber: number,
    difficulty: string,
    onProgress?: (status: string) => void
  ): Promise<any[]> {
    const issuesText = issues
      .map((issue, idx) => `Issue ${idx + 1}:\n- Type: ${issue.category || 'general'}\n- Problem: ${issue.issue}\n- Recommendation: ${issue.recommendation}`)
      .join('\n\n');
    
    const prompt = `Generate practice questions for writing improvement session ${sessionNumber}.

Difficulty: ${difficulty}
Issues to cover:
${issuesText}

For EACH issue, create:
1. One correction exercise
2. One multiple choice question

Also create 1 comprehensive writing prompt.

Total: ${issues.length * 2 + 1} questions

Respond with JSON array:
[
  {
    "issue_number": 1,
    "type": "correction",
    "issue_name": "<issue>",
    "incorrect_sentence": "<bad>",
    "correct_sentence": "<good>",
    "explanation": "<why>"
  },
  {
    "issue_number": 1,
    "type": "multiple_choice",
    "issue_name": "<issue>",
    "question": "<question>",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "A",
    "explanation": "<why>"
  },
  ...
  {
    "type": "writing_prompt",
    "prompt": "<task>",
    "focus_issues": ["issue1", "issue2"]
  }
]

IMPORTANT: Session ${sessionNumber} - make questions UNIQUE for this session.
`;
    
    const response = await this.callClaude(prompt, 4000, onProgress);
    
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.split('\n').slice(1).join('\n');
      cleaned = cleaned.replace(/```$/, '');
    }
    
    return JSON.parse(cleaned);
  }
  
  /**
   * Grade practice session answers
   */
  async gradePracticeSession(
    questions: PracticeQuestion[],
    userAnswers: { [key: string]: string },
    onProgress?: (status: string) => void
  ): Promise<GradingResult[]> {
    // First, do programmatic grading
    const results: GradingResult[] = [];
    const needsLLM: Array<{ idx: number; question: PracticeQuestion; answer: string }> = [];
    
    questions.forEach((q, idx) => {
      const userAnswer = userAnswers[q.question_id] || '';
      
      // No answer
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
          feedback: isCorrect ? 'Correct! ✓' : `Incorrect. Correct answer: ${correctLetter}`,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          grading_method: 'programmatic'
        });
        return;
      }
      
      // Correction - check similarity
      if (q.question_format === 'correction') {
        const similarity = this.calculateSimilarity(
          userAnswer.toLowerCase(),
          q.correct_answer.toLowerCase()
        );
        
        if (similarity > 0.90) {
          results.push({
            question: idx + 1,
            issue: q.specific_issue,
            correct: true,
            feedback: 'Correct! ✓',
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            grading_method: 'similarity'
          });
          return;
        } else if (similarity > 0.75) {
          results.push({
            question: idx + 1,
            issue: q.specific_issue,
            correct: true,
            feedback: 'Correct! Minor wording differences are acceptable.',
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
    
    // Grade uncertain questions with LLM (batched)
    if (needsLLM.length > 0) {
      if (onProgress) {
        onProgress(`LLM grading ${needsLLM.length} subjective questions...`);
      }
      
      const qaText = needsLLM
        .map(item => `---QUESTION ${item.idx}---\nIssue: ${item.question.specific_issue}\nCorrect: ${item.question.correct_answer}\nUser: ${item.answer}`)
        .join('\n\n');
      
      const prompt = `Grade these ${needsLLM.length} writing questions. Be lenient.

${qaText}

Respond with JSON array of ${needsLLM.length} results in SAME ORDER:
[
  {
    "question_number": <number>,
    "is_correct": true/false,
    "feedback": "<feedback>"
  },
  ...
]
`;
      
      const response = await this.callClaude(prompt, 2000, onProgress);
      let cleaned = response.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.split('\n').slice(1).join('\n').replace(/```$/, '');
      }
      
      const llmGrades = JSON.parse(cleaned);
      
      needsLLM.forEach((item, i) => {
        results.push({
          question: item.idx,
          issue: item.question.specific_issue,
          correct: llmGrades[i].is_correct,
          feedback: llmGrades[i].feedback,
          correct_answer: item.question.correct_answer,
          explanation: item.question.explanation,
          grading_method: 'llm'
        });
      });
    }
    
    // Sort by question number
    return results.sort((a, b) => a.question - b.question);
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
    
    const words1 = new Set(clean1.split(/\s+/));
    const words2 = new Set(clean2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
}