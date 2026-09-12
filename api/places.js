import { query, transaction, panneau, valide, nouvelId, aujourdhui, json, configManquante } from '../lib/db.js';

/**
 * Prendre une place, et s'en désister.
 *
 * Collision (a) de la feuille de route : deux personnes prennent la dernière
 * place en même temps. La capacité est tenue par la base — verrou sur la ligne
 * de l'annonce, comptage des passagers dans la même transaction — et non par
 * le client. Personne ne se retrouve planté sur le parking.
 */
export default async function handler(req, res){
  if(configManquante()) return json(res, 503, { erreur:'base_absente' });
  try{
    if(req.method === 'POST'){
      const c = req.body || {};
      const v = valide({ prenom: c.prenom, personne: c.personne });
      if(!v.ok || !c.annonce_id) return json(res, 400, { erreur:'champs_invalides', champs: v.err });

      const issue = await transaction(async (cx)=>{
        const { rows } = await cx.query(
          `select id, places, type from annonces
            where id=$1 and jour=$2 and type='offre' and statut='ouverte'
            for update`,
          [c.annonce_id, aujourdhui()]
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
            `insert into passagers (id, annonce_id, personne, prenom) values ($1,$2,$3,$4)`,
            [nouvelId(), annonce.id, v.out.personne, v.out.prenom]
          );
        }catch(e){
          if(e.code === '23505') return { code: 409, corps: { erreur:'deja_a_bord' } };
          throw e;
        }

        // Ma demande n'a plus d'objet : je viens de trouver une place.
        await cx.query(
          `update annonces set statut='pourvue'
            where jour=$1 and type='demande' and statut='ouverte' and personne=$2`,
          [aujourdhui(), v.out.personne]
        );
        return { code: 201, corps: {} };
      });

      return json(res, issue.code, { ...issue.corps, ...await panneau() });
    }

    if(req.method === 'DELETE'){
      const { annonce_id, personne } = req.body || {};
      if(!annonce_id || !personne) return json(res, 400, { erreur:'champs_invalides' });
      await query(`delete from passagers where annonce_id=$1 and personne=$2`,
                  [annonce_id, personne]);
      return json(res, 200, await panneau());
    }

    res.setHeader('allow','POST, DELETE');
    return json(res, 405, { erreur:'methode' });
  }catch(e){
    console.error(e);
    return json(res, 500, { erreur:'serveur' });
  }
}

