# Testing Matrix

Use this matrix to benchmark NativePHP mobile behavior across Android USB and Jump runtime.

## Environments

- Android USB from Windows (`native:run android`)
- Android Jump (`native:jump`)
- iOS Jump (`native:jump`)

## Preconditions

- Backend API running at configured `VITE_API_BASE_URL`
- Demo user seeded (`user@example.com` / `secret1234`)
- Device connected to same network for Jump
- `State Viewer` is available and can inspect session/queue/cache/capture snapshots

## Core Scenarios

1. App starts in guest mode and all benchmark screens are still reachable offline.
2. Login stores token securely and updates session state to `verified`.
3. Relaunch offline with saved token and verify session restores as `restored_offline`.
4. Invalid/expired token returns 401 and app downgrades to guest mode (no hard lockout).
5. Create inspection offline/guest and verify local record + queued sync item.
6. Flush queue in guest mode and verify `blocked_reason=auth_required`.
7. Sign in, flush queue again, and verify queued items move to `sent`.
8. Open Capture Lab with no inspections and use quick-create CTA to create/select a local sample inspection.
9. Capture photo, switch tabs/routes, return to Capture Lab, and verify artifact still appears.
10. Restart app and verify native-path artifacts remain uploadable while web-picked artifacts show `needs_recapture`.
11. Verify upload button is disabled with inline reason when no inspection is selected.
12. Capture/upload photo attachment to selected inspection.
13. Record/upload audio attachment to selected inspection.
14. Pick/upload file attachment to selected inspection.
15. Run file move/copy probe with native paths (device-only check).
16. Toggle network while app is open and verify network transition log updates.
17. Background/foreground app and verify lifecycle log (`pause/resume`).
18. Trigger haptic/vibrate, dialogs, external browser, in-app browser, share sheet.
19. Run premium stub checks and confirm structured diagnostic output (no raw `{error}` objects).
20. Open `State Viewer`, verify auth/queue/cache/capture/telemetry/runtime snapshots, export JSON report.
21. Export benchmark telemetry JSON and confirm key metrics exist.

## Telemetry Metrics To Compare

- `app_cold_start_ms`
- `login_rtt_ms`
- `camera_capture_ms`
- `camera_capture_to_upload_ms`
- `audio_record_ms`
- `audio_record_to_upload_ms`
- `attachment_upload_ms`
- `queue_flush_latency_ms`
- `lifecycle_*` event markers
- `network_transition`

## Recording Template

For each scenario, capture:

- Platform: `android-usb | android-jump | ios-jump`
- Result: `pass | fail | flaky`
- Attempt count
- Error or observation
- Mean timing (if metric-based)

## Known Windows Constraint

- iOS local build/package is not available on Windows.
- iOS functional validation should be executed via Jump.
- Signed iOS packaging should be performed through Bifrost/macOS pipeline.

## Command Workflow Validation

1. `npm run lab:up` starts backend container and API is reachable.
2. `npm run lab:mobile:web` starts web preview container.
3. `npm run lab:mobile:doctor` reports PHP/ADB/SDK/7-Zip diagnostics.
4. `npm run lab:mobile:jump:android` starts Jump without interactive platform prompt.
5. `npm run lab:mobile:jump:ios` starts iOS Jump path without interactive prompt.
6. `npm run lab:mobile:run:android` runs doctor preflight and then starts Android build/run flow.
