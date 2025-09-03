
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import gsap from "gsap";

/* ========== MODEL LIST ========== */
const MODELS = [
  {
    id: "e11",
    name: "E11 Blaster",
    file: "/models/E11_Final_squoosh-v1.glb",
    caption: "Hard-surface prop. Turntable-ready.",
    fields: [
      ["Category", "Prop"],
      ["Software", "Blender", "Subtance Painter"],
      ["Year", "2025"],
      ["Textures", "Base/Metal-Rough/Normal"],
    ],
  },
  {
    id: "ramen",
    name: "Ramen Bowl",
    file: "/models/Ramen_squoosh_v1.glb",
    caption: "Stylized food model.",
    fields: [
      ["Category", "Prop"],
      ["Software", "Blender"],
    ],
  },
];

/* ========== DOM ========== */
const wrap = document.getElementById("three-canvas");
const nameEl = document.getElementById("modelName");
const fieldsEl = document.getElementById("modelFields");
const captionEl = document.getElementById("caption");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const dotsEl = document.getElementById("dots");
const loadingEl = document.getElementById("loadingOverlay");

function hideLoading() {
  if (!loadingEl) return;
  loadingEl.style.opacity = "0";
  setTimeout(() => loadingEl.remove(), 300);
}

function renderDots(index) {
  dotsEl.innerHTML = "";
  MODELS.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "dot" + (i === index ? " active" : "");
    d.addEventListener("click", () => setActive(i));
    dotsEl.appendChild(d);
  });
}

/* ========== THREE BASIC (Optimized) ========== */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

// ลด DPI อัตโนมัติสำหรับมือถือ/จอความหนาแน่นสูง
const isMobile = /Mobi|Android/i.test(navigator.userAgent);
const targetDPR = isMobile ? 1.25 : Math.min(window.devicePixelRatio, 1.75);
renderer.setPixelRatio(targetDPR);

renderer.setSize(wrap.clientWidth, wrap.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1; // เบาลงเล็กน้อย ให้เรนเดอร์เร็วขึ้นนิด
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(
  50,
  wrap.clientWidth / wrap.clientHeight,
  0.1,
  200
);
camera.position.set(2.4, 1.6, 3.0);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.085;
controls.rotateSpeed = 0.95;
controls.zoomSpeed = 0.9;
// controls.enablePan  = false;
controls.minAzimuthAngle = -Infinity;
controls.maxAzimuthAngle = Infinity;
controls.minPolarAngle = 0.1;
controls.maxPolarAngle = Math.PI - 0.1;

/* ========== LIGHTING (ย่อจำนวนลงเล็กน้อย) ========== */
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(4, 6, 6);
scene.add(keyLight);
// ถ้าต้องการคมที่สุดให้คง 3 ดวงเหมือนเดิมได้ แต่ 1 ดวง + ambient จะเบากว่า

/* ========== HDRI (Defer) ========== */
// เลื่อนโหลด HDRI ออกไปจนผู้ใช้เห็นโมเดลแรกแล้ว เพื่อลด TTI/INP
const pmrem = new THREE.PMREMGenerator(renderer);
const HDR_PATH = "/hdr/derelict.hdr"; // คุณเปลี่ยนเป็น .hdr แล้ว ดีมาก

function loadEnvDeferred() {
  new RGBELoader().load(
    HDR_PATH,
    (tex) => {
      const envMap = pmrem.fromEquirectangular(tex).texture;
      scene.environment = envMap;
      tex.dispose();
    },
    undefined,
    (err) => console.warn("⚠️ HDR load failed:", err)
  );
}

/* ========== LOADERS (GLTF + DRACO) ========== */
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
loader.setDRACOLoader(draco);

/* ========== GROUP & STATE ========== */
const group = new THREE.Group();
scene.add(group);

let instances = []; // { obj }
let activeIndex = 0;

function setUI(meta) {
  nameEl.textContent = meta.name;
  captionEl.textContent = meta.caption || "";
  fieldsEl.innerHTML =
    meta.fields
      ?.map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
      .join("") || "";
  renderDots(activeIndex);
}

/* ========== UTIL: จัดกล้องให้พอดีโมเดล + zoom limits ========== */
function frameObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;

  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const center = sphere.center;
  const radius = Math.max(sphere.radius, 0.001);

  const dir = new THREE.Vector3(1, 0.6, 1).normalize();
  const fitHeightDistance =
    radius / Math.sin(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const distance = fitHeightDistance * 1.2;

  const newPos = center.clone().add(dir.multiplyScalar(distance));

  // animate move camera / target
  gsap.to(camera.position, {
    x: newPos.x,
    y: newPos.y,
    z: newPos.z,
    duration: 0.6,
    ease: "power2.out",
    onUpdate: () => camera.updateProjectionMatrix(),
  });
  gsap.to(controls.target, {
    x: center.x,
    y: center.y,
    z: center.z,
    duration: 0.6,
    ease: "power2.out",
    onUpdate: () => controls.update(),
  });

  camera.near = Math.max(radius / 100, 0.01);
  camera.far = Math.max(radius * 20, 100);
  camera.updateProjectionMatrix();

  controls.minDistance = radius * 0.6;
  controls.maxDistance = radius * 6;
}

/* ========== LOAD (First paint fast) ========== */
function loadOne(meta) {
  return new Promise((resolve, reject) => {
    loader.load(
      meta.file,
      (gltf) => {
        const obj = gltf.scene;
        obj.visible = false;
        obj.position.set(0, 0, 0);
        obj.scale.setScalar(1);
        obj.traverse((n) => {
          if (n.isMesh) {
            if (n.material?.map) n.material.map.encoding = THREE.SRGBColorSpace;
            if (n.material && "envMapIntensity" in n.material)
              n.material.envMapIntensity = 1.15;
          }
        });
        group.add(obj);
        resolve({ obj });
      },
      undefined,
      (err) => {
        console.error("GLB load error:", meta.file, err);
        reject(err);
      }
    );
  });
}

// โหลดเฉพาะตัวแรกก่อน แล้วค่อยพรีโหลดที่เหลือ + ค่อยโหลด HDRI
async function loadAll() {
  // 1) ตัวแรก
  const firstMeta = MODELS[0];
  const { obj } = await loadOne(firstMeta);
  instances[0] = { obj };
  setActive(0);
  frameObject(obj);
  hideLoading();

  // 2) เริ่มโหลด HDRI หลังผู้ใช้เห็นเฟรมแรกแล้ว
  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadEnvDeferred, { timeout: 1500 });
  } else {
    setTimeout(loadEnvDeferred, 300);
  }

  // 3) พรีโหลดโมเดลที่เหลือแบบ background
  const rest = MODELS.slice(1);
  const loadNext = () => {
    if (!rest.length) return;
    const meta = rest.shift();
    loadOne(meta).then(({ obj }) => {
      instances.push({ obj });
      if ("requestIdleCallback" in window) {
        requestIdleCallback(loadNext, { timeout: 1500 });
      } else {
        setTimeout(loadNext, 300);
      }
    });
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadNext, { timeout: 1000 });
  } else {
    setTimeout(loadNext, 200);
  }
}

