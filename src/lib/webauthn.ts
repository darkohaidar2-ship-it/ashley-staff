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
    throw new Error('مۆبایل یان وێبگەڕەکەت پشتگیری لە پەنجەمۆر و Face ID ناکات.');
  }

  // Check if device is already registered to someone else
  if (typeof window !== 'undefined') {
    const existingOwner = localStorage.getItem('ashley_bio_registered_user');
    if (existingOwner && existingOwner !== userId) {
      throw new Error(`⚠️ ئەم مۆبایلە پێشتر بە ناوی کارمەندێکی تر تۆمارکراوە! ناکرێت یەک مۆبایل بۆ چەند کەس بەکاربێت.`);
    }
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userIdBytes = new TextEncoder().encode(userId);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Ashley ERP Staff System',
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
        authenticatorAttachment: 'platform', // Enforce on-device hardware biometrics
        userVerification: 'required',
        residentKey: 'required',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error('نەتوانرا پەنجەمۆر تۆمار بکرێت.');
  }

  const credentialIdBase64 = bufferToBase64(credential.rawId);
  
  // Cache in localStorage for device binding
  if (typeof window !== 'undefined') {
    localStorage.setItem('ashley_bio_' + userId, credentialIdBase64);
    localStorage.setItem('ashley_bio_registered_user', userId);
  }

  return credentialIdBase64;
}

// 2. Strict Biometric Verification on Check-In / Check-Out
export async function verifyBiometric(userId: string, savedCredentialId?: string | null): Promise<boolean> {
  if (!isBiometricSupported()) {
    throw new Error('پەنجەمۆر لەم ئامێرە کار ناکات یان پشتگیری نەکراوە.');
  }

  const credId = savedCredentialId || (typeof window !== 'undefined' ? localStorage.getItem('ashley_bio_' + userId) : null);

  if (!credId) {
    throw new Error('⚠️ ئەم کارمەندە هێشتا پەنجەمۆری لەم مۆبایلەدا نەبەستووەتەوە! سەرەتا پەنجەمۆری ئەم مۆبایلە ببەستەوە.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const options: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: window.location.hostname,
    userVerification: 'required',
    allowCredentials: [
      {
        id: base64ToBuffer(credId),
        type: 'public-key',
        transports: ['internal'],
      },
    ],
    timeout: 60000,
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: options,
    });
    return !!assertion;
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      throw new Error('❌ پەنجەمۆر نەناسرا یان ڕەتکرایەوە! تکایە تەنها خاوەنی هەژمارەکە پەنجەی خۆی دابنێت.');
    }
    throw err;
  }
}
