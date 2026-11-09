// Calculadora — parser próprio (sem eval), histórico, teclado e animações.
const $ = (s) => document.querySelector(s);
const calc = $("#calc"), exprEl = $("#expr"), resEl = $("#result"), prevEl = $("#preview");
let expr = "", justEvaluated = false, deg = true;
let history = load();

/* ---------- Parser (recursive descent) ---------- */
function evaluate(src) {
  const s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/,/g, ".");
  let i = 0;
  const peek = () => s[i], eat = (c) => (s[i] === c ? (i++, true) : false);
  const toRad = (x) => (deg ? (x * Math.PI) / 180 : x);
  const fns = {
    sin: (x) => round(Math.sin(toRad(x))),
    cos: (x) => round(Math.cos(toRad(x))),
    tan: (x) => round(Math.tan(toRad(x))),
    log: Math.log10, ln: Math.log, "√": Math.sqrt,
  };
  const fact = (n) => {
    if (n < 0 || !Number.isInteger(n) || n > 170) throw Error("n!");
    let r = 1; for (let k = 2; k <= n; k++) r *= k; return r;
  };

  function expression() {
    let v = term();
    for (;;) {
      if (eat("+")) v += term();
      else if (eat("-")) v -= term();
      else return v;
    }
  }
  function term() {
    let v = unary();
    for (;;) {
      if (eat("*")) v *= unary();
      else if (eat("/")) { const d = unary(); if (d === 0) throw Error("÷0"); v /= d; }
      else if (/[\d.(πe√a-z]/.test(peek() || "")) v *= power(); // multiplicação implícita: 2π, 3(4)
      else return v;
    }
  }
  function unary() {
    if (eat("-")) return -unary();
    if (eat("+")) return unary();
    return power();
  }
  function power() {
    const b = postfix();
    return eat("^") ? Math.pow(b, unary()) : b;
  }
  function postfix() {
    let v = primary();
    for (;;) {
      if (eat("²")) v = v * v;
      else if (eat("!")) v = fact(v);
      else if (eat("%")) v = v / 100;
      else return v;
    }
  }
  function primary() {
    if (eat("(")) { const v = expression(); eat(")"); return v; }
    if (eat("π")) return Math.PI;
    for (const name of Object.keys(fns)) {
      if (s.startsWith(name, i)) {
        i += name.length;
        eat("(");
        const v = fns[name](expression());
        eat(")");
        return v;
      }
    }
    if (peek() === "e" && !s.startsWith("e", i + 1)) { i++; return Math.E; }
    const m = /^\d*\.?\d+(e[+-]?\d+)?|^\d+\./.exec(s.slice(i));
    if (!m) throw Error("syntax");
    i += m[0].length;
    return parseFloat(m[0]);
  }

  const v = expression();
  if (i < s.length) throw Error("syntax");
  if (!isFinite(v)) throw Error("inf");
  return v;
}
const round = (x) => Math.round(x * 1e12) / 1e12;

function fmt(n) {
  if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(6).replace(".", ",");
  return round(n).toLocaleString("pt-BR", { maximumFractionDigits: 10 });
}

/* ---------- UI ---------- */
function render() {
  resEl.textContent = expr || "0";
  resEl.classList.toggle("small", expr.length > 12);
  exprEl.textContent = "";
  try { prevEl.textContent = expr && /[^\d,]/.test(expr) ? "= " + fmt(evaluate(expr)) : ""; }
  catch { prevEl.textContent = ""; }
}

