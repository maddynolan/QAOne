# 20 Trial Licenses (2-Week Validity)

**Valid:** 14 days from generation  
**Expires:** 2026-02-18 (approximate, depends on generation date)

Distribute **one key per tester**. They enter it in **Desktop Settings → License** (or in the web app license flow if you expose it).

## Keys (generated offline; work with desktop offline validation and backend when deployed)

```
FLOWSTRAL-T656B-D9F7A-2602F-5C716
FLOWSTRAL-T6A06-36C2A-26025-08930
FLOWSTRAL-T055A-E0B1A-2602D-93866
FLOWSTRAL-T8F69-3EA1A-2602C-E805D
FLOWSTRAL-TEC6A-E8C2A-2602D-606EA
FLOWSTRAL-T2393-A3E3A-26020-161FC
FLOWSTRAL-TF558-EA75A-2602B-9BEB8
FLOWSTRAL-T5A95-4510A-26022-8CB6A
FLOWSTRAL-T96FD-1C3BA-2602C-66E81
FLOWSTRAL-T2601-2E04A-26028-06F6A
FLOWSTRAL-T7515-BB7FA-2602E-AA0C4
FLOWSTRAL-T0AF4-7535A-26021-0F883
FLOWSTRAL-T865A-F7F1A-2602D-C5803
FLOWSTRAL-T26B5-4597A-26020-18168
FLOWSTRAL-T32BC-1B51A-26023-7B8EE
FLOWSTRAL-T545C-E932A-26027-BFF19
FLOWSTRAL-T84DB-5399A-2602D-569BB
FLOWSTRAL-T9A44-DD7CA-2602B-9C487
FLOWSTRAL-T88FB-40CBA-2602E-D278B
FLOWSTRAL-T670C-FA93A-26020-8C4B8
```

## Regenerate more keys

- **Offline (no server):** `python scripts/generate_20_trial_licenses_offline.py`
- **From backend (after deploy):** `GET /api/license/generate-trials?count=20&days=14` or `python scripts/generate_trial_licenses.py https://api.yourdomain.com`

Do not commit this file if it contains production keys; it is for one-time distribution to your 20 testers.
