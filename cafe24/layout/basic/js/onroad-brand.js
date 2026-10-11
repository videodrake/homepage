/* Onroad navigation and product exploration. Cafe24 owns prices and all orders. */
(function () {
  'use strict';
  function init() {
    var burger = document.getElementById('navBurger');
    var nav = document.getElementById('siteNav');
    function closeMenu() {
      if (!burger || !nav) return;
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded','false');
      burger.setAttribute('aria-label','메뉴 열기');
    }
    if (burger && nav) {
      burger.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      });
      nav.addEventListener('click', function(e) { if(e.target.closest('a')) closeMenu(); });
      document.addEventListener('keydown', function(e) { if(e.key === 'Escape' && nav.classList.contains('is-open')) {closeMenu(); burger.focus();} });
      document.addEventListener('click', function(e) { if(!e.target.closest('#header')) closeMenu(); });
      window.matchMedia('(min-width:768px)').addEventListener('change',closeMenu);
    }
    var guestBtn = document.querySelector('.onroad-guest-purchase');
    if (guestBtn) guestBtn.addEventListener('click', function(e) {
      var href = guestBtn.getAttribute('href') || '';
      var handler = guestBtn.getAttribute('onclick') || '';
      if ((handler.trim() && !/^\{?\$/.test(handler.trim())) || (href && href !== '#' && href !== '#none' && !/^\{?\$/.test(href))) return;
      e.preventDefault(); window.location.href = '/order/basket.html';
    });
    // Existing editorial pages must remain readable without scroll animation.
    document.querySelectorAll('.reveal').forEach(function(el) {el.classList.add('is-in');});
    initProductExperience();
  }

  function initProductExperience() {
    if (!document.body.classList.contains('onroad-page')) return;
    var home = document.querySelector('.or-editorial');
    var product = document.querySelector('.onroad-product-detail-page');
    if (!home && !product) return;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var headerLinks = document.querySelectorAll('.or-nav a');
    headerLinks.forEach(function(link) {
      var url = new URL(link.href, window.location.origin);
      if (url.pathname === window.location.pathname && url.search === window.location.search) link.setAttribute('aria-current','page');
    });

    var dock = document.createElement('aside');
    dock.className = 'or-purchase-dock';
    dock.hidden = true;
    dock.setAttribute('aria-label','지구력코어 구매');
    dock.innerHTML = '<div class="or-purchase-dock__inner"><div class="or-purchase-dock__info"><span>지구력코어</span><span class="or-purchase-dock__meta">60정 · 60일분</span><strong class="or-purchase-dock__price"></strong></div><a><span></span><span aria-hidden="true">↗</span></a></div>';
    var dockPrice = dock.querySelector('strong');
    var dockLink = dock.querySelector('a');
    dockLink.href = product ? '#pdPurchase' : '/product/detail.html?product_no=11';
    dockLink.firstElementChild.textContent = product ? '수량 선택·구매' : '구매하기';
    document.body.appendChild(dock);
    var purchase = product ? product.querySelector('.productAction') : document.querySelector('[data-or-main-cta]');
    var footer = document.getElementById('footer');
    var queued = false;
    function updateDock() {
      queued = false;
      if (!purchase) return;
      var passed = purchase.getBoundingClientRect().bottom < 72;
      var nearFooter = footer && footer.getBoundingClientRect().top < window.innerHeight;
      var nativeBuy = product && product.querySelector('[data-onroad-action="buy"]:not(.displaynone):not(.disabled)');
      var available = !product || !!(nativeBuy && nativeBuy.getClientRects().length);
      var show = passed && !nearFooter && available;
      dock.hidden = !show;
      document.body.classList.toggle('or-has-purchase-dock',show);
    }
    function queueDock() {if (!queued) {queued = true;window.requestAnimationFrame(updateDock);}}
    window.addEventListener('scroll',queueDock,{passive:true});
    window.addEventListener('resize',queueDock,{passive:true});
    updateDock();
    if (product) dockLink.addEventListener('click',function(event) {
      event.preventDefault();
      var target = product.querySelector('#totalProducts') || purchase;
      if (target) target.scrollIntoView({behavior:reduceMotion.matches ? 'auto' : 'smooth',block:'center'});
      var quantity = product.querySelector('#totalProducts input[type="text"], #totalProducts input[type="number"]');
      if (quantity) quantity.focus({preventScroll:true});
    });

    if (home) {
      // Read public, current Cafe24 data. No member cookie or stale local price is used.
      var controller = new AbortController();
      var timeout = window.setTimeout(function(){controller.abort();},6000);
      fetch('/product/detail.html?product_no=11',{credentials:'omit',cache:'no-store',signal:controller.signal})
        .then(function(response){if (!response.ok) throw new Error('Product unavailable');return response.text();})
        .then(function(html) {
          var doc = new DOMParser().parseFromString(html,'text/html');
          var meta = doc.getElementById('onroadProductMeta');
          var price = meta ? Number(meta.getAttribute('data-product-price')) : NaN;
          if (Number.isFinite(price) && price > 0) {
            var formatted = price.toLocaleString('ko-KR') + '원';
            document.querySelectorAll('[data-or-price]').forEach(function(el){el.textContent = formatted;});
            document.querySelectorAll('[data-or-price-block]').forEach(function(el){el.hidden = false;});
            dockPrice.textContent = formatted;
          }
          var rows = Array.from(doc.querySelectorAll('.pd-spec-block tr'));
          var shipping = rows.find(function(row){var th=row.querySelector('th');return th && th.textContent.trim()==='배송비';});
          var shippingText = shipping && shipping.querySelector('td') ? shipping.querySelector('td').textContent.replace(/\s+/g,' ').trim() : '';
          if (shippingText && shippingText.length < 100 && !shippingText.includes('{$')) document.querySelector('[data-or-shipping]').textContent = '배송비 ' + shippingText;
        })
        .catch(function(){/* Existing product link remains useful when data is unavailable. */})
        .finally(function(){window.clearTimeout(timeout);queueDock();});
    }

    if (product) {
      product.querySelectorAll('.pd-spec-block tr').forEach(function(row) {
        var label = row.querySelector('th');
        if (!label) return;
        var name = label.textContent.trim();
        if (name === '상품요약정보' || name === '국내·해외배송' || name === '배송방법') row.classList.add('or-redundant-spec');
        if (name === '소비자가') row.classList.add('or-list-price');
        if (name === '판매가') row.classList.add('or-sale-price');
        if (name === '소비자가' || name === '판매가' || name === '배송비') row.classList.add('or-commerce-row');
      });
      var total = product.querySelector('.totalPrice');
      function updateTotal() {
        var amount = total && total.querySelector('em');
        dockPrice.textContent = amount && Number(amount.textContent.replace(/[^\d]/g,'')) > 0 ? amount.textContent.trim() : '';
        dockPrice.setAttribute('aria-label','상품 합계 ' + dockPrice.textContent);
      }
      if (total) new MutationObserver(updateTotal).observe(total,{childList:true,subtree:true,characterData:true});
      updateTotal();
      var gallery = product.querySelector('.listImg');
      var mainImage = product.querySelector('.RW .prdImg .thumbnail a>img');
      function prepareGallery() {
        if (!gallery) return;
        var images = Array.from(gallery.querySelectorAll('li img'));
        var labels = ['제품 정면','스튜디오 제품 사진','물과 함께 놓인 제품','러닝 트랙 위 제품'];
        var selected = Math.max(0,images.findIndex(function(img){return mainImage && mainImage.src.split('/').pop()===img.src.split('/').pop();}));
        images.forEach(function(img,i) {
          img.alt = labels[i] || '지구력코어 제품 사진 ' + (i + 1);
          img.setAttribute('role','button');img.tabIndex=0;
          img.setAttribute('aria-label',img.alt + ' 보기');
          img.setAttribute('aria-pressed',String(i===selected));
          img.parentElement.classList.toggle('is-selected',i===selected);
          if (!img.hasAttribute('data-or-keyboard')) {
            img.setAttribute('data-or-keyboard','true');
            img.addEventListener('keydown',function(event) {
              if (event.key==='Enter' || event.key===' ') {
                event.preventDefault();
                img.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));img.click();
              }
              if (event.key==='ArrowRight' || event.key==='ArrowLeft') {
                event.preventDefault();var list=Array.from(gallery.querySelectorAll('li img'));
                var next=list[(list.indexOf(img)+(event.key==='ArrowRight'?1:-1)+list.length)%list.length];next.focus();
              }
            });
          }
        });
      }
      prepareGallery();
      if (gallery) new MutationObserver(prepareGallery).observe(gallery,{childList:true,subtree:true});
      if (mainImage) new MutationObserver(prepareGallery).observe(mainImage,{attributes:true,attributeFilter:['src']});
      var sectionNav = document.querySelector('.pd-section-nav');
      if (sectionNav) {
        var links = Array.from(sectionNav.querySelectorAll('a'));
        var sections = links.map(function(link){return document.querySelector(link.getAttribute('href'));}).filter(Boolean);
        var updateSection = function() {
          var visibleSections = sections.filter(function(section){return section.getClientRects().length;});
          var current = visibleSections[0];
          visibleSections.forEach(function(section){if(section.getBoundingClientRect().top<=180) current=section;});
          links.forEach(function(link){var active=current && link.getAttribute('href')==='#'+current.id;link.classList.toggle('is-active',!!active);if(active) link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
        };
        var sectionQueued=false;
        window.addEventListener('scroll',function(){if(!sectionQueued){sectionQueued=true;window.requestAnimationFrame(function(){sectionQueued=false;updateSection();});}},{passive:true});
        sectionNav.addEventListener('click',function(event) {
          var link = event.target.closest('a');
          if (!link || !sectionNav.contains(link)) return;
          var target = document.querySelector(link.getAttribute('href'));
          if (!target || !target.getClientRects().length) return;
          event.preventDefault();
          event.stopPropagation();
          target.scrollIntoView({behavior:reduceMotion.matches ? 'auto' : 'smooth',block:'start'});
          window.history.replaceState(null,'',link.getAttribute('href'));
          window.requestAnimationFrame(updateSection);
        });
        updateSection();
      }
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
