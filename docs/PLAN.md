# Legacy Plumbing Group — site + operations plan

Written 2026-10-07. Goal: a trustworthy, fast website plus a near-zero-cost ops stack so leads,
scheduling, reminders, reviews and invoicing run themselves for a two-partner plumbing company
(Nashville / Middle TN on 615-524-9201, Knoxville / East TN on 865-308-0794).

Design rule for everything below: prefer free, hosted, no-code tools the partners can run from
their phones. Code only where nothing else fits. Every tool here has a clear "upgrade when" line.

Note: the job photos show a crew of several techs in "LP Plumbing" shirts, not just the two
partners. The free stack below still works as long as the *partners* own the calendar and the
phone. The moment techs need their own schedules or dispatch, jump straight to Jobber (§6).

## 1. Website (this repo)

Plain HTML + one CSS file, no build step. Hosted on Netlify (already where the old site lives;
free tier, forms included). Pages: `/` (everything), `/book.html` (Cal.com embed), `/thank-you`, `/404`.

How jobs come in (approved 2026-10-07):
1. **Request form → callback** is the primary path. Fits emergency work and how plumbers operate.
2. **Self-service booking for estimates only** via Cal.com on `/book`. Emergencies are told to call.

Placeholders to fill before launch (grep `REPLACE_`):

| Placeholder | Where to get it |
|---|---|
| `REPLACE_LICENSE` | TN contractor/plumber licence number (footer) |
| `REPLACE_GOOGLE_REVIEW_URL` | Google Business Profile → "Ask for reviews" short link |
| `REPLACE_CAL_LINK` | Cal.com username/event slug, e.g. `legacy-plumbing/estimate` |

## 2. Lead intake (free)

**Netlify Forms** catches every request (100/mo free; the next tier is $19/mo at 1,000/mo).
- Spam: honeypot field is in the form; Netlify's Akismet filter is on by default.
- **Notify both partners instantly**: Site settings → Forms → Form notifications → add an
  email notification per partner. (Can also be done from the CLI once logged in:
  `netlify api createHookBySiteId`.)
- **Texts without paying for anything**: each partner adds a Gmail filter
  `from:(formresponses@netlify.com)` → forward to their carrier's email-to-SMS address
  (Verizon `number@vtext.com`, AT&T `number@txt.att.net`, T-Mobile `number@tmomail.net`).
  Crude but free and reliable. Upgrade when: they want a shared inbox or two-way texting →
  OpenPhone ($15/user/mo) or Jobber (see §6).
- Every submission is also kept in the Netlify dashboard (searchable, CSV export). That is
  the "CRM" until there is a reason for a real one.

## 3. Booking + calendar (free, open source)

**Cal.com** (open source, free plan: 1 user, unlimited bookings, Google Calendar sync,
email + SMS reminders, workflows, HTML embed). Setup:
1. One Cal.com account for the business, connected to ONE shared Google Calendar that both
   partners have on their phones. (Two Cal.com users would need the Teams plan, ~$15/user/mo.
   Not worth it until someone other than the partners is being scheduled.)
2. Event type **"Free estimate — 45 min"**: availability Mon–Fri 8–5 (whatever they want),
   30-min buffer, 2-hour minimum notice, booking questions: *address*, *what are we looking at*,
   *photos (optional)*, phone required.
3. Workflows (free): SMS + email reminder 24 h before; SMS reminder 1 h before;
   **"after event ends" email with the Google review link** (this is the review automation).
4. Paste the `username/event-slug` into the site as `REPLACE_CAL_LINK`.
5. Put the same booking link in the Google Business Profile "Appointment" field and in the
   Instagram/Facebook bios.

Upgrade when: the crew grows past the two partners, or they want dispatch/route planning →
Jobber (§6) and drop Cal.com.

## 4. Google Business Profile (free, the biggest lead source)

Most plumbing calls start at "plumber near me". This matters more than the website.
1. Claim/verify the profile as a **service-area business** (no public address needed) covering
   Nashville + surrounding counties. A second profile for the Knoxville market needs a real
   address/office there; if there isn't one, list Knox County in the service area of the one
   profile.
