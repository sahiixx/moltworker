#!/usr/bin/env node
/**
 * Dubai Real Estate - RFM Lead Scoring
 * Recency, Frequency, Monetary analysis for real estate leads
 *
 * Usage:
 *   node score-leads.js --input leads.json --export
 *   node score-leads.js --input leads.json --segment CHAMPIONS --limit 50
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

// RFM Segment Definitions
const SEGMENTS = {
  CHAMPIONS: { rfm: '555,554,545,544,455,454,445,444', label: 'Champions', priority: 1 },
  LOYAL: { rfm: '543,542,535,534,525,524,453,452,445,444,435,434,425,424', label: 'Loyal Customers', priority: 2 },
  POTENTIAL: { rfm: '553,551,552,541,531,521,512,511', label: 'Potential Loyalists', priority: 3 },
  NEW: { rfm: '512,511,422,421,412,411,311', label: 'New Customers', priority: 4 },
  PROMISING: { rfm: '525,524,523,522,521,515,514,513', label: 'Promising', priority: 5 },
  ATTENTION: { rfm: '535,534,443,434,343,334,325,324', label: 'Need Attention', priority: 6 },
  ABOUT_TO_SLEEP: { rfm: '331,321,312,221,213,212,211', label: 'About to Sleep', priority: 7 },
  AT_RISK: { rfm: '255,254,245,244,253,252,243,242,235,234,225,224', label: 'At Risk', priority: 8 },
  CANNOT_LOSE: { rfm: '155,154,145,144,153,152,143,142,135,134,125,124', label: 'Cannot Lose', priority: 9 },
  HIBERNATING: { rfm: '222,221,212,211,122,121,112,111', label: 'Hibernating', priority: 10 },
  LOST: { rfm: '111,112,121,122,131,132,141,142', label: 'Lost', priority: 11 }
};

function parseArgs() {
  const result = {
    input: null,
    output: null,
    segment: null,
    limit: null,
    export: false,
    recencyWeight: 0.35,
    frequencyWeight: 0.30,
    monetaryWeight: 0.35,
    format: 'json'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
      case '-i':
        result.input = args[++i];
        break;
      case '--output':
      case '-o':
        result.output = args[++i];
        break;
      case '--segment':
      case '-s':
        result.segment = args[++i]?.toUpperCase();
        break;
      case '--limit':
      case '-l':
        result.limit = parseInt(args[++i], 10);
        break;
      case '--export':
      case '-e':
        result.export = true;
        break;
      case '--recency-weight':
        result.recencyWeight = parseFloat(args[++i]);
        break;
      case '--frequency-weight':
        result.frequencyWeight = parseFloat(args[++i]);
        break;
      case '--monetary-weight':
        result.monetaryWeight = parseFloat(args[++i]);
        break;
      case '--format':
        result.format = args[++i];
        break;
    }
  }

  return result;
}

function calculateRecencyScore(lastContactDate) {
  const now = new Date();
  const lastContact = new Date(lastContactDate);
  const daysSinceContact = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));

  // Dubai real estate cycle: adjust thresholds for market
  if (daysSinceContact <= 7) return { score: 5, days: daysSinceContact, label: 'Very Recent' };
  if (daysSinceContact <= 30) return { score: 4, days: daysSinceContact, label: 'Recent' };
  if (daysSinceContact <= 90) return { score: 3, days: daysSinceContact, label: 'Moderate' };
  if (daysSinceContact <= 180) return { score: 2, days: daysSinceContact, label: 'Declining' };
  return { score: 1, days: daysSinceContact, label: 'Dormant' };
}

function calculateFrequencyScore(interactionCount) {
  // Interactions: calls, emails, viewings, inquiries
  if (interactionCount >= 15) return { score: 5, count: interactionCount, label: 'Highly Engaged' };
  if (interactionCount >= 10) return { score: 4, count: interactionCount, label: 'Engaged' };
  if (interactionCount >= 5) return { score: 3, count: interactionCount, label: 'Moderate' };
  if (interactionCount >= 2) return { score: 2, count: interactionCount, label: 'Low' };
  return { score: 1, count: interactionCount, label: 'Minimal' };
}

function calculateMonetaryScore(transactionValue) {
  // Dubai market: values in AED
  if (transactionValue >= 5000000) return { score: 5, value: transactionValue, label: 'Ultra High Value' };
  if (transactionValue >= 3000000) return { score: 4, value: transactionValue, label: 'High Value' };
  if (transactionValue >= 1500000) return { score: 3, value: transactionValue, label: 'Mid-High Value' };
  if (transactionValue >= 800000) return { score: 2, value: transactionValue, label: 'Mid Value' };
  return { score: 1, value: transactionValue, label: 'Entry Level' };
}

function determineSegment(r, f, m) {
  const rfmCode = `${r}${f}${m}`;

  for (const [segmentName, segmentDef] of Object.entries(SEGMENTS)) {
    const codes = segmentDef.rfm.split(',');
    if (codes.includes(rfmCode)) {
      return { segment: segmentName, label: segmentDef.label, priority: segmentDef.priority };
    }
  }

  // Default segmentation based on total score
  const total = r + f + m;
  if (total >= 13) return { segment: 'CHAMPIONS', label: 'Champions', priority: 1 };
  if (total >= 10) return { segment: 'LOYAL', label: 'Loyal Customers', priority: 2 };
  if (total >= 7) return { segment: 'ATTENTION', label: 'Need Attention', priority: 6 };
  if (total >= 5) return { segment: 'AT_RISK', label: 'At Risk', priority: 8 };
  return { segment: 'HIBERNATING', label: 'Hibernating', priority: 10 };
}

function scoreLead(lead, weights) {
  const recency = calculateRecencyScore(lead.lastContactDate || lead.lastContact || new Date().toISOString());
  const frequency = calculateFrequencyScore(lead.interactionCount || lead.interactions || 0);
  const monetary = calculateMonetaryScore(lead.transactionValue || lead.value || lead.budget?.max || 0);

  const segmentInfo = determineSegment(recency.score, frequency.score, monetary.score);

  const weightedScore = (
    recency.score * weights.recencyWeight +
    frequency.score * weights.frequencyWeight +
    monetary.score * weights.monetaryWeight
  ) * (15 / (weights.recencyWeight + weights.frequencyWeight + weights.monetaryWeight));

  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    preferredArea: lead.preferredArea,
    rfm: {
      recency,
      frequency,
      monetary,
      rfmCode: `${recency.score}${frequency.score}${monetary.score}`,
      totalScore: recency.score + frequency.score + monetary.score,
      weightedScore: Math.round(weightedScore * 100) / 100,
      segment: segmentInfo.segment,
      segmentLabel: segmentInfo.label,
      priority: segmentInfo.priority
    },
    original: lead
  };
}

function generateSummary(scoredLeads) {
  const segments = {};
  let totalValue = 0;
  let totalInteractions = 0;

  for (const lead of scoredLeads) {
    const seg = lead.rfm.segment;
    if (!segments[seg]) {
      segments[seg] = { count: 0, totalValue: 0, avgScore: 0, leads: [] };
    }
    segments[seg].count++;
    segments[seg].totalValue += lead.rfm.monetary.value;
    segments[seg].avgScore += lead.rfm.totalScore;
    segments[seg].leads.push(lead.id);

    totalValue += lead.rfm.monetary.value;
    totalInteractions += lead.rfm.frequency.count;
  }

  // Calculate averages
  for (const seg of Object.keys(segments)) {
    segments[seg].avgScore = Math.round(segments[seg].avgScore / segments[seg].count * 100) / 100;
  }

  return {
    totalLeads: scoredLeads.length,
    totalValue: totalValue,
    totalValueFormatted: `${(totalValue / 1000000).toFixed(1)}M AED`,
    avgInteractions: Math.round(totalInteractions / scoredLeads.length * 10) / 10,
    segments: Object.entries(segments)
      .sort((a, b) => SEGMENTS[a[0]]?.priority - SEGMENTS[b[0]]?.priority)
      .reduce((acc, [k, v]) => {
        acc[k] = {
          ...v,
          percentage: Math.round(v.count / scoredLeads.length * 100),
          totalValueFormatted: `${(v.totalValue / 1000000).toFixed(1)}M AED`
        };
        return acc;
      }, {})
  };
}

function loadLeads(inputPath) {
  // Try multiple data sources
  if (inputPath && fs.existsSync(inputPath)) {
    return JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  }

  // Check default locations
  const defaultPaths = [
    path.join(__dirname, '../data/leads.json'),
    path.join(process.cwd(), 'leads.json'),
    path.join(process.cwd(), 'data/leads.json')
  ];

  for (const p of defaultPaths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  }

  // Return sample data for demo
  return [
    {
      id: 'LEAD_001',
      name: 'Ahmed Al Maktoum',
      email: 'ahmed@example.com',
      phone: '+971501234567',
      lastContactDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      interactionCount: 12,
      transactionValue: 3500000,
      preferredArea: 'The Springs'
    },
    {
      id: 'LEAD_002',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      phone: '+971502345678',
      lastContactDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      interactionCount: 6,
      transactionValue: 2200000,
      preferredArea: 'Arabian Ranches'
    },
    {
      id: 'LEAD_003',
      name: 'Mohammed Khan',
      email: 'mkhan@example.com',
      phone: '+971503456789',
      lastContactDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      interactionCount: 18,
      transactionValue: 5500000,
      preferredArea: 'Palm Jumeirah'
    },
    {
      id: 'LEAD_004',
      name: 'Emma Wilson',
      email: 'emma@example.com',
      phone: '+971504567890',
      lastContactDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      interactionCount: 3,
      transactionValue: 1200000,
      preferredArea: 'JVC'
    },
    {
      id: 'LEAD_005',
      name: 'Rashid Al Habtoor',
      email: 'rashid@example.com',
      phone: '+971505678901',
      lastContactDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      interactionCount: 8,
      transactionValue: 4200000,
      preferredArea: 'Dubai Hills Estate'
    }
  ];
}

function main() {
  const options = parseArgs();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Dubai Real Estate - RFM Lead Scoring

Usage:
  node score-leads.js [OPTIONS]

Options:
  --input, -i <file>       Input JSON file with leads
  --output, -o <file>      Output file path
  --segment, -s <name>     Filter by segment (CHAMPIONS, LOYAL, etc.)
  --limit, -l <n>          Limit results
  --export, -e             Export results to file
  --recency-weight <n>     Weight for recency (default: 0.35)
  --frequency-weight <n>   Weight for frequency (default: 0.30)
  --monetary-weight <n>    Weight for monetary (default: 0.35)
  --format <type>          Output format: json, csv (default: json)

Segments:
  CHAMPIONS      - Best customers, high value, recent, frequent
  LOYAL          - Consistent buyers, high engagement
  POTENTIAL      - Recent but need nurturing
  NEW            - Brand new leads
  PROMISING      - Shows promise, needs engagement
  ATTENTION      - Need attention soon
  ABOUT_TO_SLEEP - Declining engagement
  AT_RISK        - Previously active, now declining
  CANNOT_LOSE    - High value but going dormant
  HIBERNATING    - Long dormant, low activity
  LOST           - Likely churned
`);
    process.exit(0);
  }

  try {
    const leads = loadLeads(options.input);

    if (!Array.isArray(leads) || leads.length === 0) {
      console.error(JSON.stringify({ error: 'No leads found in input' }));
      process.exit(1);
    }

    const weights = {
      recencyWeight: options.recencyWeight,
      frequencyWeight: options.frequencyWeight,
      monetaryWeight: options.monetaryWeight
    };

    // Score all leads
    let scoredLeads = leads.map(lead => scoreLead(lead, weights));

    // Sort by weighted score (highest first)
    scoredLeads.sort((a, b) => b.rfm.weightedScore - a.rfm.weightedScore);

    // Filter by segment if specified
    if (options.segment) {
      scoredLeads = scoredLeads.filter(l => l.rfm.segment === options.segment);
    }

    // Apply limit
    if (options.limit) {
      scoredLeads = scoredLeads.slice(0, options.limit);
    }

    // Calculate percentiles
    const totalLeads = scoredLeads.length;
    scoredLeads.forEach((lead, idx) => {
      lead.rfm.percentile = Math.round((1 - idx / totalLeads) * 100);
    });

    const summary = generateSummary(scoredLeads);

    const output = {
      timestamp: new Date().toISOString(),
      parameters: {
        input: options.input || 'default',
        segment: options.segment || 'all',
        limit: options.limit || 'none',
        weights
      },
      summary,
      leads: scoredLeads.map(l => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        preferredArea: l.preferredArea,
        rfm: l.rfm
      }))
    };

    if (options.export) {
      const outputPath = options.output || path.join(__dirname, `../output/scored-leads-${Date.now()}.json`);
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (options.format === 'csv') {
        const csvLines = ['id,name,phone,email,area,rfm_code,segment,total_score,weighted_score,percentile'];
        for (const lead of output.leads) {
          csvLines.push([
            lead.id,
            `"${lead.name}"`,
            lead.phone,
            lead.email,
            `"${lead.preferredArea || ''}"`,
            lead.rfm.rfmCode,
            lead.rfm.segment,
            lead.rfm.totalScore,
            lead.rfm.weightedScore,
            lead.rfm.percentile
          ].join(','));
        }
        fs.writeFileSync(outputPath.replace('.json', '.csv'), csvLines.join('\n'));
      } else {
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
      }

      output.exportedTo = outputPath;
    }

    console.log(JSON.stringify(output, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message, stack: err.stack }));
    process.exit(1);
  }
}

main();