function setActive(i) {
  if (!instances.length) return;
  activeIndex = (i + instances.length) % instances.length;
  instances.forEach((ins, idx) => (ins.obj.visible = idx === activeIndex));
  setUI(MODELS[activeIndex]);

  // model bounce
  gsap.fromTo(
    instances[activeIndex].obj.rotation,
    { y: -0.2 },
    { y: 0, duration: 0.6, ease: "power2.out" }
  );
  gsap.fromTo(
    instances[activeIndex].obj.position,
    { y: 0.1 },
    { y: 0, duration: 0.6, ease: "power2.out" }
  );

  frameObject(instances[activeIndex].obj);
}

/* ========== UI EVENTS ========== */
prevBtn.addEventListener("click", () => setActive(activeIndex - 1));
nextBtn.addEventListener("click", () => setActive(activeIndex + 1));

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") setActive(activeIndex - 1);
  if (e.key === "ArrowRight") setActive(activeIndex + 1);
});

/* ========== Idle motion ========== */
function animateModel(obj, dt) {
  obj.rotation.y += dt * 0.3;
}

/* ========== LOOP/RESIZE ========== */
const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  controls.update();
  const active = instances[activeIndex]?.obj;
  if (active) animateModel(active, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

function applySize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false); // ไม่บังคับ reallocate ถ้าไม่จำเป็น
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
// debounce resize ลดงาน layout/GL
let resizeTimer;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applySize, 120);
}
window.addEventListener("resize", onResize);
applySize();

/* ========== Page UX ========== */
(function initPageUX() {
  // smooth scroll
  document.querySelectorAll('.nav a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute("href"));
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });
  // fade-in on view
  const elements = document.querySelectorAll(".fade-in");
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) en.target.classList.add("visible");
      });
    },
    { threshold: 0.1 }
  );
  elements.forEach((el) => obs.observe(el));
})();

/* start */
loadAll();

