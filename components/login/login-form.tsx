"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, LogIn } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { Field, PasswordField } from "@/components/ui/field";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { buttonClass } from "@/lib/dashboard/cred";

export function LoginForm() {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function doLogin(form: FormData) {
    setPending(true);
    setNotice("");
    const result = await loginAction(String(form.get("username")), String(form.get("password"))).catch(() => null);
    if (result?.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setNotice(result?.error ?? "No se pudo iniciar sesión, intenta de nuevo");
    setPending(false);
  }

  return (
    <section className="relative flex flex-col justify-center p-6 sm:p-10">
      <div className="mb-8 flex items-center justify-between lg:absolute lg:inset-x-10 lg:top-10 lg:mb-0 lg:justify-end">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartPulse className="size-5" />
          </div>
          <div>
            <p className="font-bold">CRED Huamanga</p>
            <p className="text-xs text-muted-foreground">Red de Salud Huamanga</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
      <div className="mx-auto w-full max-w-md">
        <p className="text-sm font-semibold text-primary">Portal de seguimiento</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Iniciar sesión</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ingresa con tu usuario para consultar la información correspondiente
          a tu perfil.
        </p>
        <form action={doLogin} className="mt-7 grid gap-4">
          <Field label="Usuario" name="username" placeholder="Escribe tu usuario" autoComplete="username" />
          <PasswordField
            label="Contraseña"
            name="password"
            placeholder="Escribe tu contraseña"
          />
          <button className={`${buttonClass} mt-2 h-11`} disabled={pending}>
            <LogIn className="size-4" />
            {pending ? "Ingresando..." : "Ingresar al portal"}
          </button>
        </form>
        {notice && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
