"use client";

import { btnDangerCls } from "@/components/ui";

export function DeleteButton() {
  return (
    <button
      type="submit"
      className={btnDangerCls}
      onClick={(event) => {
        if (!window.confirm("¿Eliminar este movimiento? Esta acción no se puede deshacer.")) {
          event.preventDefault();
        }
      }}
    >
      Eliminar
    </button>
  );
}
