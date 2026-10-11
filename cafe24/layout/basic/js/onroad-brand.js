/* Minimal navigation only. Cafe24 owns quantity, pricing, cart and checkout. */
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
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init); else init();
})();