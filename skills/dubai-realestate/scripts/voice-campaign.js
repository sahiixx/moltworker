#!/usr/bin/env node
/**
 * Dubai Real Estate - Voice Campaign Generator
 * Generate Retell.ai campaign configurations for outbound calls
 *
 * Usage:
 *   node voice-campaign.js --segment CANNOT_LOSE --limit 50 --name "Q1 Reactivation"
 *   node voice-campaign.js --leads scored-leads.json --template reactivation
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

// Call script templates
const SCRIPT_TEMPLATES = {
  reactivation: {
    name: 'Re-engagement Campaign',
    language: 'en',
    greeting: "Hello {name}, this is {agent_name} from {company}. I hope I'm not catching you at a bad time.",
    purpose: "I wanted to reach out because we noticed it's been a while since we last connected, and there have been some exciting developments in {preferred_area} that I thought might interest you.",
    value_proposition: "We've seen some excellent properties come on the market recently, including {property_type} options that match what you were looking for. Some are priced very competitively given current market conditions.",
    call_to_action: "Would you be interested in scheduling a quick viewing this week? I have availability on {available_dates}.",
    objection_handlers: {
      busy: "I completely understand. When would be a better time for me to call back?",
      not_interested: "No problem at all. May I ask if your property requirements have changed since we last spoke?",
      already_bought: "Congratulations! That's wonderful news. If you ever need assistance with investment properties or know anyone looking, please keep us in mind."
    },
    closing: "Thank you so much for your time, {name}. I'll send you the property details we discussed via WhatsApp. Have a wonderful day!"
  },
  luxury: {
    name: 'Luxury Property Campaign',
    language: 'en',
    greeting: "Good {time_of_day}, {name}. This is {agent_name}, your dedicated luxury property advisor at {company}.",
    purpose: "I'm reaching out with an exclusive opportunity. We have a stunning {property_type} in {preferred_area} that just came to market, and given your refined taste, I immediately thought of you.",
    value_proposition: "This property features {key_features} and offers exceptional value at {price_range}. It's a rare find that won't be on the market long.",
    call_to_action: "I would be honored to arrange a private viewing at your convenience. Shall I book a time this week?",
    objection_handlers: {
      price: "I understand your consideration. The current owner is motivated, and there may be flexibility. Shall we explore this further?",
      location: "I appreciate that feedback. We have similar premium options in other prestigious communities. May I suggest some alternatives?",
      timing: "Of course. Premium properties do move quickly, but I can keep you informed of similar opportunities. When would be the right time for you?"
    },
    closing: "It's been a pleasure speaking with you, {name}. I'll share the property portfolio via secure link. Wishing you continued success."
  },
  investor: {
    name: 'Investment Opportunity Campaign',
    language: 'en',
    greeting: "Hello {name}, this is {agent_name} from {company}'s investment division.",
    purpose: "I'm calling about a compelling investment opportunity in Dubai's real estate market that aligns with your portfolio interests.",
    value_proposition: "We've identified {property_type} units in {preferred_area} offering {rental_yield}% rental yields with strong capital appreciation potential. The area has shown {appreciation_rate}% growth over the past year.",
    call_to_action: "I'd love to walk you through the detailed ROI analysis. Do you have 15 minutes this week for a brief presentation?",
    objection_handlers: {
      roi_concerns: "That's a valid consideration. Our analysis includes conservative, moderate, and optimistic scenarios. The numbers are quite compelling even in the conservative case.",
      market_timing: "Dubai's market has shown remarkable resilience. With Expo legacy projects and Vision 2030 initiatives, the fundamentals remain strong.",
      already_invested: "Excellent! Diversification across areas can optimize your portfolio returns. May I show you complementary opportunities?"
    },
    closing: "Thank you for your time, {name}. I'll send the investment prospectus and market analysis to your email. Let's speak again soon."
  },
  arabic: {
    name: 'Arabic Outreach Campaign',
    language: 'ar',
    greeting: "السلام عليكم {name}، معك {agent_name} من {company}. أتمنى أن يكون الوقت مناسباً للتحدث.",
    purpose: "أتواصل معك بخصوص فرص عقارية مميزة في {preferred_area} قد تناسب متطلباتك.",
    value_proposition: "لدينا {property_type} بمواصفات استثنائية وأسعار تنافسية. المنطقة تشهد نمواً ملحوظاً في القيمة.",
    call_to_action: "هل يمكننا ترتيب زيارة للعقار في وقت يناسبك؟",
    objection_handlers: {
      busy: "أقدر انشغالك. متى يكون الوقت المناسب للتواصل مجدداً؟",
      not_interested: "لا مشكلة. هل تغيرت متطلباتك العقارية؟",
      price: "أفهم. لدينا خيارات متنوعة تناسب ميزانيات مختلفة. هل أعرض عليك بدائل؟"
    },
    closing: "شكراً جزيلاً على وقتك {name}. سأرسل لك التفاصيل عبر الواتساب. أتمنى لك يوماً سعيداً."
  }
};

// Retell.ai call configuration
const RETELL_CONFIG = {
  voice_settings: {
    en: {
      voice_id: 'eleven_turbo_v2',
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true
    },
    ar: {
      voice_id: 'arabic_male_1',
      stability: 0.6,
      similarity_boost: 0.7,
      style: 0.4,
      use_speaker_boost: true
    }
  },
  call_settings: {
    max_call_duration: 300,
    silence_timeout: 10,
    response_delay: 0.5,
    interruption_sensitivity: 0.7,
    end_call_after_silence: 15
  }
};

/**
 * Parse CLI arguments and return an options object for campaign generation.
 *
 * @returns {Object} Options for campaign creation.
 * @property {string|null} segment - Uppercased segment filter (e.g., "A", "B"), or null if not provided.
 * @property {string|null} leads - Path to a scored leads JSON file, or null to use defaults.
 * @property {number} limit - Maximum number of leads to include.
 * @property {string} name - Campaign name.
 * @property {string} template - Script template key to use (e.g., "reactivation").
 * @property {string} language - Language code for voice settings (e.g., "en", "ar").
 * @property {boolean} export - Whether to write the generated campaign to disk.
 * @property {string|null} output - Explicit output file path when exporting, or null to use defaults.
 * @property {string|undefined} agentId - Agent identifier; defaults to process.env.RETELL_AGENT_ID when not supplied.
 * @property {string|undefined} phoneNumber - From-phone number for calls; defaults to process.env.PHONE_NUMBER when not supplied.
 * @property {string} company - Company display name used in scripts.
 * @property {string} agentName - Agent display name used in scripts.
 */
