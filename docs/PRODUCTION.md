# Production Deployment Guide

This guide covers deploying MonsoonMesh to production environments on cloud platforms and self-hosted infrastructure.

## Pre-Deployment Checklist

Before going to production, ensure:

### Security
- [ ] JWT_SECRET is a strong random string (32+ characters)
- [ ] All default passwords changed (database, Grafana)
- [ ] Demo accounts removed or disabled
- [ ] HTTPS/TLS certificates installed
- [ ] CORS origins whitelist configured
- [ ] API rate limiting tuned for expected load
- [ ] File upload size limits enforced
- [ ] All dependencies security audited (`npm audit`, `pip audit`)
- [ ] Secrets are in environment variables (never committed)
- [ ] AWS/GCP/Azure credentials properly scoped

### Configuration
- [ ] NODE_ENV=production
- [ ] Logging sent to centralized service (CloudWatch, Stackdriver, etc.)
- [ ] Error tracking enabled (Sentry, Rollbar, etc.)
- [ ] Database backups automated
- [ ] Connection strings use TLS
- [ ] Cache TTLs appropriate for data freshness
- [ ] Monitoring/alerting configured

### Testing
- [ ] Load testing completed
- [ ] E2E tests pass in staging
- [ ] Database migrations tested
- [ ] Rollback procedure documented
- [ ] Disaster recovery plan written

## AWS Deployment

### Architecture Overview

```
┌─────────────────────────────────────────┐
│  CloudFront CDN (Static Assets)         │
└────────────────┬────────────────────────┘
                 │
┌─────────────────▼────────────────────────┐
│  ALB (Application Load Balancer)         │
├─────────────────────────────────────────┤
│  • Health check to ECS tasks             │
│  • HTTPS termination                     │
│  • WebSocket support enabled             │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐   ┌────────┐   ┌────────┐
│ ECS    │   │ ECS    │   │ ECS    │
│ API    │   │ API    │   │ API    │
└────┬───┘   └────┬───┘   └────┬───┘
     │            │            │
     └────────────┼────────────┘
                  │
        ┌─────────▼──────────┐
        │  RDS Aurora        │
        │  PostgreSQL+PostGIS│
        │  (Multi-AZ)        │
        └────────────────────┘

        ┌──────────────────┐
        │  ElastiCache     │
        │  Redis (Cluster) │
        └──────────────────┘

        ┌──────────────────┐
        │  ECS Task: Worker│
        └──────────────────┘

        ┌──────────────────┐
        │  S3: Uploads     │
        └──────────────────┘
```

### Step-by-Step AWS Deployment

#### 1. Set up RDS Aurora PostgreSQL

```bash
# Create Aurora cluster (via AWS Console or Terraform)
# - Engine: Aurora PostgreSQL 17
# - Instance type: db.t3.medium (prod: db.r6g.xlarge)
# - Multi-AZ: Yes
# - Backup retention: 30 days
# - Enhanced monitoring: Yes
# - Performance Insights: Yes

# Enable PostGIS extension
psql -h <aurora-endpoint> -U postgres -d postgres
CREATE EXTENSION postgis;
CREATE EXTENSION pgvector;
```

#### 2. Set up ElastiCache Redis

```bash
# Create Redis cluster
# - Engine: Redis 7.0
# - Node type: cache.t3.micro (prod: cache.r6g.xlarge)
# - Number of nodes: 2 (multi-AZ)
# - Automatic failover: Enabled
# - Encryption: At rest + in transit
```

#### 3. Create S3 bucket for uploads

```bash
aws s3 mb s3://monsoonmesh-uploads-prod
aws s3api put-bucket-versioning \
  --bucket monsoonmesh-uploads-prod \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption \
  --bucket monsoonmesh-uploads-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

#### 4. Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name monsoonmesh-prod

# Register task definition (API)
aws ecs register-task-definition \
  --cli-input-json file://task-definition-api.json

# Create ALB and target group
aws elbv2 create-load-balancer \
  --name monsoonmesh-alb \
  --subnets subnet-xxx subnet-yyy
```

#### 5. Create ECS Services

