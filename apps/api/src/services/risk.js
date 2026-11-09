const weights = {
    rainfall: 0.35,
    history: 0.2,
    slope: 0.15,
    drainage: 0.15,
    incidents: 0.15,
};
export function calculateRisk(factors) {
    const available = Object.keys(weights)
        .filter((key) => factors[key] !== null);
    if (available.length === 0)
        throw new Error('At least one risk factor is required');
    const totalWeight = available.reduce((sum, key) => sum + weights[key], 0);
    const contributions = {};
    for (const key of available) {
        const value = factors[key];
        if (value === null || !Number.isFinite(value) || value < 0 || value > 100) {
            throw new Error(`Risk factor ${key} must be between 0 and 100`);
        }
        contributions[key] = value * (weights[key] / totalWeight);
    }
    const score = Math.round(Object.values(contributions).reduce((sum, value) => sum + value, 0));
    const category = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MODERATE' : 'LOW';
    return { score, category, contributions };
}
