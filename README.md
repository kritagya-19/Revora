# Revora / SignalBridge AI

Evidence-first revenue intelligence and next-best-action assistant for B2B SaaS Customer Success teams.

📖 **Complete Architecture & Mentor Presentation Guide:** See [SYSTEM_FLOW.md](file:///d:/Kritagya/Revora/SYSTEM_FLOW.md) for the end-to-end working flow, page-by-page breakdown, and demo script.

## Project Structure

```
Revora/
├── backend/                       # Python FastAPI Backend & Risk Engine
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       └── accounts.py    # Revenue Radar, Timeline, and Autopsy endpoints
│   │   ├── core/
│   │   │   └── config.py          # Pydantic environment configuration
│   │   ├── data/
│   │   │   └── seed_data.json     # Repeatable synthetic demo dataset (8 accounts)
│   │   ├── models/
│   │   │   └── schemas.py         # Account, Evidence, Autopsy, Proposal Pydantic models
│   │   ├── services/
│   │   │   ├── account_repository.py # Ingestion, MongoDB queries & seed data adapter
│   │   │   ├── proposal_repository.py# Action proposals & audit logs
│   │   │   └── risk_engine.py     # Deterministic risk engine authority
│   │   └── main.py                # FastAPI entry point & CORS
│   ├── mongodb/
│   │   └── init_mongo.py          # MongoDB index creation & seed database script
│   ├── requirements.txt           # Python dependencies (pymongo, fastapi, etc.)
│   ├── .env.example               # Backend environment template (MONGODB_URI)
│   └── venv/                      # Python virtual environment
│
├── frontend/                      # React 19 + TypeScript + Vite Frontend
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts             # Typed HTTP client communicating with backend
│   │   ├── types/
│   │   │   └── api.ts             # Account, Evidence, and Autopsy TypeScript interfaces
│   │   ├── App.tsx                # App shell, Revenue Radar, Evidence Timeline & Autopsy
│   │   ├── index.css              # DESIGN.md design tokens & styles
│   │   └── main.tsx
│   ├── index.html                 # Gloock & Inter typography integration
│   └── package.json
│
└── docs/agent/                    # PRD, Tech Stack, Design System, Rules, Phases
```

## Running the Project Locally

### 1. Backend (FastAPI & MongoDB)
```powershell
cd backend
# Optional: Seed / initialize MongoDB
.\venv\Scripts\python.exe mongodb\init_mongo.py

# Start FastAPI server
.\venv\Scripts\uvicorn app.main:app --reload --port 8000
```
API docs available at: `http://localhost:8000/docs`  
Health check at: `http://localhost:8000/health`

### 2. Frontend (React + Vite)
```powershell
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.
