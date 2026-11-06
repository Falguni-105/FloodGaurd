package com.floodguard.service;

public final class GeoUtil {
    private GeoUtil() {}
    private static final double R = 6_371_000.0;

    public static double haversineM(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    /** Distance in metres from point P to segment AB (local equirectangular approximation; fine at city scale). */
    public static double pointToSegmentM(double pLat, double pLon, double aLat, double aLon, double bLat, double bLon) {
        double latRef = Math.toRadians((aLat + bLat) / 2);
        double mx = 111_320 * Math.cos(latRef), my = 110_540;
        double px = (pLon - aLon) * mx, py = (pLat - aLat) * my;
        double bx = (bLon - aLon) * mx, by = (bLat - aLat) * my;
        double len2 = bx * bx + by * by;
        double t = len2 == 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
        double dx = px - t * bx, dy = py - t * by;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
