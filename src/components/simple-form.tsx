"use client";
import { useActionState } from "react"; import { btnPrimaryCls,FormError,inputCls,labelCls } from "@/components/ui"; import type { ActionResult } from "@/lib/validations";
export function SimpleForm({action,children}:{action:(p:ActionResult,f:FormData)=>Promise<ActionResult>;children:React.ReactNode}){const[s,a,p]=useActionState(action,{ok:true});return <form action={a} className="grid gap-3"><FormError message={s.ok?null:s.error}/>{children}<button className={btnPrimaryCls} disabled={p}>{p?"Guardando...":"Guardar"}</button></form>};export{inputCls,labelCls};
