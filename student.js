import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCLEd9ssRy4mATexumkpfcZh2H8wiGbkHY",
  authDomain: "zulmira-edf-2026.firebaseapp.com",
  projectId: "zulmira-edf-2026",
  storageBucket: "zulmira-edf-2026.firebasestorage.app",
  messagingSenderId: "1029880685264",
  appId: "1:1029880685264:web:03c5cd00e856f65ec0b4d5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let quiz = [];
let answers = {};
let current = 0;
let student = null;
let sending = false;

const $ = (id) => document.getElementById(id);

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function banco(turma) {
  return turma.startsWith("6º") ? "6º ano" : "7º ano";
}

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function render() {
  const q = quiz[current];
  $("progress").textContent = `Questão ${current + 1} de 10`;
  $("fill").style.width = `${((current + 1) / 10) * 100}%`;

  const letters=["A","B","C","D","E"];
  $("question").innerHTML = `
    <div class="meta">${esc(q.foco)} • ${esc(q.conteudo)}</div>
    <div class="reading">${esc(q.enunciado)}</div>
    <div class="ask">${esc(q.pergunta)}</div>
    ${letters.map(l => `
      <label class="option">
        <input type="radio" name="answer" value="${l}" ${answers[q.id]===l?"checked":""}>
        <span><b>${l})</b> ${esc(q[l])}</span>
      </label>
    `).join("")}
  `;

  document.querySelectorAll('input[name="answer"]').forEach(el => {
    el.addEventListener("change", e => {
      answers[q.id] = e.target.value;
      $("error").hidden = true;
    });
  });

  $("next").hidden = current === 9;
  $("finish").hidden = current !== 9;
}

async function start(e) {
  e.preventDefault();
  $("startError").hidden = true;

  const nome=$("nome").value.trim();
  const turma=$("turma").value;
  const turno=$("turno").value;

  try {
    await signInAnonymously(auth);
    const snap=await getDocs(query(
      collection(db,"questoes_publicas"),
      where("serie","==",banco(turma))
    ));
    const all=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(all.length<10) throw new Error("Banco insuficiente");

    quiz=shuffle(all).slice(0,10);
    quiz=shuffle(quiz);
    answers={}; current=0;
    student={nome,turma,turno};

    $("start").hidden=true;
    $("quiz").hidden=false;
    render();
    scrollTo({top:0,behavior:"smooth"});
  } catch(err) {
    console.error(err);
    $("startError").textContent="Não foi possível iniciar a atividade. Tente novamente.";
    $("startError").hidden=false;
  }
}

$("next").addEventListener("click",()=>{
  if(!answers[quiz[current].id]){
    $("error").textContent="Responda esta questão antes de continuar.";
    $("error").hidden=false;
    return;
  }
  current++;
  render();
  scrollTo({top:0,behavior:"smooth"});
});

$("finish").addEventListener("click",async()=>{
  if(quiz.some(q=>!answers[q.id])){
    $("error").textContent="Responda todas as questões antes de finalizar.";
    $("error").hidden=false;
    return;
  }
  if(sending) return;
  sending=true;
  $("finish").disabled=true;

  try {
    await addDoc(collection(db,"tentativas"),{
      alunoUid:auth.currentUser.uid,
      nome:student.nome,
      turma:student.turma,
      turno:student.turno,
      questionIds:quiz.map(q=>q.id),
      answers,
      createdAt:serverTimestamp()
    });

    $("quiz").hidden=true;
    $("done").hidden=false;
    scrollTo({top:0,behavior:"smooth"});
  } catch(err) {
    console.error(err);
    $("finish").disabled=false;
    sending=false;
    $("error").textContent="Não foi possível registrar a atividade.";
    $("error").hidden=false;
  }
});

$("form").addEventListener("submit",start);
