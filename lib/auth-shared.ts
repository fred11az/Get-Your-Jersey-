/**
 * Constantes d'auth partagées entre le middleware (Edge Runtime) et les
 * modules Node. Ce fichier ne doit importer aucune API Node.
 */
export const ADMIN_COOKIE = 'gyj_admin';
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 h
