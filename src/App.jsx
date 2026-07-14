import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, getDocs, deleteDoc,
  doc, orderBy, query, serverTimestamp
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// 🎵  Drop your audio file in /public/ and update this path:
const MUSIC_SRC = "/music.mp3";
// ─────────────────────────────────────────────────────────────────────────────



// ── MEMBERS ───────────────────────────────────────────────────────────────────
// This is empty — the site starts with no profiles.
// Real members submit via "+ Submit Your Profile" and you approve them
// in the Admin Panel. Approved profiles are saved permanently in localStorage
// so they persist across page refreshes and for every visitor on that device.
//
// Want to manually add a member without the submission flow? Add an object here:
// { id:1, name:"Name", role:"Role", department:"Dept", bio:"...",
//   hobbies:["Hobby1","Hobby2"], scripture:"John 3:16",
//   scriptureText:"For God so loved...", spiritualGift:"Teaching",
//   testimony:"...", since:"2023", funFact:"...", photo:"", approved:true }
const SEED_MEMBERS = [];

const GALLERY = [
  { id:1, caption:"Annual Retreat 2024",      tag:"Retreat",    src:"/gallery/photo1.jpg"},
  { id:2, caption:"Prayer Night — June 2024", tag:"Worship",    src:"/gallery/photo2.jpg"},
  { id:3, caption:"Campus Outreach 2023",      tag:"Outreach",  src:"/gallery/photo3.jpg"},
  { id:4, caption:"Cell Group Bonding Day",    tag:"Fellowship", src:"/gallery/photo4.jpg"},
  { id:5, caption:"New Year's Eve Vigil 2024", tag:"Worship",   src:"/gallery/photo5.jpg" },
  { id:6, caption:"Evangelism Drive 2023",     tag:"Outreach",  src:"/gallery/photo6.jpg" },
];

const TIMELINE = [
  { year:"2019", title:"Acts 29 Founded",        desc:"A small gathering of believers in GLT with one conviction: the story of the early church did not end at Acts 28. Ours was just beginning." },
  { year:"2026", title:"School Outreach",  desc:"We took the gospel outside our walls and watched God move in ways we didn't plan." },
  { year:"2026", title:"Campus Prayerthon", desc:"Our annual formal evangelism drive on campus — over 200 students joined us." },
  { year:"2026", title:"Anniversary Celebration",     desc:"We come together annually to celebrate the work of God in our lives and to celebrate how far we've come." },
  { year:"2026", title:"Cell Meetings",        desc:"Regular meetings held by members to check in on others and to grow together in Spirit" },
  { year:"2026", title:"A Living Memory",        desc:"This site is born — a testament to all God has done through us, and a promise of what's still to come." },
];

// Stable particle positions for landing page
const PARTICLES = Array.from({ length:32 }, (_, i) => ({
  id:i,
  size: +(Math.random()*2+0.8).toFixed(1),
  x:   +(Math.random()*100).toFixed(1),
  y:   +(Math.random()*100).toFixed(1),
  dur: +(Math.random()*5+4).toFixed(1),
  del: +(Math.random()*8).toFixed(1),
  op:  +(Math.random()*0.45+0.25).toFixed(2),
}));

const AC = ["#7B5E2A","#5E2A7B","#2A5E7B","#7B2A5E","#2A7B5E"];
const initials = n => n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);



// ── INJECT GLOBAL STYLES INTO <head> ─────────────────────────────────────────
// Fonts use a <link> element (more reliable than @import inside textContent).
// All @keyframes live here so they're guaranteed available before first paint.
const useGlobalStyles = () => {
  useEffect(() => {
    // Google Fonts — inject as a proper <link> so the browser fetches them correctly
    if (!document.getElementById("acts29-fonts")) {
      const link = document.createElement("link");
      link.id   = "acts29-fonts";
      link.rel  = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap";
      document.head.appendChild(link);
    }
    // Global CSS + keyframes
    if (!document.getElementById("acts29-styles")) {
      const el = document.createElement("style");
      el.id = "acts29-styles";
      el.textContent = `
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:#0C0B0F;color:#FAF5E9;font-family:'Inter',sans-serif}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#0C0B0F}
        ::-webkit-scrollbar-thumb{background:#C9A450;border-radius:2px}
        input,textarea,button{font-family:inherit}
        input::placeholder,textarea::placeholder{color:rgba(250,245,233,0.3)}
        a{text-decoration:none;color:inherit}

        /* Landing page animations */
        @keyframes pfloat{
          0%,100%{transform:translateY(0) scale(1);opacity:.3}
          50%{transform:translateY(-20px) scale(1.25);opacity:.85}
        }
        @keyframes raypulse{
          0%,100%{opacity:.3}
          50%{opacity:.85}
        }

        /* Background orb drift animations */
        @keyframes orb1{
          0%,100%{transform:translate(0px,0px)}
          25%{transform:translate(40px,-30px)}
          50%{transform:translate(-25px,50px)}
          75%{transform:translate(55px,25px)}
        }
        @keyframes orb2{
          0%,100%{transformtranslate(0px,0px)}
          33%{transform:translate(-50px,35px)}
          66%{transform:translate(35px,-45px)}
        }
        @keyframes orb3{
          0%,100%{transform:translate(0px,0px)}
          50%{transform:translate(-35px,-35px)}
        }
        @keyframes orb4{
          0%,100%{transform:translate(0px,0px)}
          25%{transform:translate(-20px,45px)}
          75%{transform:translate(30px,-20px)}
        }

        @media(max-width:768px){.dsk-nav{display:none!important}}
        @media(min-width:769px){.mob-btn{display:none!important}}
      `;
      document.head.appendChild(el);
    }
  }, []);
};

// ── AUDIO HOOK ────────────────────────────────────────────────────────────────
const useAudio = () => {
  const [playing, setPlaying] = useState(false);
  const htmlAudio = useRef(null);
  const waCtx     = useRef(null);
  const waGain    = useRef(null);
  const mode      = useRef("none");

  const startWebAudio = () => {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      waCtx.current = ac;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, ac.currentTime);
      g.gain.linearRampToValueAtTime(0.12, ac.currentTime + 2);
      g.connect(ac.destination);
      waGain.current = g;
      [220, 277.18, 329.63, 440].forEach(f => {
        const o = ac.createOscillator(), og = ac.createGain();
        o.type = "sine"; o.frequency.value = f; og.gain.value = 0.25;
        o.connect(og); og.connect(g); o.start();
      });
      mode.current = "webaudio";
      setPlaying(true);
    } catch { setPlaying(false); }
  };

  const stopWebAudio = () => {
    if (waGain.current && waCtx.current) {
      waGain.current.gain.linearRampToValueAtTime(0, waCtx.current.currentTime + 0.8);
      setTimeout(() => { waCtx.current?.close(); waCtx.current = null; }, 900);
    }
  };

  const toggle = () => {
    if (playing) {
      if (mode.current === "html5" && htmlAudio.current) htmlAudio.current.pause();
      else if (mode.current === "webaudio") stopWebAudio();
      setPlaying(false);
      mode.current = "none";
    } else {
      const audio = new Audio(MUSIC_SRC);
      audio.loop = true;
      audio.volume = 0.45;
      htmlAudio.current = audio;
      audio.play()
        .then(() => { mode.current = "html5"; setPlaying(true); })
        .catch(() => { htmlAudio.current = null; startWebAudio(); });
    }
  };

  useEffect(() => () => { htmlAudio.current?.pause(); waCtx.current?.close(); }, []);
  return { playing, toggle };
};

