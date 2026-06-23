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
    if (this.#controllers.has(el)) return;
 
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

        this.#btns.forEach(btn =>
            btn.addEventListener('click', () => this.#activate(btn), { signal: sig })
        );
        this.addEventListener('keydown', e => this.#onKey(e), { signal: sig });

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
  #observer = null;

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

  get swiper() { return this.#swiper; }

  next()        { this.#swiper?.slideNext(); }
  prev()        { this.#swiper?.slidePrev(); }
  goTo(index)   { this.#swiper?.slideTo(index); }

  #init() {
    const el = this.querySelector('.swiper');
    if (!el) {
      console.warn('[SwiperComponent] Không tìm thấy .swiper bên trong.');
      return;
    }

    const ds = this.dataset;

    this.#swiper = new Swiper(el, {
      speed:         1500,
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

    // Nếu chỉ có 1 slide thật → destroy swiper (không cần chuyển slide)
    // Đánh dấu data-single="1" để slide-progress detect được dù connect sau
    // rồi dispatch swiper-single để slide-progress chạy ring mp4/youtube
    const realSlides = el.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)');
    if (realSlides.length <= 1) {
      this.#destroy();
      this.dataset.single = '1';
      this.dispatchEvent(new CustomEvent('swiper-single', {
        bubbles: true,
        composed: true,
        detail: { slide: realSlides[0] || el.querySelector('.swiper-slide') },
      }));
      return;
    }

    // Strip iframe khỏi clone slide để tránh duplicate player.
    // Swiper cloneNode(true) copy luôn iframe đã inject → clone có iframe thừa
    // → YT.Player nhầm target → lỗi / delay khi chuyển slide.
    // Dùng loopCreate event (fire sau mỗi lần Swiper tạo/rebuild clone).
    const stripCloneIframes = () => {
      el.querySelectorAll('.swiper-slide-duplicate slide-youtube').forEach(ytEl => {
        ytEl.innerHTML = '';
      });
    };
    stripCloneIframes();
    this.#swiper.on('loopCreate', stripCloneIframes);
    this.#swiper.on('slidesUpdated', stripCloneIframes);

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

  #bool(val, fallback) {
    if (val === undefined || val === null) return fallback;
    return val !== 'false';
  }

  #int(val, fallback) {
    const n = parseInt(val);
    return isNaN(n) ? fallback : n;
  }
}

class SlideContentReveal {
  static #instance = null;

  static #SELECTOR = 'slidecontent';
  static #ACTIVE   = 'swiper-slide-active';
  static #ITEMS    = '.slide-content__title, .slide-content__desc, .slide-content__btn';

  #observers = new WeakMap();
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

  reveal(el) { this.#reveal(el); }
  reset(el)  { el.classList.remove('is-revealed'); }

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

  #attach(el) {
    if (this.#observers.has(el)) return;

    el.querySelectorAll(SlideContentReveal.#ITEMS)
      .forEach((it, i) => it.style.setProperty('--reveal-i', i+1));

    const slide = el.closest('.swiper-slide');

    if (!slide) {
      this.#reveal(el);
      this.#observers.set(el, null);
      return;
    }

    const active = slide.classList.contains(SlideContentReveal.#ACTIVE);
    this.#wasActive.set(el, active);
    if (active) this.#reveal(el);

    const obs = new MutationObserver(() => {
      const now = slide.classList.contains(SlideContentReveal.#ACTIVE);
      const was = this.#wasActive.get(el) === true;
      if (now && !was) this.#reveal(el);
      this.#wasActive.set(el, now);
    });
    obs.observe(slide, { attributes: true, attributeFilter: ['class'] });
    this.#observers.set(el, obs);
  }

  #detach(el) {
    this.#observers.get(el)?.disconnect();
    this.#observers.delete(el);
    this.#wasActive.delete(el);
  }

  #reveal(el) {
    el.classList.remove('is-revealed');
    void el.offsetWidth;
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
  #maxH    = null;
  #isOpen  = false;
 
  static defaultMaxHeight = 220;
  static moreTxt          = 'Xem thêm';
  static lessTxt          = 'Rút gọn';
 
  connectedCallback() {
    this.#abort = new AbortController();
    const sig   = this.#abort.signal;
 
    this.#body  = this.querySelector('.js-ed-body');
    this.#btn   = this.querySelector('.js-ed-btn');
    this.#label = this.querySelector('.js-ed-btn-text');
 
    this.#maxH  = parseInt(this.dataset.maxHeight) || ExpandDescriptionComponent.defaultMaxHeight;
 
    if (!this.#body || !this.#btn || !this.#label) {
      console.warn('[ExpandDescriptionComponent] Thiếu .js-ed-body / .js-ed-btn / .js-ed-btn-text');
      return;
    }
 
    requestAnimationFrame(() => this.#setup(sig));
  }
 
  disconnectedCallback() {
    this.#abort?.abort();
    this.#abort = null;
  }
 
  open()   { if (!this.#isOpen) this.#toggle(); }
  close()  { if (this.#isOpen)  this.#toggle(); }
  toggle() { this.#toggle(); }
 
  get isOpen() { return this.#isOpen; }
 
  #setup(sig) {
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
 
    this.#tick();
    this.#timer = setInterval(() => this.#tick(), 1000);
  }
 
  disconnectedCallback() {
    this.#stop();
  }
 
  stop()  { this.#stop(); }
  start() {
    if (this.#timer) return;
    this.#tick();
    this.#timer = setInterval(() => this.#tick(), 1000);
  }
 
  get remaining() {
    const d = this.#end - Date.now();
    return d > 0 ? d : -1;
  }
 
  get isExpired() { return this.remaining === -1; }
 
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
