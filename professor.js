import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCLEd9ssRy4mATexumkpfcZh2H8wiGbkHY",
  authDomain: "zulmira-edf-2026.firebaseapp.com",
  projectId: "zulmira-edf-2026",
  storageBucket: "zulmira-edf-2026.firebasestorage.app",
  messagingSenderId: "1029880685264",
  appId: "1:1029880685264:web:03c5cd00e856f65ec0b4d5"
};

const PROFESSOR_UID = "hB4AklFKEsdbYurubwkYbTcoFnd2";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CONTENTS = {
  "6º ano": [
    "Esportes de marca",
    "Esportes técnico-combinatórios",
    "Práticas corporais de aventura",
    "Jogos eletrônicos",
    "Jogos de tabuleiro"
  ],
  "7º ano": [
    "Esportes de precisão",
    "Jogos eletrônicos e exergaming",
    "Práticas corporais de aventura"
  ]
};

let attempts = [];
let questions = new Map();
let keys = new Map();
let filtered = [];
let currentActivity = null;

const $ = id => document.getElementById(id);

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function dateText(t) {
  return t?.toDate ? t.toDate().toLocaleString("pt-BR") : "—";
}

function dateKey(t) {
  if (!t?.toDate) return "";
  const d = t.toDate();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function score(a) {
  let n = 0;
  (a.questionIds || []).forEach(id => {
    if (a.answers?.[id] && keys.get(id)?.correta === a.answers[id]) n++;
  });
  return {
    n,
    pct: a.questionIds?.length ? Math.round(n / a.questionIds.length * 100) : 0
  };
}

function updateContentOptions() {
  const ano = $("atividadeAno").value;
  $("atividadeConteudo").innerHTML = (CONTENTS[ano] || [])
    .map(c => `<option>${esc(c)}</option>`)
    .join("");
}

async function loadCurrentActivity() {
  const snap = await getDoc(doc(db, "atividades", "atual"));
  if (snap.exists()) {
    currentActivity = { id: snap.id, ...snap.data() };
    $("currentActivity").innerHTML = `
      <strong>Atividade ativa:</strong> ${esc(currentActivity.ano)}
      — ${esc(currentActivity.conteudo)}
      <span class="activeTag">ATIVA</span>
    `;
  } else {
    currentActivity = null;
    $("currentActivity").textContent = "Nenhuma atividade ativa.";
  }
}

async function activateActivity() {
  $("activityError").hidden = true;
  const ano = $("atividadeAno").value;
  const conteudo = $("atividadeConteudo").value;

  try {
    // Antes de ativar, conferimos se existem pelo menos 5 questões de cada abordagem.
    const qs = await getDocs(
      collection(db, "questoes_publicas")
    );
    const matching = qs.docs.map(d => d.data())
      .filter(q => q.serie === ano && q.conteudo === conteudo);

    const tech = matching.filter(q => q.foco === "Educação Física").length;
    const reading = matching.filter(q => q.foco === "Leitura e interpretação").length;

    if (tech < 5 || reading < 5) {
      throw new Error(`Este conteúdo possui ${tech} questões de Educação Física e ${reading} de leitura/interpretação. São necessárias pelo menos 5 de cada.`);
    }

    currentActivity = {
      id: "atual",
      ano,
      conteudo,
      ativa: true,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    };

    await setDoc(doc(db, "atividades", "atual"), currentActivity);

    $("currentActivity").innerHTML = `
      <strong>Atividade ativa:</strong> ${esc(ano)}
      — ${esc(conteudo)}
      <span class="activeTag">ATIVA</span>
    `;
    $("activitySuccess").textContent = "Atividade disponibilizada para os alunos.";
    $("activitySuccess").hidden = false;
  } catch (err) {
    console.error(err);
    $("activityError").textContent = err.message || "Não foi possível criar a atividade.";
    $("activityError").hidden = false;
  }
}

async function loadData() {
  const [qs, ks, ts] = await Promise.all([
    getDocs(collection(db, "questoes_publicas")),
    getDocs(collection(db, "gabaritos")),
    getDocs(collection(db, "tentativas"))
  ]);

  questions = new Map(qs.docs.map(d => [d.id, {id:d.id, ...d.data()}]));
  keys = new Map(ks.docs.map(d => [d.id, d.data()]));
  attempts = ts.docs.map(d => ({id:d.id, ...d.data()}));
  renderResults();
}

function renderResults() {
  const turma = $("fTurma").value;
  const turno = $("fTurno").value;
  const data = $("fData").value;

  filtered = attempts
    .filter(a =>
      (!turma || a.turma === turma) &&
      (!turno || a.turno === turno) &&
      (!data || dateKey(a.createdAt) === data)
    )
    .sort((a,b) =>
      (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
    );

  $("total").textContent = `${filtered.length} atividade(s)`;

  $("body").innerHTML = filtered.map((a,i) => {
    const s = score(a);
    return `<tr data-i="${i}">
      <td>${esc(a.nome)}</td>
      <td>${esc(a.turma)}</td>
      <td>${esc(a.turno)}</td>
      <td>${esc(a.conteudo || "—")}</td>
      <td>${s.n}</td>
      <td>${s.pct}%</td>
      <td>${esc(dateText(a.createdAt))}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">Nenhum resultado.</td></tr>`;

  document.querySelectorAll("#body tr[data-i]")
    .forEach(r => r.onclick = () => showDetail(filtered[+r.dataset.i]));
}

function showDetail(a) {
  const s = score(a);

  $("detailName").textContent = a.nome;
  $("detailSummary").textContent =
    `${a.turma} • ${a.turno} • ${a.conteudo || "—"} • ${dateText(a.createdAt)} • Nota ${s.n}/10 • ${s.pct}%`;

  $("detail").hidden = false;

  $("detailQs").innerHTML = (a.questionIds || []).map((id,i) => {
    const q = questions.get(id);
    const marked = a.answers?.[id] || "—";
    const correct = keys.get(id)?.correta || "—";
    const hit = marked === correct;

    return `<div class="detailQ">
      <div class="meta">Questão ${i+1} • ${esc(q?.foco || "")} • ${esc(q?.conteudo || "")}</div>
      <div class="reading">${esc(q?.enunciado || "")}</div>
      <div class="ask">${esc(q?.pergunta || "")}</div>
      <div><b>Resposta marcada:</b> ${esc(marked)}</div>
      <div><b>Resposta correta:</b> ${esc(correct)}</div>
      <div class="${hit ? "good" : "bad"}"><b>${hit ? "Acertou" : "Errou"}</b></div>
    </div>`;
  }).join("");

  scrollTo({top:$("detail").offsetTop-10,behavior:"smooth"});
}

function csv() {
  const rows = [["Nome","Turma","Turno","Ano","Conteúdo","Acertos","Percentual","Data e horário"]];
  filtered.forEach(a => {
    const s = score(a);
    rows.push([
      a.nome,a.turma,a.turno,a.ano || "",a.conteudo || "",
      s.n,`${s.pct}%`,dateText(a.createdAt)
    ]);
  });

  const text = rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(";")
  ).join("\n");

  const blob = new Blob(["\uFEFF"+text],{type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resultados_zulmira_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

$("atividadeAno").addEventListener("change", updateContentOptions);
$("ativarAtividade").addEventListener("click", activateActivity);
$("login").addEventListener("submit", async e => {
  e.preventDefault();
  $("loginError").hidden=true;

  try {
    await signInWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("senha").value
    );
  } catch (err) {
    console.error(err);
    $("loginError").textContent="E-mail ou senha incorretos.";
    $("loginError").hidden=false;
  }
});

$("sair").onclick=()=>signOut(auth);
$("fTurma").onchange=renderResults;
$("fTurno").onchange=renderResults;
$("fData").onchange=renderResults;

$("limpar").onclick=()=>{
  $("fTurma").value="";
  $("fTurno").value="";
  $("fData").value="";
  renderResults();
};

$("exportar").onclick=csv;
$("fechar").onclick=()=>$("detail").hidden=true;

onAuthStateChanged(auth, async user => {
  if(!user){
    $("loginCard").hidden=false;
    $("panel").hidden=true;
    return;
  }

  if(user.uid !== PROFESSOR_UID){
    await signOut(auth);
    $("loginError").textContent="Acesso não autorizado.";
    $("loginError").hidden=false;
    return;
  }

  $("loginCard").hidden=true;
  $("panel").hidden=false;

  try {
    updateContentOptions();
    await loadCurrentActivity();
    await loadData();
  } catch(err){
    console.error(err);
    $("panelError").textContent="Não foi possível carregar o painel.";
    $("panelError").hidden=false;
  }
});
