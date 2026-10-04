# Google login + Forgot password: setup guide

## What changed
- **Forgot password:** "Forgot password?" link on the login page, an email with a one-time link (valid 30 minutes), and a "choose a new password" page.
- **Google login:** a "Continue with Google" button on the login page. It creates an account the first time.
- **Security fix:** the old Google code accepted unverified logins and made anyone with "admin" or "raji" in their email an admin. Now the Google token is always verified, and admins are only the emails you list in `ADMIN_EMAILS`.

## Part A: Upload the new files to GitHub
1. Unzip `medfind-login-update.zip`. It contains `backend` and `frontend` folders holding only the changed files.
2. Open your repository on github.com, click **Add file > Upload files**.
3. Drag the `backend` and `frontend` folders in. GitHub will replace the files that have the same names and add the new ones.
4. Click **Commit changes**. Render rebuilds on its own (about 10 minutes).

## Part B: Make a Google Client ID (free)
1. Go to console.cloud.google.com and sign in. Click the project picker at the top, then **New Project**, name it `MedFind`, and create it.
2. Open the menu (three lines) > **APIs & Services** > **OAuth consent screen** (newer screens call it **Google Auth Platform**). Choose **External**, fill in the app name `MedFind` and your email, and save. In **Audience** (or "Publishing status"), click **Publish app** so anyone can sign in, not just test users.
3. Go to **Credentials** (or **Clients**) > **Create credentials > OAuth client ID** > type **Web application**.
4. Under **Authorized JavaScript origins** click **Add URI** and paste your Render address, for example `https://medfind-xxxx.onrender.com` (no slash at the end, nothing after `.com`). You can leave "Authorized redirect URIs" empty.
5. Click **Create** and copy the **Client ID** (it ends with `.apps.googleusercontent.com`). You do NOT need the client secret.

Google's screens change from time to time, so the names may differ slightly.

## Part C: Free email sending with Brevo (for the reset link)
Render's free plan blocks normal Gmail sending, so we use Brevo's web API. It is free for 300 emails a day.
1. Sign up at brevo.com.
2. **Senders, Domains & Dedicated IPs > Senders > Add a sender**: enter your email and verify it from the email Brevo sends you.
3. Open **SMTP & API > API Keys > Generate a new API key**. Copy it (it starts with `xkeysib-`).

## Part D: Add settings in Render
Render dashboard > your service > **Environment > Add Environment Variable**. Add:

| Key | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the Client ID from Part B |
| `ADMIN_EMAILS` | the email(s) that should be admins, separated by commas |
| `BREVO_API_KEY` | the key from Part C |
| `SENDER_EMAIL` | the verified sender email from Part C |

Click **Save Changes**. Render restarts the service.

## Test it
- **Google:** open your site > Log In > the "Continue with Google" button should appear under the form.
- **Forgot password:** create an account, log out, click **Forgot password?**, enter your email, open the email, click the button, set a new password, and log in with it. Check your spam folder if you don't see the email.
- **Admin Google login:** it asks for a 6-digit code sent to your email, so it needs Part C to be working.

## If you skip Brevo (testing only)
Everything still works, but no real email is sent. The reset link is printed in the log: Render > your service > **Logs** > search for `reset-password` and copy the link into your browser. Admin codes are printed the same way.

## Free-plan reminder
When Render restarts the free service, the database goes back to the starter data, so accounts you created disappear. For permanent accounts you need a paid disk or an outside free database.

## Still not secure enough for real users
- Admin pages trust a header the browser sends (`X-User-Role: admin`), so a determined person can fake it.
- Passwords are stored with plain SHA-256 (no salt).
Fix both before real people use the site.
