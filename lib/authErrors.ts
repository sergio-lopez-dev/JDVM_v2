// Traduce códigos de error de Firebase Auth a mensajes en español.
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/invalid-email': 'El email no es válido.',
    'auth/user-not-found': 'No existe una cuenta con ese email.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
    'auth/weak-password': 'La contraseña es demasiado débil (mínimo 6 caracteres).',
    'auth/too-many-requests': 'Demasiados intentos. Inténtalo más tarde.',
    'auth/popup-closed-by-user': 'Has cerrado la ventana de Google.',
    'auth/cancelled-popup-request': 'Operación cancelada.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu red.',
  }
  return map[code] ?? 'Algo ha ido mal. Inténtalo de nuevo.'
}
