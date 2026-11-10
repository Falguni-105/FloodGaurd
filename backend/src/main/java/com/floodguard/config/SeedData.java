package com.floodguard.config;

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
public class SeedData implements ApplicationRunner {
    private final UserRepository users; private final LocalityRepository localities;
    private final JunctionRepository junctions; private final RoadEdgeRepository edges;
    private final FacilityRepository facilities; private final RescueResourceRepository resources;
    private final IncidentRepository incidents; private final PasswordEncoder encoder; private final RiskService risk;
    private final String adminPassword; private final boolean demoData;

    public SeedData(UserRepository users, LocalityRepository localities, JunctionRepository junctions,
                    RoadEdgeRepository edges, FacilityRepository facilities, RescueResourceRepository resources,
                    IncidentRepository incidents, PasswordEncoder encoder, RiskService risk,
                    @Value("${floodguard.seed.admin-password}") String adminPassword,
                    @Value("${floodguard.seed.demo-data:true}") boolean demoData) {
        this.users = users; this.localities = localities; this.junctions = junctions; this.edges = edges;
        this.facilities = facilities; this.resources = resources; this.incidents = incidents;
        this.encoder = encoder; this.risk = risk; this.adminPassword = adminPassword; this.demoData = demoData;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (users.count() > 0) return;
        user("admin", "National Disaster Authority", Role.ADMIN);
        user("authority", "National Flood Control Room", Role.AUTHORITY);
        if ("Admin@123".equals(adminPassword)) {
            log.warn("Seed accounts use the default password. Set FLOODGUARD_ADMIN_PASSWORD outside local development.");
        }
        if (!demoData) return;

        // Pan-India Flood & Mountain Disaster Zones across 16 States (2004-2024)
        Object[][] loc = {
            {"Mumbai (Mithi Basin - Kurla/Kalina)", 19.0657, 72.8797, 8.0, 1.2, 25.0, 0.15, 15, 0.92},
            {"Chennai (Adyar Basin - Saidapet/Velachery)", 13.021, 80.223, 7.0, 1.0, 22.0, 0.2, 13, 0.88},
            {"Srinagar (Jhelum Basin - Rajbagh)", 34.068, 74.821, 1585.0, 2.5, 18.0, 0.18, 9, 0.74},
            {"Kedarnath (Mandakini River Valley)", 30.7346, 79.0669, 3583.0, 14.5, 35.0, 0.1, 8, 0.35},
            {"Kullu & Manali (Beas River Basin)", 31.9579, 77.1095, 2050.0, 15.8, 32.0, 0.12, 10, 0.38},
            {"Chungthang & Singtam (Teesta River Basin)", 27.6042, 88.6462, 1790.0, 18.2, 35.0, 0.1, 8, 0.32},
            {"Rishikesh & Chamoli (Alaknanda Basin)", 30.38, 79.33, 1150.0, 13.5, 30.0, 0.15, 11, 0.42},
            {"Cherrapunji & Mawsynram (Wah Umngot Basin)", 25.2986, 91.7314, 1484.0, 14.0, 40.0, 0.2, 14, 0.35},
            {"Pasighat (Siang River Basin)", 28.0667, 95.3333, 155.0, 8.5, 25.0, 0.25, 9, 0.4},
            {"Kochi & Aluva (Periyar Basin)", 10.1076, 76.3516, 8.0, 1.0, 24.0, 0.15, 12, 0.78},
            {"Wayanad (Chooralmala / Meppadi)", 11.53, 76.13, 780.0, 11.2, 30.0, 0.12, 11, 0.4},
            {"Patna (Rajendra Nagar / Ganga Basin)", 25.602, 85.158, 53.0, 0.8, 16.0, 0.75, 14, 0.86},
            {"Guwahati (Brahmaputra / Bharalu Basin)", 26.185, 91.75, 54.0, 2.8, 20.0, 0.25, 18, 0.78},
            {"Surat (Tapi Basin - Adajan)", 21.195, 72.81, 13.0, 0.9, 22.0, 0.25, 8, 0.85},
            {"Vijayawada (Budameru & Krishna Basin)", 16.538, 80.638, 19.0, 1.1, 20.0, 0.3, 10, 0.82},
            {"Delhi (Yamuna Floodplain - Kashmere Gate)", 28.667, 77.228, 212.0, 1.0, 24.0, 0.2, 10, 0.88},
            {"Hyderabad (Musi Basin - Falaknuma)", 17.3616, 78.4747, 505.0, 1.8, 21.0, 0.25, 10, 0.85},
            {"Bengaluru (Bellandur Lake Basin)", 12.926, 77.6762, 885.0, 1.5, 25.0, 0.35, 8, 0.82},
            {"Kolkata (Hooghly Basin - Kalighat)", 22.52, 88.345, 9.0, 0.8, 19.0, 0.4, 14, 0.9},
            {"Cuttack & Bhubaneswar (Mahanadi Basin)", 20.4625, 85.883, 24.0, 1.0, 20.0, 0.3, 12, 0.76},
            {"Gorakhpur (Rapti & Rohini Basin)", 26.7606, 83.3732, 84.0, 0.9, 17.0, 0.45, 15, 0.7},
            {"Barmer (Luni River Basin - Kawas)", 25.7521, 71.3967, 178.0, 2.2, 28.0, 1.2, 5, 0.45},
            {"Agartala (Howrah Basin)", 23.8315, 91.2868, 15.0, 1.2, 22.0, 0.22, 9, 0.72},
            {"Pune (Mutha Basin - Deccan / Sinhagad Rd)", 18.5167, 73.8412, 559.0, 1.8, 20.0, 0.2, 9, 0.85},
            {"Ahmedabad (Sabarmati Basin)", 23.0225, 72.5714, 53.0, 1.1, 23.0, 0.25, 7, 0.84},
        };

        Map<String, Junction> jn = new HashMap<>();
        for (Object[] r : loc) {
            Locality l = new Locality();
            l.setName((String) r[0]); l.setLatitude((double) r[1]); l.setLongitude((double) r[2]);
            l.setElevationM(((Number) r[3]).doubleValue()); l.setSlopeDeg((double) r[4]);
            l.setDrainageCapacityMmh(((Number) r[5]).doubleValue()); l.setRiverDistanceKm((double) r[6]);
            l.setHistoricalFloods((int) r[7]); l.setImperviousRatio((double) r[8]);
            l.setRiskLevel(RiskLevel.LOW);
            l.setRiskScore(25.0);
            l.setWeatherSource("none (no weather data yet)"); l.setRiskSource("pending"); l.setRiskUpdatedAt(Instant.now());
            localities.save(l);
            jn.put(l.getName(), junctions.save(new Junction(l.getName() + " Emergency Hub", l.getLatitude(), l.getLongitude())));
        }

        String[][] links = {
            {"Srinagar (Jhelum Basin - Rajbagh)", "Delhi (Yamuna Floodplain - Kashmere Gate)"},
            {"Kedarnath (Mandakini River Valley)", "Delhi (Yamuna Floodplain - Kashmere Gate)"},
            {"Kullu & Manali (Beas River Basin)", "Delhi (Yamuna Floodplain - Kashmere Gate)"},
            {"Kullu & Manali (Beas River Basin)", "Srinagar (Jhelum Basin - Rajbagh)"},
            {"Rishikesh & Chamoli (Alaknanda Basin)", "Kedarnath (Mandakini River Valley)"},
            {"Rishikesh & Chamoli (Alaknanda Basin)", "Delhi (Yamuna Floodplain - Kashmere Gate)"},
            {"Chungthang & Singtam (Teesta River Basin)", "Kolkata (Hooghly Basin - Kalighat)"},
            {"Cherrapunji & Mawsynram (Wah Umngot Basin)", "Guwahati (Brahmaputra / Bharalu Basin)"},
            {"Pasighat (Siang River Basin)", "Guwahati (Brahmaputra / Bharalu Basin)"},
            {"Delhi (Yamuna Floodplain - Kashmere Gate)", "Ahmedabad (Sabarmati Basin)"},
            {"Delhi (Yamuna Floodplain - Kashmere Gate)", "Gorakhpur (Rapti & Rohini Basin)"},
            {"Barmer (Luni River Basin - Kawas)", "Ahmedabad (Sabarmati Basin)"},
            {"Ahmedabad (Sabarmati Basin)", "Surat (Tapi Basin - Adajan)"},
            {"Surat (Tapi Basin - Adajan)", "Mumbai (Mithi Basin - Kurla/Kalina)"},
            {"Mumbai (Mithi Basin - Kurla/Kalina)", "Pune (Mutha Basin - Deccan / Sinhagad Rd)"},
            {"Pune (Mutha Basin - Deccan / Sinhagad Rd)", "Hyderabad (Musi Basin - Falaknuma)"},
            {"Pune (Mutha Basin - Deccan / Sinhagad Rd)", "Bengaluru (Bellandur Lake Basin)"},
            {"Hyderabad (Musi Basin - Falaknuma)", "Vijayawada (Budameru & Krishna Basin)"},
            {"Vijayawada (Budameru & Krishna Basin)", "Chennai (Adyar Basin - Saidapet/Velachery)"},
            {"Bengaluru (Bellandur Lake Basin)", "Chennai (Adyar Basin - Saidapet/Velachery)"},
            {"Bengaluru (Bellandur Lake Basin)", "Wayanad (Chooralmala / Meppadi)"},
            {"Wayanad (Chooralmala / Meppadi)", "Kochi & Aluva (Periyar Basin)"},
            {"Gorakhpur (Rapti & Rohini Basin)", "Patna (Rajendra Nagar / Ganga Basin)"},
            {"Patna (Rajendra Nagar / Ganga Basin)", "Kolkata (Hooghly Basin - Kalighat)"},
            {"Kolkata (Hooghly Basin - Kalighat)", "Cuttack & Bhubaneswar (Mahanadi Basin)"},
            {"Cuttack & Bhubaneswar (Mahanadi Basin)", "Vijayawada (Budameru & Krishna Basin)"},
            {"Patna (Rajendra Nagar / Ganga Basin)", "Guwahati (Brahmaputra / Bharalu Basin)"},
            {"Guwahati (Brahmaputra / Bharalu Basin)", "Agartala (Howrah Basin)"},
        };

        for (String[] k : links) {
            Junction a = jn.get(k[0]), b = jn.get(k[1]);
            if (a != null && b != null) {
                double len = GeoUtil.haversineM(a.getLatitude(), a.getLongitude(), b.getLatitude(), b.getLongitude()) * 1.25;
                edges.save(new RoadEdge(a.getId(), b.getId(), k[0] + " - " + k[1] + " Highway", Math.round(len)));
            }
        }

        // Real NDRF Bases, Apex Hospitals & Mega Shelters
        facilities.saveAll(java.util.List.of(
            new Facility("NDRF 5th Battalion Headquarters", FacilityType.RESCUE_BASE, 18.75, 73.85, 0),
            new Facility("NDRF 8th Battalion Ghaziabad (NCR/Delhi)", FacilityType.RESCUE_BASE, 28.67, 77.43, 0),
            new Facility("NDRF 4th Battalion Arakkonam (Chennai)", FacilityType.RESCUE_BASE, 13.08, 79.67, 0),
            new Facility("NDRF 1st Battalion Guwahati (Assam/NE)", FacilityType.RESCUE_BASE, 26.15, 91.7, 0),
            new Facility("NDRF 9th Battalion Bihta (Patna/Bihar)", FacilityType.RESCUE_BASE, 25.56, 84.87, 0),
            new Facility("NDRF 10th Battalion Vijayawada (AP)", FacilityType.RESCUE_BASE, 16.51, 80.62, 0),
            new Facility("NDRF 3rd Battalion Mundali (Cuttack/Odisha)", FacilityType.RESCUE_BASE, 20.44, 85.8, 0),
            new Facility("SDRF Disaster Response Centre Srinagar", FacilityType.RESCUE_BASE, 34.08, 74.8, 0),
            new Facility("SDRF Central Fire & Marine Base Kochi", FacilityType.RESCUE_BASE, 9.97, 76.28, 0),
            new Facility("Himachal Pradesh SDRF Base Kullu", FacilityType.RESCUE_BASE, 31.95, 77.10, 0),
            new Facility("ITBP Disaster Response Hub Gangtok", FacilityType.RESCUE_BASE, 27.33, 88.61, 0),
            new Facility("Mumbai Fire Brigade Headquarters Byculla", FacilityType.RESCUE_BASE, 18.975, 72.833, 0),
            new Facility("AIIMS New Delhi Emergency Centre", FacilityType.HOSPITAL, 28.5672, 77.21, 2500),
            new Facility("AIIMS Rishikesh Apex Trauma Centre", FacilityType.HOSPITAL, 30.075, 78.288, 1200),
            new Facility("Regional Hospital Kullu (Himalayan Trauma Centre)", FacilityType.HOSPITAL, 31.96, 77.11, 450),
            new Facility("STNM Multi-Speciality Hospital Gangtok", FacilityType.HOSPITAL, 27.32, 88.60, 1000),
            new Facility("KEM Hospital & Seth GS Medical College Mumbai", FacilityType.HOSPITAL, 19.002, 72.842, 1800),
            new Facility("Rajiv Gandhi Government General Hospital Chennai", FacilityType.HOSPITAL, 13.081, 80.278, 2700),
            new Facility("Sher-i-Kashmir Institute of Medical Sciences Srinagar", FacilityType.HOSPITAL, 34.135, 74.802, 1200),
            new Facility("AIIMS Patna Apex Trauma Centre", FacilityType.HOSPITAL, 25.56, 85.044, 1000),
            new Facility("Gauhati Medical College Hospital Assam", FacilityType.HOSPITAL, 26.158, 91.772, 2200),
            new Facility("Government Medical College Ernakulam (Kochi)", FacilityType.HOSPITAL, 10.055, 76.355, 900),
            new Facility("New Government General Hospital Vijayawada", FacilityType.HOSPITAL, 16.512, 80.64, 1100),
            new Facility("SCB Medical College & Hospital Cuttack", FacilityType.HOSPITAL, 20.478, 85.89, 2100),
            new Facility("Nizam's Institute of Medical Sciences Hyderabad", FacilityType.HOSPITAL, 17.422, 78.453, 1500),
            new Facility("Sassoon General Hospital & BJMC Pune", FacilityType.HOSPITAL, 18.5255, 73.871, 1200),
            new Facility("BRD Medical College Gorakhpur", FacilityType.HOSPITAL, 26.788, 83.39, 1100),
            new Facility("Jawaharlal Nehru Stadium Relief Centre Delhi", FacilityType.SHELTER, 28.583, 77.234, 5000),
            new Facility("BKC Exhibition & Relief Centre Mumbai", FacilityType.SHELTER, 19.065, 72.868, 4000),
            new Facility("Jawaharlal Nehru Indoor Stadium Shelter Chennai", FacilityType.SHELTER, 13.084, 80.274, 3500),
            new Facility("Kashmir University Relief Shelter Srinagar", FacilityType.SHELTER, 34.128, 74.838, 2500),
            new Facility("Patliputra Sports Complex Shelter Patna", FacilityType.SHELTER, 25.602, 85.155, 3000),
            new Facility("Sarusajai Indoor Stadium Shelter Guwahati", FacilityType.SHELTER, 26.115, 91.745, 3500),
            new Facility("CIAL Convention & Evacuation Centre Kochi", FacilityType.SHELTER, 10.155, 76.39, 3000),
            new Facility("Indira Gandhi Municipal Stadium Shelter Vijayawada", FacilityType.SHELTER, 16.505, 80.65, 4000),
            new Facility("Barabati Stadium Relief Shelter Cuttack", FacilityType.SHELTER, 20.481, 85.868, 4000),
            new Facility("Balewadi Sports Complex Relief Shelter Pune", FacilityType.SHELTER, 18.574, 73.771, 2500),
            new Facility("Dhalpur Ground Relief Shelter Kullu", FacilityType.SHELTER, 31.955, 77.105, 3000),
            new Facility("Singtam Community Relief Shelter Sikkim", FacilityType.SHELTER, 27.23, 88.50, 2500),
            new Facility("Gachibowli Indoor Stadium Shelter Hyderabad", FacilityType.SHELTER, 17.445, 78.348, 3000)
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
        CompletableFuture.runAsync(() -> {
            try { risk.refreshAll(); } catch (Exception e) { log.warn("Initial risk refresh failed: {}", e.getMessage()); }
        });
    }

    private void user(String username, String fullName, Role role) {
        AppUser u = new AppUser();
        u.setUsername(username); u.setFullName(fullName); u.setRole(role);
        u.setPasswordHash(encoder.encode(adminPassword));
        users.save(u);
    }

    private void demoIncident(IncidentType t, String d, double lat, double lon, Severity s, Instant when) {
        Incident i = new Incident();
        i.setType(t); i.setDescription(d); i.setLatitude(lat); i.setLongitude(lon); i.setSeverity(s);
        i.setStatus(IncidentStatus.OPEN); i.setReporter("disaster-control");
        localities.findAll().stream().min(java.util.Comparator.comparingDouble(
                l -> GeoUtil.haversineM(lat, lon, l.getLatitude(), l.getLongitude()))).ifPresent(l -> i.setLocalityId(l.getId()));
        i.setCreatedAt(when); i.setUpdatedAt(when);
        incidents.save(i);
    }
}
