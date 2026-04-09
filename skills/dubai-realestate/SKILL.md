---
name: dubai-realestate
description: Dubai Real Estate Intelligence Suite - RFM Lead Scoring, Voice Campaigns, Property Search, Market Analysis
version: 1.0.0
author: OpenClaw
---

# Dubai Real Estate Intelligence Suite

Comprehensive AI-powered real estate intelligence for Dubai property professionals. Includes RFM lead scoring, Retell.ai voice campaign generation, property search, and market analysis.

## Features

- **RFM Lead Scoring**: Recency, Frequency, Monetary analysis for 18,899+ leads
- **Voice Campaigns**: Retell.ai integration for automated outbound calls
- **Property Search**: Multi-source property matching with filters
- **Market Analysis**: Transaction data insights from 31B+ AED database
- **Client Matching**: AI-powered lead-property matching
- **Mortgage Calculator**: ROI and financing analysis

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RETELL_API_KEY` | For voice | Retell.ai API key |
| `RETELL_AGENT_ID` | For voice | Retell.ai agent ID |
| `GOOGLE_SHEETS_ID` | Optional | Lead database sheet ID |
| `GOOGLE_SHEETS_API_KEY` | Optional | Google Sheets API key |
| `AIRTABLE_API_KEY` | Optional | Airtable API key |
| `AIRTABLE_BASE_ID` | Optional | Airtable base ID |
| `PHONE_NUMBER` | For voice | Outbound caller ID |

## Scripts

### score-leads.js

RFM (Recency, Frequency, Monetary) lead scoring with automatic segmentation.

```bash
# Score all leads
node scripts/score-leads.js --input leads.json --export

# Score with custom weights
node scripts/score-leads.js --input leads.json --recency-weight 0.4 --frequency-weight 0.3 --monetary-weight 0.3

# Filter by segment
node scripts/score-leads.js --input leads.json --segment CHAMPIONS --limit 50
```

**RFM Segments:**
- CHAMPIONS (555): Best customers, high value, recent, frequent
- LOYAL (X44-X55): Consistent buyers, high engagement
- POTENTIAL (5X1-5X3): Recent but low frequency
- AT_RISK (2X4-3X5): Previously active, declining
- CANNOT_LOSE (1X5-2X5): High value but dormant
- HIBERNATING (1X1-2X2): Long dormant, low value
- NEW (5X1): Brand new leads

### voice-campaign.js

Generate Retell.ai voice campaign configurations.

```bash
# Generate campaign for segment
node scripts/voice-campaign.js --segment CANNOT_LOSE --limit 50 --name "Q1 Reactivation"

# Custom script template
node scripts/voice-campaign.js --segment AT_RISK --template reactivation --language ar

# Export to Retell format
node scripts/voice-campaign.js --segment CHAMPIONS --export --output campaign.json
```

### property-search.js

Search properties across multiple sources.

```bash
# Search by criteria
node scripts/property-search.js --area "The Springs" --type villa --beds 3 --max-price 2000000

# Search with amenities
node scripts/property-search.js --area "Arabian Ranches" --pool --garden --maid-room

# Export matches
node scripts/property-search.js --area "Dubai Marina" --type apartment --export
```

### market-analysis.js

Analyze market trends and generate reports.

```bash
# Area analysis
node scripts/market-analysis.js --area "The Springs" --months 12

# Price trends
node scripts/market-analysis.js --type villa --beds 3 --trend

# Full market report
node scripts/market-analysis.js --report --areas "The Springs,Arabian Ranches,JVC"
```

### client-match.js

Match leads to properties based on preferences.

```bash
# Match single client
node scripts/client-match.js --lead-id LEAD_001

# Batch matching
node scripts/client-match.js --segment CHAMPIONS --limit 100

# With notifications
node scripts/client-match.js --lead-id LEAD_001 --notify
```

### mortgage-calc.js

Calculate mortgage payments and ROI.

```bash
# Basic calculation
node scripts/mortgage-calc.js --price 2000000 --down-payment 25 --years 25 --rate 4.5

# ROI analysis
node scripts/mortgage-calc.js --price 2000000 --rental-yield 6 --appreciation 5

# Compare scenarios
node scripts/mortgage-calc.js --price 2000000 --compare
```

## Data Formats

### Lead JSON Format

```json
{
  "id": "LEAD_001",
  "name": "Ahmed Al Maktoum",
  "email": "ahmed@example.com",
  "phone": "+971501234567",
  "lastContactDate": "2024-12-15T10:30:00Z",
  "interactionCount": 8,
  "transactionValue": 3500000,
  "preferredArea": "The Springs",
  "preferredType": "villa",
  "budget": { "min": 2000000, "max": 4000000 },
  "beds": 3,
  "source": "Website",
  "tags": ["investor", "cash-buyer"]
}
```

### RFM Output Format

```json
{
  "id": "LEAD_001",
  "name": "Ahmed Al Maktoum",
  "rfm": {
    "recency": { "days": 15, "score": 5 },
    "frequency": { "count": 8, "score": 4 },
    "monetary": { "value": 3500000, "score": 5 },
    "totalScore": 14,
    "segment": "CHAMPIONS",
    "percentile": 95
  }
}
```

## Usage Examples

### Via Claude Chat

```
"Score my lead database and show top 20 CANNOT_LOSE segment"
"Generate voice campaign for Arabian Ranches prospects"
"Find 3-bed villas under 2M AED in Springs with recent listings"
"Create mortgage analysis for 2.5M property with 20% down"
"Match client LEAD_12345 to available properties"
```

### Via API

```bash
# Score leads
curl -X POST https://your-worker.workers.dev/api/skills/dubai-realestate/score \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"segment": "CHAMPIONS", "limit": 20}'

# Search properties
curl -X POST https://your-worker.workers.dev/api/skills/dubai-realestate/search \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"area": "The Springs", "type": "villa", "beds": 3}'
```

## Dubai Market Data

### Areas Covered

- The Springs (1-15)
- Arabian Ranches (1-3)
- Dubai Marina
- Downtown Dubai
- JVC (Jumeirah Village Circle)
- Business Bay
- Palm Jumeirah
- Dubai Hills Estate
- Damac Hills
- Al Barsha

### Transaction Database

- 31B+ AED total transaction value
- Historical pricing data
- Area-wise trends
- Property type breakdown
