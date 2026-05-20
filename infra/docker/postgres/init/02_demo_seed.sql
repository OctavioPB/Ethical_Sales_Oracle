-- ESO demo seed data — loaded at container init time (non-production only).
-- Idempotent: skips all inserts if call de000001 already exists.
-- UUIDs match seedDemoData() in api/src/server.ts.

DO $SEED$
BEGIN

IF EXISTS (SELECT 1 FROM calls WHERE call_id = 'de000001-0000-4000-8000-000000000001') THEN
  RETURN;
END IF;

-- ─────────────────────────────────────────────────────────────────────────────
-- CALLS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO calls (call_id, region, desk_id, agent_id, started_at, ended_at, duration_s) VALUES
  ('de000001-0000-4000-8000-000000000001', 'eu', 'desk_001', 'agent-rivera',
   '2026-05-20 09:30:00+00', '2026-05-20 09:38:30+00', 510),
  ('de000002-0000-4000-8000-000000000002', 'eu', 'desk_001', 'agent-chen',
   '2026-05-20 09:15:00+00', '2026-05-20 09:28:30+00', 810),
  ('de000003-0000-4000-8000-000000000003', 'eu', 'desk_002', 'agent-walsh',
   '2026-05-20 09:42:00+00', '2026-05-20 09:49:15+00', 435),
  ('de000004-0000-4000-8000-000000000004', 'us', 'desk_001', 'agent-okonkwo',
   '2026-05-20 08:55:00+00', '2026-05-20 09:06:30+00', 690),
  ('de000005-0000-4000-8000-000000000005', 'eu', 'desk_003', 'agent-patel',
   '2026-05-20 10:02:00+00', '2026-05-20 10:08:00+00', 360),
  ('de000006-0000-4000-8000-000000000006', 'us', 'desk_002', 'agent-martinez',
   '2026-05-20 08:30:00+00', '2026-05-20 08:38:00+00', 480),
  ('de000007-0000-4000-8000-000000000007', 'eu', 'desk_003', 'agent-kim',
   '2026-05-20 07:50:00+00', '2026-05-20 07:59:30+00', 570),
  ('de000008-0000-4000-8000-000000000008', 'eu', 'desk_001', 'agent-santos',
   '2026-05-20 10:15:00+00', '2026-05-20 10:27:00+00', 720),
  ('de000009-0000-4000-8000-000000000009', 'eu', 'desk_002', 'agent-ali',
   '2026-05-20 09:50:00+00', '2026-05-20 09:58:30+00', 510);

