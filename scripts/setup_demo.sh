#!/bin/bash

# Exit on error
set -e

echo "Starting Attack Chain Autopsy Engine Setup..."

# 1. Check dependencies
command -v python3 >/dev/null 2>&1 || { echo >&2 "Python 3.11+ is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo >&2 "Node 18+ is required but not installed. Aborting."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo >&2 "Docker Compose is required but not installed. Aborting."; exit 1; }

# 2. Create .env from .env.example if not exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    
    read -sp "Enter your ANTHROPIC_API_KEY: " anthropic_key
    echo
    read -sp "Enter your OPENAI_API_KEY: " openai_key
    echo
    
    sed -i.bak "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$anthropic_key/" .env
    sed -i.bak "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$openai_key/" .env
    rm -f .env.bak
fi

# 3. Download MITRE ATT&CK STIX bundle
echo "Downloading MITRE ATT&CK STIX bundle..."
mkdir -p data/mitre
curl -L https://github.com/mitre-attack/attack-stix-data/raw/master/enterprise-attack/enterprise-attack.json -o data/mitre/enterprise-attack.json

# 4. Start Neo4j
echo "Starting Neo4j via Docker..."
docker-compose up -d neo4j

# 5. Wait for Neo4j health
echo "Waiting for Neo4j to be ready..."
until curl -s http://localhost:7474 > /dev/null; do
    printf '.'
    sleep 2
done
echo " Neo4j is ready!"

# 6. Install Python dependencies
echo "Installing Python backend dependencies..."
pip install -r requirements.txt

# 7. Populate scenarios
echo "Populating graph with AIIMS and CBSE scenarios..."
python scripts/populate_graph.py

# 8. Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# 9 & 10. Start backend and frontend
echo "Starting backend (port 8000)..."
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting frontend (port 5173)..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

# 11. Run tests
echo "Running integration tests..."
pytest tests/test_aiims_demo.py -v

# 12. Open browser (Using python -m webbrowser to be cross-platform)
echo "Opening Demo..."
python -m webbrowser http://localhost:5173/demo

echo "
╔══════════════════════════════════════════════════╗
║     ATTACK CHAIN AUTOPSY ENGINE — READY          ║
║                                                  ║
║  Frontend:   http://localhost:5173               ║
║  Demo page:  http://localhost:5173/demo          ║
║  Backend:    http://localhost:8000               ║
║  API docs:   http://localhost:8000/docs          ║
║  Neo4j UI:   http://localhost:7474               ║
║                                                  ║
║  Click 'RUN AUTOPSY' on the AIIMS scenario.      ║
║  Earliest detection: T-21 days.                  ║
║  High confidence: T-19 days.                     ║
║  That's 19 days before the ransomware.           ║
╚══════════════════════════════════════════════════╝
"

# Keep script running to hold the background processes, or exit and let them detach.
wait
