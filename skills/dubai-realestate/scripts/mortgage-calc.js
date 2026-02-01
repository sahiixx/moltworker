#!/usr/bin/env node
/**
 * Dubai Real Estate - Mortgage Calculator
 * Calculate mortgage payments, ROI, and investment analysis
 *
 * Usage:
 *   node mortgage-calc.js --price 2000000 --down-payment 25 --years 25 --rate 4.5
 *   node mortgage-calc.js --price 2000000 --rental-yield 6 --appreciation 5 --roi
 */

const args = process.argv.slice(2);

// UAE mortgage parameters
const UAE_MORTGAGE_DEFAULTS = {
  expat: {
    maxLTV: 75,      // 75% max for properties up to 5M
    maxLTVHigh: 65,  // 65% max for properties over 5M
    maxTenure: 25,
    minDownPayment: 25,
    rates: { min: 3.99, max: 5.99, typical: 4.49 }
  },
  uaeNational: {
    maxLTV: 85,
    maxLTVHigh: 70,
    maxTenure: 25,
    minDownPayment: 15,
    rates: { min: 3.49, max: 5.49, typical: 3.99 }
  },
  offPlan: {
    maxLTV: 50,
    maxTenure: 25,
    minDownPayment: 50,
    rates: { min: 4.49, max: 6.49, typical: 5.29 }
  }
};

// Additional costs in Dubai
const TRANSACTION_COSTS = {
  dld_fee: 4,           // Dubai Land Department - 4% of purchase price
  agency_fee: 2,        // Agent commission - 2% of purchase price
  registration_fee: 0.25, // Registration trustee fee - 0.25%
  mortgage_registration: 0.25, // Mortgage registration - 0.25% of loan
  valuation_fee: 3000,  // Property valuation - fixed
  admin_fees: 5000      // Bank admin fees - approx
};

// Monthly costs
const MONTHLY_COSTS = {
  service_charge_per_sqft: { min: 10, max: 30, avg: 18 },
  insurance_rate: 0.001,  // 0.1% of property value annually
  maintenance_reserve: 0.005 // 0.5% of property value annually
};

function parseArgs() {
  const result = {
    price: null,
    downPayment: 25,
    years: 25,
    rate: 4.49,
    buyerType: 'expat',
    sqft: null,
    rentalYield: null,
    appreciation: null,
    roi: false,
    compare: false,
    export: false,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--price':
      case '-p':
        result.price = parseInt(args[++i], 10);
        break;
      case '--down-payment':
      case '--dp':
        result.downPayment = parseFloat(args[++i]);
        break;
      case '--years':
      case '-y':
        result.years = parseInt(args[++i], 10);
        break;
      case '--rate':
      case '-r':
        result.rate = parseFloat(args[++i]);
        break;
      case '--buyer-type':
        result.buyerType = args[++i];
        break;
      case '--sqft':
        result.sqft = parseInt(args[++i], 10);
        break;
      case '--rental-yield':
        result.rentalYield = parseFloat(args[++i]);
        break;
      case '--appreciation':
        result.appreciation = parseFloat(args[++i]);
        break;
      case '--roi':
        result.roi = true;
        break;
      case '--compare':
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
    }
  }

  return result;
}

function calculateMonthlyPayment(principal, annualRate, years) {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = years * 12;

  if (monthlyRate === 0) {
    return principal / numPayments;
  }

  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                  (Math.pow(1 + monthlyRate, numPayments) - 1);

  return Math.round(payment * 100) / 100;
}

function calculateAmortization(principal, annualRate, years) {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = years * 12;
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, years);

  let balance = principal;
  let totalInterest = 0;
  let totalPrincipal = 0;

  const schedule = [];
  const yearlyBreakdown = [];

  let yearInterest = 0;
  let yearPrincipal = 0;

  for (let month = 1; month <= numPayments; month++) {
    const interestPayment = balance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;

    balance -= principalPayment;
    totalInterest += interestPayment;
    totalPrincipal += principalPayment;
    yearInterest += interestPayment;
    yearPrincipal += principalPayment;

    if (month % 12 === 0) {
      yearlyBreakdown.push({
        year: month / 12,
        principalPaid: Math.round(yearPrincipal),
        interestPaid: Math.round(yearInterest),
        remainingBalance: Math.max(0, Math.round(balance)),
        equityPercent: Math.round((1 - balance / principal) * 100)
      });
      yearInterest = 0;
      yearPrincipal = 0;
    }
  }

  return {
    monthlyPayment,
    totalPayments: monthlyPayment * numPayments,
    totalInterest: Math.round(totalInterest),
    totalPrincipal: Math.round(totalPrincipal),
    yearlyBreakdown
  };
}

