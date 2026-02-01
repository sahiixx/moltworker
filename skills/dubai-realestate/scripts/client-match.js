#!/usr/bin/env node
/**
 * Dubai Real Estate - Client Matcher
 * AI-powered matching of leads to properties based on preferences
 *
 * Usage:
 *   node client-match.js --lead-id LEAD_001
 *   node client-match.js --segment CHAMPIONS --limit 100
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

function parseArgs() {
  const result = {
    leadId: null,
    segment: null,
    limit: 20,
    minScore: 60,
    notify: false,
    export: false,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--lead-id':
      case '-l':
        result.leadId = args[++i];
        break;
      case '--segment':
      case '-s':
        result.segment = args[++i]?.toUpperCase();
        break;
      case '--limit':
        result.limit = parseInt(args[++i], 10);
        break;
      case '--min-score':
        result.minScore = parseInt(args[++i], 10);
        break;
      case '--notify':
      case '-n':
        result.notify = true;
        break;
      case '--export':
      case '-e':
        result.export = true;
        break;
      case '--output':
      case '-o':
        result.output = args[++i];
        break;
    }
  }

  return result;
}

// Sample leads (would come from database)
const SAMPLE_LEADS = [
  {
    id: 'LEAD_001',
    name: 'Ahmed Al Maktoum',
    phone: '+971501234567',
    email: 'ahmed@example.com',
    preferences: {
      area: ['The Springs', 'Arabian Ranches'],
      type: 'villa',
      beds: { min: 3, max: 4 },
      budget: { min: 2000000, max: 3500000 },
      features: ['pool', 'garden'],
      mustHave: ['maid-room'],
      timeline: 'immediate'
    },
    rfm: { segment: 'CHAMPIONS', totalScore: 14 }
  },
  {
    id: 'LEAD_002',
    name: 'Sarah Johnson',
    phone: '+971502345678',
    email: 'sarah@example.com',
    preferences: {
      area: ['Dubai Marina', 'JBR'],
      type: 'apartment',
      beds: { min: 2, max: 3 },
      budget: { min: 1500000, max: 2500000 },
      features: ['sea-view', 'balcony'],
      mustHave: ['gym', 'pool'],
      timeline: '3months'
    },
    rfm: { segment: 'LOYAL', totalScore: 12 }
  },
  {
    id: 'LEAD_003',
    name: 'Mohammed Khan',
    phone: '+971503456789',
    email: 'mkhan@example.com',
    preferences: {
      area: ['Palm Jumeirah', 'Downtown Dubai'],
      type: 'villa',
      beds: { min: 5, max: 7 },
      budget: { min: 10000000, max: 25000000 },
      features: ['beach', 'private-pool'],
      mustHave: ['sea-view'],
      timeline: 'flexible'
    },
    rfm: { segment: 'CANNOT_LOSE', totalScore: 10 }
  }
];

// Sample properties (would come from database)
const SAMPLE_PROPERTIES = [
  { id: 'PROP_001', area: 'The Springs', subArea: 'Springs 3', type: 'villa', beds: 3, baths: 3, sqft: 2800, price: 2100000, features: ['pool', 'garden', 'maid-room', 'upgraded'], status: 'available' },
  { id: 'PROP_002', area: 'The Springs', subArea: 'Springs 7', type: 'villa', beds: 4, baths: 4, sqft: 3400, price: 2850000, features: ['lake-view', 'upgraded', 'maid-room', 'garden'], status: 'available' },
  { id: 'PROP_003', area: 'Arabian Ranches', subArea: 'Saheel', type: 'villa', beds: 5, baths: 5, sqft: 4200, price: 4500000, features: ['pool', 'garden', 'driver-room', 'maid-room'], status: 'available' },
  { id: 'PROP_004', area: 'Dubai Marina', subArea: 'Marina Gate', type: 'apartment', beds: 2, baths: 2, sqft: 1400, price: 1850000, features: ['sea-view', 'balcony', 'gym', 'pool'], status: 'available' },
  { id: 'PROP_005', area: 'Dubai Marina', subArea: 'JBR', type: 'apartment', beds: 3, baths: 3, sqft: 2100, price: 3200000, features: ['beach-access', 'full-sea-view', 'upgraded', 'gym', 'pool'], status: 'available' },
  { id: 'PROP_006', area: 'Palm Jumeirah', subArea: 'Garden Homes', type: 'villa', beds: 6, baths: 7, sqft: 8500, price: 18000000, features: ['beach', 'pool', 'private-garden', 'atlantis-view', 'sea-view'], status: 'available' }
];

function loadData(type) {
  const defaultPaths = {
    leads: [path.join(__dirname, '../data/leads.json'), path.join(__dirname, '../output/scored-leads.json')],
    properties: [path.join(__dirname, '../data/properties.json')]
  };

  for (const p of defaultPaths[type] || []) {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return data.leads || data;
    }
  }

  return type === 'leads' ? SAMPLE_LEADS : SAMPLE_PROPERTIES;
}

function calculateMatchScore(lead, property) {
  const prefs = lead.preferences || {};
  let score = 0;
  let maxScore = 0;
  const matchDetails = [];

  // Area match (25 points max)
  maxScore += 25;
  if (prefs.area && prefs.area.length > 0) {
    const areaMatch = prefs.area.some(a =>
      property.area.toLowerCase().includes(a.toLowerCase()) ||
      a.toLowerCase().includes(property.area.toLowerCase())
    );
    if (areaMatch) {
      score += 25;
      matchDetails.push({ criterion: 'area', score: 25, matched: true });
    } else {
      matchDetails.push({ criterion: 'area', score: 0, matched: false, reason: `Wanted: ${prefs.area.join(', ')}` });
    }
  } else {
    score += 20; // Neutral if no preference
    matchDetails.push({ criterion: 'area', score: 20, matched: true, reason: 'No preference' });
  }

  // Property type match (15 points max)
  maxScore += 15;
  if (prefs.type) {
    if (property.type === prefs.type) {
      score += 15;
      matchDetails.push({ criterion: 'type', score: 15, matched: true });
    } else {
      matchDetails.push({ criterion: 'type', score: 0, matched: false, reason: `Wanted: ${prefs.type}` });
    }
  } else {
    score += 12;
    matchDetails.push({ criterion: 'type', score: 12, matched: true, reason: 'No preference' });
  }

  // Bedroom match (20 points max)
  maxScore += 20;
  if (prefs.beds) {
    const minBeds = prefs.beds.min || 1;
    const maxBeds = prefs.beds.max || 10;
    if (property.beds >= minBeds && property.beds <= maxBeds) {
      score += 20;
      matchDetails.push({ criterion: 'bedrooms', score: 20, matched: true });
    } else if (property.beds === minBeds - 1 || property.beds === maxBeds + 1) {
      score += 10;
      matchDetails.push({ criterion: 'bedrooms', score: 10, matched: 'partial', reason: 'Close to preference' });
    } else {
      matchDetails.push({ criterion: 'bedrooms', score: 0, matched: false, reason: `Wanted: ${minBeds}-${maxBeds} beds` });
    }
  } else {
    score += 15;
    matchDetails.push({ criterion: 'bedrooms', score: 15, matched: true, reason: 'No preference' });
  }

  // Budget match (25 points max)
  maxScore += 25;
  if (prefs.budget) {
    const minBudget = prefs.budget.min || 0;
    const maxBudget = prefs.budget.max || Infinity;
    if (property.price >= minBudget && property.price <= maxBudget) {
      score += 25;
      matchDetails.push({ criterion: 'budget', score: 25, matched: true });
    } else if (property.price < minBudget && property.price >= minBudget * 0.9) {
      score += 20;
      matchDetails.push({ criterion: 'budget', score: 20, matched: 'partial', reason: 'Below budget' });
    } else if (property.price > maxBudget && property.price <= maxBudget * 1.1) {
      score += 15;
      matchDetails.push({ criterion: 'budget', score: 15, matched: 'partial', reason: 'Slightly over budget' });
    } else {
      matchDetails.push({ criterion: 'budget', score: 0, matched: false, reason: `Budget: ${(minBudget/1000000).toFixed(1)}-${(maxBudget/1000000).toFixed(1)}M` });
    }
  } else {
    score += 20;
    matchDetails.push({ criterion: 'budget', score: 20, matched: true, reason: 'No preference' });
  }

  // Features match (15 points max)
  maxScore += 15;
  const propFeatures = (property.features || []).map(f => f.toLowerCase());

  // Must-have features (critical)
  if (prefs.mustHave && prefs.mustHave.length > 0) {
    const mustHaveMatched = prefs.mustHave.filter(f => propFeatures.includes(f.toLowerCase()));
    if (mustHaveMatched.length === prefs.mustHave.length) {
      score += 10;
      matchDetails.push({ criterion: 'mustHave', score: 10, matched: true });
    } else {
      matchDetails.push({ criterion: 'mustHave', score: 0, matched: false, reason: `Missing: ${prefs.mustHave.filter(f => !propFeatures.includes(f.toLowerCase())).join(', ')}` });
    }
  } else {
    score += 8;
  }

  // Nice-to-have features
  if (prefs.features && prefs.features.length > 0) {
    const featuresMatched = prefs.features.filter(f => propFeatures.includes(f.toLowerCase()));
    const featureScore = Math.round((featuresMatched.length / prefs.features.length) * 5);
    score += featureScore;
    matchDetails.push({ criterion: 'features', score: featureScore, matched: featuresMatched.length > 0, reason: `${featuresMatched.length}/${prefs.features.length} matched` });
  } else {
    score += 4;
  }

  const percentScore = Math.round((score / maxScore) * 100);

  return {
    score: percentScore,
    maxScore: 100,
    details: matchDetails,
    recommendation: getRecommendation(percentScore)
  };
}

function getRecommendation(score) {
  if (score >= 90) return { level: 'excellent', action: 'Schedule viewing immediately', priority: 1 };
  if (score >= 75) return { level: 'strong', action: 'Send property details', priority: 2 };
  if (score >= 60) return { level: 'good', action: 'Include in options list', priority: 3 };
  if (score >= 40) return { level: 'partial', action: 'Mention as alternative', priority: 4 };
  return { level: 'weak', action: 'Not recommended', priority: 5 };
}

function matchLeadToProperties(lead, properties, minScore) {
  const matches = properties
    .map(prop => {
      const matchResult = calculateMatchScore(lead, prop);
      return {
        property: {
          id: prop.id,
          area: prop.area,
          subArea: prop.subArea,
          type: prop.type,
          beds: prop.beds,
          sqft: prop.sqft,
          price: prop.price,
          priceFormatted: `${(prop.price / 1000000).toFixed(2)}M AED`,
          features: prop.features
        },
        match: matchResult
      };
    })
    .filter(m => m.match.score >= minScore)
    .sort((a, b) => b.match.score - a.match.score);

  return {
    lead: {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      segment: lead.rfm?.segment,
      preferences: lead.preferences
    },
    matchCount: matches.length,
    topMatches: matches.slice(0, 5),
    allMatches: matches
  };
}

function generateNotification(matchResult) {
  const { lead, topMatches } = matchResult;

  if (topMatches.length === 0) {
    return {
      type: 'no_matches',
      message: `No suitable properties found for ${lead.name} based on current criteria.`,
      suggestion: 'Consider adjusting budget or area preferences.'
    };
  }

  const bestMatch = topMatches[0];
  return {
    type: 'match_found',
    leadName: lead.name,
    leadPhone: lead.phone,
    matchScore: bestMatch.match.score,
    property: bestMatch.property,
    message: `Found ${topMatches.length} matching properties for ${lead.name}. Best match: ${bestMatch.property.beds}BR ${bestMatch.property.type} in ${bestMatch.property.area} at ${bestMatch.property.priceFormatted} (${bestMatch.match.score}% match).`,
    whatsappTemplate: `Hi ${lead.name.split(' ')[0]}, great news! I found a property that matches your requirements - a ${bestMatch.property.beds} bedroom ${bestMatch.property.type} in ${bestMatch.property.area} at ${bestMatch.property.priceFormatted}. Would you like to schedule a viewing?`,
    callScript: `Hello ${lead.name.split(' ')[0]}, this is [Agent] from Dubai Premier Properties. I have exciting news - I've found a ${bestMatch.property.type} in ${bestMatch.property.area} that matches your criteria. It has ${bestMatch.property.beds} bedrooms and is priced at ${bestMatch.property.priceFormatted}. When would be a good time for a viewing?`
  };
}

function main() {
  const options = parseArgs();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Dubai Real Estate - Client Matcher

Usage:
  node client-match.js [OPTIONS]

Options:
  --lead-id, -l <id>      Match specific lead by ID
  --segment, -s <name>    Match all leads in segment
  --limit <n>             Max leads to process (default: 20)
  --min-score <n>         Minimum match score % (default: 60)
  --notify, -n            Generate notification templates
  --export, -e            Export results
  --output, -o <file>     Output file path

Examples:
  node client-match.js --lead-id LEAD_001
  node client-match.js --segment CHAMPIONS --limit 50
  node client-match.js --lead-id LEAD_001 --notify
`);
    process.exit(0);
  }

  try {
    const leads = loadData('leads');
    const properties = loadData('properties').filter(p => p.status === 'available');

    let targetLeads = leads;

    // Filter by lead ID
    if (options.leadId) {
      targetLeads = leads.filter(l => l.id === options.leadId);
      if (targetLeads.length === 0) {
        console.error(JSON.stringify({ error: `Lead not found: ${options.leadId}` }));
        process.exit(1);
      }
    }

    // Filter by segment
    if (options.segment) {
      targetLeads = targetLeads.filter(l => l.rfm?.segment === options.segment);
    }

    // Apply limit
    targetLeads = targetLeads.slice(0, options.limit);

    const results = targetLeads.map(lead => {
      const matchResult = matchLeadToProperties(lead, properties, options.minScore);
      if (options.notify) {
        matchResult.notification = generateNotification(matchResult);
      }
      return matchResult;
    });

    const output = {
      timestamp: new Date().toISOString(),
      parameters: {
        leadId: options.leadId || 'all',
        segment: options.segment || 'all',
        minScore: options.minScore,
        propertiesSearched: properties.length
      },
      summary: {
        leadsProcessed: results.length,
        leadsWithMatches: results.filter(r => r.matchCount > 0).length,
        totalMatches: results.reduce((s, r) => s + r.matchCount, 0),
        avgMatchScore: results.length > 0
          ? Math.round(results.reduce((s, r) => s + (r.topMatches[0]?.match.score || 0), 0) / results.length)
          : 0
      },
      results: results.length === 1 ? results[0] : results
    };

    if (options.export) {
      const outputPath = options.output || path.join(__dirname, `../output/client-matches-${Date.now()}.json`);
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
      output.exportedTo = outputPath;
    }

    console.log(JSON.stringify(output, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();
