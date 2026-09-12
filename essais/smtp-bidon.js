import net from 'node:net';

/**
 * Un serveur SMTP de pacotille : il dit oui à tout et garde le message.
 * De quoi vérifier que le courrier part vraiment — en-têtes, destinataire,
 * corps — sans compte chez personne.
 */
export function smtpBidon(){
  const recu = [];
  const serveur = net.createServer(socket => {
    let dansData = false, message = '';
    socket.write('220 bidon SMTP\r\n');
    socket.on('data', d => {
      for(const ligne of d.toString().split('\r\n')){
        if(dansData){
          if(ligne === '.'){ dansData = false; recu.push(message); message = ''; socket.write('250 ok\r\n'); }
          else message += ligne + '\n';
          continue;
        }
        if(!ligne) continue;
        const cmd = ligne.slice(0,4).toUpperCase();
        if(cmd === 'EHLO' || cmd === 'HELO') socket.write('250-bidon\r\n250 8BITMIME\r\n');
        else if(cmd === 'MAIL' || cmd === 'RCPT') socket.write('250 ok\r\n');
        else if(cmd === 'DATA'){ dansData = true; socket.write('354 go\r\n'); }
        else if(cmd === 'QUIT'){ socket.write('221 bye\r\n'); socket.end(); }
        else socket.write('250 ok\r\n');
      }
    });
    socket.on('error', ()=>{});
  });
  return { serveur, recu,
    ecoute: () => new Promise(r => serveur.listen(0, '127.0.0.1', () => r(serveur.address().port))) };
}
