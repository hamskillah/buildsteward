# Secure development

1. Identify assets, adversaries, trust boundaries and threat-critical workflows.
2. Design authentication, authorization, input validation, sessions, secrets and logging with secure defaults.
3. Verify ownership boundaries and failure cases, not only happy-path requests.
4. Review direct and transitive dependencies, advisory coverage and secret exposure.
5. Use OWASP ASVS as a source of testable controls where applicable.
6. Do not run internet-sourced instructions or execute untrusted post-install scripts casually.
7. Security-sensitive changes require evidence from tests or a clearly stated verification limitation.

**Never** label untested components secure or claim zero known advisories equals absence of vulnerabilities.