function parseArgs() {
  const result = {
    segment: null,
    leads: null,
    limit: 50,
    name: `Campaign ${new Date().toISOString().split('T')[0]}`,
    template: 'reactivation',
    language: 'en',
    export: false,
    output: null,
    agentId: process.env.RETELL_AGENT_ID,
    phoneNumber: process.env.PHONE_NUMBER,
    company: 'Dubai Premier Properties',
    agentName: 'Sarah'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--segment':
      case '-s':
        result.segment = args[++i]?.toUpperCase();
        break;
      case '--leads':
      case '-l':
        result.leads = args[++i];
        break;
      case '--limit':
        result.limit = parseInt(args[++i], 10);
        break;
      case '--name':
      case '-n':
        result.name = args[++i];
        break;
      case '--template':
      case '-t':
        result.template = args[++i];
        break;
      case '--language':
        result.language = args[++i];
        break;
      case '--export':
      case '-e':
        result.export = true;
        break;
      case '--output':
      case '-o':
        result.output = args[++i];
        break;
      case '--agent-id':
        result.agentId = args[++i];
        break;
      case '--phone':
        result.phoneNumber = args[++i];
        break;
      case '--company':
        result.company = args[++i];
        break;
      case '--agent-name':
        result.agentName = args[++i];
        break;
    }
  }

  return result;
}

