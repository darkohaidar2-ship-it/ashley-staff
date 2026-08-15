// WebAuthn Biometric Helper for Fingerprint / Face ID / Touch ID

export function isBiometricSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof (window as any).PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials
  );
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// 1. Register Biometrics on Device
export async function registerBiometric(userId: string, userName: string): Promise<string> {
  if (!isBiometricSupported()) {
    throw new Error('?????? ??? ?????????? ??????? ?? ???????? ? Face ID ?????.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userIdBytes = new TextEncoder().encode(userId);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Ashley ERP',
        id: window.location.hostname,
      },
      user: {
        id: userIdBytes,
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Face ID, Touch ID, Fingerprint
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error('???????? ???????? ????? ?????.');
  }

  const credentialIdBase64 = bufferToBase64(credential.rawId);
  
  // Cache in localStorage for offline availability
  if (typeof window !== 'undefined') {
    localStorage.setItem('ashley_bio_' + userId, credentialIdBase64);
  }

  return credentialIdBase64;
}

// 2. Verify Biometrics on Check-In / Check-Out
export async function verifyBiometric(userId: string, savedCredentialId?: string | null): Promise<boolean> {
  if (!isBiometricSupported()) {
    throw new Error('پەنجەمۆر لەم ئامێرە کار ناکات یان پشتگیری نەکراوە.');
  }

  const credId = savedCredentialId || (typeof window !== 'undefined' ? localStorage.getItem('ashley_bio_' + userId) : null);

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const options: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: window.location.hostname,
    userVerification: 'required',
    timeout: 60000,
  };

  if (credId) {
    try {
      options.allowCredentials = [
        {
          id: base64ToBuffer(credId),
          type: 'public-key',
        },
      ];
    } catch (e) {
      console.warn('Error decoding credential ID, attempting discovery:', e);
    }
  }

  const assertion = await navigator.credentials.get({
    publicKey: options,
  });

  return !!assertion;
}
