import { useState, useCallback, useRef, useEffect } from "react";
import { INITIAL_WORDS } from "./words.js";
import narutoImg from "./assets/naruto.png";
import luffyImg  from "./assets/luffy.png";

const CATEGORIES = [
  { id:"onepiece",    label:"One Piece",   emoji:"🏴‍☠️", color:"#f97316", grad:"linear-gradient(135deg,#f97316,#ef4444)" },
  { id:"naruto",      label:"Naruto",       emoji:"🍥",  color:"#f59e0b", grad:"linear-gradient(135deg,#f59e0b,#d97706)" },
  { id:"harrypotter", label:"Harry Potter", emoji:"⚡",  color:"#a855f7", grad:"linear-gradient(135deg,#a855f7,#7c3aed)" },
];

const CHILENISMOS_SUBS = [
  { id:"chilenismos_simple",   label:"Palabras Simples",     emoji:"🗣️", color:"#e63946", grad:"linear-gradient(135deg,#e63946,#c1121f)", desc:"cachai, bacán, fome..." },
  { id:"chilenismos_compuesto",label:"Expresiones Compuestas",emoji:"💬", color:"#2563eb", grad:"linear-gradient(135deg,#2563eb,#1d4ed8)", desc:"estoy pato, buena onda..." },
];

const LEVELS = { básico:"#10b981", intermedio:"#f59e0b", avanzado:"#ef4444" };
const SRS    = { easy:7*24*3600*1000, medium:24*3600*1000, hard:30*60*1000 };

function initCards(words) { return words.map(w => ({ ...w, due: Date.now(), reps: 0 })); }
function shuffle(arr)     { return [...arr].sort(() => Math.random() - 0.5); }

function speak(word, onVoiceInfo) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const trySpeak = () => {
    const voices   = window.speechSynthesis.getVoices();
    const enVoices = voices.filter(v => ["en-US","en-GB","en_US","en_GB"].includes(v.lang));
    const preferred = ["Samantha","Karen","Moira","Zira","Microsoft Zira Desktop","Google US English","Microsoft Aria Online","Microsoft Jenny Online"];
    let chosen = null;
    for (const name of preferred) { chosen = enVoices.find(v => v.name === name); if (chosen) break; }
    if (!chosen) chosen = enVoices.find(v => /female|woman|zira|samantha|karen|moira|aria|jenny/i.test(v.name));
    if (!chosen && enVoices.length > 0) chosen = enVoices[0];
    const u = new SpeechSynthesisUtterance(word);
    u.lang = chosen ? chosen.lang : "en-US"; u.rate = 0.78; u.pitch = 1.1; u.volume = 1;
    if (chosen) u.voice = chosen;
    if (onVoiceInfo) onVoiceInfo(chosen ? `🎙️ ${chosen.name}` : "⚠️ Sin voz en inglés");
    window.speechSynthesis.speak(u);
  };
  if (window.speechSynthesis.getVoices().length > 0) trySpeak();
  else { window.speechSynthesis.onvoiceschanged = () => { trySpeak(); window.speechSynthesis.onvoiceschanged = null; }; }
}

function getLetterFeedback(typed, correct) {
  return correct.split("").map((letter, i) => ({
    letter,
    status: (typed[i]||"").toLowerCase() === letter.toLowerCase() ? "correct" : typed[i] === undefined ? "missing" : "wrong"
  }));
}

