# TYT Fashion — Web Components

## Mục lục
- [BtnEffectComponent](#btneffectcomponent)
- [SwiperComponent](#swipercomponent)
- [TabsComponent](#tabscomponent)
- [ExpandDescriptionComponent](#expanddescriptioncomponent)
- [CountDownComponent](#countdowncomponent)


---
## BtnEffectComponent

**How to use**
```js
if (!customElements.get('btn-effect')) {
  customElements.define('btn-effect', BtnEffectComponent);
}
export { BtnEffectComponent };
```

**HTML**
```html
<!-- Dùng mặc định -->
<btn-effect>Thêm vào giỏ</btn-effect>

<!-- Tùy màu từng button qua CSS variable -->
<btn-effect style="
  --btn-color: #e74c3c;
  --btn-color-dark: #8e1a0e;
  --btn-color-text: #fff;
  --btn-color-hover-text: rgba(255,255,255,0.75);
  --btn-width: 180px;
">Mua ngay</btn-effect>

<!-- Tùy màu qua class -->
<btn-effect class="btn-primary">Xem thêm</btn-effect>
```

**CSS**
```css
/* Import hoặc paste vào style global */
@import 'btn-effect.css';

/* Override màu qua class */
btn-effect.btn-primary {
  --btn-color:            #3a7bd5;
  --btn-color-dark:       #224a80;
  --btn-color-text:       #fff;
  --btn-color-hover-text: rgba(255,255,255,0.75);
  --btn-width:            160px;
}

btn-effect.btn-danger {
  --btn-color:            #e74c3c;
  --btn-color-dark:       #8e1a0e;
  --btn-color-text:       #fff;
  --btn-color-hover-text: rgba(255,255,255,0.75);
  --btn-width:            160px;
}
```

> SCSS gốc dùng `random-color()`, `shade()`, `tint()` — bản CSS dùng
> CSS custom properties thay thế, tùy màu qua `--btn-color*` variables.

**Call**
```js
// Không có public API — effect tự chạy theo mouse
```

---

## SwiperComponent

**How to use**
```js
// Bỏ comment 3 dòng cuối trong swiper-component.js để kích hoạt:
if (!customElements.get('swiper-component')) {
  customElements.define('swiper-component', SwiperComponent);
}
export { SwiperComponent };

// Hoặc gọi từ file khác:
import './swiper-component.js';
// hoặc
import { SwiperComponent } from './swiper-component.js';
customElements.define('swiper-component', SwiperComponent);
```

**HTML**
```html
<swiper-component
  data-items="3"
  data-xs="1" data-sm="2" data-md="3"
  data-margin="24"
  data-loop="true"
  data-autoplay="true" data-speed="3000"
  data-dots="true"
  data-nav="true"
>
  <div class="swiper">
    <div class="swiper-wrapper">
      <div class="swiper-slide">...</div>
    </div>
    <div class="swiper-pagination"></div>
    <div class="swiper-button-prev"></div>
    <div class="swiper-button-next"></div>
  </div>
</swiper-component>
```

**Call**
```js
// Một instance
const el = document.querySelector('swiper-component');
el.next()        // slide tiếp theo
el.prev()        // slide trước
el.goTo(2)       // nhảy đến index
el.swiper        // → Swiper instance gốc (toàn bộ Swiper API)

// Nhiều instances — theo vị trí
const sliders = document.querySelectorAll('swiper-component');
sliders[0].next();
sliders[1].goTo(2);

// Nhiều instances — theo id (recommend)
const heroSlider    = document.querySelector('#slider-hero');
const productSlider = document.querySelector('#slider-product');
heroSlider.next();
productSlider.goTo(0);

// Event
el.addEventListener('swiper-ready', e => {
  console.log(e.detail); // { swiper: Swiper }
});
```

---

## TabsComponent

> ⚠️ Bug trong file gốc: `this.querySelector('$' + panelId)` phải là `'#' + panelId`

**How to use**
```js
// Đã có sẵn ở cuối components.js, không cần làm gì thêm:
if (!customElements.get('tabs-component')) {
  customElements.define('tabs-component', TabsComponent);
}
export { TabsComponent };
```

**HTML**
```html
<tabs-component
  id="my-tabs"
  data-default="panel-b"
>
  <div role="tablist" aria-label="Tab label">
    <button role="tab" data-target="panel-a">Tab A</button>
    <button role="tab" data-target="panel-b">Tab B</button>
    <button role="tab" data-target="panel-c">Tab C</button>
  </div>

  <div id="panel-a" role="tabpanel">Nội dung A</div>
  <div id="panel-b" role="tabpanel">Nội dung B</div>
  <div id="panel-c" role="tabpanel">Nội dung C</div>
</tabs-component>
```

> `data-target` trên button phải khớp với `id` của panel tương ứng.  
> `data-default` trên `<tabs-component>` chỉ định panel mở sẵn khi load.

**Call**
```js
const el = document.querySelector('tabs-component');

el.activateTab(0)          // kích hoạt theo index
el.activateTab('panel-b')  // kích hoạt theo panel id

el.activeIndex             // → number, index tab đang active
el.activePanel             // → HTMLElement, panel đang hiển thị

el.addEventListener('tab-change', e => {
  console.log(e.detail);
  // { tabId: 'panel-b', index: 1, sourceId: 'my-tabs' }
});
```

**Keyboard**
| Phím | Hành động |
|---|---|
| `←` `→` | Chuyển tab trái/phải |
| `↑` `↓` | Chuyển tab trên/dưới |
| `Home` | Tab đầu tiên |
| `End` | Tab cuối cùng |

---

## ExpandDescriptionComponent

**How to use**
```js
// Tùy biến defaults trước khi define
ExpandDescriptionComponent.defaultMaxHeight = 300;  // mặc định toàn project
ExpandDescriptionComponent.moreTxt          = 'Xem thêm';
ExpandDescriptionComponent.lessTxt          = 'Rút gọn';

if (!customElements.get('expand-description')) {
  customElements.define('expand-description', ExpandDescriptionComponent);
}
export { ExpandDescriptionComponent };
```

**HTML**
```html
<expand-description data-max-height="220">
  <div class="js-ed-body">
    <!-- nội dung mô tả dài -->
  </div>
  <button class="js-ed-btn">
    <span class="js-ed-btn-text"></span>
  </button>
</expand-description>
```

> `data-max-height` — chiều cao tối đa (px) trước khi collapse. Mặc định `220`.  
> Nếu nội dung ngắn hơn `data-max-height` → button tự ẩn, không cần làm gì thêm.

**Call**
```js
// Một instance
const el = document.querySelector('expand-description');
el.open()    // mở
el.close()   // đóng
el.toggle()  // toggle
el.isOpen    // → boolean

// Nhiều instances — theo id (recommend)
const descProduct = document.querySelector('#desc-product');
const descPolicy  = document.querySelector('#desc-policy');
descProduct.open();

// Event
el.addEventListener('expand-change', e => {
  console.log(e.detail); // { isOpen: true | false }
});
```

---

## CountDownComponent
 
**How to use**
```js
if (!customElements.get('count-down')) {
  customElements.define('count-down', CountDownComponent);
}
export { CountDownComponent };
```
 
**HTML**
```html
<count-down>
  <div class="box-countdown" data-time="2025-12-31T23:59:59">
    <span class="days">00</span>
    <span class="hours">00</span>
    <span class="minutes">00</span>
    <span class="seconds">00</span>
  </div>
</count-down>
```
 
> `data-time` — bất kỳ định dạng nào `new Date()` hiểu được.  
> Ví dụ: `"2025-12-31T23:59:59"`, `"2025-12-31 23:59:59"`, `"Dec 31, 2025 23:59:59"`.
 
**Call**
```js
const el = document.querySelector('count-down');
 
el.stop()           // dừng đếm
el.start()          // tiếp tục đếm (nếu đang dừng)
 
el.remaining        // → ms còn lại, -1 nếu hết giờ
el.isExpired        // → boolean
 
// Event — khi đồng hồ về 00:00:00
el.addEventListener('countdown-expired', () => {
  console.log('Hết giờ!');
});
```
 
---


