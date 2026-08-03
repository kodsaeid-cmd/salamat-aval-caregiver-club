# Mobile Bottom Navigation V4

## Root cause
Two independent runtimes were rebuilding and handling the same `#salamatMobileBottomNav`. One runtime wrote `data-nav-index` buttons while the other capture handler expected `data-mobile-route`, stopped propagation, and returned without navigation. This created a deterministic no-op whenever the legacy schema owned the visible buttons.

## Fix
- A single controller claims the navigation node by cloning it without legacy listeners.
- The controller supports both legacy and current button schemas during takeover.
- Only one capture-phase click path remains authoritative.
- Existing authorized sidebar buttons remain the data and permission source of truth.
- Admin routes use a direct `renderModule` fallback when a legacy handler does not render.
- Mobile branding uses Eden Green and Red Alert accents.

## Acceptance
- Every primary bottom tab changes the actual module.
- `کاربران و دسترسی‌ها` opens the real admin page.
- `بیشتر` opens the complete authorized module list.
- No invisible backdrop, scroll lock, or inert state blocks taps.
- Desktop behavior remains unchanged.