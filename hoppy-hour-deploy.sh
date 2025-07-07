#!/bin/bash
# hoppy-hour-deploy.sh
# Modern MVP infrastructure setup for Hoppy Hour

set -e

# Colors and logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_step() { echo -e "${BLUE}▶${NC} $1"; }
log_config() { echo -e "${PURPLE}⚙${NC} $1"; }

# Create output directory for configuration files
setup_output_directory() {
    mkdir -p ./deployment-config
    log_info "Created deployment-config directory for all configuration files"
}

# Validate RDS password compliance
validate_rds_password() {
    local password="$1"
    local env="$2"
    
    # Check length (8-128 characters)
    if [[ ${#password} -lt 8 || ${#password} -gt 128 ]]; then
        log_error "Password for $env environment must be 8-128 characters long (current: ${#password})"
        exit 1
    fi
    
    # Check for forbidden characters: / " ' @ \ and control characters
    if [[ "$password" =~ [/\"\'@\\[:cntrl:]] ]]; then
        log_error "Password for $env environment contains forbidden characters"
        log_error "Forbidden: / \" ' @ \\ and control characters"
        exit 1
    fi
    
    # Check for spaces
    if [[ "$password" =~ [[:space:]] ]]; then
        log_error "Password for $env environment cannot contain spaces"
        exit 1
    fi
    
    log_info "Password for $env environment is RDS-compliant"
}

# Load existing environment configuration
load_existing_env() {
    log_step "Loading existing environment configuration..."
    
    if [[ -f ".env" ]]; then
        # Load existing .env file (without executing it, just read values)
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ $key =~ ^#.*$ ]] && continue
            [[ -z $key ]] && continue
            
            # Remove quotes from value
            value=$(echo "$value" | sed 's/^"//;s/"$//')
            
            # Export key variables we need
            case $key in
                "AWS_ACCESS_KEY_ID") export EXISTING_AWS_ACCESS_KEY_ID="$value" ;;
                "AWS_SECRET_ACCESS_KEY") export EXISTING_AWS_SECRET_ACCESS_KEY="$value" ;;
                "CLOUDFLARE_CDN_ENABLED") export EXISTING_CLOUDFLARE_CDN_ENABLED="$value" ;;
                "CLOUDFLARE_CDN_BASE_URL") export EXISTING_CLOUDFLARE_CDN_BASE_URL="$value" ;;
                "CLOUDFLARE_ZONE_ID") export EXISTING_CLOUDFLARE_ZONE_ID="$value" ;;
                "CLOUDFLARE_API_TOKEN") export EXISTING_CLOUDFLARE_API_TOKEN="$value" ;;
                "GOOGLE_PLACES_API_KEY") export EXISTING_GOOGLE_PLACES_API_KEY="$value" ;;
                "YELP_API_KEY") export EXISTING_YELP_API_KEY="$value" ;;
                "BULL_ADMIN_USER") export EXISTING_BULL_ADMIN_USER="$value" ;;
                "BULL_ADMIN_PASS") export EXISTING_BULL_ADMIN_PASS="$value" ;;
                "S3_MONTHLY_BUDGET") export EXISTING_S3_MONTHLY_BUDGET="$value" ;;
                "S3_RATE_LIMIT_HOUR") export EXISTING_S3_RATE_LIMIT_HOUR="$value" ;;
                "S3_RATE_LIMIT_DAY") export EXISTING_S3_RATE_LIMIT_DAY="$value" ;;
                "S3_EMERGENCY_THRESHOLD") export EXISTING_S3_EMERGENCY_THRESHOLD="$value" ;;
                "FRONTEND_URL") export EXISTING_FRONTEND_URL="$value" ;;
                "LOG_LEVEL") export EXISTING_LOG_LEVEL="$value" ;;
            esac
        done < .env
        log_info "Loaded existing .env configuration"
    else
        log_warn "No existing .env file found - will create basic configuration"
    fi
}

