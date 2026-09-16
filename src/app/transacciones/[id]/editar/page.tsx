import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { toInputDate } from "@/lib/format";
import { Card, linkCls } from "@/components/ui";
import { TransactionForm } from "@/components/transaction-form";
import { updateTransaction } from "@/app/actions/transactions";

export default async function EditarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;

  const [tx, categories] = await Promise.all([
    prisma.transaction.findFirst({ where: { id, userId } }),
    prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
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
          }}
          submitLabel="Guardar cambios"
        />
      </Card>
    </div>
  );
}
