import type { Dashboard, Incident, IncidentDetail, SimulationFactors, SimulationResult, User } from './types.ts';
import type { FeatureCollection } from 'geojson';

export const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      'Cannot reach the server. Make sure the Docker services are running: docker compose up',
    );
  }
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new ApiError(response.status, (body.error as string | undefined) ?? 'Request failed');
  return body as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiError(
      0,
      'Cannot reach the server. Make sure the Docker services are running: docker compose up',
    );
  }
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new ApiError(response.status, (body.error as string | undefined) ?? 'Sign in failed');
  return body as { token: string; user: User };
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<{ token: string; user: User }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
  } catch {
    throw new ApiError(
      0,
      'Cannot reach the server. Make sure the Docker services are running: docker compose up',
    );
  }
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new ApiError(response.status, (body.error as string | undefined) ?? 'Registration failed');
  return body as { token: string; user: User };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function getDashboard(token: string): Promise<Dashboard> {
  return request<Dashboard>('/dashboard', token);
}

// ── Zones ─────────────────────────────────────────────────────────────────────

export function getZones(token: string): Promise<FeatureCollection> {
  return request<FeatureCollection>('/zones', token);
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export function getIncidents(
  token: string,
  params?: { page?: number; limit?: number; status?: string },
): Promise<{ items: Incident[]; page: number; limit: number }> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return request(`/incidents${qs ? `?${qs}` : ''}`, token);
}

export function getIncident(token: string, id: string): Promise<IncidentDetail> {
  return request(`/incidents/${id}`, token);
}

export function createIncident(
  token: string,
  data: {
    title: string;
    description: string;
    category: string;
    severity: string;
    latitude: number;
    longitude: number;
  },
): Promise<{ incident: { id: string; title: string; status: string } }> {
  return request('/incidents', token, { method: 'POST', body: JSON.stringify(data) });
}

export function updateIncidentStatus(
  token: string,
  id: string,
  status: string,
): Promise<{ incident: { id: string; status: string } }> {
  return request(`/incidents/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
}

// ── Risk simulation ───────────────────────────────────────────────────────────

export function runSimulation(token: string, factors: SimulationFactors): Promise<SimulationResult> {
  return request('/risk/simulate', token, { method: 'POST', body: JSON.stringify(factors) });
}

// ── External data feeds ────────────────────────────────────────────────────────

export interface WeatherObservation {
  id: string;
  source_id: string;
  provider_record_key: string;
  observed_at: string;
  latitude: number;
  longitude: number;
  rainfall_mm: string;
  is_synthetic: boolean;
}

export interface RiskAssessment {
  id: string;
  zone_id: string;
  zone_name: string;
  score: number;
  category: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  model_version: string;
  feature_values: Record<string, number>;
  assessed_at: string;
  is_synthetic: boolean;
}

export function getWeatherData(token: string): Promise<{ items: WeatherObservation[]; metadata: Record<string, unknown> }> {
  return request('/data/weather', token);
}

export function getRiskAssessments(token: string): Promise<{ items: RiskAssessment[]; metadata: Record<string, unknown> }> {
  return request('/data/risk-assessments', token);
}

// ── Analytics ──────────────────────────────────────────────────────────────

export interface AnalyticsMetrics {
  totalIncidents: number;
  weatherEvents: number;
  riskAssessments: number;
  avgResolutionTime: number;
  medianResolutionTime: number;
  timestamp: string;
}

export interface IncidentTrend {
  week: string;
  incidents: number;
}

export interface WeatherTrend {
  week: string;
  rainfall: number;
  observations: number;
}

export interface AnalyticsTrends {
  incidentTrends: IncidentTrend[];
  weatherTrends: WeatherTrend[];
}

export interface RiskZoneData {
  name: string;
  score: number;
  category: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  assessed_at: string;
  factors: Record<string, number>;
}

export interface RiskDistribution {
  zones: RiskZoneData[];
}

export interface ResponseStats {
  byStatus: {
    status: string;
    count: number;
    avgResolutionHours: number;
    medianResolutionHours: number;
  }[];
}

export interface UptimeStatus {
  status: string;
  apiResponseTime: string;
  databaseConnected: boolean;
  timestamp: string;
}

export function getAnalyticsMetrics(token: string): Promise<AnalyticsMetrics> {
  return request('/analytics/metrics', token);
}

export function getAnalyticsTrends(token: string): Promise<AnalyticsTrends> {
  return request('/analytics/trends', token);
}

export function getRiskDistribution(token: string): Promise<RiskDistribution> {
  return request('/analytics/risk-distribution', token);
}

export function getResponseStats(token: string): Promise<ResponseStats> {
  return request('/analytics/response-stats', token);
}

export function getUptimeStatus(token: string): Promise<UptimeStatus> {
  return request('/analytics/uptime', token);
}
