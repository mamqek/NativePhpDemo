import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createDuplicateEnvWarnings, parseEnvFileDetailed } from './env-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const mobileAppDir = path.join(rootDir, 'mobile-app');

const parsed = parseArgs(process.argv.slice(2));
const dryRun = parsed.options.dryRun;

const rootEnv = parseEnvFileDetailed(path.join(rootDir, '.env'));
const mobileEnv = parseEnvFileDetailed(path.join(mobileAppDir, '.env'));

for (const warning of createDuplicateEnvWarnings('Root .env', rootEnv)) {
    console.warn(`[WARN] ${warning}`);
}

for (const warning of createDuplicateEnvWarnings('mobile-app/.env', mobileEnv)) {
    console.warn(`[WARN] ${warning}`);
}

function usage() {
    return [
        'Usage: node scripts/lab-docker-jump.mjs <android|ios> [options]',
        '',
        'Options:',
        '  --ip=<IPv4>            Force the IP placed into the QR payload.',
        '  --ip-mode=auto|manual  Host IP selection mode (default: auto).',
        '  --http-port=<port>     Force Jump HTTP port (default: first free in 3000..3010).',
        '  --usb                  Android-only USB fallback (adb reverse + 127.0.0.1).',
        '  --dry-run              Print commands without executing them.',
    ].join('\n');
}

function parseArgs(argv) {
    const options = {
        ip: '',
        ipMode: 'auto',
        httpPort: null,
        usb: false,
        dryRun: false,
    };

    const positional = [];

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--dry-run') {
            options.dryRun = true;
            continue;
        }

        if (arg === '--usb') {
            options.usb = true;
            continue;
        }

        if (arg === '--ip' && argv[index + 1]) {
            options.ip = argv[index + 1].trim();
            index += 1;
            continue;
        }

        if (arg.startsWith('--ip=')) {
            options.ip = arg.slice('--ip='.length).trim();
            continue;
        }

        if (arg === '--ip-mode' && argv[index + 1]) {
            options.ipMode = argv[index + 1].trim();
            index += 1;
            continue;
        }

        if (arg.startsWith('--ip-mode=')) {
            options.ipMode = arg.slice('--ip-mode='.length).trim();
            continue;
        }

        if (arg === '--http-port' && argv[index + 1]) {
            options.httpPort = argv[index + 1].trim();
            index += 1;
            continue;
        }

        if (arg.startsWith('--http-port=')) {
            options.httpPort = arg.slice('--http-port='.length).trim();
            continue;
        }

        if (arg.startsWith('--')) {
            throw new Error(`Unknown option: ${arg}`);
        }

        positional.push(arg);
    }

    return {
        platform: positional[0] || '',
        options,
    };
}

function parsePort(value) {
    const parsedPort = Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        return null;
    }

    return parsedPort;
}

function isPrivateIpv4(address) {
    return (
        address.startsWith('10.')
        || address.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
    );
}

function isVirtualInterfaceName(name) {
    return /(virtual|vmware|vbox|virtualbox|hyper-v|vethernet|wsl|docker|loopback|tailscale|zerotier|hamachi|vpn)/i.test(name);
}

function getConfig(name) {
    return process.env[name] || rootEnv.env[name] || mobileEnv.env[name] || '';
}

function run(command, args, options = {}) {
    if (dryRun) {
        console.log(`[dry-run] cwd=${options.cwd || rootDir}`);
        if (options.env && Object.keys(options.env).length > 0) {
            const envSummary = Object.entries(options.env)
                .map(([key, value]) => `${key}=${value}`)
                .join(' ');
            console.log(`[dry-run] env ${envSummary}`);
        }
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

function runCapture(command, args, options = {}) {
    if (dryRun) {
        console.log(`[dry-run] cwd=${options.cwd || rootDir}`);
        console.log(`[dry-run] ${command} ${args.join(' ')}`);
        return Promise.resolve({ stdout: '', stderr: '' });
    }

    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: options.cwd || rootDir,
            env: { ...process.env, ...options.env },
            shell: false,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
                return;
            }

            const error = new Error(`Command failed (${command} ${args.join(' ')}), exit code ${code}`);
            error.stdout = stdout.trim();
            error.stderr = stderr.trim();
            reject(error);
        });
    });
}

function runCaptureSync(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd || rootDir,
        encoding: 'utf8',
        shell: false,
    });

    return {
        ok: result.status === 0,
        stdout: (result.stdout || '').trim(),
        stderr: (result.stderr || '').trim(),
    };
}

