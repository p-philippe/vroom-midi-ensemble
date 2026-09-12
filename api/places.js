import {
  query, transaction, panneau, nouvelId, aujourdhui, json, configManquante,
  verrouillePersonne, engagement, clotDemande
} from '../lib/db.js';
import { personneCourante } from '../lib/session.js';

/**
 * Prendre une place, et s'en désister.
 *
 * Collision (a) de la feuille de route : deux personnes prennent la dernière
 * place en même temps. La capacité est tenue par la base — verrou sur la ligne
 * de l'annonce, comptage des passagers dans la même transaction — et non par
 * le client. Personne ne se retrouve planté sur le parking.
 *
 * S'y ajoute la règle du 1bis.11 : on ne monte pas si l'on conduit déjà, ni si
 * l'on a déjà une place ailleurs. Fin du conducteur fantôme (1bis.9).
 */
export default async function handler(req, res){
  if(configManquante()) return json(res, 503, { erreur:'base_absente' });
  try{
    const moi = await personneCourante(req);
    if(!moi) return json(res, 401, { erreur:'non_identifie' });

    if(req.method === 'POST'){
      const c = req.body || {};
      if(!c.annonce_id) return json(res, 400, { erreur:'champs_invalides' });
      const jour = aujourdhui();

      const issue = await transaction(async (cx)=>{
        await verrouillePersonne(cx, moi.id);
        const deja = await engagement(cx, moi.id, jour);
        if(deja) return { code: 409, corps: { erreur:'deja_engage', ...deja } };

        const { rows } = await cx.query(
          `select id, places from annonces
            where id=$1 and jour=$2 and type='offre' and statut='ouverte'
            for update`,
          [c.annonce_id, jour]
        );
        if(!rows.length) return { code: 409, corps: { erreur:'annonce_close' } };

        const annonce = rows[0];
        const { rows: [{ n }] } = await cx.query(
          `select count(*)::int as n from passagers where annonce_id=$1`, [annonce.id]
        );
        if(n >= annonce.places){
          const { rows: pris } = await cx.query(
            `select prenom from passagers where annonce_id=$1 order by cree_le desc limit 1`,
            [annonce.id]
          );
          return { code: 409, corps: { erreur:'complet', par: pris[0]?.prenom || null } };
        }

        try{
          await cx.query(
            `insert into passagers (id, annonce_id, jour, personne, prenom)
             values ($1,$2,$3,$4,$5)`,
            [nouvelId(), annonce.id, jour, moi.id, moi.prenom]
          );
        }catch(e){
          if(e.code === '23505') return { code: 409, corps: { erreur:'deja_a_bord' } };
          throw e;
        }

        // Ma demande n'a plus d'objet : je viens de trouver une place.
        await clotDemande(cx, moi.id, jour);
        return { code: 201, corps: {} };
      });

      return json(res, issue.code, { ...issue.corps, ...await panneau(moi.id) });
    }

    if(req.method === 'DELETE'){
      const { annonce_id } = req.body || {};
      if(!annonce_id) return json(res, 400, { erreur:'champs_invalides' });
      await query(`delete from passagers where annonce_id=$1 and personne=$2`,
                  [annonce_id, moi.id]);
      return json(res, 200, await panneau(moi.id));
    }

    res.setHeader('allow','POST, DELETE');
    return json(res, 405, { erreur:'methode' });
  }catch(e){
    console.error(e);
    return json(res, 500, { erreur:'serveur' });
  }
}
