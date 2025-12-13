# TutorBot
# IST 736 - Text Mining Final Project

A React/TypeScript application that analyzes OpenAI chat logs to identify writing issues and generates personalized practice sessions using the Anthropic Claude API.

## Overview

This system implements a complete writing improvement workflow:

1. **Baseline Evaluation** - Analyze your existing chat conversations to identify grammar, punctuation, and tone issues
2. **Practice Sessions** - Complete targeted exercises based on your specific weaknesses
3. **Re-evaluation** - Measure improvement by analyzing new conversations

## Features

- **Cost-Optimized Pipeline**: 4-stage filtering system that minimizes API token usage while maintaining accuracy
- **Heuristic Pre-filtering**: Filters out obvious non-writing content before API calls
- **LLM Confirmation**: Batch processing with rate limiting to confirm relevance
- **Detailed Scoring**: Grammar, punctuation, and tone evaluation on a 1-5 scale
- **Pattern Analysis**: Identifies recurring issues and provides actionable recommendations
- **Spaced Repetition Practice**: Three practice sessions with increasing difficulty
- **Progress Tracking**: Dashboard with detailed performance metrics
- **Smart Re-evaluation**: Only processes new conversations to save API costs

## Architecture

```
src/
├── components/
│   ├── PracticeSession.tsx    # Practice question interface with grading
│   ├── ProgressDashboard.tsx  # Performance tracking and metrics
│   └── ReEvaluation.tsx       # Follow-up evaluation interface
├── types/
│   └── index.ts               # Unified TypeScript type definitions
├── utils/
│   ├── anthropicApi.ts        # Claude API wrapper with rate limiting
│   └── chatLogParser.ts       # OpenAI chat export parser
├── App.tsx                    # Main application with navigation
└── index.tsx                  # Application entry point
```

## Pipeline Stages

### Stage 1: Heuristic Filtering
- Filters messages under 10 words
- Identifies writing-related keywords
- Excludes obvious non-writing content (code, math, etc.)
- Permissive strategy to minimize false negatives

### Stage 2: LLM Confirmation
- Batch processing (10 messages per request)
- Rate limiting (60-second pause after every 4 batches)
- Confirms relevance before detailed evaluation

### Stage 3: Detailed Evaluation
- Scores each message on grammar, punctuation, and tone
- Identifies specific issues with examples
- Preserves message ID mapping throughout pipeline

### Stage 4: Pattern Analysis
- Groups similar issues by frequency
- Assigns severity levels (high/medium/low)
- Generates actionable recommendations

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/writing-improvement-system.git

# Navigate to project directory
cd writing-improvement-system

# Install dependencies
npm install

# Start development server
npm start
```

## Usage

### 1. API Key Setup
Enter your Anthropic API key (format: `sk-ant-api03-...`). The key is stored only in browser memory.

### 2. Upload Chat Logs
Export your conversations from OpenAI and upload the JSON file. The system will display metadata including:
- Total conversations
- Estimated messages
- Date range

### 3. Select Conversation Range
Choose which conversations to analyze. For initial testing, start with a smaller range (e.g., 50-100 conversations).

### 4. Run Evaluation
The system will:
- Parse and filter messages
- Confirm relevance via LLM
- Evaluate writing quality
- Analyze patterns

### 5. Complete Practice Sessions
Three sessions with different focuses:
- Session 1: Initial Learning
- Session 2: Consolidation
- Session 3: Retention Test

### 6. Re-evaluate
Upload new chat logs to measure improvement over time.

## API Usage and Costs

The system uses Claude Haiku 4.5 for cost-effective processing:

| Stage | Tokens/Message | Cost Estimate |
|-------|----------------|---------------|
| LLM Confirmation | ~100 | ~$0.00005 |
| Detailed Evaluation | ~500 | ~$0.00025 |
| Pattern Analysis | ~2000 | ~$0.001 |
| Practice Generation | ~1000 | ~$0.0005 |

Estimated total cost: $0.05-0.10 per 100 messages evaluated

## Configuration

### Rate Limiting
The API wrapper includes built-in rate limiting:
- 1 second minimum between requests
- 60-second pause after every 4 batches
- Request queue with estimated wait times

### Batch Sizes
Configurable batch sizes for different operations:
- LLM Confirmation: 10 messages/batch
- Detailed Evaluation: 5 messages/batch

## Technical Notes

### Message ID Preservation
The system maintains message ID mapping throughout the evaluation pipeline to ensure data integrity when correlating evaluations with source messages.

### JSON Response Cleaning
Robust parsing handles LLM responses that may include markdown fences or explanatory text. Uses bracket/brace depth counting for reliable extraction.

### Error Handling
- Graceful degradation on API errors
- Fallback results for failed batches
- Rate limit detection and automatic retry

## Development

```bash
# Run tests
npm test

# Build for production
npm run build

# Type checking
npm run type-check
```

## Future Work
1.	Full Database Persistence: Complete PostgreSQL + pgvector integration for persistent learning history and adaptive spaced repetition.
2.	Expanded Tool Suite: Implementation of the full tool suite including detect_real_task, schedule_review, and adjust_agent_complexity.
3.	Voice Integration: Adding speech-to-text and text-to-speech for pronunciation practice and natural voice conversation.
4.	Cross-Platform Support: Supporting additional conversation export formats (Claude, Gemini) and implementing local LLM options.
5.	Formal Evaluation: Conducting user studies to validate learning outcomes and compare the effectiveness of pipeline versus agent approaches.

## Security Considerations

- API keys are stored in browser memory only (not persisted)
- No server-side component; all API calls are direct to Anthropic
- Requires `anthropic-dangerous-direct-browser-access` header

## Known Limitations

- Scoring methodology relies on LLM interpretation without external calibration
- 1-5 scale lacks concrete definition anchors
- Re-evaluation requires manual file upload

## Future Improvements

- Integration with external calibration datasets (e.g., Grammar_Correction.csv)
- LanguageTool integration for objective grammar detection
- Persistent storage for progress tracking
- Batch export of all results

## Acknowledgments

- Built with React and TypeScript
- Powered by Anthropic Claude API
- Styled with Tailwind CSS
