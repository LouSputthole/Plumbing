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

**Cal.com** (open source, free plan: 1 user, unlimited bookings and calendars, Google Calendar
sync, email + SMS notifications, HTML embed). Checked 2026-10-09: free workflows are
**templated only** (no custom message text), so the review ask lives in Square/Jobber instead (§7).
Setup:
1. The partners work markets three hours apart, so **one free Cal.com account per partner**
   (Nashville, Knoxville), each connected to that partner's Google Calendar. Free, and each
   booking lands on the right person. (One shared account with two hosts needs Teams,
   $12/user/mo yearly. Not worth it until techs are being scheduled.)
2. Event type **"Free estimate — 45 min"** on each: availability Mon–Fri 8–5 (whatever they want),
   30–60 min buffer for drive time, 24-hour minimum notice, booking questions: *address*,
   *ZIP*, *what are we looking at*, phone required. Ask them to text photos to the number.
3. Templated reminders: email + SMS 24 h before, SMS 1 h before.
4. Send both `username/event-slug` links to Lou → site `/book` gets a Nashville / Knoxville
   switch (replaces `REPLACE_CAL_LINK`).
5. Put the same booking links in the Google Business Profile "Appointment" field and in the
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
  **Quo** (formerly OpenPhone; ~$15/user/mo yearly, $19 monthly, plus ~$20 one-time text
  registration). Shared inbox, auto-replies, one number per market.

## 6. Estimates, invoices, payments

- **Square Invoices (free)**: estimate → invoice from the phone, customer pays by text/email
  link. Fees: 3.3% + 30¢ online, 2.6% + 15¢ tap-to-pay in person (rates as of Jan 2026).
  Automatic payment reminders are built in. Cash/check still cost nothing.
- Upgrade when: >~30 jobs/month, techs need their own schedules, or they want one app for
  everything → a field-service app: quotes, scheduling, dispatch, invoicing, review requests,
  online booking, consumer financing, QuickBooks sync. Its booking widget replaces Cal.com and
  its request form replaces Netlify Forms (swap one embed on `/book` and the form on `/`).
  Prices from third-party guides, mid-2026; confirm on the vendor page:
  - **Jobber**: Core ~$49/mo (1 user); Connect ~$129–139/mo (up to 5 users, the real tier
    once techs log in). 14-day free trial.
  - **Housecall Pro**: Basic $59/mo yearly or $79 monthly (1 user); Essentials $149–189/mo
    (up to 5 users).

## 7. Reviews

Three touchpoints, all automated once set up:
1. Square invoice message template → the review link rides on every invoice (Jobber/HCP do
   automatic follow-up review requests once they're in).
2. Thank-you page and footer link on the site.
3. Partner texts the link from the driveway when the customer is happy. Highest hit rate.

Reply to every review inside GBP; it ranks.

## 8. Social

Instagram is the working feed. In Meta Business Suite, set Instagram → Facebook auto-share so
every post lands on both. TikTok stays manual. Put `/book` in all three bios.

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
| Optional later: Quo ~$15/user, Workspace $7/user, Jobber ~$49 (1 user) / ~$129+ (crew) | |

## 11. Launch checklist (who does what)

Lou (today):
- [ ] Push this repo; link it to the existing Netlify site (or `npx netlify-cli login` and let
      Claude link + deploy). Deploys then happen on every push to `main`.
- [ ] Add Netlify form notification emails for both partners.
- [ ] Buy the domain, attach to Netlify.

Partners (one evening, phone only):
- [ ] Each partner: free Cal.com account on their Google Calendar, estimate event type,
      reminders (§3). Send Lou both links → `/book` region switch.
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

## 13. Later, once the basics run (in rough order of payoff)
- **Google Local Services Ads** ("Google Guaranteed" badge above the map): pay per lead, not
  per click. Needs licence, insurance and background checks. Turn on once GBP has reviews.
- **Consumer financing** for water heaters / repipes (Wisetack, built into Jobber and HCP):
  bigger tickets close faster.
- **Maintenance plans** (annual water-heater flush + inspection): recurring revenue and a
  reason to call back every year. Recurring jobs in Jobber/HCP.
- **After-hours AI answering** (Jobber AI Receptionist or Quo's built-in agent): backs up the
  24/7 promise when nobody can pick up. Trial before paying.
- **Bookkeeping**: Wave (free) or QuickBooks Online if their accountant wants it; Jobber/HCP
  sync to QuickBooks.
