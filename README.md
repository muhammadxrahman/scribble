# Scribble - Collaborative Document Editor

A real-time collaborative document editor with AI-powered writing assistance, built with ASP.NET Core, Next.js, and PostgreSQL.

## Tech Stack

- **Frontend:** Next.js 16, ProseMirror, Bootstrap 5  
- **Backend:** ASP.NET Core 8, PostgreSQL 16, SignalR  
- **AI Service:** Python FastAPI, OpenAI GPT-4o-mini  
- **Authentication:** JWT with token blacklisting  
- **Deployment:** Vercel (frontend), Railway (backend + AI service + database)

## Features

**Core Editing** (5 documents per user)
- Rich text editor with formatting options (bold, italic, underline, headings, lists, etc.)
- Font customization (family, size, color, highlighting)
- Real-time collaborative editing with live cursor tracking
- Auto-save with 5-second debounce
- Character limits (50,000 per document)
- PDF export and print functionality

**Collaboration**
- Document sharing with Read/Edit permissions
- Live presence indicators showing active users
- Color-coded cursor tracking for multiple editors
- SignalR WebSocket connections for real-time sync

**AI Features** (5 calls per user per day)
- Grammar Check - Fix spelling, grammar, and punctuation
- Improve Writing - Enhance clarity and professionalism
- Summarize - Condense text into bullet points
- Continue Writing - Generate contextual continuations

**Security**
- JWT authentication with secure token blacklisting
- Rate limiting on AI features
- CORS protection and security headers
- Private Railway network for service communication

## Architecture
```
Vercel (Frontend)
    ↓ HTTPS
Railway Backend (ASP.NET)
    ↓ Private Network
Railway AI Service (Python FastAPI)
    ↓ HTTPS
OpenAI API (GPT-4o-mini)

Railway PostgreSQL (Database)
```

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- .NET 8 SDK
- Python 3.12+ (for AI service development)

### Setup

1. **Clone the repository**
```bash
   git clone 
   cd Scribble
```

2. **Configure environment variables**
```bash
   cp .env.example .env
   # Edit .env with your settings
```

3. **Run database migrations**
```bash
   cd backend
   dotnet tool restore
   dotnet dotnet-ef database update
   cd ..
```

### Development Mode

Run backend + database in Docker, frontend locally for hot reload:
```bash
# Terminal 1: Start backend services
docker-compose up postgres backend

# Terminal 2: Run frontend locally
cd frontend
npm install
npm run dev

# Terminal 3: Run AI service locally (optional)
cd ai-service
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/swagger
- AI Service: http://localhost:8000/docs
- PostgreSQL: localhost:5432

### Production Mode

Run everything in Docker:
```bash
docker-compose --profile production up --build
```

### Useful Commands
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (fresh database)
docker-compose down -v

# View logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Rebuild after code changes
docker-compose up --build

# Run migrations
cd backend
dotnet dotnet-ef migrations add MigrationName
dotnet dotnet-ef database update
```

## Project Structure
```
scribble/
├── backend/             # ASP.NET Core API
│   ├── Controllers/     # API endpoints
│   ├── Models/          # Database entities
│   ├── Services/        # Business logic
│   ├── Data/            # DbContext & migrations
│   ├── Hubs/            # SignalR hubs
│   └── Middleware/      # Auth middleware
├── frontend/            # Next.js app
│   └── src/
│       ├── app/         # Pages & routes
│       ├── components/  # React components
│       ├── context/     # Auth context
│       └── lib/         # API & utilities
├── ai-service/          # Python AI microservice
│   ├── main.py          # FastAPI application
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile       # Container config
├── docker-compose.yml   # Local development
└── .env                 # Environment variables
```

## Development Notes

- Backend uses GUIDs for User and Document IDs
- JWT tokens expire after 24 hours
- Database migrations run automatically on Railway deployment
- AI service uses private Railway network for security
- Frontend hot reload works in development mode only
- Rate limiting: 5 AI calls per user per day (resets at midnight UTC)

## Known Limitations

- Concurrent typing: 500ms debounce (conflicts possible)
- AI character limits: 50-2,000 characters per request
- No pagination in editor (continuous scroll)
- PDF export may cut off wide content

## License

MIT