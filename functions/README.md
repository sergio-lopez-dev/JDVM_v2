# Cloud Functions — JDVM v2

Funciones (2ª gen, región `europe-west1`):

| Función                | Tipo               | Qué hace                                                        |
| ---------------------- | ------------------ | --------------------------------------------------------------- |
| `inviteBarber`         | callable (onCall)  | Envía el email de invitación de barbero (Resend). Solo admin.   |
| `onAppointmentCreated` | Firestore onCreate | Push + aviso in-app al **barbero** y al **admin** (cita nueva). |
| `onAppointmentUpdated` | Firestore onUpdate | Al cancelar: avisa a **cliente + barbero + admin**.             |
| `sendReminders`        | cron (cada 5 min)  | Recordatorio al **cliente** 24 h y 1 h antes.                   |

Notificaciones in-app en `notifications_v2`; tokens FCM en `users_v2/{uid}/fcmTokens/{token}`.

## Requisitos previos (una vez)

1. **Plan Blaze** activo en el proyecto `jdvm-d82b6` (Functions + Cloud Scheduler + salida de red para Resend).
2. **Clave Web Push (VAPID)** — Firebase Console → ⚙ → Cloud Messaging → _Web Push certificates_ → _Generate key pair_. Cópiala en la **app** (`.env`):
   ```
   NUXT_PUBLIC_FCM_VAPID_KEY=BxxxxYourKeyxxxx
   ```
   (En Vercel: añade esa variable de entorno y redeploy.)
3. **Resend**: crea cuenta, **verifica tu dominio** de envío y crea una API key.
   - Define el remitente (usa tu dominio verificado):
     ```bash
     firebase functions:config  # (no usar; v2 usa params/secrets)
     firebase deploy --only functions   # te pedirá el valor de FROM_EMAIL la 1ª vez
     ```
   - Guarda la API key como **secret**:
     ```bash
     firebase functions:secrets:set RESEND_API_KEY
     ```
   - Param `FROM_EMAIL` (p. ej. `JDVM Hair Studio <hola@tudominio.com>`): se pide al
     desplegar, o ponlo en `functions/.env`:
     ```
     FROM_EMAIL=JDVM Hair Studio <hola@tudominio.com>
     ```

## Desplegar

```bash
cd functions && npm install && cd ..
nvm use
firebase use prod            # = jdvm-d82b6 (.firebaserc)
firebase deploy --only functions
```

## Notas

- El SW de mensajería vive en la app: `public/firebase-messaging-sw.js` (config pública embebida).
- iOS: el push web exige la PWA **añadida a la pantalla de inicio** (iOS 16.4+); el permiso
  se pide desde un gesto del usuario (botón "Activar notificaciones" en el perfil). No necesita APNs.
- El cron usa una consulta por rango sobre `startsAt` (índice de campo simple, ya existe).
