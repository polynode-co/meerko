---
name: meerko-write-sequence
description: "Draft a 3-step email sequence for a table, in your voice. Uses the Meerko connector."
---

# Write a sequence

Use the tools of the Meerko connector. If they aren't available, ask me to connect Meerko first.

Write a 3-step cold email sequence for the Meerko table "the table I name". The offer: what I say I'm offering, if it isn't obvious.
- Short, plain-text, one clear ask per email; personalise with {{first_name}}, {{company}} and other columns the table has.
- Step 1 gets a subject; steps 2 and 3 reply in the same thread 3 and 4 days later.
- Send from every healthy mailbox I have (list_mailboxes with check_domains; skip ones in error, and tell me about any missing DNS record), create it with manage_sequence (action "create"), then show me list_sequences (view "preview") for two rows.
Don't enroll anyone or start the sequence until I say so.
