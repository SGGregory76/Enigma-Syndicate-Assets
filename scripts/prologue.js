// scripts/prologue.js
;(async function(){
  const ASSETS = 'https://<your-username>.github.io/Enigma-Syndicate-Assets/assets';
  const ROOT   = document.getElementById('prologue-root');
  const ERR    = document.getElementById('prologue-errors');

  // 1) Firebase init
  firebase.initializeApp({
    apiKey:    "AIzaSyCiFF0giW60YhEF9MPF8RMMETXkNW9vv2Y",
    authDomain:"sandbox-mafia.firebaseapp.com",
    databaseURL:"https://sandbox-mafia-default-rtdb.firebaseio.com",
    projectId: "sandbox-mafia",
    storageBucket:"sandbox-mafia.firebasestorage.app",
    messagingSenderId:"966783573980",
    appId:     "1:966783573980:web:a07a7b66d7d9a057dab919"
  });
  const auth = firebase.auth(), db = firebase.database();

  // 2) Auth & uid
  let uid;
  await new Promise(res=>{
    auth.onAuthStateChanged(u=>{
      if(u) uid=u.uid;
      else auth.signInAnonymously().then(c=>uid=c.user.uid);
      res();
    });
  });

  // 3) Prologue state ref
  const pref = db.ref(`/players/${uid}/prologue`);
  const snap = await pref.once('value');
  if(!snap.exists()){
    // seed stage 0 + random card pick
    const cards = [
      'card1.png','card2.png','card3.png','card4.png','card5.png',
      'card6.png','card7.png','card8.png','card9.png','card10.png'
    ];
    const idx = Math.floor(Math.random()*cards.length);
    await pref.set({ stage:0, cardIndex:idx, answers:[], picks:[], boss:null });
  }

  // 4) Scene renderers
  function showIntro(state){
    ROOT.innerHTML = `
      <div style="text-align:center;">
        <img src="${ASSETS}/cards/${state.cardIndex+1}.png" 
             style="width:150px;border-radius:6px;margin-bottom:12px;"/>
        <h2>Welcome to the Secret Masquerade</h2>
        <p>Your micro-adventure begins now.</p>
        <button id="btn-next">Begin Prologue</button>
      </div>`;
    document.getElementById('btn-next').onclick = ()=> pref.update({ stage:1 });
  }

  const questions = [
    "Bold action or subtlety?",
    "Trust your instincts or plan ahead?",
    "Work alone or in a team?",
    "Righteous cause or profit?",
    "Risk everything or play it safe?"
  ];
  function showQuestions(state){
    const i = state.answers.length;
    const q = questions[i];
    ROOT.innerHTML = `
      <div style="text-align:center;">
        <p><strong>Q${i+1}:</strong> ${q}</p>
        <button id="yes">Yes</button> <button id="no">No</button>
      </div>`;
    ['yes','no'].forEach(opt=>{
      document.getElementById(opt).onclick = ()=>{
        const ans = state.answers.concat(opt);
        const next = (ans.length >= questions.length) ? 2 : 1;
        pref.update({ answers: ans, stage: next });
      };
    });
  }

  function showPuzzle(){
    ROOT.innerHTML = `
      <div style="text-align:center;">
        <h3>Stash Puzzle (3×3)</h3>
        <p>Select one of the nine boxes below:</p>
        <div style="display:grid;grid-template:repeat(3,80px)/repeat(3,80px);gap:4px;">
          ${[...Array(9)].map((_,i)=>`<div class="cell" data-i="${i}"
            style="border:1px solid #333;cursor:pointer;"></div>`).join('')}
        </div>
      </div>`;
    document.querySelectorAll('.cell').forEach(c=>{
      c.onclick = ()=>{
        const pick = Number(c.dataset.i);
        pref.update({ picks: state.picks.concat(pick), stage:3 });
      };
    });
  }

  function showBoss(){
    ROOT.innerHTML = `
      <div style="text-align:center;">
        <h3>Boss: Wax Phantom</h3>
        <p>Combat simulator coming soon…</p>
        <button id="btn-win">Simulate Victory</button>
      </div>`;
    document.getElementById('btn-win').onclick = ()=> pref.update({ boss:{result:'victory'}, stage:4 });
  }

  function showComplete(){
    ROOT.innerHTML = `
      <div style="text-align:center;">
        <h2>Prologue Complete!</h2>
        <p>Loading your final card…</p>
      </div>`;
  }

  // 5) Listen & route
  pref.on('value', snap=>{
    const state = snap.val() || {stage:0,answers:[]};
    ERR.textContent = '';
    switch(state.stage){
      case 0: return showIntro(state);
      case 1: return showQuestions(state);
      case 2: return showPuzzle();
      case 3: return showBoss();
      case 4: return showComplete();
      default: ERR.textContent = 'Unknown stage '+state.stage;
    }
  }, e=>{
    ERR.textContent = 'Firebase error: '+e.message;
  });

})();