export default function App() {
  const [screen,      setScreen]      = useState("home");
  const [studyMode,   setStudyMode]   = useState("flash");
  const [activeCat,   setActiveCat]   = useState(null);
  const [cards,       setCards]       = useState(() => {
    const s = {};
    for (const k in INITIAL_WORDS) s[k] = initCards(INITIAL_WORDS[k]);
    return s;
  });
  const [queue,       setQueue]       = useState([]);
  const [qIdx,        setQIdx]        = useState(0);
  const [flipped,     setFlipped]     = useState(false);
  const [typed,       setTyped]       = useState("");
  const [writeResult, setWriteResult] = useState(null);
  const [voiceInfo,   setVoiceInfo]   = useState("");
  const [options,     setOptions]     = useState([]);
  const [chosen,      setChosen]      = useState(null);
  const inputRef = useRef(null);

  const allCats = [...CATEGORIES, ...CHILENISMOS_SUBS];
  const cat       = activeCat ? allCats.find(c => c.id === activeCat) : null;
  const getDue    = useCallback((catId) => (cards[catId]||[]).filter(c => c.due <= Date.now()), [cards]);
  const buildOpts = useCallback((card) => shuffle([card.word, ...card.distractors]), []);

  const startStudy = (catId, mode) => {
    const pool = mode === "flash" ? getDue(catId) : shuffle(cards[catId] || []);
    if (!pool.length) { alert("¡No hay tarjetas pendientes! Vuelve más tarde 🎉"); return; }
    const q = pool.map(c => c.id);
    setActiveCat(catId); setQueue(q); setQIdx(0);
    setFlipped(false); setTyped(""); setWriteResult(null); setChosen(null);
    setStudyMode(mode); setScreen("study");
    if (mode === "fill") {
      const first = (cards[catId]||[]).find(c => c.id === q[0]);
      if (first) setOptions(buildOpts(first));
    }
  };

  const currentCard = activeCat && queue.length > 0
    ? (cards[activeCat]||[]).find(c => c.id === queue[qIdx]) : null;

  useEffect(() => {
    if (screen === "study" && studyMode === "write" && inputRef.current)
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [qIdx, screen, studyMode]);

  const advanceCard = (quality) => {
    const interval = quality === 3 ? SRS.easy : quality === 2 ? SRS.medium : SRS.hard;
    setCards(prev => ({
      ...prev,
      [activeCat]: prev[activeCat].map(c =>
        c.id === currentCard.id ? { ...c, due: Date.now() + interval, reps: c.reps + 1 } : c
      )
    }));
    const next = qIdx + 1;
    if (next >= queue.length) { setScreen("done"); return; }
    setFlipped(false);
    setTimeout(() => {
      setQIdx(next); setTyped(""); setWriteResult(null); setChosen(null);
      if (studyMode === "fill") {
        const nextCard = (cards[activeCat]||[]).find(c => c.id === queue[next]);
        if (nextCard) setOptions(buildOpts(nextCard));
      }
    }, 50);
  };

  const checkWrite = () => {
    if (!typed.trim()) return;
    setWriteResult(typed.trim().toLowerCase() === currentCard.word.toLowerCase() ? "correct" : "wrong");
    speak(currentCard.word, setVoiceInfo);
  };

  const handleFillChoice = (opt) => {
    if (chosen) return;
    setChosen(opt);
    speak(opt, setVoiceInfo);
  };

  const totalLearned = Object.values(cards).flat().filter(c => c.reps > 0).length;
  const totalDue     = [...CATEGORIES, ...CHILENISMOS_SUBS].reduce((a, c) => a + getDue(c.id).length, 0);
  const totalWords   = Object.values(cards).flat().length;
  const blankExample = currentCard
    ? currentCard.example.replace(new RegExp(`\\b${currentCard.word}\\b`, "gi"), "______") : "";

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (screen === "home") return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f", color:"#f1f1f1", fontFamily:"'Segoe UI',sans-serif", padding:"24px 16px", position:"relative", overflow:"hidden" }}>
      <img src={narutoImg} alt="Naruto" style={{ position:"fixed", left:0, bottom:0, height:"85vh", maxHeight:700, objectFit:"contain", objectPosition:"bottom", pointerEvents:"none", userSelect:"none", zIndex:0, opacity:0.95 }}/>
      <img src={luffyImg}  alt="Luffy"  style={{ position:"fixed", right:0, bottom:0, height:"80vh", maxHeight:650, objectFit:"contain", objectPosition:"bottom", pointerEvents:"none", userSelect:"none", zIndex:0, opacity:0.95 }}/>

      <div style={{ maxWidth:620, margin:"0 auto", position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:40 }}>📚</div>
          <h1 style={{ margin:"4px 0 0", fontSize:26, fontWeight:800, background:"linear-gradient(90deg,#f97316,#a855f7)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Chileno Bilingüe</h1>
          <p style={{ color:"#666", margin:"4px 0 0", fontSize:13 }}>Aprende inglés como nunca antes 🇨🇱</p>
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:24 }}>
          {[{l:"Aprendidas",v:totalLearned,i:"🧠"},{l:"Pendientes",v:totalDue,i:"⏰"},{l:"Total palabras",v:totalWords,i:"📖"}].map(s=>(
            <div key={s.l} style={{ flex:1, background:"#1a1a1a", borderRadius:12, padding:"12px 6px", textAlign:"center" }}>
              <div style={{ fontSize:18 }}>{s.i}</div>
              <div style={{ fontSize:22, fontWeight:700 }}>{s.v}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Categorías normales */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
          {CATEGORIES.map(c => {
            const due     = getDue(c.id).length;
            const total   = (cards[c.id]||[]).length;
            const learned = (cards[c.id]||[]).filter(x=>x.reps>0).length;
            const pct     = total>0 ? Math.round((learned/total)*100) : 0;
            return (
              <div key={c.id} style={{ background:"rgba(26,26,26,0.92)", backdropFilter:"blur(8px)", borderRadius:16, padding:16, border:`1px solid ${c.color}33` }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:24 }}>{c.emoji}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{c.label}</div>
                      <div style={{ fontSize:11, color:"#666" }}>{total} palabras · {pct}% dominio</div>
                    </div>
                  </div>
                  {due>0 && <div style={{ background:c.color, color:"#000", borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{due} pendientes</div>}
                </div>
                <div style={{ background:"#2a2a2a", borderRadius:99, height:5, marginBottom:12, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:c.color, borderRadius:99, transition:"width 0.5s" }}/>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>startStudy(c.id,"flash")} style={{ flex:1, padding:"9px 0", background:c.color, color:"#000", border:"none", borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer" }}>🃏 Flashcard</button>
                  <button onClick={()=>startStudy(c.id,"write")} style={{ flex:1, padding:"9px 0", background:"#2a2a2a", color:c.color, border:`1px solid ${c.color}55`, borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer" }}>✍️ Escribir</button>
                  <button onClick={()=>startStudy(c.id,"fill")}  style={{ flex:1, padding:"9px 0", background:"#2a2a2a", color:c.color, border:`1px solid ${c.color}55`, borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer" }}>🧩 Completar</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sección Chilenismos */}
        <div style={{ background:"rgba(26,26,26,0.95)", backdropFilter:"blur(8px)", borderRadius:20, padding:18, border:"1px solid #e6394633", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <span style={{ fontSize:28 }}>🇨🇱</span>
            <div>
              <div style={{ fontWeight:800, fontSize:16, background:"linear-gradient(90deg,#e63946,#2563eb)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Chilenismos</div>
              <div style={{ fontSize:11, color:"#666" }}>Aprende a hablar como un chileno en inglés</div>
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {CHILENISMOS_SUBS.map(c => {
              const due     = getDue(c.id).length;
              const total   = (cards[c.id]||[]).length;
              const learned = (cards[c.id]||[]).filter(x=>x.reps>0).length;
              const pct     = total>0 ? Math.round((learned/total)*100) : 0;
              return (
                <div key={c.id} style={{ background:"#111", borderRadius:14, padding:14, border:`1px solid ${c.color}33` }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:20 }}>{c.emoji}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13, color:c.color }}>{c.label}</div>
                        <div style={{ fontSize:11, color:"#555" }}>{c.desc}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      {due>0 && <div style={{ background:c.color, color:"#fff", borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700, marginBottom:2 }}>{due} pendientes</div>}
                      <div style={{ fontSize:10, color:"#444" }}>{total} frases · {pct}% dominio</div>
                    </div>
                  </div>
                  <div style={{ background:"#2a2a2a", borderRadius:99, height:4, marginBottom:10, overflow:"hidden" }}>
                    <div style={{ width:`${pct}%`, height:"100%", background:c.grad, borderRadius:99, transition:"width 0.5s" }}/>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>startStudy(c.id,"flash")} style={{ flex:1, padding:"8px 0", background:c.grad, color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer" }}>🃏 Flashcard</button>
                    <button onClick={()=>startStudy(c.id,"write")} style={{ flex:1, padding:"8px 0", background:"#1a1a1a", color:c.color, border:`1px solid ${c.color}55`, borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer" }}>✍️ Escribir</button>
                    <button onClick={()=>startStudy(c.id,"fill")}  style={{ flex:1, padding:"8px 0", background:"#1a1a1a", color:c.color, border:`1px solid ${c.color}55`, borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer" }}>🧩 Completar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p style={{ textAlign:"center", color:"#333", fontSize:11, marginTop:8 }}>Sistema de repetición espaciada integrado 🧠</p>
      </div>
    </div>
  );

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (screen === "done") return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f", color:"#f1f1f1", fontFamily:"'Segoe UI',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14, padding:24, textAlign:"center" }}>
      <div style={{ fontSize:64 }}>🎉</div>
      <h2 style={{ margin:0 }}>¡Sesión completada!</h2>
      <p style={{ color:"#888" }}>Repasaste {queue.length} tarjetas de {cat?.label}.</p>
      <button onClick={()=>setScreen("home")} style={{ padding:"12px 32px", background:cat?.color||"#f97316", color: cat?.id?.includes("chilenismos") ? "#fff" : "#000", border:"none", borderRadius:12, fontWeight:700, fontSize:15, cursor:"pointer" }}>← Volver</button>
    </div>
  );

  // ── STUDY ─────────────────────────────────────────────────────────────────
  if (screen === "study" && currentCard) {
    const feedback  = writeResult === "wrong" ? getLetterFeedback(typed, currentCard.word) : null;
    const isCorrect = chosen === currentCard.word;
    const isChilenismo = activeCat?.includes("chilenismos");

    return (
      <div style={{ minHeight:"100vh", background:"#0f0f0f", color:"#f1f1f1", fontFamily:"'Segoe UI',sans-serif", padding:"20px 16px" }}>
        <div style={{ maxWidth:500, margin:"0 auto" }}>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
            <button onClick={()=>setScreen("home")} style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:22 }}>←</button>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:12, color:cat?.color }}>{cat?.emoji} {cat?.label} · {studyMode==="flash"?"🃏 Flashcard":studyMode==="write"?"✍️ Escritura":"🧩 Completar"}</div>
              <div style={{ fontSize:11, color:"#555" }}>{qIdx+1} / {queue.length}</div>
            </div>
            <div style={{ width:32 }}/>
          </div>

          <div style={{ background:"#1a1a1a", borderRadius:99, height:5, marginBottom:24, overflow:"hidden" }}>
            <div style={{ width:`${(qIdx/queue.length)*100}%`, height:"100%", background:cat?.color, borderRadius:99, transition:"width 0.4s" }}/>
          </div>

          <div style={{ textAlign:"center", marginBottom:10 }}>
            <span style={{ background:LEVELS[currentCard.level]+"22", color:LEVELS[currentCard.level], border:`1px solid ${LEVELS[currentCard.level]}44`, borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:600 }}>{currentCard.level}</span>
            {isChilenismo && <span style={{ marginLeft:8, background:"#e6394622", color:"#e63946", border:"1px solid #e6394644", borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:600 }}>🇨🇱 Chilenismo</span>}
          </div>

          {/* ── FLASHCARD ── */}
          {studyMode === "flash" && (
            <>
              <div
                onClick={() => setFlipped(f => !f)}
                style={{ cursor:"pointer", borderRadius:20, minHeight:280, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:"28px 24px", textAlign:"center", background: flipped ? cat?.grad : "#111", border:`2px solid ${flipped ? "transparent" : cat?.color}`, transition:"background 0.2s" }}
              >
                {!flipped ? (
                  <>
                    {isChilenismo && <div style={{ fontSize:12, color:"#666", marginBottom:4 }}>¿Cómo se dice en inglés? 🇺🇸</div>}
                    <div style={{ fontSize: isChilenismo ? 32 : 40, fontWeight:800, color:"#fff", letterSpacing: isChilenismo ? 0 : -1 }}>{currentCard.word}</div>
                    <div style={{ fontSize:13, color:"#777", fontStyle:"italic" }}>{currentCard.phonetic}</div>
                    <button onClick={e=>{e.stopPropagation();speak(currentCard.translation,setVoiceInfo);}} style={{ marginTop:6, background:"#1a1a1a", border:`1px solid ${cat?.color}55`, color:cat?.color, borderRadius:99, padding:"6px 18px", fontSize:13, cursor:"pointer", fontWeight:600 }}>🔊 Escuchar en inglés</button>
                    {voiceInfo && <div style={{ fontSize:10, color:"#555" }}>{voiceInfo}</div>}
                    <div style={{ fontSize:12, color:"#444", marginTop:4 }}>Toca para revelar</div>
                  </>
                ) : (
                  <>
                    {isChilenismo && <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginBottom:4 }}>En inglés se dice:</div>}
                    <div style={{ fontSize:24, fontWeight:800, color:"#fff" }}>{currentCard.translation}</div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.85)", fontStyle:"italic", lineHeight:1.6, maxWidth:300 }}>🇺🇸 "{currentCard.example}"</div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)", fontStyle:"italic", lineHeight:1.6, maxWidth:300 }}>🇨🇱 "{currentCard.exampleEs}"</div>
                    <button onClick={e=>{e.stopPropagation();speak(currentCard.translation,setVoiceInfo);}} style={{ background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.35)", color:"#fff", borderRadius:99, padding:"6px 18px", fontSize:13, cursor:"pointer", fontWeight:600 }}>🔊 {currentCard.translation}</button>
                  </>
                )}
              </div>

              <div style={{ marginTop:16 }}>
                {flipped ? (
                  <div style={{ display:"flex", gap:8 }}>
                    {[
                      {l:"😅 No lo sé", q:1, bg:"linear-gradient(135deg,#7f1d1d,#991b1b)", c:"#fca5a5"},
                      {l:"🤔 Difícil",  q:2, bg:"linear-gradient(135deg,#78350f,#92400e)", c:"#fcd34d"},
                      {l:"😎 Fácil",   q:3, bg:"linear-gradient(135deg,#064e3b,#065f46)", c:"#6ee7b7"},
                    ].map(b => (
                      <button key={b.q} onClick={()=>advanceCard(b.q)} style={{ flex:1, padding:"13px 0", background:b.bg, color:b.c, border:"none", borderRadius:12, fontWeight:700, fontSize:13, cursor:"pointer" }}>{b.l}</button>
                    ))}
                  </div>
                ) : <div style={{ textAlign:"center", color:"#444", fontSize:12 }}>Intenta recordar la traducción antes de voltear</div>}
              </div>
            </>
          )}

          {/* ── ESCRIBIR ── */}
          {studyMode === "write" && (
            <>
              <div style={{ background:"#1a1a1a", border:`2px solid ${writeResult==="correct"?"#10b981":writeResult==="wrong"?"#ef4444":cat?.color+"44"}`, borderRadius:20, padding:"32px 24px", textAlign:"center", marginBottom:20, transition:"border 0.3s" }}>
                {isChilenismo
                  ? <div style={{ fontSize:13, color:"#888", marginBottom:6 }}>¿Cómo se dice en inglés? 🇺🇸</div>
                  : <div style={{ fontSize:13, color:"#888", marginBottom:6 }}>Escribe en inglés:</div>
                }
                <div style={{ fontSize: isChilenismo ? 24 : 26, fontWeight:700, color:cat?.color, marginBottom:4 }}>{isChilenismo ? currentCard.word : currentCard.translation}</div>
                <div style={{ fontSize:13, color:"#666", fontStyle:"italic", marginBottom:20 }}>
                  "{isChilenismo
                    ? currentCard.exampleEs?.replace(new RegExp(currentCard.word,"gi"), "___")
                    : currentCard.example?.replace(new RegExp(currentCard.word,"gi"), "___")}"
                </div>
                {writeResult === null && (
                  <>
                    <input ref={inputRef} value={typed} onChange={e=>setTyped(e.target.value)} onKeyDown={e=>e.key==="Enter"&&checkWrite()} placeholder={isChilenismo ? "Escribe en inglés..." : "Escribe la palabra..."} style={{ width:"100%", padding:"12px 16px", borderRadius:10, border:`1px solid ${cat?.color}55`, background:"#111", color:"#f1f1f1", fontSize:18, textAlign:"center", outline:"none", boxSizing:"border-box", letterSpacing:2 }}/>
                    <button onClick={checkWrite} disabled={!typed.trim()} style={{ marginTop:12, padding:"10px 32px", background:cat?.color, color: activeCat?.includes("chilenismos") ? "#fff" : "#000", border:"none", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer", opacity:typed.trim()?1:0.4 }}>Verificar ✓</button>
                  </>
                )}
                {writeResult === "correct" && (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                    <div style={{ fontSize:40 }}>🎯</div>
                    <div style={{ color:"#10b981", fontWeight:700, fontSize:18 }}>¡Correcto! ¡Bacán! 🇨🇱</div>
                    <div style={{ fontSize:13, color:"#aaa", fontStyle:"italic" }}>🇺🇸 "{currentCard.example}"</div>
                    <div style={{ fontSize:13, color:"#666" }}>🇨🇱 "{currentCard.exampleEs}"</div>
                    <button onClick={()=>speak(currentCard.translation,setVoiceInfo)} style={{ background:"#052e16", border:"1px solid #10b98155", color:"#10b981", borderRadius:99, padding:"6px 18px", fontSize:13, cursor:"pointer", fontWeight:600 }}>🔊 Escuchar</button>
                  </div>
                )}
                {writeResult === "wrong" && (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                    <div style={{ fontSize:36 }}>🤔</div>
                    <div style={{ color:"#ef4444", fontWeight:700, fontSize:15 }}>Casi... La respuesta es:</div>
                    <div style={{ fontSize:18, fontWeight:800, color:cat?.color }}>{currentCard.translation}</div>
                    <div style={{ fontSize:13, color:"#aaa", fontStyle:"italic" }}>🇺🇸 "{currentCard.example}"</div>
                    <div style={{ fontSize:13, color:"#666" }}>🇨🇱 "{currentCard.exampleEs}"</div>
                    <button onClick={()=>speak(currentCard.translation,setVoiceInfo)} style={{ background:"#2a2a2a", border:"1px solid #ef444455", color:"#fca5a5", borderRadius:99, padding:"6px 18px", fontSize:13, cursor:"pointer", fontWeight:600 }}>🔊 Pronunciación</button>
                  </div>
                )}
              </div>
              {writeResult !== null && (
                <div style={{ display:"flex", gap:8 }}>
                  {writeResult==="correct"
                    ? <button onClick={()=>advanceCard(3)} style={{ flex:1, padding:"13px 0", background:"linear-gradient(135deg,#064e3b,#065f46)", color:"#6ee7b7", border:"none", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer" }}>Siguiente →</button>
                    : <>
                        <button onClick={()=>advanceCard(1)} style={{ flex:1, padding:"13px 0", background:"linear-gradient(135deg,#7f1d1d,#991b1b)", color:"#fca5a5", border:"none", borderRadius:12, fontWeight:700, fontSize:13, cursor:"pointer" }}>Repasar pronto</button>
                        <button onClick={()=>advanceCard(2)} style={{ flex:1, padding:"13px 0", background:"linear-gradient(135deg,#78350f,#92400e)", color:"#fcd34d", border:"none", borderRadius:12, fontWeight:700, fontSize:13, cursor:"pointer" }}>Entendido →</button>
                      </>
                  }
                </div>
              )}
            </>
          )}

          {/* ── COMPLETAR ── */}
          {studyMode === "fill" && (
            <>
              <div style={{ background:"#1a1a1a", border:`2px solid ${!chosen?cat?.color+"44":isCorrect?"#10b981":"#ef4444"}`, borderRadius:20, padding:"28px 20px", textAlign:"center", marginBottom:20, transition:"border 0.3s" }}>
                <div style={{ fontSize:13, color:"#888", marginBottom:14 }}>{isChilenismo ? "¿Cómo se dice en inglés? 🇺🇸" : "Completa la oración:"}</div>
                {isChilenismo
                  ? <div style={{ fontSize:22, fontWeight:800, color:cat?.color, marginBottom:20 }}>{currentCard.word}</div>
                  : <div style={{ fontSize:17, color:"#ddd", lineHeight:1.8, marginBottom:20, fontStyle:"italic" }}>"{blankExample}"</div>
                }
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {options.map(opt => {
                    const isRight  = opt === currentCard.word;
                    const isPicked = opt === chosen;
                    let bg="#1e1e1e", border="#333", color="#f1f1f1";
                    if (chosen) {
                      if (isRight)       { bg="linear-gradient(135deg,#064e3b,#065f46)"; border="#10b981"; color="#6ee7b7"; }
                      else if (isPicked) { bg="linear-gradient(135deg,#7f1d1d,#991b1b)"; border="#ef4444"; color="#fca5a5"; }
                    }
                    return (
                      <div key={opt} style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <button onClick={()=>handleFillChoice(opt)} disabled={!!chosen} style={{ flex:1, padding:"12px 16px", background:bg, color, border:`1.5px solid ${border}`, borderRadius:12, fontWeight:700, fontSize:14, cursor:chosen?"default":"pointer", transition:"all 0.2s", textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <span>{opt}</span>
                          {chosen && isRight  && <span>✅</span>}
                          {chosen && isPicked && !isRight && <span>❌</span>}
                        </button>
                        <button onClick={()=>speak(opt,setVoiceInfo)} style={{ background:"#1a1a1a", border:`1px solid ${cat?.color}44`, color:cat?.color, borderRadius:10, padding:"10px 12px", cursor:"pointer", fontSize:16, flexShrink:0 }}>🔊</button>
                      </div>
                    );
                  })}
                </div>
                {chosen && (
                  <div style={{ marginTop:16, padding:"16px", background:"#111", borderRadius:14, textAlign:"left" }}>
                    <div style={{ fontWeight:800, fontSize:16, color:isCorrect?"#10b981":"#ef4444", marginBottom:10 }}>
                      {isCorrect ? "🎯 ¡Correcto! ¡Cachaste!" : `❌ Era: ${currentCard.word}`}
                    </div>
                    <div style={{ fontSize:13, color:"#aaa", marginBottom:8 }}>
                      <span style={{ color:cat?.color, fontWeight:700 }}>{currentCard.word}</span> → <span style={{ color:"#fff" }}>{currentCard.translation}</span>
                    </div>
                    <div style={{ fontSize:13, color:"#777", fontStyle:"italic", lineHeight:1.6, marginBottom:4 }}>🇺🇸 "{currentCard.example}"</div>
                    <div style={{ fontSize:13, color:"#555", fontStyle:"italic", lineHeight:1.6 }}>🇨🇱 "{currentCard.exampleEs}"</div>
                  </div>
                )}
              </div>
              {chosen && (
                <div style={{ display:"flex", gap:8 }}>
                  {isCorrect
                    ? <button onClick={()=>advanceCard(3)} style={{ flex:1, padding:"13px 0", background:"linear-gradient(135deg,#064e3b,#065f46)", color:"#6ee7b7", border:"none", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer" }}>Siguiente →</button>
                    : <>
                        <button onClick={()=>advanceCard(1)} style={{ flex:1, padding:"13px 0", background:"linear-gradient(135deg,#7f1d1d,#991b1b)", color:"#fca5a5", border:"none", borderRadius:12, fontWeight:700, fontSize:13, cursor:"pointer" }}>Repasar pronto</button>
                        <button onClick={()=>advanceCard(2)} style={{ flex:1, padding:"13px 0", background:"linear-gradient(135deg,#78350f,#92400e)", color:"#fcd34d", border:"none", borderRadius:12, fontWeight:700, fontSize:13, cursor:"pointer" }}>Entendido →</button>
                      </>
                  }
                </div>
              )}
            </>
          )}

        </div>
      </div>
    );
  }

  return null;
}
