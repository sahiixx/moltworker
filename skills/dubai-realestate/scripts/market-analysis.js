#!/usr/bin/env node
/**
 * Dubai Real Estate - Market Analysis
 * Analyze market trends and generate reports
 *
 * Usage:
 *   node market-analysis.js --area "The Springs" --months 12
 *   node market-analysis.js --report --areas "The Springs,Arabian Ranches,JVC"
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

// Historical market data (simulated based on real Dubai market trends)
const MARKET_DATA = {
  'The Springs': {
    currentAvgPrice: 2200000,
    currentPricePerSqft: 1150,
    yearOverYearChange: 8.5,
    quarterOverQuarterChange: 2.1,
    avgDaysOnMarket: 45,
    totalTransactions2024: 847,
    totalVolume2024: 1860000000,
    rentalYield: 5.8,
    priceHistory: [
      { month: '2024-01', avgPrice: 2020000, transactions: 65 },
      { month: '2024-02', avgPrice: 2045000, transactions: 72 },
      { month: '2024-03', avgPrice: 2080000, transactions: 78 },
      { month: '2024-04', avgPrice: 2100000, transactions: 69 },
      { month: '2024-05', avgPrice: 2120000, transactions: 71 },
      { month: '2024-06', avgPrice: 2150000, transactions: 68 },
      { month: '2024-07', avgPrice: 2165000, transactions: 74 },
      { month: '2024-08', avgPrice: 2175000, transactions: 70 },
      { month: '2024-09', avgPrice: 2190000, transactions: 76 },
      { month: '2024-10', avgPrice: 2200000, transactions: 73 },
      { month: '2024-11', avgPrice: 2195000, transactions: 77 },
      { month: '2024-12', avgPrice: 2200000, transactions: 74 }
    ],
    propertyTypes: { villa: 95, townhouse: 5 },
    bedroomDistribution: { '2': 10, '3': 55, '4': 30, '5+': 5 },
    buyerProfile: { 'end-user': 65, 'investor': 35 }
  },
  'Arabian Ranches': {
    currentAvgPrice: 4500000,
    currentPricePerSqft: 1350,
    yearOverYearChange: 12.3,
    quarterOverQuarterChange: 3.5,
    avgDaysOnMarket: 38,
    totalTransactions2024: 512,
    totalVolume2024: 2300000000,
    rentalYield: 5.2,
    priceHistory: [
      { month: '2024-01', avgPrice: 4000000, transactions: 38 },
      { month: '2024-02', avgPrice: 4080000, transactions: 42 },
      { month: '2024-03', avgPrice: 4150000, transactions: 45 },
      { month: '2024-04', avgPrice: 4220000, transactions: 41 },
      { month: '2024-05', avgPrice: 4280000, transactions: 44 },
      { month: '2024-06', avgPrice: 4320000, transactions: 43 },
      { month: '2024-07', avgPrice: 4360000, transactions: 46 },
      { month: '2024-08', avgPrice: 4400000, transactions: 42 },
      { month: '2024-09', avgPrice: 4440000, transactions: 45 },
      { month: '2024-10', avgPrice: 4470000, transactions: 43 },
      { month: '2024-11', avgPrice: 4490000, transactions: 44 },
      { month: '2024-12', avgPrice: 4500000, transactions: 39 }
    ],
    propertyTypes: { villa: 100 },
    bedroomDistribution: { '3': 15, '4': 35, '5': 35, '6+': 15 },
    buyerProfile: { 'end-user': 75, 'investor': 25 }
  },
  'Dubai Marina': {
    currentAvgPrice: 1800000,
    currentPricePerSqft: 1450,
    yearOverYearChange: 6.8,
    quarterOverQuarterChange: 1.8,
    avgDaysOnMarket: 32,
    totalTransactions2024: 2145,
    totalVolume2024: 3860000000,
    rentalYield: 6.5,
    priceHistory: [
      { month: '2024-01', avgPrice: 1680000, transactions: 165 },
      { month: '2024-02', avgPrice: 1700000, transactions: 172 },
      { month: '2024-03', avgPrice: 1720000, transactions: 185 },
      { month: '2024-04', avgPrice: 1735000, transactions: 178 },
      { month: '2024-05', avgPrice: 1750000, transactions: 182 },
      { month: '2024-06', avgPrice: 1765000, transactions: 175 },
      { month: '2024-07', avgPrice: 1775000, transactions: 188 },
      { month: '2024-08', avgPrice: 1785000, transactions: 180 },
      { month: '2024-09', avgPrice: 1795000, transactions: 186 },
      { month: '2024-10', avgPrice: 1800000, transactions: 183 },
      { month: '2024-11', avgPrice: 1798000, transactions: 179 },
      { month: '2024-12', avgPrice: 1800000, transactions: 172 }
    ],
    propertyTypes: { apartment: 98, penthouse: 2 },
    bedroomDistribution: { 'studio': 15, '1': 35, '2': 35, '3': 12, '4+': 3 },
    buyerProfile: { 'end-user': 45, 'investor': 55 }
  },
  'JVC': {
    currentAvgPrice: 850000,
    currentPricePerSqft: 850,
    yearOverYearChange: 15.2,
    quarterOverQuarterChange: 4.2,
    avgDaysOnMarket: 28,
    totalTransactions2024: 4523,
    totalVolume2024: 3850000000,
    rentalYield: 7.2,
    priceHistory: [
      { month: '2024-01', avgPrice: 735000, transactions: 345 },
      { month: '2024-02', avgPrice: 755000, transactions: 362 },
      { month: '2024-03', avgPrice: 775000, transactions: 388 },
      { month: '2024-04', avgPrice: 790000, transactions: 375 },
      { month: '2024-05', avgPrice: 805000, transactions: 382 },
      { month: '2024-06', avgPrice: 815000, transactions: 378 },
      { month: '2024-07', avgPrice: 825000, transactions: 392 },
      { month: '2024-08', avgPrice: 835000, transactions: 385 },
      { month: '2024-09', avgPrice: 842000, transactions: 390 },
      { month: '2024-10', avgPrice: 848000, transactions: 387 },
      { month: '2024-11', avgPrice: 850000, transactions: 382 },
      { month: '2024-12', avgPrice: 850000, transactions: 357 }
    ],
    propertyTypes: { apartment: 85, townhouse: 15 },
    bedroomDistribution: { 'studio': 25, '1': 40, '2': 25, '3': 10 },
    buyerProfile: { 'end-user': 40, 'investor': 60 }
  },
  'Downtown Dubai': {
    currentAvgPrice: 3200000,
    currentPricePerSqft: 2100,
    yearOverYearChange: 5.5,
    quarterOverQuarterChange: 1.2,
    avgDaysOnMarket: 42,
    totalTransactions2024: 1256,
    totalVolume2024: 4020000000,
    rentalYield: 5.5,
    priceHistory: [
      { month: '2024-01', avgPrice: 3030000, transactions: 98 },
      { month: '2024-02', avgPrice: 3055000, transactions: 102 },
      { month: '2024-03', avgPrice: 3080000, transactions: 108 },
      { month: '2024-04', avgPrice: 3100000, transactions: 105 },
      { month: '2024-05', avgPrice: 3120000, transactions: 107 },
      { month: '2024-06', avgPrice: 3140000, transactions: 103 },
      { month: '2024-07', avgPrice: 3155000, transactions: 110 },
      { month: '2024-08', avgPrice: 3170000, transactions: 106 },
      { month: '2024-09', avgPrice: 3185000, transactions: 108 },
      { month: '2024-10', avgPrice: 3195000, transactions: 105 },
      { month: '2024-11', avgPrice: 3200000, transactions: 104 },
      { month: '2024-12', avgPrice: 3200000, transactions: 100 }
    ],
    propertyTypes: { apartment: 95, penthouse: 5 },
    bedroomDistribution: { 'studio': 10, '1': 30, '2': 40, '3': 15, '4+': 5 },
    buyerProfile: { 'end-user': 55, 'investor': 45 }
  },
  'Palm Jumeirah': {
    currentAvgPrice: 8500000,
    currentPricePerSqft: 2500,
    yearOverYearChange: 4.2,
    quarterOverQuarterChange: 0.8,
    avgDaysOnMarket: 65,
    totalTransactions2024: 425,
    totalVolume2024: 3610000000,
    rentalYield: 4.8,
    priceHistory: [
      { month: '2024-01', avgPrice: 8150000, transactions: 32 },
      { month: '2024-02', avgPrice: 8200000, transactions: 35 },
      { month: '2024-03', avgPrice: 8250000, transactions: 38 },
      { month: '2024-04', avgPrice: 8300000, transactions: 36 },
      { month: '2024-05', avgPrice: 8350000, transactions: 37 },
      { month: '2024-06', avgPrice: 8380000, transactions: 35 },
      { month: '2024-07', avgPrice: 8420000, transactions: 38 },
      { month: '2024-08', avgPrice: 8450000, transactions: 36 },
      { month: '2024-09', avgPrice: 8475000, transactions: 37 },
      { month: '2024-10', avgPrice: 8490000, transactions: 35 },
      { month: '2024-11', avgPrice: 8500000, transactions: 34 },
      { month: '2024-12', avgPrice: 8500000, transactions: 32 }
    ],
    propertyTypes: { apartment: 60, villa: 35, penthouse: 5 },
    bedroomDistribution: { '1': 10, '2': 25, '3': 30, '4': 20, '5+': 15 },
    buyerProfile: { 'end-user': 60, 'investor': 40 }
  },
  'Dubai Hills Estate': {
    currentAvgPrice: 3800000,
    currentPricePerSqft: 1600,
    yearOverYearChange: 18.5,
    quarterOverQuarterChange: 5.2,
    avgDaysOnMarket: 35,
    totalTransactions2024: 1824,
    totalVolume2024: 6930000000,
    rentalYield: 5.0,
    priceHistory: [
      { month: '2024-01', avgPrice: 3200000, transactions: 142 },
      { month: '2024-02', avgPrice: 3280000, transactions: 148 },
      { month: '2024-03', avgPrice: 3360000, transactions: 158 },
      { month: '2024-04', avgPrice: 3430000, transactions: 152 },
      { month: '2024-05', avgPrice: 3500000, transactions: 155 },
      { month: '2024-06', avgPrice: 3560000, transactions: 150 },
      { month: '2024-07', avgPrice: 3620000, transactions: 160 },
      { month: '2024-08', avgPrice: 3680000, transactions: 155 },
      { month: '2024-09', avgPrice: 3730000, transactions: 158 },
      { month: '2024-10', avgPrice: 3770000, transactions: 156 },
      { month: '2024-11', avgPrice: 3790000, transactions: 152 },
      { month: '2024-12', avgPrice: 3800000, transactions: 138 }
    ],
    propertyTypes: { villa: 55, apartment: 40, townhouse: 5 },
    bedroomDistribution: { '1': 5, '2': 15, '3': 25, '4': 30, '5': 20, '6+': 5 },
    buyerProfile: { 'end-user': 70, 'investor': 30 }
  }
};

function parseArgs() {
  const result = {
    area: null,
    areas: [],
    months: 12,
    report: false,
    trend: false,
    compare: false,
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
      case '--areas':
        result.areas = args[++i]?.split(',').map(a => a.trim());
        break;
      case '--months':
      case '-m':
        result.months = parseInt(args[++i], 10);
        break;
      case '--report':
      case '-r':
        result.report = true;
        break;
      case '--trend':
      case '-t':
        result.trend = true;
        break;
      case '--compare':
      case '-c':
        result.compare = true;
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

function getAreaData(areaName) {
  // Normalize area name
  for (const [key, data] of Object.entries(MARKET_DATA)) {
    if (key.toLowerCase() === areaName.toLowerCase() ||
        key.toLowerCase().includes(areaName.toLowerCase()) ||
        areaName.toLowerCase().includes(key.toLowerCase())) {
      return { name: key, ...data };
    }
  }
  return null;
}

function calculateTrend(priceHistory, months = 6) {
  const recentData = priceHistory.slice(-months);
  if (recentData.length < 2) return null;

  const firstPrice = recentData[0].avgPrice;
  const lastPrice = recentData[recentData.length - 1].avgPrice;
  const change = ((lastPrice - firstPrice) / firstPrice) * 100;

  // Calculate momentum (rate of change)
  const midPoint = Math.floor(recentData.length / 2);
  const firstHalfAvg = recentData.slice(0, midPoint).reduce((s, d) => s + d.avgPrice, 0) / midPoint;
  const secondHalfAvg = recentData.slice(midPoint).reduce((s, d) => s + d.avgPrice, 0) / (recentData.length - midPoint);
  const momentum = secondHalfAvg > firstHalfAvg ? 'accelerating' : 'decelerating';

  return {
    periodMonths: months,
    startPrice: firstPrice,
    endPrice: lastPrice,
    absoluteChange: lastPrice - firstPrice,
    percentChange: Math.round(change * 100) / 100,
    momentum,
    trend: change > 2 ? 'upward' : change < -2 ? 'downward' : 'stable'
  };
}

function generateAreaAnalysis(areaData, months) {
  const trend = calculateTrend(areaData.priceHistory, months);
  const recentHistory = areaData.priceHistory.slice(-months);

  const avgTransactions = Math.round(recentHistory.reduce((s, d) => s + d.transactions, 0) / recentHistory.length);
  const totalTransactions = recentHistory.reduce((s, d) => s + d.transactions, 0);

  return {
    area: areaData.name,
    asOfDate: new Date().toISOString().split('T')[0],
    currentMarket: {
      avgPrice: areaData.currentAvgPrice,
      avgPriceFormatted: `${(areaData.currentAvgPrice / 1000000).toFixed(2)}M AED`,
      pricePerSqft: areaData.currentPricePerSqft,
      pricePerSqftFormatted: `${areaData.currentPricePerSqft} AED/sqft`,
      rentalYield: `${areaData.rentalYield}%`,
      avgDaysOnMarket: areaData.avgDaysOnMarket
    },
    performance: {
      yearOverYear: `${areaData.yearOverYearChange > 0 ? '+' : ''}${areaData.yearOverYearChange}%`,
      quarterOverQuarter: `${areaData.quarterOverQuarterChange > 0 ? '+' : ''}${areaData.quarterOverQuarterChange}%`,
      trend
    },
    activity: {
      totalTransactions2024: areaData.totalTransactions2024,
      totalVolume2024: `${(areaData.totalVolume2024 / 1000000000).toFixed(2)}B AED`,
      avgMonthlyTransactions: avgTransactions,
      recentPeriodTransactions: totalTransactions
    },
    demographics: {
      propertyTypes: areaData.propertyTypes,
      bedroomDistribution: areaData.bedroomDistribution,
      buyerProfile: areaData.buyerProfile
    },
    priceHistory: recentHistory,
    insights: generateInsights(areaData, trend)
  };
}

function generateInsights(areaData, trend) {
  const insights = [];

  // Price trend insight
  if (trend.percentChange > 10) {
    insights.push({
      type: 'bullish',
      message: `Strong price appreciation of ${trend.percentChange}% over the past ${trend.periodMonths} months indicates high demand.`
    });
  } else if (trend.percentChange > 5) {
    insights.push({
      type: 'positive',
      message: `Steady growth of ${trend.percentChange}% shows healthy market fundamentals.`
    });
  } else if (trend.percentChange < 0) {
    insights.push({
      type: 'opportunity',
      message: `Price correction of ${Math.abs(trend.percentChange)}% may present buying opportunities.`
    });
  }

  // Rental yield insight
  if (areaData.rentalYield >= 7) {
    insights.push({
      type: 'investment',
      message: `High rental yield of ${areaData.rentalYield}% makes this area attractive for investors.`
    });
  } else if (areaData.rentalYield >= 5.5) {
    insights.push({
      type: 'balanced',
      message: `Balanced rental yield of ${areaData.rentalYield}% with capital appreciation potential.`
    });
  }

  // Days on market insight
  if (areaData.avgDaysOnMarket < 35) {
    insights.push({
      type: 'hot_market',
      message: `Fast-moving market with properties selling in ${areaData.avgDaysOnMarket} days on average.`
    });
  } else if (areaData.avgDaysOnMarket > 60) {
    insights.push({
      type: 'negotiation',
      message: `Extended time on market (${areaData.avgDaysOnMarket} days) suggests room for negotiation.`
    });
  }

  // Buyer profile insight
  if (areaData.buyerProfile.investor > 50) {
    insights.push({
      type: 'investor_driven',
      message: `Investor-heavy market (${areaData.buyerProfile.investor}%) may see higher volatility.`
    });
  } else if (areaData.buyerProfile['end-user'] > 65) {
    insights.push({
      type: 'end_user',
      message: `End-user dominated (${areaData.buyerProfile['end-user']}%) indicates stable long-term demand.`
    });
  }

  return insights;
}

function generateComparison(areas) {
  const comparison = {
    areas: [],
    rankings: {},
    recommendation: null
  };

  for (const areaName of areas) {
    const data = getAreaData(areaName);
    if (data) {
      comparison.areas.push({
        name: data.name,
        avgPrice: data.currentAvgPrice,
        pricePerSqft: data.currentPricePerSqft,
        yoyChange: data.yearOverYearChange,
        rentalYield: data.rentalYield,
        daysOnMarket: data.avgDaysOnMarket,
        transactions: data.totalTransactions2024
      });
    }
  }

  // Generate rankings
  comparison.rankings = {
    byValue: [...comparison.areas].sort((a, b) => a.pricePerSqft - b.pricePerSqft).map(a => a.name),
    byGrowth: [...comparison.areas].sort((a, b) => b.yoyChange - a.yoyChange).map(a => a.name),
    byYield: [...comparison.areas].sort((a, b) => b.rentalYield - a.rentalYield).map(a => a.name),
    byLiquidity: [...comparison.areas].sort((a, b) => a.daysOnMarket - b.daysOnMarket).map(a => a.name)
  };

  // Generate recommendation
  const scores = comparison.areas.map(area => {
    const valueScore = 100 - (area.pricePerSqft / 30);
    const growthScore = area.yoyChange * 5;
    const yieldScore = area.rentalYield * 10;
    const liquidityScore = Math.max(0, 100 - area.daysOnMarket);
    return {
      name: area.name,
      totalScore: valueScore + growthScore + yieldScore + liquidityScore
    };
  });

  scores.sort((a, b) => b.totalScore - a.totalScore);
  comparison.recommendation = {
    bestOverall: scores[0]?.name,
    reason: `Best balance of value, growth potential, rental yield, and market liquidity.`
  };

  return comparison;
}

function generateFullReport() {
  const allAreas = Object.keys(MARKET_DATA);
  const report = {
    title: 'Dubai Real Estate Market Report',
    generatedAt: new Date().toISOString(),
    period: '2024',
    marketOverview: {
      totalVolume: `${(Object.values(MARKET_DATA).reduce((s, d) => s + d.totalVolume2024, 0) / 1000000000).toFixed(1)}B AED`,
      totalTransactions: Object.values(MARKET_DATA).reduce((s, d) => s + d.totalTransactions2024, 0),
      avgYoYGrowth: `${(Object.values(MARKET_DATA).reduce((s, d) => s + d.yearOverYearChange, 0) / allAreas.length).toFixed(1)}%`,
      avgRentalYield: `${(Object.values(MARKET_DATA).reduce((s, d) => s + d.rentalYield, 0) / allAreas.length).toFixed(1)}%`
    },
    areaAnalyses: allAreas.map(area => generateAreaAnalysis(MARKET_DATA[area], 12)),
    comparison: generateComparison(allAreas),
    topPerformers: {
      highestGrowth: [...allAreas].sort((a, b) => MARKET_DATA[b].yearOverYearChange - MARKET_DATA[a].yearOverYearChange).slice(0, 3),
      highestYield: [...allAreas].sort((a, b) => MARKET_DATA[b].rentalYield - MARKET_DATA[a].rentalYield).slice(0, 3),
      mostLiquid: [...allAreas].sort((a, b) => MARKET_DATA[a].avgDaysOnMarket - MARKET_DATA[b].avgDaysOnMarket).slice(0, 3),
      highestVolume: [...allAreas].sort((a, b) => MARKET_DATA[b].totalVolume2024 - MARKET_DATA[a].totalVolume2024).slice(0, 3)
    }
  };

  return report;
}

function main() {
  const options = parseArgs();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Dubai Real Estate - Market Analysis

Usage:
  node market-analysis.js [OPTIONS]

Options:
  --area, -a <name>       Analyze specific area
  --areas <list>          Compare multiple areas (comma-separated)
  --months, -m <n>        Analysis period in months (default: 12)
  --report, -r            Generate full market report
  --trend, -t             Focus on trend analysis
  --compare, -c           Compare areas
  --export, -e            Export results
  --output, -o <file>     Output file path
  --format <type>         Output format: json, csv

Available Areas:
  The Springs, Arabian Ranches, Dubai Marina, Downtown Dubai,
  Palm Jumeirah, JVC, Dubai Hills Estate

Examples:
  node market-analysis.js --area "The Springs" --months 6
  node market-analysis.js --areas "Springs,Marina,JVC" --compare
  node market-analysis.js --report --export
`);
    process.exit(0);
  }

  try {
    let output;

    if (options.report) {
      output = generateFullReport();
    } else if (options.compare && options.areas.length > 0) {
      output = {
        timestamp: new Date().toISOString(),
        type: 'comparison',
        ...generateComparison(options.areas)
      };
    } else if (options.area) {
      const areaData = getAreaData(options.area);
      if (!areaData) {
        console.error(JSON.stringify({ error: `Area not found: ${options.area}`, availableAreas: Object.keys(MARKET_DATA) }));
        process.exit(1);
      }
      output = {
        timestamp: new Date().toISOString(),
        type: 'area_analysis',
        ...generateAreaAnalysis(areaData, options.months)
      };
    } else if (options.areas.length > 0) {
      output = {
        timestamp: new Date().toISOString(),
        type: 'multi_area_analysis',
        areas: options.areas.map(areaName => {
          const areaData = getAreaData(areaName);
          if (areaData) {
            return generateAreaAnalysis(areaData, options.months);
          }
          return { area: areaName, error: 'Not found' };
        })
      };
    } else {
      // Default: show market overview
      output = {
        timestamp: new Date().toISOString(),
        type: 'overview',
        availableAreas: Object.keys(MARKET_DATA),
        quickStats: Object.entries(MARKET_DATA).map(([name, data]) => ({
          area: name,
          avgPrice: `${(data.currentAvgPrice / 1000000).toFixed(2)}M AED`,
          yoyChange: `${data.yearOverYearChange > 0 ? '+' : ''}${data.yearOverYearChange}%`,
          rentalYield: `${data.rentalYield}%`
        }))
      };
    }

    if (options.export) {
      const outputPath = options.output || path.join(__dirname, `../output/market-analysis-${Date.now()}.json`);
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
