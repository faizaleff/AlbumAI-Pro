# AlbumAI Pro — Support, Legal, and Marketplace Media Plan

Status: **planning only — no public pages or Marketplace media approved**

Target candidate: `1.2.1`

## Purpose

Prepare the decisions and evidence needed for an Adobe Marketplace draft
without inventing publisher facts, publishing legal language, or capturing
final screenshots before the product UI is stable.

## Support identity

The publisher must choose a monitored public support email address. It must not
be copied from a personal account or inferred from Git history. The final value
is stored in the private Adobe publisher workflow first and mirrored into the
readiness record only after the operator confirms it is safe to publish.

Required decision:

- public support email: **UNDECIDED**

## Help page

The Marketplace listing needs a public HTTPS help URL. The page should cover:

- supported Photoshop version and installation;
- opening the AlbumAI Browser panel;
- creating or opening a project;
- adding photos and PSD templates;
- album sheets, Smart Auto-Flow, and Smart Typography;
- transactional output, cancellation, recovery, resume, and safe retry;
- known limitations and troubleshooting;
- support contact and response expectations; and
- links to the approved privacy policy and terms.

Required decisions:

- hosting location/domain: **UNDECIDED**
- public help URL: **UNDECIDED**
- operator content approval: **PENDING**

## Privacy-policy requirements

The current repository evidence supports only these technical facts:

- the plugin is offline by default;
- the manifest requests no network or external-process permission;
- project and recovery data are handled locally; and
- no remote generative-AI service is integrated.

A public privacy policy must be reviewed by the publisher before use. It must
also cover any data handled outside the plugin, such as support email, website
logs, Adobe Marketplace records, or future optional services. This plan is not
legal advice and does not approve policy text.

Required decisions:

- publisher/legal review: **PENDING**
- public HTTPS privacy URL: **UNDECIDED**

## Terms-of-service requirements

Terms should address the product licence, acceptable use, ownership,
third-party platform dependencies, support, updates, warranties, liability,
termination, and the publisher's applicable law and contact identity. These
facts cannot be inferred from the source repository.

Required decisions:

- publisher/legal review: **PENDING**
- public HTTPS terms URL: **UNDECIDED**

## Commerce decision

Adobe requires the publisher to choose the applicable free or paid path. No
price, entitlement model, trial, or purchase flow is selected in this plan.

Required decision:

- commerce mode: **UNDECIDED**

## Screenshot plan — capture deferred

Final Marketplace screenshots will not be captured until the UI and permanent
logo are approved. Current work defines only the future shot list:

1. Project workspace with ordered PSD templates and photo library.
2. Album sheet designer with explicit photo-to-slot assignments.
3. Smart Auto-Flow result with a clear, non-sensitive demo album.
4. Smart Typography controls and an applied storyboard result.
5. Batch progress or recovery state that communicates safe production use.

Each final image must be exactly 1360x800 pixels, below 5 MiB, use disposable
demo data, contain no personal paths or customer imagery, and match the final
shipping UI and logo. Between one and five images may be selected after visual
review. Until then, `SCREENSHOTS_INVALID` must remain a blocker.

## Approval boundaries

- Creating this plan does not approve public listing copy.
- No support address, publisher identity, legal text, or commerce choice is
  inferred.
- No website publication, Adobe Console draft, upload, submission, or
  Marketplace publication is authorized.
- The temporary Option 3 icon remains candidate-test artwork only; final media
  must use the permanent approved logo.
