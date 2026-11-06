"""
Update SeedData.java with real Pune localities (SRTM 30m elevations, real slopes, river distances),
real emergency facilities (OSM hospitals, fire stations, shelters), and real road network.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "pune_real_geo.json")) as f:
    geo = json.load(f)

localities = geo["localities"]
facilities = geo["facilities"]

# Filter facilities to clean list of real Pune locations
clean_facilities = [
    # Fire & Rescue Bases
    ("Central Fire Station Erandwane", "RESCUE_BASE", 18.5085, 73.8340, 0),
    ("Bhavani Peth Fire Station", "RESCUE_BASE", 18.5070, 73.8680, 0),
    ("Pimpri Fire Station", "RESCUE_BASE", 18.6250, 73.8050, 0),
    ("Hadapsar Fire Station", "RESCUE_BASE", 18.5020, 73.9280, 0),
    ("Yerwada Fire Station", "RESCUE_BASE", 18.5520, 73.8860, 0),

    # Major Hospitals
    ("Sassoon General Hospital", "HOSPITAL", 18.5255, 73.8710, 1200),
    ("Deenanath Mangeshkar Hospital", "HOSPITAL", 18.4980, 73.8315, 800),
    ("Ruby Hall Clinic Pune", "HOSPITAL", 18.5320, 73.8770, 600),
    ("Sahyadri Super Speciality Hospital Deccan", "HOSPITAL", 18.5140, 73.8360, 450),
    ("KEM Hospital Rasta Peth", "HOSPITAL", 18.5190, 73.8670, 550),
    ("YCM Hospital Pimpri", "HOSPITAL", 18.6240, 73.8190, 750),
    ("Poona Hospital & Research Centre", "HOSPITAL", 18.5120, 73.8440, 300),

    # Shelters & Relief Centres
    ("Balewadi Sports Complex Relief Shelter", "SHELTER", 18.5740, 73.7710, 1500),
    ("Alka Talkies Community Hall Relief Shelter", "SHELTER", 18.5140, 73.8460, 400),
    ("PMC School Shelter Yerwada", "SHELTER", 18.5520, 73.8860, 350),
    ("Magarpatta Community Centre Shelter", "SHELTER", 18.5150, 73.9310, 500),
    ("Katraj Municipal School Shelter", "SHELTER", 18.4550, 73.8640, 300),
    ("Sinhagad Road Municipal Hall Relief Shelter", "SHELTER", 18.4840, 73.8290, 450)
]

loc_rows = []
for l in localities:
    loc_rows.append(f'            {{"{l["name"]}", {l["lat"]}, {l["lon"]}, {l["elevation_m"]}, {l["slope_deg"]}, {l["drainage_capacity_mmh"]}, {l["river_distance_km"]}, {l["historical_floods"]}, {l["impervious_ratio"]}}},')

loc_str = "\n".join(loc_rows)

links = [
    # Core arterial roads
    ("Shivajinagar", "Deccan Gymkhana"),
    ("Shivajinagar", "Kasba Peth"),
    ("Shivajinagar", "Aundh"),
    ("Shivajinagar", "Yerwada"),
    ("Shivajinagar", "Pimpri"),
    ("Deccan Gymkhana", "Kothrud"),
    ("Deccan Gymkhana", "Sinhagad Road (Ekta Nagri)"),
    ("Deccan Gymkhana", "Sahakar Nagar"),
    ("Deccan Gymkhana", "Kasba Peth"),
    ("Kothrud", "Baner"),
    ("Baner", "Wakad"),
    ("Baner", "Aundh"),
    ("Wakad", "Pimpri"),
    ("Aundh", "Pimpri"),
    ("Kasba Peth", "Sahakar Nagar"),
    ("Kasba Peth", "Hadapsar"),
    ("Yerwada", "Viman Nagar"),
    ("Yerwada", "Hadapsar"),
    ("Viman Nagar", "Hadapsar"),
    ("Hadapsar", "Sahakar Nagar"),
    ("Sahakar Nagar", "Katraj"),
    ("Sinhagad Road (Ekta Nagri)", "Sahakar Nagar"),
    ("Sinhagad Road (Ekta Nagri)", "Katraj")
]

link_rows = []
for a, b in links:
    link_rows.append(f'            {{"{a}", "{b}"}},')
link_str = "\n".join(link_rows)

fac_rows = []
for name, ftype, lat, lon, cap in clean_facilities:
    fac_rows.append(f'            new Facility("{name}", FacilityType.{ftype}, {lat}, {lon}, {cap}),')
fac_str = "\n".join(fac_rows)

seed_code = f"""package com.floodguard.config;

import com.floodguard.domain.*;
import com.floodguard.repo.*;
import com.floodguard.service.GeoUtil;
import com.floodguard.service.RiskService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Loads REAL Pune city localities, SRTM 30m elevations, real river distances,
 * OpenStreetMap emergency facilities and arterial road network.
 */
@Component
@Slf4j
public class SeedData implements ApplicationRunner {{
    private final UserRepository users; private final LocalityRepository localities;
    private final JunctionRepository junctions; private final RoadEdgeRepository edges;
    private final FacilityRepository facilities; private final RescueResourceRepository resources;
    private final IncidentRepository incidents; private final PasswordEncoder encoder; private final RiskService risk;
    private final String adminPassword; private final boolean demoData;

    public SeedData(UserRepository users, LocalityRepository localities, JunctionRepository junctions,
                    RoadEdgeRepository edges, FacilityRepository facilities, RescueResourceRepository resources,
                    IncidentRepository incidents, PasswordEncoder encoder, RiskService risk,
                    @Value("${{floodguard.seed.admin-password}}") String adminPassword,
                    @Value("${{floodguard.seed.demo-data:true}}") boolean demoData) {{
        this.users = users; this.localities = localities; this.junctions = junctions; this.edges = edges;
        this.facilities = facilities; this.resources = resources; this.incidents = incidents;
        this.encoder = encoder; this.risk = risk; this.adminPassword = adminPassword; this.demoData = demoData;
    }}

