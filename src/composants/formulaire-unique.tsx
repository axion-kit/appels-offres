"use client";

import { useRef, type FormEvent, type ReactNode } from "react";

// Formulaire qui ne part qu'une fois, même si la personne touche deux fois le bouton.
export function FormulaireUnique({ action, children, className }: { action: string; children: ReactNode; className?: string }) {
  const parti = useRef(false);
  function surEnvoi(evenement: FormEvent<HTMLFormElement>) {
    if (parti.current) evenement.preventDefault();
    parti.current = true;
  }
  return (
    <form method="post" action={action} onSubmit={surEnvoi} className={className}>
      {children}
    </form>
  );
}
