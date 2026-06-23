class MediaProgress {
  #raf       = null;
  #mode      = 'image';
  #paused    = false;
  #done      = false;
  #imageTime = 5000;
  #startTs   = 0;
  #elapsed   = 0;
  #media     = null;
  #yt        = null;
  #abort     = null;
  #onProgress;
  #onComplete;

  static #ytPlayers = new WeakMap();
  static IMAGE_TIME = 5000;
  static YT_API = 'https://www.youtube.com/iframe_api';

  constructor({ onProgress, onComplete } = {}) {
    this.#onProgress = onProgress || (() => {});
    this.#onComplete = onComplete || (() => {});
  }

  get isPaused() { return this.#paused; }
  get mode()     { return this.#mode; }

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

  #runImage(duration) {
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

  #runVideo(el, fallback) {
    if (!el) return this.#runImage(fallback);
    this.#media = el;
    el.muted = true;
    el.playsInline = true;
    try { el.currentTime = 0; } catch {}
    el.addEventListener('ended', () => this.#complete(), { signal: this.#abort.signal });
    el.play().then(() => this.#videoLoop()).catch(() => this.#runImage(fallback));
  }

  #videoLoop = () => {
    if (this.#paused || !this.#media) return;
    const v = this.#media;
    if (v.duration) this.#onProgress(Math.min(v.currentTime / v.duration, 1));
    this.#raf = requestAnimationFrame(this.#videoLoop);
  };

  #runYoutube(el, fallback) {
    if (!el) return this.#runImage(fallback);
    const ytComp = el.tagName?.toLowerCase() === 'slide-youtube'
      ? el
      : el.querySelector?.('slide-youtube');
    if (ytComp) { this.#runYoutubeComp(ytComp, fallback); return; }
    this.#loadYTApi()
      .then(() => this.#initYT(el, fallback))
      .catch(() => this.#runImage(fallback));
  }

  #runYoutubeComp(comp, fallback) {
    const attach = (player) => {
      if (this.#mode !== 'youtube' || this.#abort?.signal.aborted) return;
      this.#yt = player;
      try { player.mute(); player.seekTo(0); player.playVideo(); } catch {}
      comp.addEventListener('yt-ended', () => this.#complete(), { signal: this.#abort.signal, once: true });
      this.#ytLoop();
    };
    if (comp.isReady && comp.player) {
      attach(comp.player);
    } else {
      comp.addEventListener('yt-ready', (e) => attach(e.detail.player), { signal: this.#abort.signal, once: true });
      setTimeout(() => {
        if (!this.#yt && this.#mode === 'youtube' && !this.#abort?.signal.aborted) this.#runImage(fallback);
      }, 5000);
    }
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
          if (this.#mode !== 'youtube' || this.#abort?.signal.aborted) { try { e.target.pauseVideo(); } catch {} return; }
          this.#yt = e.target;
          try { e.target.mute(); e.target.playVideo(); } catch {}
          this.#ytLoop();
        },
        onStateChange: (e) => { if (e.data === YT.PlayerState.ENDED) this.#complete(); },
        onError: () => { if (this.#mode === 'youtube') this.#runImage(fallback); },
      },
    });
    setTimeout(() => {
      if (!ready && this.#mode === 'youtube' && !this.#abort?.signal.aborted) this.#runImage(fallback);
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

  #complete() {
    if (this.#done) return;
    this.#done = true;
    this.#stopRaf();
    this.#onComplete();
  }

  #stopRaf() {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = null;
  }
}

class SlideProgressComponent extends HTMLElement {
  #swiperEl    = null;
  #swiper      = null;
  #engine      = null;
  #btn         = null;
  #bar         = null;
  #circ        = 0;
  #imageTime   = 5000;
  #abort       = null;
  #singleSlide = null;
  #userPaused  = false;
  #io          = null;

  get #autoplay() {
    return (this.#swiperEl?.dataset.autoplay ?? 'true') !== 'false';
  }

  connectedCallback() {
    if (typeof MediaProgress === 'undefined') {
      console.warn('[slide-progress] Chưa load MediaProgress class.');
      return;
    }
    this.#abort     = new AbortController();
    this.#imageTime = parseInt(this.dataset.imageTime) || 5000;
    this.#btn = this.querySelector('.slide-progress__btn');
    this.#bar = this.querySelector('.slide-progress__bar');
    if (!this.#btn || !this.#bar) return;

    this.#engine = new MediaProgress({
      onProgress: (p) => this.#setProgress(p),
      onComplete: () => this.#advance(),
    });

    this.#btn.addEventListener('click', () => {
      this.#engine.toggle();
      this.#userPaused = this.#engine.isPaused;
      this.#syncIcon();
    }, { signal: this.#abort.signal });

    this.#bindSwiper();
  }

  disconnectedCallback() {
    this.#engine?.stop();
    this.#abort?.abort();
    this.#abort = null;
    this.#io?.disconnect();
    this.#io = null;
    if (this.#swiper) {
      this.#swiper.off('slideChange', this.#onSlideChange);
      this.#swiper.off('slideChangeTransitionEnd', this.#onTransitionEnd);
    }
    this.#swiper = null;
  }

  get isPaused() { return this.#engine?.isPaused ?? false; }
  pause()  { this.#engine?.pause();  this.#userPaused = true;  this.#syncIcon(); }
  play()   { this.#engine?.resume(); this.#userPaused = false; this.#syncIcon(); }
  toggle() { this.#engine?.toggle(); this.#userPaused = this.#engine?.isPaused ?? false; this.#syncIcon(); }

  #bindSwiper() {
    this.#swiperEl = this.#resolveSwiperEl();

    if (this.#swiperEl?.swiper) { this.#onReady(this.#swiperEl.swiper); return; }

    if (this.#swiperEl?.dataset.single === '1') {
      const slide = this.#swiperEl.querySelector('.swiper-slide');
      if (slide) {
        this.#singleSlide = slide;
        this.#setupRing();
        this.#setupScrollPause();
        this.#activateSingle(slide);
        return;
      }
    }

    const listenEl = this.#swiperEl || document;
    listenEl.addEventListener('swiper-ready', (e) => {
      if (this.#swiperEl && e.target !== this.#swiperEl) return;
      this.#swiperEl = e.target;
      this.#onReady(e.detail.swiper);
    }, { signal: this.#abort.signal, once: true });

    listenEl.addEventListener('swiper-single', (e) => {
      if (this.#swiperEl && e.target !== this.#swiperEl) return;
      this.#singleSlide = e.detail.slide;
      this.#setupRing();
      this.#setupScrollPause();
      this.#activateSingle(this.#singleSlide);
    }, { signal: this.#abort.signal, once: true });
  }

  #resolveSwiperEl() {
    const id = this.dataset.target;
    if (id) {
      const el = document.getElementById(id);
      if (el && el.tagName.toLowerCase() === 'swiper-component') return el;
    }
    return this.closest('heroslider')?.querySelector('swiper-component')
        || (this.previousElementSibling?.tagName?.toLowerCase() === 'swiper-component'
              ? this.previousElementSibling : null);
  }

  #onReady(swiper) {
    if (!swiper || this.#swiper === swiper) return;
    this.#swiper = swiper;
    try { if (swiper.autoplay?.running) swiper.autoplay.stop(); } catch {}
    this.#setupRing();
    this.#setupScrollPause();
    this.#updateNavVisibility();
    swiper.on('slideChange', this.#onSlideChange);
    swiper.on('slideChangeTransitionEnd', this.#onTransitionEnd);
    this.#activate();
  }

  #setupScrollPause() {
    if (this.#io) return;
    const target = this.closest('heroslider') || this.closest('section') || this.parentElement;
    if (!target) return;
    this.#io = new IntersectionObserver(
      ([entry]) => this.#onVisibilityChange(entry.isIntersecting),
      { threshold: 0.1 }
    );
    this.#io.observe(target);
  }

  #onVisibilityChange(visible) {
    if (!this.#engine) return;
    if (visible) {
      if (!this.#userPaused) { this.#engine.resume(); this.#syncIcon(); }
    } else {
      this.#engine.pause(); this.#syncIcon();
    }
  }

  #onSlideChange = () => {
    this.#userPaused = false;
    this.#engine.stop();
    this.#setProgress(0);
  };

  #onTransitionEnd = () => this.#activate();

  #activateSingle(slide) {
    if (!slide || !this.#engine) return;
    const video  = slide.querySelector('video');
    const ytComp = slide.querySelector('slide-youtube');
    const iframe = !ytComp && slide.querySelector('iframe');
    const isYT   = ytComp || (iframe && /youtube\.com|youtu\.be/i.test(iframe.src || iframe.dataset.src || ''));
    if (video) {
      this.hidden = false;
      this.#engine.run({ type: 'video', el: video, duration: this.#imageTime });
    } else if (isYT) {
      this.hidden = false;
      this.#engine.run({ type: 'youtube', el: ytComp || iframe, duration: this.#imageTime });
    } else {
      this.hidden = true;
      return;
    }
    this.#syncIcon();
  }

  #moveYoutubeIframe(targetSlide) {
    if (!targetSlide) return;
    const targetYt = targetSlide.querySelector('slide-youtube');
    if (!targetYt) return;
    const heroslider = this.closest('heroslider');
    if (!heroslider) return;
    const existingIframe = heroslider.querySelector('slide-youtube iframe[id^="syt-"]');
    if (!existingIframe) return;
    if (existingIframe.parentElement === targetYt) return;
    targetYt.appendChild(existingIframe);
    existingIframe.style.width  = '100%';
    existingIframe.style.height = '100%';
    existingIframe.removeAttribute('width');
    existingIframe.removeAttribute('height');
  }

  #activate() {
    if (!this.#swiper || !this.#engine) return;
    const slide = this.#swiper.slides?.[this.#swiper.activeIndex];
    if (!slide) return;

    const video = slide.querySelector('video');
    if (video) {
      this.hidden = false;
      this.#engine.run({ type: 'video', el: video, duration: this.#imageTime });
      this.#syncIcon();
      return;
    }

    const isYoutubeSlide = slide.classList.contains('type_youtube') || !!slide.querySelector('slide-youtube');
    if (isYoutubeSlide) {
      this.#moveYoutubeIframe(slide);
      const ytComp = slide.querySelector('slide-youtube');
      this.hidden = false;
      this.#engine.run({ type: 'youtube', el: ytComp, duration: this.#imageTime });
      this.#syncIcon();
      return;
    }

    const iframe = slide.querySelector('iframe');
    const isYT   = iframe && /youtube\.com|youtu\.be/i.test(iframe.src || iframe.dataset.src || '');
    if (isYT) {
      this.#moveYoutubeIframe(slide);
      this.hidden = false;
      this.#engine.run({ type: 'youtube', el: iframe, duration: this.#imageTime });
      this.#syncIcon();
      return;
    }

    if (!this.#autoplay) { this.hidden = true; this.#engine.stop(); return; }
    this.hidden = false;
    this.#engine.run({ type: 'image', duration: this.#imageTime });
    this.#syncIcon();
  }

  #advance() {
    if (this.#singleSlide) { requestAnimationFrame(() => this.#activateSingle(this.#singleSlide)); return; }
    if (!this.#swiper) return;
    const before = this.#swiper.realIndex;
    this.#swiper.slideNext();
    if (this.#swiper.realIndex === before) requestAnimationFrame(() => this.#activate());
  }

  #updateNavVisibility() {
    const heroslider = this.closest('heroslider');
    if (!heroslider) return;
    const navContainer = heroslider.querySelector('.swiper-button-container');
    if (!navContainer) return;
    const realCount = heroslider.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)').length;
    if (realCount <= 1) {
      navContainer.hidden = true;
    } else {
      navContainer.hidden = false;
      requestAnimationFrame(() => navContainer.classList.add('swiper-nav-container--visible'));
    }
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

class MediaProgressComponent extends HTMLElement {
  #engine     = null;
  #btn        = null;
  #bar        = null;
  #circ       = 0;
  #abort      = null;
  #userPaused = false;
  #io         = null;

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
      this.#userPaused = this.#engine.isPaused;
      this.#syncIcon();
    }, { signal: this.#abort.signal });

    this.#run();
    if (this.dataset.scrollPause !== 'false') this.#setupScrollPause();
  }

  disconnectedCallback() {
    this.#engine?.stop();
    this.#io?.disconnect();
    this.#io = null;
    this.#abort?.abort();
    this.#abort = null;
  }

  get isPaused() { return this.#engine?.isPaused ?? false; }
  pause()  { this.#engine?.pause();  this.#userPaused = true;  this.#syncIcon(); }
  play()   { this.#engine?.resume(); this.#userPaused = false; this.#syncIcon(); }
  toggle() { this.#engine?.toggle(); this.#userPaused = this.#engine?.isPaused ?? false; this.#syncIcon(); }

  #setupScrollPause() {
    this.#io = new IntersectionObserver(([entry]) => {
      if (!this.#engine) return;
      if (entry.isIntersecting) {
        if (!this.#userPaused) { this.#engine.resume(); this.#syncIcon(); }
      } else {
        this.#engine.pause(); this.#syncIcon();
      }
    }, { threshold: 0.2 });
    this.#io.observe(this);
  }

  #run() {
    const video  = this.querySelector('video');
    const ytComp = this.querySelector('slide-youtube');
    const iframe = !ytComp && this.querySelector('iframe');
    const isYT   = ytComp || (iframe && /youtube\.com|youtu\.be/i.test(iframe.src || ''));
    if (video)     this.#engine.run({ type: 'video',   el: video });
    else if (isYT) this.#engine.run({ type: 'youtube', el: ytComp || iframe });
    else           this.#engine.run({ type: 'image',   duration: parseInt(this.dataset.duration) || 5000 });
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

class SlideYoutubeComponent extends HTMLElement {
  #player     = null;
  #ready      = false;
  #abort      = null;
  #iframeId   = null;
  #io         = null;
  #userPaused = false;
  #isClone    = false;

  static #cache   = new Map();
  static #pending = new Map();
  static #apiReady = null;

  connectedCallback() {
    this.#abort?.abort();
    this.#abort = new AbortController();
    this.#isClone = !!this.closest('.swiper-slide-duplicate');
    if (this.#isClone) {
      this.#borrowPlayer();
    } else {
      this.#initIfNeeded();
    }
  }

  disconnectedCallback() {
    this.#abort?.abort();
    this.#abort = null;
    this.#io?.disconnect();
    this.#io = null;
  }

  get player()  { return this.#player; }
  get isReady() { return this.#ready; }

  play()   { try { this.#player?.playVideo();  } catch {} }
  pause()  { try { this.#player?.pauseVideo(); } catch {} }
  mute()   { try { this.#player?.mute();       } catch {} }
  unmute() { try { this.#player?.unMute();     } catch {} }
  seekTo(s){ try { this.#player?.seekTo(s, true); } catch {} }

  getCurrentTime() {
    try { return this.#player?.getCurrentTime() || 0; } catch { return 0; }
  }

  getDuration() {
    return new Promise(resolve => {
      if (this.#ready) return resolve(this.#player?.getDuration() || 0);
      this.addEventListener('yt-ready', () => resolve(this.#player?.getDuration() || 0),
        { once: true, signal: this.#abort?.signal });
    });
  }

  #borrowPlayer() {
    const videoId = this.dataset.id;
    if (!videoId) return;
    const cached = SlideYoutubeComponent.#cache.get(videoId);
    if (cached) {
      this.#player = cached.player;
      this.#ready  = true;
      queueMicrotask(() => {
        if (this.#abort?.signal.aborted) return;
        this.dispatchEvent(new CustomEvent('yt-ready', {
          bubbles: true, composed: true,
          detail: { player: this.#player },
        }));
      });
      return;
    }
    const pending = SlideYoutubeComponent.#pending.get(videoId);
    if (pending) {
      pending.then(player => {
        if (this.#abort?.signal.aborted) return;
        this.#player = player;
        this.#ready  = true;
        this.dispatchEvent(new CustomEvent('yt-ready', {
          bubbles: true, composed: true,
          detail: { player },
        }));
      });
    }
  }

  #initIfNeeded() {
    const videoId = this.dataset.id;
    if (!videoId) { console.warn('[slide-youtube] Thiếu data-id'); return; }

    const cached = SlideYoutubeComponent.#cache.get(videoId);
    if (cached) {
      this.#player   = cached.player;
      this.#iframeId = cached.iframeId;
      this.#ready    = true;
      return;
    }

    const existing = this.querySelector('iframe[id^="syt-"]');
    if (existing) { this.#iframeId = existing.id; return; }

    const div = document.createElement('div');
    this.#iframeId = 'syt-' + Math.random().toString(36).slice(2, 8);
    div.id = this.#iframeId;
    this.appendChild(div);
    this._placeholderEl = div;

    let resolvePending;
    SlideYoutubeComponent.#pending.set(videoId, new Promise(r => { resolvePending = r; }));

    SlideYoutubeComponent.#loadApi()
      .then(() => { if (!this.#abort?.signal.aborted) this.#createPlayer(videoId, resolvePending); })
      .catch(err => console.warn('[slide-youtube] YT API lỗi:', err));
  }

  #createPlayer(videoId, resolvePending) {
    const autoplay = this.#bool('autoplay', false);
    const muted    = this.#bool('muted',    true);
    const loop     = this.#bool('loop',     false);
    const controls = this.#bool('controls', false);
    const start    = parseInt(this.dataset.start) || 0;
    const target   = this._placeholderEl || document.getElementById(this.#iframeId);

    this.#player = new YT.Player(target, {
      videoId,
      width:  '100%',
      height: '100%',
      playerVars: {
        autoplay: autoplay ? 1 : 0, mute: muted ? 1 : 0, loop: loop ? 1 : 0,
        controls: controls ? 1 : 0, playlist: loop ? videoId : undefined,
        start, rel: 0, showinfo: 0, modestbranding: 1,
        playsinline: 1, enablejsapi: 1, origin: location.origin,
      },
      events: {
        onReady: (e) => {
          if (this.#abort?.signal.aborted) return;
          this.#ready = true;
          const iframe = e.target.getIframe?.();
          if (iframe) {
            iframe.style.width  = '100%';
            iframe.style.height = '100%';
            iframe.removeAttribute('width');
            iframe.removeAttribute('height');
          }
          SlideYoutubeComponent.#cache.set(videoId, { player: this.#player, iframeId: this.#iframeId });
          resolvePending?.(this.#player);
          SlideYoutubeComponent.#pending.delete(videoId);
          this.dispatchEvent(new CustomEvent('yt-ready', {
            bubbles: true, composed: true,
            detail: { player: this.#player },
          }));
          if (autoplay && this.dataset.scrollPause !== 'false' && !this.#isInsideSlider()) {
            this.#setupScrollPause();
          }
        },
        onStateChange: (e) => this.#onState(e),
        onError:       (e) => this.#onError(e),
      },
    });
  }

  #bool(attr, fallback) {
    const v = this.dataset[attr];
    if (v === undefined) return fallback;
    return v !== 'false';
  }

  #isInsideSlider() {
    return !!(this.closest('heroslider') || this.closest('.swiper-slide') || this.closest('swiper-component'));
  }

  #setupScrollPause() {
    if (this.#io) return;
    this.#io = new IntersectionObserver(([entry]) => {
      if (!this.#player) return;
      if (entry.isIntersecting) {
        if (!this.#userPaused) try { this.#player.playVideo(); } catch {}
      } else {
        try { this.#player.pauseVideo(); } catch {}
      }
    }, { threshold: 0.3 });
    this.#io.observe(this);
    this.addEventListener('yt-state', (e) => {
      const { state } = e.detail;
      if (state === YT.PlayerState.PAUSED)  this.#userPaused = true;
      if (state === YT.PlayerState.PLAYING) this.#userPaused = false;
    }, { signal: this.#abort.signal });
  }

  #onState(e) {
    if (this.#abort?.signal.aborted) return;
    this.dispatchEvent(new CustomEvent('yt-state', { bubbles: true, composed: true, detail: { state: e.data } }));
    if (e.data === YT.PlayerState.ENDED) {
      this.dispatchEvent(new CustomEvent('yt-ended', { bubbles: true, composed: true }));
    }
  }

  #onError(e) {
    this.dispatchEvent(new CustomEvent('yt-error', { bubbles: true, composed: true, detail: { code: e.data } }));
  }

  static #loadApi() {
    if (this.#apiReady) return this.#apiReady;
    this.#apiReady = new Promise((resolve, reject) => {
      if (window.YT?.Player) return resolve();
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
      if (!document.querySelector('script[data-yt-api]')) {
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.async = true;
        s.dataset.ytApi = '1';
        s.onerror = reject;
        document.head.appendChild(s);
      }
      setTimeout(() => { window.YT?.Player ? resolve() : reject(new Error('YT API timeout')); }, 8000);
    });
    return this.#apiReady;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!customElements.get('slide-youtube')) customElements.define('slide-youtube', SlideYoutubeComponent);
  });
} else {
  if (!customElements.get('slide-youtube')) customElements.define('slide-youtube', SlideYoutubeComponent);
}