// ── BACKGROUND FX (main site only) ───────────────────────────────────────────
// Four large blurred orbs drift slowly — like divine light moving through the space.
// A subtle dot grid and edge vignette complete the depth effect.


const BackgroundFX = () => (
  <>
    <style>{`
      @keyframes orb1{0%,100%{transform:translate(0px,0px)}25%{transform:translate(40px,-30px)}50%{transform:translate(-25px,50px)}75%{transform:translate(55px,25px)}}
      @keyframes orb2{0%,100%{transform:translate(0px,0px)}33%{transform:translate(-50px,35px)}66%{transform:translate(35px,-45px)}}
      @keyframes orb3{0%,100%{transform:translate(0px,0px)}50%{transform:translate(-35px,-35px)}}
      @keyframes orb4{0%,100%{transform:translate(0px,0px)}25%{transform:translate(-20px,45px)}75%{transform:translate(30px,-20px)}}
    `}</style>
    <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
      {[
        { size:700, left:"12%", top:"18%", op:0.18, anim:"orb1 22s 0s ease-in-out infinite" },
        { size:550, left:"78%", top:"65%", op:0.15, anim:"orb2 28s 5s ease-in-out infinite" },
        { size:420, left:"55%", top:"35%", op:0.12, anim:"orb3 19s 10s ease-in-out infinite" },
        { size:480, left:"88%", top:"12%", op:0.13, anim:"orb4 32s 3s ease-in-out infinite" },
        { size:380, left:"25%", top:"80%", op:0.12, anim:"orb1 24s 14s ease-in-out infinite" },
      ].map((orb, i) => (
        <div key={i} style={{
          position:"absolute",
          width:orb.size, height:orb.size,
          left:`calc(${orb.left} - ${orb.size/2}px)`,
          top:`calc(${orb.top} - ${orb.size/2}px)`,
          background:`radial-gradient(circle, rgba(201,164,80,${orb.op}) 0%, rgba(201,164,80,${orb.op*0.3}) 40%, transparent 50%)`,
          borderRadius:"50%",
          filter:"blur(60px)",
          animation:orb.anim,
          willChange:"transform",
        }} />
      ))}
      <div style={{
        position:"absolute", inset:0,
        backgroundImage:"radial-gradient(rgba(201,164,80,0.12) 1px, transparent 1px)",
        backgroundSize:"38px 38px",
        opacity:0.35,
      }} />
      <div style={{
        position:"absolute", inset:0,
        background:"radial-gradient(ellipse 85% 80% at 50% 40%, transparent 50%, rgba(12,11,15,0.65) 100%)",
      }} />
    </div>
  </>
);

// ── ATOMS ─────────────────────────────────────────────────────────────────────
const Avatar = ({ name, size=64, idx=0, photo }) => {
  if (photo) return (
    <img src={photo} alt={name} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", border:"2px solid rgba(201,164,80,0.4)", flexShrink:0 }} />
  );
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`linear-gradient(135deg,${AC[idx % AC.length]},#0C0B0F)`,
      border:"2px solid rgba(201,164,80,0.4)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"Cinzel,serif", fontWeight:600, fontSize:size*.28, color:"#E8C97A" }}>
      {initials(name)}
    </div>
  );
};

const SH = ({ eye, title, sub }) => (
  <div style={{ textAlign:"center", marginBottom:"3rem" }}>
    <div style={{ fontFamily:"Cinzel,serif", fontSize:".62rem", letterSpacing:".4em", color:"#C9A450", marginBottom:".75rem", textTransform:"uppercase" }}>{eye}</div>
    <h2 style={{ fontFamily:"Cinzel,serif", fontSize:"clamp(1.8rem,4vw,2.8rem)", fontWeight:700, color:"#FAF5E9", marginBottom:sub?".75rem":0 }}>{title}</h2>
    {sub && <p style={{ fontFamily:"Cormorant Garamond,serif", fontStyle:"italic", color:"rgba(250,245,233,0.45)", fontSize:"1.05rem" }}>{sub}</p>}
  </div>
);

const Inp = ({ style:s={}, ...p }) => (
  <input {...p} style={{ width:"100%", background:"rgba(255,248,230,0.04)", border:"1px solid rgba(201,164,80,0.2)", color:"#FAF5E9", padding:".75rem 1rem", outline:"none", boxSizing:"border-box", fontSize:".87rem", ...s }}
    onFocus={e=>e.target.style.borderColor="#C9A450"} onBlur={e=>e.target.style.borderColor="rgba(201,164,80,0.2)"} />
);
const TA = ({ style:s={}, ...p }) => (
  <textarea {...p} style={{ width:"100%", background:"rgba(255,248,230,0.04)", border:"1px solid rgba(201,164,80,0.2)", color:"#FAF5E9", padding:".75rem 1rem", outline:"none", boxSizing:"border-box", fontSize:".87rem", resize:"vertical", ...s }}
    onFocus={e=>e.target.style.borderColor="#C9A450"} onBlur={e=>e.target.style.borderColor="rgba(201,164,80,0.2)"} />
);
const Lbl = ({ t }) => (
  <div style={{ fontFamily:"Inter,sans-serif", fontSize:".62rem", letterSpacing:".15em", textTransform:"uppercase", color:"#C9A450", marginBottom:".3rem" }}>{t}</div>
);
const GBtn = ({ children, gold, style:s={}, ...p }) => (
  <button {...p}
    style={{ padding:".5rem 1.25rem", border:`1px solid ${gold?"#C9A450":"rgba(201,164,80,0.2)"}`, background:gold?"rgba(201,164,80,0.08)":"transparent", color:gold?"#C9A450":"rgba(250,245,233,0.45)", fontFamily:"Cinzel,serif", fontSize:".7rem", letterSpacing:".18em", textTransform:"uppercase", cursor:"pointer", transition:"all .25s ease", ...s }}
    onMouseEnter={e=>{ e.currentTarget.style.background="rgba(201,164,80,0.14)"; e.currentTarget.style.borderColor="#C9A450"; e.currentTarget.style.color="#C9A450"; }}
    onMouseLeave={e=>{ e.currentTarget.style.background=gold?"rgba(201,164,80,0.08)":"transparent"; e.currentTarget.style.borderColor=gold?"#C9A450":"rgba(201,164,80,0.2)"; e.currentTarget.style.color=gold?"#C9A450":"rgba(250,245,233,0.45)"; }}>
    {children}
  </button>
);
const ModalWrap = ({ onClose, children }) => (
  <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(12,11,15,0.92)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }} onClick={onClose}>
    {children}
  </div>
);

