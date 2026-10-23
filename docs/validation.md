# Data validation against official sources

Last full validation: **2026-10-14**. Every data point in the model with a deadline, limit, cost or effective date is listed here with its official source. When a data point changes, the JSON in `model/` and this table are corrected on the same day.

Rows describe the model's content and are therefore in Spanish; the table frame, statuses and this text are in English.

Status: `OK` confirmed at the source · `CORRECTED` the model said otherwise and was fixed · `NO SOURCE` no official page confirms it (practice figure, kept with this mark).

## Apple

| # | Data point (es) | Used in | Status | Official source |
| --- | --- | --- | --- | --- |
| 1 | Inscripción de organización: requiere D-U-N-S, entidad legal, Account Holder con autoridad legal | S1, A03 | OK | https://developer.apple.com/programs/enroll/ |
| 2 | Membresía Apple Developer Program: 99 USD/año, renovación anual | R01 | OK | https://developer.apple.com/support/compare-memberships/ |
| 3 | Si la membresía vence, las apps dejan de estar en App Store y TestFlight deja de funcionar | R01 `if_expired` | OK | https://developer.apple.com/support/renewal/ |
| 4 | Tiempo de D-U-N-S: Apple indica hasta 5 días hábiles para asignar y hasta 2 adicionales para que Apple lo reciba | S0 | OK | https://developer.apple.com/support/D-U-N-S/ |
| 5 | Roles: Account Holder (uno), Admin, App Manager, Developer, Marketing, Finance, Customer Support | A03, A05 | OK | https://developer.apple.com/help/account/manage-your-team/roles/ |
| 6 | Certificado Apple Distribution: vigencia 1 año; **uno por tipo de distribución por equipo**; solo Account Holder o Admin lo crean | C06, S6.2, R02 | CORRECTED (previously "máximo 3 por equipo") | https://developer.apple.com/help/account/certificates/certificates-overview/ |
| 7 | Perfiles de aprovisionamiento: vigencia 1 año, uno por target y tipo | C08, T01–T07, R03 | OK | https://developer.apple.com/help/account/provisioning-profiles/ |
| 8 | Clave APNs (.p8): no vence; se descarga una sola vez; máximo 2 activas por equipo | C10, S7.1 | OK | https://developer.apple.com/help/account/keys/create-a-private-key/ |
| 9 | Claves de App Store Connect API: de equipo (Admin, App Manager, Developer, Marketing, Finance, Customer Support) o individuales; se descargan una sola vez | C12 | OK | https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/ |
| 10 | TestFlight: 100 testers internos, 10 000 externos, builds válidos 90 días | S10, S11, R20 | OK | https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/ |
| 11 | Pruebas externas requieren Beta App Review del primer build (y de cambios significativos) | S11.2 | OK | https://developer.apple.com/help/app-store-connect/test-a-beta-version/overview-of-external-testing/ |
| 12 | Guía 3.2.1: apps que facilitan transacciones financieras deben ser publicadas por la propia entidad financiera | S1, decisión del titular | OK | https://developer.apple.com/app-store/review/guidelines/#business |
| 13 | Guía 2.1(a): cuenta demo o credenciales para que el revisor pruebe la app | S12, S14 | OK | https://developer.apple.com/app-store/review/guidelines/#app-completeness |
| 14 | Desde 2026-04-28 los envíos deben compilarse con Xcode 26 y el SDK de iOS 26 | S8, R22 | OK | https://developer.apple.com/news/upcoming-requirements/ |
| 15 | Desde 2026-09-09 el deployment target mínimo aceptado es iOS 13 | S8 | OK | https://developer.apple.com/news/upcoming-requirements/ |
| 16 | Desde 2026-01-31 todas las apps deben tener el nuevo cuestionario de clasificación por edad | S12 | OK | https://developer.apple.com/news/upcoming-requirements/ |
| 17 | Certificado intermedio WWDR G6 vence 2030-02-20 | C05 | OK | https://developer.apple.com/support/expiration/ |
| 18 | Certificado de Apple Pay (Payment Processing): vigencia 25 meses | C14, R06 | OK | https://developer.apple.com/help/account/certificates/create-apple-pay-payment-processing-certificates/ |
| 19 | Tiempo de revisión de App Store: Apple no publica un SLA; "90 % en 24 horas" | S14 tiempos | NO SOURCE (practice figure, removed from the official page) | https://developer.apple.com/app-store/review/ |

## Google

