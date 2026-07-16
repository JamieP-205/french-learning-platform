# Security

Please report a vulnerability through GitHub's private vulnerability reporting
for this repository. Do not include access tokens, learner records, email
addresses or production screenshots in a public issue.

The current `main` branch is the supported version.

Useful reports include:

- authentication or account-readiness bypasses
- learner data crossing account boundaries
- Supabase row-level security gaps
- tutor context receiving data outside its bounded source pack
- service-role or OpenAI credentials reaching browser code
- a no-account route writing to production storage
- privacy export or deletion failures

General curriculum corrections and interface bugs can use normal issues as long
as they contain no personal data.
