# 🚀 Setup Guide: Attack Chain Autopsy Engine

This guide walks you through setting up and running the Attack Chain Autopsy Engine. The project consists of a Python FastAPI backend, a React frontend, and a Neo4j graph database.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **Python 3.11+**: For the FastAPI backend and LangGraph agents.
- **Node.js 18+**: For the React frontend.
- **Docker & Docker Compose**: To run the Neo4j database locally.
- **Git**: To clone the repository.

---

## The 1-Click Setup (Recommended)

For the easiest setup experience, we have provided a shell script that handles everything from dependency installation to starting the servers.

1. **Clone the repository:**
   ```bash
   git clone <repo-url> attack-chain-autopsy
   cd attack-chain-autopsy
   ```

2. **Run the setup script:**
   ```bash
   bash scripts/setup_demo.sh
   ```
   *The script will prompt you for your Anthropic and OpenAI API keys, create the `.env` file, download required MITRE data, start Neo4j in Docker, install all dependencies, and spin up both the backend and frontend.*

---

## Manual Step-by-Step Setup

If you prefer to set up the components individually, follow these steps:

### 1. Environment Configuration

Copy the example environment file and add your API keys. The system uses Claude Sonnet 4.6 for attribution and OpenAI for embeddings.

```bash
cp .env.example .env
```

Edit the `.env` file and fill in:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

*(Note: The system has built-in graceful degradation. If API keys are missing or rate-limited, it will fall back to cached demo data, ensuring the demo always runs.)*

### 2. Download MITRE ATT&CK STIX Data

The engine uses official MITRE ATT&CK STIX bundles for accurate TTP mapping. Download the enterprise bundle:

```bash
mkdir -p data/mitre
curl -L https://github.com/mitre-attack/attack-stix-data/raw/master/enterprise-attack/enterprise-attack.json -o data/mitre/enterprise-attack.json
```

### 3. Start Neo4j Database

The knowledge graph requires Neo4j. Start it using Docker Compose:

```bash
docker-compose up -d neo4j
```
*Neo4j will be available at `http://localhost:7474` (User: `neo4j`, Password: `password`).*

### 4. Setup the Backend

Install the Python dependencies and load the synthetic demo data (AIIMS 2022 & CBSE 2026 scenarios) into the graph database.

```bash
# Install dependencies
pip install -r requirements.txt

# Populate the database with demo scenarios
python scripts/populate_graph.py

# Start the FastAPI server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
*The backend API is now running at `http://localhost:8000`. API docs available at `http://localhost:8000/docs`.*

### 5. Setup the Frontend

In a new terminal window, navigate to the frontend directory, install dependencies, and start the development server.

```bash
cd frontend
npm install
npm run dev
```
*The React frontend is now running at `http://localhost:5173`.*

---

## 🎬 Running the Demo

1. Open your browser and navigate to **[http://localhost:5173/demo](http://localhost:5173/demo)**.
2. Select the **AIIMS DELHI 2022** scenario from the top dropdown.
3. Click the massive red **RUN ATTACK CHAIN AUTOPSY** button.
4. Watch the progress tracker as the 5 LangGraph agents stream their analysis via SSE.
5. Once complete, explore the tabs:
   - **KILL CHAIN**: Interactive MITRE timeline with detected alerts.
   - **ATTACK GRAPH**: 3D force-directed graph showing lateral movement (use the time slider).
   - **ALERT TIMELINE**: Detailed retroactive alerts proving the 19-day prevention window.
   - **PLAYBOOKS**: SOAR response actions (approve pending containment playbooks).
   - **THREAT INTEL**: AI-driven actor attribution and predicted next moves.

## Testing

To verify the integrity of the engine and the AIIMS demo data, run the integration test suite:

```bash
pytest tests/test_aiims_demo.py -v
```
