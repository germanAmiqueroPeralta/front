import { LoginHero } from "@/components/login/login-hero";
import { LoginForm } from "@/components/login/login-form";

export default function Page() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-border bg-card shadow-xl lg:min-h-[36rem] lg:grid-cols-[1.05fr_0.95fr]">
          <LoginHero />
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
