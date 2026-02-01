#!/usr/bin/env node
/**
 * System Info - Overview
 * Get comprehensive system information
 * Usage: node overview.js [OPTIONS]
 */

const os = require('os');
const fs = require('fs');

const args = process.argv.slice(2);

/**
 * Parse command-line options for output format and specific section selection.
 *
 * @returns {{format: string, section: string|null}} Object with `format` set to the requested output format (default `"json"`) and `section` set to the requested section name or `null` if none provided.
 */
function parseArgs() {
  const result = {
    format: 'json',
    section: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      result.format = args[i + 1];
      i++;
    } else if (args[i] === '--section' && args[i + 1]) {
      result.section = args[i + 1];
      i++;
    }
  }

  return result;
}

/**
 * Collects CPU metadata and computes the overall CPU usage percentage across all cores.
 *
 * @returns {{model: string, cores: number, speed: number, usage: number}} An object containing CPU information:
 * - `model`: CPU model string (or `'Unknown'` if unavailable).
 * - `cores`: number of logical CPU cores.
 * - `speed`: clock speed of the first CPU in MHz (or `0` if unavailable).
 * - `usage`: overall CPU usage percentage across all cores, rounded to one decimal place.
 */
function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  return {
    model: cpus[0]?.model || 'Unknown',
    cores: cpus.length,
    speed: cpus[0]?.speed || 0,
    usage: Math.round((1 - totalIdle / totalTick) * 100 * 10) / 10
  };
}

/**
 * Gather current system memory metrics.
 *
 * @returns {Object} An object containing memory statistics.
 * @property {number} total - Total system memory in bytes.
 * @property {number} used - Used memory in bytes (total minus free).
 * @property {number} free - Free memory in bytes.
 * @property {number} usedPercent - Percentage of memory used, rounded to one decimal.
 * @property {string} totalFormatted - Human-readable formatted total memory (e.g., "1.5 GB").
 * @property {string} usedFormatted - Human-readable formatted used memory.
 * @property {string} freeFormatted - Human-readable formatted free memory.
 */
function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    total,
    used,
    free,
    usedPercent: Math.round((used / total) * 100 * 10) / 10,
    totalFormatted: formatBytes(total),
    usedFormatted: formatBytes(used),
    freeFormatted: formatBytes(free)
  };
}

/**
 * Provide disk usage information for the root filesystem when available.
 *
 * On Linux this returns an object with numeric totals and human-readable strings; on other platforms or if retrieval fails it returns a note indicating the information is unavailable.
 * @returns {{path: string, total: number, used: number, free: number, usedPercent: number, totalFormatted: string, usedFormatted: string, freeFormatted: string} | {note: string, available: false}}
 */
function getDiskInfo() {
  // This is a simplified version - full disk info requires native bindings
  try {
    if (process.platform === 'linux') {
      const stat = fs.statfsSync('/');
      const total = stat.blocks * stat.bsize;
      const free = stat.bfree * stat.bsize;
      const used = total - free;

      return {
        path: '/',
        total,
        used,
        free,
        usedPercent: Math.round((used / total) * 100 * 10) / 10,
        totalFormatted: formatBytes(total),
        usedFormatted: formatBytes(used),
        freeFormatted: formatBytes(free)
      };
    }
  } catch {
    // statfsSync not available
  }

  return {
    note: 'Disk info requires platform-specific implementation',
    available: false
  };
}

/**
 * Collects non-internal network interface addresses available on the system.
 * @returns {Array<Object>} An array of network address objects.
 * Each object has the following properties:
 * - name: the network interface name.
 * - address: the IP address as a string.
 * - family: address family (e.g., 'IPv4' or 'IPv6').
 * - mac: the interface MAC address.
 * - netmask: the netmask as a string.
 */
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const result = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;

    for (const addr of addrs) {
      if (addr.internal) continue;

      result.push({
        name,
        address: addr.address,
        family: addr.family,
        mac: addr.mac,
        netmask: addr.netmask
      });
    }
  }

  return result;
}

/**
 * Collect basic operating system details and formatted uptime.
 * @returns {Object} An object with OS information:
 * - platform: the operating system platform.
 * - release: OS release version.
 * - arch: CPU architecture.
 * - hostname: system hostname.
 * - uptime: system uptime in seconds.
 * - uptimeFormatted: human-readable uptime string.
 * - type: operating system name.
 * - version: OS version string or `'N/A'` if unavailable.
 * - homedir: current user's home directory path.
 * - tmpdir: system temporary directory path.
 */
function getOsInfo() {
  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: os.uptime(),
    uptimeFormatted: formatUptime(os.uptime()),
    type: os.type(),
    version: os.version?.() || 'N/A',
    homedir: os.homedir(),
    tmpdir: os.tmpdir()
  };
}