function getDefaultRouteInterfaceName() {
    if (process.platform === 'win32') {
        const query = "(Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric, InterfaceMetric | Select-Object -First 1 -ExpandProperty InterfaceAlias)";
        const result = runCaptureSync('powershell', ['-NoProfile', '-Command', query]);
        return result.ok ? result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '' : '';
    }

    if (process.platform === 'darwin') {
        const result = runCaptureSync('sh', ['-lc', "route -n get default 2>/dev/null | awk '/interface:/{print $2}'"]);
        return result.ok ? result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '' : '';
    }

    const result = runCaptureSync('sh', ['-lc', "ip route show default 2>/dev/null | awk '{print $5; exit}'"]);
    return result.ok ? result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '' : '';
}

function listIpv4Candidates() {
    const candidates = [];

    for (const [interfaceName, entries] of Object.entries(os.networkInterfaces())) {
        for (const entry of entries || []) {
            if (!entry || entry.family !== 'IPv4' || entry.internal) {
                continue;
            }

            candidates.push({
                interfaceName,
                address: entry.address,
                isPrivate: isPrivateIpv4(entry.address),
                isVirtual: isVirtualInterfaceName(interfaceName),
            });
        }
    }

    return candidates;
}

function rankCandidates(candidates) {
    const defaultInterface = getDefaultRouteInterfaceName().toLowerCase();

    return [...candidates]
        .map((candidate) => {
            let score = 0;

            if (defaultInterface && candidate.interfaceName.toLowerCase() === defaultInterface) {
                score += 100;
            }

            if (candidate.isPrivate) {
                score += 40;
            }

            if (!candidate.isVirtual) {
                score += 20;
            }

            if (candidate.address.startsWith('192.168.')) {
                score += 10;
            } else if (candidate.address.startsWith('10.')) {
                score += 8;
            } else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(candidate.address)) {
                score += 6;
            }

            return {
                ...candidate,
                score,
            };
        })
        .sort((left, right) => right.score - left.score || left.interfaceName.localeCompare(right.interfaceName));
}

function detectHostIpAuto() {
    const ranked = rankCandidates(listIpv4Candidates());
    const privateCandidate = ranked.find((candidate) => candidate.isPrivate);
    if (privateCandidate) {
        return privateCandidate.address;
    }

    return ranked[0]?.address || '';
}

async function selectHostIpManual() {
    const ranked = rankCandidates(listIpv4Candidates());
    const privateCandidates = ranked.filter((candidate) => candidate.isPrivate);
    const candidates = privateCandidates.length > 0 ? privateCandidates : ranked;

    if (candidates.length === 0) {
        return '';
    }

    if (dryRun || !process.stdin.isTTY || !process.stdout.isTTY) {
        const fallback = candidates[0];
        console.warn(
            `[WARN] Manual IP mode requested but interactive prompt unavailable. Using ${fallback.address} (${fallback.interfaceName}).`
        );
        return fallback.address;
    }

    console.log('Multiple interfaces detected. Select the IP for Jump QR payload:');
    candidates.forEach((candidate, index) => {
        const tags = [candidate.interfaceName];
        if (candidate.isVirtual) {
            tags.push('virtual');
        }
        if (candidate.score > 0) {
            tags.push(`score=${candidate.score}`);
        }
        console.log(`  ${index + 1}. ${candidate.address} (${tags.join(', ')})`);
    });

    const rl = readline.createInterface({ input, output });
    try {
        const answer = (await rl.question(`Select interface [1-${candidates.length}] (default 1): `)).trim();
        if (!answer) {
            return candidates[0].address;
        }

        const selectedIndex = Number.parseInt(answer, 10);
        if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > candidates.length) {
            throw new Error(`Invalid interface selection: ${answer}`);
        }

        return candidates[selectedIndex - 1].address;
    } finally {
        rl.close();
    }
}

async function resolveHostIp(options) {
    if (options.ip) {
        return { ip: options.ip, source: '--ip' };
    }

    const configuredHostIp = getConfig('NATIVEPHP_HOST_IP').trim();
    if (configuredHostIp) {
        return { ip: configuredHostIp, source: 'NATIVEPHP_HOST_IP' };
    }

    if (options.usb) {
        return { ip: '127.0.0.1', source: '--usb' };
    }

    if (options.ipMode === 'manual') {
        const manualSelection = await selectHostIpManual();
        if (!manualSelection) {
            throw new Error('No IPv4 interfaces available for manual selection.');
        }

        return { ip: manualSelection, source: 'manual-select' };
    }

    const rankedCandidates = rankCandidates(listIpv4Candidates()).filter((candidate) => candidate.isPrivate);
    if (rankedCandidates.length > 1) {
        const candidateSummary = rankedCandidates
            .map((candidate) => `${candidate.interfaceName}:${candidate.address}`)
            .join(', ');
        console.warn(
            `[WARN] Multiple private interfaces detected (${candidateSummary}). `
            + 'If device download fails, retry with --ip-mode=manual or set NATIVEPHP_HOST_IP.'
        );
    }

    const autoDetectedIp = rankedCandidates[0]?.address || detectHostIpAuto();
    if (!autoDetectedIp) {
        throw new Error(`Unable to auto-detect host IP. Set NATIVEPHP_HOST_IP in ${path.join(rootDir, '.env')}.`);
    }

    return { ip: autoDetectedIp, source: 'auto-detect' };
}

