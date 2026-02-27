import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDuplicateEnvWarnings, parseEnvFileDetailed } from './env-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const mobileAppDir = path.join(rootDir, 'mobile-app');
const requiredMode = process.argv.includes('--required');

const rootEnv = parseEnvFileDetailed(path.join(rootDir, '.env'));
const mobileEnv = parseEnvFileDetailed(path.join(mobileAppDir, '.env'));

function getConfig(name) {
    return process.env[name] || rootEnv.env[name] || mobileEnv.env[name] || '';
}

function pathExists(value) {
    return Boolean(value) && fs.existsSync(value);
}

function resolvePhpBinary() {
    const configured = getConfig('NATIVEPHP_PHP_BIN');
    const candidates = [
        configured,
        path.join(rootDir, '.tools', 'php83', 'php.exe'),
        path.join(rootDir, '.tools', 'php83', 'bin', 'php'),
        'php',
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (candidate === 'php') {
            return candidate;
        }

        if (pathExists(candidate)) {
            return candidate;
        }
    }

    return 'php';
}

function checkCommand(command, args = [], options = {}) {
    try {
        const output = execFileSync(command, args, {
            cwd: options.cwd || rootDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { ok: true, output: output.trim() };
    } catch (error) {
        const stderr = error?.stderr?.toString?.() || '';
        const stdout = error?.stdout?.toString?.() || '';
        return {
            ok: false,
            output: (stderr || stdout || error.message || '').trim(),
        };
    }
}

function parseVersion(version) {
    const [major = 0, minor = 0, patch = 0] = String(version)
        .split('.')
        .map((part) => Number.parseInt(part, 10));
    return { major, minor, patch };
}

function isPhp83OrHigher(version) {
    const parsed = parseVersion(version);
    if (parsed.major > 8) {
        return true;
    }

    return parsed.major === 8 && parsed.minor >= 3;
}

function isPrivateIpv4(address) {
    return (
        address.startsWith('10.')
        || address.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
    );
}

function getPrivateIpv4Candidates() {
    const candidates = [];

    for (const [interfaceName, entries] of Object.entries(os.networkInterfaces())) {
        for (const entry of entries || []) {
            if (!entry || entry.family !== 'IPv4' || entry.internal) {
                continue;
            }

            if (!isPrivateIpv4(entry.address)) {
                continue;
            }

            candidates.push({
                interfaceName,
                address: entry.address,
            });
        }
    }

    return candidates;
}

function parsePort(value) {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        return null;
    }

    return parsed;
}

function checkPortAvailability(port) {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', () => {
            resolve(false);
        });

        server.once('listening', () => {
            server.close(() => resolve(true));
        });

        server.listen(port, '0.0.0.0');
    });
}

async function scanJumpPorts(startPort = 3000, endPort = 3010) {
    const occupancy = [];
    for (let port = startPort; port <= endPort; port += 1) {
        // eslint-disable-next-line no-await-in-loop
        const available = await checkPortAvailability(port);
        occupancy.push({ port, available });
    }

    const selected = occupancy.find((entry) => entry.available)?.port || null;
    return { occupancy, selected };
}

const results = [];

function pass(name, details) {
    results.push({ level: 'PASS', name, details });
}

function warn(name, details) {
    results.push({ level: 'WARN', name, details });
}

function fail(name, details) {
    results.push({ level: 'FAIL', name, details });
}

