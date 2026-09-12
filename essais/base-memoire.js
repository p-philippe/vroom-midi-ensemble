import { PGlite } from '@electric-sql/pglite';
import { __brancheBase } from '../lib/db.js';

/**
 * Un Postgres en mémoire, branché à la place du vrai, pour rejouer les
 * scénarios sans base sous la main. PGlite est un vrai Postgres compilé en
 * WebAssembly : mêmes types, mêmes contraintes, mêmes messages d'erreur.
 *
 * Une seule connexion, donc : les scénarios s'y jouent l'un après l'autre.
 * Ce que ça vérifie, c'est la règle — qui gagne, qui est refusé, et avec quel
 * message. La simultanéité vraie, elle, a été éprouvée contre Neon (4.3).
 */
export async function baseMemoire(){
  const db = new PGlite();

  const adaptateur = {
    async query(texte, params){
      if(params === undefined){
        const res = await db.exec(texte);
        return { rows: res.length ? (res[res.length-1].rows || []) : [], rowCount: 0 };
      }
      const r = await db.query(texte, params);
      return { rows: r.rows || [], rowCount: (r.affectedRows ?? r.rows?.length ?? 0) };
    },
    async connect(){
      return {
        query: adaptateur.query,
        release(){}
      };
    }
  };

  __brancheBase(adaptateur);
  return db;
}
