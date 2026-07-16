# Public source snapshot

This repository is the reviewed public copy of French for Life. Day-to-day work
happens in a private repository so deployment setup, account-provider testing
and unfinished notes are not published by accident.

The public snapshot includes the application, curriculum and provenance tools,
database migrations, browser audio, technical docs and complete automated test
suite. It excludes credentials, learner records, generated build output and
private environment notes.

Before publication, the working repository compares every shared file by path
and SHA-256 checksum. The public branch then runs the same release gate again.
Repository-specific README, security, contribution and CI files are reviewed
separately because their audience is different.

This split is about publication control, not a reduced demonstration: the code
and tests required to understand the learning model are kept together here.
