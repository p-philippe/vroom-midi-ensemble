import { transaction, panneau, valide, nouvelId, aujourdhui, json, configManquante } from '../lib/db.js';

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
    const c = req.body || {};
    const v = valide({
      prenom: c.prenom, personne: c.personne,
      heure: c.heure, places: c.places
    });
    if(!v.ok || !c.demande_id){
      return json(res, 400, { erreur:'champs_invalides', champs: v.err });
    }

    const issue = await transaction(async (cx)=>{
      const { rows } = await cx.query(
        `update annonces set statut='pourvue'
          where id=$1 and jour=$2 and type='demande' and statut='ouverte'
        returning id, prenom, site, arrivee, personne`,
        [c.demande_id, aujourdhui()]
      );
      if(!rows.length) return { code: 409, corps: { erreur:'deja_pourvue' } };

      const demande = rows[0];
      const offreId = nouvelId();
      await cx.query(
        `insert into annonces (id, jour, type, personne, prenom, site, arrivee, heure, places, note)
         values ($1,$2,'offre',$3,$4,$5,$6,$7,$8,'')`,
        [offreId, aujourdhui(), v.out.personne, v.out.prenom,
         demande.site, demande.arrivee, v.out.heure, v.out.places]
      );
      // La personne qui cherchait est d'emblée à bord.
      await cx.query(
        `insert into passagers (id, annonce_id, personne, prenom) values ($1,$2,$3,$4)`,
        [nouvelId(), offreId, demande.personne, demande.prenom]
      );
      return { code: 201, corps: { id: offreId } };
    });

    return json(res, issue.code, { ...issue.corps, ...await panneau() });
  }catch(e){
    console.error(e);
    return json(res, 500, { erreur:'serveur' });
  }
}
