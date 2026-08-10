import Link from "next/link";

export function AdminEventNav({ slug, isSuperAdmin }: { slug: string; isSuperAdmin: boolean }) {
  return (
    <nav className="admin-tabs" aria-label="Administração do espaço">
      <Link href={`/admin/${slug}`}>Visão geral</Link>
      <Link href={`/admin/${slug}/moderacao`}>Moderação</Link>
      <Link href={`/admin/${slug}/aparencia`}>Aparência e textos</Link>
      {isSuperAdmin && <Link href={`/admin/${slug}/pessoas`}>Pessoas</Link>}
      <Link href={`/${slug}/vitrine`}>Abrir vitrine</Link>
    </nav>
  );
}
