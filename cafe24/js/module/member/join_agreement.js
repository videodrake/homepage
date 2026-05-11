/* Agreement page — V chevron toggle + all-agree checkbox propagation.
   단일 직접 바인딩. 위임/플래그 로직은 더블 토글 버그 유발해서 제거. */
window.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.btnToggle').forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      var parent = toggle.closest('.agreeArea');
      if (!parent) return;
      parent.classList.toggle('on');
    });
  });

  var allCheck = document.getElementById('sAgreeAllChecked');
  if (allCheck) {
    allCheck.addEventListener('change', function () {
      var checked = allCheck.checked;
      document.querySelectorAll('.agreeArea input[type="checkbox"]').forEach(function (cb) {
        if (cb !== allCheck) cb.checked = checked;
      });
    });
  }
});