| # | Data point (es) | Used in | Status | Official source |
| --- | --- | --- | --- | --- |
| 20 | Cuenta de desarrollador de organización: cargo único de 25 USD; requiere D-U-N-S, correo y teléfono de contacto de la organización, sitio web | S2, A04 | OK | https://support.google.com/googleplay/android-developer/answer/6112435 |
| 21 | El nombre legal y dirección del perfil de pagos deben coincidir con el registro D&B | S2 | OK | https://support.google.com/googleplay/android-developer/answer/13628312 |
| 22 | Verificación de identidad de desarrollador para publicar en cuentas nuevas; plazo variable | S2 | OK | https://support.google.com/googleplay/android-developer/answer/10788890 |
| 23 | Tiempo de D-U-N-S para Google: hasta 30 días si se solicita a D&B por la vía de Google | S0 | OK | https://support.google.com/googleplay/android-developer/answer/13628312 |
| 24 | Play App Signing: Google custodia la app signing key; el desarrollador firma con upload key; la elección es antes del primer release y no se revierte en apps nuevas | V3, C19, C20 | OK | https://support.google.com/googleplay/android-developer/answer/9842756 |
| 25 | Upload key: validez recomendada ≥ 25 años; debe vencer después de 2033-10-22 para que Play la acepte | C20 | CORRECTED (deadline added) | https://developer.android.com/studio/publish/app-signing |
| 26 | Upload key perdida o comprometida: se solicita reemplazo a Google desde Play Console | R14 | OK | https://support.google.com/googleplay/android-developer/answer/9842756 |
| 27 | Pistas de prueba: interna hasta 100 testers; cerrada por listas de correo hasta 2 000 (o grupos de Google); abierta sin límite | S10, S11 | OK | https://support.google.com/googleplay/android-developer/answer/9845334 |
| 28 | Requisito de 12 testers durante 14 días en prueba cerrada aplica solo a cuentas personales creadas desde 2023-11-13, no a organizaciones | S11 nota | OK | https://support.google.com/googleplay/android-developer/answer/14151465 |
| 29 | Target API: apps nuevas y actualizaciones deben apuntar a API 36 desde 2026-08-31; extensión hasta 2026-11-01 | S8, R21 | OK | https://support.google.com/googleplay/android-developer/answer/11926878 |
| 30 | Sign-in details para revisores: hasta 5 juegos de credenciales en App content | S12, S14 | OK | https://support.google.com/googleplay/android-developer/answer/9859455 |
| 31 | Declaración de funciones financieras (Financial features) obligatoria para toda app publicada en Play, aunque no ofrezca funciones financieras; exentos los servicios del sistema y las apps privadas | S12.7 | CORRECTED (2026-10-22: previously "obligatoria para apps de banca, préstamos y pagos", used in S12.4; source moved from answer/13516546) | https://support.google.com/googleplay/android-developer/answer/13849271 |
| 32 | Verificación de desarrolladores Android fuera de Play: obligatoria desde 2026-09 en Brasil, Indonesia, Singapur y Tailandia; global en 2027 | V13 nota | OK | https://developer.android.com/developer-verification |
| 33 | Tiempo de revisión de Google Play: "normalmente hasta 7 días, puede ser más" | S14 tiempos | OK | https://support.google.com/googleplay/android-developer/answer/9859751 |

## General and practice-based

| # | Data point (es) | Status | Note |
| --- | --- | --- | --- |
| 34 | Tiempo total de la etapa "Cuentas y acuerdos": 3 a 8 semanas | NO SOURCE | Estimate: D-U-N-S + enrollment + verification + internal approvals |
| 35 | Tiempo de preparación de ficha y capturas: 1 a 2 semanas | NO SOURCE | Practice estimate |
| 36 | Rotación de claves de API de CI y tokens de servicio cada 6 a 12 meses | NO SOURCE | Common internal policy; not a store requirement |

Partial validation 2026-10-22: row 31.

## How to update

1. Run the `/validate-requirements` skill or the monthly `.github/workflows/check-sources.yml` action.
2. For each row, open the source and compare it with the data point. If it changed: fix the corresponding JSON, set the status to `CORRECTED` with the date, and record the correction in `docs/decisions.md`.
3. Update the "Last full validation" date.
4. Run `python3 generator/check_sources.py --update` and commit `generator/sources_hash.json`.

Pages that announce changes in advance and are worth checking first:

- Apple: https://developer.apple.com/news/upcoming-requirements/
- Google: https://support.google.com/googleplay/android-developer/answer/11926878 and https://android-developers.googleblog.com/
