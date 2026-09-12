process.env.DATABASE_URL = 'memoire';
process.env.LIENS_EN_CLAIR = 'on';     // le lien revient au lieu de partir
process.env.SITE_URL = 'http://essai.local';

// Chargement dynamique, et pas par goût : les `import` sont hissés au-dessus
// des lignes ci-dessus, et `lib/db.js` lit DATABASE_URL à son chargement.
const { baseMemoire } = await import('./base-memoire.js');
await baseMemoire();

const session  = (await import('../api/session.js')).default;
const annonces = (await import('../api/annonces.js')).default;
const places   = (await import('../api/places.js')).default;
const demandes = (await import('../api/demandes.js')).default;

/* --- de quoi appeler une fonction Vercel sans Vercel --------------------- */
function reponse(){
  const r = { statusCode: 200, corps: null, entetes: {} };
  r.status = c => { r.statusCode = c; return r; };
  r.setHeader = (k,v) => { r.entetes[k.toLowerCase()] = v; return r; };
  r.end = b => { if(b) try{ r.corps = JSON.parse(b); }catch(e){ r.corps = b; } };
  return r;
}

/** Un agent, c'est un navigateur : il porte son cookie et rien d'autre. */
class Agent{
  constructor(prenom, email){ this.prenom = prenom; this.email = email; this.cookie = null; }

  async appelle(handler, method, { body = {}, query = {} } = {}){
    const req = {
      method, body, query,
      headers: { host: 'essai.local', ...(this.cookie ? { cookie: this.cookie } : {}) }
    };
    const res = reponse();
    await handler(req, res);
    const sc = res.entetes['set-cookie'];
    if(sc) this.cookie = sc.split(';')[0];
    return res;
  }

  /** Le parcours complet : je demande un lien, je clique, je suis connu. */
  async identifie(){
    const envoi = await this.appelle(session, 'POST', { body: { email: this.email, prenom: this.prenom } });
    const lien = envoi.corps.lien;
    const jeton = new URL(lien).searchParams.get('jeton');
    const clic = await this.appelle(session, 'GET', { query: { jeton } });
    this.dernierJeton = jeton;
    return clic;
  }

  panneau(){ return this.appelle(annonces, 'GET'); }
  publie(c){ return this.appelle(annonces, 'POST', { body: c }); }
  retire(id){ return this.appelle(annonces, 'DELETE', { body: { id } }); }
  monte(annonce_id){ return this.appelle(places, 'POST', { body: { annonce_id } }); }
  descend(annonce_id){ return this.appelle(places, 'DELETE', { body: { annonce_id } }); }
  emmene(c){ return this.appelle(demandes, 'POST', { body: c }); }
}

/* --- petit vérificateur --------------------------------------------------- */
let ok = 0, ko = 0;
function verifie(titre, condition, detail){
  if(condition){ ok++; console.log(`  ✅ ${titre}`); }
  else{ ko++; console.log(`  ❌ ${titre}${detail ? ` — ${detail}` : ''}`); }
}
function titre(t){ console.log(`\n${t}`); }

const mien = (p, id) => p.corps.annonces.find(a => a.id === id);

/* ========================================================================= */
titre('1 · Identification sans mot de passe (4.4bis)');

const philippe = new Agent('Philippe', 'ph.payet@exemple.fr');
const clic = await philippe.identifie();
verifie('le clic sur le lien renvoie à l’accueil', clic.statusCode === 302 && clic.entetes.location === '/');
verifie('le cookie est posé, httpOnly', /HttpOnly/i.test(clic.entetes['set-cookie'] || ''));

const qui = await philippe.appelle(session, 'GET');
verifie('le serveur me reconnaît', qui.corps.connecte === true && qui.corps.prenom === 'Philippe');

// Rejouer le même lien : un seul usage.
const rejoue = new Agent('Voleur', 'x@exemple.fr');
const vol = await rejoue.appelle(session, 'GET', { query: { jeton: philippe.dernierJeton } });
verifie('un lien ne sert qu’une fois', vol.statusCode === 302 && vol.entetes.location === '/?ident=perime');
verifie('et ne pose aucune session', !vol.entetes['set-cookie']);

const inventé = await rejoue.appelle(session, 'GET', { query: { jeton: 'x'.repeat(43) } });
verifie('un jeton inventé ne pose rien', !inventé.entetes['set-cookie']);

titre('2 · Le même agent, deux appareils — la limite levée du 4.4');
const philippeTel = new Agent('Philippe', 'ph.payet@exemple.fr');
await philippeTel.identifie();
const pub = await philippe.publie({ type:'offre', site:'Vallès', arrivee:'Impôts', heure:'12:15', places:2, note:'' });
verifie('publication depuis le poste', pub.statusCode === 201);
const vuTel = await philippeTel.panneau();
verifie('le téléphone voit l’annonce comme sienne', mien(vuTel, pub.corps.id)?.mienne === true);
const retraitTel = await philippeTel.retire(pub.corps.id);
verifie('et peut la retirer depuis le téléphone', retraitTel.statusCode === 200);

titre('3 · Le panneau ne laisse plus fuiter d’identifiant');
const sophie = new Agent('Sophie', 'sophie@exemple.fr');  await sophie.identifie();
const lea    = new Agent('Léa',    'lea@exemple.fr');     await lea.identifie();
const marc   = new Agent('Marc',   'marc@exemple.fr');    await marc.identifie();

