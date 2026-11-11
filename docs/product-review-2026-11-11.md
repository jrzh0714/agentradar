# AgentRadar product review and daily publishing plan

Reviewed November 11, 2026. This is a product assessment and proposed design,
not a report of implemented features or a promise of release readiness.

## Evidence and limits

Reviewed the current homepage, digest, and status HTML; the source for homepage
selection, search, cards, item details, ranking, trend detection, digest
generation, RSS, and localization; and the repository's desktop, mobile, and
social screenshots. Those screenshots are older reference material, not a new
visual/accessibility audit. No user interviews, funnel data, or usability
sessions were available. Audience and channel recommendations below are
hypotheses to validate. No accounts were created or posts published.

Live observations:

- Homepage: 3.2k enriched items, 715 GitHub repositories, 2.4k RSS articles, 92 HN
  stories. It says “updated daily” and “last updated today.”
- Status: 0% displayed success; the latest run ingested 316 items and enriched
  zero. All 14 displayed runs failed. The displayed “7-day” metric actually uses
  the last seven runs in code, not a calendar window.
- Trending: all eight visible candidates were GitHub projects; their displayed
  dates were in October. An old project can have new momentum, but no measured
  momentum or observation window is shown to establish that here.
- Homepage “This week”: the first six items repeat the beginning of Top Picks,
  including LangChain and Dify. The source explicitly falls back to Top Picks
  when fewer than three weekly candidates exist, without changing the heading.
- Digest: labelled “Week of November 2, 2026”; several featured repositories
  show “4w ago.” The current digest query has no weekly time constraint.

