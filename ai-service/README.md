# Scribble AI Service

Python FastAPI microservice for AI-powered text operations using OpenAI GPT-4o-mini.

## Features

- Grammar checking
- Summarization 
- Writing improvement 
- Text generation 

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```bash
OPENAI_API_KEY=randomkeyidk
PORT=8000
```

3. Run locally:
```bash
uvicorn main:app --reload --port 8000
```

## API Endpoints

### `POST /grammar`
Fix grammar, spelling, and punctuation.