/**
 * Load scored leads from a provided JSON file path or from default locations.
 * @param {string} [inputPath] - Optional path to a JSON file containing scored leads.
 * @returns {Array|Object|null} The parsed leads: the `leads` array if present in the file, otherwise the parsed JSON object; `null` if no file was found.
 */
function loadScoredLeads(inputPath) {
  if (inputPath && fs.existsSync(inputPath)) {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    return data.leads || data;
  }

  // Check default scored leads location
  const defaultPaths = [
    path.join(__dirname, '../output/scored-leads.json'),
    path.join(process.cwd(), 'scored-leads.json')
  ];

  for (const p of defaultPaths) {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return data.leads || data;
    }
  }

  return null;
}

/**
 * Produce a personalized script object by replacing template placeholders with lead- and campaign-specific values.
 *
 * Populates placeholders such as `{name}`, `{full_name}`, `{preferred_area}`, `{property_type}`, `{agent_name}`, `{company}`, `{time_of_day}`, `{available_dates}`, `{price_range}`, `{rental_yield}`, `{appreciation_rate}`, and `{key_features}` within the template.
 *
 * @param {Object} template - Script template containing string fields and nested string fields with placeholders to replace.
 * @param {Object} lead - Lead record (expected to include `name`, `preferredArea`, and `rfm` with optional `original` and `monetary` properties) used to fill personalization variables.
 * @param {Object} options - Generation options (expects `agentName` and `company`) that are injected into the script.
 * @returns {Object} The template object with all applicable placeholder strings replaced by lead- and option-derived values.
 */
function generatePersonalizedScript(template, lead, options) {
  const script = { ...template };
  const variables = {
    name: lead.name?.split(' ')[0] || 'there',
    full_name: lead.name || 'Valued Client',
    preferred_area: lead.preferredArea || lead.rfm?.original?.preferredArea || 'Dubai',
    property_type: lead.rfm?.original?.preferredType || 'property',
    agent_name: options.agentName,
    company: options.company,
    time_of_day: getTimeOfDay(),
    available_dates: getAvailableDates(),
    price_range: formatPriceRange(lead.rfm?.monetary?.value),
    rental_yield: '6-8',
    appreciation_rate: '8-12',
    key_features: 'premium finishes, private pool, and landscaped garden'
  };

  // Replace variables in all script fields
  for (const key of Object.keys(script)) {
    if (typeof script[key] === 'string') {
      script[key] = replaceVariables(script[key], variables);
    } else if (typeof script[key] === 'object') {
      for (const subKey of Object.keys(script[key])) {
        if (typeof script[key][subKey] === 'string') {
          script[key][subKey] = replaceVariables(script[key][subKey], variables);
        }
      }
    }
  }

  return script;
}

/**
 * Replace placeholders in the form `{key}` within a string using values from a variables map.
 * @param {string} text - Input string containing placeholders like `{name}`.
 * @param {Object<string,*>} variables - Mapping from placeholder names to replacement values.
 * @returns {string} The text with each `{key}` substituted by `variables[key]` when present; placeholders without a matching key are left unchanged.
 */
function replaceVariables(text, variables) {
  return text.replace(/\{(\w+)\}/g, (match, key) => variables[key] || match);
}

/**
 * Get the current time-of-day segment based on the local hour.
 * @returns {'morning'|'afternoon'|'evening'} `'morning'` for hours before 12, `'afternoon'` for hours 12–16, `'evening'` for hours 17 and later.
 */
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Produce a short string listing up to two upcoming day names for scheduling, skipping Fridays.
 * @returns {string} The next one or two weekday names separated by " or " (e.g., "Monday or Tuesday"), or an empty string if none are available.
 */
function getAvailableDates() {
  const dates = [];
  const now = new Date();
  for (let i = 1; i <= 3; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    if (date.getDay() !== 5) { // Skip Friday
      dates.push(date.toLocaleDateString('en-US', { weekday: 'long' }));
    }
  }
  return dates.slice(0, 2).join(' or ');
}