Public evidence: [homepage](https://agentradarlive.vercel.app/),
[digest](https://agentradarlive.vercel.app/digest),
[status](https://agentradarlive.vercel.app/status).
These observations establish inconsistent product promises; they do not
establish the underlying provider or infrastructure failure cause.

## Product direction

Proposed promise: **Know what changed in AI tooling, why it matters to your
work, and what is worth trying next—in five minutes.**

Start with engineers actively building agent-based applications and the
technical leads choosing their tools. Avoid simultaneously serving every AI
enthusiast, researcher, marketer, and investor. The Chinese experience can
serve the same engineering jobs with localized interpretation.

Three primary jobs:

1. Daily awareness: what changed since my last visit?
2. Active evaluation: which tool fits the problem I am solving?
3. Follow-through: save, try, or share a useful finding and revisit its progress.

The existing identity, restrained technical styling, source links, classified
corpus, and bilingual foundation are useful. The missing value is editorial
judgment and decision support. More items and more badges do not supply that.

## Section-by-section decisions

### Navigation

Current navigation emphasizes search, digest, and pipeline status, with digest
and status hidden on small screens. There is no main journey for returning
readers or social visitors.

Use Today, Explore, Weekly, and Saved as the main destinations. Put methodology,
data status, feedback, and attribution in the footer. Keep Weekly reachable on
mobile through a menu. Make every brand wordmark a home link. Saved can begin
as browser-local bookmarks with a clear device-only explanation; an account
system is not required to test the behavior.

### Hero and statistics

The headline repeats the brand. Supporting text explains ingestion and scoring
before showing a useful discovery. Corpus counts measure inventory, not the
reader's benefit. The older mobile screenshot requires substantial scrolling
before the first finding.

Replace the long introduction with the outcome promise, today's edition date,
and one primary action: Read today's briefing. Secondary action: Find a tool.
Show a small set of specific findings immediately. Move infrastructure prose
to How we select findings. Use actual “new verified findings” and last successful
briefing time only when those records exist.

Separate source checking, enrichment, and editorial publication timestamps.
The current maximum item `updated_at` can change during unrelated writes; it
does not prove that the daily briefing is fresh. During an outage, show the
last complete edition with its real date and an understated delay notice.

### Trending Now

The current flag is a change in a composite ranking score. That score mixes
relevance, recency, source weights, and total popularity. The fallback supplies
high-ranking recent candidates when there are insufficient flags. Neither
selection alone proves genuine momentum.

Rename the fallback to Worth a look. Reserve Rising for measured changes with
an explicit interval, such as stars gained over seven days or independently
observed discussion growth. Show the observation time and missing-data state.
Use a minimum baseline and absolute-change threshold so tiny counts do not
produce misleading percentages. Keep emerging tools separate from major
established projects. Do not infer that a repository is new from its last push.

### This week

This section promises emerging discoveries, but its silent fallback repeats
established Top Picks. That makes the reader spend time re-evaluating the same
items and undermines the claim of finding things early.

Select genuine events from the declared edition window. Show fewer than six
when warranted. If no qualifying changes exist, say so or show a separately
labelled evergreen collection. Never relabel all-time recommendations as this
week's changes. Remove overlap with the daily lead unless an explicitly labelled
weekly recap adds new synthesis.

### Top Picks

High total stars and source weighting favor established repositories. Twelve
similar cards make readers do the prioritization themselves. The visible
10-point score is AI relevance, not a tested quality score.

Lead with three to five editorial recommendations, each with a reason to
appear today, intended user, evidence, and caveat. Separate New discoveries,
Major updates, and Proven tools. Use human review before describing something
as an editor's pick. Until then, label it algorithmic selection. Keep numeric
scores in methodology/details rather than using unexplained precision as the
primary decision cue.

### AI News & Research

The current section mixes research, product announcements, infrastructure,
frameworks, and model releases. Its View all link only selects Research, so it
does not preserve the scope of what the reader was browsing.

Present Research and Model/tool updates as separate lenses. For research show
the question, reported result, evaluation scope, limitation, and primary paper.
For announcements show the changed capability, availability, and practical
effect. Attribute vendor claims. Section links must preserve the section's
actual filters. One announcement covered by several sources should become one
finding with supporting links.

### Latest High-Signal

This overlaps News and Top Picks but offers no explicit “since last visit”
benefit. Publication time, discovery time, and a repository push mean different
things.

Make this the chronological Changes feed: New release, Integration, Research,
Pricing change, Deprecation, or Newly discovered. Distinguish first published
from first seen by AgentRadar. Group by day and support a clear caught-up state.
Unknown dates remain unknown. Backfilled old articles must not appear as new
announcements.

### Agent & MCP Tools

Framework/category browsing helps readers who already know the vocabulary, but
not readers asking “how do I connect a coding agent to my database?”

Add task collections: Build an agent, Connect tools, Evaluate outputs, Debug
failures, and Run privately. Within them show language, deployment model,
integration compatibility, license, and documented setup. Populate unknowns
honestly. Keep the technical taxonomy as a secondary filter. The current View
all link selects only AI Agents even though the section includes MCP, Code
Agents, and Workflow Automation; align it with the displayed scope.

### Cards

Cards devote substantial space to source, score, category, maturity, tags,
stars, and date. The differentiating reason to care is small or omitted in
compact mode. The title links internally while a small arrow leaves the site;
weekly highlight cards instead navigate externally.

Use a consistent content order: readable name; specific problem or change;
reason it is useful; one evidence cue; caveat or maturity disclosure. Provide
explicit Read briefing, Source, and Save actions. Keep titles opening the
briefing consistently. Let dense list mode handle scanning and compact cards
handle featured recommendations. Treat AI-assessed maturity as an estimate;
“stable” must not imply hands-on validation.

### Search / Explore

The interface exposes many taxonomy and score controls before a reader has
stated their task. “Best match” sorts by global ranking, not query relevance.
The result set stops at 60 with no way to browse the remainder. Query failures
return the same empty structure as a genuine zero-match result.

Offer task examples and saved collections above advanced filters. Add load more
or pagination, contextual filter counts, and a separate load-failure state.
Either implement text relevance or relabel the current default Recommended.
Offer useful comparison fields once verified data exists. Ask research users to
find a tool for a concrete task and explain why they chose it; task success is
more useful than testing whether filters technically work.

### Item detail

The detail page mostly expands the same summary and taxonomy shown on a card.
It lacks evidence-linked limitations, a concrete way to evaluate the tool,
meaningful alternatives, and a reason to save it.

Make it a decision brief: what it does; what changed; good fit / poor fit;
evidence; how to try it; limitations; alternatives; sources and checked date.
Separate Source claims, AgentRadar interpretation, and Hands-on tested status.
Do not invent setup duration, benchmarks, pricing, integrations, or license.
Link claims to exact releases/docs/paper sections. Explain alternatives by
tradeoff; “same category” and “same source” are not enough to establish that two
tools solve the same problem. Add a correction/report mechanism and related
updates for the same project.

### Weekly digest

Thirty ranked items across six sections are a directory selection rather than
an editorial briefing. The editor's note is generic static text. The date label
is derived at render time while the selected items have no weekly constraint.
Generated summaries use category keys, but display lookup uses section titles;
that mismatch needs checking before relying on the summaries.

Publish an edition with stable membership, coverage window, publication time,
and permalink. Start with three takeaways, then five to ten findings with
implications. Generate section summaries from the exact edition members using
shared section identifiers. Include a short What we would try next section
only when there is a defensible recommendation. Keep an archive and correction
history. An old edition remains an old edition when the pipeline is delayed.

### Follow, RSS, and return visits

The disabled-email module makes an unavailable feature prominent. RSS contains
the current digest selection rather than an append-only stream of findings.
There is no saved shortlist or alert for a watched tool.

Replace the closed-waitlist pitch with available actions: Follow daily findings,
RSS, and Save this collection. Add social links only after accounts exist.
RSS should keep stable IDs and distinguish findings from editions. Test
browser-local saves and topic preferences before building authentication,
notifications, or paid plans. Email should follow demonstrated demand and a
complete subscription lifecycle.

### Status, methodology, and trust

Pipeline health is useful evidence, but should support the reader's task rather
than dominate primary navigation. “7-day success” must be a calendar metric or
be named Last seven runs. A success percentage is not a freshness guarantee.

Show reader-facing coverage: last complete briefing, source coverage, delayed
sources, and limitations. Retain technical diagnostics separately. Publish how
selection works, what the scores mean, whether testing occurred, and how to
request a correction. Fix contradictory freshness claims before acquisition.

### Language, mobile, and visual design

Retain the technical character, but use readable body type and stronger visual
priority for findings, with fewer competing pills and less uppercase microcopy.
The older screenshots support a hierarchy critique, not a claim that current
contrast still fails after earlier CSS fixes.

Keep headline, finding, and next action visible early on mobile. Place advanced
filters in an accessible expandable panel. Test keyboard, touch, light theme,
reduced motion, long titles, and EN/Chinese switching. Some current labels,
section titles, dates, and filters remain English; mark untranslated content
clearly and verify full end-to-end task flows. Social localization should adapt
the interpretation to its audience while preserving technical names and facts.

## Proposed information architecture

Today → today's dated briefing → three lead findings → changes feed → task
collections → follow/save.

Explore → task or keyword → filtered results → decision brief → source,
shortlist, or useful comparison.

Weekly → stable dated edition → takeaways → findings → archive.

Social post → the exact finding or dated edition → supporting evidence → next
useful action. Do not route every social click to a generic homepage.

## One evidence record for product and social

The present item is mostly an entity or article. Daily publishing needs a
separate finding/event record: a known project can produce a new finding when
it ships a meaningful update. Separate these concepts before building a social
text generator.

Proposed minimum record:

- Project/entity ID and deduplicated finding ID.
- Finding type, factual headline, short explanation, intended user, limitation.
- Source URLs, supporting excerpts or references, original publication time,
  first-seen time, and last verification time.
- Evidence state: source announced, independently corroborated, or hands-on
  tested. These are explicit states, not a single opaque confidence number.
- Review state, reviewer, approval time, correction history.
- Edition memberships and publication history by channel and language.
- Whether media use is permitted and where the visual came from.

This record is the source of truth for site briefs, RSS, weekly editions, and
social drafts. Recheck time-sensitive claims before publication. A model's
summary or score is never supporting evidence for its own claim.

## Daily social publishing

### Positioning and channel

Account promise: “Practical AI tooling findings for builders: what changed,
who it helps, and what to check before adopting.” Publish useful findings rather
than repeated advertisements for AgentRadar.

Choose one primary channel for a four-week pilot. LinkedIn is a reasonable
initial hypothesis for engineering teams evaluating tools; X is a reasonable
alternative for rapid developer discussion. This is positioning judgment, not
evidence that either will outperform for this audience. Use existing founder
distribution if available; validate with qualified visits and return behavior.
Do not launch separate English/Chinese daily operations until review capacity
and demand support them.

LinkedIn's official guidance emphasizes original useful content, audience
understanding, and analytics. X permits authorized informational automation but
restricts duplicate/spammy posts and website scripting. Any scheduling design
must use supported integrations and current channel rules.

Sources:
- https://business.linkedin.com/advertise/linkedin-pages/best-practices
- https://business.linkedin.com/content/dam/lem/business/en/advertise/linkedin-pages/lms-linkedin-page-posting-best-practices-one-pager.pdf
- https://help.x.com/en/rules-and-policies/x-automation

### Editorial workflow

1. Discover and group candidates by underlying event/project.
2. Select candidates for actual novelty, audience fit, evidence, practical
   usefulness, and variety. Exclude already published findings unless the new
   change is explicit.
3. Verify primary sources and time-sensitive claims. Unknowns are permitted;
   unsupported superlatives and inferred hands-on results are not.
4. Draft the site brief and channel-specific copy from the same evidence record.
5. Human review approves the factual claim, wording, date, links, and visual.
6. Publish once; record channel, post URL, finding ID, and edition. Retry safely
   without creating duplicate posts. Pause publication when source freshness or
   pipeline health is unproven.
7. Collect feedback and attribution; publish corrections when needed.

The first version can be an internal queue with Copy post and Download card.
Automate publishing only after the review workflow produces consistently good
approved output. Account creation and public posting are separate execution
steps, not part of this assessment.

### Formats and cadence

Start with one reviewed finding each weekday. Add weekend posts only if supply
and editorial capacity justify them. A daily research habit does not require
seven weak discovery posts every week. If seven-day publication is required,
use clearly labelled explainers, tests, or weekly synthesis on quieter days.

Suggested mix: two tool/change spotlights, one practical walkthrough, one
comparison with evidence, one weekly synthesis. Rotate topics based on the
audience's work, not an obligation to fill every source category. Label evergreen
guides and comparisons honestly; do not call them new releases.

Draft structure:

> [Concrete problem or verified change]
>
> [What the source actually establishes.]
> Useful if you [specific task].
> Check first: [limitation or unknown].
>
> Source: [primary link]
> Brief and alternatives: [finding permalink]

This is a template, not a verified current finding. Do not publish placeholder
facts. Screenshots of the whole website and “we index thousands of tools” are
launch collateral, not a repeatable findings series. Existing social graphics
contain older beta/provider/corpus claims; update and verify them before use.

A repeatable findings card should show a legible headline, the problem solved,
one evidenced change, date, source, and a small AgentRadar mark. Keep supporting
detail in the caption and linked brief. Use original diagrams or permitted
assets; never present generated visuals as proof of product behavior.

## Priorities and acceptance criteria

### First: restore the factual product promise

- Repair the failed pipeline, then show the last complete verified edition time.
- Remove unearned daily/weekly/trending claims and fallback relabelling.
- Correct date semantics, source labeling, stale assets, and section link scope.
- Make a small reviewed set useful even while historical backfill is incomplete.

Done when: each featured finding has a source, an actual event or discovery
date, a checked time, and an honest reason to appear; outages visibly preserve
the last real edition; the site never claims a new briefing solely because
database rows were touched.

### Next: build the daily briefing and decision brief

- Introduce evidence-backed finding records and a review queue.
- Rework the homepage around three useful lead findings.
- Expand details with fit, caveats, sources, and a practical next step.
- Add search pagination and load-error handling; repair misleading sort labels.

Done when: in a five-person formative test with target engineers, at least four
can identify a relevant finding, describe what changed, find its evidence, and
choose a next action within five minutes. This is an initial usability gate,
not a statistically established conversion benchmark.

### Then: validate distribution and retention

- Create a channel-appropriate account and complete the review-led posting pilot.
- Add dated edition links, post attribution, browser-local saves, and correction
  feedback. Avoid gating primary sources behind signup.
- Build weekly editions from the actual published findings.

Done when: a four-week pilot establishes which findings bring target readers,
whether those readers take useful actions, and whether they return. Scale
cadence and automation only after this baseline exists.

## Measurement and research

Primary product outcome: weekly returning readers who save a finding or open a
primary source after reading its brief. Treat this as a proxy for usefulness,
and validate it with interviews; clicks alone do not prove a successful adoption.

Measure briefing-to-detail, detail-to-source/save, seven-day return, search
completion, zero results versus errors, published finding freshness, correction
rate, and social-origin visitors who return. Use campaign tags and per-post
finding IDs. Keep analytics minimal and respect privacy choices.

For each pilot post, track subject, format, audience, review time, source click
rate where observable, attributed site visits, and qualified follow-through.
Follower count and impressions are supporting measures, not the product goal.
Do not set a universal best posting time or growth forecast without data.

Interview five to eight target engineers about their last real tool evaluation:
what triggered it, where they searched, what evidence they needed, and what made
them stop reading. Watch them use AgentRadar for that task. Validate the daily
brief manually before committing to advanced personalization, a chat interface,
paid subscriptions, or multi-channel autopublishing.
