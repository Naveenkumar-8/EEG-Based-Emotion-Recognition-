const fileInput = document.getElementById('fileInput');
const startBtn = document.getElementById('startBtn');
const progressBar = document.getElementById('progressBar');
const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d');
const emoji = document.getElementById('emoji');
const labelEl = document.getElementById('label');
const confEl = document.getElementById('conf');
const replayBtn = document.getElementById('replayBtn');
let lastData = null;
let lastResult = null;
let audioCtx = null;

function ensureAudio(){ if(!audioCtx){ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } }

function playToneForEmotion(label){
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  if(label==='Happy'){ o.frequency.value = 880; g.gain.value=0.04; }
  else if(label==='Sad'){ o.frequency.value = 220; g.gain.value=0.04; }
  else { o.frequency.value = 440; g.gain.value=0.03; }
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.6);
  o.stop(audioCtx.currentTime+0.7);
}

function drawWaveSegment(data, progress){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.beginPath();
  const w = canvas.width;
  const h = canvas.height;
  const N = data.length;
  for(let i=0;i<N;i++){
    const x = (i/N)*w;
    const y = h/2 - (data[i])* (h/3);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.stroke();
}

startBtn.addEventListener('click', async ()=>{
  if(!fileInput.files.length){ alert('Select a file'); return; }
  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  startBtn.disabled = true;
  startBtn.textContent = 'Uploading...';
  const res = await fetch('/analyze',{method:'POST',body:fd});
  if(!res.ok){ alert('Upload failed'); startBtn.disabled=false; startBtn.textContent='Analyze & Stream'; return; }
  const j = await res.json();
  lastData = j.data;
  lastResult = j;
  replayBtn.disabled = true;
  await animateStream(j);
  replayBtn.disabled = false;
  startBtn.disabled = false;
  startBtn.textContent = 'Analyze & Stream';
});

async function animateStream(j){
  const frames = j.frames || 60;
  const frameLen = j.frame_len || Math.ceil(j.data.length/frames);
  const duration = j.duration_sec || 12;
  const msPerFrame = Math.max(50, Math.floor((duration*1000)/frames));
  const labels = j.labels || [];
  const confs = j.confidences || [];
  const data = j.data || [];
  for(let f=0; f<frames; f++){
    const upto = Math.min(data.length, (f+1)*frameLen);
    const segment = data.slice(0, upto);
    drawWaveSegment(segment, f/frames);
    progressBar.style.width = Math.round(((f+1)/frames)*100)+'%';
    const lab = labels[f] || '-';
    const conf = confs[f] || '-';
    labelEl.textContent = lab;
    confEl.textContent = 'Confidence: '+conf;
    const map = {'Happy':'/static/images/happy.svg','Sad':'/static/images/sad.svg','Neutral':'/static/images/neutral.svg'};
    if(map[lab]) emoji.src = map[lab];
    playToneForEmotion(lab);
    await new Promise(r=>setTimeout(r, msPerFrame));
  }
  progressBar.style.width = '100%';
}

replayBtn.addEventListener('click', ()=>{ if(lastResult) animateStream(lastResult); });

document.getElementById('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('dark');
  document.getElementById('themeToggle').textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
});

// Gallery interaction: update main image when thumbnail clicked
document.querySelectorAll('.thumb img').forEach(img => {
  img.addEventListener('click', (e) => {
    const src = e.target.getAttribute('src');
    const main = document.getElementById('galleryMain');
    if(main) main.src = src;
  });
});
