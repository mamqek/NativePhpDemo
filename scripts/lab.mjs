import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDuplicateEnvWarnings, parseEnvFileDetailed } from './env-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const mobileAppDir = path.join(rootDir, 'mobile-app');
const dryRun = process.argv.includes('--dry-run');

const rootEnv = parseEnvFileDetailed(path.join(rootDir, '.env'));
const mobileEnv = parseEnvFileDetailed(path.join(mobileAppDir, '.env'));

for (const warning of createDuplicateEnvWarnings('Root .env', rootEnv)) {
    console.warn(`[WARN] ${warning}`);
}

for (const warning of createDuplicateEnvWarnings('mobile-app/.env', mobileEnv)) {
    console.warn(`[WARN] ${warning}`);
}

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

function detectHostIp() {
    const configured = getConfig('NATIVEPHP_HOST_IP');
    if (configured) {
        return configured;
    }

    const interfaces = os.networkInterfaces();
    const preferred = [];
    const fallback = [];

    for (const entries of Object.values(interfaces)) {
        for (const entry of entries || []) {
            if (!entry || entry.family !== 'IPv4' || entry.internal) {
                continue;
            }

            if (
                entry.address.startsWith('10.') ||
                entry.address.startsWith('192.168.') ||
                /^172\.(1[6-9]|2\d|3[0-1])\./.test(entry.address)
            ) {
                preferred.push(entry.address);
            } else {
                fallback.push(entry.address);
            }
        }
    }

    return preferred[0] || fallback[0] || '';
}

function run(command, args, options = {}) {
    if (dryRun) {
        console.log(`[dry-run] cwd=${options.cwd || rootDir}`);
        console.log(`[dry-run] ${command} ${args.join(' ')}`);
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit',
            cwd: options.cwd || rootDir,
            env: { ...process.env, ...options.env },
            shell: false,
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`Command failed (${command} ${args.join(' ')}), exit code ${code}`));
        });
    });
}

async function runJump(platform) {
    const php = resolvePhpBinary();
    const ip = detectHostIp();

    if (!ip) {
        throw new Error(`Unable to auto-detect host IP. Set NATIVEPHP_HOST_IP in ${path.join(rootDir, '.env')}.`);
    }

    console.log(`Using PHP binary: ${php}`);
    console.log(`Using Jump host IP: ${ip}`);

    await run(php, ['artisan', 'native:jump', platform, `--ip=${ip}`, '--no-interaction'], {
        cwd: mobileAppDir,
    });
}

async function runAndroid() {
    const php = resolvePhpBinary();

    await run(process.execPath, [path.join(scriptDir, 'mobile-doctor.mjs'), '--required']);

    console.log(`Using PHP binary: ${php}`);
    await run(php, ['artisan', 'native:run', 'android'], { cwd: mobileAppDir });
}

async function main() {
    const command = process.argv[2];

    if (!command) {
        console.error('Usage: node scripts/lab.mjs <jump-android|jump-ios|run-android> [--dry-run]');
        process.exit(1);
    }

    if (command === 'jump-android') {
        await runJump('android');
        return;
    }

    if (command === 'jump-ios') {
        await runJump('ios');
        return;
    }

    if (command === 'run-android') {
        await runAndroid();
        return;
    }

    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

main().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
});
