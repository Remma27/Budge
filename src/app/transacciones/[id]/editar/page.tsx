import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { toInputDate } from "@/lib/format";
import { Card, linkCls } from "@/components/ui";
import { TransactionForm } from "@/components/transaction-form";
import { updateTransaction } from "@/app/actions/transactions";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";

export default async function EditarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const { workspaceId } = await getWorkspaceContext(userId, (await searchParams).workspaceId);

  const [tx, categories, paymentMethods] = await Promise.all([
    prisma.transaction.findFirst({ where: { id, ...scopeWorkspace(userId, workspaceId) } }),
    prisma.category.findMany({
      where: scopeWorkspace(userId, workspaceId),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.paymentMethod.findMany({ where: scopeWorkspace(userId, workspaceId), orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!tx) notFound();

  return (
    <div className="grid gap-4">
      <Link href="/" className={linkCls}>
        ← Volver
      </Link>
      <Card>
        <h1 className="mb-4 text-xl font-bold">Editar movimiento</h1>
        <TransactionForm
          action={updateTransaction.bind(null, tx.id)}
          categories={categories}
          initial={{
            type: tx.type,
            amount: tx.amount.toString(),
            currency: tx.currency,
            date: toInputDate(tx.date),
            note: tx.note ?? "",
            categoryId: tx.categoryId ?? "",
            paymentMethodId: tx.paymentMethodId ?? "",
          }}
          submitLabel="Guardar cambios"
          workspaceId={workspaceId}
          paymentMethods={paymentMethods}
        />
      </Card>
    </div>
  );
}
