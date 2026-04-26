(function () {
  'use strict';

  function init() {
    if (!document.querySelector('.onroad-page')) return;

    var burger = document.getElementById('navBurger');
    var nav = document.getElementById('siteNav');
    if (burger && nav) {
      burger.addEventListener('click', function () {
        var open = nav.classList.toggle('site-header__nav--open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    var header = document.getElementById('siteHeader') || document.querySelector('.site-header');
    var bar = document.getElementById('scrollBar');

    var bhShell = document.getElementById('bhShell');
    var bhMedia = document.getElementById('bhMedia');
    var bhBg = document.getElementById('bhBgWord');

    var heroShell = document.getElementById('heroShell');
    var heroMedia = document.getElementById('heroMedia');

    var pinStage = document.getElementById('pinStage');
    var pinBg = document.getElementById('pinBg');
    var pinHead = document.getElementById('pinHeadline');
    var pinWords = pinHead ? pinHead.querySelectorAll('.w') : null;

    var showcase = document.querySelector('.showcase');
    var bottle = document.getElementById('showcaseBottle');

    var pdInfoArea = document.querySelector('.jg-product-detail-page .infoArea');

    // Smart-header: hide on scroll-down past threshold, reveal on scroll-up, always show near top
    // Threshold raised from 80 → 200 and dy threshold from 4 → 18 so that
    // small trackpad scroll wobbles don't constantly toggle the header,
    // which felt like content shaking.
    var lastScrollY = 0;
    var smartHeaderThreshold = 200;
    var smartHeaderDy = 18;
    var pdAdditional = document.querySelector('.jg-product-additional-page');
    var pdReview = document.querySelector('.pd-flow--review') || document.getElementById('prdReview') || document.getElementById('review');
    var pdQnA = document.querySelector('.pd-flow--qna') || document.getElementById('prdQnA') || document.getElementById('qna');
    var pdNoticeBlock = document.getElementById('prdInfo') || document.querySelector('.detail_guide');
    var pdFooter = document.querySelector('.site-footer') || document.querySelector('footer');
    var pdDetailArea = pdInfoArea ? pdInfoArea.parentElement : null;
    var pdDockRef = pdReview || pdAdditional;
    var pdDockReleaseRef = pdNoticeBlock || pdQnA || pdFooter;

    // Lock the detailArea grid to its pre-dock infoArea height so docking
    // (which pulls .infoArea out of flow) doesn't collapse the layout and
    // yank the scroll position. Keeps the transition silent — no animation.
    function lockDetailAreaHeight() {
      if (!pdInfoArea || !pdDetailArea) return;
      if (pdInfoArea.classList.contains('is-docked')) return;
      var h = pdInfoArea.offsetHeight;
      if (h > 0) pdDetailArea.style.minHeight = h + 'px';
    }
    lockDetailAreaHeight();
    if ('ResizeObserver' in window) {
      try { new ResizeObserver(lockDetailAreaHeight).observe(pdInfoArea); } catch(e) {}
    }
    window.addEventListener('load', lockDetailAreaHeight);

    var lightSections = [];
    function collectLightSections() {
      lightSections = [].slice.call(document.querySelectorAll(
        '.manifesto, .principles, .tl, .corp, .manifesto-map, .pf, ' +
        '[data-header-light], .section--cream, .section--paper, .showcase, ' +
        '.jr-toc, .jr-article, .jr-related, ' +
        '.rn-filter, .rn-grid, .rn-form'
      ));
    }
    collectLightSections();

    function onScroll() {
      var y = window.scrollY || window.pageYOffset;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? (y / h) : 0;
      if (bar) bar.style.width = (p * 100) + '%';

      if (header) header.classList.toggle('is-scrolled', y > 40);

      // Smart-header slide
      if (header) {
        var dy = y - lastScrollY;
        if (y < smartHeaderThreshold) {
          header.classList.remove('is-hidden-top');
        } else if (dy > smartHeaderDy) {
          header.classList.add('is-hidden-top');
        } else if (dy < -smartHeaderDy) {
          header.classList.remove('is-hidden-top');
        }
        lastScrollY = y;
      }

      if (header && lightSections.length) {
        var probe = y + header.offsetHeight + 20;
        var inv = false;
        for (var i = 0; i < lightSections.length; i++) {
          var s = lightSections[i];
          var top = s.offsetTop;
          var bottom = top + s.offsetHeight;
          if (probe >= top && probe < bottom) { inv = true; break; }
        }
        header.classList.toggle('is-inverted', inv);
      }

      if (bhShell && bhMedia) {
        var bhRect = bhShell.getBoundingClientRect();
        var bhTotal = bhShell.offsetHeight - window.innerHeight;
        var bhScrolled = Math.min(Math.max(-bhRect.top, 0), bhTotal);
        var bhT = bhTotal > 0 ? bhScrolled / bhTotal : 0;
        bhMedia.style.transform = 'scale(' + (1.02 + bhT * 0.12).toFixed(3) + ')';
        if (bhBg) bhBg.style.setProperty('--bh-x', (-bhT * 1200) + 'px');
      }

      if (heroShell && heroMedia) {
        var hRect = heroShell.getBoundingClientRect();
        var hTotal = heroShell.offsetHeight - window.innerHeight;
        var hScrolled = Math.min(Math.max(-hRect.top, 0), hTotal);
        var hT = hTotal > 0 ? hScrolled / hTotal : 0;
        heroMedia.style.transform =
          'scale(' + (1.04 + hT * 0.2).toFixed(3) + ') translateY(' + (hT * -6).toFixed(1) + '%)';
      }

      if (pinStage && pinHead) {
        var pRect = pinStage.getBoundingClientRect();
        var pTotal = pinStage.offsetHeight - window.innerHeight;
        var pScrolled = Math.min(Math.max(-pRect.top, 0), pTotal);
        var pT = pTotal > 0 ? pScrolled / pTotal : 0;
        if (pinBg) pinBg.style.setProperty('--pin-x', (-pT * 1400) + 'px');
        if (pinWords && pinWords.length) {
          var activeTo = Math.floor(pT * pinWords.length * 1.15);
          for (var j = 0; j < pinWords.length; j++) {
            if (j <= activeTo) pinWords[j].classList.add('is-active');
            else pinWords[j].classList.remove('is-active');
          }
        }
      }

      if (bottle && showcase) {
        var sRect = showcase.getBoundingClientRect();
        var sTotal = showcase.offsetHeight - window.innerHeight;
        var sScrolled = Math.min(Math.max(-sRect.top, 0), sTotal);
        var sT = sTotal > 0 ? sScrolled / sTotal : 0;
        bottle.style.setProperty('--showcase-rot', (sT * 18 - 4).toFixed(2));
        bottle.style.setProperty('--showcase-y', (Math.sin(sT * Math.PI) * -10).toFixed(1));
      }

      if (pdInfoArea && pdDockRef) {
        var dock = false;
        if (window.matchMedia('(min-width: 1024px)').matches) {
          // Engage when review heading reaches top half of viewport.
          // Release when the bottom notice block (#prdInfo, which follows
          // Q&A) starts entering the viewport — Q&A is the last section
          // where the buy panel is still useful.
          var refTop = pdDockRef.getBoundingClientRect().top + y;
          var past = y > refTop - window.innerHeight * 0.5;
          var releaseAt = pdDockReleaseRef
            ? (pdDockReleaseRef.getBoundingClientRect().top + y)
            : Infinity;
          var reachedRelease = y + window.innerHeight * 0.25 > releaseAt;
          dock = past && !reachedRelease;
        }
        pdInfoArea.classList.toggle('is-docked', dock);
        document.body.classList.toggle('has-docked-info', dock);
      }

      revealInViewport();
    }

    function revealInViewport() {
      var vh = window.innerHeight;
      var nodes = document.querySelectorAll('.reveal:not(.is-in)');
      for (var k = 0; k < nodes.length; k++) {
        var r = nodes[k].getBoundingClientRect();
        if (r.top < vh * 0.9 && r.bottom > 0) nodes[k].classList.add('is-in');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { collectLightSections(); onScroll(); });
    onScroll();

    var bhTitle = document.getElementById('bhTitle');
    if (bhTitle) setTimeout(function () { bhTitle.classList.add('is-in'); }, 200);
    var heroTitle = document.getElementById('heroTitle');
    if (heroTitle) setTimeout(function () { heroTitle.classList.add('is-in'); }, 200);

    revealInViewport();

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
      document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          var to = parseFloat(el.getAttribute('data-count-to')) || 0;
          var start = performance.now();
          var dur = 1600;
          (function tick(now) {
            var t = Math.min((now - start) / dur, 1);
            var eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(to * eased);
            if (t < 1) requestAnimationFrame(tick);
          })(performance.now());
          cio.unobserve(el);
        });
      }, { threshold: 0.4 });
      document.querySelectorAll('[data-count-to]').forEach(function (el) { cio.observe(el); });
    } else {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
      document.querySelectorAll('[data-count-to]').forEach(function (el) {
        el.textContent = el.getAttribute('data-count-to');
      });
    }

    setTimeout(function () {
      var leftover = document.querySelectorAll('.reveal:not(.is-in)');
      for (var m = 0; m < leftover.length; m++) {
        var rr = leftover[m].getBoundingClientRect();
        if (rr.top < window.innerHeight) leftover[m].classList.add('is-in');
      }
    }, 1200);

    var filters = document.querySelectorAll('.rn-filter button[data-filter]');
    var cards = document.querySelectorAll('.rn-card[data-cat]');
    if (filters.length && cards.length) {
      filters.forEach(function (b) {
        b.addEventListener('click', function () {
          filters.forEach(function (x) { x.classList.remove('is-active'); });
          b.classList.add('is-active');
          var f = b.getAttribute('data-filter');
          cards.forEach(function (c) {
            c.style.display = (f === 'all' || c.getAttribute('data-cat') === f) ? '' : 'none';
          });
        });
      });
    }

    // Guest purchase fallback: if Cafe24's {$action_nomember_order} rendered
    // empty (admin "비회원 구매 허용" off, or placeholder never replaced by
    // the skin engine), the button becomes a dead click. Route the user to
    // the basket as a usable guest entry instead. If Cafe24 did populate the
    // handler, we let it run first — this fallback only fires when neither
    // onclick nor href has a real intent.
    var guestBtn = document.querySelector('.jg-guest-purchase');
    if (guestBtn) {
      guestBtn.addEventListener('click', function (ev) {
        var href = guestBtn.getAttribute('href') || '';
        var onclickAttr = guestBtn.getAttribute('onclick') || '';
        var hasOnclick = onclickAttr.trim() && !/^\{?\$/.test(onclickAttr.trim());
        var hasHref = href && href !== '#' && href !== '#none' && !/^\{?\$/.test(href);
        if (hasOnclick || hasHref) return;
        ev.preventDefault();
        window.location.href = '/order/basket.html';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
