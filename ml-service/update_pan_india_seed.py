"""
Update SeedData.java with all 20 Pan-India flood disaster regions,
NDRF rescue battalions, premier disaster hospitals, and major relief shelters.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "india_real_geo.json")) as f:
    geo = json.load(f)

localities = geo["localities"]
facilities = geo["facilities"]

loc_rows = []
for l in localities:
    loc_rows.append(f'            {{"{l["name"]}", {l["lat"]}, {l["lon"]}, {l["elevation_m"]}, {l["slope_deg"]}, {l["drainage_capacity_mmh"]}, {l["river_distance_km"]}, {l["historical_floods"]}, {l["impervious_ratio"]}}},')

loc_str = "\n".join(loc_rows)

fac_rows = []
for f in facilities:
    fac_rows.append(f'            new Facility("{f["name"]}", FacilityType.{f["type"]}, {f["lat"]}, {f["lon"]}, {f["capacity"]}),')
# Remove trailing comma on last row
if fac_rows:
    fac_rows[-1] = fac_rows[-1].rstrip(',')
fac_str = "\n".join(fac_rows)

# Connect localities via major National Highway corridors
links = [
    # North-South Corridor
    ("Srinagar (Jhelum Basin - Rajbagh)", "Delhi (Yamuna Floodplain - Kashmere Gate)"),
    ("Kedarnath (Mandakini River Valley)", "Delhi (Yamuna Floodplain - Kashmere Gate)"),
    ("Delhi (Yamuna Floodplain - Kashmere Gate)", "Ahmedabad (Sabarmati Basin)"),
    ("Delhi (Yamuna Floodplain - Kashmere Gate)", "Gorakhpur (Rapti & Rohini Basin)"),
    ("Barmer (Luni River Basin - Kawas)", "Ahmedabad (Sabarmati Basin)"),
    ("Ahmedabad (Sabarmati Basin)", "Surat (Tapi Basin - Adajan)"),
    ("Surat (Tapi Basin - Adajan)", "Mumbai (Mithi Basin - Kurla/Kalina)"),
    ("Mumbai (Mithi Basin - Kurla/Kalina)", "Pune (Mutha Basin - Deccan / Sinhagad Rd)"),
    ("Pune (Mutha Basin - Deccan / Sinhagad Rd)", "Hyderabad (Musi Basin - Falaknuma)"),
    ("Pune (Mutha Basin - Deccan / Sinhagad Rd)", "Bengaluru (Bellandur Lake Basin)"),
    ("Hyderabad (Musi Basin - Falaknuma)", "Vijayawada (Budameru & Krishna Basin)"),
    ("Vijayawada (Budameru & Krishna Basin)", "Chennai (Adyar Basin - Saidapet/Velachery)"),
    ("Bengaluru (Bellandur Lake Basin)", "Chennai (Adyar Basin - Saidapet/Velachery)"),
    ("Bengaluru (Bellandur Lake Basin)", "Wayanad (Chooralmala / Meppadi)"),
    ("Wayanad (Chooralmala / Meppadi)", "Kochi & Aluva (Periyar Basin)"),

    # East-West & Gangetic Corridor
    ("Gorakhpur (Rapti & Rohini Basin)", "Patna (Rajendra Nagar / Ganga Basin)"),
    ("Patna (Rajendra Nagar / Ganga Basin)", "Kolkata (Hooghly Basin - Kalighat)"),
    ("Kolkata (Hooghly Basin - Kalighat)", "Cuttack & Bhubaneswar (Mahanadi Basin)"),
    ("Cuttack & Bhubaneswar (Mahanadi Basin)", "Vijayawada (Budameru & Krishna Basin)"),
    ("Patna (Rajendra Nagar / Ganga Basin)", "Guwahati (Brahmaputra / Bharalu Basin)"),
    ("Guwahati (Brahmaputra / Bharalu Basin)", "Agartala (Howrah Basin)")
]

link_rows = []
for a, b in links:
    link_rows.append(f'            {{"{a}", "{b}"}},')
link_str = "\n".join(link_rows)

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
 * Loads REAL Pan-India flood disaster regions (2004-2024),
 * SRTM 30m elevations, physical river proximities, NDRF rescue battalions,
 * apex disaster hospitals, and national emergency transport corridors.
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
        if (users.count() > 0) return;
        user("admin", "National Disaster Authority", Role.ADMIN);
        user("authority", "National Flood Control Room", Role.AUTHORITY);
        if ("Admin@123".equals(adminPassword)) {{
            log.warn("Seed accounts use the default password. Set FLOODGUARD_ADMIN_PASSWORD outside local development.");
        }}
        if (!demoData) return;

        // 20 Major Historical Flood Zones across India (2004-2024)
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
            jn.put(l.getName(), junctions.save(new Junction(l.getName() + " Emergency Hub", l.getLatitude(), l.getLongitude())));
        }}

        String[][] links = {{
{link_str}
        }};

        for (String[] k : links) {{
            Junction a = jn.get(k[0]), b = jn.get(k[1]);
            if (a != null && b != null) {{
                double len = GeoUtil.haversineM(a.getLatitude(), a.getLongitude(), b.getLatitude(), b.getLongitude()) * 1.25;
                edges.save(new RoadEdge(a.getId(), b.getId(), k[0] + " - " + k[1] + " Highway", Math.round(len)));
            }}
        }}

        // Real NDRF Bases, Apex Hospitals & Mega Shelters
        facilities.saveAll(java.util.List.of(
{fac_str}
        ));

        // National Disaster Response Force (NDRF) & SDRF Prepositioned Rescue Resources
        resources.saveAll(java.util.List.of(
            new RescueResource("Inflatable B-Type Motorized Rescue Boats", ResourceKind.BOAT, 45, "NDRF 5th Battalion Headquarters"),
            new RescueResource("Heavy High-Head Dewatering Pumps", ResourceKind.WATER_PUMP, 60, "Mumbai Fire Brigade Headquarters Byculla"),
            new RescueResource("Advanced Life Support (ALS) Disaster Ambulances", ResourceKind.AMBULANCE, 50, "AIIMS New Delhi Emergency Centre"),
            new RescueResource("Flood Water Rescue Teams (NDRF)", ResourceKind.RESCUE_TEAM, 30, "NDRF 10th Battalion Vijayawada (AP)"),
            new RescueResource("Deep Dive & Swift Water Rescue Unit", ResourceKind.BOAT, 25, "SDRF Central Fire & Marine Base Kochi"),
            new RescueResource("Helicopter Emergency Medical Evac Kits", ResourceKind.WATER_PUMP, 20, "NDRF 1st Battalion Guwahati (Assam/NE)")
        ));

        Instant now = Instant.now();
        demoIncident(IncidentType.WATERLOGGING, "Extreme waterlogging 4-5 feet near Prakasham barrage & Singh Nagar, Budameru overflow", 16.5380, 80.6380, Severity.CRITICAL, now);
        demoIncident(IncidentType.PEOPLE_TRAPPED, "Submerged residential colony, Chooralmala riverbank, flash flood evacuation underway", 11.5300, 76.1300, Severity.CRITICAL, now);
        demoIncident(IncidentType.BLOCKED_ROAD, "Yamuna river water submerged Ring Road & Monastery market, Kashmere Gate", 28.6670, 77.2280, Severity.HIGH, now);

        // Async risk computation
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
        i.setStatus(IncidentStatus.OPEN); i.setReporter("disaster-control");
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

print("Updated SeedData.java with 20 Pan-India flood zones and 33 emergency facilities!")