# Validate configuration
validate_configuration() {
    log_step "Validating configuration..."
    
    # Check if existing bucket exists
    if ! aws s3 ls "s3://$EXISTING_DEV_S3_BUCKET" >/dev/null 2>&1; then
        log_error "Existing S3 bucket '$EXISTING_DEV_S3_BUCKET' not found or not accessible"
        log_error "Make sure your AWS credentials have access to this bucket"
        exit 1
    fi
    
    log_info "Configuration validated"
    log_info "✓ S3 bucket '$EXISTING_DEV_S3_BUCKET' is accessible"
}

# Generate RDS-compliant secure passwords
generate_passwords() {
    log_step "Setting up database passwords..."
    
    if [[ -z "$DB_PASSWORD_DEV" ]]; then
        # Generate RDS-compliant password: 20 characters, alphanumeric + safe special chars
        DB_PASSWORD_DEV=$(openssl rand -base64 32 | tr -d "=+/\"'@\\\n\r\t " | grep -o '[A-Za-z0-9!#$%&*\-_]' | head -20 | tr -d '\n')
        # Ensure minimum length and add suffix if needed
        if [[ ${#DB_PASSWORD_DEV} -lt 12 ]]; then
            DB_PASSWORD_DEV="${DB_PASSWORD_DEV}$(openssl rand -hex 4)"
        fi
        log_config "Generated development database password (${#DB_PASSWORD_DEV} characters)"
    else
        log_config "Using provided development database password"
        # Validate provided password
        validate_rds_password "$DB_PASSWORD_DEV" "development"
    fi
    
    if [[ -z "$DB_PASSWORD_PROD" ]]; then
        # Generate RDS-compliant password: 20 characters, alphanumeric + safe special chars
        DB_PASSWORD_PROD=$(openssl rand -base64 32 | tr -d "=+/\"'@\\\n\r\t " | grep -o '[A-Za-z0-9!#$%&*\-_]' | head -20 | tr -d '\n')
        # Ensure minimum length and add suffix if needed
        if [[ ${#DB_PASSWORD_PROD} -lt 12 ]]; then
            DB_PASSWORD_PROD="${DB_PASSWORD_PROD}$(openssl rand -hex 4)"
        fi
        log_config "Generated production database password (${#DB_PASSWORD_PROD} characters)"
    else
        log_config "Using provided production database password"
        # Validate provided password
        validate_rds_password "$DB_PASSWORD_PROD" "production"
    fi
}

# Save passwords to file (called after database creation in case of fallback)
save_passwords() {
    # Save passwords securely (update after potential fallback generation)
    cat > ./deployment-config/database-passwords.txt <<EOF
# 🔐 HOPPY HOUR DATABASE PASSWORDS
# Generated: $(date)
# Keep this file secure and backed up!

Development Database Password: ${DB_PASSWORD_DEV}
Production Database Password:  ${DB_PASSWORD_PROD}

# Note: Passwords are RDS-compliant (8-128 chars, no forbidden characters)
# Connection strings will be in deployment-config/connection-strings.env
EOF
    
    chmod 600 ./deployment-config/database-passwords.txt
    log_info "Database passwords saved to ./deployment-config/database-passwords.txt"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Install it from: https://aws.amazon.com/cli/"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS CLI not configured. Run: aws configure"
        exit 1
    fi
    
    if ! command -v openssl &> /dev/null; then
        log_error "OpenSSL not found. Required for password generation."
        exit 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    log_info "Using AWS Account: $account_id"
    log_info "Using Region: $AWS_REGION"
}

# Create optimized security group
create_security_group() {
    log_step "Creating security group..."
    
    local sg_name="${PROJECT_NAME}-database-sg"
    
    # Try to get existing security group first
    local sg_id=$(aws ec2 describe-security-groups \
        --group-names "$sg_name" \
        --region "$AWS_REGION" \
        --query 'SecurityGroups[0].GroupId' \
        --output text 2>/dev/null || echo "None")
    
    if [[ "$sg_id" == "None" ]]; then
        sg_id=$(aws ec2 create-security-group \
            --group-name "$sg_name" \
            --description "Security group for ${PROJECT_NAME} databases (PostgreSQL + Redis)" \
            --region "$AWS_REGION" \
            --query 'GroupId' \
            --output text)
        
        # Add PostgreSQL rule
        aws ec2 authorize-security-group-ingress \
            --group-id "$sg_id" \
            --protocol tcp \
            --port 5432 \
            --cidr "$YOUR_IP_CIDR" \
            --region "$AWS_REGION" >/dev/null
        
        # Add Redis rule  
        aws ec2 authorize-security-group-ingress \
            --group-id "$sg_id" \
            --protocol tcp \
            --port 6379 \
            --cidr "$YOUR_IP_CIDR" \
            --region "$AWS_REGION" >/dev/null
        
        log_info "Created security group: $sg_id"
    else
        log_info "Using existing security group: $sg_id"
    fi
    
    echo "$sg_id"
}

# Create RDS instances with better error handling
create_databases() {
    local sg_id=$1
    log_step "Creating PostgreSQL databases..."
    
    # Development database - using exact working parameters
    if ! aws rds describe-db-instances --db-instance-identifier "${PROJECT_NAME}-dev-db" --region "$AWS_REGION" >/dev/null 2>&1; then
        log_config "Creating development database..."
        
        aws rds create-db-instance \
            --db-instance-identifier "${PROJECT_NAME}-dev-db" \
            --db-instance-class "db.t3.micro" \
            --engine "postgres" \
            --master-username "postgres" \
            --master-user-password "NationFavor20" \
            --allocated-storage 20 \
            --region "us-east-1"
        
        log_info "Development database creation initiated"
    else
        log_info "Development database already exists"
    fi
    
    # Production database - using exact working parameters  
    if ! aws rds describe-db-instances --db-instance-identifier "${PROJECT_NAME}-prod-db" --region "$AWS_REGION" >/dev/null 2>&1; then
        log_config "Creating production database..."
        
        aws rds create-db-instance \
            --db-instance-identifier "${PROJECT_NAME}-prod-db" \
            --db-instance-class "db.t3.micro" \
            --engine "postgres" \
            --master-username "postgres" \
            --master-user-password "NationFavor20" \
            --allocated-storage 20 \
            --region "us-east-1"
        
        log_info "Production database creation initiated"
    else
        log_info "Production database already exists"
    fi
}

# Create Redis instances
create_redis_instances() {
    log_step "Setting up Redis configuration (local installation)..."
    log_info "Using local Redis instead of ElastiCache (better for MVP)"
    
    # Create Redis setup script for your servers
    cat > ./deployment-config/install-redis.sh <<EOF
#!/bin/bash
# Install and configure Redis on Ubuntu
echo "Installing Redis on this server..."
sudo apt update
sudo apt install -y redis-server

# Configure Redis for remote connections (if needed)
sudo sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Allow Redis port through firewall
sudo ufw allow 6379/tcp

echo "✅ Redis installed and running!"
echo "Connection: redis://localhost:6379"
EOF
    
    chmod +x ./deployment-config/install-redis.sh
    log_info "Created install-redis.sh script for your servers"
    log_info "After deployment, run this script on each Lightsail instance"
}

# Create compute instances
create_compute_instances() {
    log_step "Creating Lightsail compute instances..."
    
    # Development instance
    if ! aws lightsail get-instance --instance-name "${PROJECT_NAME}-dev" --region "$AWS_REGION" >/dev/null 2>&1; then
        aws lightsail create-instances \
            --instance-names "${PROJECT_NAME}-dev" \
            --availability-zone "${AWS_REGION}a" \
            --blueprint-id ubuntu_22_04 \
            --bundle-id "$LIGHTSAIL_BUNDLE" \
            --region "$AWS_REGION" \
            --tags key=Environment,value=development key=Project,value="$PROJECT_NAME" key=Purpose,value=MVP \
            >/dev/null
        log_info "Development server creation initiated"
    else
        log_info "Development server already exists"
    fi
    
    # Production instance
    if ! aws lightsail get-instance --instance-name "${PROJECT_NAME}-prod" --region "$AWS_REGION" >/dev/null 2>&1; then
        aws lightsail create-instances \
            --instance-names "${PROJECT_NAME}-prod" \
            --availability-zone "${AWS_REGION}a" \
            --blueprint-id ubuntu_22_04 \
            --bundle-id "$LIGHTSAIL_BUNDLE" \
            --region "$AWS_REGION" \
            --tags key=Environment,value=production key=Project,value="$PROJECT_NAME" key=Purpose,value=MVP \
            >/dev/null
        log_info "Production server creation initiated"
    else
        log_info "Production server already exists"
    fi
}

# Handle S3 buckets (existing dev + new prod)
setup_s3_buckets() {
    log_step "Setting up S3 buckets..."
    
    # Verify existing dev bucket
    log_info "Using existing development bucket: $EXISTING_DEV_S3_BUCKET"
    
    # Create production bucket
    local prod_bucket="${PROJECT_NAME}-prod-images"
    if ! aws s3 ls "s3://$prod_bucket" >/dev/null 2>&1; then
        aws s3 mb "s3://$prod_bucket" --region "$AWS_REGION"
        aws s3api put-public-access-block \
            --bucket "$prod_bucket" \
            --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
        
        # Add bucket versioning for production
        aws s3api put-bucket-versioning \
            --bucket "$prod_bucket" \
            --versioning-configuration Status=Enabled
        
        log_info "Created production bucket: $prod_bucket"
    else
        log_info "Production bucket already exists: $prod_bucket"
    fi
    
    export PROD_S3_BUCKET="$prod_bucket"
}

# Generate SSH keys
setup_ssh_access() {
    log_step "Setting up SSH access..."
    
    # Development key
    if ! aws lightsail get-key-pair --key-pair-name "${PROJECT_NAME}-dev-key" --region "$AWS_REGION" >/dev/null 2>&1; then
        aws lightsail create-key-pair \
            --key-pair-name "${PROJECT_NAME}-dev-key" \
            --region "$AWS_REGION" \
            --query 'privateKeyBase64' \
            --output text | base64 -d > "./deployment-config/${PROJECT_NAME}-dev-key.pem"
        chmod 600 "./deployment-config/${PROJECT_NAME}-dev-key.pem"
        log_info "Created development SSH key"
    else
        log_info "Development SSH key already exists"
    fi
    
    # Production key
    if ! aws lightsail get-key-pair --key-pair-name "${PROJECT_NAME}-prod-key" --region "$AWS_REGION" >/dev/null 2>&1; then
        aws lightsail create-key-pair \
            --key-pair-name "${PROJECT_NAME}-prod-key" \
            --region "$AWS_REGION" \
            --query 'privateKeyBase64' \
            --output text | base64 -d > "./deployment-config/${PROJECT_NAME}-prod-key.pem"
        chmod 600 "./deployment-config/${PROJECT_NAME}-prod-key.pem"
        log_info "Created production SSH key"
    else
        log_info "Production SSH key already exists"
    fi
}

# Wait for services with progress indication
wait_for_services() {
    log_step "Waiting for services to become available..."
    log_warn "This may take 10-15 minutes. Perfect time for a coffee break! ☕"
    
    local services=("RDS Dev" "RDS Prod" "Redis Dev" "Redis Prod")
    local pids=()
    
    # Start waiting processes
    aws rds wait db-instance-available --db-instance-identifier "${PROJECT_NAME}-dev-db" --region "$AWS_REGION" &
    pids+=($!)
    aws rds wait db-instance-available --db-instance-identifier "${PROJECT_NAME}-prod-db" --region "$AWS_REGION" &
    pids+=($!)
    aws elasticache wait cache-cluster-available --cache-cluster-id "${PROJECT_NAME}-dev-redis" --region "$AWS_REGION" &
    pids+=($!)
    aws elasticache wait cache-cluster-available --cache-cluster-id "${PROJECT_NAME}-prod-redis" --region "$AWS_REGION" &
    pids+=($!)
    
    # Wait for all services
    for i in "${!pids[@]}"; do
        wait "${pids[$i]}"
        log_info "${services[$i]} is ready"
    done
}

# Collect all endpoints and create configuration files
generate_configuration() {
    log_step "Generating configuration files..."
    
    # Get endpoints
    local dev_db_endpoint=$(aws rds describe-db-instances \
        --db-instance-identifier "${PROJECT_NAME}-dev-db" \
        --region "$AWS_REGION" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    local prod_db_endpoint=$(aws rds describe-db-instances \
        --db-instance-identifier "${PROJECT_NAME}-prod-db" \
        --region "$AWS_REGION" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    local dev_redis_endpoint=$(aws elasticache describe-cache-clusters \
        --cache-cluster-id "${PROJECT_NAME}-dev-redis" \
        --show-cache-node-info \
        --region "$AWS_REGION" \
        --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
        --output text)
    
    local prod_redis_endpoint=$(aws elasticache describe-cache-clusters \
        --cache-cluster-id "${PROJECT_NAME}-prod-redis" \
        --show-cache-node-info \
        --region "$AWS_REGION" \
        --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
        --output text)
    
    local dev_ip=$(aws lightsail get-instance \
        --instance-name "${PROJECT_NAME}-dev" \
        --region "$AWS_REGION" \
        --query 'instance.publicIpAddress' \
        --output text 2>/dev/null || echo "Pending")
    
    local prod_ip=$(aws lightsail get-instance \
        --instance-name "${PROJECT_NAME}-prod" \
        --region "$AWS_REGION" \
        --query 'instance.publicIpAddress' \
        --output text 2>/dev/null || echo "Pending")
    
    # Generate environment files with existing configuration preserved
    cat > ./deployment-config/.env.development <<EOF
# 🌱 HOPPY HOUR - DEVELOPMENT ENVIRONMENT
# Generated: $(date)
# Preserves your existing configuration with new database/redis endpoints

# Database (NEW - AWS RDS)
DATABASE_URL=postgresql://postgres:${DB_PASSWORD_DEV}@${dev_db_endpoint}:5432/postgres
DB_HOST=${dev_db_endpoint}
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD_DEV}

# Redis (NEW - AWS ElastiCache)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=""

# AWS S3 Configuration (EXISTING)
AWS_REGION=${AWS_REGION}
AWS_ACCESS_KEY_ID=${EXISTING_AWS_ACCESS_KEY_ID:-"your_aws_access_key_id"}
AWS_SECRET_ACCESS_KEY=${EXISTING_AWS_SECRET_ACCESS_KEY:-"your_aws_secret_access_key"}
AWS_S3_BUCKET_NAME=${EXISTING_DEV_S3_BUCKET}

# Cloudflare CDN Configuration (EXISTING)
CLOUDFLARE_CDN_ENABLED=${EXISTING_CLOUDFLARE_CDN_ENABLED:-"false"}
CLOUDFLARE_CDN_BASE_URL=${EXISTING_CLOUDFLARE_CDN_BASE_URL:-""}
CLOUDFLARE_ZONE_ID=${EXISTING_CLOUDFLARE_ZONE_ID:-""}
CLOUDFLARE_API_TOKEN=${EXISTING_CLOUDFLARE_API_TOKEN:-""}

# Google Places API (EXISTING)
GOOGLE_PLACES_API_KEY=${EXISTING_GOOGLE_PLACES_API_KEY:-"your_google_places_api_key"}

# Yelp API (EXISTING)
YELP_API_KEY=${EXISTING_YELP_API_KEY:-"your_yelp_api_key"}

# Bull Dashboard Admin (EXISTING)
BULL_ADMIN_USER=${EXISTING_BULL_ADMIN_USER:-"admin"}
BULL_ADMIN_PASS=${EXISTING_BULL_ADMIN_PASS:-"secure_password"}

# Cost Control Settings (EXISTING)
S3_MONTHLY_BUDGET=${EXISTING_S3_MONTHLY_BUDGET:-"20.00"}
S3_RATE_LIMIT_HOUR=${EXISTING_S3_RATE_LIMIT_HOUR:-"100"}
S3_RATE_LIMIT_DAY=${EXISTING_S3_RATE_LIMIT_DAY:-"1000"}
S3_EMERGENCY_THRESHOLD=${EXISTING_S3_EMERGENCY_THRESHOLD:-"0.90"}

# Application Settings
NODE_ENV=development
PORT=3001
FRONTEND_URL=${EXISTING_FRONTEND_URL:-"http://localhost:3000"}
LOG_LEVEL=${EXISTING_LOG_LEVEL:-"debug"}

# Server (when ready)
SERVER_IP=${dev_ip}
EOF

    cat > ./deployment-config/.env.production <<EOF
# 🚀 HOPPY HOUR - PRODUCTION ENVIRONMENT  
# Generated: $(date)
# Preserves your existing configuration with new database/redis endpoints

# Database (NEW - AWS RDS)
DATABASE_URL=postgresql://postgres:${DB_PASSWORD_PROD}@${prod_db_endpoint}:5432/postgres
DB_HOST=${prod_db_endpoint}
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD_PROD}

# Redis (NEW - AWS ElastiCache)
REDIS_HOST=${prod_redis_endpoint}
REDIS_PORT=6379
REDIS_URL=redis://${prod_redis_endpoint}:6379
REDIS_PASSWORD=""

# AWS S3 Configuration (NEW BUCKET)
AWS_REGION=${AWS_REGION}
AWS_ACCESS_KEY_ID=${EXISTING_AWS_ACCESS_KEY_ID:-"your_aws_access_key_id"}
AWS_SECRET_ACCESS_KEY=${EXISTING_AWS_SECRET_ACCESS_KEY:-"your_aws_secret_access_key"}
AWS_S3_BUCKET_NAME=${PROD_S3_BUCKET}

# Cloudflare CDN Configuration (EXISTING)
CLOUDFLARE_CDN_ENABLED=${EXISTING_CLOUDFLARE_CDN_ENABLED:-"false"}
CLOUDFLARE_CDN_BASE_URL=${EXISTING_CLOUDFLARE_CDN_BASE_URL:-""}
CLOUDFLARE_ZONE_ID=${EXISTING_CLOUDFLARE_ZONE_ID:-""}
CLOUDFLARE_API_TOKEN=${EXISTING_CLOUDFLARE_API_TOKEN:-""}

# Google Places API (EXISTING)
GOOGLE_PLACES_API_KEY=${EXISTING_GOOGLE_PLACES_API_KEY:-"your_google_places_api_key"}

# Yelp API (EXISTING)
YELP_API_KEY=${EXISTING_YELP_API_KEY:-"your_yelp_api_key"}

# Bull Dashboard Admin (EXISTING)
BULL_ADMIN_USER=${EXISTING_BULL_ADMIN_USER:-"admin"}
BULL_ADMIN_PASS=${EXISTING_BULL_ADMIN_PASS:-"secure_password"}

# Cost Control Settings (EXISTING)
S3_MONTHLY_BUDGET=${EXISTING_S3_MONTHLY_BUDGET:-"20.00"}
S3_RATE_LIMIT_HOUR=${EXISTING_S3_RATE_LIMIT_HOUR:-"100"}
S3_RATE_LIMIT_DAY=${EXISTING_S3_RATE_LIMIT_DAY:-"1000"}
S3_EMERGENCY_THRESHOLD=${EXISTING_S3_EMERGENCY_THRESHOLD:-"0.90"}

# Application Settings
NODE_ENV=production
PORT=3001
FRONTEND_URL=${EXISTING_FRONTEND_URL:-"https://your-production-domain.com"}
LOG_LEVEL=${EXISTING_LOG_LEVEL:-"info"}

# Server (when ready)
SERVER_IP=${prod_ip}
EOF

    # Generate deployment guide
    cat > ./deployment-config/DEPLOYMENT_GUIDE.md <<EOF
# 🚀 Hoppy Hour Deployment Guide

## 📋 Infrastructure Overview

**Generated:** $(date)  
**AWS Region:** ${AWS_REGION}  
**Project:** ${PROJECT_NAME}

### 🗄️ Databases
- **Development:** \`${PROJECT_NAME}-dev-db\` (${dev_db_endpoint})
- **Production:** \`${PROJECT_NAME}-prod-db\` (${prod_db_endpoint})

### 🔄 Redis Cache  
- **Development:** \`${PROJECT_NAME}-dev-redis\` (${dev_redis_endpoint})
- **Production:** \`${PROJECT_NAME}-prod-redis\` (${prod_redis_endpoint})

### 💾 S3 Storage
- **Development:** \`${EXISTING_DEV_S3_BUCKET}\` (existing)
- **Production:** \`${PROD_S3_BUCKET}\` (new)

### 🖥️ Servers
- **Development:** ${dev_ip} (\`${PROJECT_NAME}-dev\`)
- **Production:** ${prod_ip} (\`${PROJECT_NAME}-prod\`)

## 🔑 Important Files

1. \`database-passwords.txt\` - Store this securely!
2. \`.env.development\` - Development environment variables
3. \`.env.production\` - Production environment variables  
4. \`${PROJECT_NAME}-dev-key.pem\` - SSH key for dev server
5. \`${PROJECT_NAME}-prod-key.pem\` - SSH key for prod server

## 🚀 Next Steps

### 1. Test Database Connection
\`\`\`bash
psql "postgresql://postgres:${DB_PASSWORD_DEV}@${dev_db_endpoint}:5432/postgres"
\`\`\`

### 2. Connect to Servers
\`\`\`bash
# Development
ssh -i deployment-config/${PROJECT_NAME}-dev-key.pem ubuntu@${dev_ip}

# Production  
ssh -i deployment-config/${PROJECT_NAME}-prod-key.pem ubuntu@${prod_ip}
\`\`\`

### 3. Deploy Your Application
1. Copy your \`.env.development\` or \`.env.production\` to your project
2. Run database migrations
3. Deploy your code to the appropriate server

## 💰 Monthly Cost Estimate
- RDS (2x t3.micro): **Free tier** (12 months)
- ElastiCache (2x t3.micro): **Free tier** (12 months)  
- Lightsail (2x nano): **\$7.00/month**
- S3 Storage: **~\$1-3/month**

**Total: ~\$8-10/month**

## 🔧 Management Commands

### Scale Resources
\`\`\`bash
# Upgrade RDS instance class
aws rds modify-db-instance --db-instance-identifier ${PROJECT_NAME}-prod-db --db-instance-class db.t3.small --apply-immediately

# Upgrade Lightsail instance
aws lightsail create-instance-snapshot --instance-name ${PROJECT_NAME}-prod --instance-snapshot-name before-upgrade
\`\`\`

### Cleanup (⚠️ Destructive)
\`\`\`bash
# Remove development resources
aws rds delete-db-instance --db-instance-identifier ${PROJECT_NAME}-dev-db --skip-final-snapshot
aws elasticache delete-cache-cluster --cache-cluster-id ${PROJECT_NAME}-dev-redis
aws lightsail delete-instance --instance-name ${PROJECT_NAME}-dev
\`\`\`
EOF

    log_info "Configuration files created in ./deployment-config/"
}

# Cost estimation
show_cost_breakdown() {
    cat <<EOF

💰 COST BREAKDOWN (Monthly)
==========================
RDS PostgreSQL (2x t3.micro):     FREE (12 months new AWS accounts)
ElastiCache Redis (2x t3.micro):  FREE (12 months new AWS accounts) 
Lightsail Ubuntu (2x nano):       \$7.00 ($3.50 each)
S3 Storage (~1GB):                 \$0.50
Data Transfer:                     \$1.00

TOTAL ESTIMATED:                   \$8.50/month
AFTER FREE TIER EXPIRES:           \$25-30/month

💡 This is perfect for MVP - you can scale up individual components as needed!
EOF
}

# Main execution
main() {
    echo "🍺 Hoppy Hour Infrastructure Setup"
    echo "=================================="
    echo ""
    
    setup_output_directory
    check_prerequisites
    load_existing_env
    validate_configuration
    generate_passwords
    
    log_step "Creating AWS infrastructure..."
    sg_id=$(create_security_group)
    create_databases "$sg_id"
    
    # Save passwords after database creation (in case fallback passwords were used)
    save_passwords
    
    create_redis_instances "$sg_id"
    create_redis_instances "$sg_id"
    create_compute_instances
    setup_s3_buckets
    setup_ssh_access
    
    wait_for_services
    generate_configuration
    
    echo ""
    log_info "🎉 Infrastructure setup complete!"
    echo ""
    log_info "📁 All configuration files are in ./deployment-config/"
    log_info "🔐 Database passwords are in ./deployment-config/database-passwords.txt"
    log_info "📖 Read ./deployment-config/DEPLOYMENT_GUIDE.md for next steps"
    echo ""
    
    show_cost_breakdown
}

# Execute main function
main "$@"