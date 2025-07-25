// scripts/embed.js
;(async function(){
  const ASSETS = 'https://<your-username>.github.io/Enigma-Syndicate-Assets/assets';
  const ROOT   = document.getElementById('game-root');
  const ERR    = document.getElementById('game-errors');

  // 1) Firebase init (skip if already in prologue)
  if (typeof firebase === 'undefined') {
    console.error('Firebase not loaded');
    return;
  }
  const auth = firebase.auth(), db = firebase.database();

  // 2) Authenticate & uid
  let uid;
  await new Promise(res=>{
    auth.onAuthStateChanged(u=>{
      if(u) uid=u.uid;
      else auth.signInAnonymously().then(c=>uid=c.user.uid);
      res();
    });
  });

  // 3) Listen to full player record
  db.ref(`/players/${uid}`).on('value', snap=>{
    const p = snap.val();
    if (!p || p.prologue?.stage < 4) {
      // not ready yet
      return;
    }
    renderCard(p);
  }, e=>{
    ERR.textContent = 'DB error: '+e.message;
  });

  // 4) Render function
  function renderCard(p){
    try {
      const lvl = Math.floor(p.stats.experience/100)+1;
      let atk=0, def=0;
      p.weapons.forEach(id=>{
        // For simplicity, hard-coded scaling
        const base = (id==='tommy-gun') ? {a:15,d:0,sa:2,sd:0} : {a:0,d:12,sa:0,sd:1};
        atk += base.a + lvl*base.sa;
        def += base.d + lvl*base.sd;
      });

      ROOT.style.display = '';  // ensure visible
      ROOT.innerHTML = `
        <div style="text-align:center;">
          <img src="${ASSETS}/cards/${p.prologue.cardIndex+1}.png"
               style="width:200px;border-radius:8px;"/>
        </div>
        <div class="stats-panel">
          <p>Lvl: ${lvl}</p><p>HP: ${p.stats.health}</p>
          <p>EN: ${p.stats.energy}</p><p>XP: ${p.stats.experience}</p>
          <p>ATK: ${atk}</p><p>DEF: ${def}</p>
        </div>
      `;
    } catch(err) {
      ERR.textContent = 'Render error: '+err.message;
    }
  }
})();