function input(v) {
  if (justEvaluated) {
    if (/[\d,(πe]/.test(v) || v.endsWith("(")) expr = "";
    justEvaluated = false;
  }
  const last = expr.slice(-1);
  if (/[+−×÷^]/.test(v) && /[+−×÷^]/.test(last)) expr = expr.slice(0, -1); // troca operador
  if (v === "," ) {
    const num = expr.split(/[^\d,]/).pop();
    if (num.includes(",")) return;
    if (!num) v = "0,";
  }
  expr += v;
  render();
}

function equals() {
  if (!expr) return;
  try {
    const v = evaluate(expr);
    const out = fmt(v);
    pushHistory(expr, out);
    exprEl.textContent = expr + " =";
    expr = out.replace(/\./g, "");
    resEl.textContent = out;
    prevEl.textContent = "";
    animate("pop");
    confetti();
    justEvaluated = true;
  } catch (e) {
    animate("shake");
    prevEl.textContent = e.message === "÷0" ? "Não dá pra dividir por zero 😅" : "Expressão inválida";
  }
}

function animate(cls) {
  resEl.classList.remove("pop", "shake");
  void resEl.offsetWidth;
  resEl.classList.add(cls);
}

function action(a) {
  if (a === "clear") { expr = ""; justEvaluated = false; render(); }
  else if (a === "back") {
    const fn = /(sin|cos|tan|log|ln|√)\($/.exec(expr);
    expr = fn ? expr.slice(0, -fn[0].length) : expr.slice(0, -1);
    justEvaluated = false; render();
  }
  else if (a === "eq") equals();
}

/* ---------- Effects ---------- */
function ripple(btn, e) {
  const r = btn.getBoundingClientRect(), size = Math.max(r.width, r.height);
  const span = document.createElement("span");
  span.className = "ripple";
  span.style.cssText = `width:${size}px;height:${size}px;left:${(e?.clientX ?? r.left + r.width / 2) - r.left - size / 2}px;top:${(e?.clientY ?? r.top + r.height / 2) - r.top - size / 2}px`;
  btn.appendChild(span);
  setTimeout(() => span.remove(), 600);
}

function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = resEl.getBoundingClientRect();
  const colors = ["#8b5cf6", "#ec4899", "#06b6d4", "#facc15", "#22c55e"];
  for (let k = 0; k < 18; k++) {
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = r.right - 40 + "px";
    c.style.top = r.top + 20 + "px";
    c.style.background = colors[k % colors.length];
    c.style.setProperty("--x", (Math.random() - 0.6) * 260 + "px");
    c.style.setProperty("--y", (Math.random() - 0.3) * 220 + "px");
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1000);
  }
}

/* ---------- History ---------- */
function load() { try { return JSON.parse(localStorage.getItem("calc-hist")) || []; } catch { return []; } }
function save() { try { localStorage.setItem("calc-hist", JSON.stringify(history)); } catch {} }
function pushHistory(e, r) { history.unshift({ e, r }); history = history.slice(0, 30); save(); drawHistory(); }
function drawHistory() {
  const ul = $("#histList");
  ul.innerHTML = history.length ? "" : '<li class="empty">Nada por aqui ainda ✨</li>';
  history.forEach((h, idx) => {
    const li = document.createElement("li");
    li.style.animationDelay = idx * 30 + "ms";
    li.innerHTML = `<small></small><b></b>`;
    li.querySelector("small").textContent = h.e + " =";
    li.querySelector("b").textContent = h.r;
    li.onclick = () => { expr = h.r.replace(/\./g, ""); justEvaluated = true; render(); calc.classList.remove("hist-on"); };
    ul.appendChild(li);
  });
}

/* ---------- Events ---------- */
document.querySelectorAll("[data-v],[data-fn],[data-a]").forEach((b) =>
  b.addEventListener("click", (e) => {
    if (b.classList.contains("k")) ripple(b, e);
    if (b.dataset.a) action(b.dataset.a);
    else input(b.dataset.v ?? b.dataset.fn);
  })
);
document.querySelectorAll(".chip").forEach((c) =>
  c.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((x) => x.classList.toggle("active", x === c));
    calc.classList.toggle("sci-on", c.dataset.mode === "sci");
  })
);
$("#degBtn").onclick = () => { deg = !deg; $("#degBtn").textContent = deg ? "DEG" : "RAD"; render(); };
$("#histBtn").onclick = () => calc.classList.toggle("hist-on");
$("#clearHist").onclick = () => { history = []; save(); drawHistory(); };
$("#themeBtn").onclick = () => {
  const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("calc-theme", t); } catch {}
};
try { const t = localStorage.getItem("calc-theme"); if (t) document.documentElement.dataset.theme = t; } catch {}

const keyMap = { "*": "×", "/": "÷", "-": "−", "+": "+", ".": ",", ",": ",", "^": "^", "(": "(", ")": ")", "%": "%", "!": "!", p: "π" };
document.addEventListener("keydown", (e) => {
  let v = null, a = null;
  if (/^\d$/.test(e.key)) v = e.key;
  else if (keyMap[e.key]) v = keyMap[e.key];
  else if (e.key === "Enter" || e.key === "=") a = "eq";
  else if (e.key === "Backspace") a = "back";
  else if (e.key === "Escape" || e.key === "Delete") a = "clear";
  else return;
  e.preventDefault();
  const btn = [...document.querySelectorAll(".k")].find((b) => (a ? b.dataset.a === a : b.dataset.v === v));
  if (btn) { btn.classList.add("press"); ripple(btn); setTimeout(() => btn.classList.remove("press"), 120); }
  a ? action(a) : input(v);
});

drawHistory();
render();