/**
 * Collects runtime details about the current Node.js process and environment.
 * @returns {{node: string, v8: string, platform: string, arch: string, pid: number, cwd: string, execPath: string}} An object containing runtime information:
 * - `node`: Node.js version string (e.g., "v18.12.1").
 * - `v8`: V8 engine version string.
 * - `platform`: Operating system platform (process.platform).
 * - `arch`: CPU architecture (process.arch).
 * - `pid`: Current process ID.
 * - `cwd`: Current working directory path.
 * - `execPath`: Absolute path to the Node.js executable.
 */
function getRuntimeInfo() {
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    cwd: process.cwd(),
    execPath: process.execPath
  };
}

/**
 * Convert a byte count into a human-readable string using units B–TB.
 * @param {number} bytes - Number of bytes.
 * @return {string} Human-readable size with two decimal places and unit (e.g. "1.50 GB").
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

/**
 * Format an uptime duration given in seconds into a compact human-readable string.
 * @param {number} seconds - Uptime duration in seconds.
 * @returns {string} A string with days (`d`), hours (`h`), and minutes (`m`) as needed (e.g. `1d 2h 3m`), or `"< 1m"` if under one minute.
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '< 1m';
}

/**
 * Build a human-readable multi-section text summary from the provided system information.
 * @param {Object} info - System information object containing os, cpu, memory, disk, network, and runtime sections.
 * @param {Object} info.os - OS info with properties: platform, arch, release, hostname, and uptimeFormatted.
 * @param {Object} info.cpu - CPU info with properties: model, cores, and usage.
 * @param {Object} info.memory - Memory info with properties: totalFormatted, usedFormatted, freeFormatted, and usedPercent.
 * @param {Object} info.disk - Disk info with properties: totalFormatted, usedFormatted, freeFormatted, usedPercent; may be { available: false } if not provided.
 * @param {Array<Object>} info.network - Array of network interface objects with properties: name, address, and family.
 * @param {Object} info.runtime - Runtime info with properties: node, v8, and pid.
 * @returns {string} A multi-line, human-readable string summarizing the system information.
 */
function formatText(info) {
  const lines = [];

  lines.push('=== System Overview ===');
  lines.push('');

  lines.push('OS:');
  lines.push(`  Platform: ${info.os.platform} ${info.os.arch}`);
  lines.push(`  Release: ${info.os.release}`);
  lines.push(`  Hostname: ${info.os.hostname}`);
  lines.push(`  Uptime: ${info.os.uptimeFormatted}`);
  lines.push('');

  lines.push('CPU:');
  lines.push(`  Model: ${info.cpu.model}`);
  lines.push(`  Cores: ${info.cpu.cores}`);
  lines.push(`  Usage: ${info.cpu.usage}%`);
  lines.push('');

  lines.push('Memory:');
  lines.push(`  Total: ${info.memory.totalFormatted}`);
  lines.push(`  Used: ${info.memory.usedFormatted} (${info.memory.usedPercent}%)`);
  lines.push(`  Free: ${info.memory.freeFormatted}`);
  lines.push('');

  if (info.disk.available !== false) {
    lines.push('Disk:');
    lines.push(`  Total: ${info.disk.totalFormatted}`);
    lines.push(`  Used: ${info.disk.usedFormatted} (${info.disk.usedPercent}%)`);
    lines.push(`  Free: ${info.disk.freeFormatted}`);
    lines.push('');
  }

  lines.push('Network:');
  for (const iface of info.network) {
    lines.push(`  ${iface.name}: ${iface.address} (${iface.family})`);
  }
  lines.push('');

  lines.push('Runtime:');
  lines.push(`  Node.js: ${info.runtime.node}`);
  lines.push(`  V8: ${info.runtime.v8}`);
  lines.push(`  PID: ${info.runtime.pid}`);

  return lines.join('\n');
}

/**
 * Gathers system information and writes it to stdout in JSON (default) or plain text.
 *
 * When a specific section is requested via CLI options, outputs only that section; otherwise outputs a full snapshot with a timestamp.
 */
function main() {
  const options = parseArgs();

  const sections = {
    os: getOsInfo,
    cpu: getCpuUsage,
    memory: getMemoryInfo,
    disk: getDiskInfo,
    network: getNetworkInfo,
    runtime: getRuntimeInfo
  };

  let info;

  if (options.section && sections[options.section]) {
    info = { [options.section]: sections[options.section]() };
  } else {
    info = {
      timestamp: new Date().toISOString(),
      os: getOsInfo(),
      cpu: getCpuUsage(),
      memory: getMemoryInfo(),
      disk: getDiskInfo(),
      network: getNetworkInfo(),
      runtime: getRuntimeInfo()
    };
  }

  if (options.format === 'text') {
    console.log(formatText(info));
  } else {
    console.log(JSON.stringify(info, null, 2));
  }
}

main();