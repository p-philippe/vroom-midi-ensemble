import {
  transaction, panneau, valide, nouvelId, aujourdhui, json, configManquante,
  verrouillePersonne, engagement, clotDemande
} from '../lib/db.js';
import { personneCourante } from '../lib/session.js';

/**
 * « Je l'emmène » : répondre à une demande.
 *
 * Collisions (b) et (c) de la feuille de route : deux conducteurs répondent à
 * la même personne, ou celle-ci trouve une place ailleurs au même instant.
 * Une demande ne se pourvoit qu'une fois — c'est l'UPDATE conditionnel qui le
 * garantit. Zéro ligne modifiée : quelqu'un a été plus rapide, et on le dit.
 */
export default async function handler(req, res){
  if(req.method !== 'POST'){
    res.setHeader('allow','POST');
    return json(res, 405, { erreur:'methode' });
  }
  if(configManquante()) return json(res, 503, { erreur:'base_absente' });
  try{
    const moi = await personneCourante(req);
    if(!moi) return json(res, 401, { erreur:'non_identifie' });

    const c = req.body || {};
    const v = valide({ prenom: moi.prenom, heure: c.heure, places: c.places });
    if(!v.ok || !c.demande_id){
      return json(res, 400, { erreur:'champs_invalides', champs: v.err });
    }
    const jour = aujourdhui();

    const issue = await transaction(async (cx)=>{
      await verrouillePersonne(cx, moi.id);
      const deja = await engagement(cx, moi.id, jour);
      if(deja) return { code: 409, corps: { erreur:'deja_engage', ...deja } };

      const { rows } = await cx.query(
        `update annonces set statut='pourvue'
          where id=$1 and jour=$2 and type='demande' and statut='ouverte'
        returning id, prenom, site, arrivee, personne`,
        [c.demande_id, jour]
      );
      if(!rows.length) return { code: 409, corps: { erreur:'deja_pourvue' } };

      const demande = rows[0];
      // Me proposer clôt la demande que j'aurais moi-même en cours.
      await clotDemande(cx, moi.id, jour);

      const offreId = nouvelId();
      await cx.query(
        `insert into annonces (id, jour, type, personne, prenom, site, arrivee, heure, places, note)
         values ($1,$2,'offre',$3,$4,$5,$6,$7,$8,'')`,
        [offreId, jour, moi.id, v.out.prenom,
         demande.site, demande.arrivee, v.out.heure, v.out.places]
      );
      // La personne qui cherchait est d'emblée à bord — sauf si elle vient de
      // trouver une place ailleurs. L'index l'attrape, et sa demande reste
      // fermée : elle est bien partie, dans une seule voiture.
      try{
        await cx.query(
          `insert into passagers (id, annonce_id, jour, personne, prenom)
           values ($1,$2,$3,$4,$5)`,
          [nouvelId(), offreId, jour, demande.personne, demande.prenom]
        );
      }catch(e){
        if(e.code === '23505') return { code: 409, corps: { erreur:'deja_partie', qui: demande.prenom } };
        throw e;
      }
      return { code: 201, corps: { id: offreId } };
    });

    return json(res, issue.code, { ...issue.corps, ...await panneau(moi.id) });
  }catch(e){
    console.error(e);
    return json(res, 500, { erreur:'serveur' });
  }
}
