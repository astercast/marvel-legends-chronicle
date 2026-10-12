/* lib/cronauth.js — shared CRON_SECRET gate (marvel-legends-chronicle).
 * Canonical copy per ARCHITECTURE.md §1.11. Copy verbatim between repos;
 * do not fork behavior.
 *
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on cron
 * invocations when CRON_SECRET is set. Fail closed: if CRON_SECRET is unset,
 * or the header is missing/wrong, the caller must 401 with code UNAUTHORIZED
 * and never run the refresh.
 *
 * assertCron(req) -> true iff authorized.
 */
"use strict";

function assertCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed — never run an unprotected refresh
  const header = (req.headers && req.headers.authorization) || "";
  return header === "Bearer " + secret;
}

module.exports = { assertCron };
