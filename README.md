# Scribble - Collaborative Document Editor

A real-time collaborative document editor built with ASP.NET Core, Next.js, and PostgreSQL.

## Tech Stack

- **Backend**: ASP.NET Core 8 (Minimal APIs)
- **Frontend**: Next.js 14 with TypeScript
- **Database**: PostgreSQL 16
- **Authentication**: JWT
- **Real-time**: SignalR

## Features

### Phase 1 (Completed)
- User authentication (register/login)
- Document CRUD operations
- JWT authentication
- Max 5 documents per user
- 50,000 character limit per document

### Phase 2 (In Progress)
- Next.js frontend
- Dashboard
- Document editor

### Phase 3 (Planned)
- Document sharing with permissions
- Read/Edit access control
- Real-time collaboration with SignalR
- Rich text editing with ProseMirror
- Live cursors and presence

### Phase 4 (Planned)
- Version history
- Revert to previous versions

### Phase 5 (Planned)
- Python AI microservice
- Text summarization
- Grammar checking
- Content revision

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- .NET 8 SDK (for running migrations locally)

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

### Development Mode (Recommended)

Run backend + database in Docker, frontend locally for hot reload:
```bash
# Terminal 1: Start backend services
docker-compose up postgres backend

# Terminal 2: Run frontend locally
cd frontend
npm install
npm run dev
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/swagger
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
Scribble/
├── backend/              # ASP.NET Core API
│   ├── Controllers/      # API endpoints
│   ├── Models/          # Database entities
│   ├── Services/        # Business logic
│   ├── DTOs/            # Data transfer objects
│   └── Data/            # Database context
├── frontend/            # Next.js app
│   └── src/
│       ├── app/         # Pages (App Router)
│       ├── components/  # React components
│       └── lib/         # Utilities
├── docker-compose.yml   # Docker orchestration
└── .env                 # Environment variables (not in git)
```

## Development Notes

- Backend uses UUIDs for User and Document IDs (security)
- JWT tokens expire after 24 hours (configurable in .env)
- Database migrations are manual (not auto-applied on startup)
- Frontend hot reload works in development mode only

## License

MIT