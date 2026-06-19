# `<slide-progress>` + engine `MediaProgress`

Nút processing (ring + play/pause) cho hero slider. Tách 2 phần để tái sử dụng:

| File | Vai trò |
|---|---|
| `media-progress.js` | Engine `MediaProgress` (image/mp4/youtube timing + play/pause) **+** element độc lập `<media-progress>` cho video ngoài swiper |
| `slide-progress.js` | `<slide-progress>` — orchestrator cho swiper (tìm swiper, vẽ ring, chuyển slide), ủy quyền timing cho engine |

| Loại slide | Nguồn thời lượng | Hết → |
|---|---|---|
| image | `data-image-time` (ms) | `slideNext()` |
| mp4 | `video.duration` | event `ended` |
| youtube | YT API `getDuration()` | state `ENDED` |

> ⚠️ Engine là **driver auto-advance duy nhất**. Component tự gọi `swiper.autoplay.stop()` khi init, nên dù slider có bật autoplay thì cũng không chạy 2 nguồn nữa. Vẫn nên giữ `data-autoplay="false"`.

---

## Các lỗi đã sửa (so với bản đầu)

1. **Pause không thực sự dừng autoplay** → `#onReady` ép `swiper.autoplay.stop()`.
2. **Icon không đổi pause→play** → host `<slide-progress>` không có class `slide-progress`. CSS đổi sang **selector theo tag** (`slide-progress.is-paused`), không cần thêm class.
3. **Timing pause/resume** → engine giữ `elapsed`, resume tính từ thời điểm mới ⇒ đúng phần còn lại.
4. **Tái sử dụng ngoài swiper** → engine `MediaProgress` + element `<media-progress>`.

---

## 1) Thứ tự load script

```liquid
<script src="{{ 'media-progress.js' | asset_url }}" defer></script>   <!-- TRƯỚC -->
<script src="{{ 'slide-progress.js' | asset_url }}" defer></script>   <!-- SAU  -->
```

## 2) Đăng ký trong `snippets/shop-optimize.liquid` (trong `mainSlider()`, sau define swiper)

```js
if (!customElements.get('swiper-component')) {
  customElements.define('swiper-component', SwiperComponent);
}
if (!customElements.get('slide-progress')) {
  customElements.define('slide-progress', SlideProgressComponent);
}
// nếu dùng cả element độc lập:
if (!customElements.get('media-progress')) {
  customElements.define('media-progress', MediaProgressComponent);
}
```

## 3) HTML trong `home-slider.liquid` (thêm `id` cho swiper + `<slide-progress>` trong `<heroslider>`)

```liquid
<heroslider hero-color>
    <swiper-component
        id="hero-swiper"
        data-items="1" data-xs="1" data-sm="1" data-md="1"
        data-margin="24" data-loop="true"
        data-autoplay="false"
        data-speed="{{ settings.slide_interval | default: 5 | times: 1000 }}"
        data-dots="true" data-nav="true">
        <div class="swiper"><div class="swiper-wrapper">{{slide_1_item}}</div></div>
    </swiper-component>

    <slide-progress
        data-target="hero-swiper"
        data-image-time="{{ settings.slide_interval | default: 5 | times: 1000 }}"
        hidden>
        <button type="button" class="slide-progress__btn" aria-label="Tạm dừng">
            <svg class="slide-progress__ring" viewBox="0 0 48 48" aria-hidden="true">
                <circle class="slide-progress__track" cx="24" cy="24" r="21"></circle>
                <circle class="slide-progress__bar"   cx="24" cy="24" r="21"></circle>
            </svg>
            <span class="slide-progress__icon slide-progress__icon--pause" aria-hidden="true"></span>
            <span class="slide-progress__icon slide-progress__icon--play"  aria-hidden="true"></span>
        </button>
    </slide-progress>
</heroslider>
```

## 4) CSS (selector theo tag — KHÔNG cần class trên host)

