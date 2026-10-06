import { LoginForm } from "@/components/app/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  return <LoginForm expired={!!(await searchParams).expired} />;
}
