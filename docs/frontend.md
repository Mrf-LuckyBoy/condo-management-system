# Frontend migration

The React screens and CSS were ported from `condo-frontend/src`, preserving Thai labels, forms, dialogs, CSV preview/export and browser receipt printing. Electron, Vite bootstrap, and desktop packaging are excluded.

## Structure

- `app/layout.tsx`: document language, metadata, global stylesheet.
- `app/(dashboard)/layout.tsx`: shared navigation.
- `app/(dashboard)/page.tsx`: billing screen at `/`.
- `app/(dashboard)/management/page.tsx`: management screen at `/management`.
- `components/billing/`: original billing list, create/edit/payment dialogs.
- `components/management/`: original management screen and building/room dialogs.
- `components/ui/`: shared combobox and success dialog.
- `components/layout/`: Next Link navigation with active state.
- `lib/frontend/`: UI types, API functions, shared HTTP transport, and receipt helper.

## API connection

The frontend uses relative `/api/billings` and `/api/condo_management` URLs through `http.ts`. Requests use same-origin mode and credentials, and disable caching so changes appear after refresh. The shared error parser displays the API's message. Save, delete, meter updates, bill generation, and payment actions now affect the real database. CSV parsing and receipt rendering still run in the browser.

The wildcard CORS proxy has been removed. No cross-origin allow headers are emitted; use the frontend served by this Next.js app. Removing CORS does not add API authentication.
