
'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  return setDoc(docRef, data, options).catch(error => {
    console.error("Firestore Error (setDoc):", error);
    toast({
      variant: "destructive",
      title: "Error Saving Data",
      description: `Could not save changes for document. Please try again.`,
    });
    throw error;
  });
}

export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  return addDoc(colRef, data)
    .catch(error => {
      console.error("Firestore Error (addDoc):", error);
      toast({
        variant: "destructive",
        title: "Error Adding Data",
        description: `Could not add new document. Please try again.`,
      });
      throw error;
    });
}

export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  return updateDoc(docRef, data)
    .catch(error => {
      console.error("Firestore Error (updateDoc):", error);
      toast({
        variant: "destructive",
        title: "Error Updating Data",
        description: `Could not update document. Please try again.`,
      });
      throw error;
    });
}

export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  return deleteDoc(docRef)
    .catch(error => {
      console.error("Firestore Error (deleteDoc):", error);
      toast({
        variant: "destructive",
        title: "Error Deleting Data",
        description: `Could not delete document. Please try again.`,
      });
      throw error;
    });
}