```css
heroslider { position: relative; display: block; }

slide-progress,
media-progress {
    position: absolute;
    right: 24px; bottom: 24px;
    z-index: 5;
    width: 48px; height: 48px;
    --sp-color: var(--color-hero-text, #fff);
}
slide-progress[hidden] { display: none; }

.slide-progress__btn {
    position: relative;
    display: grid; place-items: center;
    width: 100%; height: 100%;
    padding: 0; border: 0; border-radius: 50%;
    background: rgba(0,0,0,.25);
    backdrop-filter: blur(2px);
    cursor: pointer;
}
.slide-progress__ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.slide-progress__track { fill: none; stroke: color-mix(in srgb, var(--sp-color) 35%, transparent); stroke-width: 2; }
.slide-progress__bar   { fill: none; stroke: var(--sp-color); stroke-width: 2; stroke-linecap: round; transition: stroke-dashoffset 80ms linear; }

.slide-progress__icon { position: absolute; }
.slide-progress__icon--pause {
    width: 9px; height: 9px;
    border-left: 3px solid var(--sp-color);
    border-right: 3px solid var(--sp-color);
}
.slide-progress__icon--play {
    width: 0; height: 0;
    border-left: 9px solid var(--sp-color);
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    margin-left: 3px;
    display: none;
}
/* Đổi icon dựa trên state của host (tag selector, không cần class) */
slide-progress.is-paused .slide-progress__icon--pause,
media-progress.is-paused .slide-progress__icon--pause { display: none; }
slide-progress.is-paused .slide-progress__icon--play,
media-progress.is-paused .slide-progress__icon--play  { display: block; }
```

---

## Dùng độc lập ngoài swiper — `<media-progress>`

Cho video/youtube hero đứng riêng (không trong slider). Cùng UI ring + nút.

```html
<!-- mp4, tự lặp -->
<media-progress data-loop>
  <video muted playsinline><source src="/path/video.mp4" type="video/mp4"></video>
  <button type="button" class="slide-progress__btn" aria-label="Tạm dừng">
    <svg class="slide-progress__ring" viewBox="0 0 48 48">
      <circle class="slide-progress__track" cx="24" cy="24" r="21"></circle>
      <circle class="slide-progress__bar"   cx="24" cy="24" r="21"></circle>
    </svg>
    <span class="slide-progress__icon slide-progress__icon--pause"></span>
    <span class="slide-progress__icon slide-progress__icon--play"></span>
  </button>
</media-progress>

<!-- youtube -->
<media-progress>
  <iframe src="https://www.youtube.com/embed/VIDEO_ID" allowfullscreen></iframe>
  ... (button giống trên) ...
</media-progress>
```

- `data-loop`: hết thì chạy lại. Không có → dừng ở 100% và bắn event `media-complete`.
- `data-duration` (ms): chỉ dùng khi không có video/iframe (ring đếm thời gian).

### Hoặc dùng engine trực tiếp (tự vẽ ring riêng)

```js
const C = 2 * Math.PI * 21;
const bar = document.querySelector('.my-ring');
const mp = new MediaProgress({
  onProgress: p => bar.style.strokeDashoffset = C * (1 - p),
  onComplete: () => console.log('xong'),
});
mp.run({ type: 'video', el: document.querySelector('video') });
// mp.pause(); mp.resume(); mp.toggle(); mp.stop();
```

## API (chung)

| | |
|---|---|
| `el.toggle()` / `pause()` / `play()` | điều khiển |
| `el.isPaused` | trạng thái |
| event `progress-toggle` (slide-progress) | `{ paused, mode }` |
| event `media-complete` (media-progress, không loop) | khi hết |

## Lưu ý

- `shop-optimize.liquid` đang đặt `class="swiper-slide {{slider_1_type}}"` cho mọi slide 2-5 (nên dùng `settings[type]`). Việc phát hiện loại slide **không dựa class** (dò `<video>`/`<iframe>`) nên vẫn đúng.
- Video youtube/mp4 chạy **muted** để autoplay được; nút pause cho dừng.
- Có fallback timer (`data-image-time`) nếu video/API lỗi → slider không kẹt.