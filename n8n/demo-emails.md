# Demo emails

Two emails for showing the email automation. They match the demo data:

```powershell
pnpm --filter server db:seed:reset   # deletes ALL applications, then loads the demo data
```

Send them from a second email account to the Gmail inbox connected in n8n. Copy each subject and body as they are. The workflow checks the inbox every minute.

## 1. Updates the status

Acorn Labs, *Junior AI Automation Developer*: the card moves from **Applied** to **Interview**, and the email gets the `JobTracker/Updated` label.

**Subject:**

```text
Junior AI Automation Developer – zaproszenie na rozmowę
```

**Body:**

```text
Dzień dobry,

dziękujemy za przesłanie aplikacji na stanowisko Junior AI Automation Developer w Acorn Labs.
Pana profil bardzo nas zainteresował i chcielibyśmy zaprosić Pana na 30-minutową rozmowę online z zespołem automatyzacji.

Proszę o wybranie dogodnego terminu: czwartek o 10:00 lub piątek o 14:00.

Pozdrawiam,
Anna Nowak
Talent Acquisition
Acorn Labs Sp. z o.o.
```

## 2. Needs review

The email comes from Harbor Analytics but does not say which role it is about. The demo data has two applications there (*Frontend Developer* and *Backend Developer*), so the API changes nothing. Both cards stay in **Applied**, and the email gets the `JobTracker/Review` label.

**Subject:**

```text
Harbor Analytics – kolejny etap rekrutacji
```

**Body:**

```text
Cześć,

dziękujemy za zainteresowanie pracą w Harbor Analytics. Twoja aplikacja przeszła pierwszy etap
i chcielibyśmy zaprosić Cię na krótką rozmowę z zespołem.

Daj znać, czy pasuje Ci wtorek o 11:00.

Pozdrawiamy,
Zespół rekrutacji
Harbor Analytics
```

## Before sending

- To repeat the demo, run `db:seed:reset` again so Acorn Labs is back in **Applied**, then send the email again as a new message. Don't reply to the old one: the workflow drops quoted text, so a reply arrives almost empty.
- If an email lands in *Promotions* or *Social*, the workflow skips it. Move it to *Primary* and send it again.
