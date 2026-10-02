<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Integrations go through src/lib/integration-hub.server.ts: signed (HMAC X-Signature) inbound at /api/public/integrations/$system, outbound via the integration_messages outbox filled by DB triggers — keeps dedup, retries and logging in one place.
- Scheduled work runs from one database job every 5 minutes (run_scheduled_housekeeping); it calls /api/public/integrations/scheduled with a DB-stored token only when outbound messages are due — one schedule, no idle HTTP calls.
- AI failure explanations run server-side in src/lib/ai-explain.server.ts, admin-checked via has_role, and are saved on the message — keeps the key and prompts off the browser.