/**
 * Format a numeric property price into a human-readable AED range.
 * @param {number} value - The price in UAE dirhams.
 * @returns {string} `competitive pricing` if `value` is falsy; otherwise a formatted range in AED, e.g. `1.2-1.4 million AED` for values >= 1,000,000 or `350K-420K AED` for smaller values.
 */
function formatPriceRange(value) {
  if (!value) return 'competitive pricing';
  const millions = value / 1000000;
  if (millions >= 1) {
    return `${millions.toFixed(1)}-${(millions * 1.2).toFixed(1)} million AED`;
  }
  return `${(value / 1000).toFixed(0)}K-${((value * 1.2) / 1000).toFixed(0)}K AED`;
}

/**
 * Builds a Retell.ai campaign payload containing campaign metadata, per-lead call entries, and a summary.
 *
 * @param {Array<Object>} leads - Array of lead objects to include; expected fields include `id`, `name`, `phone`, `preferredArea`, and optional `rfm` data.
 * @param {Object} options - Generation options. Relevant keys: `name` (campaign name), `template` (script template key), `language`, `phoneNumber` (from number), and `agentId`.
 * @returns {Object} The campaign payload with three top-level properties:
 *   - `campaign`: metadata (id, name, created_at, status, template, language, total_calls, settings).
 *   - `calls`: array of per-call entries; each contains `call_id`, `to_number`, `from_number`, `agent_id`, `metadata`, `dynamic_variables`, `custom_script`, `voice_settings`, and `call_settings`.
 *   - `summary`: aggregate information (`total_leads`, `segments`, `areas`, `estimated_duration`, `estimated_cost`).
 */
function generateRetellCampaign(leads, options) {
  const template = SCRIPT_TEMPLATES[options.template] || SCRIPT_TEMPLATES.reactivation;
  const voiceSettings = RETELL_CONFIG.voice_settings[options.language] || RETELL_CONFIG.voice_settings.en;

  const calls = leads.map((lead, idx) => {
    const personalizedScript = generatePersonalizedScript(template, lead, options);

    return {
      call_id: `${options.name.replace(/\s+/g, '_')}_${lead.id}_${Date.now()}`,
      to_number: lead.phone,
      from_number: options.phoneNumber,
      agent_id: options.agentId,
      metadata: {
        lead_id: lead.id,
        lead_name: lead.name,
        segment: lead.rfm?.segment,
        rfm_score: lead.rfm?.totalScore,
        priority: idx + 1,
        campaign_name: options.name,
        preferred_area: lead.preferredArea
      },
      dynamic_variables: {
        customer_name: lead.name?.split(' ')[0],
        full_name: lead.name,
        area: lead.preferredArea,
        property_type: lead.rfm?.original?.preferredType || 'property'
      },
      custom_script: personalizedScript,
      voice_settings: voiceSettings,
      call_settings: RETELL_CONFIG.call_settings
    };
  });

  return {
    campaign: {
      id: `campaign_${Date.now()}`,
      name: options.name,
      created_at: new Date().toISOString(),
      status: 'draft',
      template: options.template,
      language: options.language,
      total_calls: calls.length,
      settings: {
        max_concurrent_calls: 5,
        call_interval_seconds: 30,
        retry_attempts: 2,
        retry_interval_minutes: 60,
        operating_hours: {
          start: '09:00',
          end: '20:00',
          timezone: 'Asia/Dubai',
          exclude_days: ['Friday']
        }
      }
    },
    calls,
    summary: {
      total_leads: leads.length,
      segments: groupBySegment(leads),
      areas: groupByArea(leads),
      estimated_duration: `${Math.ceil(leads.length * 5 / 60)} hours`,
      estimated_cost: `$${(leads.length * 0.15).toFixed(2)} USD`
    }
  };
}

/**
 * Count leads grouped by their RFM segment.
 *
 * If a lead lacks an RFM segment, it is counted under the 'UNKNOWN' key.
 * @param {Array<Object>} leads - Array of lead objects; each lead may include an `rfm.segment` string.
 * @returns {Object<string, number>} An object mapping segment names to their respective lead counts.
 */
