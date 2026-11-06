package com.floodguard.service;

import com.floodguard.domain.*;
import com.floodguard.dto.Dtos.*;
import com.floodguard.repo.*;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class RoutingService {
    private final JunctionRepository junctions;
    private final RoadEdgeRepository edges;
    private final IncidentRepository incidents;
    private final LocalityRepository localities;
    private final FacilityRepository facilities;
    private final IncidentService incidentService;

    public RoutingService(JunctionRepository junctions, RoadEdgeRepository edges, IncidentRepository incidents,
                          LocalityRepository localities, FacilityRepository facilities, IncidentService incidentService) {
        this.junctions = junctions; this.edges = edges; this.incidents = incidents;
        this.localities = localities; this.facilities = facilities; this.incidentService = incidentService;
    }

    public RoadNetwork snapshot() {
        return new RoadNetwork(junctions.findAll(), edges.findAll(),
                incidents.findByStatusIn(IncidentStatus.ACTIVE), localities.findAll());
    }

    public RouteResult route(double fLat, double fLon, double tLat, double tLon) {
        return snapshot().route(fLat, fLon, tLat, tLon);
    }

    public List<RoadDto> roads() {
        RoadNetwork net = snapshot();
        List<RoadDto> out = new ArrayList<>();
        for (RoadEdge e : net.edges()) {
            Junction a = net.junction(e.getFromId()), b = net.junction(e.getToId());
            out.add(new RoadDto(e.getId(), e.getName(), a.getLatitude(), a.getLongitude(),
                    b.getLatitude(), b.getLongitude(), e.getLengthM(), net.isBlocked(e.getId())));
        }
        return out;
    }

    /**
     * Dispatch plan: active incidents in priority order, each with the nearest rescue base that can actually
     * reach it (avoiding blocked roads), plus the nearest hospital and shelter.
     */
    public List<PlanItem> plan() {
        RoadNetwork net = snapshot();
        List<Facility> open = facilities.findAll().stream().filter(Facility::isOpen).toList();
        List<Facility> bases = open.stream().filter(f -> f.getType() == FacilityType.RESCUE_BASE).toList();
        List<Facility> hospitals = open.stream().filter(f -> f.getType() == FacilityType.HOSPITAL).toList();
        List<Facility> shelters = open.stream().filter(f -> f.getType() == FacilityType.SHELTER).toList();

        List<PlanItem> plan = new ArrayList<>();
        int rank = 1;
        for (IncidentDto inc : incidentService.activeByPriority()) {
            Best base = best(net, inc, bases, true);
            Best hosp = best(net, inc, hospitals, false);
            Best shel = best(net, inc, shelters, false);
            RouteResult route = base != null ? base.route
                    : new RouteResult(false, "No rescue base can reach this location by road", 0, 0, List.of(), List.of(), false, 0);
            plan.add(new PlanItem(rank++, inc, base == null ? null : base.facility.getName(), route,
                    hosp == null ? null : hosp.facility.getName(), hosp == null ? null : hosp.route.distanceKm(),
                    shel == null ? null : shel.facility.getName(), shel == null ? null : shel.route.distanceKm(),
                    base != null));
        }
        return plan;
    }

    private record Best(Facility facility, RouteResult route) {}

    private Best best(RoadNetwork net, IncidentDto inc, List<Facility> targets, boolean fromFacility) {
        return targets.stream()
                .map(f -> new Best(f, fromFacility
                        ? net.route(f.getLatitude(), f.getLongitude(), inc.latitude(), inc.longitude())
                        : net.route(inc.latitude(), inc.longitude(), f.getLatitude(), f.getLongitude())))
                .filter(b -> b.route.found())
                .min(Comparator.comparingDouble(b -> b.route.distanceKm()))
                .orElse(null);
    }
}
