import { HeartPulse, ShieldCheck } from "lucide-react";

export function LoginHero() {
  return (
    <section className="hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-foreground/15">
            <HeartPulse className="size-7" />
          </div>
          <div>
            <p className="text-lg font-bold">CRED Huamanga</p>
            <p className="text-sm text-primary-foreground/75">
              Red de Salud Huamanga
            </p>
          </div>
        </div>
        <div className="mt-20 max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
            Atención integral
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            Seguimiento seguro para cada niño y niña.
          </h1>
          <p className="mt-5 text-base leading-7 text-primary-foreground/80">
            Consulta controles, vacunas y paquetes CRED según tu rol y los
            vínculos autorizados.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-primary-foreground/75">
        <ShieldCheck className="size-4" />
        Datos protegidos por permisos de acceso
      </div>
    </section>
  );
}
