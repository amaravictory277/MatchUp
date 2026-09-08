# MatchUp Supabase Auth email templates

These are the production-ready HTML templates prepared for the hosted MatchUp Supabase project.

## Important

Hosted Supabase projects do **not** automatically load HTML templates from this repository. The templates must be pasted into **Supabase Dashboard → Authentication → Emails → Templates** for the hosted project.

The templates intentionally use Supabase's real Go-template variables such as `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .NewEmail }}`, `{{ .OldEmail }}`, `{{ .Provider }}`, and `{{ .FactorType }}`. Do not replace those variables with hard-coded URLs or tokens.

The logo is referenced from the current public MatchUp deployment:

`https://match-up-ten.vercel.app/icon.svg`

This is a website asset, not an email-sending domain. No SMTP, DNS, or sender credentials are configured here.

## Authentication templates

- `confirmation.html` — Confirm signup
- `recovery.html` — Reset password
- `email_change.html` — Confirm new email address
- `magic_link.html` — Magic link / passwordless sign-in
- `invite.html` — User invitation
- `reauthentication.html` — Reauthentication code

## Security notification templates

- `password_changed_notification.html`
- `email_changed_notification.html`
- `phone_changed_notification.html`
- `mfa_factor_enrolled_notification.html`
- `mfa_factor_unenrolled_notification.html`
- `identity_linked_notification.html`
- `identity_unlinked_notification.html`

## Sender limitation

The repository cannot change the actual `From` address or sender identity of Supabase's hosted default email service. `smtp_sender_name` is a custom-SMTP configuration option. Full sender-domain branding therefore requires a verified sending domain and custom SMTP later.

## Template design

The HTML uses conservative email-compatible tables, inline CSS, a hosted MatchUp logo with a text fallback, responsive sizing, and a single primary CTA. No JavaScript, external fonts, tracking pixels, or fake authentication links are used.