/* ================= Enhanced Gallery + Lightbox ================= */
// (โค้ดส่วนแกลเลอรี/ไลท์บ็อกซ์/โปรเจกต์/เซอร์ทิฟิเคต เหมือนเดิมด้านล่าง)
(function initEnhancedGallery() {
  const galleryData = {
    onigiri: {
      title: "Japanese Onigiri - Multiple Angles",
      items: [
        { type: "img", src: "/images/Onigiri.png", alt: "Onigiri Angle 1" },
        { type: "img", src: "/images/Onigiri.png", alt: "Onigiri Angle 2" },
        { type: "img", src: "/images/Onigiri.png", alt: "Onigiri Angle 3" },
        { type: "img", src: "/images/Onigiri.png", alt: "Onigiri Close-up" },
      ],
    },
    ramen: {
      title: "Ramen Bowl - Different Views",
      items: [
        { type: "img", src: "/images/ramen01.png", alt: "Ramen Top" },
        { type: "img", src: "/images/ramen01.png", alt: "Ramen Side" },
        { type: "img", src: "/images/ramen01.png", alt: "Ramen Detail" },
      ],
    },
    crime: {
      title: "Crime Scene - Multiple Angles",
      items: [
        { type: "img", src: "/images/crime1.png", alt: "Crime View 1" },
        { type: "img", src: "/images/crime6.png", alt: "Crime View 2" },
        { type: "img", src: "/images/crime4.png", alt: "Crime View 3" },
      ],
    },
    cosmetic: {
      title: "Cosmetic Product Display",
      items: [
        { type: "img", src: "/images/cosmetic1.png", alt: "Cosmetic View 1" },
        { type: "img", src: "/images/cosmetic2.png", alt: "Cosmetic View 2" },
      ],
    },
    myroom: {
      title: "My Room - Personal Space",
      items: [
        { type: "img", src: "/images/rommport.png", alt: "My Room View 1" },
        { type: "img", src: "/images/rommport_night.png", alt: "My Room View 2" },
        { type: "img", src: "/images/rommport_daylight.png", alt: "My Room View 3" },
        { type: "img", src: "/images/rommport_daylight_ramp1.png", alt: "My Room View 4" },
      ],
    },
    device: {
      title: "Device - Audio Device",
      items: [
        { type: "img", src: "/images/All1.png", alt: "Device View 1" },
        { type: "img", src: "/images/mp3.png", alt: "Device View 2" },
        { type: "img", src: "/images/MusicPlayer.png", alt: "Device View 3" },
        { type: "img", src: "/images/Radio.png", alt: "Device View 4" },
        { type: "img", src: "/images/All2.png", alt: "Device View 5" },
      ],
    },
    train: {
      title: "Train - 3D Model",
      items: [
        { type: "img", src: "/images/All1.png", alt: "Train View 1" },
        { type: "img", src: "/images/mp3.png", alt: "Train View 2" },
      ],
    },
    e11: {
      title: "E11 Blaster - Hard-surface Prop",
      items: [{ type: "img", src: "/images/E11.png", alt: "E11" }],
    },
    animationCar: {
      title: "Car Animation Turntable",
      items: [{ type: "video", src: "/videos/carcute.mp4", alt: "Car Animation MP4" }],
    },
    animationReaction: {
      title: "Basic Reaction Animation",
      items: [{ type: "video", src: "/videos/Basicreaction.mp4", alt: "Basic Reaction Animation" }],
    },
    showreel: {
      title: "Showreel Blaster Animation",
      items: [{ type: "video", src: "/videos/showreel_blaster.mov", alt: "Showreel Blaster" }],
    },
  };

  // ... (โค้ดเดิมของคุณสำหรับมินิคารูเซล/ไลท์บ็อกซ์/อีเวนต์เหมือนเดิม)
  document.querySelectorAll(".gallery-item").forEach((item) => {
    const container = item.querySelector(".image-carousel");
    if (!container) return;

    const slides = container.querySelectorAll(".carousel-slide");
    const dots = container.querySelectorAll(".carousel-dot");
    const prev = container.querySelector(".carousel-prev");
    const next = container.querySelector(".carousel-next");

    const setActive = (i) => {
      const n = slides.length;
      const idx = ((i % n) + n) % n;
      slides.forEach((s) => s.classList.remove("active"));
      dots.forEach((d) => d.classList.remove("active"));
      slides[idx].classList.add("active");
      dots[idx]?.classList.add("active");
      item.dataset.current = idx;
    };

    item.dataset.current = item.dataset.current || 0;
    setActive(Number(item.dataset.current));

    prev?.addEventListener("click", (e) => {
      e.stopPropagation();
      setActive(Number(item.dataset.current) - 1);
    });
    next?.addEventListener("click", (e) => {
      e.stopPropagation();
      setActive(Number(item.dataset.current) + 1);
    });

    dots.forEach((d) => {
      d.addEventListener("click", (e) => {
        e.stopPropagation();
        const to = Number(d.getAttribute("data-slide") || 0);
        setActive(to);
      });
    });

    item.addEventListener("click", () => {
      const pid = item.getAttribute("data-project");
      const cur = Number(item.dataset.current || 0);
      openLightbox(pid, cur);
    });
  });

  const lightbox = document.getElementById("lightbox");
  const lbTitle = document.getElementById("lightboxTitle");
  const lbCarousel = document.getElementById("lightboxCarousel");
  const lbNav = document.getElementById("lightboxNav");
  const lbPrev = document.getElementById("lightboxPrev");
  const lbNext = document.getElementById("lightboxNext");
  const lbClose = document.getElementById("lightboxClose");

  let currentProject = null;
  let currentSlide = 0;

  function openLightbox(projectId, startIndex = 0) {
    const data = galleryData[projectId];
    if (!data) return;

    currentProject = projectId;
    currentSlide = startIndex;

    lbTitle.textContent = data.title;
    lbCarousel.innerHTML = "";
    lbNav.innerHTML = "";

    data.items.forEach((it, i) => {
      const slide = document.createElement("div");
      slide.className = "lightbox-slide" + (i === startIndex ? " active" : "");
      slide.innerHTML =
        it.type === "video"
          ? `<video controls autoplay muted loop playsinline preload="metadata"><source src="${it.src}" type="video/mp4"></video>`
          : `<img src="${it.src}" alt="${it.alt || ""}">`;
      lbCarousel.appendChild(slide);

      const dot = document.createElement("div");
      dot.className = "lightbox-dot" + (i === startIndex ? " active" : "");
      dot.addEventListener("click", () => setLightboxSlide(i));
      lbNav.appendChild(dot);
    });

    lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("active");
    document.body.style.overflow = "";
    currentProject = null;
    currentSlide = 0;
    lbCarousel.innerHTML = "";
    lbNav.innerHTML = "";
  }

  function setLightboxSlide(i) {
    const data = { items: lbCarousel.querySelectorAll(".lightbox-slide") };
    const n = data.items.length;
    currentSlide = ((i % n) + n) % n;
    const slides = lbCarousel.querySelectorAll(".lightbox-slide");
    const dots = lbNav.querySelectorAll(".lightbox-dot");
    slides.forEach((s, idx) => s.classList.toggle("active", idx === currentSlide));
    dots.forEach((d, idx) => d.classList.toggle("active", idx === currentSlide));
  }

  function changeLightboxSlide(step) {
    setLightboxSlide(currentSlide + step);
  }

  lbPrev.addEventListener("click", () => changeLightboxSlide(-1));
  lbNext.addEventListener("click", () => changeLightboxSlide(1));
  lbClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (!currentProject) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") changeLightboxSlide(-1);
    if (e.key === "ArrowRight") changeLightboxSlide(1);
  });
})();