// ── PARTICLES (landing only) ──────────────────────────────────────────────────
const Pts = () => (
  <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
    {PARTICLES.map(p => (
      <div key={p.id} style={{ position:"absolute", width:p.size, height:p.size,
        left:`${p.x}%`, top:`${p.y}%`,
        background:`rgba(201,164,80,${p.op})`, borderRadius:"50%",
        animation:`pfloat ${p.dur}s ${p.del}s ease-in-out infinite` }} />
    ))}
  </div>
);

// ── LANDING ───────────────────────────────────────────────────────────────────
const Landing = ({ onEnter }) => {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position:"fixed", inset:0, background:"#0C0B0F",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      zIndex:999, overflow:"hidden" }}>
      {Array.from({ length:16 }, (_, i) => (
        <div key={i} style={{
          position:"absolute", top:"50%", left:"50%",
          width:"160vmax", height:"2px",
          background:"linear-gradient(to right,transparent 0%,rgba(201,164,80,0.22) 50%,transparent 100%)",
          transformOrigin:"left center",
          transform:`translateY(-50%) rotate(${i*22.5}deg)`,
          animation:`raypulse ${2.8+(i%4)*.5}s ${i*.13}s ease-in-out infinite`,
        }} />
      ))}
      <div style={{ position:"absolute", inset:0,
        background:"radial-gradient(ellipse 70% 60% at 50% 50%, rgba(201,164,80,0.18) 0%, rgba(201,164,80,0.04) 40%, transparent 65%)" }} />
      <div style={{ position:"absolute", inset:0,
        background:"radial-gradient(ellipse 30% 25% at 50% 50%, rgba(232,201,122,0.15) 0%, transparent 70%)" }} />
      <Pts />
      <div style={{ position:"relative", zIndex:1, textAlign:"center",
        opacity:show?1:0, transform:show?'translateY(0)':'translateY(24px)',
        transition:"opacity 1.2s ease, transform 1.2s ease" }}>
        <p style={{ fontFamily:"Cinzel,serif", fontSize:"clamp(.5rem,1.8vw,.72rem)",
          letterSpacing:".45em", color:"#C9A450", marginBottom:"1.5rem", textTransform:"uppercase" }}>
          God's Love Tabernacle · Cell Group
        </p>
        <div style={{ fontFamily:"Cinzel,serif", fontSize:"clamp(5rem,20vw,13rem)", fontWeight:700, lineHeight:1 }}>
          <div style={{ color:"#FAF5E9" }}>ACTS</div>
          <div style={{ background:"linear-gradient(135deg,#C9A450,#E8C97A,#C9A450)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>29</div>
        </div>
        <p style={{ fontFamily:"Cormorant Garamond,serif", fontStyle:"italic",
          color:"rgba(250,245,233,0.5)", fontSize:"clamp(.9rem,2.5vw,1.15rem)",
          marginTop:"1.5rem", letterSpacing:".05em" }}>
          "The story continues in our generation."
        </p>
        <button onClick={onEnter}
          style={{ marginTop:"2.5rem", padding:".9rem 2.8rem",
            border:"1px solid rgba(201,164,80,0.55)", background:"transparent", color:"#C9A450",
            fontFamily:"Cinzel,serif", fontSize:".72rem", letterSpacing:".28em", textTransform:"uppercase",
            cursor:"pointer", transition:"all .3s ease", outline:"none" }}
          onMouseEnter={e=>{ e.target.style.background="rgba(201,164,80,0.1)"; e.target.style.boxShadow="0 0 30px rgba(201,164,80,0.25)"; }}
          onMouseLeave={e=>{ e.target.style.background="transparent"; e.target.style.boxShadow="none"; }}>
          Enter
        </button>
      </div>
    </div>
  );
};

// ── AUDIO TOGGLE BUTTON ───────────────────────────────────────────────────────
const AudioBtn = ({ playing, toggle, mobile=false }) => (
  <button onClick={toggle}
    style={{ display:"flex", alignItems:"center", gap:".45rem",
      padding: mobile ? ".75rem 0" : ".38rem .9rem",
      border: mobile ? "none" : `1px solid ${playing?"#C9A450":"rgba(201,164,80,0.25)"}`,
      borderBottom: mobile ? "1px solid rgba(201,164,80,0.15)" : undefined,
      background: playing && !mobile ? "rgba(201,164,80,0.1)" : "transparent",
      color: playing ? "#C9A450" : "rgba(250,245,233,0.5)",
      fontFamily:"Inter,sans-serif", fontSize: mobile?".85rem":".72rem",
      letterSpacing:".08em", cursor:"pointer", transition:"all .25s ease",
      width: mobile?"100%":"auto" }}>
    <span style={{ fontSize: mobile?"1rem":".85rem" }}>{playing ? "⏸" : "▶"}</span>
    <span>{playing ? "Pause Music" : "Play Music"}</span>
  </button>
);

// ── NAVIGATION ────────────────────────────────────────────────────────────────
const NAVS = ["About","Members","Gallery","Timeline","Guestbook"];

