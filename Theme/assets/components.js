class BtnEffectController {
  static #instance = null;
 
  static #SELECTOR = '[button-effect]';
  static #SPAN_MARKER = 'data-btn-effect-span';
 
  /** @type {WeakMap<Element, AbortController>} */
  #controllers = new WeakMap();
 
  /** @type {MutationObserver|null} */
  #observer = null;
 
  static init() {
    if (!this.#instance) this.#instance = new BtnEffectController();
    return this.#instance;
  }
  
  constructor() {
    this.#scan(document.body);
    this.#watch();
  }
 
  // ── Private ─────────────────────────────────
 
  #watch() {
    this.#observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach(node => this.#handleAdded(node));
          m.removedNodes.forEach(node => this.#handleRemoved(node));
        }
        if (m.type === 'attributes') {
          const el = m.target;
          el.hasAttribute('button-effect') ? this.#attach(el) : this.#detach(el);
        }
      }
    });
 
    this.#observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['button-effect'],
    });
  }
 
  #handleAdded(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(BtnEffectController.#SELECTOR)) this.#attach(node);
    node.querySelectorAll?.(BtnEffectController.#SELECTOR).forEach(el => this.#attach(el));
  }
 
  #handleRemoved(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(BtnEffectController.#SELECTOR)) this.#detach(node);
    node.querySelectorAll?.(BtnEffectController.#SELECTOR).forEach(el => this.#detach(el));
  }
 
  #scan(root) {
    root.querySelectorAll(BtnEffectController.#SELECTOR).forEach(el => this.#attach(el));
  }
 
  #attach(el) {
    if (this.#controllers.has(el)) return; // đã gắn rồi, bỏ qua
 
    const abort = new AbortController();
    const span  = this.#getSpan(el);
 
    const move = e => {
      const { left, top } = el.getBoundingClientRect();
      span.style.top  = `${e.clientY - top}px`;
      span.style.left = `${e.clientX - left}px`;
    };
 
    el.addEventListener('mouseenter', move, { signal: abort.signal });
    el.addEventListener('mouseout',   move, { signal: abort.signal });
 
    this.#controllers.set(el, abort);
  }
 
  #detach(el) {
    this.#controllers.get(el)?.abort();
    this.#controllers.delete(el);
  }
 
  #getSpan(el) {
    return (
      el.querySelector(`:scope > span[${BtnEffectController.#SPAN_MARKER}]`) ??
      this.#createSpan(el)
    );
  }
 
  #createSpan(el) {
    const span = document.createElement('span');
    span.setAttribute(BtnEffectController.#SPAN_MARKER, '');
    el.appendChild(span);
    return span;
  }
}
 
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BtnEffectController.init());
} else {
  BtnEffectController.init();
}



class TabsComponent extends HTMLElement {
    #abort = null;
    #btns = [];
    #panels = [];
    #active = null;

    connectedCallback() {
        this.#abort ?.abort();
        this.#abort = new AbortController();
        const sig = this.#abort.signal;

        this.#btns = [...this.querySelectorAll('[role="tab"]')];
        this.#panels = [...this.querySelectorAll('[role="tabpanel"]')];

        // ARIA wiring
        this.#btns.forEach(btn => {
            const panelId = btn.dataset.target;
            const panel = this.querySelector('#' + panelId);
            if (!panel) return;
            btn.setAttribute('aria-controls', panelId);
            btn.setAttribute('aria-selected', 'false');
            btn.setAttribute('tabindex', '-1');
            if (!btn.id) btn.id = panelId + '-tab';
            panel.setAttribute('aria-labelledby', btn.id);
            panel.hidden = true;
        });

        // Event listeners — tự hủy khi disconnected
        this.#btns.forEach(btn =>
            btn.addEventListener('click', () => this.#activate(btn), { signal: sig })
        );
        this.addEventListener('keydown', e => this.#onKey(e), { signal: sig });

        // Activate default tab
        const defaultId = this.dataset.default;
        const first = defaultId ?
            this.#btns.find(b => b.dataset.target === defaultId) :
            this.#btns[0];
        if (first) this.#activate(first);
    }

    disconnectedCallback() {
        this.#abort ?.abort();
        this.#abort = null;
    }

    activateTab(target) { 
        const btn = typeof target === 'number' ?
            this.#btns[target] :
            this.#btns.find(b => b.dataset.target === target);
        if (btn) this.#activate(btn);
    }

    get activeIndex() {
        return this.#btns.findIndex(b => b.getAttribute('aria-selected') === 'true');
    }

    get activePanel() { return this.#active; }

    // ── Private ─────────────────────────────────────────────

    #activate(btn) {
        const panelId = btn.dataset.target;
        const panel = this.querySelector('#' + panelId);
        if (!panel || panel === this.#active) return;

        this.#btns.forEach(b => {
            const on = b === btn;
            b.setAttribute('aria-selected', String(on));
            b.setAttribute('tabindex', on ? '0' : '-1');
        });
        this.#panels.forEach(p => { p.hidden = p !== panel; });
        this.#active = panel;

        this.dispatchEvent(new CustomEvent('tab-change', {
            bubbles: true,
            composed: true,
            detail: {
                tabId: panelId,
                index: this.activeIndex,
                sourceId: this.id || this.dataset.id || '',
            },
        }));
    }

    #onKey(e) {
        const idx = this.#btns.indexOf(document.activeElement);
        if (idx === -1) return;
        const len = this.#btns.length;
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 };
        let next = -1;
        if (e.key in delta) next = (idx + delta[e.key] + len) % len;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = len - 1;
        else return;
        e.preventDefault();
        this.#btns[next].focus();
        this.#activate(this.#btns[next]);
    }
}

