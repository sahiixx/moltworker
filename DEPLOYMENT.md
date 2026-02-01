# OpenClaw Complete Deployment Guide

## Dubai Real Estate AI Assistant - Full Implementation

---

## What You're Building

An always-on AI assistant that:
- Runs 24/7 on Cloudflare's edge network
- Manages your 18,899 real estate leads with RFM scoring
- Integrates with Retell.ai for voice campaigns
- Accesses your 31B+ AED transaction database
- Generates market insights and client matching
- Handles Telegram/Discord/Slack messages
- Maintains conversation history across platforms

**Cost**: ~$5-10/month (Workers + minimal AI Gateway usage)

---

## Phase 1: Instant Deployment (10 minutes)

### 1.1 Prerequisites

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Verify Workers plan (needs Paid plan for Sandboxes)
# Go to: https://dash.cloudflare.com -> Workers & Pages -> Plans
# Upgrade to Workers Paid ($5/month) if needed
```

### 1.2 Clone and Setup

```bash
# Clone your fork
cd ~/projects
git clone https://github.com/sahiixx/moltworker.git
cd moltworker

# Install dependencies
npm install

# Create local environment file for development
cat > .dev.vars << 'EOF'
DEV_MODE=true
DEBUG_ROUTES=true
ANTHROPIC_API_KEY=your_anthropic_key_here
EOF
```

### 1.3 Configure API Access

**Option A: Direct Anthropic (Simplest)**
```bash
# Get API key from: https://console.anthropic.com/settings/keys
npx wrangler secret put ANTHROPIC_API_KEY
# Paste your key when prompted
```

**Option B: Cloudflare AI Gateway (Recommended for analytics)**
```bash
# 1. Create AI Gateway
# Go to: https://dash.cloudflare.com -> AI -> AI Gateway -> Create Gateway
# Name it: real-estate-ai
# Add provider: Anthropic

# 2. Set secrets
npx wrangler secret put AI_GATEWAY_API_KEY
# Enter your Anthropic API key

npx wrangler secret put AI_GATEWAY_BASE_URL
# Enter: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic
```

### 1.4 Generate Gateway Token

```bash
# Generate secure token (SAVE THIS!)
export MOLTBOT_GATEWAY_TOKEN=$(openssl rand -hex 32)
echo "=========================================="
echo "GATEWAY TOKEN (SAVE THIS SOMEWHERE SAFE):"
echo "$MOLTBOT_GATEWAY_TOKEN"
echo "=========================================="

# Set as secret
echo "$MOLTBOT_GATEWAY_TOKEN" | npx wrangler secret put MOLTBOT_GATEWAY_TOKEN
```

### 1.5 Deploy

```bash
# First deployment
npm run deploy

# Note the URL (e.g., moltworker.your-subdomain.workers.dev)
# First request takes 1-2 minutes to start container
```

**Access Control UI:**
```
https://your-worker.workers.dev/?token=YOUR_GATEWAY_TOKEN
```

---

## Phase 2: Security Setup (15 minutes)

### 2.1 Enable Cloudflare Access

1. Go to Workers dashboard: https://dash.cloudflare.com -> Workers & Pages -> [Your Worker]
2. Settings -> Domains & Routes
3. Find the workers.dev row -> Click (...) menu
4. Click "Enable Cloudflare Access"
5. Click "Manage Cloudflare Access"
6. Add your email to allow list OR configure Google/GitHub auth
7. Copy the Application Audience (AUD) tag

### 2.2 Set Access Secrets

```bash
# Your Access team domain
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN
# Enter: yourteam.cloudflareaccess.com

# Application Audience from step 2.1
npx wrangler secret put CF_ACCESS_AUD
# Paste the AUD tag
```

### 2.3 Redeploy

```bash
npm run deploy
# Now visit /_admin/ - you'll authenticate via Cloudflare Access
```

---

## Phase 3: Persistent Storage (10 minutes)

Without this, your paired devices and conversation history are lost when the container restarts.

### 3.1 Create R2 Bucket

Bucket is auto-created on first deploy. Verify at: https://dash.cloudflare.com -> R2

### 3.2 Generate R2 API Token

1. Go to R2 dashboard: https://dash.cloudflare.com -> R2 -> Overview
2. Click "Manage R2 API Tokens"
3. Create Token with permissions: Object Read & Write
4. Select bucket: moltbot-data
5. TTL: Never expire
6. Copy Access Key ID and Secret Access Key

### 3.3 Set R2 Secrets

```bash
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put CF_ACCOUNT_ID
# Find Account ID: Dashboard -> Click (...) next to account name -> Copy Account ID
```

### 3.4 Verify R2 Storage

```bash
npm run deploy
# Visit /_admin/
# You should see: "R2 Storage: Connected"
# Click "Backup Now" to test
```

---

## Phase 4: Real Estate Skills Setup

### 4.1 Install Skill Dependencies

```bash
cd skills/dubai-realestate
npm install
cd ../..
```

### 4.2 Configure Data Sources

```bash
# Google Sheets integration (optional)
npx wrangler secret put GOOGLE_SHEETS_ID
npx wrangler secret put GOOGLE_SHEETS_API_KEY

# Airtable integration (optional)
npx wrangler secret put AIRTABLE_API_KEY
npx wrangler secret put AIRTABLE_BASE_ID

