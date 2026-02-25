import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const mobileAppDir = path.join(rootDir, 'mobile-app');
const requiredMode = process.argv.includes('--required');

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    const env = {};
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const idx = trimmed.indexOf('=');
        if (idx === -1) {
            continue;
        }

        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        env[key] = value;
    }

    return env;
}

const rootEnv = parseEnvFile(path.join(rootDir, '.env'));
const mobileEnv = parseEnvFile(path.join(mobileAppDir, '.env'));

function getConfig(name) {
    return process.env[name] || rootEnv[name] || mobileEnv[name] || '';
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

function runChecks() {
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
        || rootEnv.ANDROID_SDK_ROOT
        || rootEnv.ANDROID_HOME;

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
        const sevenZipPath =
            getConfig('NATIVEPHP_7ZIP_LOCATION') || 'C:\\Program Files\\7-Zip\\7z.exe';

        if (pathExists(sevenZipPath)) {
            pass('7-Zip', sevenZipPath);
        } else {
            fail('7-Zip', `7-Zip not found: ${sevenZipPath}`);
        }
    } else {
        pass('7-Zip', 'Not required on non-Windows hosts for this workflow.');
    }
}

runChecks();

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
