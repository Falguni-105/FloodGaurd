export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentType = 'WATERLOGGING' | 'BLOCKED_ROAD' | 'DRAINAGE_OVERFLOW' | 'PEOPLE_TRAPPED' | 'MEDICAL_EMERGENCY' | 'OTHER';
export type IncidentStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
export type FacilityType = 'HOSPITAL' | 'SHELTER' | 'RESCUE_BASE';

export interface User { token: string; username: string; fullName: string; role: 'CITIZEN' | 'AUTHORITY' | 'ADMIN'; }

export interface Risk {
  id: number; name: string; latitude: number; longitude: number; elevationM: number;
  riskLevel: RiskLevel; riskScore: number;
  rainfall24hMm: number; rainfallIntensityMmh: number; rainfall3dayMm: number;
  weatherSource: string; riskSource: string; updatedAt: string;
}
export interface PublicIncident {
  id: number; type: IncidentType; severity: Severity; status: IncidentStatus;
  latitude: number; longitude: number; createdAt: string; locality: string | null;
}
export interface Incident extends PublicIncident {
  description: string; reporter: string | null; hasImage: boolean; imageFile: string | null;
  assignedTo: string | null; updatedAt: string; priority: number;
}
export interface Facility { id: number; name: string; type: FacilityType; latitude: number; longitude: number; capacity: number; open: boolean; }
export interface NearbyFacility { facility: Facility; distanceKm: number; }
export interface Road { id: number; name: string; fromLat: number; fromLon: number; toLat: number; toLon: number; lengthM: number; blocked: boolean; }
export interface Resource { id: number; name: string; kind: string; total: number; available: number; base: string; }
export interface Route {
  found: boolean; message: string; distanceKm: number; etaMinutes: number;
  path: [number, number][]; roads: string[]; detoured: boolean; extraKmVsNormal: number;
}
export interface PlanItem {
  rank: number; incident: Incident; rescueBase: string | null; routeFromBase: Route;
  nearestHospital: string | null; hospitalKm: number | null;
  nearestShelter: string | null; shelterKm: number | null; accessible: boolean;
}
export interface Summary {
  activeIncidents: number; incidentsByStatus: Record<string, number>; activeBySeverity: Record<string, number>;
  localitiesByRisk: Record<string, number>; blockedRoads: number; blockedRoadNames: string[];
  resources: Resource[]; openFacilities: Record<string, number>; highestRisk: Risk[]; generatedAt: string;
}
