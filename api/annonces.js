import {
  query, transaction, panneau, valide, nouvelId, aujourdhui, json, configManquante,
  verrouillePersonne, engagement, clotDemande, heureCourante
} from '../lib/db.js';
import { personneCourante, purgeOublies } from '../lib/session.js';
import crypto from 'node:crypto';

export default async function handler(req, res){
  if(configManquante()) return json(res, 503, { erreur:'base_absente' });
  try{
    const moi = await personneCourante(req);

    if(req.method === 'GET'){
      // Purge des jours passés et des surnoms oubliés. Tables minuscules : une
      // fois sur cent suffit.
      if(Math.random() < 0.01){
        await query(`delete from annonces where jour < current_date - interval '2 days'`);
        await purgeOublies();
      }
      const corps = await panneau(moi?.id);
      // Le panneau n'est plus le même pour tout le monde : « c'est la vôtre »
      // et « vous êtes à bord » dépendent du cookie. D'où le Vary, sans quoi
      // un cache intermédiaire servirait à l'un la vue de l'autre.
      const etag = '"' + crypto.createHash('sha1')
        .update(JSON.stringify(corps)).digest('base64url') + '"';
      res.setHeader('etag', etag);
      res.setHeader('vary', 'cookie');
      res.setHeader('cache-control', 'private, no-cache');
      if(req.headers['if-none-match'] === etag){ res.status(304).end(); return; }
      return json(res, 200, corps);
    }

    // Passé la lecture, il faut être identifié : le serveur ne croit plus le
    // client sur parole quant à son identité, il la lit dans le cookie.
    if(!moi) return json(res, 401, { erreur:'non_identifie' });

    if(req.method === 'POST'){
      const c = req.body || {};
      const v = valide({
        prenom: moi.prenom, type: c.type,
        site: c.site, arrivee: c.arrivee, heure: c.heure, note: c.note ?? '',
        places: c.type === 'offre' ? c.places : 1
      });
      if(!v.ok) return json(res, 400, { erreur:'champs_invalides', champs: v.err });
      // Le panneau ne modélise qu'aujourd'hui : un créneau déjà passé n'a pas
      // de sens à publier. Relevé le 26/09/2026 — l'API l'acceptait jusque
      // tard l'après-midi, créant une annonce morte « Parti » à la naissance.
      if(v.out.heure < heureCourante()) return json(res, 400, { erreur:'creneau_passe' });

      const jour = aujourdhui();
      const issue = await transaction(async (cx)=>{
        await verrouillePersonne(cx, moi.id);
        const deja = await engagement(cx, moi.id, jour);
        if(deja) return { code: 409, corps: { erreur:'deja_engage', ...deja } };

        // Publier, c'est trancher : la demande que j'avais en cours n'a plus
        // d'objet, que je me propose de conduire ou que je la reformule.
        await clotDemande(cx, moi.id, jour);

        const id = nouvelId();
        await cx.query(
          `insert into annonces (id, jour, type, personne, prenom, site, arrivee, heure, places, note)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, jour, v.out.type, moi.id, v.out.prenom,
           v.out.site, v.out.arrivee, v.out.heure, v.out.places, v.out.note]
        );
        return { code: 201, corps: { id } };
      });
      return json(res, issue.code, { ...issue.corps, ...await panneau(moi.id) });
    }

    if(req.method === 'DELETE'){
      // Retirer sa propre annonce. On marque, on ne supprime pas. L'identité
      // vient du cookie : on ne peut plus retirer celle d'un autre.
      //
      // Les passagers déjà à bord doivent partir avec l'annonce : sinon leur
      // ligne survit dans `passagers`, l'index (jour, personne) les tient
      // toujours engagés, et ils se retrouvent bloqués pour le reste du midi
      // — piégés, pas seulement sans nouvelle. Bug relevé deux fois le
      // 26/09/2026 (revue et session d'agents), confirmé en production.
      const { id } = req.body || {};
      if(!id) return json(res, 400, { erreur:'champs_invalides' });
      const rowCount = await transaction(async (cx) => {
        const { rowCount } = await cx.query(
          `update annonces set statut='annulee'
            where id=$1 and personne=$2 and statut='ouverte'`,
          [id, moi.id]
        );
        if(rowCount) await cx.query(`delete from passagers where annonce_id=$1`, [id]);
        return rowCount;
      });
      if(!rowCount) return json(res, 409, { erreur:'introuvable', ...await panneau(moi.id) });
      return json(res, 200, await panneau(moi.id));
    }

    res.setHeader('allow','GET, POST, DELETE');
    return json(res, 405, { erreur:'methode' });
  }catch(e){
    console.error(e);
    return json(res, 500, { erreur:'serveur' });
  }
}
