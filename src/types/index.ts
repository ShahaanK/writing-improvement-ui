// Unified Type Definitions for Writing Improvement System
// Single source of truth for all TypeScript interfaces

// ============================================================================
// Core Message & Parsing Types
// ============================================================================

export interface ParsedMessage {
  id: string;
  text: string;
  timestamp: number;
  conversationId: number;
  conversationTitle: string;
}

export interface Message {
  id: string;
  text: string;
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

// ============================================================================
// Evaluation & Analysis Types
// ============================================================================

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

// Extended Analysis with metadata for tracking evaluated conversations
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

// ============================================================================
// Practice Session Types
// ============================================================================

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

export interface GradingResult {
  question: number;
  issue: string;
  correct: boolean;
  feedback: string;
  correct_answer: string;
  explanation: string;
  grading_method: 'programmatic' | 'similarity' | 'llm';
}

export interface PracticeSession {
  session_id: string;
  session_number: number;
  date: string;
  focus: string;
  questions: PracticeQuestion[];
  user_answers: { [key: string]: string };
  grading_results?: GradingResult[];
  score?: number;
  completed: boolean;
}

// Practice session summary for re-evaluation context
export interface PracticePerformanceSummary {
  total_sessions: number;
  completed_sessions: number;
  average_score: number;
  total_questions: number;
  correct_answers: number;
  issue_performance: {
    issue: string;
    accuracy: number;
    correct: number;
    total: number;
  }[];
  strengths: string[];  // Issues with >80% accuracy
  weaknesses: string[]; // Issues with <60% accuracy
}

// ============================================================================
// Re-evaluation Types
// ============================================================================

export interface ReEvaluationRequest {
  mode: 'incremental' | 'range';
  startConversation?: number;
  endConversation?: number;
}

export interface ReEvaluationResult {
  followupAnalysis: Analysis;
  practicePerformance: PracticePerformanceSummary;
  comparison: {
    grammar: { baseline: number; followup: number; change: number; changePercent: number };
    punctuation: { baseline: number; followup: number; change: number; changePercent: number };
    tone: { baseline: number; followup: number; change: number; changePercent: number };
  };
  issueComparison: {
    resolved: Issue[];     // Issues in baseline but not in followup
    persistent: Issue[];   // Issues in both
    newIssues: Issue[];    // Issues only in followup
  };
  overallImprovement: string;  // AI-generated summary
}

// ============================================================================
// Progress & Metadata Types
// ============================================================================

export interface ProcessingProgress {
  current: number;
  total: number;
  stage: string;
  estimatedTimeRemaining?: number;
}

export interface BaselineMetadata {
  evaluation_id: string;
  evaluation_date: string;
  total_messages_evaluated: number;
  earliest_message_timestamp: number;
  latest_message_timestamp: number;
  message_ids_evaluated: string[];
  cost_estimate: number;
  conversations_evaluated: number;
}

// ============================================================================
// App State & Navigation Types
// ============================================================================

export type ViewType = 'setup' | 'evaluation' | 'practice' | 'dashboard' | 'reevaluation';

export interface AppState {
  // Current navigation
  currentView: ViewType;
  
  // Step 1: Initial Evaluation
  baselineAnalysis?: Analysis;
  baselineEvaluations?: EvaluationResult[];
  baselineMetadata?: BaselineMetadata;
  
  // Step 2: Practice Sessions
  practiceSessions: PracticeSession[];
  
  // Step 3: Re-Evaluation
  followupAnalysis?: Analysis;
  followupEvaluations?: EvaluationResult[];
  followupMetadata?: BaselineMetadata;
  reEvaluationResult?: ReEvaluationResult;
  
  // Metadata
  created_at: string;
  last_updated: string;
}

// ============================================================================
// Learning Plan Types (for future use)
// ============================================================================

export interface LearningPlan {
  created_date: string;
  baseline_scores: {
    grammar: number;
    punctuation: number;
    tone: number;
  };
  focus_areas: {
    grammar: Issue[];
    punctuation: Issue[];
    tone: Issue[];
  };
  practice_schedule: Array<{
    session: number;
    day: number;
    date: string;
    focus: string;
    duration_minutes: number;
  }>;
  session_plans: PracticeSession[];
}