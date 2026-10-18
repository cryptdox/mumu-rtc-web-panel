import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { account } from "@/api/account";
import { config } from "@/config";
import { AuthCard } from "@/components/layouts";
import { Turnstile } from "@/components/Turnstile";
import { Button, ErrorBox, Input, Loading, Notice } from "@/components/ui";

const MIN_PASSWORD = 8;

function MissingAccessCode() {
  return (
    <Notice tone="amber">
      VITE_IAM_ACCESS_CODE isn't configured, so sign-in can't reach IAM. Set it in <code>.env</code> and restart.
    </Notice>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const accessCode = config.iamAccessCode;

  const mutation = useMutation({
    mutationFn: () => login({ email, password, captchaToken: captcha ?? "" }),
    onSuccess: ({ isPlatformAdmin }) => navigate(from ?? (isPlatformAdmin ? "/admin" : "/app"), { replace: true }),
    // A Turnstile token is single-use — get a fresh one after any failure.
    onError: () => setResetKey((k) => k + 1),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back"
      footer={
        <>
          No account?{" "}
          <Link to="/register" className="font-medium text-brand-600">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {!accessCode && <MissingAccessCode />}
        {!config.turnstileSiteKey && (
          <Notice tone="amber">
            VITE_TURNSTILE_SITE_KEY isn't configured. IAM requires a CAPTCHA to sign in.
          </Notice>
        )}
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex justify-end text-sm">
          <Link to="/forgot-password" className="text-brand-600">
            Forgot password?
          </Link>
        </div>
        <Turnstile onToken={setCaptcha} resetKey={resetKey} />
        <ErrorBox error={mutation.error} />
        <Button type="submit" className="w-full" loading={mutation.isPending} disabled={!accessCode || !captcha}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}

export function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({ mutationFn: () => register({ name: name || undefined, email, password }) });

  if (mutation.isSuccess) {
    return (
      <AuthCard title="Check your inbox">
        <div className="space-y-4">
          <Notice tone="green">
            Account created for <b>{email}</b>. If email verification is enabled, follow the link we sent before signing in.
          </Notice>
          <Link to="/login">
            <Button className="w-full">Go to sign in</Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start building with MUMU RTC"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-600">
            Sign in
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        {!config.iamAccessCode && <MissingAccessCode />}
        <Input label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          hint={`At least ${MIN_PASSWORD} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ErrorBox error={mutation.error} />
        <Button type="submit" className="w-full" loading={mutation.isPending} disabled={!config.iamAccessCode}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const mutation = useMutation({ mutationFn: () => account.sendResetPassword(email) });

  return (
    <AuthCard title="Reset your password" footer={<Link to="/login" className="text-brand-600">Back to sign in</Link>}>
      {mutation.isSuccess ? (
        <Notice tone="green">If an account exists for {email}, a reset link is on its way.</Notice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <ErrorBox error={mutation.error} />
          <Button type="submit" className="w-full" loading={mutation.isPending}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

/** Landing page for the IAM email link: /reset-password?token=… */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mutation = useMutation({ mutationFn: () => account.resetPassword({ resetToken: token, newPassword: password }) });

  return (
    <AuthCard title="Choose a new password">
      {!token ? (
        <Notice tone="amber">This link is missing its token. Request a new reset email.</Notice>
      ) : mutation.isSuccess ? (
        <div className="space-y-4">
          <Notice tone="green">Password updated.</Notice>
          <Link to="/login">
            <Button className="w-full">Sign in</Button>
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <Input label="New password" type="password" required minLength={MIN_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input label="Confirm password" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {confirm && confirm !== password && <p className="text-xs text-red-600">Passwords don't match</p>}
          <ErrorBox error={mutation.error} />
          <Button type="submit" className="w-full" loading={mutation.isPending} disabled={password !== confirm}>
            Update password
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

/** Landing page for the IAM email link: /verify-email?token=… */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const mutation = useMutation({ mutationFn: () => account.verifyEmail(token) });
  const { mutate } = mutation;
  const started = useRef(false);

  // Tokens are single-use: guard against StrictMode's double effect run.
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      mutate();
    }
  }, [token, mutate]);

  return (
    <AuthCard title="Email verification">
      {!token ? (
        <Notice tone="amber">This link is missing its token.</Notice>
      ) : mutation.isPending || mutation.isIdle ? (
        <Loading label="Verifying…" />
      ) : mutation.isSuccess ? (
        <div className="space-y-4">
          <Notice tone="green">Your email is verified.</Notice>
          <Link to="/login">
            <Button className="w-full">Sign in</Button>
          </Link>
        </div>
      ) : (
        <ErrorBox error={mutation.error} />
      )}
    </AuthCard>
  );
}

export function NotFound() {
  return (
    <AuthCard title="Page not found" subtitle="The page you're looking for doesn't exist.">
      <Link to="/">
        <Button className="w-full">Go home</Button>
      </Link>
    </AuthCard>
  );
}
