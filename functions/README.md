# Cloud Functions — JDVM v2

Funciones de **1ª generación** (región `europe-west1`). Se usa 1ª gen — como las
funciones de la app v1 ya desplegadas — para NO requerir los bindings de IAM de
Eventarc/Run de la 2ª gen (que necesitan rol Owner del proyecto).

| Función                | Tipo               | Qué hace                                                            | Estado                      |
| ---------------------- | ------------------ | ------------------------------------------------------------------- | --------------------------- |
| `onAppointmentCreated` | Firestore onCreate | Push + aviso in-app al **barbero** y al **admin** (cita nueva).     | ✅ desplegada               |
| `onAppointmentUpdated` | Firestore onUpdate | Al cancelar: **push** a barbero + admin (in-app ya lo crea la app). | ✅ desplegada               |
| `sendReminders`        | cron (cada 5 min)  | Recordatorio al **cliente** 24 h y 1 h antes.                       | ✅ desplegada               |
| `inviteBarber`         | callable (onCall)  | Email de invitación de barbero (Resend). Solo admin.                | ⏳ pendiente API key Resend |

Notificaciones in-app en `notifications_v2`; tokens FCM en `users_v2/{uid}/fcmTokens/{token}`.

## Estado actual

- 3 funciones desplegadas en `jdvm-d82b6` (runtime nodejs20, 1ª gen).
- Secreto `RESEND_API_KEY` creado con **placeholder** (`REPLACE_ME_with_real_resend_key`).
- `inviteBarber` **no desplegada**: necesita la API key real de Resend (abajo).
- `functions/.env` (no versionado) con `FROM_EMAIL`.

## Pendiente para activar el EMAIL de invitación (`inviteBarber`)

1. **Resend**: crea cuenta, **verifica tu dominio** de envío y crea una API key.
2. Pon el remitente real en `functions/.env`:
   ```
   FROM_EMAIL=JDVM Hair Studio <hola@tudominio.com>
   ```
3. Sustituye el secreto placeholder por la API key real y despliega la función:
   ```bash
   printf 'TU_API_KEY_RESEND' | npx firebase-tools@latest functions:secrets:set RESEND_API_KEY --project jdvm-d82b6 --data-file -
   npx firebase-tools@latest deploy --project jdvm-d82b6 --only functions:inviteBarber
   ```

## Pendiente para activar el PUSH (app)

- **Clave Web Push (VAPID)** — Firebase Console → ⚙ → Cloud Messaging → _Web Push
  certificates_ → _Generate key pair_ (copia la **pública**). En `.env` de la app y en Vercel:
  ```
  NUXT_PUBLIC_FCM_VAPID_KEY=Bxxxx...
  ```
  Redeploy de Vercel. Sin esto, el botón "Activar notificaciones" avisa de que falta la clave.

## Re-desplegar (siempre por nombre, NO toca la v1)

> ⚠️ `jdvm-d82b6` también tiene las funciones de la app **v1**
> (`onWriteAppointmentComputeDatetime`, `sendAppointmentReminders`,
> `sendFixedAppointmentRemindersNoNextDatetime`). **Nunca** `firebase deploy --only
functions` a secas (borraría esas). Despliega SOLO las de v2 por nombre:

```bash
cd functions && npm install && cd ..
npx firebase-tools@latest deploy --project jdvm-d82b6 \
  --only "functions:onAppointmentCreated,functions:onAppointmentUpdated,functions:sendReminders"
```

(Se usa `npx firebase-tools@latest` porque la CLI global del equipo es antigua.)
Si sale «functions found in your project but do not exist in your local source…
proceed with deletion?» responde **NO** (son las de la v1).

## Notas

- SW de mensajería: `public/firebase-messaging-sw.js` (config pública embebida).
- iOS: push web exige la PWA **añadida a la pantalla de inicio** (iOS 16.4+); el permiso
  se pide desde un gesto del usuario ("Activar notificaciones" en el perfil). No necesita APNs.
- El cron usa una consulta por rango sobre `startsAt` (índice de campo simple, ya existe).
