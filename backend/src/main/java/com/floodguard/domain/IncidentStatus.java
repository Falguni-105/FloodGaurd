package com.floodguard.domain;
import java.util.List;
public enum IncidentStatus {
    OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, REJECTED;
    /** Statuses that still need attention (and still block roads / appear on the map). */
    public static final List<IncidentStatus> ACTIVE = List.of(OPEN, ASSIGNED, IN_PROGRESS);
}