/* ===== Featured Project Details (Modal) ===== */
const featuredData = {
  elderly: {
    title: "VR for Elderly",
    meta: [
      ["Role","VR Dev / UX"], ["Tools","Unity, Blender"],
      ["Timeline","2024"]
    ],
    overview:
      "Application VR ออกกำลังกายสำหรับผู้สูงอายุ โดยประกอบด้วยมินิเกมหลากหลาย ที่สามารถฝึกฝนกายบริหาร ฝึกสมาธิความจำ และฝึกความคล่องแคล่วของร่างกาย",
    goals: [
      "เสริมเกม กระบี่ฟันผลไม้ เพื่อส่งเสริมการออกกำลังกายสำหรับผู้สูงอายุในด้านการเคลื่อนไหวและยืดหยุ่นของร่างกาย โดยมีการศึกษา Motion sickness เพื่อที่จะสามารถสร้างประสบการณ์ที่ดีกับผู้เล่นได้" ,
      "เป็นโปรเจกพัฒนาต่อยอด ได้มีการต่อยอดให้มีเกมออกกำลังกายเพิ่มขึ้น และปรับปรุงโปรแกรมในบางซีนให้มีความเหมาะสมมากขึ้น"
    ],
    hero: { type:"video", src:"/videos/elderly.mp4" },
    gallery: ["/images/elderly1.png", "/images/elderly2.png"],
  },

  train: {
    title: "Animation: Train to Another World",
    meta: [
      ["Role","3D Model : Train"], ["Tools","Blender"],
      ["Renderer","Eevee"]
    ],
    overview:
      "แอนิเมชันสั้นเล่าขบวนรถไฟวิ่งสู่โลกแฟนตาซี โทนอบอุ่นตา สไตล์กึ่ง Ghibli โดยมีผีเสื้อเป็นผู้ดำเนินเส้นทางเนื้อเรื่อง เป็นสิ่งที่นำพาไปดินแดนแห่งความฝันที่เมื่อใครได้พบเห็นหรือสบตาก็จะพบว่าบรรยากาศรอบตัวนั้นแปลกตาไป",
    goals: ["เล่าเรื่องด้วยภาพ (no dialogue)", "กล้องเคลื่อนนุ่ม ไฟอบอุ่น"],
    hero: { type:"video", src:"/videos/train_style_ghlibi.mov" },
    gallery: ["/images/train1.png", "/images/train2.png", "/images/concept.png"]
  },
};