const Nav = ({ active, onNav, onAdmin, audio }) => {
  const [sc, setSc] = useState(false);
  const [mob, setMob] = useState(false);
  useEffect(() => {
    const fn = () => setSc(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  const lk = sec => ({
    fontFamily:"Inter,sans-serif", fontSize:".75rem", letterSpacing:".12em", textTransform:"uppercase",
    color:active===sec.toLowerCase()?"#C9A450":"rgba(250,245,233,0.45)", cursor:"pointer",
    transition:"color .2s ease",
    borderBottom:active===sec.toLowerCase()?"1px solid #C9A450":"1px solid transparent",
    paddingBottom:"2px",
  });
  return (
    <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100,
      background:sc?"rgba(12,11,15,0.95)":"transparent",
      backdropFilter:sc?"blur(12px)":"none",
      borderBottom:sc?"1px solid rgba(201,164,80,0.2)":"1px solid transparent",
      transition:"all .35s ease" }}>
      <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:65, padding:"0 2rem" }}>
        <div style={{ fontFamily:"Cinzel,serif", fontSize:"1.1rem", fontWeight:700,
          background:"linear-gradient(135deg,#C9A450,#E8C97A)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", cursor:"pointer" }}
          onClick={() => window.scrollTo({ top:0, behavior:"smooth" })}>ACTS 29</div>
        <div className="dsk-nav" style={{ display:"flex", gap:"1.75rem", alignItems:"center" }}>
          {NAVS.map(n => (<a key={n} href={`#${n.toLowerCase()}`} style={lk(n)} onClick={() => onNav(n.toLowerCase())}>{n}</a>))}
          <AudioBtn playing={audio.playing} toggle={audio.toggle} />
          <GBtn onClick={onAdmin} style={{ padding:".38rem .9rem", fontSize:".68rem" }}>Admin</GBtn>
        </div>
        <button className="mob-btn" onClick={() => setMob(o => !o)}
          style={{ background:"none", border:"1px solid rgba(201,164,80,0.25)", color:"#C9A450", padding:".4rem .75rem", cursor:"pointer", fontSize:"1rem" }}>
          {mob?"✕":"☰"}
        </button>
      </div>
      {mob && (
        <div style={{ background:"rgba(12,11,15,0.97)", borderTop:"1px solid rgba(201,164,80,0.2)", padding:"0 2rem 1rem" }}>
          {NAVS.map(n => (
            <a key={n} href={`#${n.toLowerCase()}`}
              onClick={() => { onNav(n.toLowerCase()); setMob(false); }}
              style={{ display:"block", padding:".75rem 0", borderBottom:"1px solid rgba(201,164,80,0.12)", color:"rgba(250,245,233,0.5)", fontSize:".85rem", letterSpacing:".1em" }}>{n}</a>
          ))}
          <AudioBtn playing={audio.playing} toggle={audio.toggle} mobile />
          <button onClick={() => { onAdmin(); setMob(false); }}
            style={{ display:"block", paddingTop:".75rem", background:"none", border:"none", color:"rgba(250,245,233,0.4)", fontSize:".85rem", cursor:"pointer", letterSpacing:".05em" }}>
            Admin Panel
          </button>
        </div>
      )}
    </nav>
  );
};

