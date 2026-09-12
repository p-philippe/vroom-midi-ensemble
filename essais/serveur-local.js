process.env.DATABASE_URL ||= 'memoire';
process.env.LIENS_EN_CLAIR ||= 'on';   // le lien s'affiche à l'écran

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const { baseMemoire } = await import('./base-memoire.js');
await baseMemoire();

const routes = {
  '/api/session':  (await import('../api/session.js')).default,
  '/api/annonces': (await import('../api/annonces.js')).default,
  '/api/places':   (await import('../api/places.js')).default,
  '/api/demandes': (await import('../api/demandes.js')).default
};

const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css',
                '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };

/**
 * Le bac à sable : mêmes fonctions, même client, Postgres en mémoire.
 * Il remplace `vercel dev` quand on n'a ni base ni compte sous la main —
 * et la base repart vierge à chaque démarrage, ce qui est commode pour
 * rejouer un parcours depuis le début.
 */
const serveur = http.createServer(async (req, res)=>{
  const u = new URL(req.url, 'http://localhost');
  const handler = routes[u.pathname];

  if(handler){
    const query = Object.fromEntries(u.searchParams);
    let body = {};
    if(req.method !== 'GET'){
      const morceaux = [];
      for await (const m of req) morceaux.push(m);
      if(morceaux.length) try{ body = JSON.parse(Buffer.concat(morceaux).toString()); }catch(e){}
    }
    req.query = query;
    req.body = body;
    res.status = c => { res.statusCode = c; return res; };
    try{ await handler(req, res); }
    catch(e){ console.error(e); res.statusCode = 500; res.end('{"erreur":"serveur"}'); }
    return;
  }

  const fichier = u.pathname === '/' ? '/index.html' : u.pathname;
  try{
    const contenu = await fs.readFile(path.join(process.cwd(), 'public', fichier));
    res.setHeader('content-type', TYPES[path.extname(fichier)] || 'application/octet-stream');
    res.end(contenu);
  }catch(e){ res.statusCode = 404; res.end('introuvable'); }
});

const port = Number(process.env.PORT || 3000);
serveur.listen(port, ()=> console.log(`Vroom ! en bac à sable : http://localhost:${port}`));