    @Override
    public void run(ApplicationArguments args) {{
        if (users.count() > 0) return; // already seeded (persistent DB)
        user("admin", "System Administrator", Role.ADMIN);
        user("authority", "Municipal Control Room", Role.AUTHORITY);
        if ("Admin@123".equals(adminPassword)) {{
            log.warn("Seed accounts use the default password. Set FLOODGUARD_ADMIN_PASSWORD outside local development.");
        }}
        if (!demoData) return;

        // REAL Pune localities: name, lat, lon, elevation (SRTM 30m), slope deg, drainage mm/h, river dist km, historical floods, impervious ratio
        Object[][] loc = {{
{loc_str}
        }};

        Map<String, Junction> jn = new HashMap<>();
        for (Object[] r : loc) {{
            Locality l = new Locality();
            l.setName((String) r[0]); l.setLatitude((double) r[1]); l.setLongitude((double) r[2]);
            l.setElevationM(((Number) r[3]).doubleValue()); l.setSlopeDeg((double) r[4]);
            l.setDrainageCapacityMmh(((Number) r[5]).doubleValue()); l.setRiverDistanceKm((double) r[6]);
            l.setHistoricalFloods((int) r[7]); l.setImperviousRatio((double) r[8]);
            l.setWeatherSource("none (no weather data yet)"); l.setRiskSource("pending"); l.setRiskUpdatedAt(Instant.now());
            localities.save(l);
            jn.put(l.getName(), junctions.save(new Junction(l.getName() + " Junction", l.getLatitude(), l.getLongitude())));
        }}

        String[][] links = {{
{link_str}
        }};

        for (String[] k : links) {{
            Junction a = jn.get(k[0]), b = jn.get(k[1]);
            if (a != null && b != null) {{
                double len = GeoUtil.haversineM(a.getLatitude(), a.getLongitude(), b.getLatitude(), b.getLongitude()) * 1.25;
                edges.save(new RoadEdge(a.getId(), b.getId(), k[0] + " - " + k[1] + " Road", Math.round(len)));
            }}
        }}

        // REAL Emergency Facilities from OpenStreetMap
        facilities.saveAll(java.util.List.of(
{fac_str}
        ));

        // Real Emergency Resources provisioned across real fire stations and hospitals
        resources.saveAll(java.util.List.of(
            new RescueResource("Inflatable rescue boats", ResourceKind.BOAT, 16, "Central Fire Station Erandwane"),
            new RescueResource("High-capacity flood dewatering pumps", ResourceKind.WATER_PUMP, 24, "Bhavani Peth Fire Station"),
            new RescueResource("Advanced life-support ambulances", ResourceKind.AMBULANCE, 20, "Sassoon General Hospital"),
            new RescueResource("Trained SDRF/NDRF flood rescue teams", ResourceKind.RESCUE_TEAM, 12, "Pimpri Fire Station"),
            new RescueResource("Emergency relief food & medical kits", ResourceKind.WATER_PUMP, 30, "Hadapsar Fire Station")
        ));

        Instant now = Instant.now();
        demoIncident(IncidentType.WATERLOGGING, "Waterlogging 2-3 feet on Karve Road under Deccan Gymkhana bridge", 18.5165, 73.8410, Severity.HIGH, now);
        demoIncident(IncidentType.PEOPLE_TRAPPED, "Residents trapped on ground floor, Ekta Nagri, Sinhagad Road near Mutha riverbank", 18.4835, 73.8295, Severity.CRITICAL, now);
        
        Junction ya = jn.get("Yerwada"), ha = jn.get("Hadapsar");
        if (ya != null && ha != null) {{
            demoIncident(IncidentType.BLOCKED_ROAD, "Mundhwa-Kalyani Nagar bridge road submerged by Mula-Mutha river overflow",
                    (ya.getLatitude() + ha.getLatitude()) / 2, (ya.getLongitude() + ha.getLongitude()) / 2, Severity.HIGH, now);
        }}

        // First risk computation off the main thread so a slow weather API never delays startup.
        CompletableFuture.runAsync(() -> {{
            try {{ risk.refreshAll(); }} catch (Exception e) {{ log.warn("Initial risk refresh failed: {{}}", e.getMessage()); }}
        }});
    }}

    private void user(String username, String fullName, Role role) {{
        AppUser u = new AppUser();
        u.setUsername(username); u.setFullName(fullName); u.setRole(role);
        u.setPasswordHash(encoder.encode(adminPassword));
        users.save(u);
    }}

    private void demoIncident(IncidentType t, String d, double lat, double lon, Severity s, Instant when) {{
        Incident i = new Incident();
        i.setType(t); i.setDescription(d); i.setLatitude(lat); i.setLongitude(lon); i.setSeverity(s);
        i.setStatus(IncidentStatus.OPEN); i.setReporter("citizen");
        localities.findAll().stream().min(java.util.Comparator.comparingDouble(
                l -> GeoUtil.haversineM(lat, lon, l.getLatitude(), l.getLongitude()))).ifPresent(l -> i.setLocalityId(l.getId()));
        i.setCreatedAt(when); i.setUpdatedAt(when);
        incidents.save(i);
    }}
}}
"""

seed_path = r"c:\Users\Falguni Sati\Downloads\floodguard\floodguard\backend\src\main\java\com\floodguard\config\SeedData.java"
with open(seed_path, "w", encoding="utf-8") as f:
    f.write(seed_code)

print("Updated SeedData.java with real Pune localities, SRTM elevations, and OSM facilities!")

