import { json, configManquante } from '../lib/db.js';
import {
  nomPropre, nomValide, nomExiste, personneCourante, ouvreSessionPour,
  fermeSession, poseCookie, retireCookie, listeGens,
  renommePersonne, supprimePersonne
} from '../lib/session.js';

/**
 * Identification sans mot de passe (4.4bis).
 *
 *   GET    /api/session   qui suis-je, et qui d'autre est connu
 *   POST   /api/session   { prenom, nouveau } — se choisir, ou s'ajouter
 *   PUT    /api/session   { prenom } — corriger mon nom
 *   DELETE /api/session   se déconnecter ; { retirer:true } pour sortir de la liste
 *
 * On ne touche qu'à soi : l'identité visée vient du cookie, jamais du corps
 * de la requête. Personne ne tient la liste — chacun y entre, s'y corrige et
 * en sort, et ce qu'on ne revoit pas pendant un mois s'efface tout seul.
 */
export default async function handler(req, res){
  if(configManquante()) return json(res, 503, { erreur:'base_absente' });
  try{
    if(req.method === 'GET'){
      const moi = await personneCourante(req);
      res.setHeader('cache-control', 'no-store');
      return json(res, 200, {
        connecte: !!moi,
        prenom: moi?.prenom || null,
        gens: await listeGens()
      });
    }

    if(req.method === 'POST'){
      const nom = nomPropre((req.body || {}).prenom);
      if(!nomValide(nom)) return json(res, 400, { erreur:'champs_invalides', champs:['prenom'] });

      // S'ajouter alors que le nom existe déjà, c'est très probablement se
      // retaper au lieu de se choisir : le doublon qu'on veut éviter. On
      // renvoie la main plutôt que de créer une seconde personne.
      if((req.body || {}).nouveau){
        const existant = await nomExiste(nom);
        if(existant) return json(res, 409, { erreur:'nom_pris', nom: existant });
      }

      const ouverte = await ouvreSessionPour(nom);
      poseCookie(req, res, ouverte.jeton);
      return json(res, 200, { connecte: true, prenom: ouverte.prenom, gens: await listeGens() });
    }

    if(req.method === 'PUT'){
      const moi = await personneCourante(req);
      if(!moi) return json(res, 401, { erreur:'non_identifie' });
      const nom = nomPropre((req.body || {}).prenom);
      if(!nomValide(nom)) return json(res, 400, { erreur:'champs_invalides', champs:['prenom'] });

      const issue = await renommePersonne(moi.id, nom);
      if(!issue.ok) return json(res, 409, issue);
      return json(res, 200, { connecte: true, prenom: nom, gens: await listeGens() });
    }

    if(req.method === 'DELETE'){
      if((req.body || {}).retirer){
        const moi = await personneCourante(req);
        if(!moi) return json(res, 401, { erreur:'non_identifie' });
        await supprimePersonne(moi.id);
      }else{
        await fermeSession(req);
      }
      retireCookie(req, res);
      return json(res, 200, { connecte: false, gens: await listeGens() });
    }

    res.setHeader('allow','GET, POST, PUT, DELETE');
    return json(res, 405, { erreur:'methode' });
  }catch(e){
    console.error(e);
    return json(res, 500, { erreur:'serveur' });
  }
}