class SwiperComponent extends HTMLElement {
  #swiper   = null;
  #observer = null;  // MutationObserver để watch data-* attribute thay đổi

  connectedCallback() {
    if (typeof Swiper === 'undefined') {
      console.warn('[SwiperComponent] Swiper.js chưa được load.');
      return;
    }
    this.#init();
    this.#watchAttributes();
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#destroy();
  }

  // ── Public API ──────────────────────────────────────────

  get swiper() { return this.#swiper; }

  next()        { this.#swiper?.slideNext(); }
  prev()        { this.#swiper?.slidePrev(); }
  goTo(index)   { this.#swiper?.slideTo(index); }

  // ── Private ─────────────────────────────────────────────

  #init() {
    const el = this.querySelector('.swiper');
    if (!el) {
      console.warn('[SwiperComponent] Không tìm thấy .swiper bên trong.');
      return;
    }

    const ds = this.dataset;

    this.#swiper = new Swiper(el, {
      speed:         1500,           // transition speed (cố định)
      loop:          this.#bool(ds.loop, true),
      slidesPerView: ds.items || 1,
      spaceBetween:  this.#int(ds.margin, 0),

      autoplay: this.#bool(ds.autoplay, false)
        ? { delay: this.#int(ds.speed, 3000), disableOnInteraction: false }
        : false,

      pagination: this.#buildPagination(),
      navigation: this.#buildNavigation(),

      breakpoints: {
        0:   { slidesPerView: ds.xs || ds.items || 1, spaceBetween: this.#int(ds.xsMargin || ds.margin, 0) },
        768: { slidesPerView: ds.sm || ds.items || 1, spaceBetween: this.#int(ds.smMargin || ds.margin, 0) },
        992: { slidesPerView: ds.md || ds.items || 1, spaceBetween: this.#int(ds.mdMargin || ds.margin, 0) },
      },
    });

    this.dispatchEvent(new CustomEvent('swiper-ready', {
      bubbles: true,
      composed: true,
      detail: { swiper: this.#swiper },
    }));
  }

  #destroy() {
    this.#swiper?.destroy(true, true);
    this.#swiper = null;
  }

  // MutationObserver để watch data-* attributes (observedAttributes không hỗ trợ data-*)
  #watchAttributes() {
    this.#observer = new MutationObserver(mutations => {
      const changed = mutations.some(m => m.type === 'attributes');
      if (!changed || !this.#swiper) return;
      this.#destroy();
      this.#init();
    });

    this.#observer.observe(this, {
      attributes: true,
      attributeFilter: [
        'data-items', 'data-xs', 'data-sm', 'data-md',
        'data-margin', 'data-xs-margin', 'data-sm-margin', 'data-md-margin',
        'data-loop', 'data-autoplay', 'data-speed',
        'data-dots', 'data-nav',
      ],
    });
  }

  #buildPagination() {
    if (!this.#bool(this.dataset.dots, false)) return false;
    const el = this.querySelector('.swiper-pagination');
    return el ? { el, clickable: true } : false;
  }

  #buildNavigation() {
    if (!this.#bool(this.dataset.nav, false)) return false;
    const next = this.querySelector('.swiper-button-next');
    const prev = this.querySelector('.swiper-button-prev');
    return next && prev ? { nextEl: next, prevEl: prev } : false;
  }

  // ── Helpers ─────────────────────────────────────────────

  #bool(val, fallback) {
    if (val === undefined || val === null) return fallback;
    return val !== 'false';
  }

  #int(val, fallback) {
    const n = parseInt(val);
    return isNaN(n) ? fallback : n;
  }
}