function calculateTransactionCosts(price, loanAmount) {
  const dldFee = price * TRANSACTION_COSTS.dld_fee / 100;
  const agencyFee = price * TRANSACTION_COSTS.agency_fee / 100;
  const registrationFee = price * TRANSACTION_COSTS.registration_fee / 100;
  const mortgageReg = loanAmount * TRANSACTION_COSTS.mortgage_registration / 100;
  const valuation = TRANSACTION_COSTS.valuation_fee;
  const admin = TRANSACTION_COSTS.admin_fees;

  const total = dldFee + agencyFee + registrationFee + mortgageReg + valuation + admin;

  return {
    dldFee: Math.round(dldFee),
    agencyFee: Math.round(agencyFee),
    registrationFee: Math.round(registrationFee),
    mortgageRegistration: Math.round(mortgageReg),
    valuationFee: valuation,
    adminFees: admin,
    total: Math.round(total),
    totalFormatted: `${(total / 1000).toFixed(1)}K AED`,
    percentOfPrice: Math.round(total / price * 100 * 10) / 10
  };
}

function calculateMonthlyCosts(price, sqft) {
  const serviceCharge = sqft ? sqft * MONTHLY_COSTS.service_charge_per_sqft.avg / 12 : price * 0.015 / 12;
  const insurance = price * MONTHLY_COSTS.insurance_rate / 12;
  const maintenance = price * MONTHLY_COSTS.maintenance_reserve / 12;

  return {
    serviceCharge: Math.round(serviceCharge),
    insurance: Math.round(insurance),
    maintenanceReserve: Math.round(maintenance),
    total: Math.round(serviceCharge + insurance + maintenance),
    totalFormatted: `${((serviceCharge + insurance + maintenance) / 1000).toFixed(1)}K AED`
  };
}

function calculateROI(options) {
  const {
    price,
    downPayment,
    years,
    rate,
    rentalYield = 6,
    appreciation = 5,
    sqft
  } = options;

  const downPaymentAmount = price * downPayment / 100;
  const loanAmount = price - downPaymentAmount;
  const transactionCosts = calculateTransactionCosts(price, loanAmount);
  const totalInitialInvestment = downPaymentAmount + transactionCosts.total;

  const monthlyPayment = calculateMonthlyPayment(loanAmount, rate, years);
  const monthlyCosts = calculateMonthlyCosts(price, sqft);
  const monthlyRental = price * rentalYield / 100 / 12;

  const monthlyCashflow = monthlyRental - monthlyPayment - monthlyCosts.total;
  const annualCashflow = monthlyCashflow * 12;

  // 5-year projection
  const projections = [];
  let cumulativeAppreciation = 0;
  let cumulativeCashflow = 0;
  let cumulativeEquity = downPaymentAmount;
  const amortization = calculateAmortization(loanAmount, rate, years);

  for (let year = 1; year <= 5; year++) {
    const propertyValue = price * Math.pow(1 + appreciation / 100, year);
    const yearAppreciation = propertyValue - price;
    cumulativeAppreciation = yearAppreciation;

    const yearData = amortization.yearlyBreakdown[year - 1];
    cumulativeEquity = downPaymentAmount + (yearData ? loanAmount - yearData.remainingBalance : 0);
    cumulativeCashflow += annualCashflow;

    projections.push({
      year,
      propertyValue: Math.round(propertyValue),
      appreciation: Math.round(yearAppreciation),
      equity: Math.round(cumulativeEquity),
      cumulativeCashflow: Math.round(cumulativeCashflow),
      totalReturn: Math.round(yearAppreciation + cumulativeCashflow),
      roi: Math.round((yearAppreciation + cumulativeCashflow) / totalInitialInvestment * 100)
    });
  }

  return {
    investment: {
      purchasePrice: price,
      downPayment: downPaymentAmount,
      transactionCosts: transactionCosts.total,
      totalInitialInvestment,
      loanAmount,
      interestRate: rate,
      tenure: years
    },
    monthlyAnalysis: {
      mortgagePayment: monthlyPayment,
      otherCosts: monthlyCosts.total,
      totalCost: monthlyPayment + monthlyCosts.total,
      rentalIncome: Math.round(monthlyRental),
      netCashflow: Math.round(monthlyCashflow),
      cashflowStatus: monthlyCashflow >= 0 ? 'positive' : 'negative'
    },
    returns: {
      grossRentalYield: `${rentalYield}%`,
      netRentalYield: `${Math.round((monthlyRental - monthlyCosts.total) * 12 / price * 100 * 10) / 10}%`,
      cashOnCashReturn: `${Math.round(annualCashflow / totalInitialInvestment * 100 * 10) / 10}%`,
      expectedAppreciation: `${appreciation}%`
    },
    projections
  };
}

function compareScenarios(basePrice) {
  const scenarios = [
    { name: 'Conservative', downPayment: 30, rate: 5.49, appreciation: 3, rentalYield: 5 },
    { name: 'Moderate', downPayment: 25, rate: 4.49, appreciation: 5, rentalYield: 6 },
    { name: 'Aggressive', downPayment: 20, rate: 4.99, appreciation: 8, rentalYield: 7 }
  ];

  return scenarios.map(scenario => {
    const roi = calculateROI({
      price: basePrice,
      downPayment: scenario.downPayment,
      years: 25,
      rate: scenario.rate,
      rentalYield: scenario.rentalYield,
      appreciation: scenario.appreciation
    });

    return {
      scenario: scenario.name,
      assumptions: scenario,
      initialInvestment: roi.investment.totalInitialInvestment,
      monthlyPayment: roi.monthlyAnalysis.mortgagePayment,
      monthlyCashflow: roi.monthlyAnalysis.netCashflow,
      year5ROI: roi.projections[4]?.roi,
      year5TotalReturn: roi.projections[4]?.totalReturn
    };
  });
}

