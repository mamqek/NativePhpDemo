# NativePHP vs React Native Checklist

Use this checklist after running `docs/testing-matrix.md`.

## 1) Native API Coverage

- Camera/photo/video meets production needs.
- Microphone workflow is reliable (start/pause/resume/stop).
- File access patterns required by product are possible.
- Secure storage behavior is acceptable.
- Browser/share/dialog/device/system actions work consistently.
- Premium dependencies (geolocation/push/scanner) have a clear plugin path.

## 2) Runtime Quality

- Offline queue survives lifecycle transitions.
- Guest-mode behavior does not block benchmark workflows.
- Network transitions do not corrupt local state.
- Media upload reliability is acceptable under unstable connectivity.
- Cold start and interaction latency are acceptable on target devices.
- Session restore behavior is acceptable when API is temporarily unreachable.

## 3) Developer Workflow (Windows-Centric)

- Android USB loop is fast enough for daily development.
- Jump workflow is stable for iOS feature validation.
- Packaging flow (Bifrost/macOS CI) is operational and documented.
- Root commands reduce copy/paste friction (`lab:up`, `lab:mobile:*`).

## 4) Team Velocity

- Laravel-first team can deliver both backend and mobile features quickly.
- Debugging ergonomics are acceptable for production incidents.
- Plugin integration overhead is acceptable.

## 5) Risk Profile

- Plugin ecosystem maturity is sufficient for roadmap features.
- Vendor lock-in risk is understood and acceptable.
- Fallback plan exists for unsupported premium APIs.
- Premium stubs provide clear extension points and non-crashing diagnostics.

## Decision Rubric (Suggested)

Score each category 1-5:

- API Coverage
- Runtime Quality
- Workflow Fit
- Delivery Speed
- Risk

Recommended decision thresholds:

- **22-25**: NativePHP is a strong fit.
- **17-21**: Mixed; continue pilot with mitigation plan.
- **<=16**: Prefer React Native for this product profile.
