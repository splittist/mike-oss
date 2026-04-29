-- Migration: enforce one share row per (workflow, recipient email) so
-- re-sharing to the same person updates the existing row instead of
-- creating duplicates. Without this, DELETE only removes one of N copies
-- and the recipient retains access after the owner thinks they revoked.

-- Collapse any existing duplicates first, keeping the most recent row.
delete from public.workflow_shares a
using public.workflow_shares b
where a.workflow_id = b.workflow_id
  and a.shared_with_email = b.shared_with_email
  and a.created_at < b.created_at;

alter table public.workflow_shares
    add constraint workflow_shares_workflow_email_unique
    unique (workflow_id, shared_with_email);
