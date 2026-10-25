# Implementation Plan: Bulletproof Multi-Device Sync Engine

To resolve the "Zombie Data / Sync Loop" and ensure consistent data across devices, we will shift to a **Firestore-first architecture**.

## Phase 1: Firestore as Primary Source of Truth
- **Action**: Modify `src/lib/firebase.ts` to use `onSnapshot` for real-time listeners.
- **Change**: The secondary server sync API will be demoted to an "event notification" service only. The app will trust Firestore state as the authoritative version.

## Phase 2: Full Sync on Login
- **Action**: Update `onAuthStateChanged` in `src/App.tsx`.
- **Change**: On login, clear all `localStorage` caches related to workers and attendance.
- **Change**: Force an initial fetch from Firestore to populate the local state *before* enabling UI interactions.

## Phase 3: Tombstones & Conflict Resolution
- **Action**: Update data schema in `src/types/attendance.ts` (if needed) and logic in `syncUserDataToFirestore`.
- **Change**: When an item is deleted, set `isDeleted: true` and `updatedAt: serverTimestamp()`.
- **Change**: Add client-side logic to strictly ignore any local cached updates that possess a timestamp older than the server-confirmed `updatedAt` for that document/record.

## Phase 4: Reconciliation Logic
- **Action**: Update `src/App.tsx` and `firebase.ts` to perform a "Pull-First" merge.
- **Change**: Before any push operation, compare the local "last updated" reference with the server snapshot's `updatedAt`. If the local state is outdated, discard it and re-pull from Firestore.
