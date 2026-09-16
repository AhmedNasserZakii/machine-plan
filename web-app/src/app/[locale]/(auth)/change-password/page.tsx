import { ChangePasswordForm } from '@/features/auth/components/change-password-form';

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-md">
      <ChangePasswordForm forced />
    </div>
  );
}
