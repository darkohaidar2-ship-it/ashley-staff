'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
  type Query,
  type DocumentData,
  type FirestoreError,
  type QuerySnapshot,
  type CollectionReference,
} from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to fetch a Firestore collection or query in real-time.
 * Handles nullable references/queries.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery
 * 
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: (CollectionReference<DocumentData> | Query<DocumentData>) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  
  const [data, setData] = useState<ResultItemType[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        snapshot.forEach((doc) => {
          results.push({ ...(doc.data() as T), id: doc.id });
        });
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (e: FirestoreError) => {
        console.error("Firestore Error (useCollection):", e);
        toast({
          variant: "destructive",
          title: "Error Reading Data",
          description: `Could not read collection. Please check your connection and permissions.`,
        });
        setError(e);
        setData(null);
        setIsLoading(false);
      });
      
      return () => unsubscribe();
      
  }, [memoizedTargetRefOrQuery]);
  
  return { data, isLoading, error };
}
