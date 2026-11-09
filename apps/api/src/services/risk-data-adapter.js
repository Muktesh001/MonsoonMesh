/**
 * Risk assessment data adapter
 * Integrates external risk models and historical flood data
 */
import { pool } from '../db.js';
import { calculateRisk } from './risk.js';
/**
 * Fetch historical flood data from external source
 * Real implementation would connect to national flood archives
 */
export async function fetchHistoricalFloodData() {
    // Mock: Historical flood frequency (incidents per year in each zone)
    return {
        'Shivajinagar': 3.2,
        'Kothrud': 1.8,
        'Hadapsar': 5.1,
    };
}
/**
 * Calculate risk factors from multiple external sources
 */
export async function calculateExternalRiskFactors(zoneName, recentRainfallMm) {
    const historicalData = await fetchHistoricalFloodData();
    const historyScore = (historicalData[zoneName] || 2) * 20; // Convert to 0-100 scale
    // Mock terrain data (would come from DEM/GIS database)
    const terrainSlopes = {
        'Shivajinagar': 35,
        'Kothrud': 28,
        'Hadapsar': 42,
    };
    // Mock drainage infrastructure data
    const drainageScores = {
        'Shivajinagar': 55,
        'Kothrud': 70,
        'Hadapsar': 45,
    };
    // Recent incident count (from last 30 days)
    const incidentCount = await pool.query(`SELECT COUNT(*)::int as count FROM incidents
     WHERE zone_id = (SELECT id FROM zones WHERE name = $1)
     AND created_at > now() - interval '30 days'`, [zoneName]);
    const incidentScore = Math.min((incidentCount.rows[0]?.count || 0) * 15, 100);
    return {
        rainfall: Math.min(recentRainfallMm * 2, 100), // Normalize rainfall
        history: Math.min(historyScore, 100),
        slope: terrainSlopes[zoneName] || 50,
        drainage: drainageScores[zoneName] || 50,
        incidents: incidentScore,
    };
}
/**
 * Assess risk for all zones using external data
 */
export async function assessZoneRisks() {
    // Get all zones
    const zones = await pool.query(`SELECT id, name FROM zones WHERE is_synthetic = false`);
    if (!zones.rowCount) {
        console.log('No non-synthetic zones found, skipping external risk assessment');
        return [];
    }
    const assessments = [];
    for (const zone of zones.rows) {
        // Get recent rainfall for this zone
        const recentWeather = await pool.query(`SELECT AVG(rainfall_mm) as avg_rainfall FROM weather_observations
       WHERE is_synthetic = false
       AND observed_at > now() - interval '6 hours'`);
        const recentRainfall = recentWeather.rows[0]?.avg_rainfall || 0;
        // Calculate factors
        const factors = await calculateExternalRiskFactors(zone.name, recentRainfall);
        // Calculate overall risk
        const { score, category } = calculateRisk(factors);
        assessments.push({
            zoneId: zone.id,
            zoneName: zone.name,
            factors,
            source: 'EXTERNAL_INTEGRATED',
            timestamp: new Date(),
        });
        // Store assessment in database
        await pool.query(`INSERT INTO risk_assessments(
        zone_id, score, category, model_version, feature_values, feature_contributions, is_synthetic
      ) VALUES ($1, $2, $3, $4, $5, $6, false)`, [
            zone.id,
            score,
            category,
            'external-integrated-v1',
            JSON.stringify(factors),
            JSON.stringify({
                rainfall: factors.rainfall * 0.35,
                history: factors.history * 0.20,
                slope: factors.slope * 0.15,
                drainage: factors.drainage * 0.15,
                incidents: factors.incidents * 0.15,
            }),
        ]);
    }
    return assessments;
}
/**
 * Fetch risk data from external USGS flood prediction service
 * Real implementation would call: https://waterdata.usgs.gov/
 */
export async function fetchUSGSFloodData() {
    // Mock USGS data integration
    const zones = await pool.query(`SELECT id, name FROM zones LIMIT 3`);
    return zones.rows.map((zone) => ({
        zoneId: zone.id,
        zoneName: zone.name,
        factors: {
            rainfall: Math.random() * 80,
            history: Math.random() * 70,
            slope: Math.random() * 60,
            drainage: Math.random() * 70,
            incidents: Math.random() * 50,
        },
        source: 'USGS',
        timestamp: new Date(),
    }));
}
/**
 * Ingest external risk assessment
 */
export async function ingestExternalRiskAssessment(assessment) {
    const { score, category } = calculateRisk(assessment.factors);
    await pool.query(`INSERT INTO risk_assessments(
      zone_id, score, category, model_version, feature_values, is_synthetic
    ) VALUES ($1, $2, $3, $4, $5, false)
    ON CONFLICT(zone_id, assessed_at) DO NOTHING`, [
        assessment.zoneId,
        score,
        category,
        `external-${assessment.source.toLowerCase()}-v1`,
        JSON.stringify(assessment.factors),
    ]);
}
