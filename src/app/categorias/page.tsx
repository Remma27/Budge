import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { Card } from "@/components/ui";
import { CategoryRow, NewCategoryForm } from "./forms";

export default async function CategoriasPage() {
  const userId = await requireUserId();
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { transactions: true } } },
  });

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-bold">Categorías</h1>
      <Card>
        <h2 className="mb-4 font-bold">Nueva categoría</h2>
        <NewCategoryForm />
      </Card>
      <div className="grid gap-2">
        {categories.map((c) => (
          <CategoryRow
            key={c.id}
            id={c.id}
            name={c.name}
            color={c.color}
            count={c._count.transactions}
          />
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-zinc-500">Aún no tienes categorías.</p>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Al eliminar una categoría, sus movimientos pasan a “Sin categoría”.
      </p>
    </div>
  );
}
