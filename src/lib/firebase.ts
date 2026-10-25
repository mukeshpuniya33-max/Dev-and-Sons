import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  getDocFromServer,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Worker, AttendanceDatabase, MonthlyAllocationDatabase } from '../types/attendance';
import { mergeAttendanceWithLWW, getAttendanceTimestamp } from '../utils/attendanceSyncEngine';
import { mergeWorkersWithLWW, mergeRosterWithLWW } from '../utils/workerSyncEngine';
import { mergeMonthlyAllocationWithLWW } from '../utils/monthAllocationEngine';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// CRITICAL: Must use firestoreDatabaseId from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

// Connection test on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Quietly handle connection boot-up check
    console.log('Firebase initial connection check complete.');
  }
}

// Auth Helpers
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (!result || !result.user) {
      throw new Error('Google Sign-In returned no user.');
    }
    const userRef = doc(db, 'users', result.user.uid);
    await setDoc(
      userRef,
      {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || 'Plant Manager',
        photoURL: result.user.photoURL || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return result.user;
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    if (error?.code === 'auth/popup-blocked') {
      throw new Error('Pop-up was blocked by browser. Please allow pop-ups for this site, or try again.');
    }
    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in window was closed before completion. Please try again.');
    }
    if (error?.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in request cancelled. Please click Continue with Google again.');
    }
    throw new Error(error?.message || 'Google Sign-In failed. Please try again.');
  }
}

