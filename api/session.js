import { json, configManquante } from '../lib/db.js';
import {
  normaliseEmail, emailPlausible, personneCourante, envoieLien, ouvreSession,
  ouvreSessionSansPreuve, fermeSession, poseCookie, retireCookie,
  mailConfigure, verificationActive
} from '../lib/session.js';

/**
 * Identification sans mot de passe (4.4bis).
 *
 *   GET  /api/session?jeton=…  le clic sur le lien : pose la session, renvoie
 *                              à l'accueil, et le jeton disparaît de la barre
 *                              d'adresse plutôt que de rester dans l'historique
 *   GET  /api/session          qui suis-je
 *   POST /api/session          { email, prenom } — envoie le lien
 *   DELETE /api/session        se déconnecter de cet appareil
 */
export default async function handler(req, res){
  if(configManquante()) return json(res, 503, { erreur:'base_absente' });
  try{
    if(req.method === 'GET'){
      const jetonLien = req.query?.jeton;
      if(jetonLien){
        const session = await ouvreSession(Array.isArray(jetonLien) ? jetonLien[0] : jetonLien);
        if(session) poseCookie(req, res, session);
        res.statusCode = 302;
        res.setHeader('location', session ? '/' : '/?ident=perime');
        res.setHeader('cache-control', 'no-store');
        return res.end();
      }
      const moi = await personneCourante(req);
      res.setHeader('cache-control', 'no-store');
      return json(res, 200, {
        connecte: !!moi,
        prenom: moi?.prenom || null,
        // L'écran s'adapte : promettre un mail qui n'arrivera pas serait pire
        // que de dire qu'il n'y en a pas.
        mail: verificationActive()
      });
    }

    if(req.method === 'POST'){
      const c = req.body || {};
      const email = normaliseEmail(c.email);
      const prenom = typeof c.prenom === 'string' ? c.prenom.trim() : '';
      const err = [];
      if(!emailPlausible(email)) err.push('email');
      if(prenom.length < 1 || prenom.length > 30) err.push('prenom');
      if(err.length) return json(res, 400, { erreur:'champs_invalides', champs: err });

      // Sans courrier possible, l'adresse ouvre la session sur parole
      // (4.4bis, décision du 12/09/2026). Poser SMTP_URL rallume le lien.
      if(!verificationActive()){
        const jeton = await ouvreSessionSansPreuve(email, prenom);
        poseCookie(req, res, jeton);
        return json(res, 200, { connecte: true, prenom });
      }

      const issue = await envoieLien(req, email, prenom);
      if(!issue.ok) return json(res, 429, { erreur: issue.erreur });
      return json(res, 200, { envoye: true, poste: issue.poste, lien: issue.lien });
    }

    if(req.method === 'DELETE'){
      await fermeSession(req);
      retireCookie(req, res);
      return json(res, 200, { connecte: false });
    }

    res.setHeader('allow','GET, POST, DELETE');
    return json(res, 405, { erreur:'methode' });
  }catch(e){
    console.error(e);
    return json(res, 500, { erreur:'serveur' });
  }
}
