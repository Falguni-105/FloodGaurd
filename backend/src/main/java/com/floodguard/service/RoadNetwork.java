package com.floodguard.service;

import com.floodguard.domain.*;
import com.floodguard.dto.Dtos.RouteResult;
import java.util.*;

/**
 * Immutable snapshot of the road graph at a moment in time: which segments are currently blocked by
 * active incident reports, and how risky each segment is. Routing is Dijkstra over this graph.
 */
public class RoadNetwork {
    public static final double BLOCK_RADIUS_M = 250;
    public static final double SPEED_KMH = 25; // assumed average emergency-vehicle speed in a flooded city

    record Arc(RoadEdge edge, long to) {}
    record Path(List<Long> nodes, List<RoadEdge> edges, double lengthM) {}

    private final Map<Long, Junction> nodes = new HashMap<>();
    private final Map<Long, List<Arc>> adj = new HashMap<>();
    private final List<RoadEdge> edges;
    private final Set<Long> blocked = new HashSet<>();
    private final Map<Long, Double> riskFactor = new HashMap<>();

    public static boolean blocksRoad(Incident i) {
        return i.getType() == IncidentType.BLOCKED_ROAD
                || (i.getType() == IncidentType.WATERLOGGING && (i.getSeverity() == Severity.HIGH || i.getSeverity() == Severity.CRITICAL));
    }

    public RoadNetwork(List<Junction> junctions, List<RoadEdge> edges, List<Incident> activeIncidents, List<Locality> localities) {
        this.edges = edges;
        junctions.forEach(j -> nodes.put(j.getId(), j));
        List<Incident> blockers = activeIncidents.stream().filter(RoadNetwork::blocksRoad).toList();
        for (RoadEdge e : edges) {
            Junction a = nodes.get(e.getFromId()), b = nodes.get(e.getToId());
            adj.computeIfAbsent(a.getId(), k -> new ArrayList<>()).add(new Arc(e, b.getId()));
            adj.computeIfAbsent(b.getId(), k -> new ArrayList<>()).add(new Arc(e, a.getId()));
            for (Incident inc : blockers) {
                if (GeoUtil.pointToSegmentM(inc.getLatitude(), inc.getLongitude(), a.getLatitude(), a.getLongitude(),
                        b.getLatitude(), b.getLongitude()) <= BLOCK_RADIUS_M) {
                    blocked.add(e.getId());
                    break;
                }
            }
            // roads through high-risk localities are penalised so routes prefer drier ground
            double midLat = (a.getLatitude() + b.getLatitude()) / 2, midLon = (a.getLongitude() + b.getLongitude()) / 2;
            Locality near = localities.stream().min(Comparator.comparingDouble(
                    l -> GeoUtil.haversineM(midLat, midLon, l.getLatitude(), l.getLongitude()))).orElse(null);
            double f = 1.0;
            if (near != null) f = switch (near.getRiskLevel()) { case HIGH -> 1.5; case MODERATE -> 1.15; case LOW -> 1.0; };
            riskFactor.put(e.getId(), f);
        }
    }

    public boolean isBlocked(Long edgeId) { return blocked.contains(edgeId); }
    public Set<Long> blockedEdgeIds() { return Collections.unmodifiableSet(blocked); }
    public List<RoadEdge> edges() { return edges; }
    public Junction junction(Long id) { return nodes.get(id); }

    public Junction nearest(double lat, double lon) {
        return nodes.values().stream().min(Comparator.comparingDouble(
                j -> GeoUtil.haversineM(lat, lon, j.getLatitude(), j.getLongitude()))).orElse(null);
    }

    private Path dijkstra(long start, long end, boolean respectBlocks) {
        Map<Long, Double> dist = new HashMap<>();
        Map<Long, Arc> prevArc = new HashMap<>();
        Map<Long, Long> prevNode = new HashMap<>();
        PriorityQueue<double[]> pq = new PriorityQueue<>(Comparator.comparingDouble(a -> a[1]));
        dist.put(start, 0.0);
        pq.add(new double[]{start, 0});
        while (!pq.isEmpty()) {
            double[] cur = pq.poll();
            long u = (long) cur[0];
            if (cur[1] > dist.getOrDefault(u, Double.MAX_VALUE)) continue;
            if (u == end) break;
            for (Arc arc : adj.getOrDefault(u, List.of())) {
                if (respectBlocks && blocked.contains(arc.edge().getId())) continue;
                double w = arc.edge().getLengthM() * riskFactor.getOrDefault(arc.edge().getId(), 1.0);
                double nd = cur[1] + w;
                if (nd < dist.getOrDefault(arc.to(), Double.MAX_VALUE)) {
                    dist.put(arc.to(), nd); prevArc.put(arc.to(), arc); prevNode.put(arc.to(), u);
                    pq.add(new double[]{arc.to(), nd});
                }
            }
        }
        if (!dist.containsKey(end)) return null;
        LinkedList<Long> ns = new LinkedList<>();
        LinkedList<RoadEdge> es = new LinkedList<>();
        double len = 0;
        for (long n = end; ; ) {
            ns.addFirst(n);
            if (n == start) break;
            RoadEdge e = prevArc.get(n).edge();
            es.addFirst(e); len += e.getLengthM();
            n = prevNode.get(n);
        }
        return new Path(ns, es, len);
    }

    public RouteResult route(double fLat, double fLon, double tLat, double tLon) {
        Junction a = nearest(fLat, fLon), b = nearest(tLat, tLon);
        if (a == null || b == null) return fail("No road network loaded", 0);
        Path free = dijkstra(a.getId(), b.getId(), false);
        if (free == null) return fail("No road connection exists between these points", 0);
        Path open = dijkstra(a.getId(), b.getId(), true);
        if (open == null) {
            return fail("No accessible route: blocked roads cut off the destination. Consider boat/air rescue.", blocked.size());
        }
        boolean detoured = !open.edges().stream().map(RoadEdge::getId).toList()
                .equals(free.edges().stream().map(RoadEdge::getId).toList());
        double connectors = GeoUtil.haversineM(fLat, fLon, a.getLatitude(), a.getLongitude())
                + GeoUtil.haversineM(tLat, tLon, b.getLatitude(), b.getLongitude());
        double totalM = open.lengthM() + connectors;
        List<double[]> pts = new ArrayList<>();
        pts.add(new double[]{fLat, fLon});
        for (Long n : open.nodes()) pts.add(new double[]{nodes.get(n).getLatitude(), nodes.get(n).getLongitude()});
        pts.add(new double[]{tLat, tLon});
        double extra = detoured ? Math.max(0, (open.lengthM() - free.lengthM()) / 1000.0) : 0;
        return new RouteResult(true, detoured ? "Alternative route avoiding blocked roads" : "Direct route",
                round(totalM / 1000.0), (int) Math.ceil(totalM / 1000.0 / SPEED_KMH * 60),
                pts, open.edges().stream().map(RoadEdge::getName).toList(), detoured, round(extra));
    }

    private static RouteResult fail(String msg, int blockedCount) {
        return new RouteResult(false, msg, 0, 0, List.of(), List.of(), false, 0);
    }

    private static double round(double v) { return Math.round(v * 100) / 100.0; }
}
