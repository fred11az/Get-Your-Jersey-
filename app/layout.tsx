import type { ReactNode } from 'react';
import './globals.css';

/**
 * Racine minimale : l'App Router exige un layout à la racine, mais `<html>` et
 * `<body>` sont posés par `app/[locale]/layout.tsx` qui, lui, connaît la langue
 * et peut renseigner correctement l'attribut `lang`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