function main() {
  const options = parseArgs();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Dubai Real Estate - Mortgage Calculator

Usage:
  node mortgage-calc.js [OPTIONS]

Options:
  --price, -p <n>         Property price in AED
  --down-payment <n>      Down payment percentage (default: 25)
  --years, -y <n>         Loan tenure in years (default: 25)
  --rate, -r <n>          Interest rate percentage (default: 4.49)
  --buyer-type <type>     Buyer type: expat, uaeNational, offPlan
  --sqft <n>              Property size for accurate service charges
  --rental-yield <n>      Expected rental yield % (for ROI)
  --appreciation <n>      Expected annual appreciation % (for ROI)
  --roi                   Calculate ROI analysis
  --compare               Compare investment scenarios
  --export, -e            Export results
  --output, -o <file>     Output file path

Examples:
  node mortgage-calc.js --price 2000000 --down-payment 25 --years 25 --rate 4.5
  node mortgage-calc.js --price 2000000 --rental-yield 6 --appreciation 5 --roi
  node mortgage-calc.js --price 2000000 --compare
`);
    process.exit(0);
  }

  if (!options.price) {
    console.error(JSON.stringify({ error: 'Property price required. Use --price <amount>' }));
    process.exit(1);
  }

  try {
    let output;

    if (options.compare) {
      output = {
        timestamp: new Date().toISOString(),
        type: 'comparison',
        propertyPrice: options.price,
        priceFormatted: `${(options.price / 1000000).toFixed(2)}M AED`,
        scenarios: compareScenarios(options.price)
      };
    } else if (options.roi || options.rentalYield) {
      output = {
        timestamp: new Date().toISOString(),
        type: 'roi_analysis',
        ...calculateROI(options)
      };
    } else {
      // Basic mortgage calculation
      const downPaymentAmount = options.price * options.downPayment / 100;
      const loanAmount = options.price - downPaymentAmount;
      const buyerRules = UAE_MORTGAGE_DEFAULTS[options.buyerType] || UAE_MORTGAGE_DEFAULTS.expat;

      // Validate LTV
      const ltv = 100 - options.downPayment;
      const maxLTV = options.price > 5000000 ? buyerRules.maxLTVHigh : buyerRules.maxLTV;

      const amortization = calculateAmortization(loanAmount, options.rate, options.years);
      const transactionCosts = calculateTransactionCosts(options.price, loanAmount);
      const monthlyCosts = calculateMonthlyCosts(options.price, options.sqft);

      output = {
        timestamp: new Date().toISOString(),
        type: 'mortgage_calculation',
        property: {
          price: options.price,
          priceFormatted: `${(options.price / 1000000).toFixed(2)}M AED`,
          sqft: options.sqft
        },
        financing: {
          downPayment: {
            percentage: options.downPayment,
            amount: downPaymentAmount,
            amountFormatted: `${(downPaymentAmount / 1000).toFixed(0)}K AED`
          },
          loan: {
            amount: loanAmount,
            amountFormatted: `${(loanAmount / 1000000).toFixed(2)}M AED`,
            tenure: options.years,
            rate: options.rate,
            ltv,
            ltvValid: ltv <= maxLTV,
            maxAllowedLTV: maxLTV
          },
          buyerType: options.buyerType,
          marketRates: buyerRules.rates
        },
        payments: {
          monthlyMortgage: amortization.monthlyPayment,
          monthlyMortgageFormatted: `${(amortization.monthlyPayment / 1000).toFixed(1)}K AED`,
          monthlyOtherCosts: monthlyCosts.total,
          totalMonthly: amortization.monthlyPayment + monthlyCosts.total,
          totalMonthlyFormatted: `${((amortization.monthlyPayment + monthlyCosts.total) / 1000).toFixed(1)}K AED`
        },
        totalCost: {
          principal: amortization.totalPrincipal,
          interest: amortization.totalInterest,
          totalMortgage: Math.round(amortization.totalPayments),
          transactionCosts: transactionCosts.total,
          grandTotal: Math.round(amortization.totalPayments + transactionCosts.total),
          grandTotalFormatted: `${((amortization.totalPayments + transactionCosts.total) / 1000000).toFixed(2)}M AED`,
          effectiveRate: Math.round(amortization.totalInterest / loanAmount * 100 * 10) / 10
        },
        transactionCosts,
        monthlyCosts,
        amortizationSummary: {
          first5Years: amortization.yearlyBreakdown.slice(0, 5),
          equityAt5Years: amortization.yearlyBreakdown[4]?.equityPercent,
          equityAt10Years: amortization.yearlyBreakdown[9]?.equityPercent
        }
      };
    }

    if (options.export) {
      const fs = require('fs');
      const path = require('path');
      const outputPath = options.output || path.join(__dirname, `../output/mortgage-calc-${Date.now()}.json`);
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
