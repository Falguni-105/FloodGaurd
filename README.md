# FLOODGUARD

Intelligent urban flood prediction and emergency response management: a decision-support system.

```
frontend/    React + TypeScript + Leaflet (live map, citizen reporting, control room)
backend/     Spring Boot 3 (Java 21): REST API, JWT security, WebSocket, routing, dispatch
ml-service/  Python + scikit-learn RandomForest, served with FastAPI
docker-compose.yml   PostgreSQL + ML service + backend + frontend
```

## Run it

### Option A: Docker (everything, PostgreSQL included)
```bash
docker compose up --build
# open http://localhost:3000
```
Set `FLOODGUARD_JWT_SECRET`, `FLOODGUARD_ADMIN_PASSWORD` and `DB_PASSWORD` in the environment (or an `.env` file) for anything beyond a local demo.

### Option B: local development (no Docker, in-memory H2 database)
```bash
# 1. ML service
cd ml-service && pip install -r requirements.txt
python train.py                       # trains and writes model.joblib (a few seconds)
uvicorn app:app --port 8000

# 2. Backend (needs JDK 21 + Maven)
cd backend && mvn spring-boot:run     # http://localhost:8080
#    PostgreSQL instead of H2:  --spring.profiles.active=postgres  (see DB_URL / DB_USER / DB_PASSWORD)

# 3. Frontend
cd frontend && npm install && npm run dev     # http://localhost:5173
```
The backend still works if the ML service is down: it falls back to a rule-based score (labelled `fallback-rules` in the UI). Weather comes from the free Open-Meteo API (no key); if unreachable, the last known rainfall is kept. The **Rainfall scenario** panel in the control room lets you simulate a storm without live weather.

### Demo accounts
| Username | Password | Role |
|---|---|---|
| `authority` | `Admin@123` | Control room (dashboard, dispatch, status changes) |
| `admin` | `Admin@123` | Same as authority |
| any registered user | your own | Citizen (report incidents) |

The seed password is only a local-demo default; the backend logs a warning while it is in use. Public registration always creates a citizen account; authority accounts are provisioned by seeding / an administrator.

## How it maps to the five modules

| Module | Where |
|---|---|
| AI flood prediction | `ml-service/` (model) + `MlClient`, `WeatherService`, `RiskService` |
| Dynamic risk map | `GET /api/risk/map`, refreshed every 30 min and on demand; pushed over WebSocket |
| Citizen reporting | `POST /api/incidents` (GPS, description, optional photo) |
| Rescue route management | `RoadNetwork` (Dijkstra, blocked-road avoidance), `GET /api/rescue/route`, `GET /api/rescue/plan` |
| Disaster dashboard | `GET /api/dashboard/summary`, `/api/resources`, Control Room page |

## The ML model
* **Task:** classify a locality as LOW / MODERATE / HIGH flood risk (plus a 0-100 expected-risk score from the class probabilities).
* **Features:** 24 h rainfall, peak hourly intensity, 3-day antecedent rainfall, elevation, slope, drainage capacity, distance to river, past flood count, impervious-surface ratio.
* **Algorithm:** scikit-learn `RandomForestClassifier`.
* **Important:** there is no public labelled urban-flood dataset bundled here, so `train.py` trains on **synthetic data generated from a hydrologically motivated formula plus noise**. The ~85% test accuracy therefore measures how well the forest learned that formula, **not real-world forecasting skill**. To use it for real, replace `generate_data()` with historical flood records joined to rainfall and terrain data, then re-validate (hold out whole storms/years, check recall on HIGH events).

## Rescue routing and prioritisation
* The road graph is a set of junctions and segments in the database. A segment is **blocked** when an active `BLOCKED_ROAD` report, or a HIGH/CRITICAL `WATERLOGGING` report, lies within 250 m of it. Resolving or rejecting the report un-blocks it.
* Routes use Dijkstra, with segment cost raised in MODERATE (x1.15) and HIGH (x1.5) risk localities so routes prefer drier ground. ETA assumes 25 km/h.
* **Incident priority (0-100)** = severity (15 / 35 / 60 / 85) + 10 for people trapped or medical emergency + 10% of the locality's risk score + up to 10 for waiting time. The dispatch plan lists active incidents in that order, each with the nearest rescue base that can actually reach it, plus the nearest hospital and shelter; unreachable incidents are flagged for boat/air rescue.

## Data you must replace before real use
The bundled city is an **illustrative demo (Pune-area localities)**. Elevations, drainage capacities, flood histories, facilities, resource counts and the road graph are **approximate placeholders** (facility names are marked "(demo)"). Load municipal GIS data and an OpenStreetMap-derived road graph into the `locality`, `junction`, `road_edge` and `facility` tables. Set `floodguard.seed.demo-data=false` to skip the demo data.

## Security notes
* JWT (HS256) bearer auth, BCrypt password hashing, stateless sessions, role-based access (`CITIZEN`, `AUTHORITY`, `ADMIN`).
* Anonymous visitors see only the risk map, road status, facilities and a stripped-down incident feed (no description, reporter or photo). Photos are authority-only; uploads are checked by file signature (JPEG/PNG/WebP), size-limited, and stored under random names.
* WebSocket messages carry only a "something changed" event, never personal data; clients re-fetch through the authorised API.
* Known gaps for production: no rate limiting or CAPTCHA on registration/reporting, and citizen reports block roads immediately, so a malicious or mistaken report can divert routing until an authority rejects it (add a verification step or reporter reputation if that is a concern). Use HTTPS, a real secret, and a managed database.

## PostGIS
The stack in the proposal names PostGIS. This build uses plain PostgreSQL (H2 for local dev) and computes distances in Java (haversine / point-to-segment). That is enough at city scale with a few hundred segments. For a full OSM road network, switch the geometry columns to PostGIS and use `ST_DWithin` and pgRouting.

## Tests
`backend/src/test/java/.../FloodGuardIntegrationTest.java` covers access control, role escalation, upload validation, public-feed privacy, blocked-road detours and dispatch ordering. Run with `cd backend && mvn test`.

## API summary
| Method & path | Access |
|---|---|
| `POST /api/auth/register`, `/api/auth/login` | public |
| `GET /api/risk/map`, `/api/risk/model`, `/api/roads`, `/api/facilities`, `/api/facilities/nearest`, `/api/incidents/public`, `/api/rescue/route` | public |
| `POST /api/incidents` (multipart), `GET /api/incidents/mine` | logged in |
| `GET /api/incidents`, `PATCH /api/incidents/{id}`, `GET /api/rescue/plan`, `GET /api/dashboard/summary`, `GET/PATCH /api/resources`, `POST /api/risk/refresh`, `POST /api/risk/simulate`, `GET /api/files/{name}` | authority / admin |
| WebSocket `/ws` (STOMP topics `/topic/risk`, `/topic/incidents`) | public events |