2. Fill: services (copy the six on the site), 24/7 emergency hours, website, booking link,
   phone, and upload the 20 project photos from `assets/` (GBP rewards photo volume).
3. Grab the **review short link** → `REPLACE_GOOGLE_REVIEW_URL`.
4. Turn on **GBP messaging** so "chat" taps go to the partners' phones.
5. Post one photo a week from the job (GBP "Updates"). Two minutes, measurable ranking lift.

## 5. Phone (free to start)

They advertise 24/7 priority calls, so missed calls are lost money.
- **Google Voice (free)**: one business number that rings both partners, voicemail transcribed
  to email, spam screening. Put it on the site later instead of the two personal numbers if they
  want one public number.
- Upgrade when: they want auto "sorry we missed you, text us here" replies or call recording →
  OpenPhone ($15/user/mo, has missed-call auto-text).

## 6. Estimates, invoices, payments

- **Square Invoices (free)**: estimate → invoice from the phone, customer pays by text/email
  link. Fees: 3.3% + 30¢ online, 2.6% + 15¢ tap-to-pay in person (rates as of Jan 2026).
  Automatic payment reminders are built in. Cash/check still cost nothing.
- Upgrade when: >~30 jobs/month, a third tech, or they want one app for everything →
  **Jobber Core ($39/mo, 1 user)**: quotes, scheduling, dispatch, invoicing, review requests,
  online booking. At that point Jobber's booking widget replaces Cal.com and its forms
  replace Netlify Forms. (Housecall Pro is the alternative at $59/mo.)

## 7. Reviews

Three touchpoints, all automated once set up:
1. Cal.com post-event workflow email (§3).
2. Square invoice "paid" confirmation → add the review link to the invoice message template.
3. Thank-you page and footer link on the site.

Reply to every review inside GBP; it ranks.

## 8. Social

Instagram is the working feed. In Meta Business Suite, set Instagram → Facebook auto-share so
every post lands on both. TikTok stays manual. Put the Cal.com link in all three bios.

## 9. Domain, email, analytics

- Buy `legacyplumbinggroup.com` — ~$12/yr (checked 2026-10-07: available, as are `.co` and
  `legacyplumbingtn.com`). Add it in Netlify → Domain management,
  then update `sitemap.xml`, `robots.txt`, canonical and JSON-LD `url` in `index.html`.
- Email on the domain: Google Workspace ($7/user/mo) only when they want `@legacyplumbinggroup.com`
  addresses; until then Gmail is fine.
- Analytics: Google Search Console (free) + GBP insights. No GA4 until someone will read it.

## 10. Monthly cost

| Item | Cost |
|---|---|
| Netlify, Cal.com, GBP, Google Voice, Square Invoices | $0 |
| Domain | ~$1/mo |
| Square card fees | per transaction |
| Optional later: OpenPhone $15, Jobber $39, Workspace $7 | |

## 11. Launch checklist (who does what)

Lou (today):
- [ ] Push this repo; link it to the existing Netlify site (or `npx netlify-cli login` and let
      Claude link + deploy). Deploys then happen on every push to `main`.
- [ ] Add Netlify form notification emails for both partners.
- [ ] Buy the domain, attach to Netlify.

Partners (one evening, phone only):
- [ ] Create Cal.com account + shared Google Calendar, event type, workflows (§3). Send Lou the
      link → `REPLACE_CAL_LINK`.
- [ ] Claim Google Business Profile, upload photos, get review link (§4) → `REPLACE_GOOGLE_REVIEW_URL`.
- [ ] Send licence number → `REPLACE_LICENSE`.
- [ ] Gmail → SMS forwarding filters (§2).
- [ ] Square account, invoice template with review link (§6/§7).
- [ ] Google Voice number (§5), optional.
- [ ] Meta Business Suite auto-share (§8).

## 12. What was deliberately skipped
- Custom backend / database / CRM: Netlify dashboard + Cal.com + Square hold all the data.
- Live chat widgets, chatbots: GBP messaging covers it.
- Per-city SEO pages: add Nashville / Knoxville / Franklin / Brentwood pages only once GBP is
  live and Search Console shows what people search.
- Online payment on the site: nobody pre-pays a plumber.
