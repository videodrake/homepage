/* ============================================================================
   join_agreement.js — Agreement page V-chevron toggle + diagnostic logging
   ============================================================================
   사용자 보고: 회원가입 → 약관동의 페이지 V 셰브론 토글 안 됨.
   원본은 10줄 stub. 진단용 로깅 + 방어적 바인딩 + 이벤트 위임(delegation)으로
   업그레이드. 콘솔에 'AGREE TOGGLE'로 시작하는 로그 남김.
   ============================================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function bind() {
    var toggles = document.querySelectorAll('.btnToggle');
    console.log('[AGREE TOGGLE] init — found', toggles.length, '.btnToggle elements');

    // Direct bind (primary path)
    toggles.forEach(function (toggle) {
      toggle.addEventListener('click', function (event) {
        var parent = toggle.closest('.agreeArea');
        console.log('[AGREE TOGGLE] click — parent:', parent, 'has .on?', parent && parent.classList.contains('on'));
        if (!parent) {
          console.warn('[AGREE TOGGLE] no .agreeArea ancestor — toggle aborted');
          return;
        }
        parent.classList.toggle('on');
        event.preventDefault();
      });
    });

    // Event delegation fallback — catches clicks even if direct bind missed (dynamic content)
    document.addEventListener('click', function (event) {
      var toggle = event.target.closest && event.target.closest('.btnToggle');
      if (!toggle) return;
      // Only handle if direct bind didn't already (prevent double-toggle)
      if (toggle.dataset.agreeBound === '1') return;
      toggle.dataset.agreeBound = '1';
      var parent = toggle.closest('.agreeArea');
      if (!parent) return;
      console.log('[AGREE TOGGLE] delegated click — parent:', parent);
      parent.classList.toggle('on');
      event.preventDefault();
    });

    // All-agree checkbox propagation — when 전체 동의 toggled, sync individual checkboxes
    var allCheck = document.getElementById('sAgreeAllChecked');
    if (allCheck) {
      allCheck.addEventListener('change', function () {
        var checked = allCheck.checked;
        var individual = document.querySelectorAll('.agreeArea input[type="checkbox"]');
        console.log('[AGREE TOGGLE] all-agree changed →', checked, '— syncing', individual.length, 'checkboxes');
        individual.forEach(function (cb) {
          if (cb !== allCheck) cb.checked = checked;
        });
      });
    }
  }

  ready(bind);
})();