```bash
# API Service (3 tasks, auto-scaling)
aws ecs create-service \
  --cluster monsoonmesh-prod \
  --service-name api \
  --task-definition monsoonmesh-api:1 \
  --desired-count 3 \
  --launch-type FARGATE \
  --load-balancers \
    targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=api,containerPort=4000

# Worker Service
aws ecs create-service \
  --cluster monsoonmesh-prod \
  --service-name worker \
  --task-definition monsoonmesh-worker:1 \
  --desired-count 2 \
  --launch-type FARGATE
```

#### 6. Set up CloudFront for static assets

```bash
# Upload built web app to S3
aws s3 sync apps/web/dist s3://monsoonmesh-web-prod/

# Create CloudFront distribution
# - Origin: S3 bucket
# - Default root object: index.html
# - Error handling: 404 → index.html (for SPA routing)
```

#### 7. Configure auto-scaling

```bash
# Scale API based on CPU utilization
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/monsoonmesh-prod/api \
  --min-capacity 3 \
  --max-capacity 10

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/monsoonmesh-prod/api \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 300
  }'
```

#### 8. Set up monitoring with CloudWatch

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name MonsoonMesh \
  --dashboard-body file://dashboard.json

# Create alarms
aws cloudwatch put-metric-alarm \
  --alarm-name monsoonmesh-api-cpu \
  --alarm-description "API CPU high" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:...
```

### AWS Environment Variables

```env
# Database
DATABASE_URL=postgres://monsoonmesh:PASSWORD@aurora-endpoint:5432/monsoonmesh

# Redis
REDIS_URL=redis://:PASSWORD@elasticache-endpoint:6379

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=monsoonmesh-uploads-prod

# Application
NODE_ENV=production
JWT_SECRET=<generate strong secret>
WEB_ORIGIN=https://monsoonmesh.example.com
API_URL=https://api.monsoonmesh.example.com

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
DATADOG_API_KEY=...
```

## GCP Deployment

### Architecture with Cloud Run + Cloud SQL

```
┌──────────────────────┐
│  Cloud Load Balance  │
└──────────┬───────────┘
           │
    ┌──────▼───────┐
    │  Cloud Run   │
    │  (API)       │
    │  (Auto-scale)│
    └──────┬───────┘
           │
    ┌──────┴───────────┐
    │                  │
┌───▼──────┐   ┌──────▼──────┐
│Cloud SQL │   │Cloud Memstore
│PostgreSQL   │   │(Redis)   │
│+ PostGIS │   │           │
└──────────┘   └────────────┘

┌─────────────────────┐
│  Cloud Storage      │
│  (Uploads)          │
└─────────────────────┘
```

### GCP Setup Steps

```bash
# Create Cloud SQL PostgreSQL instance
gcloud sql instances create monsoonmesh-prod \
  --database-version POSTGRES_15 \
  --region us-central1 \
  --tier db-custom-2-8192 \
  --availability-type REGIONAL \
  --enable-bin-log \
  --backup \
  --retained-backups-count 30

# Enable PostGIS
gcloud sql databases create monsoonmesh \
  --instance monsoonmesh-prod
gcloud sql connect monsoonmesh-prod --user postgres
# Then: CREATE EXTENSION postgis; CREATE EXTENSION pgvector;

# Create Cloud Memstore Redis
gcloud redis instances create monsoonmesh-redis \
  --size 5 \
  --region us-central1 \
  --tier basic

# Create Cloud Storage bucket
gsutil mb gs://monsoonmesh-uploads-prod
gsutil versioning set on gs://monsoonmesh-uploads-prod

# Build and deploy API to Cloud Run
gcloud run deploy monsoonmesh-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 80 \
  --set-env-vars \
    DATABASE_URL=cloudsql:PROJECT_ID:us-central1:monsoonmesh-prod, \
    REDIS_URL=redis://MEMSTORE_IP:6379, \
    NODE_ENV=production
```

## Azure Deployment

### Architecture with App Service + Database for PostgreSQL

```
┌──────────────────────┐
│  Azure Front Door    │
│  + CDN               │
└──────────┬───────────┘
           │
    ┌──────▼────────────┐
    │  App Service Plan │
    │  (API instances)  │
    │  (Auto-scale)     │
    └──────┬────────────┘
           │
    ┌──────┴──────────────────┐
    │                         │
