
'use client';
import { useContext } from 'react';
import {
  DocumentReference,
  Query,
  collection,
  doc,
} from 'firebase/firestore';
import { FirebaseContext } from './provider';

// This file can be kept for future use, but the hooks are not actively used in the offline version.
// Or it can be deleted. For now, we will leave it but ensure it doesn't cause errors.

export function useFirebaseApp() {
  const firebase = useContext(FirebaseContext);
  return firebase?.firebaseApp;
}

export function useFirestore() {
  const firebase = useContext(FirebaseContext);
  return firebase?.firestore;
}

export function useAuth() {
  const firebase = useContext(FirebaseContext);
  return firebase?.auth;
}

export function useStorage() {
  const firebase = useContext(FirebaseContext);
  return firebase?.storage;
}

export function useUser() {
  return { user: null, loading: true, error: null };
}

export function useDoc<T>(ref: DocumentReference<T>) {
  return { data: undefined, loading: true, error: undefined };
}

export function useCollection<T>(query: Query<T> | null) {
  return { data: undefined, loading: true, error: undefined };
}
