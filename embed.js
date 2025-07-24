// embed.js — with strict data-uid & data-cardid overrides
(async function(){
  // scoped CSS injection (omitted for brevity—copy from before)
  /* … */

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

  // 1) Read overrides
  const forcedUid    = root.dataset.uid;     // must match firebase record key
  const forcedCardId = root.dataset.cardid;  // e.g. "lola_the_quick"

  try {
    // 2) Load Firebase SDKs (omitted… copy from before)
    /* … */

    // 3) Init Firebase
    /* … */

    const auth = firebase.auth(), db = firebase.database();

    // 4) Authenticate anonymously, then override
    let uid;
    await new Promise((res, rej) => {
      auth.onAuthStateChanged(user => {
        if (user) uid = user.uid;
        else auth.signInAnonymously().then(c => uid = c.user.uid).catch(rej);
        res();
      });
    });
    if (forcedUid) uid = forcedUid;

    // 5) Card metadata
    const cardMeta = {
      vito_the_intimidator: { faction:'enforcers',   displayName:'Vito the Intimidator' },
      lola_the_quick:       { faction:'undercutters', displayName:'Lola the Quick'   },
      bruno_the_tank:       { faction:'syndicate',   displayName:'Bruno the Tank'   }
    };

    // 6) Fetch or seed
    let player = await db.ref(`/players/${uid}`).once('value').then(s=>s.val());

    if (!player) {
      // If data-cardid is provided, use that—never random
      const cardId = forcedCardId && cardMeta[forcedCardId]
                     ? forcedCardId
                     : Object.keys(cardMeta)[Math.floor(Math.random()*Object.keys(cardMeta).length)];

      player = {
        cardId,
        faction: cardMeta[cardId].faction,
        weapons: ['tommy-gun','bulletproof_vest'],
        stats: { health:100, energy:50, experience:0 },
        abilities: { quick_shot:{ attackBonus:5, cooldown:30 } },
        lastUpdated: new Date().toISOString()
      };
      await db.ref(`/players/${uid}`).set(player);
    }

    // 7) If they *did* give you data-cardid but a different player record already existed,
    //    override the cardId in-memory so you see what they requested:
    if (forcedCardId && cardMeta[forcedCardId]) {
      player.cardId = forcedCardId;
      player.faction = cardMeta[forcedCardId].faction;
    }

    // 8) Continue rendering as before…
    /* fetchJSON, wdefs, fac, compute totals, render UI */

    err.textContent = '';
  }
  catch (e) {
    err.textContent = 'Error: ' + e.message;
  }
})();

