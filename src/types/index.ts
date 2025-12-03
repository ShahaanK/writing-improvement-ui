// TypeScript type definitions for Writing Improvement System

export interface Message {
  id: string;
  text: string;
  metadata: {
    conversation_id: number;
    conversation_title: string;
    timestamp: number;
  };
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

export interface AnalysisData {
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
}

export interface PracticeQuestion {
  question_id: string;
  issue_type: 'grammar' | 'punctuation' | 'tone' | 'comprehensive';
  specific_issue: string;
  question_format: 'correction' | 'multiple_choice' | 'writing_prompt';
  question_text: string;
  correct_answer: string;
  options?: string[];
  explanation: string;
}

export interface PracticeSession {
  session_id: string;
  session_number: number;
  date: string;
  focus: string;
  duration_minutes: number;
  questions: PracticeQuestion[];
  user_answers?: { [key: string]: string };
  grading_results?: GradingResult[];
  score?: number;
  completed: boolean;
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

export interface BaselineMetadata {
  evaluation_id: string;
  evaluation_date: string;
  total_messages_evaluated: number;
  earliest_message_timestamp: number;
  latest_message_timestamp: number;
  message_ids_evaluated: string[];
  cost_estimate: number;
}

export interface AppState {
  // Step 1: Initial Evaluation
  baseline_analysis?: AnalysisData;
  baseline_evaluations?: EvaluationResult[];
  baseline_metadata?: BaselineMetadata;
  
  // Step 2: Learning Plan
  learning_plan?: LearningPlan;
  
  // Step 3: Practice Sessions
  practice_sessions: PracticeSession[];
  
  // Step 4: Re-Evaluation
  followup_analysis?: AnalysisData;
  followup_evaluations?: EvaluationResult[];
  followup_metadata?: BaselineMetadata;
  
  // Metadata
  created_at: string;
  last_updated: string;
  current_step: 'upload' | 'evaluation' | 'practice' | 'reevaluation' | 'complete';
}

export interface ProcessingProgress {
  current: number;
  total: number;
  stage: string;
  estimatedTimeRemaining?: number;
}