// ── ABOUT ─────────────────────────────────────────────────────────────────────
const About = () => (
  <section id="about" style={{ padding:"7rem 2rem 5rem", maxWidth:1200, margin:"0 auto", position:"relative", zIndex:1 }}>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"4rem", alignItems:"center" }}>
      <div>
        <div style={{ fontFamily:"Cinzel,serif", fontSize:".62rem", letterSpacing:".4em", color:"#C9A450", marginBottom:"1rem", textTransform:"uppercase" }}>Our Story</div>
        <h2 style={{ fontFamily:"Cinzel,serif", fontSize:"clamp(2rem,5vw,3.2rem)", fontWeight:700, color:"#FAF5E9", lineHeight:1.15, marginBottom:"1.5rem" }}>
          Writing the<br/>
          <span style={{ background:"linear-gradient(135deg,#C9A450,#E8C97A)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Next Chapter.</span>
        </h2>
        <p style={{ fontFamily:"Inter,sans-serif", color:"rgba(250,245,233,0.45)", lineHeight:1.85, fontSize:".93rem", marginBottom:"1.2rem" }}>
          Acts 29 takes its name from the conviction that God's story didn't end with Acts 28. We are students and young adults in God's Love Tabernacle, called to continue what the early church began — in our campus, our city, our generation.
        </p>
        <p style={{ fontFamily:"Inter,sans-serif", color:"rgba(250,245,233,0.45)", lineHeight:1.85, fontSize:".93rem" }}>
          We have prayed together, worshipped together, wept together, and celebrated together. This site is our living memory — a record of who we are and what God continues to do through us.
        </p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
        {[{n:"19+",l:"Years Together"},{n:"1700+",l:"Members"},{n:"12+",l:"Ministry Depts"},{n:"∞",l:"God's Faithfulness"}].map((s,i) => (
          <div key={i} style={{ background:"rgba(255,248,230,0.04)", border:"1px solid rgba(201,164,80,0.2)", padding:"1.75rem 1.25rem", textAlign:"center", backdropFilter:"blur(4px)" }}>
            <div style={{ fontFamily:"Cinzel,serif", fontSize:"2.2rem", fontWeight:700, background:"linear-gradient(135deg,#C9A450,#E8C97A)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", marginBottom:".4rem" }}>{s.n}</div>
            <div style={{ fontFamily:"Inter,sans-serif", fontSize:".68rem", letterSpacing:".14em", color:"rgba(250,245,233,0.45)", textTransform:"uppercase" }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── MEMBER CARD ───────────────────────────────────────────────────────────────
const MemberCard = ({ m, idx, onClick }) => {
  const [hv, setHv] = useState(false);
  return (
    <div onClick={() => onClick(m, idx)} onMouseEnter={() => setHv(true)} onMouseLeave={() => setHv(false)}
      style={{ background:hv?"rgba(255,248,230,0.07)":"rgba(255,248,230,0.04)",
        border:`1px solid ${hv?"rgba(201,164,80,0.5)":"rgba(201,164,80,0.2)"}`,
        padding:"1.75rem", cursor:"pointer", transition:"all .3s ease",
        transform:hv?"translateY(-4px)":"translateY(0)",
        boxShadow:hv?"0 12px 35px rgba(201,164,80,0.1)":"none",
        backdropFilter:"blur(4px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1rem" }}>
        <Avatar name={m.name} size={56} idx={idx} photo={m.photo} />
        <div>
          <div style={{ fontFamily:"Cinzel,serif", fontSize:".98rem", fontWeight:600, color:"#FAF5E9", marginBottom:".2rem" }}>{m.name}</div>
          <div style={{ fontFamily:"Inter,sans-serif", fontSize:".68rem", letterSpacing:".1em", color:"#C9A450", textTransform:"uppercase" }}>{m.role}</div>
          {m.department && <div style={{ fontFamily:"Inter,sans-serif", fontSize:".64rem", color:"rgba(250,245,233,0.45)", marginTop:".15rem" }}>{m.department}</div>}
        </div>
      </div>
      <p style={{ fontFamily:"Inter,sans-serif", fontSize:".83rem", color:"rgba(250,245,233,0.45)", lineHeight:1.7, marginBottom:"1rem",
        overflow:"hidden", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical" }}>{m.bio}</p>
      <div style={{ fontFamily:"Cormorant Garamond,serif", fontStyle:"italic", fontSize:".82rem", color:"rgba(201,164,80,0.65)",
        borderTop:"1px solid rgba(201,164,80,0.2)", paddingTop:".75rem" }}>"{m.scripture}"</div>
    </div>
  );
};

// ── MEMBER MODAL ──────────────────────────────────────────────────────────────
const MemberModal = ({ m, idx, onClose }) => {
  if (!m) return null;
  const hobbies = Array.isArray(m.hobbies) ? m.hobbies.join(", ") : m.hobbies;
  return (
    <ModalWrap onClose={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"#13110D", border:"1px solid rgba(201,164,80,0.5)", maxWidth:560, width:"100%",
          maxHeight:"90vh", overflowY:"auto", padding:"2.5rem", position:"relative",
          boxShadow:"0 0 60px rgba(201,164,80,0.12)" }}>
        <button onClick={onClose} style={{ position:"absolute", top:"1.25rem", right:"1.25rem", background:"none", border:"none", color:"rgba(250,245,233,0.45)", fontSize:"1.3rem", cursor:"pointer" }}>✕</button>
        <div style={{ display:"flex", alignItems:"center", gap:"1.25rem", marginBottom:"1.5rem" }}>
          <Avatar name={m.name} size={76} idx={idx} photo={m.photo} />
          <div>
            <h3 style={{ fontFamily:"Cinzel,serif", fontSize:"1.35rem", fontWeight:700, color:"#FAF5E9", marginBottom:".25rem" }}>{m.name}</h3>
            <div style={{ fontFamily:"Inter,sans-serif", fontSize:".72rem", letterSpacing:".1em", color:"#C9A450", textTransform:"uppercase" }}>{m.role}{m.department?` · ${m.department}`:""}</div>
            {m.since && <div style={{ fontFamily:"Inter,sans-serif", fontSize:".7rem", color:"rgba(250,245,233,0.45)", marginTop:".2rem" }}>Member since {m.since}</div>}
          </div>
        </div>
        <p style={{ fontFamily:"Inter,sans-serif", fontSize:".9rem", color:"rgba(250,245,233,0.45)", lineHeight:1.8, marginBottom:"1.5rem" }}>{m.bio}</p>
        {m.scriptureText && (
          <div style={{ background:"rgba(201,164,80,0.06)", border:"1px solid rgba(201,164,80,0.2)", padding:"1.25rem", marginBottom:"1.5rem" }}>
            <p style={{ fontFamily:"Cormorant Garamond,serif", fontStyle:"italic", color:"#FAF5E9", fontSize:"1.02rem", lineHeight:1.75, marginBottom:".5rem" }}>"{m.scriptureText}"</p>
            <div style={{ fontFamily:"Cinzel,serif", fontSize:".7rem", color:"#C9A450", letterSpacing:".12em" }}>— {m.scripture}</div>
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginBottom:"1.5rem" }}>
          {[m.spiritualGift&&{l:"Spiritual Gift",v:m.spiritualGift}, hobbies&&{l:"Hobbies",v:hobbies}].filter(Boolean).map(({l,v},i) => (
            <div key={i}>
              <div style={{ fontFamily:"Inter,sans-serif", fontSize:".62rem", letterSpacing:".15em", textTransform:"uppercase", color:"#C9A450", marginBottom:".3rem" }}>{l}</div>
              <div style={{ fontFamily:"Inter,sans-serif", fontSize:".87rem", color:"#FAF5E9" }}>{v}</div>
            </div>
          ))}
        </div>
        {m.testimony && (
          <div style={{ borderTop:"1px solid rgba(201,164,80,0.2)", paddingTop:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Inter,sans-serif", fontSize:".62rem", letterSpacing:".15em", textTransform:"uppercase", color:"#C9A450", marginBottom:".5rem" }}>Testimony Highlight</div>
            <p style={{ fontFamily:"Cormorant Garamond,serif", fontStyle:"italic", color:"rgba(250,245,233,0.45)", fontSize:".97rem", lineHeight:1.75 }}>"{m.testimony}"</p>
          </div>
        )}
        {m.funFact && (
          <div style={{ background:"rgba(201,164,80,0.04)", border:"1px solid rgba(201,164,80,0.2)", padding:".9rem 1rem", marginTop:".75rem" }}>
            <span style={{ fontFamily:"Inter,sans-serif", fontSize:".68rem", color:"#C9A450", letterSpacing:".1em", textTransform:"uppercase" }}>Fun Fact · </span>
            <span style={{ fontFamily:"Inter,sans-serif", fontSize:".87rem", color:"rgba(250,245,233,0.45)" }}>{m.funFact}</span>
          </div>
        )}
      </div>
    </ModalWrap>
  );
};

// ── MEMBERS ───────────────────────────────────────────────────────────────────
const Members = ({ members, onAdd }) => {
  const [sel, setSel]   = useState(null);
  const [selIdx, setSelIdx] = useState(0);
  const [filt, setFilt] = useState("All");
  const depts = ["All", ...new Set(members.map(m => m.department).filter(Boolean))];
  const vis = filt === "All" ? members : members.filter(m => m.department === filt);
  return (
    <section id="members" style={{ padding:"5rem 2rem", maxWidth:1200, margin:"0 auto", borderTop:"1px solid rgba(201,164,80,0.2)", position:"relative", zIndex:1 }}>
      <SH eye="The Family" title="Our Members" sub="Every life a story God is still writing." />
      {/* Only show department filter when there are members to filter */}
      {members.length > 0 && (
        <div style={{ display:"flex", gap:".6rem", flexWrap:"wrap", justifyContent:"center", marginBottom:"2.5rem" }}>
          {depts.map(d => (
            <button key={d} onClick={() => setFilt(d)}
              style={{ padding:".4rem 1.1rem", border:`1px solid ${filt===d?"#C9A450":"rgba(201,164,80,0.2)"}`,
                background:filt===d?"rgba(201,164,80,0.1)":"transparent",
                color:filt===d?"#C9A450":"rgba(250,245,233,0.45)",
                fontFamily:"Inter,sans-serif", fontSize:".73rem", letterSpacing:".08em", cursor:"pointer", transition:"all .2s ease" }}>{d}</button>
          ))}
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"1.25rem", marginBottom:"2.5rem" }}>
        {vis.length > 0
          ? vis.map(m => (<MemberCard key={m.id} m={m} idx={members.indexOf(m)} onClick={(m,idx) => { setSel(m); setSelIdx(idx); }} />))
          : (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"4rem 2rem",
              border:"1px dashed rgba(201,164,80,0.2)", color:"rgba(250,245,233,0.35)" }}>
              <div style={{ fontFamily:"Cinzel,serif", fontSize:"2rem", marginBottom:"1rem", color:"rgba(201,164,80,0.3)" }}>✦</div>
              <p style={{ fontFamily:"Cormorant Garamond,serif", fontStyle:"italic", fontSize:"1.1rem", marginBottom:".5rem" }}>
                No profiles yet.
              </p>
              <p style={{ fontFamily:"Inter,sans-serif", fontSize:".8rem", letterSpacing:".05em" }}>
                Be the first — submit your profile below.
              </p>
            </div>
          )
        }
      </div>
      <div style={{ textAlign:"center" }}>
        <GBtn onClick={onAdd} style={{ padding:".8rem 2rem" }}>+ Submit Your Profile</GBtn>
      </div>
      {sel && <MemberModal m={sel} idx={selIdx} onClose={() => setSel(null)} />}
    </section>
  );
};

// ── GALLERY ───────────────────────────────────────────────────────────────────
const GItem = ({ item, onClick }) => {
  const [hv, setHv] = useState(false);
  return (
    <div onClick={() => onClick(item)} onMouseEnter={() => setHv(true)} onMouseLeave={() => setHv(false)}
      style={{ breakInside:"avoid", marginBottom:"1rem", cursor:"pointer", position:"relative", overflow:"hidden",
        border:`1px solid ${hv?"rgba(201,164,80,0.5)":"rgba(201,164,80,0.2)"}`, transition:"border-color .3s ease" }}>
      <img src={item.src} alt={item.caption}
        style={{ width:"100%", display:"block", transition:"transform .4s ease", transform:hv?"scale(1.05)":"scale(1)" }} />
      <div style={{ position:"absolute", bottom:0, left:0, right:0,
        background:"linear-gradient(to top,rgba(12,11,15,0.88),transparent)",
        padding:"2.5rem 1rem .85rem", opacity:hv?1:0, transition:"opacity .3s ease",
        pointerEvents:hv?"auto":"none" }}>
        <div style={{ fontFamily:"Inter,sans-serif", fontSize:".8rem", color:"#FAF5E9", marginBottom:".25rem" }}>{item.caption}</div>
        <span style={{ fontFamily:"Inter,sans-serif", fontSize:".62rem", letterSpacing:".12em", textTransform:"uppercase", color:"#C9A450", background:"rgba(201,164,80,0.1)", border:"1px solid rgba(201,164,80,0.25)", padding:".15rem .5rem" }}>{item.tag}</span>
      </div>
    </div>
  );
};

const Gallery = () => {
  const [lb, setLb] = useState(null);
  return (
    <section id="gallery" style={{ padding:"5rem 2rem", maxWidth:1200, margin:"0 auto", borderTop:"1px solid rgba(201,164,80,0.2)", position:"relative", zIndex:1 }}>
      <SH eye="Memories" title="Photo Gallery" sub="Moments captured, grace remembered." />
      <div style={{ columns:"2 280px", columnGap:"1rem" }}>
        {GALLERY.map(g => <GItem key={g.id} item={g} onClick={setLb} />)}
      </div>
      {lb && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(12,11,15,0.97)", backdropFilter:"blur(8px)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem", cursor:"pointer" }}
          onClick={() => setLb(null)}>
          <img src={lb.src} alt={lb.caption}
            style={{ maxWidth:"90vw", maxHeight:"76vh", objectFit:"contain", border:"1px solid rgba(201,164,80,0.5)" }} />
          <p style={{ fontFamily:"Cinzel,serif", fontSize:".78rem", letterSpacing:".2em", color:"#C9A450", marginTop:"1.25rem" }}>{lb.caption}</p>
          <p style={{ fontFamily:"Inter,sans-serif", fontSize:".68rem", color:"rgba(250,245,233,0.45)", marginTop:".35rem" }}>Click anywhere to close</p>
        </div>
      )}
    </section>
  );
};

// ── TIMELINE ──────────────────────────────────────────────────────────────────
const Timeline = () => (
  <section id="timeline" style={{ padding:"5rem 2rem", maxWidth:1200, margin:"0 auto", borderTop:"1px solid rgba(201,164,80,0.2)", position:"relative", zIndex:1 }}>
    <SH eye="Our Journey" title="A Living History" sub="Every chapter authored by grace." />
    <div style={{ maxWidth:680, margin:"0 auto", position:"relative" }}>
      <div style={{ position:"absolute", left:16, top:8, bottom:8, width:1,
        background:"linear-gradient(to bottom,#C9A450,rgba(201,164,80,0.06))" }} />
      {TIMELINE.map((ev, i) => (
        <div key={i} style={{ position:"relative", paddingLeft:"3rem", marginBottom:i<TIMELINE.length-1?"2.5rem":0 }}>
          <div style={{ position:"absolute", left:12, top:7, width:10, height:10,
            borderRadius:"50%", background:"#C9A450", boxShadow:"0 0 10px #C9A450" }} />
          <div style={{ background:"rgba(255,248,230,0.04)", border:"1px solid rgba(201,164,80,0.2)", padding:"1.25rem", backdropFilter:"blur(4px)" }}>
            <div style={{ fontFamily:"Cinzel,serif", fontSize:".65rem", letterSpacing:".2em", color:"#C9A450", marginBottom:".4rem" }}>{ev.year}</div>
            <div style={{ fontFamily:"Cinzel,serif", fontSize:"1.05rem", fontWeight:600, color:"#FAF5E9", marginBottom:".5rem" }}>{ev.title}</div>
            <p style={{ fontFamily:"Inter,sans-serif", fontSize:".85rem", color:"rgba(250,245,233,0.45)", lineHeight:1.75 }}>{ev.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
);

// ── GUESTBOOK ─────────────────────────────────────────────────────────────────
const Guestbook = () => {
  const [msgs, setMsgs]   = useState([]);
  const [name, setName]   = useState("");
  const [msg, setMsg]     = useState("");
  const [ok, setOk]       = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const q = query(collection(db, "guestbook"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  const submit = async () => {
    if (!name.trim() || !msg.trim()) return;
    setLoading(true);
    const entry = {
      name: name.trim(), message: msg.trim(),
      date: new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }),
      timestamp: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, "guestbook"), entry);
    setMsgs(prev => [{ id: docRef.id, ...entry }, ...prev]);
    setName(""); setMsg(""); setOk(true);
    setTimeout(() => setOk(false), 3000);
    setLoading(false);
  };

  return (
    <section id="guestbook" style={{ padding:"5rem 2rem", maxWidth:1200, margin:"0 auto", borderTop:"1px solid rgba(201,164,80,0.2)", position:"relative", zIndex:1 }}>
      <SH eye="Leave a Mark" title="Message Wall" sub="Words that become part of the story." />
      <div style={{ maxWidth:540, margin:"0 auto 3rem" }}>
        <Inp value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{ marginBottom:".75rem" }} />
        <TA value={msg} onChange={e=>setMsg(e.target.value)} rows={4} placeholder="A message, a prayer, a memory..." style={{ marginBottom:"1rem" }} />
        <button onClick={submit} disabled={loading||!name||!msg}
          style={{ width:"100%", padding:".9rem", border:"1px solid #C9A450",
            background:ok?"rgba(201,164,80,0.15)":"rgba(201,164,80,0.07)",
            color:ok?"#E8C97A":"#C9A450", fontFamily:"Cinzel,serif", fontSize:".73rem",
            letterSpacing:".22em", textTransform:"uppercase", cursor:"pointer", transition:"all .3s ease",
            opacity:(loading||!name||!msg)?.5:1 }}>
          {ok?"✓ Message Added":loading?"Sending...":"Leave Your Mark"}
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"1rem" }}>
        {msgs.length===0
          ? <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"3rem", fontFamily:"Cormorant Garamond,serif", fontStyle:"italic", color:"rgba(250,245,233,0.45)", fontSize:"1.05rem" }}>Be the first to leave a mark on this wall.</div>
          : msgs.map(m => (
            <div key={m.id} style={{ background:"rgba(255,248,230,0.04)", border:"1px solid rgba(201,164,80,0.2)", padding:"1.5rem", backdropFilter:"blur(4px)" }}>
              <p style={{ fontFamily:"Cormorant Garamond,serif", fontStyle:"italic", fontSize:"1rem", color:"#FAF5E9", lineHeight:1.75, marginBottom:"1rem" }}>"{m.message}"</p>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontFamily:"Cinzel,serif", fontSize:".75rem", color:"#C9A450" }}>— {m.name}</span>
                <span style={{ fontFamily:"Inter,sans-serif", fontSize:".67rem", color:"rgba(250,245,233,0.45)" }}>{m.date}</span>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
};
// ── SUBMIT MODAL ──────────────────────────────────────────────────────────────
const SubmitModal = ({ onClose }) => {
  const [f, setF] = useState({ name:"",role:"",department:"",bio:"",scripture:"",scriptureText:"",spiritualGift:"",hobbies:"",testimony:"",since:"",funFact:"",photo:"" });
  const [done, setDone] = useState(false);
  const set = (k,v) => setF(p => ({...p,[k]:v}));
  const handlePhotoFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 400;
        let { width, height } = img;
        if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
        if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        set("photo", canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!f.name||!f.role) return;
    const entry = {
      ...f,
      hobbies: f.hobbies.split(",").map(h=>h.trim()).filter(Boolean),
      approved: false,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, "submissions"), entry);
    setDone(true);
  };

  const row = (k,lbl,ph,rows) => (
    <div key={k} style={{ marginBottom:".85rem" }}>
      <Lbl t={lbl} />
      {rows ? <TA value={f[k]} onChange={e=>set(k,e.target.value)} rows={rows} placeholder={ph}/> : <Inp value={f[k]} onChange={e=>set(k,e.target.value)} placeholder={ph}/>}
    </div>
  );

  return (
    <ModalWrap onClose={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"#13110D", border:"1px solid rgba(201,164,80,0.5)", maxWidth:520, width:"100%", maxHeight:"90vh", overflowY:"auto", padding:"2.5rem", position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute", top:"1.25rem", right:"1.25rem", background:"none", border:"none", color:"rgba(250,245,233,0.45)", fontSize:"1.3rem", cursor:"pointer" }}>✕</button>
        <div style={{ fontFamily:"Cinzel,serif", fontSize:".62rem", letterSpacing:".3em", color:"#C9A450", marginBottom:".5rem", textTransform:"uppercase" }}>Join the Wall</div>
        <h3 style={{ fontFamily:"Cinzel,serif", fontSize:"1.4rem", color:"#FAF5E9", marginBottom:"1.75rem" }}>Submit Your Profile</h3>
        {done ? (
          <div style={{ textAlign:"center", padding:"2rem 0" }}>
            <div style={{ fontSize:"2.5rem", marginBottom:"1rem" }}>✨</div>
            <p style={{ fontFamily:"Cormorant Garamond,serif", fontStyle:"italic", color:"#FAF5E9", fontSize:"1.1rem", marginBottom:".5rem" }}>Profile submitted!</p>
            <p style={{ fontFamily:"Inter,sans-serif", color:"rgba(250,245,233,0.45)", fontSize:".85rem", marginBottom:"1.5rem" }}>Your profile is under review. The admin will publish it soon.</p>
            <GBtn gold onClick={onClose}>Close</GBtn>
          </div>
        ) : (
          <>
            {row("name","Full Name *","e.g. Nyx Doe")}
            {row("role","Role in Acts 29 *","e.g. Member, Worship Lead...")}
            {row("department","Department in GLT","e.g. Media & Tech, Prayer Team...")}
            {row("since","In Acts 29 Since","e.g. 2022")}
            <div style={{ marginBottom:".85rem" }}>
  <Lbl t="Photo" />
  {/* Preview */}
  {f.photo && (
    <img src={f.photo} alt="preview"
      style={{ width:72, height:72, borderRadius:"50%", objectFit:"cover",
        border:"2px solid rgba(201,164,80,0.4)", marginBottom:".75rem", display:"block" }} />
  )}
  {/* Upload from device */}
  <label style={{ display:"block", marginBottom:".6rem" }}>
    <div style={{ padding:".65rem 1rem", border:"1px solid rgba(201,164,80,0.3)",
      background:"rgba(201,164,80,0.06)", color:"rgba(250,245,233,0.7)",
      fontFamily:"Inter,sans-serif", fontSize:".82rem", cursor:"pointer",
      textAlign:"center", letterSpacing:".05em" }}>
      📷 Upload from device
    </div>
    <input type="file" accept="image/*" onChange={handlePhotoFile}
      style={{ display:"none" }} />
  </label>
  {/* OR paste a link */}
  <Inp value={f.photo.startsWith("data:") ? "" : f.photo}
    onChange={e => set("photo", e.target.value)}
    placeholder="Or paste Google Drive / any image link" />
</div>
            {row("scripture","Favourite Scripture","e.g. John 3:16")}
            {row("scriptureText","Scripture Text","For God so loved the world...",2)}
            {row("bio","Bio *","A few words about you and your faith journey...",3)}
            {row("testimony","Testimony Highlight","One thing God has done in your life...",2)}
            {row("spiritualGift","Spiritual Gift","e.g. Teaching, Intercession, Mercy...")}
            {row("hobbies","Hobbies (comma-separated)","e.g. Football, Reading, Art")}
            {row("funFact","Fun Fact","Something surprising about you...")}
            <button onClick={submit} disabled={!f.name||!f.role||!f.bio}
              style={{ width:"100%", padding:".9rem", border:"1px solid #C9A450", background:"rgba(201,164,80,0.08)", color:"#C9A450", fontFamily:"Cinzel,serif", fontSize:".73rem", letterSpacing:".22em", textTransform:"uppercase", cursor:"pointer", opacity:(!f.name||!f.role||!f.bio)?.5:1 }}>
              Submit for Review
            </button>
          </>
        )}
      </div>
    </ModalWrap>
  );
};

// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
const AdminPanel = ({ onClose, onApprove }) => {
  const [pw, setPw]       = useState("");
  const [auth, setAuth]   = useState(false);
  const [subs, setSubs]   = useState([]);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (!auth) return;
    (async () => {
      const snap = await getDocs(collection(db, "submissions"));
      setSubs(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    })();
  }, [auth]);

  const tryAuth = () => { if (pw==="acts29admin"){setAuth(true);setWrong(false);}else setWrong(true); };

  const approve = async (sub) => {
    const { firestoreId, ...data } = sub;
    await addDoc(collection(db, "members"), { ...data, approved: true });
    await deleteDoc(doc(db, "submissions", firestoreId));
    onApprove({ ...data, approved: true, id: firestoreId });
    setSubs(prev => prev.filter(s => s.firestoreId !== firestoreId));
  };

  const reject = async (sub) => {
    await deleteDoc(doc(db, "submissions", sub.firestoreId));
    setSubs(prev => prev.filter(s => s.firestoreId !== sub.firestoreId));
  };

  return (
    <ModalWrap onClose={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"#13110D", border:"1px solid rgba(201,164,80,0.5)", maxWidth:560, width:"100%", maxHeight:"88vh", overflowY:"auto", padding:"2.5rem", position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute", top:"1.25rem", right:"1.25rem", background:"none", border:"none", color:"rgba(250,245,233,0.45)", fontSize:"1.3rem", cursor:"pointer" }}>✕</button>
        <h3 style={{ fontFamily:"Cinzel,serif", fontSize:"1.3rem", color:"#FAF5E9", marginBottom:"1.5rem" }}>Admin Panel</h3>
        {!auth ? (
          <>
            <p style={{ fontFamily:"Inter,sans-serif", color:"rgba(250,245,233,0.45)", fontSize:".87rem", marginBottom:"1rem" }}>Enter password to access member submissions.</p>
            {wrong && <p style={{ fontFamily:"Inter,sans-serif", color:"#C94A50", fontSize:".82rem", marginBottom:".75rem" }}>Incorrect password.</p>}
            <Inp type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" style={{ marginBottom:"1rem" }} onKeyDown={e=>e.key==="Enter"&&tryAuth()} />
            <GBtn gold onClick={tryAuth} style={{ width:"100%", padding:".8rem", display:"block" }}>Enter</GBtn>
          </>
        ) : (
          <>
            <p style={{ fontFamily:"Inter,sans-serif", color:"rgba(250,245,233,0.45)", fontSize:".85rem", marginBottom:"1.5rem" }}>
              {subs.length===0?"No pending submissions.":`${subs.length} submission${subs.length>1?"s":""} awaiting review.`}
            </p>
            {subs.length===0
              ? <p style={{ fontFamily:"Cormorant Garamond,serif", fontStyle:"italic", color:"rgba(250,245,233,0.45)", textAlign:"center", padding:"2rem" }}>All clear — no pending submissions.</p>
              : subs.map(sub => (
                <div key={sub.firestoreId} style={{ background:"rgba(255,248,230,0.04)", border:"1px solid rgba(201,164,80,0.2)", padding:"1.25rem", marginBottom:"1rem" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:".75rem", marginBottom:".75rem" }}>
                    <Avatar name={sub.name} size={44} photo={sub.photo} />
                    <div>
                      <div style={{ fontFamily:"Cinzel,serif", fontSize:".95rem", color:"#FAF5E9" }}>{sub.name}</div>
                      <div style={{ fontFamily:"Inter,sans-serif", fontSize:".72rem", color:"#C9A450" }}>{sub.role}{sub.department?` · ${sub.department}`:""}</div>
                    </div>
                  </div>
                  <p style={{ fontFamily:"Inter,sans-serif", fontSize:".83rem", color:"rgba(250,245,233,0.45)", lineHeight:1.65, marginBottom:"1rem" }}>{sub.bio}</p>
                  <div style={{ display:"flex", gap:".75rem" }}>
                    <button onClick={()=>approve(sub)} style={{ padding:".5rem 1.25rem", border:"1px solid #C9A450", background:"rgba(201,164,80,0.1)", color:"#C9A450", fontFamily:"Inter,sans-serif", fontSize:".78rem", cursor:"pointer" }}>✓ Approve</button>
                    <button onClick={()=>reject(sub)} style={{ padding:".5rem 1.25rem", border:"1px solid rgba(200,74,74,0.4)", background:"transparent", color:"rgba(200,74,74,0.7)", fontFamily:"Inter,sans-serif", fontSize:".78rem", cursor:"pointer" }}>✕ Reject</button>
                  </div>
                </div>
              ))
            }
          </>
        )}
      </div>
    </ModalWrap>
  );

};// ── FOOTER ────────────────────────────────────────────────────────────────────
const Footer = () => (
  <footer style={{ borderTop:"1px solid rgba(201,164,80,0.2)", padding:"3.5rem 2rem", textAlign:"center", position:"relative", zIndex:1 }}>
    <div style={{ fontFamily:"Cinzel,serif", fontSize:"1.6rem", fontWeight:700, background:"linear-gradient(135deg,#C9A450,#E8C97A)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", marginBottom:".5rem" }}>ACTS 29</div>
    <p style={{ fontFamily:"Cormorant Garamond,serif", fontStyle:"italic", color:"rgba(250,245,233,0.45)", fontSize:".9rem", marginBottom:".5rem" }}>God's Love Tabernacle · Cell Group</p>
    <p style={{ fontFamily:"Inter,sans-serif", fontSize:".67rem", color:"rgba(250,245,233,0.2)", letterSpacing:".1em", textTransform:"uppercase" }}>Acts 28 ends. Our story continues.</p>
  </footer>
);

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  useGlobalStyles();
  const [screen, setScreen]       = useState("landing");
  const [showSub, setShowSub]     = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [activeNav, setActiveNav] = useState("about");
  const audio = useAudio();

  // Load approved members: start with SEED_MEMBERS (empty by default),
  // then merge in any members that have been approved via the Admin Panel.
  // Approved members are saved to localStorage so they persist permanently —
  // across page refreshes and future visits.
 const [members, setMembers] = useState([...SEED_MEMBERS]);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "members"));
      const fromDb = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers([...SEED_MEMBERS, ...fromDb]);
    })();
  }, []);

  const handleApprove = (member) => {
    setMembers(prev => [...prev, member]);
  };

  return (
    <>
      {screen === "landing"
        ? <Landing onEnter={() => setScreen("main")} />
        : (
          <div style={{ background:"#0C0B0F", minHeight:"100vh" }}>
            {/* Living background — visible through all sections */}
            <BackgroundFX />

            <Nav active={activeNav} onNav={setActiveNav} onAdmin={() => setShowAdmin(true)} audio={audio} />
            <main>
              <About />
              <Members members={members.filter(m => m.approved)} onAdd={() => setShowSub(true)} />
              <Gallery />
              <Timeline />
              <Guestbook />
            </main>
            <Footer />
          </div>
        )
      }
      {showSub   && <SubmitModal  onClose={() => setShowSub(false)} />}
      {showAdmin && <AdminPanel   onClose={() => setShowAdmin(false)} onApprove={handleApprove} />}
    </>
  );
}
