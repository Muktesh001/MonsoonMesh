# Baseline risk model

The illustrative score combines normalized rainfall, historical flood indicators,
slope, drainage condition, and recent verified incidents using weights 0.35, 0.20,
0.15, 0.15, and 0.15. Missing input dimensions are excluded and the remaining
weights are renormalized. Scores are decision-support indices, not calibrated flood
probabilities.

| Score | Category |
|---:|---|
| 0-24 | LOW |
| 25-49 | MODERATE |
| 50-74 | HIGH |
| 75-100 | CRITICAL |
