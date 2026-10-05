import type { GmailMessage } from "../mail/gmail.ts";
import { addressOf, header } from "../mail/parse.ts";

/** Intents Meerko detects by rules. Everything else is a plain reply for the user's agent to classify. */
export type RuleIntent = "bounce" | "out_of_office" | "unsubscribe";

/** Intents the user's agent can set on a reply. */
export const AGENT_INTENTS = ["interested", "not_interested", "not_now", "question", "referral", "wrong_person", "other"] as const;
export type AgentIntent = (typeof AGENT_INTENTS)[number];

const BOUNCE_SENDER = /^(mailer-daemon|postmaster)@/i;
const BOUNCE_SUBJECT = /(delivery status notification \(failure\)|undeliverable|undelivered mail|mail delivery (failed|failure|subsystem)|returned mail|delivery has failed|no se ha podido entregar|non remis|unzustellbar)/i;

const OOO_SUBJECT = /(out of (the )?office|automatic reply|auto(matic)?[- ]?reply|autoreply|away from (the )?office|on (annual )?leave|vacation|fuera de la oficina|respuesta autom[aá]tica|ausencia|absence|absent|abwesen|abwesenheit|r[ée]ponse automatique|risposta automatica|resposta autom[aá]tica)/i;

// Matched against the reply's own text only (quoted history removed), and only when it's short.
const UNSUBSCRIBE_TEXT = /\b(unsubscribe|remove me|take me off|stop (emailing|contacting|sending)|don'?t (email|contact) me|opt[- ]?out|not interested,? (please )?remove|darme de baja|dame de baja|b[oó]rrame|no me (escrib|contact)|qu[ií]tame|d[ée]sinscri|d[ée]sabonn|abmelden|austragen)\b/i;

/**
 * Classifies an inbound message with cheap, deterministic rules. Returns null for a normal reply.
 * Bounces and auto-replies are detected from headers first, since their wording varies by server and language.
 */
export function classifyByRules(msg: GmailMessage, replyText: string, originalSubject?: string): RuleIntent | null {
  const from = addressOf(header(msg, "From"));
  const subject = header(msg, "Subject") ?? "";
  // "Automatic reply: Re: <our subject>": test only what the other side added, so our own wording can't match.
  const addedSubject = originalSubject ? subject.split(originalSubject).join(" ") : subject;
  if (BOUNCE_SENDER.test(from) || header(msg, "X-Failed-Recipients") || (BOUNCE_SUBJECT.test(subject) && /daemon|postmaster|mail.?delivery/i.test(from))) {
    return "bounce";
  }

  const autoSubmitted = header(msg, "Auto-Submitted");
  const precedence = header(msg, "Precedence");
  if (
    (autoSubmitted && autoSubmitted.toLowerCase() !== "no") ||
    header(msg, "X-Autoreply") ||
    header(msg, "X-Autorespond") ||
    /auto_reply/i.test(precedence ?? "") ||
    OOO_SUBJECT.test(addedSubject)
  ) {
    return "out_of_office";
  }

  // A long reply that mentions "unsubscribe" is probably a real conversation; leave it to the agent.
  if (replyText.length <= 300 && UNSUBSCRIBE_TEXT.test(replyText)) return "unsubscribe";
  return null;
}