const modalEl = document.getElementById("projectModal");
const closeBtn = document.getElementById("projectClose");

const elTitle = document.getElementById("projTitle");
const elMeta = document.getElementById("projMeta");
const elHero = document.getElementById("projHero");
const elOverview = document.getElementById("projOverview");
const elGoals = document.getElementById("projGoals");
const elProcess = document.getElementById("projProcess");
const elGallery = document.getElementById("projGallery");
const elOutcomes = document.getElementById("projOutcomes");
const elDLWrap = document.getElementById("projDownloadsWrap");
const elDownloads = document.getElementById("projDownloads");

document.querySelectorAll(".featured-project .project-link").forEach(a => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    const id = a.dataset.project; // "elderly" | "train"
    openProjectDetails(id);
  });
});

function openProjectDetails(id){
  const d = featuredData[id];
  if(!d) return;

  elTitle.textContent = d.title;

  elMeta.innerHTML = (d.meta||[])
    .map(([k,v])=>`<span class="chip"><strong>${k}:</strong> ${v}</span>`).join("");

  elHero.innerHTML = d.hero
    ? d.hero.type==="video"
      ? `<video src="${d.hero.src}" controls playsinline preload="metadata"></video>`
      : `<img src="${d.hero.src}" alt="">`
    : "";

  elOverview.textContent = d.overview || "";
  elGoals.innerHTML = (d.goals||[]).map(g=>`<li>${g}</li>`).join("");
  elProcess.innerHTML = (d.process||[])
    .map(s=>`<h5 style="margin:8px 0 4px">${s.h}</h5><p style="color:var(--muted);margin:0 0 8px">${s.p}</p>`)
    .join("");
  elGallery.innerHTML = (d.gallery||[]).map(src=>`<img src="${src}" alt="">`).join("");
  elOutcomes.innerHTML = (d.outcomes||[]).map(x=>`<li>${x}</li>`).join("");

  if(d.downloads && d.downloads.length){
    elDLWrap.style.display = "";
    elDownloads.innerHTML = d.downloads
      .map(x=>`<a href="${x.href}" target="_blank" rel="noreferrer">${x.label}</a>`).join("");
  } else {
    elDLWrap.style.display = "none";
    elDownloads.innerHTML = "";
  }

  modalEl.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeProjectDetails(){
  modalEl.classList.remove("active");
  document.body.style.overflow = "";
}
closeBtn.addEventListener("click", closeProjectDetails);
modalEl.addEventListener("click", (e)=>{ if(e.target===modalEl) closeProjectDetails(); });
document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && modalEl.classList.contains("active")) closeProjectDetails(); });

/* === Certificates: open with existing Lightbox === */
(function initCertificatesLightbox(){
  const certImgs = document.querySelectorAll('#certificates .certificate-img, .cert-card img');
  if (!certImgs.length) return;

  const lightbox   = document.getElementById('lightbox');
  const lbTitle    = document.getElementById('lightboxTitle');
  const lbCarousel = document.getElementById('lightboxCarousel');
  const lbNav      = document.getElementById('lightboxNav');

  function openSingleImageLightbox(src, title){
    lbTitle.textContent = title || 'Certificate';
    lbCarousel.innerHTML = `
      <div class="lightbox-slide active">
        <img src="${src}" alt="${title || 'Certificate'}">
      </div>`;
    lbNav.innerHTML = '';
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  certImgs.forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      const src = img.getAttribute('data-cert') || img.getAttribute('src');
      const title = img.getAttribute('alt') || 'Certificate';
      if (src) openSingleImageLightbox(src, title);
    });
  });
})();