┌───▼──────────────┐  ┌──────▼──────┐
│ Database for     │  │ Cache for   │
│ PostgreSQL       │  │ Redis       │
│ (Flexible Server)│  │ (Enterprise)│
└──────────────────┘  └─────────────┘

┌──────────────────────┐
│  Blob Storage        │
│  (Uploads)           │
└──────────────────────┘
```

### Azure Setup Steps

```bash
# Create resource group
az group create --name monsoonmesh --location eastus

# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group monsoonmesh \
  --name monsoonmesh-db \
  --admin-user monsoonmesh \
  --admin-password <strong-password> \
  --tier Standard \
  --sku-name Standard_B2s \
  --storage-size 128 \
  --public-access Enabled \
  --high-availability Enabled

# Enable PostGIS
az postgres flexible-server execute \
  --resource-group monsoonmesh \
  --server-name monsoonmesh-db \
  --admin-user monsoonmesh \
  --admin-password <password> \
  --database-name monsoonmesh \
  --query-text "CREATE EXTENSION postgis;"

# Create Azure Cache for Redis
az redis create \
  --resource-group monsoonmesh \
  --name monsoonmesh-redis \
  --location eastus \
  --sku Premium \
  --vm-size p1

# Create Storage Account
az storage account create \
  --name monsoonmeshuploads \
  --resource-group monsoonmesh \
  --location eastus \
  --sku Standard_LRS

# Create App Service Plan
az appservice plan create \
  --name monsoonmesh-plan \
  --resource-group monsoonmesh \
  --is-linux \
  --sku P2V2

# Deploy API to App Service
az webapp create \
  --resource-group monsoonmesh \
  --plan monsoonmesh-plan \
  --name monsoonmesh-api \
  --runtime "NODE|18"

# Configure auto-scaling
az monitor metrics alert create \
  --resource-group monsoonmesh \
  --scopes /subscriptions/.../resourceGroups/monsoonmesh \
  --name cpu-scaling \
  --description "Scale on CPU" \
  --condition "avg Percentage CPU > 80" \
  --window-size 5m \
  --evaluation-frequency 1m
```

## Kubernetes Deployment (EKS, GKE, AKS)

### Helm Chart Structure

```
monsoonmesh-helm/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-prod.yaml
├── templates/
│   ├── api-deployment.yaml
│   ├── api-service.yaml
│   ├── worker-deployment.yaml
│   ├── configmap.yaml
│   └── secrets.yaml
```

### Basic Helm Deployment

```bash
# Create namespace
kubectl create namespace monsoonmesh

# Install chart
helm install monsoonmesh ./monsoonmesh-helm \
  -n monsoonmesh \
  -f monsoonmesh-helm/values-prod.yaml

# Verify
kubectl get pods -n monsoonmesh
kubectl logs -n monsoonmesh -l app=api
```

## Backup & Disaster Recovery

### Database Backups

**AWS RDS**:
- Automatic backups retained for 30 days
- Point-in-time recovery enabled
- Cross-region backup replication

**Manual backup**:
```bash
aws rds create-db-snapshot \
  --db-instance-identifier monsoonmesh-prod \
  --db-snapshot-identifier monsoonmesh-backup-$(date +%s)
```

**Restore from backup**:
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier monsoonmesh-recovered \
  --db-snapshot-identifier monsoonmesh-backup-XXX
```

### Application Backups

```bash
# Backup uploads
aws s3 sync \
  s3://monsoonmesh-uploads-prod \
  s3://monsoonmesh-backups-archive/$(date +%Y-%m-%d)/

# Backup database
pg_dump \
  postgres://monsoonmesh:pass@rds-endpoint/monsoonmesh | \
  gzip > monsoonmesh-backup-$(date +%Y%m%d).sql.gz

# Upload to backup storage
aws s3 cp monsoonmesh-backup-*.sql.gz s3://monsoonmesh-backups-archive/
```

### Disaster Recovery Runbook

1. **Database unavailable**: Restore from latest RDS snapshot (< 5 min)
2. **Data corruption**: Point-in-time recovery to pre-corruption time
3. **Complete outage**: Redeploy from Docker images + restore database
4. **API service down**: Auto-heal via ECS/k8s restarts
5. **Data breach**: Rotate all secrets, invalidate sessions, notify users

## Monitoring & Alerting

### Key Metrics to Monitor

