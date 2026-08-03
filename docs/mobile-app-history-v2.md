# Mobile App Experience & Browser History V2

## Browser history

- The current document entry is retained as the club landing page.
- Opening the authenticated panel pushes a dashboard entry above the landing page.
- Every stable module, subview and drawer transition pushes an application history entry.
- Browser Back and Forward reconstruct the stored navigation chain and scroll position.
- Back from the first dashboard entry returns to the club landing page without ending the session.
- Explicit logout is the only action that resets the in-app history boundary.

## Mobile application shell

- Desktop layout remains unchanged above 760px.
- Mobile receives its own fixed app header, internal back action and five-slot bottom navigation.
- The existing sidebar remains the authoritative module list and is presented as an app-style bottom sheet.
- Existing buttons and module handlers are reused; no API or data-reading path is duplicated.
- KPI collections use horizontal snap paging.
- Data tables become labeled cards while preserving every cell and action.
- Forms, drawers, modals and safe areas are optimized for touch devices.

## Manual acceptance matrix

Test widths: 360, 390, 430, 640 and 760 pixels.

1. Landing → login → dashboard → module A → nested record → Back → module A → Back → dashboard → Back → landing.
2. Use Forward to reconstruct each state in the same order.
3. Open a drawer and press Back; the previous module state must be restored.
4. Navigate with bottom tabs and with the More sheet; both must create the same history entries.
5. Rotate the device with a module and drawer open.
6. Verify all table cells, action buttons, filters, forms and API-backed values remain present.
7. Resize above 760px and confirm the existing desktop shell is unchanged.
