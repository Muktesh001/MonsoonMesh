export type Role = 'ADMIN' | 'OPERATOR' | 'FIELD_REPORTER';

export type User = {
  id: string;
  email: string;
  role: Role;
  displayName: string;
};

export type Severity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type IncidentStatus =
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED'
  | 'DUPLICATE'
  | 'REOPENED';

export type IncidentCategory =
  | 'WATERLOGGING'
  | 'FLOODING'
  | 'DRAINAGE'
  | 'ROAD_BLOCKAGE'
  | 'OTHER';

export type Incident = {
  id: string;
  title: string;
  description?: string;
  category: IncidentCategory;
  severity: Severity;
  status: IncidentStatus;
  is_synthetic: boolean;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at?: string;
  zone_name?: string;
};

export type RiskCategory = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type Dashboard = {
  summary: {
    total: number;
    verified: number;
    unresolved: number;
  };
  recent: Incident[];
  riskDistribution: { category: RiskCategory; count: number }[];
  dataLabel: string;
};

export type SimulationResult = {
  score: number;
  category: RiskCategory;
  label: string;
  modelVersion?: string;
};

export type SimulationFactors = {
  rainfall: number;
  history: number;
  slope: number;
  drainage: number;
  incidents: number;
};

export type ZoneProperties = {
  name: string;
  zoneType: string;
  synthetic: boolean;
  risk: number | null;
  category: RiskCategory | null;
};

export type IncidentEvent = {
  event_type: string;
  details: unknown;
  created_at: string;
};

export type IncidentEvidence = {
  id: string;
  media_type: string;
  size_bytes: number;
  created_at: string;
};

export type IncidentDetail = {
  incident: Incident;
  events: IncidentEvent[];
  evidence: IncidentEvidence[];
  relatedIncidents: { similarity_score: number; reasons: string[]; id: string; title: string; status: IncidentStatus }[];
};
