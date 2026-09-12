import { query, panneau, valide, nouvelId, aujourdhui, json, configManquante } from '../lib/db.js';
import crypto from 'node:crypto';

export default async function handler(req, res){
  if(configManquante()) return json(res, 503, { erreur:'base_absente' });
  try{
    if(req.method === 'GET'){
      // Purge des jours passés. Table minuscule : une fois sur cent suffit.
      if(Math.random() < 0.01){
        await query(`delete from annonces where jour < current_date - interval '2 days'`);
      }
      const corps = await panneau();
      // Requête conditionnelle : l'essentiel des sondages repart en 304.
      const etag = '"' + crypto.createHash('sha1')
        .update(JSON.stringify(corps)).digest('base64url') + '"';
      res.setHeader('etag', etag);
      res.setHeader('cache-control', 'no-cache');
      if(req.headers['if-none-match'] === etag){ res.status(304).end(); return; }
      return json(res, 200, corps);
    }

    if(req.method === 'POST'){
      const c = req.body || {};
      const v = valide({
        prenom: c.prenom, personne: c.personne, type: c.type,
        site: c.site, arrivee: c.arrivee, heure: c.heure, note: c.note ?? '',
        places: c.type === 'offre' ? c.places : 1
      });
      if(!v.ok) return json(res, 400, { erreur:'champs_invalides', champs: v.err });

      const id = nouvelId();
      await query(
        `insert into annonces (id, jour, type, personne, prenom, site, arrivee, heure, places, note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, aujourdhui(), v.out.type, v.out.personne, v.out.prenom,
         v.out.site, v.out.arrivee, v.out.heure, v.out.places, v.out.note]
      );
      return json(res, 201, { id, ...await panneau() });
    }

    if(req.method === 'DELETE'){
      // Retirer sa propre annonce. On marque, on ne supprime pas.
      const { id, personne } = req.body || {};
      if(!id || !personne) return json(res, 400, { erreur:'champs_invalides' });
      const { rowCount } = await query(
        `update annonces set statut='annulee'
          where id=$1 and personne=$2 and statut='ouverte'`,
        [id, personne]
      );
      if(!rowCount) return json(res, 409, { erreur:'introuvable', ...await panneau() });
      return json(res, 200, await panneau());
    }

    res.setHeader('allow','GET, POST, DELETE');
    return json(res, 405, { erreur:'methode' });
  }catch(e){
    console.error(e);
    return json(res, 500, { erreur:'serveur' });
  }
}