-- ─────────────────────────────────────────────────────────────────────────────
-- CALL 1 — Rivera / CRITICAL 94
-- Selling structured product to elderly customer. Multiple guarantee violations.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO utterances (call_id, speaker, utterance, pii_redacted, started_at, ended_at) VALUES
  ('de000001-0000-4000-8000-000000000001','AGENT',
   'Good morning, thank you for calling ESO Wealth. My name is Rivera. How can I help you today?',
   false, '2026-05-20 09:30:05+00', '2026-05-20 09:30:12+00'),
  ('de000001-0000-4000-8000-000000000001','CUSTOMER',
   'Hi, yes, I saw an advertisement about a new investment plan and I wanted to find out more.',
   false, '2026-05-20 09:30:14+00', '2026-05-20 09:30:22+00'),
  ('de000001-0000-4000-8000-000000000001','AGENT',
   'Excellent. This is our Capital Growth Structured Product. It offers a guaranteed annual return of at least 10 percent.',
   false, '2026-05-20 09:30:24+00', '2026-05-20 09:30:35+00'),
  ('de000001-0000-4000-8000-000000000001','CUSTOMER',
   'That sounds interesting. Is it risky? I am retired and I cannot afford to lose my savings.',
   false, '2026-05-20 09:30:37+00', '2026-05-20 09:30:46+00'),
  ('de000001-0000-4000-8000-000000000001','AGENT',
   'Absolutely not. There is zero risk to your capital. Your original investment is fully protected.',
   false, '2026-05-20 09:30:48+00', '2026-05-20 09:30:58+00'),
  ('de000001-0000-4000-8000-000000000001','CUSTOMER',
   'Really? That sounds almost too good to be true. How is that possible?',
   false, '2026-05-20 09:31:00+00', '2026-05-20 09:31:08+00'),
  ('de000001-0000-4000-8000-000000000001','AGENT',
   'The product uses a combination of bonds and derivatives. You can trust me on this — I have been doing this for twelve years.',
   false, '2026-05-20 09:31:10+00', '2026-05-20 09:31:22+00'),
  ('de000001-0000-4000-8000-000000000001','CUSTOMER',
   'What is the minimum investment? And how long do I need to leave the money in?',
   false, '2026-05-20 09:31:25+00', '2026-05-20 09:31:34+00'),
  ('de000001-0000-4000-8000-000000000001','AGENT',
   'The minimum is five thousand pounds with a five-year term. At ten percent per year that is at least fifty percent growth guaranteed.',
   false, '2026-05-20 09:31:36+00', '2026-05-20 09:31:50+00'),
  ('de000001-0000-4000-8000-000000000001','CUSTOMER',
   'I have about twenty thousand I was thinking of investing. Can I start today?',
   false, '2026-05-20 09:31:52+00', '2026-05-20 09:32:02+00'),
  ('de000001-0000-4000-8000-000000000001','AGENT',
   'Absolutely. I can take your details now and get everything set up. Shall we proceed?',
   false, '2026-05-20 09:32:04+00', '2026-05-20 09:32:14+00'),
  ('de000001-0000-4000-8000-000000000001','CUSTOMER',
   'Yes please. But what happens if the company goes under? Is there any protection?',
   false, '2026-05-20 09:32:16+00', '2026-05-20 09:32:27+00'),
  ('de000001-0000-4000-8000-000000000001','AGENT',
   'We are regulated by the FCA so you are completely protected. There is nothing to worry about.',
   false, '2026-05-20 09:32:29+00', '2026-05-20 09:32:40+00'),
  ('de000001-0000-4000-8000-000000000001','CUSTOMER',
   'Alright then. Let us go ahead.',
   false, '2026-05-20 09:32:42+00', '2026-05-20 09:32:47+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- CALL 2 — Chen / CRITICAL 88
-- Pension drawdown with urgency tactics and guaranteed return claims.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO utterances (call_id, speaker, utterance, pii_redacted, started_at, ended_at) VALUES
  ('de000002-0000-4000-8000-000000000002','AGENT',
   'Good morning, this is Chen from ESO Wealth Management. Is this a good time to talk about your pension?',
   false, '2026-05-20 09:15:05+00', '2026-05-20 09:15:15+00'),
  ('de000002-0000-4000-8000-000000000002','CUSTOMER',
   'Yes, I have been thinking about moving my pension. I retire in two years.',
   false, '2026-05-20 09:15:17+00', '2026-05-20 09:15:26+00'),
  ('de000002-0000-4000-8000-000000000002','AGENT',
   'Perfect timing. Our Enhanced Pension Drawdown plan is exactly what you need. And this offer closes tonight at midnight so you are calling at just the right moment.',
   false, '2026-05-20 09:15:28+00', '2026-05-20 09:15:42+00'),
  ('de000002-0000-4000-8000-000000000002','CUSTOMER',
   'Oh really? What kind of returns are we talking about?',
   false, '2026-05-20 09:15:44+00', '2026-05-20 09:15:51+00'),
  ('de000002-0000-4000-8000-000000000002','AGENT',
   'I can personally guarantee returns of twelve to fifteen percent annually. Our top clients saw sixteen percent last year.',
   false, '2026-05-20 09:15:53+00', '2026-05-20 09:16:05+00'),
  ('de000002-0000-4000-8000-000000000002','CUSTOMER',
   'That is much higher than my current provider. How is that possible with pensions?',
   false, '2026-05-20 09:16:07+00', '2026-05-20 09:16:17+00'),
  ('de000002-0000-4000-8000-000000000002','AGENT',
   'We use a proprietary investment strategy. Everyone else has already moved their pension to us — all of my clients have switched over the past six months.',
   false, '2026-05-20 09:16:19+00', '2026-05-20 09:16:32+00'),
  ('de000002-0000-4000-8000-000000000002','CUSTOMER',
   'I would need to think about it. Can I call you back tomorrow?',
   false, '2026-05-20 09:16:34+00', '2026-05-20 09:16:42+00'),
  ('de000002-0000-4000-8000-000000000002','AGENT',
   'Unfortunately the offer expires at midnight tonight. After that the guaranteed rate drops back to standard. You really cannot afford to wait.',
   false, '2026-05-20 09:16:44+00', '2026-05-20 09:16:58+00'),
  ('de000002-0000-4000-8000-000000000002','CUSTOMER',
   'Well I suppose if the offer ends tonight... what do I need to do?',
   false, '2026-05-20 09:17:00+00', '2026-05-20 09:17:10+00'),
  ('de000002-0000-4000-8000-000000000002','AGENT',
   'Just give me your pension provider details and I will start the transfer today. You will be earning at the higher rate within the week.',
   false, '2026-05-20 09:17:12+00', '2026-05-20 09:17:25+00'),
  ('de000002-0000-4000-8000-000000000002','CUSTOMER',
   'What about tax implications? I am not sure about the rules.',
   false, '2026-05-20 09:17:27+00', '2026-05-20 09:17:36+00'),
  ('de000002-0000-4000-8000-000000000002','AGENT',
   'Do not worry about the tax side — that is all handled for you. The important thing is to lock in this rate before tonight.',
   false, '2026-05-20 09:17:38+00', '2026-05-20 09:17:51+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- CALL 3 — Walsh / HIGH 74
-- ISA transfer. Misleading past performance claim. Missing disclaimer.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO utterances (call_id, speaker, utterance, pii_redacted, started_at, ended_at) VALUES
  ('de000003-0000-4000-8000-000000000003','AGENT',
   'Hello, this is Walsh, ESO Wealth. Thanks for returning my call about the Balanced Growth ISA.',
   false, '2026-05-20 09:42:05+00', '2026-05-20 09:42:14+00'),
  ('de000003-0000-4000-8000-000000000003','CUSTOMER',
   'Yes, I wanted to transfer my existing cash ISA into something with better returns.',
   false, '2026-05-20 09:42:16+00', '2026-05-20 09:42:25+00'),
  ('de000003-0000-4000-8000-000000000003','AGENT',
   'Our Balanced Growth ISA is an excellent choice. In twenty years I have never seen this fund lose money — it has had positive returns every single year.',
   false, '2026-05-20 09:42:27+00', '2026-05-20 09:42:40+00'),
  ('de000003-0000-4000-8000-000000000003','CUSTOMER',
   'That is reassuring. What kind of returns can I expect going forward?',
   false, '2026-05-20 09:42:42+00', '2026-05-20 09:42:51+00'),
  ('de000003-0000-4000-8000-000000000003','AGENT',
   'Based on historical performance, you are looking at five to seven percent a year. The fund manager has a strong track record.',
   false, '2026-05-20 09:42:53+00', '2026-05-20 09:43:05+00'),
  ('de000003-0000-4000-8000-000000000003','CUSTOMER',
   'What is the risk level? I am comfortable with some risk but not high risk.',
   false, '2026-05-20 09:43:07+00', '2026-05-20 09:43:16+00'),
  ('de000003-0000-4000-8000-000000000003','AGENT',
   'It is rated medium risk on our scale. The portfolio is diversified across bonds and equities.',
   false, '2026-05-20 09:43:18+00', '2026-05-20 09:43:29+00'),
  ('de000003-0000-4000-8000-000000000003','CUSTOMER',
   'How much can I transfer in and are there any charges?',
   false, '2026-05-20 09:43:31+00', '2026-05-20 09:43:41+00'),
  ('de000003-0000-4000-8000-000000000003','AGENT',
   'You can transfer up to your full ISA allowance. Annual management charge is 0.85 percent. Shall I send you the application documents?',
   false, '2026-05-20 09:43:43+00', '2026-05-20 09:43:55+00'),
  ('de000003-0000-4000-8000-000000000003','CUSTOMER',
   'Yes please. Can you remind me — is the capital guaranteed?',
   false, '2026-05-20 09:43:57+00', '2026-05-20 09:44:06+00'),
  ('de000003-0000-4000-8000-000000000003','AGENT',
   'The capital is not explicitly guaranteed, but given the fund has never had a losing year I would not be concerned.',
   false, '2026-05-20 09:44:08+00', '2026-05-20 09:44:20+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- CALL 4 — Okonkwo / HIGH 67
-- Alternative investment. Scarcity pressure and loss-aversion manipulation.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO utterances (call_id, speaker, utterance, pii_redacted, started_at, ended_at) VALUES
  ('de000004-0000-4000-8000-000000000004','AGENT',
   'Good morning, Okonkwo here from ESO Alternative Investments. I am calling about our Private Credit Fund opportunity.',
   false, '2026-05-20 08:55:05+00', '2026-05-20 08:55:16+00'),
  ('de000004-0000-4000-8000-000000000004','CUSTOMER',
   'I received your letter. Tell me more about it.',
   false, '2026-05-20 08:55:18+00', '2026-05-20 08:55:25+00'),
  ('de000004-0000-4000-8000-000000000004','AGENT',
   'This is an exclusive private credit fund targeting eight percent net returns. We currently have only three investor slots remaining at the preferential rate.',
   false, '2026-05-20 08:55:27+00', '2026-05-20 08:55:40+00'),
  ('de000004-0000-4000-8000-000000000004','CUSTOMER',
   'Only three? That is quite limited. What is the investment size?',
   false, '2026-05-20 08:55:42+00', '2026-05-20 08:55:51+00'),
  ('de000004-0000-4000-8000-000000000004','AGENT',
   'Minimum fifty thousand. Given that we are nearly full, waiting would mean you would be leaving significant money on the table.',
   false, '2026-05-20 08:55:53+00', '2026-05-20 08:56:05+00'),
  ('de000004-0000-4000-8000-000000000004','CUSTOMER',
   'That is a large sum. What are the risks involved?',
   false, '2026-05-20 08:56:07+00', '2026-05-20 08:56:16+00'),
  ('de000004-0000-4000-8000-000000000004','AGENT',
   'All investments carry some degree of risk, but private credit is secured against underlying assets. Our default rate has been under one percent.',
   false, '2026-05-20 08:56:18+00', '2026-05-20 08:56:32+00'),
  ('de000004-0000-4000-8000-000000000004','CUSTOMER',
   'Is this FCA regulated? And what is the liquidity like if I need to exit early?',
   false, '2026-05-20 08:56:34+00', '2026-05-20 08:56:46+00'),
  ('de000004-0000-4000-8000-000000000004','AGENT',
   'The fund is registered with the FCA. Early exit requires 90-day notice and is subject to market conditions. Given only three slots remain, I strongly encourage you to decide today.',
   false, '2026-05-20 08:56:48+00', '2026-05-20 08:57:05+00'),
  ('de000004-0000-4000-8000-000000000004','CUSTOMER',
   'I would need to speak with my financial advisor first.',
   false, '2026-05-20 08:57:07+00', '2026-05-20 08:57:15+00'),
  ('de000004-0000-4000-8000-000000000004','AGENT',
   'Of course, but please bear in mind that by the time you speak to them the slots may be gone. You would be missing out on a significant opportunity.',
   false, '2026-05-20 08:57:17+00', '2026-05-20 08:57:30+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- CALL 5 — Patel / MEDIUM 51
-- Bond fund. Borderline risk language. Missing formal disclosure.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO utterances (call_id, speaker, utterance, pii_redacted, started_at, ended_at) VALUES
  ('de000005-0000-4000-8000-000000000005','AGENT',
   'Hi, this is Patel from ESO Wealth. You enquired about our Corporate Bond Fund last week.',
   false, '2026-05-20 10:02:05+00', '2026-05-20 10:02:14+00'),
  ('de000005-0000-4000-8000-000000000005','CUSTOMER',
   'Yes, I am looking for something with better yield than my savings account.',
   false, '2026-05-20 10:02:16+00', '2026-05-20 10:02:24+00'),
  ('de000005-0000-4000-8000-000000000005','AGENT',
   'Our Investment Grade Corporate Bond Fund currently yields around four point five percent. It is mostly safe because it only holds investment-grade rated bonds.',
   false, '2026-05-20 10:02:26+00', '2026-05-20 10:02:40+00'),
  ('de000005-0000-4000-8000-000000000005','CUSTOMER',
   'What do you mean by mostly safe? What could go wrong?',
   false, '2026-05-20 10:02:42+00', '2026-05-20 10:02:51+00'),
  ('de000005-0000-4000-8000-000000000005','AGENT',
   'Bond funds can go down if interest rates rise sharply, but historically this fund has been quite stable. The NAV rarely moves more than two percent in a year.',
   false, '2026-05-20 10:02:53+00', '2026-05-20 10:03:07+00'),
  ('de000005-0000-4000-8000-000000000005','CUSTOMER',
   'That sounds reasonable. What is the minimum investment and are there fees?',
   false, '2026-05-20 10:03:09+00', '2026-05-20 10:03:18+00'),
  ('de000005-0000-4000-8000-000000000005','AGENT',
   'Minimum one thousand pounds, annual charge of 0.6 percent. You can hold it inside an ISA wrapper as well.',
   false, '2026-05-20 10:03:20+00', '2026-05-20 10:03:31+00'),
  ('de000005-0000-4000-8000-000000000005','CUSTOMER',
   'Let me think it over. Can you email me the fund factsheet?',
   false, '2026-05-20 10:03:33+00', '2026-05-20 10:03:40+00'),
  ('de000005-0000-4000-8000-000000000005','AGENT',
   'Absolutely, I will send that over. Shall I include an application form as well?',
   false, '2026-05-20 10:03:42+00', '2026-05-20 10:03:50+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- CALL 6 — Martinez / MEDIUM 44
-- Managed fund. Suitability gap — risk tolerance not properly established.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO utterances (call_id, speaker, utterance, pii_redacted, started_at, ended_at) VALUES
  ('de000006-0000-4000-8000-000000000006','AGENT',
   'Good morning, Martinez calling from ESO Wealth. I wanted to follow up on the managed fund brochure we sent you.',
   false, '2026-05-20 08:30:05+00', '2026-05-20 08:30:16+00'),
  ('de000006-0000-4000-8000-000000000006','CUSTOMER',
   'Yes I received it. I am interested but I have never invested before.',
   false, '2026-05-20 08:30:18+00', '2026-05-20 08:30:27+00'),
  ('de000006-0000-4000-8000-000000000006','AGENT',
   'No problem at all. Our Global Managed Fund is a great starting point. Our fund managers handle everything for you.',
   false, '2026-05-20 08:30:29+00', '2026-05-20 08:30:40+00'),
  ('de000006-0000-4000-8000-000000000006','CUSTOMER',
   'What kind of return can I expect and over what period?',
   false, '2026-05-20 08:30:42+00', '2026-05-20 08:30:51+00'),
  ('de000006-0000-4000-8000-000000000006','AGENT',
   'Over five years we have averaged about six percent per year. Of course markets fluctuate but the trend has been upward.',
   false, '2026-05-20 08:30:53+00', '2026-05-20 08:31:05+00'),
  ('de000006-0000-4000-8000-000000000006','CUSTOMER',
   'That sounds good. I have ten thousand pounds sitting in a current account doing nothing.',
   false, '2026-05-20 08:31:07+00', '2026-05-20 08:31:16+00'),
  ('de000006-0000-4000-8000-000000000006','AGENT',
   'Ten thousand is a great starting amount. Shall I set up an appointment to get the paperwork started?',
   false, '2026-05-20 08:31:18+00', '2026-05-20 08:31:28+00'),
  ('de000006-0000-4000-8000-000000000006','CUSTOMER',
   'Yes, let us do that. When are you available?',
   false, '2026-05-20 08:31:30+00', '2026-05-20 08:31:38+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- CALL 7 — Kim / MEDIUM 38
-- Investment bonds. Mild urgency phrasing.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO utterances (call_id, speaker, utterance, pii_redacted, started_at, ended_at) VALUES
  ('de000007-0000-4000-8000-000000000007','AGENT',
   'Good morning, Kim here from ESO Wealth Fixed Income desk. Calling about our current bond offering.',
   false, '2026-05-20 07:50:05+00', '2026-05-20 07:50:15+00'),
  ('de000007-0000-4000-8000-000000000007','CUSTOMER',
   'I am listening. I have some cash I want to put to work.',
   false, '2026-05-20 07:50:17+00', '2026-05-20 07:50:24+00'),
  ('de000007-0000-4000-8000-000000000007','AGENT',
   'We have a five-year fixed-rate bond at 4.8 percent. Given interest rates may fall later this year, now is a good time to lock in while rates are good.',
   false, '2026-05-20 07:50:26+00', '2026-05-20 07:50:40+00'),
  ('de000007-0000-4000-8000-000000000007','CUSTOMER',
   'What is the minimum deposit and what happens if rates go higher after I invest?',
   false, '2026-05-20 07:50:42+00', '2026-05-20 07:50:53+00'),
  ('de000007-0000-4000-8000-000000000007','AGENT',
   'Minimum five thousand. If rates go higher your fixed rate stays the same, which is a trade-off. But our economists believe we are at or near the peak.',
   false, '2026-05-20 07:50:55+00', '2026-05-20 07:51:10+00'),
  ('de000007-0000-4000-8000-000000000007','CUSTOMER',
   'Fair enough. Is there FSCS protection on this?',
   false, '2026-05-20 07:51:12+00', '2026-05-20 07:51:20+00'),
  ('de000007-0000-4000-8000-000000000007','AGENT',
   'Yes, the bond is issued by a UK bank and FSCS protected up to eighty-five thousand pounds. I can email you the full terms and conditions.',
   false, '2026-05-20 07:51:22+00', '2026-05-20 07:51:34+00'),
  ('de000007-0000-4000-8000-000000000007','CUSTOMER',
   'Please do. I will review them and come back to you.',
   false, '2026-05-20 07:51:36+00', '2026-05-20 07:51:44+00'),
  ('de000007-0000-4000-8000-000000000007','AGENT',
   'Of course. I will send those across now. Please do bear in mind the rate is reviewed monthly.',
   false, '2026-05-20 07:51:46+00', '2026-05-20 07:51:58+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- CALL 8 — Santos / LOW 18
-- Exemplary compliant pension advisory. Full disclosures given.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO utterances (call_id, speaker, utterance, pii_redacted, started_at, ended_at) VALUES
  ('de000008-0000-4000-8000-000000000008','AGENT',
   'Good morning, Santos from ESO Wealth. Thank you for taking my call. Before we begin I must remind you that this call is recorded for regulatory purposes and anything I say does not constitute regulated financial advice unless we have completed a formal suitability assessment. Do you understand and consent to continue?',
   false, '2026-05-20 10:15:05+00', '2026-05-20 10:15:28+00'),
  ('de000008-0000-4000-8000-000000000008','CUSTOMER',
   'Yes, I understand and consent.',
   false, '2026-05-20 10:15:30+00', '2026-05-20 10:15:35+00'),
  ('de000008-0000-4000-8000-000000000008','AGENT',
   'Excellent. Can you tell me about your current pension arrangements and what you are hoping to achieve?',
   false, '2026-05-20 10:15:37+00', '2026-05-20 10:15:47+00'),
  ('de000008-0000-4000-8000-000000000008','CUSTOMER',
   'I have a workplace pension and a small SIPP. I am 52 and hoping to retire around 62.',
   false, '2026-05-20 10:15:49+00', '2026-05-20 10:16:00+00'),
  ('de000008-0000-4000-8000-000000000008','AGENT',
   'Thank you. On a scale of one to ten, where one is very cautious and ten is very adventurous, how would you describe your attitude to investment risk?',
   false, '2026-05-20 10:16:02+00', '2026-05-20 10:16:14+00'),
  ('de000008-0000-4000-8000-000000000008','CUSTOMER',
   'I would say around a six. I understand there will be ups and downs but I do not want to lose everything.',
   false, '2026-05-20 10:16:16+00', '2026-05-20 10:16:27+00'),
  ('de000008-0000-4000-8000-000000000008','AGENT',
   'That is a balanced risk profile. Based on your timeline of ten years, a diversified growth portfolio would be appropriate. However, I must be clear that the value of investments can go down as well as up, and past performance is not a reliable indicator of future results. You could receive back less than you invest.',
   false, '2026-05-20 10:16:29+00', '2026-05-20 10:16:52+00'),
  ('de000008-0000-4000-8000-000000000008','CUSTOMER',
   'I appreciate the honesty. What are the options?',
   false, '2026-05-20 10:16:54+00', '2026-05-20 10:17:03+00'),
  ('de000008-0000-4000-8000-000000000008','AGENT',
   'I would like to send you our Key Information Documents for two suitable fund options. You are also entitled to a 30-day cooling-off period after any product application, during which you can cancel without penalty.',
   false, '2026-05-20 10:17:05+00', '2026-05-20 10:17:22+00'),
  ('de000008-0000-4000-8000-000000000008','CUSTOMER',
   'That is reassuring. Please do send those through.',
   false, '2026-05-20 10:17:24+00', '2026-05-20 10:17:32+00'),
  ('de000008-0000-4000-8000-000000000008','AGENT',
   'I will do so immediately after this call. You should also consider seeking independent financial advice before making any decision. Is there anything else I can help you with today?',
   false, '2026-05-20 10:17:34+00', '2026-05-20 10:17:48+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- CALL 9 — Ali / LOW 9
-- Exemplary ISA review. No flags. Full compliance.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO utterances (call_id, speaker, utterance, pii_redacted, started_at, ended_at) VALUES
  ('de000009-0000-4000-8000-000000000009','AGENT',
   'Good morning, this is Ali from ESO Wealth. I am calling for your annual ISA review. This call is recorded for quality and regulatory purposes. Is now a good time?',
   false, '2026-05-20 09:50:05+00', '2026-05-20 09:50:19+00'),
  ('de000009-0000-4000-8000-000000000009','CUSTOMER',
   'Yes, now is fine.',
   false, '2026-05-20 09:50:21+00', '2026-05-20 09:50:25+00'),
  ('de000009-0000-4000-8000-000000000009','AGENT',
   'Your Stocks and Shares ISA has returned approximately 5.2 percent over the past twelve months. I want to remind you that past performance does not guarantee future results and the value of your ISA can fall as well as rise.',
   false, '2026-05-20 09:50:27+00', '2026-05-20 09:50:45+00'),
  ('de000009-0000-4000-8000-000000000009','CUSTOMER',
   'Good to know. I am happy with that. Should I be contributing more?',
   false, '2026-05-20 09:50:47+00', '2026-05-20 09:50:56+00'),
  ('de000009-0000-4000-8000-000000000009','AGENT',
   'That depends on your wider financial circumstances, which I would need to review formally before making any recommendation. Would you like to schedule a full suitability review?',
   false, '2026-05-20 09:50:58+00', '2026-05-20 09:51:12+00'),
  ('de000009-0000-4000-8000-000000000009','CUSTOMER',
   'Yes, let us do that. I also want to make sure I am not overexposed to any one sector.',
   false, '2026-05-20 09:51:14+00', '2026-05-20 09:51:24+00'),
  ('de000009-0000-4000-8000-000000000009','AGENT',
   'Absolutely. Diversification is a key principle. I will send you our suitability questionnaire and we can schedule a 45-minute review call at your convenience.',
   false, '2026-05-20 09:51:26+00', '2026-05-20 09:51:40+00'),
  ('de000009-0000-4000-8000-000000000009','CUSTOMER',
   'Perfect. Thank you for being so thorough.',
   false, '2026-05-20 09:51:42+00', '2026-05-20 09:51:49+00'),
  ('de000009-0000-4000-8000-000000000009','AGENT',
   'It is my pleasure. We will send the questionnaire to your registered email address within the hour. Have a great day.',
   false, '2026-05-20 09:51:51+00', '2026-05-20 09:52:02+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- RISK EVENTS
-- triggered_at must be within 30s of the matched utterance's started_at
-- so that callDetailQueries.ts annotation logic attaches them correctly.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO risk_events (call_id, rule_id, category, utterance, matched_phrase, speaker, confidence, triggered_at) VALUES
  -- Call 1 — Rivera (CRITICAL 94)
  ('de000001-0000-4000-8000-000000000001',
   'GUARANTEED_RETURNS', 'misleading_claim',
   'Excellent. This is our Capital Growth Structured Product. It offers a guaranteed annual return of at least 10 percent.',
   'guaranteed annual return of at least 10 percent',
   'AGENT', 0.971, '2026-05-20 09:30:24+00'),

  ('de000001-0000-4000-8000-000000000001',
   'MISLEADING_RISK_CLAIM', 'misleading_claim',
   'Absolutely not. There is zero risk to your capital. Your original investment is fully protected.',
   'zero risk to your capital',
   'AGENT', 0.958, '2026-05-20 09:30:48+00'),

  ('de000001-0000-4000-8000-000000000001',
   'PERSONAL_ASSURANCE', 'compliance_gap',
   'The product uses a combination of bonds and derivatives. You can trust me on this — I have been doing this for twelve years.',
   'you can trust me on this',
   'AGENT', 0.883, '2026-05-20 09:31:10+00'),

  ('de000001-0000-4000-8000-000000000001',
   'MISSING_RISK_DISCLAIMER', 'missing_disclosure',
   'Absolutely. I can take your details now and get everything set up. Shall we proceed?',
   'no risk disclaimer provided before soliciting investment',
   'AGENT', 0.910, '2026-05-20 09:32:04+00'),

  ('de000001-0000-4000-8000-000000000001',
   'MISLEADING_FSCS_CLAIM', 'misleading_claim',
   'We are regulated by the FCA so you are completely protected. There is nothing to worry about.',
   'completely protected',
   'AGENT', 0.862, '2026-05-20 09:32:29+00'),

  -- Call 2 — Chen (CRITICAL 88)
  ('de000002-0000-4000-8000-000000000002',
   'ARTIFICIAL_URGENCY', 'pressure_tactic',
   'Perfect timing. Our Enhanced Pension Drawdown plan is exactly what you need. And this offer closes tonight at midnight so you are calling at just the right moment.',
   'offer closes tonight at midnight',
   'AGENT', 0.943, '2026-05-20 09:15:28+00'),

  ('de000002-0000-4000-8000-000000000002',
   'GUARANTEED_RETURNS', 'misleading_claim',
   'I can personally guarantee returns of twelve to fifteen percent annually. Our top clients saw sixteen percent last year.',
   'personally guarantee returns of twelve to fifteen percent',
   'AGENT', 0.967, '2026-05-20 09:15:53+00'),

  ('de000002-0000-4000-8000-000000000002',
   'SOCIAL_PROOF_PRESSURE', 'pressure_tactic',
   'We use a proprietary investment strategy. Everyone else has already moved their pension to us — all of my clients have switched over the past six months.',
   'everyone else has already moved their pension to us',
   'AGENT', 0.891, '2026-05-20 09:16:19+00'),

  ('de000002-0000-4000-8000-000000000002',
   'ARTIFICIAL_URGENCY', 'pressure_tactic',
   'Unfortunately the offer expires at midnight tonight. After that the guaranteed rate drops back to standard. You really cannot afford to wait.',
   'you really cannot afford to wait',
   'AGENT', 0.921, '2026-05-20 09:16:44+00'),

  -- Call 3 — Walsh (HIGH 74)
  ('de000003-0000-4000-8000-000000000003',
   'MISLEADING_PAST_PERFORMANCE', 'misleading_claim',
   'Our Balanced Growth ISA is an excellent choice. In twenty years I have never seen this fund lose money — it has had positive returns every single year.',
   'never seen this fund lose money',
   'AGENT', 0.912, '2026-05-20 09:42:27+00'),

  ('de000003-0000-4000-8000-000000000003',
   'MISSING_PAST_PERF_DISCLAIMER', 'missing_disclosure',
   'Based on historical performance, you are looking at five to seven percent a year. The fund manager has a strong track record.',
   'no past performance disclaimer after referencing historical returns',
   'AGENT', 0.877, '2026-05-20 09:42:53+00'),

  -- Call 4 — Okonkwo (HIGH 67)
  ('de000004-0000-4000-8000-000000000004',
   'SCARCITY_PRESSURE', 'pressure_tactic',
   'This is an exclusive private credit fund targeting eight percent net returns. We currently have only three investor slots remaining at the preferential rate.',
   'only three investor slots remaining',
   'AGENT', 0.934, '2026-05-20 08:55:27+00'),

  ('de000004-0000-4000-8000-000000000004',
   'LOSS_AVERSION_MANIPULATION', 'pressure_tactic',
   'Minimum fifty thousand. Given that we are nearly full, waiting would mean you would be leaving significant money on the table.',
   'leaving significant money on the table',
   'AGENT', 0.856, '2026-05-20 08:55:53+00'),

  -- Call 5 — Patel (MEDIUM 51)
  ('de000005-0000-4000-8000-000000000005',
   'VAGUE_RISK_LANGUAGE', 'compliance_gap',
   'Our Investment Grade Corporate Bond Fund currently yields around four point five percent. It is mostly safe because it only holds investment-grade rated bonds.',
   'mostly safe',
   'AGENT', 0.742, '2026-05-20 10:02:26+00'),

  ('de000005-0000-4000-8000-000000000005',
   'MISSING_RISK_DISCLAIMER', 'missing_disclosure',
   'Minimum one thousand pounds, annual charge of 0.6 percent. You can hold it inside an ISA wrapper as well.',
   'no formal risk disclosure before discussing investment details',
   'AGENT', 0.801, '2026-05-20 10:03:20+00'),

  -- Call 6 — Martinez (MEDIUM 44)
  ('de000006-0000-4000-8000-000000000006',
   'MISSING_SUITABILITY_ASSESSMENT', 'compliance_gap',
   'Ten thousand is a great starting amount. Shall I set up an appointment to get the paperwork started?',
   'proceeding to application without suitability questionnaire',
   'AGENT', 0.768, '2026-05-20 08:31:18+00'),

  -- Call 7 — Kim (MEDIUM 38)
  ('de000007-0000-4000-8000-000000000007',
   'MILD_URGENCY', 'pressure_tactic',
   'We have a five-year fixed-rate bond at 4.8 percent. Given interest rates may fall later this year, now is a good time to lock in while rates are good.',
   'lock in while rates are good',
   'AGENT', 0.641, '2026-05-20 07:50:26+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- CALL RISK SCORES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO call_risk_scores (call_id, score, deterministic_score, llm_score, event_count, scored_at, prompt_hash, response_hash, latency_ms) VALUES
  ('de000001-0000-4000-8000-000000000001', 94, 90, 94, 5,
   '2026-05-20 09:38:45+00',
   'a3f1e2b4c5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
   'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
   2340),
  ('de000002-0000-4000-8000-000000000002', 88, 82, 88, 4,
   '2026-05-20 09:28:45+00',
   'c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5',
   'd5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6',
   2180),
  ('de000003-0000-4000-8000-000000000003', 74, 70, 74, 3,
   '2026-05-20 09:49:30+00',
   'e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7',
   'f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8',
   1970),
  ('de000004-0000-4000-8000-000000000004', 67, 60, 67, 2,
   '2026-05-20 09:06:45+00',
   'a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9',
   'b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0',
   1850),
  ('de000005-0000-4000-8000-000000000005', 51, 45, 51, 2,
   '2026-05-20 10:08:15+00',
   'c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1',
   'd1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2',
   1720),
  ('de000006-0000-4000-8000-000000000006', 44, 40, 44, 1,
   '2026-05-20 08:38:15+00',
   'e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3',
   'f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4',
   1640),
  ('de000007-0000-4000-8000-000000000007', 38, 30, 38, 1,
   '2026-05-20 07:59:45+00',
   'a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5',
   'b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
   1580),
  ('de000008-0000-4000-8000-000000000008', 18, 12, 18, 0,
   '2026-05-20 10:27:15+00',
   'c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7',
   'd7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8',
   1410),
  ('de000009-0000-4000-8000-000000000009', 9, 5, 9, 0,
   '2026-05-20 09:58:45+00',
   'e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9',
   'f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
   1290);

-- ─────────────────────────────────────────────────────────────────────────────
-- LLM PROMPT AUDITS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO llm_prompt_audits (call_id, prompt_hash, response_hash, prompt_version, model, score, latency_ms, rationale_text, logged_at) VALUES

  ('de000001-0000-4000-8000-000000000001',
   'a3f1e2b4c5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
   'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
   'eso-risk-v2.1', 'claude-opus-4-7', 94, 2340,
   'CRITICAL risk score assigned. Agent made multiple severe regulatory violations. ' ||
   'Primary violation: explicit guarantee of "at least 10 percent annual return" — constitutes a false or misleading statement under FCA COBS 4.2. ' ||
   'Secondary violation: claim of "zero risk to your capital" is categorically false for a structured product containing derivatives and contradicts required risk disclosure under COBS 14.3. ' ||
   'Tertiary violation: use of personal assurance ("you can trust me") as a substitute for product documentation undermines informed consent. ' ||
   'Agent also misrepresented FCA regulation as equivalent to full capital guarantee, which is factually incorrect — FSCS protection applies to deposit accounts, not structured investment products. ' ||
   'No cooling-off period was mentioned. No Key Information Document was offered before soliciting investment. ' ||
   'Recommend immediate ALERT_AGENT intervention and supervisor review before any transaction proceeds.',
   '2026-05-20 09:38:50+00'),

  ('de000002-0000-4000-8000-000000000002',
   'c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5',
   'd5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6',
   'eso-risk-v2.1', 'claude-opus-4-7', 88, 2180,
   'CRITICAL risk score assigned. Agent employed a combination of artificial urgency and explicit return guarantees targeting a near-retirement customer. ' ||
   'Urgency violation: "offer closes tonight at midnight" is a high-pressure sales tactic prohibited under FCA COBS 2.1 fair treatment obligations, particularly when applied to pension transfers. ' ||
   'Guarantee violation: "I can personally guarantee returns of 12 to 15 percent annually" — personal guarantees of investment returns are prohibited under FSMA 2000 s.21 and FCA COBS 4.6. ' ||
   'Social proof manipulation: claiming "everyone else has already invested" creates false impression of consensus and bypasses independent decision-making. ' ||
   'The agent discouraged the customer from consulting an independent financial adviser and repeatedly reinforced urgency when the customer asked for time to reflect. ' ||
   'Pension transfer advice without a Transfer Value Analysis and appropriate suitability assessment is a known high-risk mis-selling pattern. ' ||
   'Recommend PAUSE_CALL and immediate compliance review. Transfer must not proceed without full suitability assessment.',
   '2026-05-20 09:28:50+00'),

  ('de000003-0000-4000-8000-000000000003',
   'e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7',
   'f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8',
   'eso-risk-v2.1', 'claude-opus-4-7', 74, 1970,
   'HIGH risk score assigned. Agent made an unqualified claim about historical fund performance without the required regulatory disclaimer. ' ||
   'The phrase "in twenty years I have never seen this fund lose money" constitutes selective presentation of past performance under FCA COBS 4.6.2, which requires that historical performance be presented with the disclaimer that past results do not guarantee future performance. ' ||
   'No such disclaimer was provided before or after citing historical returns. ' ||
   'When asked about capital guarantee, agent provided a qualified but misleading response: framing the absence of historical losses as practical reassurance against future loss is a known pattern that creates false expectations. ' ||
   'Suitability assessment was partially conducted (risk tolerance asked) but investment timeline, existing portfolio, and tax position were not established before product was discussed. ' ||
   'Recommend supervisory note and agent coaching on past-performance disclosure requirements.',
   '2026-05-20 09:49:35+00'),

  ('de000004-0000-4000-8000-000000000004',
   'a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9',
   'b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0',
   'eso-risk-v2.1', 'claude-opus-4-7', 67, 1850,
   'HIGH risk score assigned. Agent used artificial scarcity and loss-aversion framing to pressure an investment decision. ' ||
   'Scarcity claim: "only three investor slots remaining" is a classic FOMO tactic. If true, it must be substantiated with documentary evidence; if false, it is a material misrepresentation under FCA COBS 4.2.1. ' ||
   'Loss-aversion framing: "leaving significant money on the table" anchors the risk of inaction as a certain loss, which is a manipulative framing technique inconsistent with FCA consumer duty outcomes on avoiding foreseeable harm. ' ||
   'When customer indicated they wished to consult their independent financial adviser, agent applied implicit additional pressure by suggesting the opportunity would expire. This conflicts with FCA guidance on advised sales. ' ||
   'No suitability questionnaire was initiated despite the product being high-risk and the minimum investment being GBP 50,000. ' ||
   'Recommend supervisor review before any onboarding step proceeds.',
   '2026-05-20 09:06:50+00'),

  ('de000005-0000-4000-8000-000000000005',
   'c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1',
   'd1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2',
   'eso-risk-v2.1', 'claude-opus-4-7', 51, 1720,
   'MEDIUM risk score assigned. Agent used informal and imprecise risk language without required formal disclosure. ' ||
   'The term "mostly safe" is not an FCA-compliant risk description. FCA COBS 14.3 requires that risk be described using standardised risk indicator language or equivalent clear terminology. ' ||
   'No formal risk disclosure statement was provided before discussing fund details and charges. ' ||
   'Suitability gap: the call proceeded to discuss product specifics without establishing the customer''s investment timeline, existing portfolio, or tax situation. ' ||
   'Risk level was self-described as stable based on NAV volatility, without acknowledging credit risk, liquidity risk, or duration risk inherent in bond funds during rising-rate environments. ' ||
   'Overall the call was not egregious but reflects a pattern of informal language that could mislead a retail investor. Recommend agent refresher on required risk disclosure wording.',
   '2026-05-20 10:08:20+00'),

  ('de000006-0000-4000-8000-000000000006',
   'e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3',
   'f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4',
   'eso-risk-v2.1', 'claude-opus-4-7', 44, 1640,
   'MEDIUM risk score assigned. Agent proceeded toward application without completing a suitability assessment for a first-time investor. ' ||
   'The customer explicitly stated they had never invested before, which under FCA COBS 9.2 triggers an enhanced suitability obligation. ' ||
   'Agent moved directly from discussing product returns to scheduling paperwork without establishing risk tolerance, investment objectives, or financial situation. ' ||
   'Returns were characterised as "averaged about six percent" without any past-performance disclaimer. ' ||
   'No mention of charges beyond the implicit five-year timeframe. No indication of potential loss scenarios. ' ||
   'While no egregious misrepresentations were detected, the structural compliance gap (missing suitability assessment for a vulnerable first-time investor) warrants monitoring and agent coaching.',
   '2026-05-20 08:38:20+00'),

  ('de000007-0000-4000-8000-000000000007',
   'a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5',
   'b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
   'eso-risk-v2.1', 'claude-opus-4-7', 38, 1580,
   'MEDIUM risk score assigned, trending toward low. One mild urgency flag detected. ' ||
   'The phrase "lock in while rates are good" implies time pressure without quantifying or documenting the rate risk. While rate outlook commentary is permissible, framing it as urgency without appropriate caveats is a borderline concern. ' ||
   'Agent appropriately disclosed FSCS protection limits, mentioned the full terms and conditions would be sent, and did not make guarantee claims. ' ||
   'No suitability assessment was conducted on this call, which is a gap, but the call ended without proceeding to application. ' ||
   'Overall tone was informational rather than pressured. The mild urgency flag is the primary driver of the MEDIUM classification. Agent coaching recommended on how to frame rate forecasts without implying pressure to act.',
   '2026-05-20 07:59:50+00'),

  ('de000008-0000-4000-8000-000000000008',
   'c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7',
   'd7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8',
   'eso-risk-v2.1', 'claude-opus-4-7', 18, 1410,
   'LOW risk score assigned. This call demonstrates exemplary compliance practice. ' ||
   'Agent opened with explicit recording consent and a clear statement that the call does not constitute regulated advice absent a suitability assessment — satisfying FCA COBS 9 pre-call obligations. ' ||
   'A formal risk tolerance question was asked using a calibrated scale, and the response was used to characterise the appropriate investment profile. ' ||
   'The required risk disclaimer ("value can go down as well as up, you may get back less than you invest") was delivered verbatim before any product discussion. ' ||
   'The cooling-off period entitlement was proactively disclosed. ' ||
   'Agent explicitly recommended independent financial advice. ' ||
   'No urgency language, no guarantee claims, no scarcity framing. Suitability assessment scheduled before any product recommendation. ' ||
   'This call should be used as a positive training example for the sales team.',
   '2026-05-20 10:27:20+00'),

  ('de000009-0000-4000-8000-000000000009',
   'e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9',
   'f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
   'eso-risk-v2.1', 'claude-opus-4-7', 9, 1290,
   'LOW risk score assigned. Near-perfect compliance. ' ||
   'Agent opened the annual review call with explicit recording consent and immediately provided the required past-performance disclaimer when reporting ISA returns. ' ||
   'When the customer enquired about increasing contributions, agent correctly declined to advise without a formal suitability review, and offered to schedule one — a textbook application of COBS 9.2. ' ||
   'Diversification was endorsed as a principle without recommending specific products, which is appropriate for an annual review call. ' ||
   'No flags of any category were detected. Call represents best-practice annual review conduct. ' ||
   'Recommend using this call as a compliance training benchmark.',
   '2026-05-20 09:58:50+00');

-- ─────────────────────────────────────────────────────────────────────────────
-- INTERVENTIONS (critical calls only)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO interventions (id, call_id, supervisor_id, action, note, triggered_at) VALUES
  ('de0a0001-0000-4000-8000-000000000001',
   'de000001-0000-4000-8000-000000000001',
   'demo|supervisor',
   'ALERT_AGENT',
   'Agent made explicit return guarantee and zero-risk claim to a retired customer. Stop soliciting investment immediately and refer to compliance.',
   '2026-05-20 09:33:10+00'),

  ('de0a0001-0000-4000-8000-000000000002',
   'de000001-0000-4000-8000-000000000001',
   'demo|supervisor',
   'NOTE',
   'Follow-up required: verify no transaction was processed. Escalate to compliance team for potential COBS 4.2 breach investigation.',
   '2026-05-20 09:35:00+00'),

  ('de0a0002-0000-4000-8000-000000000001',
   'de000002-0000-4000-8000-000000000002',
   'demo|supervisor',
   'PAUSE_CALL',
   'Pension transfer solicited with personal return guarantee and midnight deadline pressure. Call paused pending compliance review. No transfer may proceed today.',
   '2026-05-20 09:17:55+00');

END $SEED$;
