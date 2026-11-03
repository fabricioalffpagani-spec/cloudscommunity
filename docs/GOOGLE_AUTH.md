# Google authentication configuration

The application uses Google OAuth 2.0 Authorization Code flow with OpenID Connect. Google identity is validated by the NestJS backend and is then converted into the existing `cc_session` application session.

Create a **Web application** OAuth client in Google Cloud Console and configure the consent screen. Request only `openid`, `email`, and `profile`. Add the application privacy policy and terms URLs and publish or add test users as appropriate.

## Local development

- Authorized JavaScript origin: `http://localhost:3000` (the redirect flow does not require browser SDK JavaScript, but this origin may be registered for clarity)
- Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
- `GOOGLE_OAUTH_CLIENT_ID`: the Web client ID
- `GOOGLE_OAUTH_CLIENT_SECRET`: the Web client secret, backend only
- `GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback`

## Production

- Authorized JavaScript origin: `https://cloudscommunity.com.br`
- Authorized redirect URI: `https://cloudscommunity.com.br/api/auth/google/callback`
- Set the same three variables in the backend secret store, using the production redirect URI above.

The callback intentionally uses the web domain because the existing Next.js BFF owns browser cookies and forwards the request to `https://api.cloudscommunity.com.br`. Do not register the API URL as the callback unless the deployment architecture is changed to set a shared parent-domain cookie directly.

The Client Secret must never be stored in `NEXT_PUBLIC_*`, committed files, or frontend runtime configuration. Production must use HTTPS. Redirect URIs are exact string matches in Google Cloud.
