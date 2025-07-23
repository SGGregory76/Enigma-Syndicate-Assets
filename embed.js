// embed.js — Enigma Syndicate card with blog-friendly styling
(async function(){
  // 1) Inject scoped CSS
  const css = `
    /* make the card “fit” your post content */
    #enigma-game-root {
      box-sizing: border-box;
      width: 100%;
      max-width: 500px;       /* adjust to taste */
      margin: 1.5em auto;     /* breathing room */
      background: var(--bg-body,#fff);  /* inherit blog background */
      border: 1px solid var(--border-color,#ddd);
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
      font-family: inherit;    /* match blog font */
    }
    #enigma-game-root .faction-badge {
      width: 40px;
      display: block;
      margin: 0.5em auto;
    }
    #enigma-game-root .card-image {
      width: 100%;
      display: block;
    }
    #enigma-game-root .stats-panel {
      padding: 0.75em 1em;
      font-family: inherit;
      text-align: center;
      color: var(--text-color,#333);
    }
    #enigma-game-root .stats-panel p {
      margin: 0.25em 0;
      line-height: 1.2;
    }
    #enigma-game-root .weapons-panel {
      padding: 0.5em 1em 1em;
      text-align: center;
    }
    #enigma-game-root .weapons-panel img {
      width: 30px;
      margin: 0 4px;
      vertical-align: middle;
    }
    #enigma-error {
      text-align: center;
      color: red;
      margin-top: 0.5em;
      font-family: inherit;
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // 2) Ensure root + error exist
  let root = document.getElementById('enigma-game-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'enigma-game-root';
    document.currentScript.insertAdjacentElement('beforebegin', root);
  }
  let err = document.getElementById('enigma-error');
  if (!err) {
    err = document.createElement('pre');
    err.id = 'enigma-error';
    root.insertAdjacentElement('afterend', err);
  }
  err.textContent = 'Loading game…';

  try {
    // 3) Load Firebase compat if needed
    if (!window.firebase) {
      await new Promise((res, rej) => {
        const urls = [
          'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
          'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
          'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'
        ];
        let count = 0;
        urls.forEach(src => {
          const s = document.createElement('script');
          s.src = src;
          s.onload = () => (++count === urls.length) && res();
          s.onerror = rej;
          document.head.appendChild(s);
        });
      });
    }

    // 4) Initialize Firebase
    firebase.initializeApp({
      apiKey: "AIzaSyCiFF0giW60YhEF9MPF8RMMETXkNW9vv2Y",
      authDomain: "sandbox-mafia.firebaseapp.com",
      databaseURL: "https://sandbox-mafia-default-rtdb.firebaseio.com",
      projectId: "sandbox-mafia",
      storageBucket: "sandbox-mafia.firebasestorage.app",
      messagingSenderId: "966783573980",
      appId: "1:966783573980:web:a07a7b66d7d9a057dab919"
    });
    const auth = firebase.auth(), db = firebase.database();

    // 5) XP → level helper
    const xpToLevel = xp => Math.floor(xp/100) + 1;

    // 6) Anonymous auth
    let uid;
    await new Promise((res, rej) => {
      auth.onAuthStateChanged(u => {
        if (u) uid = u.uid, res();
        else auth.signInAnonymously()
                 .then(c => { uid = c.user.uid; res(); })
                 .catch(rej);
      });
    });

    // 7) Inline card metadata
    const cardMeta = {
      vito_the_intimidator:{ faction:'enforcers',   displayName:'Vito the Intimidator' },
      lola_the_quick:      { faction:'undercutters', displayName:'Lola the Quick'   },
      bruno_the_tank:      { faction:'syndicate',   displayName:'Bruno the Tank'   }
    };

    // 8) Fetch or seed player
    let player = await db.ref(`/players/${uid}`).once('value').then(s => s.val());
    if (!player) {
      const cards = Object.keys(cardMeta);
      const cardId = cards[Math.floor(Math.random()*cards.length)];
      player = {
        cardId,
        faction: cardMeta[cardId].faction,
        weapons:['tommy-gun','bulletproof_vest'],
        stats:{health:100,energy:50,experience:0},
        abilities:{quick_shot:{attackBonus:5,cooldown:30}},
        lastUpdated:new Date().toISOString()
      };
      await db.ref(`/players/${uid}`).set(player);
    }

    // 9) fetchJSON helper
    async function fetchJSON(path){
      const r = await fetch(path);
      if (!r.ok) throw new Error(`Fetch ${path} failed (${r.status})`);
      return r.json();
    }

    // 10) Load weapons and faction
    const wdefs = await Promise.all(
      player.weapons.map(id =>
        fetchJSON(`${window.ASSETS_BASE_URL}/assets/json/weapons/${id}.json`)
      )
    );
    let fac;
    try {
      fac = await db.ref(`/factions/${player.faction}`).once('value').then(s=>s.val());
      if (!fac || !fac.bonuses) throw 0;
    } catch {
      fac = { bonuses:{attack:0,defense:0} };
    }

    // 11) Compute totals
    const lvl = xpToLevel(player.stats.experience);
    let totalAtk=0, totalDef=0;
    wdefs.forEach(w=>{
      totalAtk += w.baseStats.attack + lvl*w.scaling.attackPerLevel;
      totalDef += w.baseStats.defense + lvl*w.scaling.defensePerLevel;
    });
    totalAtk += fac.bonuses.attack;
    totalDef += fac.bonuses.defense;

    // 12) Render
    root.innerHTML = '';
    root.append(
      Object.assign(document.createElement('img'),{
        src:`${window.ASSETS_BASE_URL}/assets/factions/${player.faction}.png`,
        className:'faction-badge'
      }),
      Object.assign(document.createElement('img'),{
        src:`${window.ASSETS_BASE_URL}/assets/cards/${player.cardId}.png`,
        className:'card-image'
      }),
      Object.assign(document.createElement('div'),{
        className:'stats-panel',
        innerHTML:`
          <p>${cardMeta[player.cardId].displayName}</p>
          <p>Level: ${lvl}</p>
          <p>Health: ${player.stats.health}</p>
          <p>Energy: ${player.stats.energy}</p>
          <p>XP: ${player.stats.experience}</p>
          <p>Total ATK: ${totalAtk}</p>
          <p>Total DEF: ${totalDef}</p>`
      }),
      Object.assign(document.createElement('div'),{className:'weapons-panel'})
    );
    const wp = root.querySelector('.weapons-panel');
    wdefs.forEach(w=>{
      const img = document.createElement('img');
      img.src = `${window.ASSETS_BASE_URL}/assets/weapons/${w.id}.png`;
      img.title = `${w.name} — ATK:${w.baseStats.attack+lvl*w.scaling.attackPerLevel} DEF:${w.baseStats.defense+lvl*w.scaling.defensePerLevel}`;
      wp.append(img);
    });

    err.textContent = '';
  }
  catch(e){
    err.textContent = 'Error: '+e.message;
  }
})();
