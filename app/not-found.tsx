import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="card p-[18px] text-center max-w-[400px]">
        <h1 className="m-0 mb-1 font-display font-extrabold italic text-2xl">Cette page n&apos;existe pas</h1>
        <p className="m-0 mb-4 text-sm text-ink-2">Elle a peut-être été éliminée.</p>
        <Link href="/" className="btn-primary no-underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
