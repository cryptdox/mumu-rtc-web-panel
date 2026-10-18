import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { account } from "@/api/account";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, ErrorBox, Input, Notice, PageHeader } from "@/components/ui";

export default function Account() {
  const { user, isAdmin, updateUser } = useAuth();
  const me = useQuery({ queryKey: ["me"], queryFn: account.me });
  const profile = me.data ?? user;

  const [name, setName] = useState(profile?.name ?? "");
  useEffect(() => setName(me.data?.name ?? user?.name ?? ""), [me.data, user?.name]);

  const save = useMutation({
    mutationFn: () => account.updateMe({ name }),
    onSuccess: () => updateUser({ name }),
  });
  const resend = useMutation({ mutationFn: account.resendVerifyEmail });

  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = useMutation({
    mutationFn: () => account.changePassword({ oldPassword, newPassword }),
    onSuccess: () => {
      setOld("");
      setNew("");
      setConfirm("");
    },
  });

  return (
    <>
      <PageHeader title="Account" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{profile?.email}</span>
              {profile?.isEmailVerified ? <Badge tone="green">verified</Badge> : <Badge tone="amber">not verified</Badge>}
              {isAdmin && <Badge tone="blue">platform admin</Badge>}
            </div>
            {profile && !profile.isEmailVerified && (
              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" size="sm" loading={resend.isPending} onClick={() => resend.mutate()}>
                  Resend verification email
                </Button>
                {resend.isSuccess && <span className="text-xs text-emerald-600">Sent</span>}
              </div>
            )}
            <ErrorBox error={resend.error || me.error} />
            <Input label="Name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            <ErrorBox error={save.error} />
            <div className="flex items-center justify-end gap-3">
              {save.isSuccess && <span className="text-xs text-emerald-600">Saved</span>}
              <Button type="submit" loading={save.isPending}>
                Save
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Change password">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              change.mutate();
            }}
          >
            <Input label="Current password" type="password" autoComplete="current-password" required value={oldPassword} onChange={(e) => setOld(e.target.value)} />
            <Input label="New password" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(e) => setNew(e.target.value)} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {confirm && confirm !== newPassword && <p className="text-xs text-red-600">Passwords don't match</p>}
            <ErrorBox error={change.error} />
            {change.isSuccess && <Notice tone="green">Password changed.</Notice>}
            <div className="flex justify-end">
              <Button type="submit" loading={change.isPending} disabled={newPassword !== confirm}>
                Change password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
