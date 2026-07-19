# 🚀 Attack Chain Autopsy Engine — Deployment Guide

> **Stack Overview**
> - **Frontend**: React 18 + Vite (SPA)
> - **Backend**: FastAPI + Python 3.11 (REST + SSE)
> - **Graph DB**: Neo4j 5.21 Community (with APOC plugin)
> - **Vector Store**: ChromaDB (local filesystem)
> - **AI Keys Required**: Anthropic Claude API + OpenAI Embeddings API

---

## 📋 Table of Contents

1. [Prerequisites & Environment Variables](#prerequisites)
2. [Local Development (Docker Compose)](#local-docker)
3. [Local Development (Manual)](#local-manual)
4. [Railway (Free Tier ✅)](#railway)
5. [Render (Free Tier ✅)](#render)
6. [Fly.io (Free Tier ✅)](#flyio)
7. [Vercel + Render Split Deploy (Free ✅)](#vercel-render)
8. [Netlify + Backend Deploy (Free ✅)](#netlify)
9. [DigitalOcean App Platform (Paid 💰)](#digitalocean)
10. [AWS (EC2 + ECS) (Paid 💰)](#aws)
11. [Google Cloud Platform (GCP) (Paid 💰)](#gcp)
12. [Microsoft Azure (Paid 💰)](#azure)
13. [VPS / Bare Metal (Ubuntu)](#vps)
14. [Neo4j Hosting Options](#neo4j-hosting)
15. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites & Environment Variables

### Required API Keys

| Variable | Where to Get | Cost |
|---|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ | Pay-per-use |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | Pay-per-use |
| `NEO4J_URI` | Self-hosted or Neo4j Aura Free | Free tier available |
| `NEO4J_USER` | Neo4j instance credentials | — |
| `NEO4J_PASSWORD` | Neo4j instance credentials | — |

### Full `.env` Template

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
# AI Keys
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_strong_password

# ChromaDB
CHROMA_PATH=./chroma_db

# MITRE ATT&CK
MITRE_ATTACK_STIX_PATH=./data/mitre/enterprise-attack.json

# App
LOG_LEVEL=INFO
DEMO_MODE=true
BLAST_RADIUS_AUTO_THRESHOLD=0.3
DATA_DIR=./data/synthetic
SECRET_KEY=your_secret_key_here

# Frontend
VITE_API_URL=http://localhost:8000
VITE_NEO4J_URL=http://localhost:7474
```

> **CAUTION**: Never commit `.env` to version control. It is already listed in `.gitignore`.

---

## 2. Local Development — Docker Compose (Recommended)

**Best for**: Quick full-stack local setup. All services run in isolated containers.

### Prerequisites
- Docker Desktop installed: https://www.docker.com/products/docker-desktop/
- Docker Compose v2+ (`docker compose` command)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/attack-chain-autopsy.git
cd attack-chain-autopsy

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your API keys

# 3. Build and start all services
docker compose up --build

# 4. Access the application
#    Frontend:     http://localhost:3000
#    Backend API:  http://localhost:8000
#    API Docs:     http://localhost:8000/docs
#    Neo4j UI:     http://localhost:7474
```

### Useful Docker Commands

```bash
# Run in background (detached)
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f neo4j

# Stop all services
docker compose down

# Stop and remove volumes (clears all data!)
docker compose down -v

# Rebuild a single service
docker compose up --build backend
```

### Service Startup Order
```
Neo4j (healthcheck) --> Backend (waits for Neo4j) --> Frontend (waits for Backend)
```

> **NOTE**: First startup may take 3–5 minutes while Neo4j initializes and MITRE ATT&CK data loads.

---

## 3. Local Development — Manual Setup (No Docker)

**Best for**: Development with hot-reload, debugging individual services.

### Prerequisites
- Python 3.11+
- Node.js 18+
- Neo4j 5.x running locally or Neo4j Aura Free

### Step 1 — Backend

```bash
# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your values

# Start FastAPI backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 2 — Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
# Frontend available at: http://localhost:3000
```

### Step 3 — Download MITRE ATT&CK Data

```bash
# Create data directory
mkdir -p data/mitre

# Download enterprise-attack.json (~65MB)
curl -L https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json `
  -o data/mitre/enterprise-attack.json
```

---

## 4. Railway — Free Tier ✅

**Best for**: Hackathon demos, quick full-stack deployment.
**Free Tier**: $5 of credit/month (no credit card required for trial)
**Neo4j**: Use Neo4j Aura Free (not directly available on Railway)

### Step 1 — Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2 — Create Project

```bash
# Initialize Railway project in repo root
railway init
```

### Step 3 — Deploy Backend

```bash
# Create backend service
railway service create --name autopsy-backend

# Set environment variables
railway variables set ANTHROPIC_API_KEY=sk-ant-xxxxx
railway variables set OPENAI_API_KEY=sk-xxxxx
railway variables set NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
railway variables set NEO4J_USER=neo4j
railway variables set NEO4J_PASSWORD=your_aura_password
railway variables set DEMO_MODE=true
railway variables set LOG_LEVEL=INFO
railway variables set CHROMA_PATH=/app/chroma_db
railway variables set MITRE_ATTACK_STIX_PATH=/app/data/mitre/enterprise-attack.json

# Deploy
railway up --service autopsy-backend
```

Create `railway.toml` in project root:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "backend/Dockerfile"

[deploy]
startCommand = "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 300
```

### Step 4 — Deploy Frontend

```bash
railway service create --name autopsy-frontend
railway variables set VITE_API_URL=https://autopsy-backend.up.railway.app
cd frontend
railway up --service autopsy-frontend
```

Create `frontend/railway.toml`:
```toml
[build]
builder = "NIXPACKS"

[build.nixpacksPlan.phases.build]
cmds = ["npm ci", "npm run build"]

[deploy]
startCommand = "npx serve dist -p $PORT"
```

### Access

- Backend: `https://autopsy-backend.up.railway.app`
- Frontend: `https://autopsy-frontend.up.railway.app`
- API Docs: `https://autopsy-backend.up.railway.app/docs`

---

## 5. Render — Free Tier ✅

**Best for**: Free hosting with auto-deploy from GitHub.
**Free Tier**: Web Services spin down after 15 min inactivity; Static Sites always free.

### Step 1 — Push Code to GitHub

```bash
git remote add origin https://github.com/your-username/attack-chain-autopsy.git
git push -u origin main
```

### Step 2 — Deploy Backend (Web Service)

1. Go to https://render.com → **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `autopsy-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
4. Add environment variables:
   ```
   ANTHROPIC_API_KEY = sk-ant-xxxxx
   OPENAI_API_KEY = sk-xxxxx
   NEO4J_URI = neo4j+s://xxxx.databases.neo4j.io
   NEO4J_USER = neo4j
   NEO4J_PASSWORD = your_password
   DEMO_MODE = true
   CHROMA_PATH = /app/chroma_db
   PORT = 10000
   ```
5. Click **Create Web Service**

> **IMPORTANT**: Render free tier uses ephemeral storage. ChromaDB data will be lost on restart.
> Use a persistent disk ($7/month) for production.

### Step 3 — Deploy Frontend (Static Site)

1. Render → **New** → **Static Site**
2. Connect same GitHub repository
3. Configure:
   - **Name**: `autopsy-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `dist`
4. Add environment variable: `VITE_API_URL = https://autopsy-backend.onrender.com`
5. Click **Create Static Site**

### render.yaml (deploy both at once)

Create `render.yaml` in project root:

```yaml
services:
  - type: web
    name: autopsy-backend
    runtime: docker
    rootDir: backend
    dockerfilePath: ./Dockerfile
    envVars:
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: NEO4J_URI
        sync: false
      - key: NEO4J_USER
        value: neo4j
      - key: NEO4J_PASSWORD
        sync: false
      - key: DEMO_MODE
        value: "true"
      - key: CHROMA_PATH
        value: /app/chroma_db
      - key: PORT
        value: "10000"
    plan: free

  - type: web
    name: autopsy-frontend
    runtime: static
    rootDir: frontend
    buildCommand: npm ci && npm run build
    staticPublishPath: ./dist
    envVars:
      - key: VITE_API_URL
        fromService:
          type: web
          name: autopsy-backend
          envVarKey: RENDER_EXTERNAL_URL
```

---

## 6. Fly.io — Free Tier ✅

**Best for**: Full Docker-based deployment globally.
**Free Tier**: 3x shared-cpu-1x VMs (256MB RAM), 3GB persistent volume storage.

### Step 1 — Install Fly CLI

```bash
# Windows (PowerShell)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Login
fly auth login
```

### Step 2 — Deploy Backend

Create `backend/fly.toml`:

```toml
app = "autopsy-backend"
primary_region = "sin"  # Singapore (closest to India)

[build]
  dockerfile = "Dockerfile"

[env]
  DEMO_MODE = "true"
  LOG_LEVEL = "INFO"
  CHROMA_PATH = "/data/chroma_db"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1

[mounts]
  source = "chroma_data"
  destination = "/data"
```

```bash
cd backend
fly launch --name autopsy-backend --no-deploy

# Set secrets
fly secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
fly secrets set OPENAI_API_KEY=sk-xxxxx
fly secrets set NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
fly secrets set NEO4J_USER=neo4j
fly secrets set NEO4J_PASSWORD=your_password

# Create persistent volume for ChromaDB
fly volumes create chroma_data --size 3 --region sin

# Deploy
fly deploy
```

### Step 3 — Deploy Frontend

Create `frontend/Dockerfile.prod`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `frontend/nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
cd frontend
fly launch --name autopsy-frontend --no-deploy
fly deploy --build-arg VITE_API_URL=https://autopsy-backend.fly.dev
```

---

## 7. Vercel (Frontend) + Render (Backend) — Free ✅

**Best for**: Best combination of free static frontend + reliable backend hosting.

### Deploy Frontend on Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variables:
   ```
   VITE_API_URL = https://autopsy-backend.onrender.com
   ```
5. Click **Deploy**

### Deploy Backend on Render

Follow [Section 5 — Render Backend Steps](#render).

### Configure CORS

Update `backend/main.py` to allow your Vercel domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-app.vercel.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 8. Netlify (Frontend Only) — Free ✅

**Best for**: Excellent CDN and edge network. Frontend-only (pair with any backend).

### Deploy via Netlify UI

1. Go to https://netlify.com → **Add new site** → **Import from Git**
2. Connect GitHub and select your repository
3. Configure:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
4. Add environment variable: `VITE_API_URL = https://your-backend-url.com`
5. Click **Deploy site**

### Configure SPA Routing

Create `frontend/public/_redirects`:
```
/*    /index.html   200
```

### Netlify CLI Deploy

```bash
npm install -g netlify-cli
netlify login

cd frontend
npm run build
netlify deploy --prod --dir=dist
```

### netlify.toml

```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 9. DigitalOcean App Platform — Paid 💰

**Cost**: ~$12–25/month
**Best for**: Managed deployment, simple UI, Singapore region available.

### Deploy via UI

1. Go to https://cloud.digitalocean.com → **Apps** → **Create App**
2. Connect GitHub repository
3. Add two components:

**Backend Component:**
- Source Dir: `backend`
- Type: Web Service
- Dockerfile: `Dockerfile`
- HTTP Port: `8000`

**Frontend Component:**
- Source Dir: `frontend`
- Type: Static Site
- Build Command: `npm ci && npm run build`
- Output Dir: `dist`

### Set Environment Variables

```
ANTHROPIC_API_KEY = (encrypted)
OPENAI_API_KEY = (encrypted)
NEO4J_URI = neo4j+s://xxxx.databases.neo4j.io
DEMO_MODE = true
CHROMA_PATH = /app/chroma_db
```

### Deploy via doctl CLI

```bash
# Install doctl
choco install doctl  # Windows

doctl auth init

# Create app from spec file
doctl apps create --spec .do/app.yaml
```

Create `.do/app.yaml`:
```yaml
name: attack-chain-autopsy
region: blr  # Bangalore, India

services:
  - name: backend
    source_dir: /backend
    dockerfile_path: Dockerfile
    http_port: 8000
    instance_count: 1
    instance_size_slug: basic-xxs
    envs:
      - key: ANTHROPIC_API_KEY
        type: SECRET
        value: "your_key"
      - key: NEO4J_URI
        value: "neo4j+s://xxxx.databases.neo4j.io"

static_sites:
  - name: frontend
    source_dir: /frontend
    build_command: npm ci && npm run build
    output_dir: /dist
    envs:
      - key: VITE_API_URL
        value: "${backend.PUBLIC_URL}"
```

---

## 10. AWS — Paid 💰

**Free Tier**: 12-month free tier for new AWS accounts (t2.micro EC2, etc.)

### Option A — EC2 (Virtual Machine)

```bash
# 1. Launch EC2 instance (Ubuntu 22.04, t3.medium recommended)
#    Security Group: open ports 22, 80, 443, 3000, 8000

# 2. SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# 3. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker

# 4. Clone and configure
git clone https://github.com/your-repo/attack-chain-autopsy.git
cd attack-chain-autopsy
cp .env.example .env
nano .env

# 5. Start services
docker compose up -d --build
```

### Option B — ECS with Fargate (Serverless Containers)

```bash
# Configure AWS CLI
aws configure

# Create ECR repositories
aws ecr create-repository --repository-name autopsy-backend
aws ecr create-repository --repository-name autopsy-frontend

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-south-1  # Mumbai

# Login to ECR
aws ecr get-login-password | docker login --username AWS \
  --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Build and push backend
docker build -t autopsy-backend ./backend
docker tag autopsy-backend:latest \
  $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/autopsy-backend:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/autopsy-backend:latest

# Create ECS cluster
aws ecs create-cluster --cluster-name autopsy-cluster
```

### Option C — Elastic Beanstalk (Easiest AWS Option)

```bash
pip install awsebcli

# Initialize Elastic Beanstalk
eb init attack-chain-autopsy --platform docker --region ap-south-1

# Create and deploy environment
eb create autopsy-prod --instance-type t3.medium

# Deploy updates
eb deploy

# Open in browser
eb open
```

### AWS Architecture (Production)

```
Route 53 (DNS)
    |
CloudFront (CDN + S3 Static Frontend)
    |
Application Load Balancer
    |
ECS Fargate (Backend Containers)
    |
Neo4j Aura (Managed Graph DB)
```

---

## 11. Google Cloud Platform (GCP) — Paid 💰

**Free Credits**: $300 for new accounts
**Recommended**: Cloud Run (serverless, generous free tier — 2M requests/month free)

### Option A — Cloud Run (Recommended)

```bash
# Install gcloud CLI: https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Deploy Backend
gcloud run deploy autopsy-backend \
  --source ./backend \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8000 \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars ANTHROPIC_API_KEY=sk-ant-xxxxx,\
OPENAI_API_KEY=sk-xxxxx,\
NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io,\
NEO4J_USER=neo4j,\
NEO4J_PASSWORD=xxxxx,\
DEMO_MODE=true

# Deploy Frontend to Firebase Hosting (Free!)
cd frontend
npm run build
npm install -g firebase-tools
firebase login
firebase init hosting
# Set public directory to: dist
# Configure as SPA: yes
firebase deploy
```

### Option B — Google Kubernetes Engine (GKE)

```bash
# Create GKE Autopilot cluster (no node management)
gcloud container clusters create-auto autopsy-cluster \
  --region=asia-south1

gcloud container clusters get-credentials autopsy-cluster \
  --region=asia-south1

# Deploy using kubectl
kubectl apply -f k8s/
```

---

## 12. Microsoft Azure — Paid 💰

**Free Credits**: $200 for new accounts

### Option A — Azure Container Apps

```bash
# Install Azure CLI: https://learn.microsoft.com/cli/azure/install-azure-cli
az login

# Create resource group
az group create --name autopsy-rg --location centralindia

# Create Container Apps Environment
az containerapp env create \
  --name autopsy-env \
  --resource-group autopsy-rg \
  --location centralindia

# Create Azure Container Registry
az acr create --name autopsyregistry \
  --resource-group autopsy-rg \
  --sku Basic --admin-enabled true

# Build and push backend image
az acr build --registry autopsyregistry \
  --image autopsy-backend:latest ./backend

# Deploy Backend Container App
az containerapp create \
  --name autopsy-backend \
  --resource-group autopsy-rg \
  --environment autopsy-env \
  --image autopsyregistry.azurecr.io/autopsy-backend:latest \
  --target-port 8000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3 \
  --env-vars \
    NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io \
    DEMO_MODE=true
```

### Option B — Azure Static Web Apps (Frontend — Free Tier)

```bash
az staticwebapp create \
  --name autopsy-frontend \
  --resource-group autopsy-rg \
  --source https://github.com/your-repo/attack-chain-autopsy \
  --location centralindia \
  --branch main \
  --app-location "frontend" \
  --output-location "dist" \
  --login-with-github
```

### Option C — Azure App Service

```bash
# Create App Service Plan (B1 = ~$13/month, F1 = free but limited)
az appservice plan create \
  --name autopsy-plan \
  --resource-group autopsy-rg \
  --sku B1 --is-linux

# Create Web App
az webapp create \
  --name autopsy-backend \
  --resource-group autopsy-rg \
  --plan autopsy-plan \
  --deployment-container-image-name autopsyregistry.azurecr.io/autopsy-backend:latest

# Configure env vars
az webapp config appsettings set \
  --name autopsy-backend \
  --resource-group autopsy-rg \
  --settings \
    ANTHROPIC_API_KEY=sk-ant-xxxxx \
    NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io \
    DEMO_MODE=true
```

---

## 13. VPS / Bare Metal (Ubuntu Server)

**Best value**: Full control, best performance per dollar.
**Cheap Providers**: Hetzner (from €3.29/mo), Linode, Vultr, Contabo

### Step 1 — Initial Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Create non-root user
adduser autopsy
usermod -aG sudo autopsy
su - autopsy

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Step 2 — Deploy Application

```bash
git clone https://github.com/your-repo/attack-chain-autopsy.git
cd attack-chain-autopsy

cp .env.example .env
nano .env  # Fill in your values

docker compose up -d --build
```

### Step 3 — Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/autopsy
```

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    # SSE (Server-Sent Events) — disable buffering
    location /stream {
        proxy_pass http://localhost:8000;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
    }

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

```bash
# Enable site and reload Nginx
sudo ln -s /etc/nginx/sites-available/autopsy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Enable free HTTPS with Let's Encrypt
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### Step 4 — Auto-start on Reboot

```bash
sudo nano /etc/systemd/system/autopsy.service
```

```ini
[Unit]
Description=Attack Chain Autopsy Engine
After=docker.service
Requires=docker.service

[Service]
Type=forking
User=autopsy
WorkingDirectory=/home/autopsy/attack-chain-autopsy
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable autopsy
sudo systemctl start autopsy
```

---

## 14. Neo4j Hosting Options

Neo4j graph database is required by the backend. Choose one:

### Option A — Neo4j AuraDB Free (Best for Free Deployments)

1. Go to https://neo4j.com/cloud/aura/ → **Start Free**
2. Create a free instance (512MB RAM, 1GB storage)
3. Copy connection details from dashboard:
   ```
   NEO4J_URI = neo4j+s://xxxxxxxx.databases.neo4j.io
   NEO4J_USER = neo4j
   NEO4J_PASSWORD = (from Aura dashboard — save it!)
   ```
4. Update your `.env` with these values

> **NOTE**: Aura Free instances pause after 3 days of inactivity. Resume from the dashboard.

### Option B — Docker (Local / VPS)

Already included in `docker-compose.yml`. Runs `neo4j:5.21.0-community`.

- Admin UI: `http://localhost:7474`
- Bolt URI: `bolt://localhost:7687`
- Initial credentials: `neo4j` / `password` (from `.env`)

### Option C — Neo4j AuraDB Professional

- Starts at ~$65/month
- No pause, dedicated resources, automatic backups

### Option D — Self-hosted on Cloud VM

```bash
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -v neo4j-data:/data \
  -e NEO4J_AUTH=neo4j/your_strong_password \
  -e NEO4J_PLUGINS='["apoc"]' \
  -e NEO4J_dbms_security_procedures_unrestricted="apoc.*" \
  neo4j:5.21.0-community
```

---

## 15. Troubleshooting

### Backend won't start — Neo4j connection error

```bash
# Check Neo4j container status
docker compose ps neo4j

# Check Neo4j logs
docker compose logs neo4j

# Test connection manually
docker exec -it autopsy-neo4j cypher-shell -u neo4j -p password "RETURN 1;"
```

### MITRE ATT&CK data missing

```bash
# Download manually
mkdir -p data/mitre
curl -L https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json `
  -o data/mitre/enterprise-attack.json
```

### Frontend can't reach backend (CORS error)

Update `backend/main.py` to add your frontend URL:
```python
allow_origins=["https://your-frontend-domain.com", "http://localhost:3000"]
```

### ChromaDB data lost on restart (cloud platforms)

Mount a persistent volume or use `CHROMA_PATH` pointing to a persistent disk:
```
CHROMA_PATH = /persistent-mount/chroma_db
```

### SSE streaming not working behind Nginx proxy

Add to Nginx location block:
```nginx
proxy_buffering off;
proxy_cache off;
proxy_set_header X-Accel-Buffering no;
```

### Out of memory on free tier

Minimum RAM requirements:
- **Minimum**: 1GB RAM (backend only + Aura for Neo4j)
- **Recommended**: 2GB RAM (full stack)
- **Optimal**: 4GB RAM (ChromaDB + full MITRE data)

---

## Platform Comparison Summary

| Platform | Cost | Frontend | Backend | Neo4j | Difficulty | Best For |
|---|---|---|---|---|---|---|
| Docker Compose | Free (local) | Yes | Yes | Bundled | Easy | Local dev |
| Railway | $5 credit/mo | Yes | Yes | Aura Free | Easy | Hackathons |
| Render | Free / $7+ | Yes (Static) | Yes | Aura Free | Easy | Demos |
| Fly.io | Free tier | Yes | Yes | Aura Free | Medium | Production |
| Vercel + Render | Free | Yes | Yes | Aura Free | Easy | Best free combo |
| Netlify | Free | Yes (only) | No | — | Easy | Frontend only |
| DigitalOcean | $12+/mo | Yes | Yes | Aura | Medium | Managed |
| AWS EC2 | ~$15/mo | Yes | Yes | Self-host | Hard | Enterprise |
| GCP Cloud Run | Pay-per-use | Yes | Yes | Aura | Medium | Scalable |
| Azure | $13+/mo | Yes | Yes | Aura | Hard | Enterprise |
| VPS (Hetzner) | €3.29/mo | Yes | Yes | Docker | Medium | Best value |

---

## Recommended Setup by Use Case

| Scenario | Recommendation |
|---|---|
| **Hackathon demo (free)** | Vercel (frontend) + Render (backend) + Neo4j Aura Free |
| **Development & testing** | Docker Compose locally |
| **Production on budget** | Hetzner VPS €3.29/mo + Docker Compose + Nginx |
| **Managed production** | Railway or Fly.io |
| **Enterprise** | AWS ECS or GCP Cloud Run |

---

*Last updated: July 2026 | Attack Chain Autopsy Engine v1.0.0*
