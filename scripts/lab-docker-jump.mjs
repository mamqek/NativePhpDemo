import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const mobileAppDir = path.join(rootDir, 'mobile-app');
const dryRun = process.argv.includes('--dry-run');

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

async function patchJumpRouterHostForwarding() {
    const patchCmd =
        "ROUTER_PATH=/workspace/mobile-app/vendor/nativephp/mobile/resources/jump/router.php; " +
        'if [ -f "$ROUTER_PATH" ]; then ' +
        `sed -i "s/'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host'/'connection', 'keep-alive', 'transfer-encoding', 'upgrade'/g" "$ROUTER_PATH"; ` +
        'fi';

    await run('docker', ['compose', 'exec', '-T', 'mobile-web', 'sh', '-lc', patchCmd]);
}

async function main() {
    const platform = process.argv[2];
    if (!platform || !['android', 'ios'].includes(platform)) {
        console.error('Usage: node scripts/lab-docker-jump.mjs <android|ios> [--dry-run]');
        process.exit(1);
    }

    const laravelPort = getConfig('NATIVEPHP_LARAVEL_PORT') || '8080';
    const ip = detectHostIp();
    if (!ip) {
        throw new Error('Unable to auto-detect host IP. Set NATIVEPHP_HOST_IP in nativephp-mobile-lab/.env.');
    }

    console.log(`Using Jump host IP: ${ip}`);
    console.log(`Using Laravel proxy port: ${laravelPort}`);

    await run('docker', ['compose', 'ps', '--status', 'running', '--services', 'mobile-web']);
    await patchJumpRouterHostForwarding();
    await run('docker', [
        'compose',
        'exec',
        '-T',
        'mobile-web',
        'php',
        'artisan',
        'native:jump',
        platform,
        `--ip=${ip}`,
        `--laravel-port=${laravelPort}`,
        '--no-interaction',
    ]);
}

main().catch((error) => {
    const message = String(error.message || '');
    if (message.includes('Command failed (docker compose ps')) {
        console.error('Docker is unavailable or mobile-web is not running. Start Docker, then run: npm run lab:mobile:web:up');
    }

    console.error(message || String(error));
    process.exit(1);
});