function isPortAvailable(port) {
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

async function selectJumpPort(explicitPort) {
    if (explicitPort) {
        const parsedPort = parsePort(explicitPort);
        if (!parsedPort) {
            throw new Error(`Invalid --http-port value: ${explicitPort}`);
        }

        const available = await isPortAvailable(parsedPort);
        if (!available) {
            throw new Error(`Requested --http-port=${parsedPort} is already in use on host.`);
        }

        return parsedPort;
    }

    for (let port = 3000; port <= 3010; port += 1) {
        // eslint-disable-next-line no-await-in-loop
        const available = await isPortAvailable(port);
        if (available) {
            return port;
        }
    }

    throw new Error('No free host ports available in range 3000-3010 for Jump HTTP server.');
}

async function isContainerPortAvailable(port) {
    if (dryRun) {
        return true;
    }

    const probeScript =
        '$port=(int)$argv[1]; '
        + '$socket=@stream_socket_server("tcp://0.0.0.0:".$port,$errno,$errstr); '
        + 'if($socket){fclose($socket); echo "free"; exit(0);} '
        + 'echo "used"; exit(0);';

    const result = await runCapture('docker', [
        'compose',
        'exec',
        '-T',
        'mobile-web',
        'php',
        '-r',
        probeScript,
        '--',
        String(port),
    ]);

    return result.stdout.trim() === 'free';
}

async function selectContainerJumpPort(basePort, explicitPort) {
    if (explicitPort) {
        const explicit = parsePort(explicitPort);
        if (!explicit) {
            throw new Error(`Invalid --http-port value: ${explicitPort}`);
        }

        const explicitAvailable = await isContainerPortAvailable(explicit);
        if (!explicitAvailable) {
            throw new Error(
                `Requested --http-port=${explicit} is busy inside container. Stop previous Jump session or choose another port.`
            );
        }

        return explicit;
    }

    for (let port = basePort; port <= 3010; port += 1) {
        // eslint-disable-next-line no-await-in-loop
        const available = await isContainerPortAvailable(port);
        if (available) {
            return port;
        }
    }

    throw new Error(`No free container ports available in range ${basePort}-3010 for Jump HTTP server.`);
}

async function ensureDockerServices(httpPort, wsPort) {
    const envOverride = {
        LAB_JUMP_HTTP_PORT: String(httpPort),
        LAB_JUMP_WS_PORT: String(wsPort),
    };

    await run('docker', ['compose', 'up', '-d', 'backend-api'], { env: envOverride });
    await run('docker', ['compose', 'up', '-d', '--force-recreate', 'mobile-web'], { env: envOverride });

    if (dryRun) {
        return;
    }

    const status = await runCapture('docker', ['compose', 'ps', '--status', 'running', '--services', 'mobile-web'], {
        env: envOverride,
    });

    const runningServices = status.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!runningServices.includes('mobile-web')) {
        throw new Error('Service "mobile-web" is not running after docker compose up.');
    }
}

async function patchJumpRouterHostForwarding() {
    const patchCmd =
        'ROUTER_PATH=/workspace/mobile-app/vendor/nativephp/mobile/resources/jump/router.php; '
        + 'if [ -f "$ROUTER_PATH" ]; then '
        + `sed -i "s/'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host'/'connection', 'keep-alive', 'transfer-encoding', 'upgrade'/g" "$ROUTER_PATH"; `
        + 'fi';

    await run('docker', ['compose', 'exec', '-T', 'mobile-web', 'sh', '-lc', patchCmd]);
}

async function verifyJumpRouterHostForwarding() {
    if (dryRun) {
        return;
    }

    const checkCmd =
        'ROUTER_PATH=/workspace/mobile-app/vendor/nativephp/mobile/resources/jump/router.php; '
        + 'if [ ! -f "$ROUTER_PATH" ]; then echo "__MISSING__"; exit 20; fi; '
        + 'grep -n "keep-alive" "$ROUTER_PATH" | head -n 1';

    const result = await runCapture('docker', ['compose', 'exec', '-T', 'mobile-web', 'sh', '-lc', checkCmd]);
    const line = result.stdout.trim();

    if (!line || line === '__MISSING__') {
        throw new Error('Jump router file not found inside container. Cannot verify Host header forwarding patch.');
    }

    if (line.includes("'host'")) {
        throw new Error('Jump router still strips Host header. CORS/same-origin issues will persist.');
    }
}