- API response time (p50, p95, p99)
- API error rate (5xx, 4xx)
- Database connection pool utilization
- Redis memory usage
- Incident creation rate
- Worker job processing time
- Background job failure rate

### Alert Thresholds

```yaml
alerts:
  - name: api_error_rate_high
    condition: error_rate > 1%
    duration: 5 minutes
    action: notify, auto-scale
  
  - name: database_connections_exhausted
    condition: connection_pool_used > 90%
    duration: 2 minutes
    action: notify, scale database
  
  - name: worker_job_backlog
    condition: pending_jobs > 10000
    duration: 10 minutes
    action: notify, scale workers
  
  - name: disk_space_low
    condition: disk_free < 10%
    duration: immediate
    action: notify, page on-call
```

### Log Aggregation

```bash
# Send logs to ELK/Splunk/Datadog
# Configure CloudWatch Logs → Kinesis → Elasticsearch
# Or: Application → Datadog Agent → Datadog

# Log schema (JSON)
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info|warn|error",
  "service": "api|worker|ai-service",
  "userId": "uuid",
  "requestId": "uuid",
  "message": "...",
  "metadata": {...}
}
```

## Performance Tuning

### Database Optimization

```sql
-- Analyze query plans
EXPLAIN ANALYZE SELECT * FROM incidents WHERE status='VERIFIED';

-- Create materialized views for analytics
CREATE MATERIALIZED VIEW incident_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as day,
  category,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM updated_at - created_at)) as avg_resolution_time
FROM incidents
GROUP BY 1, 2;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY incident_stats;

-- Vacuum & analyze
VACUUM ANALYZE incidents;
```

### Connection Pooling

```typescript
// Use pgBouncer for connection pooling in production
// Connection string: postgres://monsoonmesh@pgbouncer:6432/monsoonmesh

// Configure pool size
const pool = new Pool({
  max: 20,              // max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Caching Strategy

```typescript
// Cache frequently accessed data
const getDashboard = async (userId: string) => {
  const cacheKey = `dashboard:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const data = await calculateDashboard(userId);
  await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min TTL
  return data;
};
```

## Cost Optimization

### AWS Cost Reduction

- Use Reserved Instances (1-3 year commitment): 40-70% savings
- Use Spot Instances for non-critical workloads: 70-90% savings
- Enable AWS Compute Optimizer recommendations
- Use S3 Intelligent-Tiering for archived data
- Clean up unused resources monthly

### Database Cost

- Use Aurora Serverless for variable workloads
- Enable Query Insights for optimization
- Archive old incidents to cold storage
- Use connection pooling to reduce instance size

## Security Hardening

### Network Security

```bash
# VPC isolation
- Private subnets for database and cache
- NAT Gateway for outbound traffic
- Security Groups for traffic rules
- No direct internet access to database

# HTTPS/TLS
- Certificate: AWS Certificate Manager (free)
- HSTS header: max-age=31536000
- TLS 1.2+ only

# WAF (Web Application Firewall)
- Rate limiting
- SQL injection protection
- XSS protection
- Bot protection
```

### Secrets Management

```bash
# Use AWS Secrets Manager
aws secretsmanager create-secret \
  --name monsoonmesh/jwt-secret \
  --secret-string "$(openssl rand -base64 32)"

# Rotate secrets automatically
aws secretsmanager rotate-secret \
  --secret-id monsoonmesh/jwt-secret \
  --rotation-lambda-arn arn:aws:lambda:...
```

## Rollback Procedures

### Rolling Back a Deployment

```bash
# AWS ECS
aws ecs update-service \
  --cluster monsoonmesh-prod \
  --service api \
  --task-definition monsoonmesh-api:PREVIOUS_VERSION

# Verify rollback
aws ecs describe-services \
  --cluster monsoonmesh-prod \
  --services api
```

### Database Rollback

```bash
# Restore from backup
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier monsoonmesh-prod \
  --db-snapshot-identifier monsoonmesh-backup-XXX

# Promote read replica if available
aws rds promote-read-replica \
  --db-instance-identifier monsoonmesh-read-replica
```

## Support & Resources

- [AWS Deployment Best Practices](https://docs.aws.amazon.com/ecs/latest/developerguide/ECS_best_practices.html)
- [GCP Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis Best Practices](https://redis.io/topics/optimization)
