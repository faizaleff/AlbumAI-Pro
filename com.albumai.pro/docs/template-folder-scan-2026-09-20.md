# Template folder discovery and stable Design status

Project open and explicit revalidation now discover unregistered PSD files in the project Templates folder. Each file is inspected through a temporary copy; working source documents are preserved. Detected slots are registered before the existing availability validation/persistence transaction. Existing registrations are not duplicated, unreadable files are reported, and execution-only preflights do not import new files.

Design has one fixed-height status row instead of conditional stacked notices. The empty-state action uses an explicit flex column and spacing; toolbar actions can wrap.

Validation: ALB-083 249 assertions, ALB-081 181 assertions, production build and diff check passed. Installed in the existing external plugin. Live reload pending: current user has a new unapplied draft on 03.psd; asked to apply/save album before restart without saving source PSD.

Live verification: applied the approved user draft (10.jpg, 175% zoom), saved album, restarted without saving source PSD. Project open discovered 01.psd and 02.psd alongside existing 03.psd. Persisted registry and panel show three READY templates with 1/5/6 slots. Created then discarded a test zoom draft: center preview remained at the same position with/without the status notice. Arrange photos dialog displayed without overlap; closed without generating spreads. Empty-state layout was not exercised live in this pass.