function parseAdbDevicesOutput(output) {
    return output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('List of devices attached'))
        .map((line) => {
            const parts = line.split(/\s+/);
            return {
                serial: parts[0],
                status: parts[1] || '',
            };
        });
}

async function setupUsbReverse(httpPort, wsPort) {
    if (dryRun) {
        console.log(`[dry-run] adb reverse tcp:${httpPort}->tcp:${httpPort}`);
        console.log(`[dry-run] adb reverse tcp:${wsPort}->tcp:${wsPort}`);
        return;
    }

    try {
        await runCapture('adb', ['version']);
    } catch {
        throw new Error('ADB is not available in PATH. Install Android platform-tools or disable --usb.');
    }

    const adbDevices = await runCapture('adb', ['devices']);
    const devices = parseAdbDevicesOutput(adbDevices.stdout);

    if (devices.some((device) => device.status === 'unauthorized')) {
        throw new Error('ADB device is unauthorized. Accept USB debugging prompt on phone and retry.');
    }

    const readyDevices = devices.filter((device) => device.status === 'device');
    if (readyDevices.length === 0) {
        throw new Error('No authorized Android devices found for --usb mode.');
    }

    for (const device of readyDevices) {
        // eslint-disable-next-line no-await-in-loop
        await run('adb', ['-s', device.serial, 'reverse', `tcp:${httpPort}`, `tcp:${httpPort}`]);
        // eslint-disable-next-line no-await-in-loop
        await run('adb', ['-s', device.serial, 'reverse', `tcp:${wsPort}`, `tcp:${wsPort}`]);
    }

    console.log(`USB mode active for devices: ${readyDevices.map((device) => device.serial).join(', ')}`);
    console.log(`adb reverse configured: tcp:${httpPort}->tcp:${httpPort}, tcp:${wsPort}->tcp:${wsPort}`);
}

function printConnectionSummary({ hostIp, hostIpSource, httpPort, wsPort, usbMode }) {
    console.log(`Using Jump host IP: ${hostIp} (${hostIpSource})`);
    console.log(`Using Jump HTTP port: ${httpPort}`);
    console.log(`Using Jump WS port: ${wsPort}`);
    console.log('Using Laravel proxy port: 8080');

    if (usbMode) {
        console.log('Transport mode: USB (adb reverse)');
    } else {
        console.log('Transport mode: LAN');
    }

    console.log(`Open QR on this PC: http://127.0.0.1:${httpPort}/jump/qr`);
    console.log(`Phone connectivity test: http://${hostIp}:${httpPort}/jump/info`);
    console.log(`Phone download test:    http://${hostIp}:${httpPort}/jump/download`);
}

async function main() {
    const platform = parsed.platform;
    const { options } = parsed;

    if (!platform || !['android', 'ios'].includes(platform)) {
        console.error(usage());
        process.exit(1);
    }

    if (!['auto', 'manual'].includes(options.ipMode)) {
        throw new Error(`Invalid --ip-mode value: ${options.ipMode}. Use auto or manual.`);
    }

    if (options.usb && platform !== 'android') {
        throw new Error('--usb is only supported for android target.');
    }

    const laravelPort = 8080;
    const wsPort = parsePort(getConfig('LAB_JUMP_WS_PORT') || getConfig('NATIVEPHP_WS_PORT') || '8081') || 8081;

    const baseJumpPort = await selectJumpPort(options.httpPort);
    const { ip: hostIp, source: hostIpSource } = await resolveHostIp(options);

    await ensureDockerServices(baseJumpPort, wsPort);
    const jumpHttpPort = await selectContainerJumpPort(baseJumpPort, options.httpPort);
    await patchJumpRouterHostForwarding();
    await verifyJumpRouterHostForwarding();

    if (options.usb) {
        await setupUsbReverse(jumpHttpPort, wsPort);
    }

    if (jumpHttpPort !== baseJumpPort) {
        console.warn(
            `[WARN] Port ${baseJumpPort} is busy inside container. Using next free Jump port ${jumpHttpPort}.`
        );
    }

    printConnectionSummary({
        hostIp,
        hostIpSource,
        httpPort: jumpHttpPort,
        wsPort,
        usbMode: options.usb,
    });

    await run('docker', [
        'compose',
        'exec',
        '-T',
        'mobile-web',
        'php',
        'artisan',
        'native:jump',
        platform,
        `--ip=${hostIp}`,
        `--http-port=${jumpHttpPort}`,
        `--laravel-port=${laravelPort}`,
        '--no-interaction',
    ]);
}

main().catch((error) => {
    const message = String(error.message || '');
    if (message.includes('Command failed (docker compose')) {
        console.error('Docker compose command failed. Verify Docker is running and try: npm run lab:mobile:web:up');
    }

    console.error(message || String(error));
    process.exit(1);
});