/**
 * MediaProgress — engine điều khiển tiến trình media (DÙNG CHUNG)
 * ───────────────────────────────────────────────────────────────
 * Không phụ thuộc swiper. Lo toàn bộ logic timing + play/pause cho:
 *   • image   → đếm theo duration (ms)
 *   • mp4      → video.duration, sync theo currentTime, hết → complete
 *   • youtube  → YT IFrame API: getDuration()/getCurrentTime(), ENDED → complete
 *
 * Dùng ở bất kỳ đâu (trong/ngoài swiper) qua callback:
 *   const mp = new MediaProgress({
 *     onProgress: p => ring.style.strokeDashoffset = C * (1 - p),
 *     onComplete: () => swiper.slideNext(),   // hoặc loop, hoặc emit...
 *   });
 *   mp.run({ type: 'video', el: videoEl });   // hoặc {type:'image', duration:5000}
 *   mp.pause(); mp.resume(); mp.toggle(); mp.stop();
 */
class MediaProgress {
  #raf       = null;
  #mode      = 'image';
  #paused    = false;
  #done      = false;
  #imageTime = 5000;       // ms cho slide ảnh / fallback
  #startTs   = 0;
  #elapsed   = 0;
  #media     = null;       // <video>
  #yt        = null;       // YT.Player
  #abort     = null;       // listener của media hiện tại
  #onProgress;
  #onComplete;

  static #ytPlayers = new WeakMap();
  static IMAGE_TIME = 5000;
  static YT_API = 'https://www.youtube.com/iframe_api';

  constructor({ onProgress, onComplete } = {}) {
    this.#onProgress = onProgress || (() => {});
    this.#onComplete = onComplete || (() => {});
  }

  // ── Public ──────────────────────────────────────────────

