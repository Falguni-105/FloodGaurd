# 🌊 FLOODGUARD
### Intelligent Urban Flood Prediction & Emergency Response Management System
*Building safer cities and mountain habitats through predictive intelligence, dynamic risk mapping, and rapid disaster response.*

---

## 📌 Overview

**FLOODGUARD** is an intelligent, full-stack disaster management decision-support platform designed to predict urban and highland flood risks, detect infrastructure blockages, and accelerate emergency rescue operations during severe meteorological events.

The platform integrates real-time weather observation (Open-Meteo API), high-resolution topographical elevation (SRTM 30m), drainage infrastructure metrics, and hydrological heuristics to deliver:
- Hyperlocal risk predictions updated via machine learning.
- Real-time interactive glassmorphic mapping with geospatial telemetry.
- Citizen emergency incident reporting with GPS tagging and verification.
- Intelligent blocked-road avoidance and dynamic rescue route generation.
- Centralized Emergency Operations Center (EOC / NDMA) situational dashboards.

---

## 🚨 Problem Statement

Urban flooding and mountainous flash floods inflict heavy infrastructure damage, disrupt transportation corridors, and endanger lives. Conventional early-warning systems often produce broad, regional advisories that fail to identify specific vulnerable wards or road-level waterlogging. 

**FLOODGUARD** bridges this gap by delivering hyperlocal risk scores, routing rescue teams around flooded obstacles, and coordinating inter-agency resources in real time.

---

## 💡 System Capabilities & The Five Pillars

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FLOODGUARD ECOSYSTEM                            │
├─────────────────────┬───────────────────────────┬───────────────────────────┤
│ 1. AI PREDICTION    │ 2. DYNAMIC RISK MAPPING   │ 3. CITIZEN REPORTING      │
│ Scikit-learn Random │ Interactive Leaflet + OSM │ Geotagged distress alerts │
│ Forest model with   │ with multi-hazard layers, │ with image upload, road   │
│ weather & elevation │ mountain zones & telemetry│ blockage identification   │
├─────────────────────┴───────────────────────────┴───────────────────────────┤
│ 4. INTELLIGENT RESCUE ROUTING      │ 5. NDMA DISASTER CONTROL ROOM          │
│ Dijkstra routing with dynamic risk │ Centralized live SitRep, resource      │
│ penalties and blocked road bypass  │ dispatch, and 6s civil defense siren   │
└────────────────────────────────────┴────────────────────────────────────────┘
```

1. **AI-Based Flood Prediction**: Hyperlocal ML risk scoring classifying localities into LOW, MODERATE, or HIGH risk with 0–100 probability scores.
2. **Dynamic Flood Risk Mapping**: High-performance interactive geospatial canvas with live rainfall telemetry, radar sweeps, and elevation overlays.
3. **Citizen Emergency Reporting**: Public mobile-responsive portal for reporting waterlogging, blocked bridges, trapped citizens, and medical emergencies.
4. **Intelligent Rescue Route Management**: Graph-based pathfinding computing optimal emergency vehicle detours away from submerged roads.
5. **Disaster Management Command Center**: Live SitRep generation, resource tracking (NDRF teams, inflatable boats, ambulances), operational dispatch, and an authentic 6.0-second civil warning siren.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite | Modern Emerald & Obsidian glassmorphism HUD (`backdrop-filter: blur`), Leaflet geospatial maps, Web Audio API |
| **Backend** | Java 21 / 25, Spring Boot 3.3.5 | REST API, Spring Security, JWT auth, WebSocket/STOMP real-time messaging, JPA/Hibernate |
| **Database** | PostgreSQL / H2 in-memory | Spatial coordinates, road network segments, incident records, and operational assets |
| **Machine Learning**| Python 3.11+, FastAPI, Scikit-learn | RandomForest multi-factor hydrological classifier with Uvicorn async serving |
| **Weather Feed** | Open-Meteo Forecast API | Real-time precipitation and live rainfall observations |
| **Containerization** | Docker, Docker Compose | Multi-container production deployment |

---

## 🚀 Quickstart & Installation

### Option A: Local Development

#### 1. Machine Learning Engine (FastAPI)
```bash
cd ml-service
pip install -r requirements.txt
python train.py                       # Trains and saves model.joblib
uvicorn app:app --host 0.0.0.0 --port 8000
```
*Health check available at:* `http://localhost:8000/health`

#### 2. Spring Boot Backend
```bash
cd backend
mvn spring-boot:run                   # Runs on port 8081 (or PORT=8081)
```
*API Base URL:* `http://localhost:8081/api`

#### 3. React Frontend
```bash
cd frontend
npm install
npm run dev                           # Runs on http://localhost:5173
```

