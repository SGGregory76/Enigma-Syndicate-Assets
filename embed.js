// embed.js — fixed ASSETS_BASE_URL, persistent per‐UID
(async function(){
  // 0) Ensure ASSETS_BASE_URL is defined
  if (!window.ASSETS_BASE_URL) {
    window.ASSETS_BASE_URL = 'https://SGGregory76.github.io/Enigma-Syndicate-Assets';
  }

  // 1) Inject scoped CSS
  const css = `
    /* your scoped card styles */
    #enigma-game-root { /* ... */ }
    /* (copy in the full CSS block from before) */
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // 2) Ensure container & error exist
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
    // 3) Read data- overrides
    const forcedUid    = root.dataset.uid;
    const forcedCardId = root.dataset.cardid;

    // 4) Load Firebase SDKs if needed (omitted: copy your existing loader)

    // 5) Init Firebase
    firebase.initializeApp({ /* your config */ });
    const auth = firebase.auth(), db = firebase.database();

    // 6) Authenticate & apply forcedUid
    let uid;
    await new Promise((res, rej) => {
      auth.onAuthStateChanged(u => {
        if (u) uid = u.uid;
        else auth.signInAnonymously().then(c => { uid = c.user.uid; }).catch(rej);
        res();
      });
    });
    if (forcedUid) uid = forcedUid;

    // 7) Card metadata (copy your block)
    const cardMeta = { /* … */ };

    // 8) Fetch existing record
    let player = await db.ref(`/players/${uid}`).once('value').then(s => s.val());

    // 9) Seed if missing
    if (!player) {
      const cardId = (forcedCardId && cardMeta[forcedCardId])
                     ? forcedCardId
                     : Object.keys(cardMeta)[Math.floor(Math.random()*Object.keys(cardMeta).length)];
      player = { /* build default with cardId … */ };
      await db.ref(`/players/${uid}`).set(player);
    }
    // 10) Override in-memory if forcedCardId
    if (forcedCardId && cardMeta[forcedCardId]) {
      player.cardId  = forcedCardId;
      player.faction = cardMeta[forcedCardId].faction;
    }

    // 11) JSON fetch helper
    async function fetchJSON(path){
      const r = await fetch(path);
      if (!r.ok) throw new Error(`Fetch ${path} failed (${r.status})`);
      return r.json();
    }

    // 12) Load weapons
    const wdefs = await Promise.all(
      player.weapons.map(id =>
        fetchJSON(`${window.ASSETS_BASE_URL}/assets/json/weapons/${id}.json`)
      )
    );

    // 13) Load faction bonuses (fallback) & compute and render as before…

    err.textContent = '';
  }
  catch (e) {
    document.getElementById('enigma-error').textContent = 'Error: ' + e.message;
  }
})();
