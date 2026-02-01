#!/usr/bin/env node
/**
 * Dubai Real Estate - Property Search
 * Search properties across multiple sources with advanced filters
 *
 * Usage:
 *   node property-search.js --area "The Springs" --type villa --beds 3 --max-price 2000000
 *   node property-search.js --area "Dubai Marina" --type apartment --min-price 1000000
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

// Dubai areas with metadata
const DUBAI_AREAS = {
  'the-springs': {
    name: 'The Springs',
    aliases: ['springs', 'the springs'],
    type: 'villa_community',
    avgPricePerSqft: 1150,
    rentalYield: 5.8,
    subAreas: ['Springs 1', 'Springs 2', 'Springs 3', 'Springs 4', 'Springs 5', 'Springs 6', 'Springs 7', 'Springs 8', 'Springs 9', 'Springs 10', 'Springs 11', 'Springs 12', 'Springs 13', 'Springs 14', 'Springs 15'],
    amenities: ['lakes', 'parks', 'community-pools', 'schools', 'retail']
  },
  'arabian-ranches': {
    name: 'Arabian Ranches',
    aliases: ['ranches', 'arabian ranches', 'ar'],
    type: 'villa_community',
    avgPricePerSqft: 1350,
    rentalYield: 5.2,
    subAreas: ['Arabian Ranches 1', 'Arabian Ranches 2', 'Arabian Ranches 3'],
    amenities: ['golf-course', 'equestrian', 'schools', 'retail', 'parks']
  },
  'dubai-marina': {
    name: 'Dubai Marina',
    aliases: ['marina', 'dubai marina'],
    type: 'high_rise',
    avgPricePerSqft: 1450,
    rentalYield: 6.5,
    subAreas: ['Marina Promenade', 'JBR', 'Marina Walk'],
    amenities: ['beach', 'marina', 'restaurants', 'metro', 'tram']
  },
  'downtown-dubai': {
    name: 'Downtown Dubai',
    aliases: ['downtown', 'dtd'],
    type: 'high_rise',
    avgPricePerSqft: 2100,
    rentalYield: 5.5,
    subAreas: ['Burj Khalifa District', 'Boulevard', 'Opera District'],
    amenities: ['burj-khalifa', 'dubai-mall', 'opera', 'metro', 'fountain']
  },
  'palm-jumeirah': {
    name: 'Palm Jumeirah',
    aliases: ['palm', 'the palm'],
    type: 'luxury',
    avgPricePerSqft: 2500,
    rentalYield: 4.8,
    subAreas: ['Fronds', 'Trunk', 'Crescent'],
    amenities: ['beach', 'hotels', 'monorail', 'restaurants']
  },
  'jvc': {
    name: 'Jumeirah Village Circle',
    aliases: ['jvc', 'jumeirah village'],
    type: 'mixed',
    avgPricePerSqft: 850,
    rentalYield: 7.2,
    subAreas: ['District 1-20'],
    amenities: ['parks', 'schools', 'retail']
  },
  'dubai-hills': {
    name: 'Dubai Hills Estate',
    aliases: ['hills', 'dubai hills', 'dhe'],
    type: 'villa_community',
    avgPricePerSqft: 1600,
    rentalYield: 5.0,
    subAreas: ['Fairways', 'Parkway', 'Grove', 'Maple'],
    amenities: ['golf-course', 'parks', 'mall', 'schools']
  },
  'business-bay': {
    name: 'Business Bay',
    aliases: ['bb', 'business bay'],
    type: 'high_rise',
    avgPricePerSqft: 1300,
    rentalYield: 6.8,
    subAreas: ['Executive Towers', 'Bay Square', 'Canal'],
    amenities: ['canal', 'metro', 'business-centers', 'restaurants']
  }
};

// Sample property database
const SAMPLE_PROPERTIES = [
  { id: 'PROP_001', area: 'The Springs', subArea: 'Springs 3', type: 'villa', beds: 3, baths: 3, sqft: 2800, price: 2100000, status: 'available', features: ['pool', 'garden', 'maid-room'] },
  { id: 'PROP_002', area: 'The Springs', subArea: 'Springs 7', type: 'villa', beds: 4, baths: 4, sqft: 3400, price: 2850000, status: 'available', features: ['lake-view', 'upgraded', 'maid-room'] },
  { id: 'PROP_003', area: 'Arabian Ranches', subArea: 'Saheel', type: 'villa', beds: 5, baths: 5, sqft: 4200, price: 4500000, status: 'available', features: ['pool', 'garden', 'driver-room'] },
  { id: 'PROP_004', area: 'Dubai Marina', subArea: 'Marina Gate', type: 'apartment', beds: 2, baths: 2, sqft: 1400, price: 1850000, status: 'available', features: ['sea-view', 'balcony', 'gym'] },
  { id: 'PROP_005', area: 'Dubai Marina', subArea: 'JBR', type: 'apartment', beds: 3, baths: 3, sqft: 2100, price: 3200000, status: 'available', features: ['beach-access', 'full-sea-view', 'upgraded'] },
  { id: 'PROP_006', area: 'Downtown Dubai', subArea: 'Boulevard', type: 'apartment', beds: 2, baths: 2, sqft: 1600, price: 2800000, status: 'available', features: ['burj-view', 'high-floor', 'smart-home'] },
  { id: 'PROP_007', area: 'Palm Jumeirah', subArea: 'Garden Homes', type: 'villa', beds: 6, baths: 7, sqft: 8500, price: 18000000, status: 'available', features: ['beach', 'pool', 'private-garden', 'atlantis-view'] },
  { id: 'PROP_008', area: 'JVC', subArea: 'District 12', type: 'apartment', beds: 1, baths: 1, sqft: 750, price: 650000, status: 'available', features: ['balcony', 'parking', 'gym'] },
  { id: 'PROP_009', area: 'Dubai Hills Estate', subArea: 'Maple', type: 'villa', beds: 4, baths: 5, sqft: 3800, price: 5200000, status: 'available', features: ['golf-view', 'smart-home', 'pool'] },
  { id: 'PROP_010', area: 'Business Bay', subArea: 'Executive Towers', type: 'apartment', beds: 2, baths: 2, sqft: 1300, price: 1450000, status: 'available', features: ['canal-view', 'metro-access', 'furnished'] }
];

function parseArgs() {
  const result = {
    area: null,
    subArea: null,
    type: null,
    beds: null,
    bedsMin: null,
    bedsMax: null,
    baths: null,
    minPrice: null,
    maxPrice: null,
    minSqft: null,
    maxSqft: null,
    features: [],
    status: 'available',
    limit: 20,
    sortBy: 'price',
    sortOrder: 'asc',
    export: false,
    output: null,
    format: 'json'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--area':
      case '-a':
        result.area = args[++i];
        break;
      case '--sub-area':
        result.subArea = args[++i];
        break;
      case '--type':
      case '-t':
        result.type = args[++i]?.toLowerCase();
        break;
      case '--beds':
      case '-b':
        result.beds = parseInt(args[++i], 10);
        break;
      case '--beds-min':
        result.bedsMin = parseInt(args[++i], 10);
        break;
      case '--beds-max':
        result.bedsMax = parseInt(args[++i], 10);
        break;
      case '--baths':
        result.baths = parseInt(args[++i], 10);
        break;
      case '--min-price':
        result.minPrice = parseInt(args[++i], 10);
        break;
      case '--max-price':
        result.maxPrice = parseInt(args[++i], 10);
        break;
      case '--min-sqft':
        result.minSqft = parseInt(args[++i], 10);
        break;
      case '--max-sqft':
        result.maxSqft = parseInt(args[++i], 10);
        break;
      case '--feature':
      case '-f':
        result.features.push(args[++i]?.toLowerCase());
        break;
      case '--pool':
        result.features.push('pool');
        break;
      case '--garden':
        result.features.push('garden');
        break;
      case '--maid-room':
        result.features.push('maid-room');
        break;
      case '--sea-view':
        result.features.push('sea-view');
        break;
      case '--status':
        result.status = args[++i];
        break;
      case '--limit':
      case '-l':
        result.limit = parseInt(args[++i], 10);
        break;
      case '--sort':
        result.sortBy = args[++i];
        break;
      case '--order':
        result.sortOrder = args[++i];
        break;
      case '--export':
      case '-e':
        result.export = true;
        break;
      case '--output':
      case '-o':
        result.output = args[++i];
        break;
      case '--format':
        result.format = args[++i];
        break;
    }
  }

  return result;
}

function normalizeArea(input) {
  if (!input) return null;
  const normalized = input.toLowerCase().trim();

  for (const [key, data] of Object.entries(DUBAI_AREAS)) {
    if (key === normalized || data.aliases.includes(normalized) || data.name.toLowerCase() === normalized) {
      return data.name;
    }
  }

  return input;
}

function getAreaInfo(areaName) {
  for (const [key, data] of Object.entries(DUBAI_AREAS)) {
    if (data.name === areaName) {
      return { key, ...data };
    }
  }
  return null;
}

function loadProperties() {
  // Try to load from file
  const defaultPaths = [
    path.join(__dirname, '../data/properties.json'),
    path.join(process.cwd(), 'properties.json')
  ];

  for (const p of defaultPaths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  }

  return SAMPLE_PROPERTIES;
}

function searchProperties(properties, filters) {
  return properties.filter(prop => {
    // Area filter
    if (filters.area) {
      const normalizedArea = normalizeArea(filters.area);
      if (prop.area.toLowerCase() !== normalizedArea.toLowerCase()) return false;
    }

    // Sub-area filter
    if (filters.subArea && prop.subArea?.toLowerCase() !== filters.subArea.toLowerCase()) return false;

    // Type filter
    if (filters.type && prop.type !== filters.type) return false;

    // Beds filter
    if (filters.beds !== null && prop.beds !== filters.beds) return false;
    if (filters.bedsMin !== null && prop.beds < filters.bedsMin) return false;
    if (filters.bedsMax !== null && prop.beds > filters.bedsMax) return false;

    // Baths filter
    if (filters.baths !== null && prop.baths < filters.baths) return false;

    // Price filters
    if (filters.minPrice !== null && prop.price < filters.minPrice) return false;
    if (filters.maxPrice !== null && prop.price > filters.maxPrice) return false;

    // Size filters
    if (filters.minSqft !== null && prop.sqft < filters.minSqft) return false;
    if (filters.maxSqft !== null && prop.sqft > filters.maxSqft) return false;

    // Features filter
    if (filters.features.length > 0) {
      const propFeatures = prop.features?.map(f => f.toLowerCase()) || [];
      for (const feature of filters.features) {
        if (!propFeatures.some(f => f.includes(feature))) return false;
      }
    }

    // Status filter
    if (filters.status && prop.status !== filters.status) return false;

    return true;
  });
}

function sortProperties(properties, sortBy, sortOrder) {
  return [...properties].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'price':
        comparison = a.price - b.price;
        break;
      case 'beds':
        comparison = a.beds - b.beds;
        break;
      case 'sqft':
        comparison = a.sqft - b.sqft;
        break;
      case 'price-per-sqft':
        comparison = (a.price / a.sqft) - (b.price / b.sqft);
        break;
      default:
        comparison = a.price - b.price;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });
}

function enrichProperty(prop) {
  const areaInfo = getAreaInfo(prop.area);
  const pricePerSqft = Math.round(prop.price / prop.sqft);
  const estimatedRent = Math.round(prop.price * (areaInfo?.rentalYield || 5) / 100 / 12);
  const marketComparison = areaInfo ? Math.round((pricePerSqft / areaInfo.avgPricePerSqft - 1) * 100) : null;

  return {
    ...prop,
    priceFormatted: `${(prop.price / 1000000).toFixed(2)}M AED`,
    pricePerSqft,
    pricePerSqftFormatted: `${pricePerSqft} AED/sqft`,
    estimatedMonthlyRent: estimatedRent,
    estimatedRentFormatted: `${(estimatedRent / 1000).toFixed(1)}K AED/month`,
    rentalYield: areaInfo?.rentalYield || 5,
    marketComparison: marketComparison !== null ? `${marketComparison > 0 ? '+' : ''}${marketComparison}% vs market avg` : null,
    areaInfo: areaInfo ? {
      type: areaInfo.type,
      avgPricePerSqft: areaInfo.avgPricePerSqft,
      amenities: areaInfo.amenities
    } : null
  };
}

function main() {
  const filters = parseArgs();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Dubai Real Estate - Property Search

Usage:
  node property-search.js [OPTIONS]

Options:
  --area, -a <name>       Area name (e.g., "The Springs", "Marina")
  --sub-area <name>       Sub-area/community
  --type, -t <type>       Property type: villa, apartment, townhouse
  --beds, -b <n>          Exact number of bedrooms
  --beds-min <n>          Minimum bedrooms
  --beds-max <n>          Maximum bedrooms
  --baths <n>             Minimum bathrooms
  --min-price <n>         Minimum price in AED
  --max-price <n>         Maximum price in AED
  --min-sqft <n>          Minimum size in sqft
  --max-sqft <n>          Maximum size in sqft
  --feature, -f <name>    Required feature (can use multiple)
  --pool                  Shortcut for --feature pool
  --garden                Shortcut for --feature garden
  --maid-room             Shortcut for --feature maid-room
  --sea-view              Shortcut for --feature sea-view
  --limit, -l <n>         Max results (default: 20)
  --sort <field>          Sort by: price, beds, sqft, price-per-sqft
  --order <dir>           Sort order: asc, desc
  --export, -e            Export results to file
  --output, -o <file>     Output file path
  --format <type>         Output format: json, csv

Areas:
  The Springs, Arabian Ranches, Dubai Marina, Downtown Dubai,
  Palm Jumeirah, JVC, Dubai Hills Estate, Business Bay

Examples:
  node property-search.js --area "The Springs" --type villa --beds 3 --max-price 2500000
  node property-search.js --area Marina --type apartment --min-price 1000000 --sea-view
`);
    process.exit(0);
  }

  try {
    const properties = loadProperties();
    let results = searchProperties(properties, filters);
    results = sortProperties(results, filters.sortBy, filters.sortOrder);
    results = results.slice(0, filters.limit);

    // Enrich results with market data
    const enrichedResults = results.map(enrichProperty);

    // Area summary if searching specific area
    const areaInfo = filters.area ? getAreaInfo(normalizeArea(filters.area)) : null;

    const output = {
      timestamp: new Date().toISOString(),
      query: {
        area: filters.area ? normalizeArea(filters.area) : 'All Areas',
        type: filters.type || 'all',
        beds: filters.beds || filters.bedsMin || filters.bedsMax ? `${filters.bedsMin || filters.beds || 'any'}-${filters.bedsMax || filters.beds || 'any'}` : 'any',
        priceRange: `${filters.minPrice ? (filters.minPrice / 1000000).toFixed(1) + 'M' : '0'} - ${filters.maxPrice ? (filters.maxPrice / 1000000).toFixed(1) + 'M' : 'unlimited'} AED`,
        features: filters.features.length > 0 ? filters.features : 'any'
      },
      areaInfo: areaInfo ? {
        name: areaInfo.name,
        type: areaInfo.type,
        avgPricePerSqft: `${areaInfo.avgPricePerSqft} AED/sqft`,
        rentalYield: `${areaInfo.rentalYield}%`,
        amenities: areaInfo.amenities
      } : null,
      summary: {
        totalFound: results.length,
        priceRange: results.length > 0 ? {
          min: `${(Math.min(...results.map(r => r.price)) / 1000000).toFixed(2)}M AED`,
          max: `${(Math.max(...results.map(r => r.price)) / 1000000).toFixed(2)}M AED`,
          avg: `${(results.reduce((sum, r) => sum + r.price, 0) / results.length / 1000000).toFixed(2)}M AED`
        } : null,
        avgPricePerSqft: results.length > 0 ? `${Math.round(results.reduce((sum, r) => sum + r.price / r.sqft, 0) / results.length)} AED/sqft` : null
      },
      properties: enrichedResults
    };

    if (filters.export) {
      const outputPath = filters.output || path.join(__dirname, `../output/property-search-${Date.now()}.json`);
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (filters.format === 'csv') {
        const csvLines = ['id,area,sub_area,type,beds,baths,sqft,price,price_per_sqft,features'];
        for (const prop of enrichedResults) {
          csvLines.push([
            prop.id,
            `"${prop.area}"`,
            `"${prop.subArea || ''}"`,
            prop.type,
            prop.beds,
            prop.baths,
            prop.sqft,
            prop.price,
            prop.pricePerSqft,
            `"${(prop.features || []).join(', ')}"`
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
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();
