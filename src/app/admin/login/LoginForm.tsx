"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state && !state.ok && <p className="text-sm font-bold text-rose-600" role="alert">{state.message}</p>}
      <button className="btn-primary w-full !py-3" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Ingresar
      </button>
    </form>
  );
}
