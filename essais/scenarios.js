process.env.DATABASE_URL = 'memoire';

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
  constructor(prenom){ this.prenom = prenom; this.cookie = null; }

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

  /** Se choisir dans la liste, ou s'y ajouter la première fois. */
  identifie(nouveau = true){
    return this.appelle(session, 'POST', { body: { prenom: this.prenom, nouveau } });
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

const philippe = new Agent('Philippe');
const entree = await philippe.identifie();
verifie('s’ajouter connecte aussitôt', entree.corps.connecte === true && entree.corps.prenom === 'Philippe');
verifie('le cookie est posé, httpOnly', /HttpOnly/i.test(entree.entetes['set-cookie'] || ''));

const qui = await philippe.appelle(session, 'GET');
verifie('le serveur me reconnaît', qui.corps.connecte === true && qui.corps.prenom === 'Philippe');
verifie('et me propose dans la liste', qui.corps.gens.includes('Philippe'));

const trop = await new Agent('P').identifie();
verifie('un nom d’une lettre est refusé', trop.statusCode === 400);

titre('2 · Le doublon, c’est ce qu’on veut éviter');
const retape = await new Agent('philippe').identifie(true);
verifie('se retaper au lieu de se choisir est refusé',
  retape.statusCode === 409 && retape.corps.erreur === 'nom_pris');

const philippeTel = new Agent('philippe');
const choix = await philippeTel.identifie(false);   // je me choisis dans la liste
verifie('se choisir renvoie le nom de la liste, pas celui tapé',
  choix.corps.prenom === 'Philippe', choix.corps.prenom);
const pub = await philippe.publie({ type:'offre', site:'Vallès', arrivee:'Impôts', heure:'12:15', places:2, note:'' });
verifie('publication depuis le poste', pub.statusCode === 201);
const vuTel = await philippeTel.panneau();
verifie('le téléphone voit l’annonce comme sienne', mien(vuTel, pub.corps.id)?.mienne === true);
const retraitTel = await philippeTel.retire(pub.corps.id);
verifie('et peut la retirer depuis le téléphone', retraitTel.statusCode === 200);

const gens = (await philippe.appelle(session, 'GET')).corps.gens;
verifie('une seule personne en base, pas deux',
  gens.filter(g => g.toLowerCase() === 'philippe').length === 1, JSON.stringify(gens));

titre('3 · Le panneau ne laisse plus fuiter d’identifiant');
const sophie = new Agent('Sophie');  await sophie.identifie();
const lea    = new Agent('Léa');     await lea.identifie();
const marc   = new Agent('Marc');    await marc.identifie();

const offreSophie = await sophie.publie({ type:'offre', site:'Vallès', arrivee:'Impôts', heure:'12:15', places:1, note:'' });
const vuParLea = await lea.panneau();
const brut = JSON.stringify(vuParLea.corps);
verifie('aucun champ « personne » dans la réponse', !brut.includes('"personne"'));
verifie('aucune adresse mail non plus', !brut.includes('@exemple.fr'));
verifie('l’annonce de Sophie n’est pas « mienne » pour Léa', mien(vuParLea, offreSophie.corps.id)?.mienne === false);

const volRetrait = await lea.retire(offreSophie.corps.id);
verifie('Léa ne peut pas retirer l’annonce de Sophie', volRetrait.statusCode === 409);
const anonyme = new Agent('Personne');
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
const paul = new Agent('Paul'); await paul.identifie();
const dem = await paul.publie({ type:'demande', site:'Vallès', arrivee:'Impôts', heure:'12:15', places:1, note:'' });
verifie('Paul publie une demande', dem.statusCode === 201);
const mPaul = await paul.monte(offreSophie.corps.id);
verifie('et peut prendre la place qu’il cherchait', mPaul.statusCode === 201, JSON.stringify(mPaul.corps?.erreur));
const apres = await paul.panneau();
verifie('sa demande disparaît du panneau', !mien(apres, dem.corps.id));

titre('7 · « Je l’emmène » (1bis.8)');
const chloe = new Agent('Chloé'); await chloe.identifie();
const demChloe = await chloe.publie({ type:'demande', site:'Fréhel', arrivee:'Ploufragan', heure:'12:30', places:1, note:'' });
const hugo = new Agent('Hugo'); await hugo.identifie();
const emm = await hugo.emmene({ demande_id: demChloe.corps.id, heure:'12:30', places:2 });
verifie('Hugo publie et embarque Chloé', emm.statusCode === 201);
const vuChloe = await chloe.panneau();
const offreHugo = mien(vuChloe, emm.corps.id);
verifie('Chloé est à bord', offreHugo?.a_bord === true);
verifie('sa demande a disparu', !mien(vuChloe, demChloe.corps.id));
verifie('les passagers n’exposent qu’un prénom',
  JSON.stringify(offreHugo.passagers) === JSON.stringify([{ prenom:'Chloé', moi:true }]));

const emm2 = await new Agent('Iris');
await emm2.identifie();
const tardif = await emm2.emmene({ demande_id: demChloe.corps.id, heure:'12:30', places:2 });
verifie('un second conducteur arrive trop tard', tardif.statusCode === 409 && tardif.corps.erreur === 'deja_pourvue');

titre('8 · La capacité reste tenue par la base (4.3)');
const nora = new Agent('Nora'); await nora.identifie();
const complet = await nora.monte(offreSophie.corps.id);
verifie('la voiture d’une place est complète', complet.statusCode === 409 && complet.corps.erreur === 'complet');
verifie('et on nomme qui a pris la place', complet.corps.par === 'Paul');

titre('9 · Personne ne tient la liste');

const rene = new Agent('Rene');
await rene.identifie();
const corrige = await rene.appelle(session, 'PUT', { body: { prenom: 'René' } });
verifie('on corrige son propre nom', corrige.statusCode === 200 && corrige.corps.prenom === 'René');
verifie('l’ancien nom quitte la liste', !corrige.corps.gens.includes('Rene'));
verifie('le nouveau y est', corrige.corps.gens.includes('René'));

const offreRene = await rene.publie({ type:'offre', site:'Vallès', arrivee:'Rue du parc', heure:'13:00', places:2, note:'' });
const corrige2 = await rene.appelle(session, 'PUT', { body: { prenom: 'René D.' } });
verifie('renommer après avoir publié', corrige2.statusCode === 200);
const vuRene = await rene.panneau();
verifie('l’annonce déjà publiée suit le nouveau nom',
  mien(vuRene, offreRene.corps.id)?.prenom === 'René D.');

const collision = await rene.appelle(session, 'PUT', { body: { prenom: 'Sophie' } });
verifie('on ne prend pas le nom d’un autre', collision.statusCode === 409);

const retrait = await rene.appelle(session, 'DELETE', { body: { retirer: true } });
verifie('on se retire de la liste', retrait.statusCode === 200);
verifie('et on n’y est plus', !retrait.corps.gens.includes('René D.'));
const apresRetrait = await rene.panneau();
verifie('ses trajets partent avec lui', !mien(apresRetrait, offreRene.corps.id));

const anonymeApres = await new Agent('X').appelle(session, 'DELETE', { body: { retirer: true } });
verifie('se retirer sans être identifié est refusé', anonymeApres.statusCode === 401);

titre('10 · Un mois sans revenir, et l’on sort de la liste');
const vieux = new Agent('Fantome');
await vieux.identifie();
await (await import('../lib/db.js')).query(
  `update personnes set vue_le = now() - interval '40 days' where lower(nom)='fantome'`);
const listeApres = (await new Agent('Y').appelle(session, 'GET')).corps.gens;
verifie('il n’encombre plus la liste', !listeApres.includes('Fantome'));
const repris = await new Agent('Fantome').identifie(true);
verifie('et son nom est redevenu libre', repris.statusCode === 200, JSON.stringify(repris.corps));
verifie('mais c’est bien la même ligne qui reprend',
  (await new Agent('Z').appelle(session, 'GET')).corps.gens.filter(g=>g==='Fantome').length === 1);

console.log(`\n${ok} vérifications passées, ${ko} en échec.\n`);
process.exit(ko ? 1 : 0);