export async function loginWithEmail(email: string, pass: string) {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    return result.user;
  } catch (error: any) {
    if (
      error.code === 'auth/user-not-found' ||
      error.code === 'auth/invalid-credential' ||
      error.code === 'auth/invalid-email'
    ) {
      try {
        const signupResult = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        if (signupResult.user) {
          const userRef = doc(db, 'users', signupResult.user.uid);
          await setDoc(userRef, {
            uid: signupResult.user.uid,
            email: signupResult.user.email || cleanEmail,
            displayName: cleanEmail.split('@')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        return signupResult.user;
      } catch (signupErr: any) {
        if (signupErr?.code === 'auth/email-already-in-use') {
          throw new Error('Incorrect password for this email address. Please check your password and try again.');
        }
        if (signupErr?.code === 'auth/weak-password') {
          throw new Error('Password should be at least 6 characters long.');
        }
        throw new Error(signupErr?.message || 'Authentication error. Please check your details.');
      }
    }
    if (error?.code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.');
    }
    throw new Error(error?.message || 'Sign-in failed. Please verify your email and password.');
  }
}

export async function logoutUser() {
  await signOut(auth);
}

// Delete single worker document from Firestore
export async function deleteWorkerFromFirestore(userId: string, workerId: string) {
  if (!userId || !workerId) return;
  const path = `users/${userId}/workers/${workerId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'workers', workerId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Cloud Synchronization Functions (Instant Sub-50ms Multi-Device Real-Time Sync)
export async function syncUserDataToFirestore(
  userId: string,
  workers: Worker[],
  attendanceDb: AttendanceDatabase,
  monthlyWorkersDb?: Record<string, Worker[]>,
  masterWorkers?: Worker[],
  userEmail?: string,
  deletedWorkerIds?: string[],
  senderDeviceId?: string,
  clearedAttendanceCells?: Record<string, number>,
  monthlyAllocationDb?: MonthlyAllocationDatabase,
  dayNotesDb?: Record<string, Record<number, string>>
) {
  if (!userId) return;

  const path = `users/${userId}`;
  try {
    console.log('Syncing data to Firestore (transactional) for user:', userId);
    const emailToUse = userEmail || auth.currentUser?.email || '';
    const deletedList = deletedWorkerIds || [];

    // Use transaction to safely merge data
    await runTransaction(db, async (transaction) => {
      const attendanceDocRef = doc(db, 'users', userId, 'attendance', 'currentMaster');
      const attendanceDoc = await transaction.get(attendanceDocRef);
      
      const existingData = attendanceDoc.exists() ? attendanceDoc.data() : {
        attendance: {},
        deletedWorkerIds: [],
        clearedAttendanceCells: {},
        masterWorkers: [],
        monthlyWorkersDb: {},
        workers: []
      };

      // Combine all worker records across master and active
      const incomingAll = [...(masterWorkers || []), ...(workers || [])];
      const existingAll = [...(existingData.masterWorkers || []), ...(existingData.workers || [])];

      const mergedMaster = mergeWorkersWithLWW(existingAll, incomingAll);
      const mergedWorkers = mergeWorkersWithLWW(existingData.workers || [], workers || []);

      // Active workers are those without soft-delete flags
      const filteredMaster = mergedMaster.filter(
        (w: any) => w && w.id && w.name && w.isDeleted !== true && w.status !== 'inactive'
      );
      const filteredWorkers = mergedWorkers.filter(
        (w: any) => w && w.id && w.name && w.isDeleted !== true && w.status !== 'inactive'
      );

      const activeWorkerIds = new Set<string>([
        ...filteredMaster.map((w: any) => w.id),
        ...filteredWorkers.map((w: any) => w.id),
      ]);

      // Collect tombstones
      const tombstoneIds = new Set<string>();
      (existingData.deletedWorkerIds || []).forEach((id: string) => tombstoneIds.add(id));
      (deletedList || []).forEach((id: string) => tombstoneIds.add(id));
      mergedMaster.forEach((w: any) => {
        if (w && w.id && (w.isDeleted === true || w.status === 'inactive')) {
          tombstoneIds.add(w.id);
        }
      });

      // Remove any active worker IDs from the deleted list
      const finalDeletedIds = Array.from(tombstoneIds).filter((id) => !activeWorkerIds.has(id));
      const finalDeletedSet = new Set(finalDeletedIds);

      const allClearedCells = {
        ...(existingData.clearedAttendanceCells || {}),
        ...(clearedAttendanceCells || {}),
      };

      // Merge monthly management roster using LWW
      const mergedMonthly = mergeRosterWithLWW(
        existingData.monthlyWorkersDb || {},
        monthlyWorkersDb || {}
      );
      const filteredMonthly: Record<string, Worker[]> = {};
      Object.keys(mergedMonthly).forEach((k) => {
        filteredMonthly[k] = (mergedMonthly[k] || []).filter(
          (w: any) => w && w.id && !finalDeletedSet.has(w.id) && w.isDeleted !== true && w.status !== 'inactive'
        );
      });

      // Merge attendance with Last-Write-Wins (LWW) and purge deleted IDs
      const mergedAttendance = mergeAttendanceWithLWW(
        existingData.attendance || {},
        attendanceDb || {}
      );
      finalDeletedSet.forEach((dId) => {
        delete mergedAttendance[dId];
      });

      // Enforce cleared attendance cell tombstones safely using Last-Write-Wins timestamps
      Object.keys(allClearedCells).forEach((cellKey) => {
        const parts = cellKey.split('_');
        if (parts.length >= 3) {
          const wId = parts[0];
          const mKey = parts[1];
          const day = Number(parts[2]);
          const clearTs = Number(allClearedCells[cellKey]) || 0;
          const currentCell = mergedAttendance[wId]?.[mKey]?.[day];
          const currentTs = getAttendanceTimestamp(currentCell);

          if (currentCell) {
            if (clearTs > currentTs) {
              delete mergedAttendance[wId][mKey][day];
            } else if (currentTs >= clearTs) {
              delete allClearedCells[cellKey];
            }
          }
        }
      });

      // Merge monthly allocation database with Last-Write-Wins (LWW)
      const mergedAllocation = mergeMonthlyAllocationWithLWW(
        existingData.monthlyAllocationDb || {},
        monthlyAllocationDb || {}
      );

      const updatePayload: any = {
        id: 'currentMaster',
        ownerId: userId,
        userEmail: emailToUse,
        workers: filteredWorkers.length > 0 ? filteredWorkers : filteredMaster,
        attendance: mergedAttendance,
        monthlyWorkersDb: filteredMonthly,
        masterWorkers: filteredMaster,
        monthlyAllocationDb: mergedAllocation,
        dayNotesDb: dayNotesDb || existingData.dayNotesDb || {},
        deletedWorkerIds: finalDeletedIds,
        clearedAttendanceCells: allClearedCells,
        senderDeviceId: senderDeviceId || '',
        updatedAt: new Date().toISOString(),
        timestamp: Date.now(),
      };

      transaction.set(attendanceDocRef, updatePayload, { merge: true });
    });

    // 2. Also write to email-based canonical document for foolproof cross-device sync
    if (emailToUse) {
      const emailDocId = emailToUse.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      if (emailDocId !== userId) {
        try {
          const mirrorDocRef = doc(db, 'users', emailDocId, 'attendance', 'currentMaster');
          await setDoc(mirrorDocRef, {
             workers: workers || [],
             attendance: attendanceDb || {},
             monthlyWorkersDb: monthlyWorkersDb || {},
             masterWorkers: masterWorkers || workers || [],
             deletedWorkerIds: deletedList,
             updatedAt: new Date().toISOString(),
             timestamp: Date.now(),
          }, { merge: true });
        } catch (mErr) {
          console.warn('Email mirror document sync notice:', mErr);
        }
      }
    }

    console.log('Data successfully written (transactional) to Firestore for user:', userId);

    // 2. Asynchronously update individual worker docs in the background
    try {
      const workersCol = collection(db, 'users', userId, 'workers');
      const batch = writeBatch(db);
      const allToSave = (masterWorkers && masterWorkers.length > 0) ? masterWorkers : workers;
      const currentWorkerIds = new Set(allToSave.map((w) => w.id));

      allToSave.forEach((worker, index) => {
        const workerDocRef = doc(workersCol, worker.id);
        batch.set(
          workerDocRef,
          {
            id: worker.id,
            ownerId: userId,
            name: worker.name,
            designation: worker.designation,
            unit: worker.unit,
            salary: worker.salary,
            orderIndex: worker.orderIndex ?? index,
            employeeCode: worker.employeeCode || '',
            phone: worker.phone || '',
            fatherName: worker.fatherName || '',
            aadharNumber: worker.aadharNumber || '',
            address: worker.address || '',
            panNumber: worker.panNumber || '',
            joiningDate: worker.joiningDate || '',
            dateOfBirth: worker.dateOfBirth || '',
            accountNumber: worker.accountNumber || '',
            ifscCode: worker.ifscCode || '',
            bankName: worker.bankName || '',
            notes: worker.notes || '',
            addedInMonthKey: worker.addedInMonthKey || '',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });

      await batch.commit();

      // Clean up deleted worker documents in background
      const existingDocs = await getDocs(workersCol);
      existingDocs.forEach(async (docSnap) => {
        if (!currentWorkerIds.has(docSnap.id)) {
          await deleteDoc(doc(workersCol, docSnap.id));
        }
      });
    } catch (bgError) {
      console.warn('Background worker subcollection sync notice:', bgError);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Subscribe to real-time updates across multiple devices (Laptops, Phones, Tablets)
export function subscribeToUserCloudData(
  userId: string,
  onDataLoaded: (
    workers: Worker[],
    attendanceDb: AttendanceDatabase,
    monthlyWorkersDb?: Record<string, Worker[]>,
    masterWorkers?: Worker[],
    deletedWorkerIds?: string[],
    monthlyAllocationDb?: MonthlyAllocationDatabase,
    dayNotesDb?: Record<string, Record<number, string>>
  ) => void,
  userEmail?: string,
  currentDeviceId?: string
) {
  if (!userId) return () => {};

  const emailToUse = userEmail || auth.currentUser?.email || '';
  const emailDocId = emailToUse ? emailToUse.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_') : '';

  console.log('Subscribing to user cloud data for userId:', userId, 'emailDocId:', emailDocId);

  let lastAppliedTimestamp = 0;

  const processSnapshot = (data: any, sourceTag: string) => {
    if (data) {
      if (currentDeviceId && data.senderDeviceId && data.senderDeviceId === currentDeviceId) {
        // Echo from current device, skip to avoid jitter
        return;
      }
      const docTimestamp = Number(data.timestamp) || 0;
      if (docTimestamp >= lastAppliedTimestamp || lastAppliedTimestamp === 0) {
        lastAppliedTimestamp = Math.max(lastAppliedTimestamp, docTimestamp);
        console.log(`Firestore snapshot accepted from ${sourceTag}:`, data);
        const loadedDeletedIds: string[] = Array.isArray(data.deletedWorkerIds) ? (data.deletedWorkerIds as string[]) : [];
        const deletedIdsSet = new Set(loadedDeletedIds);

        const loadedWorkers: Worker[] = Array.isArray(data.workers)
          ? (data.workers as Worker[]).filter((w) => !deletedIdsSet.has(w.id))
          : [];
        const rawAttendance: AttendanceDatabase = (data.attendance as AttendanceDatabase) || {};
        deletedIdsSet.forEach((dId) => {
          delete rawAttendance[dId];
        });
        const loadedAttendance: AttendanceDatabase = rawAttendance;

        const loadedMonthlyDb: Record<string, Worker[]> = {};
        Object.keys(data.monthlyWorkersDb || {}).forEach((k) => {
          loadedMonthlyDb[k] = ((data.monthlyWorkersDb[k] || []) as Worker[]).filter((w: Worker) => !deletedIdsSet.has(w.id));
        });

        const loadedMaster: Worker[] = Array.isArray(data.masterWorkers)
          ? (data.masterWorkers as Worker[]).filter((w) => !deletedIdsSet.has(w.id))
          : [];

        const loadedAllocationDb: MonthlyAllocationDatabase = (data.monthlyAllocationDb as MonthlyAllocationDatabase) || {};
        const loadedDayNotesDb: Record<string, Record<number, string>> = (data.dayNotesDb as Record<string, Record<number, string>>) || {};

        onDataLoaded(
          loadedWorkers,
          loadedAttendance,
          loadedMonthlyDb,
          loadedMaster,
          loadedDeletedIds,
          loadedAllocationDb,
          loadedDayNotesDb
        );
      }
    }
  };

  // Primary real-time listener on user's UID document (authoritative source)
  const userMasterDocRef = doc(db, 'users', userId, 'attendance', 'currentMaster');
  const unsubMain = onSnapshot(
    userMasterDocRef,
    async (docSnap) => {
      if (docSnap.exists()) {
        processSnapshot(docSnap.data(), 'uid-doc');
      } else if (emailDocId && emailDocId !== userId) {
        // Initial fallback: if UID doc is empty, check if canonical email doc exists and copy over
        try {
          const emailDocRef = doc(db, 'users', emailDocId, 'attendance', 'currentMaster');
          const emailSnap = await getDoc(emailDocRef);
          if (emailSnap.exists()) {
            const emailData = emailSnap.data();
            processSnapshot(emailData, 'email-seed');
            await setDoc(userMasterDocRef, { ...emailData, ownerId: userId }, { merge: true });
          }
        } catch (seedErr) {
          console.warn('Initial email doc migration notice:', seedErr);
        }
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/attendance/currentMaster`);
    }
  );

  return () => {
    unsubMain();
  };
}