---

### Option B: Docker Compose
```bash
docker compose up --build
```
Open **`http://localhost:3000`** in your browser.

---

## 🔑 Demo Credentials

| Role | Username / Identifier | Password | Access Privileges |
|---|---|---|---|
| **Authority / NDMA** | `admin` *(or `authority`)* | `Admin@123` | Full Control Room, SitRep reports, resource dispatch, live simulations |
| **Citizen Demo** | `citizen` | `Citizen@123` | Public incident reporting, route planner, live risk map |
| **Self-Registered** | *Any personal email* (e.g. `user@gmail.com`) | *Your password* | Full Citizen self-service access |

---

## 🧠 Machine Learning Model & Features

The ML service assesses flood probabilities based on a multi-factor hydrological feature vector:
- **`rainfall_24h_mm`**: 24-hour cumulative precipitation.
- **`peak_rainfall_mm_h`**: Peak hourly downpour intensity.
- **`antecedent_rainfall_3d_mm`**: Prior 72-hour soil saturation factor.
- **`elevation_m`**: Altitude above sea level (SRTM 30m).
- **`slope_deg`**: Terrain gradient and runoff velocity.
- **`drainage_capacity_index`**: Urban storm drainage efficiency (0–100).
- **`distance_to_river_m`**: Proximity to primary hydrological waterways.
- **`past_flood_count`**: Historical inundation records.
- **`impervious_surface_ratio`**: Urban concrete vs. permeable vegetative surface.

---

## 🏔️ Monitored Mountain & Urban Zones

FLOODGUARD incorporates operational telemetry across **25 key stations** spanning 7+ high-risk mountain and urban states:
- **Himachal Pradesh**: Shimla Mall/Ridge, Kullu Valley, Manali River Basin, Dharamshala Kangra
- **Uttarakhand**: Rishikesh Ganges, Haridwar Ghats, Dehradun Valley, Kedarnath Mandakini
- **Jammu & Kashmir**: Srinagar Jhelum, Jammu Tawi Basin
- **Sikkim**: Gangtok Teesta Valley
- **Meghalaya**: Shillong Plateau, Cherrapunji / Sohra (world high-rainfall record zone)
- **Assam & Arunachal**: Guwahati Brahmaputra, Itanagar Papum Pare
- **Kerala Western Ghats**: Munnar High Ranges, Wayanad Meppadi Hill Basin
- **Maharashtra (Urban Center)**: Pune Municipal Corporation (Shivajinagar, Kothrud, Hadapsar, Deccan Gymkhana, Katraj Lake Basin)

---

## 🎨 Modern UI & Audio Engineering

- **Emerald Earth Defense Theme**: Dark obsidian canvas (`#060e0a`) with glowing mint, jade, and viridian radial accents.
- **Frosted Glassmorphism**: Cards and navigation bars feature high-density blur (`backdrop-filter: blur(24px) saturate(190%)`) and polished specular bevel highlights.
- **NDMA Command Palette**: Accessible via `Ctrl + K` with instant fuzzy search across operational modules.
- **6.0-Second Civil Defense Siren**: Web Audio API dual-harmonic swept oscillator (520 Hz $\leftrightarrow$ 1040 Hz + sub-octave 260 Hz $\leftrightarrow$ 520 Hz) with an authentic civil warning envelope.

---

## 📡 Core API Summary

| Method & Path | Access | Description |
|---|---|---|
| `POST /api/auth/register`, `/api/auth/login` | Public | Citizen email/username authentication |
| `GET /api/risk/map`, `/api/risk/model` | Public | Real-time locality risk scores and ML model metadata |
| `GET /api/roads`, `/api/facilities` | Public | Road edge status, hospital and shelter coordinates |
| `POST /api/incidents` *(multipart)* | Authenticated | Citizen emergency report with GPS and photo upload |
| `GET /api/rescue/route` | Public | Dijkstra routing with risk avoidance and road block detours |
| `GET /api/rescue/plan` | Authority | Prioritized disaster dispatch and rescue base allocation |
| `POST /api/risk/simulate` | Authority | Storm scenario injection to test citywide resilience |
| `WebSocket /ws` *(STOMP)* | Public | Live telemetry broadcasts (`/topic/risk`, `/topic/incidents`) |

---

## 🎯 Vision & Roadmap

- **IoT Sensor Telemetry**: Automated ultrasonic river-level and culvert water-depth feeds.
- **Drone Aerial Survey**: Ingestion of real-time orthophoto mapping for damage assessment.
- **Multilingual Public Alerts**: SMS and voice-call warning broadcasts in regional languages.

*Predict Early. Respond Faster. Save Lives.*