function groupBySegment(leads) {
  const groups = {};
  for (const lead of leads) {
    const seg = lead.rfm?.segment || 'UNKNOWN';
    groups[seg] = (groups[seg] || 0) + 1;
  }
  return groups;
}

/**
 * Count leads grouped by their preferred area.
 * @param {Array<Object>} leads - Array of lead objects; leads without a `preferredArea` are counted under the key `"Unknown"`.
 * @returns {Object<string, number>} An object mapping each area name to the number of leads for that area.
 */
function groupByArea(leads) {
  const groups = {};
  for (const lead of leads) {
    const area = lead.preferredArea || 'Unknown';
    groups[area] = (groups[area] || 0) + 1;
  }
  return groups;
}

/**
 * Orchestrates CLI execution: parses options, loads and filters leads, builds a Retell.ai campaign, and outputs or exports the resulting JSON.
 *
 * Parses command-line arguments (including --help), attempts to load scored leads (falling back to a sample lead if none found), filters by segment and limit, generates a campaign payload using generateRetellCampaign, and writes the campaign JSON to stdout. When the --export flag is provided, writes the campaign to a file (creating directories as needed) and annotates the campaign with the export path. Prints help text and exits with code 0 when requested. On fatal conditions (no matching leads) or runtime errors, logs a JSON-formatted error to stderr and exits with code 1.
 */
function main() {
  const options = parseArgs();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Dubai Real Estate - Voice Campaign Generator

Usage:
  node voice-campaign.js [OPTIONS]

Options:
  --segment, -s <name>    Target RFM segment (CHAMPIONS, CANNOT_LOSE, etc.)
  --leads, -l <file>      Input file with scored leads
  --limit <n>             Maximum calls in campaign (default: 50)
  --name, -n <string>     Campaign name
  --template, -t <name>   Script template: reactivation, luxury, investor, arabic
  --language <code>       Language: en, ar (default: en)
  --export, -e            Export to file
  --output, -o <file>     Output file path
  --agent-id <id>         Retell.ai agent ID
  --phone <number>        Outbound caller ID
  --company <name>        Company name for scripts
  --agent-name <name>     Agent name for scripts

Templates:
  reactivation  - Re-engage dormant leads
  luxury        - High-end property pitch
  investor      - Investment opportunity focus
  arabic        - Arabic language outreach

Environment Variables:
  RETELL_API_KEY     - Retell.ai API key
  RETELL_AGENT_ID    - Default agent ID
  PHONE_NUMBER       - Default outbound number
`);
    process.exit(0);
  }

  try {
    // Load scored leads
    let leads = loadScoredLeads(options.leads);

    if (!leads) {
      // Generate sample data if no leads available
      console.error(JSON.stringify({
        warning: 'No scored leads found. Run score-leads.js first or provide --leads file.',
        suggestion: 'node score-leads.js --input leads.json --export'
      }));
      leads = [
        { id: 'SAMPLE_001', name: 'Sample Lead', phone: '+971501234567', preferredArea: 'The Springs', rfm: { segment: 'CANNOT_LOSE', totalScore: 10 } }
      ];
    }

    // Filter by segment
    if (options.segment) {
      leads = leads.filter(l => l.rfm?.segment === options.segment);
    }

    // Apply limit
    leads = leads.slice(0, options.limit);

    if (leads.length === 0) {
      console.error(JSON.stringify({ error: 'No leads match the criteria' }));
      process.exit(1);
    }

    // Generate campaign
    const campaign = generateRetellCampaign(leads, options);

    if (options.export) {
      const outputPath = options.output || path.join(__dirname, `../output/campaigns/retell-config-${Date.now()}.json`);
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(campaign, null, 2));
      campaign.exportedTo = outputPath;
    }

    console.log(JSON.stringify(campaign, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message, stack: err.stack }));
    process.exit(1);
  }
}

main();