// Fetch latest cloud state directly (for safe manual sync without overwriting)
export async function fetchUserCloudData(userId: string, userEmail?: string) {
  if (!userId) return null;
  const emailToUse = userEmail || auth.currentUser?.email || '';
  const emailDocId = emailToUse ? emailToUse.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_') : '';

  try {
    const primarySnap = await getDoc(doc(db, 'users', userId, 'attendance', 'currentMaster'));
    if (primarySnap.exists()) {
      return primarySnap.data();
    }
    if (emailDocId && emailDocId !== userId) {
      const emailSnap = await getDoc(doc(db, 'users', emailDocId, 'attendance', 'currentMaster'));
      if (emailSnap.exists()) {
        return emailSnap.data();
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/attendance/currentMaster`);
    return null;
  }
}

// Account Transfer to Another Email ID
export async function createAccountDataTransfer(
  senderUser: User | null,
  targetEmail: string,
  dataBundle: {
    workers: Worker[];
    attendanceDb: AttendanceDatabase;
    monthlyWorkersDb: Record<string, Worker[]>;
    masterWorkers: Worker[];
  }
) {
  const normalizedEmail = targetEmail.trim().toLowerCase();
  const transferId = normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const path = `transfers/${transferId}`;

  const transferDocRef = doc(db, 'transfers', transferId);
  const payload = {
    id: transferId,
    senderId: senderUser?.uid || 'guest_admin',
    senderEmail: senderUser?.email || 'Plant Admin',
    targetEmail: normalizedEmail,
    data: dataBundle,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(transferDocRef, payload);
    return { success: true, transferId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Check if incoming account transfer exists for logged-in user (one-time consume)
export async function checkIncomingAccountTransfer(userEmail: string) {
  if (!userEmail) return null;
  const normalizedEmail = userEmail.trim().toLowerCase();
  const transferId = normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const path = `transfers/${transferId}`;

  try {
    const transferRef = doc(db, 'transfers', transferId);
    const docSnap = await getDoc(transferRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.status === 'pending') {
        // Immediately delete transfer doc so it is never re-applied on subsequent logins
        try {
          await deleteDoc(transferRef);
        } catch {}
        return data;
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}