async function runChecks() {
    for (const duplicateWarning of createDuplicateEnvWarnings('Root .env', rootEnv)) {
        warn('Env Duplicates', duplicateWarning);
    }

    for (const duplicateWarning of createDuplicateEnvWarnings('mobile-app/.env', mobileEnv)) {
        warn('Env Duplicates', duplicateWarning);
    }

    const phpBinary = resolvePhpBinary();
    const phpVersion = checkCommand(phpBinary, ['-r', 'echo PHP_VERSION;'], { cwd: mobileAppDir });

    if (!phpVersion.ok) {
        fail('PHP CLI', `Failed to run ${phpBinary}. ${phpVersion.output}`);
    } else if (!isPhp83OrHigher(phpVersion.output)) {
        fail('PHP CLI', `Detected PHP ${phpVersion.output}. NativePHP mobile requires 8.3+.`);
    } else {
        pass('PHP CLI', `${phpBinary} -> ${phpVersion.output}`);
    }

    const adbResult = checkCommand('adb', ['devices']);
    if (!adbResult.ok) {
        fail('ADB', `adb not available: ${adbResult.output}`);
    } else {
        const lines = adbResult.output
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(1);

        if (lines.length === 0) {
            warn('ADB', 'No devices detected. Connect device or start emulator.');
        } else if (lines.some((line) => line.endsWith('unauthorized'))) {
            fail('ADB', 'Device is unauthorized. Accept USB debugging prompt on phone and re-run.');
        } else {
            pass('ADB', `Detected devices: ${lines.join(', ')}`);
        }
    }

    const sdkPath = getConfig('NATIVEPHP_ANDROID_SDK_LOCATION')
        || process.env.ANDROID_SDK_ROOT
        || process.env.ANDROID_HOME
        || rootEnv.env.ANDROID_SDK_ROOT
        || rootEnv.env.ANDROID_HOME;

    if (!sdkPath) {
        fail('Android SDK', 'No SDK path configured. Set NATIVEPHP_ANDROID_SDK_LOCATION or ANDROID_SDK_ROOT.');
    } else if (!pathExists(sdkPath)) {
        fail('Android SDK', `Configured path does not exist: ${sdkPath}`);
    } else {
        pass('Android SDK', sdkPath);
    }

    const emulatorOverride = process.env.ANDROID_EMULATOR || getConfig('ANDROID_EMULATOR');
    const emulatorCandidates = [emulatorOverride].filter(Boolean);

    if (sdkPath) {
        emulatorCandidates.push(
            path.join(sdkPath, 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator')
        );
    }

    const emulatorPath = emulatorCandidates.find((candidate) => pathExists(candidate));
    if (emulatorPath) {
        pass('Android Emulator', emulatorPath);
    } else {
        warn('Android Emulator', 'Emulator binary not found. USB device workflow is still valid.');
    }

    const timeoutRaw = getConfig('NATIVEPHP_COMPOSER_DUMP_TIMEOUT');
    const timeout = Number.parseInt(timeoutRaw || '0', 10);
    if (timeout >= 300) {
        pass('Composer Timeout', `NATIVEPHP_COMPOSER_DUMP_TIMEOUT=${timeout}`);
    } else {
        warn('Composer Timeout', 'Set NATIVEPHP_COMPOSER_DUMP_TIMEOUT=300 to avoid optimization timeout.');
    }

    if (process.platform === 'win32') {
        const sevenZipPath = getConfig('NATIVEPHP_7ZIP_LOCATION') || 'C:\\Program Files\\7-Zip\\7z.exe';

        if (pathExists(sevenZipPath)) {
            pass('7-Zip', sevenZipPath);
        } else {
            fail('7-Zip', `7-Zip not found: ${sevenZipPath}`);
        }
    } else {
        pass('7-Zip', 'Not required on non-Windows hosts for this workflow.');
    }

    const privateIpCandidates = getPrivateIpv4Candidates();
    const pinnedHostIp = getConfig('NATIVEPHP_HOST_IP');

    if (privateIpCandidates.length > 1 && !pinnedHostIp) {
        const candidatesText = privateIpCandidates
            .map((candidate) => `${candidate.interfaceName}:${candidate.address}`)
            .join(', ');
        warn(
            'Host IP Selection',
            `Multiple private interfaces detected (${candidatesText}). Set NATIVEPHP_HOST_IP to avoid wrong adapter selection.`
        );
    } else if (privateIpCandidates.length === 0) {
        warn('Host IP Selection', 'No private IPv4 interface detected for LAN Jump testing.');
    } else {
        const selected = pinnedHostIp || privateIpCandidates[0].address;
        pass('Host IP Selection', `Current preferred host IP: ${selected}`);
    }

    const { occupancy, selected } = await scanJumpPorts(3000, 3010);
    const occupancySummary = occupancy
        .map((entry) => `${entry.port}:${entry.available ? 'free' : 'used'}`)
        .join(', ');

    if (!selected) {
        fail('Jump Port', `No free ports available in 3000-3010. Occupancy: ${occupancySummary}`);
    } else {
        pass('Jump Port', `Selected port ${selected}. Occupancy: ${occupancySummary}`);
    }

    const configuredJumpPortRaw = getConfig('LAB_JUMP_HTTP_PORT');
    if (configuredJumpPortRaw) {
        const configuredJumpPort = parsePort(configuredJumpPortRaw);

        if (!configuredJumpPort) {
            warn('Jump Port Config', `LAB_JUMP_HTTP_PORT is invalid: ${configuredJumpPortRaw}`);
        } else if (selected && configuredJumpPort !== selected) {
            warn(
                'Jump Port Config',
                `LAB_JUMP_HTTP_PORT=${configuredJumpPort} but first free port is ${selected}.`
            );
        } else {
            pass('Jump Port Config', `LAB_JUMP_HTTP_PORT=${configuredJumpPort}`);
        }
    }
}

await runChecks();

for (const entry of results) {
    console.log(`[${entry.level}] ${entry.name}: ${entry.details}`);
}

const failureCount = results.filter((entry) => entry.level === 'FAIL').length;
if (failureCount > 0) {
    console.error(
        `mobile-doctor completed with ${failureCount} failure(s).`
        + (requiredMode ? ' Fix the failures before running native commands.' : '')
    );
    process.exit(1);
}

console.log('mobile-doctor completed without blocking failures.');