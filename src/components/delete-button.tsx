"use client";

import { btnDangerCls } from "@/components/ui";
import { useFormStatus } from "react-dom";

export function DeleteButton({ message = "¿Eliminar este movimiento? Esta acción no se puede deshacer." }: { message?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={btnDangerCls}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      >
      {pending ? "Procesando..." : "Eliminar"}
    </button>
  );
}