# Retell.ai for voice campaigns
npx wrangler secret put RETELL_API_KEY
npx wrangler secret put RETELL_AGENT_ID

# Your phone number for outbound calls
npx wrangler secret put PHONE_NUMBER
# Enter: your_phone_number_in_e164_format
```

### 4.3 Prepare Lead Data

Copy your leads to `skills/dubai-realestate/data/leads.json`:

```json
[
  {
    "id": "LEAD_001",
    "name": "Ahmed Al Maktoum",
    "email": "ahmed@example.com",
    "phone": "+971501234567",
    "lastContactDate": "2024-12-15T10:30:00Z",
    "interactionCount": 8,
    "transactionValue": 3500000,
    "preferredArea": "The Springs",
    "source": "Website"
  }
]
```

### 4.4 Run Initial Scoring

```bash
cd skills/dubai-realestate

# Score all leads
npm run score -- --input data/leads.json --export

# Review segments
cat output/scored-leads-*.json | head -50
```

---

## Phase 5: Chat Integrations (Optional)

### Telegram Bot

```bash
# 1. Create bot with @BotFather on Telegram
# 2. Set secret
npx wrangler secret put TELEGRAM_BOT_TOKEN
# 3. Redeploy and approve device via /_admin/
npm run deploy
```

### Discord Bot

```bash
# 1. Create application at https://discord.com/developers/applications
# 2. Set secret
npx wrangler secret put DISCORD_BOT_TOKEN
# 3. Invite bot to server and redeploy
npm run deploy
```

### Slack Bot

```bash
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put SLACK_APP_TOKEN
npm run deploy
```

---

## Phase 6: Browser Automation (Optional)

```bash
# Generate CDP secret
npx wrangler secret put CDP_SECRET
# Enter a random string

# Set worker URL
npx wrangler secret put WORKER_URL
# Enter: https://your-worker.workers.dev

npm run deploy
```

---

## Usage Examples

### Via Control UI

```
https://your-worker.workers.dev/?token=YOUR_TOKEN

Ask Claude:
"Score my lead database and show top 20 CANNOT_LOSE segment"
"Generate voice campaign for Arabian Ranches prospects"
"Find 3-bed villas under 2M AED in Springs with recent listings"
"Create mortgage referral for client ID LEAD_12345"
```

### Via Telegram

```
/score leads
/campaign CHAMPIONS limit:25
/search The Springs 3bed <2M
/market-report Arabian Ranches 3
```

### Via CLI

```bash
cd skills/dubai-realestate

# Score leads
npm run score -- --segment CHAMPIONS --limit 20

# Generate voice campaign
npm run campaign -- --segment CANNOT_LOSE --name "Q1 Reactivation" --export

# Search properties
npm run search -- --area "The Springs" --type villa --beds 3 --max-price 2500000

# Market analysis
npm run market -- --area "Dubai Marina" --months 12

# Mortgage calculation
npm run mortgage -- --price 2000000 --down-payment 25 --years 25 --roi

# Client matching
npm run match -- --lead-id LEAD_001 --notify
```

---

## Monitoring & Maintenance

### Admin Dashboard

```
https://your-worker.workers.dev/_admin/

Features:
- R2 backup status + manual backup
- Paired devices management
- Pending device approvals
- Gateway restart
```

### Debug Endpoints

```bash
curl https://your-worker.workers.dev/debug/processes
curl https://your-worker.workers.dev/debug/version
curl "https://your-worker.workers.dev/debug/logs?id=gateway"
```

### Logs

```bash
npx wrangler tail
npx wrangler tail --search "ERROR"
```

---

## Troubleshooting

### Container Won't Start

```bash
npx wrangler secret list
# Verify: ANTHROPIC_API_KEY, MOLTBOT_GATEWAY_TOKEN, CF_ACCESS_*
```

### Device Pairing Not Working

```bash
# Check DEV_MODE is not set in production
npx wrangler secret list | grep DEV_MODE
# Manually approve at /_admin/ -> Pending Devices
```

### R2 Storage Not Persisting

```bash
npx wrangler secret list | grep R2
# All 3 secrets required: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CF_ACCOUNT_ID
```

---

## Cost Breakdown

| Service | Monthly Cost |
|---------|-------------|
| Cloudflare Workers Paid | $5 (required) |
| Anthropic Claude API | ~$5-20 (usage based) |
| AI Gateway | Free tier |
| R2 Storage | ~$0.50 |
| Browser Rendering | Free tier |
| Cloudflare Access | Free tier |
| **Total** | **~$10-25/month** |

---

## Deployment Checklist

- [ ] Cloudflare Workers Paid plan activated
- [ ] Anthropic API key configured
- [ ] Gateway token generated and saved
- [ ] Cloudflare Access enabled and configured
- [ ] R2 storage connected and tested
- [ ] Device paired via /_admin/
- [ ] Lead database exported to JSON
- [ ] Initial RFM scoring completed
- [ ] Retell.ai account created (optional)
- [ ] First voice campaign generated (optional)
- [ ] Telegram/Discord/Slack connected (optional)
- [ ] Browser automation tested (optional)

---

## Resources

- [OpenClaw Docs](https://docs.openclaw.ai/)
- [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/)
- [Retell.ai Docs](https://docs.retell.ai/)
- [Anthropic API](https://docs.anthropic.com/)

**Contact**: your_contact_email_or_number