const offreSophie = await sophie.publie({ type:'offre', site:'Vallès', arrivee:'Impôts', heure:'12:15', places:1, note:'' });
const vuParLea = await lea.panneau();
const brut = JSON.stringify(vuParLea.corps);
verifie('aucun champ « personne » dans la réponse', !brut.includes('"personne"'));
verifie('aucune adresse mail non plus', !brut.includes('@exemple.fr'));
verifie('l’annonce de Sophie n’est pas « mienne » pour Léa', mien(vuParLea, offreSophie.corps.id)?.mienne === false);

const volRetrait = await lea.retire(offreSophie.corps.id);
verifie('Léa ne peut pas retirer l’annonce de Sophie', volRetrait.statusCode === 409);
const anonyme = new Agent('?', '?@x.fr');
const vuAnonyme = await anonyme.panneau();
verifie('le panneau se lit sans être identifié', vuAnonyme.statusCode === 200);
verifie('sans rien y voir de personnel', !JSON.stringify(vuAnonyme.corps).includes('"personne"'));
const geste = await anonyme.monte(offreSophie.corps.id);
verifie('mais aucun geste sans identité', geste.statusCode === 401 && geste.corps.erreur === 'non_identifie');

titre('4 · Un seul trajet par personne et par jour (1bis.11)');
const m1 = await lea.monte(offreSophie.corps.id);
verifie('Léa prend la place', m1.statusCode === 201);

const offreMarc = await marc.publie({ type:'offre', site:'Vallès', arrivee:'Impôts', heure:'12:30', places:2, note:'' });
const m2 = await lea.monte(offreMarc.corps.id);
verifie('Léa ne prend pas une seconde place', m2.statusCode === 409 && m2.corps.erreur === 'deja_engage');
verifie('et on lui dit qu’elle a déjà une place', m2.corps.quoi === 'monte' && m2.corps.heure === '12:15');

const pubLea = await lea.publie({ type:'offre', site:'Vallès', arrivee:'Impôts', heure:'12:45', places:3, note:'' });
verifie('Léa passagère ne publie pas d’offre', pubLea.statusCode === 409 && pubLea.corps.erreur === 'deja_engage');

// Le conducteur fantôme du 1bis.9, dans les deux sens.
const fantome = await sophie.monte(offreMarc.corps.id);
verifie('Sophie qui conduit ne monte pas ailleurs', fantome.statusCode === 409 && fantome.corps.erreur === 'deja_engage');
verifie('et on lui rappelle qu’elle conduit à 12:15', fantome.corps.quoi === 'conduit' && fantome.corps.heure === '12:15');

const deuxieme = await sophie.publie({ type:'offre', site:'Fréhel', arrivee:'Ploufragan', heure:'13:00', places:2, note:'' });
verifie('ni ne publie une seconde offre', deuxieme.statusCode === 409);

titre('5 · Changer d’avis reste possible');
const sortie = await lea.descend(offreSophie.corps.id);
verifie('Léa se désiste', sortie.statusCode === 200);
const m3 = await lea.monte(offreMarc.corps.id);
verifie('et peut alors monter ailleurs', m3.statusCode === 201);

titre('6 · Une demande n’est pas un engagement (1bis.6)');
const paul = new Agent('Paul', 'paul@exemple.fr'); await paul.identifie();
const dem = await paul.publie({ type:'demande', site:'Vallès', arrivee:'Impôts', heure:'12:15', places:1, note:'' });
verifie('Paul publie une demande', dem.statusCode === 201);
const mPaul = await paul.monte(offreSophie.corps.id);
verifie('et peut prendre la place qu’il cherchait', mPaul.statusCode === 201, JSON.stringify(mPaul.corps?.erreur));
const apres = await paul.panneau();
verifie('sa demande disparaît du panneau', !mien(apres, dem.corps.id));

titre('7 · « Je l’emmène » (1bis.8)');
const chloe = new Agent('Chloé', 'chloe@exemple.fr'); await chloe.identifie();
const demChloe = await chloe.publie({ type:'demande', site:'Fréhel', arrivee:'Ploufragan', heure:'12:30', places:1, note:'' });
const hugo = new Agent('Hugo', 'hugo@exemple.fr'); await hugo.identifie();
const emm = await hugo.emmene({ demande_id: demChloe.corps.id, heure:'12:30', places:2 });
verifie('Hugo publie et embarque Chloé', emm.statusCode === 201);
const vuChloe = await chloe.panneau();
const offreHugo = mien(vuChloe, emm.corps.id);
verifie('Chloé est à bord', offreHugo?.a_bord === true);
verifie('sa demande a disparu', !mien(vuChloe, demChloe.corps.id));
verifie('les passagers n’exposent qu’un prénom',
  JSON.stringify(offreHugo.passagers) === JSON.stringify([{ prenom:'Chloé', moi:true }]));

const emm2 = await new Agent('Iris','iris@exemple.fr');
await emm2.identifie();
const tardif = await emm2.emmene({ demande_id: demChloe.corps.id, heure:'12:30', places:2 });
verifie('un second conducteur arrive trop tard', tardif.statusCode === 409 && tardif.corps.erreur === 'deja_pourvue');

titre('8 · La capacité reste tenue par la base (4.3)');
const nora = new Agent('Nora','nora@exemple.fr'); await nora.identifie();
const complet = await nora.monte(offreSophie.corps.id);
verifie('la voiture d’une place est complète', complet.statusCode === 409 && complet.corps.erreur === 'complet');
verifie('et on nomme qui a pris la place', complet.corps.par === 'Paul');

console.log(`\n${ok} vérifications passées, ${ko} en échec.\n`);
process.exit(ko ? 1 : 0);