  get isPaused() { return this.#paused; }
  get mode()     { return this.#mode; }

  /**
   * @param {{type:'image'|'video'|'youtube', el?:Element, duration?:number}} src
   *   duration: ms (image) hoặc fallback khi video/yt lỗi
   */
  run(src) {
    this.stop();
    this.#abort  = new AbortController();
    this.#paused = false;
    this.#done   = false;
    this.#mode   = src.type;
    this.#onProgress(0);

    if (src.type === 'video')        this.#runVideo(src.el, src.duration);
    else if (src.type === 'youtube') this.#runYoutube(src.el, src.duration);
    else                             this.#runImage(src.duration);
  }

  pause() {
    if (this.#paused) return;
    this.#paused = true;
    this.#stopRaf();
    if (this.#mode === 'image')        this.#elapsed += performance.now() - this.#startTs;
    else if (this.#mode === 'video')   this.#media?.pause();
    else if (this.#mode === 'youtube') { try { this.#yt?.pauseVideo(); } catch {} }
  }

  resume() {
    if (!this.#paused) return;
    this.#paused = false;
    if (this.#mode === 'image')        { this.#startTs = performance.now(); this.#imageLoop(); }
    else if (this.#mode === 'video')   { this.#media?.play?.().catch(() => {}); this.#videoLoop(); }
    else if (this.#mode === 'youtube') { try { this.#yt?.playVideo(); } catch {} this.#ytLoop(); }
  }

  toggle() { this.#paused ? this.resume() : this.pause(); }

  stop() {
    this.#stopRaf();
    this.#abort?.abort();
    this.#abort = null;
    if (this.#media) { try { this.#media.pause(); this.#media.currentTime = 0; } catch {} }
    if (this.#yt)    { try { this.#yt.pauseVideo(); this.#yt.seekTo(0); } catch {} }
    this.#media = null;
    this.#yt    = null;
  }

  // ── IMAGE ───────────────────────────────────────────────

  #runImage(duration) {
    this.#mode      = 'image';
    this.#imageTime = duration || MediaProgress.IMAGE_TIME;
    this.#elapsed   = 0;
    this.#startTs   = performance.now();
    this.#imageLoop();
  }

  #imageLoop = () => {
    if (this.#paused) return;
    const elapsed = this.#elapsed + (performance.now() - this.#startTs);
    const p = Math.min(elapsed / this.#imageTime, 1);
    this.#onProgress(p);
    if (p >= 1) { this.#complete(); return; }
    this.#raf = requestAnimationFrame(this.#imageLoop);
  };

  // ── MP4 ─────────────────────────────────────────────────

  #runVideo(el, fallback) {
    if (!el) return this.#runImage(fallback);
    this.#media = el;
    el.muted = true;
    el.playsInline = true;
    try { el.currentTime = 0; } catch {}

    el.addEventListener('ended', () => this.#complete(), { signal: this.#abort.signal });
    el.play()
      .then(() => this.#videoLoop())
      .catch(() => this.#runImage(fallback));   // autoplay bị chặn → timer
  }

  #videoLoop = () => {
    if (this.#paused || !this.#media) return;
    const v = this.#media;
    if (v.duration) this.#onProgress(Math.min(v.currentTime / v.duration, 1));
    this.#raf = requestAnimationFrame(this.#videoLoop);
  };

  // ── YOUTUBE ─────────────────────────────────────────────

  #runYoutube(el, fallback) {
    if (!el) return this.#runImage(fallback);
    this.#loadYTApi()
      .then(() => this.#initYT(el, fallback))
      .catch(() => this.#runImage(fallback));
  }

  #initYT(iframe, fallback) {
    this.#ensureJsApi(iframe);

    const cached = MediaProgress.#ytPlayers.get(iframe);
    if (cached) {
      this.#yt = cached;
      try { cached.mute(); cached.seekTo(0); cached.playVideo(); } catch {}
      this.#ytLoop();
      return;
    }

    let ready = false;
    new YT.Player(iframe.id, {
      events: {
        onReady: (e) => {
          ready = true;
          MediaProgress.#ytPlayers.set(iframe, e.target);
          if (this.#mode !== 'youtube' || this.#abort?.signal.aborted) {
            try { e.target.pauseVideo(); } catch {}
            return;
          }
          this.#yt = e.target;
          try { e.target.mute(); e.target.playVideo(); } catch {}
          this.#ytLoop();
        },
        onStateChange: (e) => { if (e.data === YT.PlayerState.ENDED) this.#complete(); },
        onError: () => { if (this.#mode === 'youtube') this.#runImage(fallback); },
      },
    });

    setTimeout(() => {
      if (!ready && this.#mode === 'youtube' && !this.#abort?.signal.aborted) {
        this.#runImage(fallback);
      }
    }, 4000);
  }

  #ytLoop = () => {
    if (this.#paused || !this.#yt) return;
    try {
      const d = this.#yt.getDuration?.() || 0;
      const t = this.#yt.getCurrentTime?.() || 0;
      if (d) this.#onProgress(Math.min(t / d, 1));
    } catch {}
    this.#raf = requestAnimationFrame(this.#ytLoop);
  };

  #ensureJsApi(iframe) {
    if (!iframe.id) iframe.id = 'yt-' + Math.random().toString(36).slice(2, 8);
    try {
      const url = new URL(iframe.src, location.href);
      const need = { enablejsapi: '1', playsinline: '1', origin: location.origin };
      let changed = false;
      for (const [k, v] of Object.entries(need)) {
        if (!url.searchParams.get(k)) { url.searchParams.set(k, v); changed = true; }
      }
      if (changed) iframe.src = url.toString();
    } catch {}
  }

  #loadYTApi() {
    return new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) return resolve(window.YT);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      if (!document.querySelector('script[data-yt-api]')) {
        const s = document.createElement('script');
        s.src = MediaProgress.YT_API;
        s.async = true;
        s.dataset.ytApi = '1';
        s.onerror = reject;
        document.head.appendChild(s);
      }
      setTimeout(() => {
        window.YT && window.YT.Player ? resolve(window.YT) : reject(new Error('YT timeout'));
      }, 5000);
    });
  }

  // ── Helpers ─────────────────────────────────────────────

  #complete() {
    if (this.#done) return;       // tránh gọi 2 lần (ended + progress>=1)
    this.#done = true;
    this.#stopRaf();
    this.#onComplete();
  }

  #stopRaf() {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = null;
  }
}
/**
 * <media-progress> — element độc lập cho video/youtube/ảnh KHÔNG nằm trong swiper.
 * Dùng lại engine MediaProgress + UI ring giống slide-progress.
 *
 *   <media-progress data-duration="5000" data-loop>
 *     <video muted playsinline><source src="..." type="video/mp4"></video>
 *     <button type="button" class="slide-progress__btn" aria-label="Tạm dừng">
 *       <svg class="slide-progress__ring" viewBox="0 0 48 48">
 *         <circle class="slide-progress__track" cx="24" cy="24" r="21"></circle>
 *         <circle class="slide-progress__bar"   cx="24" cy="24" r="21"></circle>
 *       </svg>
 *       <span class="slide-progress__icon slide-progress__icon--pause"></span>
 *       <span class="slide-progress__icon slide-progress__icon--play"></span>
 *     </button>
 *   </media-progress>
 *
 * data-loop: tự chạy lại khi hết. Không có → dừng + bắn event 'media-complete'.
 */

/**
 * <slide-progress> — Nút processing cho hero slider (orchestrator)
 * ───────────────────────────────────────────────────────────────
 * Chỉ lo: tìm swiper, vẽ ring, nút play/pause, và CHUYỂN SLIDE.
 * Toàn bộ logic timing media (image/mp4/youtube) ủy quyền cho
 * engine dùng chung `MediaProgress` (file media-progress.js).
 *
 * ⚠️ PHẢI load media-progress.js TRƯỚC slide-progress.js.
 * ⚠️ Engine là driver auto-advance DUY NHẤT → component tự tắt
 *    autoplay built-in của Swiper khi khởi tạo (tránh chạy 2 nguồn).
 */
class SlideProgressComponent extends HTMLElement {
  #swiperEl = null;
  #swiper   = null;
  #engine   = null;
  #btn      = null;
  #bar      = null;
  #circ     = 0;
  #imageTime = 5000;
  #abort    = null;

  connectedCallback() {
    if (typeof MediaProgress === 'undefined') {
      console.warn('[slide-progress] Chưa load media-progress.js');
      return;
    }
    this.#abort = new AbortController();
    this.#imageTime = parseInt(this.dataset.imageTime) || 5000;
    this.#btn = this.querySelector('.slide-progress__btn');
    this.#bar = this.querySelector('.slide-progress__bar');

    if (!this.#btn || !this.#bar) {
      console.warn('[slide-progress] Thiếu .slide-progress__btn hoặc .slide-progress__bar');
      return;
    }

    this.#engine = new MediaProgress({
      onProgress: (p) => this.#setProgress(p),
      onComplete: () => this.#advance(),
    });

    this.#btn.addEventListener('click', () => {
      this.#engine.toggle();
      this.#syncIcon();
    }, { signal: this.#abort.signal });

    this.#bindSwiper();
  }

  disconnectedCallback() {
    this.#engine?.stop();
    this.#abort?.abort();
    this.#abort = null;
    if (this.#swiper) {
      this.#swiper.off('slideChange', this.#onSlideChange);
      this.#swiper.off('slideChangeTransitionEnd', this.#onTransitionEnd);
    }
    this.#swiper = null;
  }

  // ── Public ──────────────────────────────────────────────

  get isPaused() { return this.#engine?.isPaused ?? false; }
  pause()  { this.#engine?.pause();  this.#syncIcon(); }
  play()   { this.#engine?.resume(); this.#syncIcon(); }
  toggle() { this.#engine?.toggle(); this.#syncIcon(); }

  // ── Kết nối swiper ──────────────────────────────────────

  #bindSwiper() {
    this.#swiperEl = this.#resolveSwiperEl();
    if (this.#swiperEl?.swiper) {
      this.#onReady(this.#swiperEl.swiper);
      return;
    }
    (this.#swiperEl || document).addEventListener('swiper-ready', (e) => {
      this.#swiperEl = e.target;
      this.#onReady(e.detail.swiper);
    }, { signal: this.#abort.signal });
  }

  #resolveSwiperEl() {
    const id = this.dataset.target;
    if (id) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return this.closest('heroslider')?.querySelector('swiper-component')
        || this.previousElementSibling;
  }

  #onReady(swiper) {
    if (!swiper || this.#swiper === swiper) return;
    this.#swiper = swiper;

    // Tắt autoplay built-in của Swiper (engine là driver)
    try { if (swiper.autoplay?.running) swiper.autoplay.stop(); } catch {}

    // ★ Tôn trọng data-autoplay: "false" → KHÔNG auto-advance, ẩn ring
    const autoplay = (this.#swiperEl?.dataset.autoplay ?? 'true') !== 'false';
    if (!autoplay) {
        this.hidden = true;
        return;
    }

    this.#setupRing();
    swiper.on('slideChange', this.#onSlideChange);
    swiper.on('slideChangeTransitionEnd', this.#onTransitionEnd);

    this.hidden = false;
    this.#activate();
  }

  // ── Swiper events ───────────────────────────────────────

  #onSlideChange = () => {
    this.#engine.stop();   // dừng + reset media slide cũ
    this.#setProgress(0);
  };

  #onTransitionEnd = () => this.#activate();

  // ── Bắt đầu slide hiện tại ──────────────────────────────

  #activate() {
    if (!this.#swiper || !this.#engine) return;
    const slide = this.#swiper.slides[this.#swiper.activeIndex];
    if (!slide) return;

    const video  = slide.querySelector('video');
    const iframe = slide.querySelector('iframe');

    if (video)       this.#engine.run({ type: 'video',   el: video,  duration: this.#imageTime });
    else if (iframe) this.#engine.run({ type: 'youtube', el: iframe, duration: this.#imageTime });
    else             this.#engine.run({ type: 'image',   duration: this.#imageTime });

    this.#syncIcon();
  }

  #advance() {
    if (!this.#swiper) return;
    const before = this.#swiper.realIndex;
    this.#swiper.slideNext();
    if (this.#swiper.realIndex === before) {     // chỉ 1 slide → tự lặp
      requestAnimationFrame(() => this.#activate());
    }
  }

  // ── Ring + icon ─────────────────────────────────────────

  #setupRing() {
    const r = parseFloat(this.#bar.getAttribute('r')) || 21;
    this.#circ = 2 * Math.PI * r;
    this.#bar.style.strokeDasharray = String(this.#circ);
    this.#setProgress(0);
  }

  #setProgress(p) {
    if (this.#bar) this.#bar.style.strokeDashoffset = String(this.#circ * (1 - p));
  }

  #syncIcon() {
    this.classList.toggle('is-paused', this.isPaused);
    if (this.#btn) this.#btn.setAttribute('aria-label', this.isPaused ? 'Tiếp tục' : 'Tạm dừng');
  }
}

/* ── Kích hoạt: bỏ comment, HOẶC register trong shop-optimize.liquid ──
if (!customElements.get('slide-progress')) {
  customElements.define('slide-progress', SlideProgressComponent);
}
*/
class MediaProgressComponent extends HTMLElement {
  #engine = null;
  #btn    = null;
  #bar    = null;
  #circ   = 0;
  #abort  = null;

  connectedCallback() {
    this.#abort = new AbortController();
    this.#btn = this.querySelector('.slide-progress__btn');
    this.#bar = this.querySelector('.slide-progress__bar');
    this.#setupRing();

    this.#engine = new MediaProgress({
      onProgress: (p) => this.#setProgress(p),
      onComplete: () => this.#onComplete(),
    });

    this.#btn?.addEventListener('click', () => {
      this.#engine.toggle();
      this.#syncIcon();
    }, { signal: this.#abort.signal });

    this.#run();
  }

  disconnectedCallback() {
    this.#engine?.stop();
    this.#abort?.abort();
    this.#abort = null;
  }

  get isPaused() { return this.#engine?.isPaused ?? false; }
  pause()  { this.#engine?.pause();  this.#syncIcon(); }
  play()   { this.#engine?.resume(); this.#syncIcon(); }
  toggle() { this.#engine?.toggle(); this.#syncIcon(); }

  #run() {
    const video  = this.querySelector('video');
    const iframe = this.querySelector('iframe');
    if (video)       this.#engine.run({ type: 'video',   el: video });
    else if (iframe) this.#engine.run({ type: 'youtube', el: iframe });
    else             this.#engine.run({ type: 'image', duration: parseInt(this.dataset.duration) || 5000 });
    this.#syncIcon();
  }

  #onComplete() {
    if (this.hasAttribute('data-loop')) { this.#run(); return; }
    this.#setProgress(1);
    this.dispatchEvent(new CustomEvent('media-complete', { bubbles: true, composed: true }));
  }

  #setupRing() {
    if (!this.#bar) return;
    const r = parseFloat(this.#bar.getAttribute('r')) || 21;
    this.#circ = 2 * Math.PI * r;
    this.#bar.style.strokeDasharray = String(this.#circ);
    this.#setProgress(0);
  }

  #setProgress(p) {
    if (this.#bar) this.#bar.style.strokeDashoffset = String(this.#circ * (1 - p));
  }

  #syncIcon() {
    this.classList.toggle('is-paused', this.isPaused);
    if (this.#btn) this.#btn.setAttribute('aria-label', this.isPaused ? 'Tiếp tục' : 'Tạm dừng');
  }
}

/* ── Kích hoạt element độc lập (tùy chọn) ──
if (!customElements.get('media-progress')) {
  customElements.define('media-progress', MediaProgressComponent);
}
*/

/**
 * SlideContentReveal — reveal nội dung slide từ dưới lên, theo thứ tự
 *   .slide-content__title → .slide-content__desc → .slide-content__btn
 * Tự chạy lại MỖI KHI slide trở thành active (theo class
 * `.swiper-slide-active` của Swiper) ⇒ áp dụng cho cả chuyển slide.
 *
 * ⚠️ Tag <slidecontent> KHÔNG có dấu '-' nên không thể là custom element.
 *    → dùng controller class (giống BtnEffectController): quét + watch DOM.
 *
 * Animation thật nằm ở CSS (.is-revealed + stagger qua biến --reveal-i);
 * class này chỉ lo TRIGGER đúng thời điểm.
 */
class SlideContentReveal {
  static #instance = null;

  static #SELECTOR = 'slidecontent';
  static #ACTIVE   = 'swiper-slide-active';
  static #ITEMS    = '.slide-content__title, .slide-content__desc, .slide-content__btn';

  /** @type {WeakMap<Element, MutationObserver|null>} */
  #observers = new WeakMap();
  /** @type {WeakMap<Element, boolean>} trạng thái active trước đó */
  #wasActive = new WeakMap();
  #domObserver = null;

  static init() {
    if (!this.#instance) this.#instance = new SlideContentReveal();
    return this.#instance;
  }

  constructor() {
    this.#scan(document.body);
    this.#watchDom();
  }

  // ── Public API ──────────────────────────────────────────

  reveal(el) { this.#reveal(el); }
  reset(el)  { el.classList.remove('is-revealed'); }

  // ── Watch DOM (slide 2-5 + clone loop được chèn sau) ────

  #watchDom() {
    this.#domObserver = new MutationObserver(muts => {
      for (const m of muts) {
        m.addedNodes.forEach(n => this.#handleAdded(n));
        m.removedNodes.forEach(n => this.#handleRemoved(n));
      }
    });
    this.#domObserver.observe(document.body, { childList: true, subtree: true });
  }

  #handleAdded(node) {
    if (node.nodeType !== 1) return;
    if (node.matches?.(SlideContentReveal.#SELECTOR)) this.#attach(node);
    node.querySelectorAll?.(SlideContentReveal.#SELECTOR).forEach(el => this.#attach(el));
  }

  #handleRemoved(node) {
    if (node.nodeType !== 1) return;
    if (node.matches?.(SlideContentReveal.#SELECTOR)) this.#detach(node);
    node.querySelectorAll?.(SlideContentReveal.#SELECTOR).forEach(el => this.#detach(el));
  }

  #scan(root) {
    root.querySelectorAll(SlideContentReveal.#SELECTOR).forEach(el => this.#attach(el));
  }

  // ── Attach / detach ─────────────────────────────────────

  #attach(el) {
    if (this.#observers.has(el)) return;

    // Đánh index cho stagger — chỉ tính item thật sự có (title/desc/btn
    // có thể bị ẩn nếu setting để trống) ⇒ delay luôn liên tục.
    el.querySelectorAll(SlideContentReveal.#ITEMS)
      .forEach((it, i) => it.style.setProperty('--reveal-i', i+1));

    const slide = el.closest('.swiper-slide');

    // Ngoài swiper → hiện luôn 1 lần
    if (!slide) {
      this.#reveal(el);
      this.#observers.set(el, null);
      return;
    }

    const active = slide.classList.contains(SlideContentReveal.#ACTIVE);
    this.#wasActive.set(el, active);
    if (active) this.#reveal(el);

    // Swiper đổi nhiều class (active/next/prev/visible) → chỉ chạy khi
    // CHUYỂN sang active (false → true), tránh restart animation thừa.
    const obs = new MutationObserver(() => {
      const now = slide.classList.contains(SlideContentReveal.#ACTIVE);
      const was = this.#wasActive.get(el) === true;
      if (now && !was) this.#reveal(el);
      this.#wasActive.set(el, now);
      // KHÔNG reset khi rời active: để chữ không biến mất lúc đang trượt ra.
      // Lần active kế tiếp sẽ re-arm trong #reveal().
    });
    obs.observe(slide, { attributes: true, attributeFilter: ['class'] });
    this.#observers.set(el, obs);
  }

  #detach(el) {
    this.#observers.get(el)?.disconnect();
    this.#observers.delete(el);
    this.#wasActive.delete(el);
  }

  // ── Reveal ──────────────────────────────────────────────

  #reveal(el) {
    el.classList.remove('is-revealed');   // re-arm về trạng thái ẩn (tức thì)
    void el.offsetWidth;                   // ép reflow → animation chạy lại
    el.classList.add('is-revealed');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SlideContentReveal.init());
} else {
  SlideContentReveal.init();
}

class ExpandDescriptionComponent extends HTMLElement {
  #abort   = null;
  #body    = null;
  #btn     = null;
  #label   = null;
  #maxH    = null;  // resolved trong connectedCallback từ static defaultMaxHeight
  #isOpen  = false;
 
  // ── Static defaults — override khi define ──────────────
  // Ưu tiên: data-max-height (HTML) > defaultMaxHeight > 220 (fallback)
  static defaultMaxHeight = 220;
  static moreTxt          = 'Xem thêm';
  static lessTxt          = 'Rút gọn';
 
  connectedCallback() {
    this.#abort = new AbortController();
    const sig   = this.#abort.signal;
 
    this.#body  = this.querySelector('.js-ed-body');
    this.#btn   = this.querySelector('.js-ed-btn');
    this.#label = this.querySelector('.js-ed-btn-text');
 
    // data-max-height trên HTML override defaultMaxHeight
    this.#maxH  = parseInt(this.dataset.maxHeight) || ExpandDescriptionComponent.defaultMaxHeight;
 
    if (!this.#body || !this.#btn || !this.#label) {
      console.warn('[ExpandDescriptionComponent] Thiếu .js-ed-body / .js-ed-btn / .js-ed-btn-text');
      return;
    }
 
    // Chờ ảnh/font load xong mới đo scrollHeight cho chính xác
    requestAnimationFrame(() => this.#setup(sig));
  }
 
  disconnectedCallback() {
    this.#abort?.abort();
    this.#abort = null;
  }
 
  // ── Public API ──────────────────────────────
 
  open()   { if (!this.#isOpen) this.#toggle(); }
  close()  { if (this.#isOpen)  this.#toggle(); }
  toggle() { this.#toggle(); }
 
  get isOpen() { return this.#isOpen; }
 
  // ── Private ─────────────────────────────────
 
  #setup(sig) {
    // Nội dung ngắn hơn maxHeight → ẩn button, không cần expand
    if (this.#body.scrollHeight <= this.#maxH) {
      this.#body.style.height = 'auto';
      this.#btn.hidden = true;
      return;
    }
 
    this.#body.style.height = this.#maxH + 'px';
    this.#label.textContent = ExpandDescriptionComponent.moreTxt;
 
    this.#btn.addEventListener('click', () => this.#toggle(), { signal: sig });
  }
 
  #toggle() {
    this.#isOpen = !this.#isOpen;
 
    this.#body.style.height = (this.#isOpen
      ? this.#body.scrollHeight
      : this.#maxH
    ) + 'px';
 
    this.classList.toggle('is-open', this.#isOpen);
    this.#label.textContent = this.#isOpen
      ? ExpandDescriptionComponent.lessTxt
      : ExpandDescriptionComponent.moreTxt;
 
    this.dispatchEvent(new CustomEvent('expand-change', {
      bubbles: true,
      composed: true,
      detail: { isOpen: this.#isOpen },
    }));
  }
}

class CountDownComponent extends HTMLElement {
  #timer   = null;
  #els     = {};
  #end     = 0;
 
  // pad "9" → "09"
  static #pad(n) { return String(Math.floor(n)).padStart(2, '0'); }
 
  connectedCallback() {
    const box = this.querySelector('.box-countdown');
    if (!box) {
      console.warn('[CountDownComponent] Thiếu .box-countdown bên trong.');
      return;
    }
 
    this.#end = new Date(box.dataset.time).getTime();
    if (isNaN(this.#end)) {
      console.warn('[CountDownComponent] data-time không hợp lệ:', box.dataset.time);
      return;
    }
 
    this.#els = {
      days:    box.querySelector('.days'),
      hours:   box.querySelector('.hours'),
      minutes: box.querySelector('.minutes'),
      seconds: box.querySelector('.seconds'),
    };
 
    this.#tick();                            // render ngay, không chờ 1s
    this.#timer = setInterval(() => this.#tick(), 1000);
  }
 
  disconnectedCallback() {
    this.#stop();
  }
 
  // ── Public API ──────────────────────────────
 
  stop()  { this.#stop(); }
  start() {
    if (this.#timer) return;   // đang chạy rồi
    this.#tick();
    this.#timer = setInterval(() => this.#tick(), 1000);
  }
 
  /** ms còn lại, -1 nếu đã hết */
  get remaining() {
    const d = this.#end - Date.now();
    return d > 0 ? d : -1;
  }
 
  get isExpired() { return this.remaining === -1; }
 
  // ── Private ─────────────────────────────────
 
  #tick() {
    const d = this.#end - Date.now();
 
    if (d < 0) {
      this.#setAll('00');
      this.#stop();
      this.classList.add('is-expired');
      this.dispatchEvent(new CustomEvent('countdown-expired', {
        bubbles: true, composed: true,
      }));
      return;
    }
 
    const pad = CountDownComponent.#pad;
    if (this.#els.days)    this.#els.days.textContent    = pad(d / 86400000);
    if (this.#els.hours)   this.#els.hours.textContent   = pad((d % 86400000) / 3600000);
    if (this.#els.minutes) this.#els.minutes.textContent = pad((d % 3600000)  / 60000);
    if (this.#els.seconds) this.#els.seconds.textContent = pad((d % 60000)    / 1000);
  }
 
  #stop() {
    clearInterval(this.#timer);
    this.#timer = null;
  }
 
  #setAll(val) {
    Object.values(this.#els).forEach(el => { if (el) el.textContent = val; });
  }
}

