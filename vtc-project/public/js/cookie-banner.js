(function () {
  if (localStorage.getItem('cookieConsent')) return;

  var banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Consentement cookies');
  banner.innerHTML =
    '<div style="max-width:680px;display:flex;flex-direction:column;gap:.75rem">' +
      '<p style="font-size:.82rem;color:#f0ece4;line-height:1.65;margin:0">' +
        '<strong style="color:#c9a96e;display:block;margin-bottom:.25rem;font-size:.83rem;letter-spacing:.05em;text-transform:uppercase">Cookies</strong>' +
        'Nous utilisons uniquement des cookies techniques nécessaires au fonctionnement du site. Aucun cookie publicitaire ou de tracking n\'est utilisé.' +
      '</p>' +
      '<div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">' +
        '<button id="cookie-accept" style="background:#c9a96e;color:#080808;border:none;padding:.5rem 1.2rem;font-size:.78rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;font-family:inherit">Accepter</button>' +
        '<button id="cookie-decline" style="background:transparent;color:#9a9185;border:1px solid rgba(201,169,110,0.25);padding:.5rem 1.2rem;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;font-family:inherit">Continuer sans accepter</button>' +
        '<a href="/confidentialite" style="color:#9a9185;font-size:.75rem;text-decoration:underline;text-underline-offset:2px;margin-left:auto">En savoir plus</a>' +
      '</div>' +
    '</div>';

  banner.style.cssText = [
    'position:fixed',
    'bottom:0',
    'left:0',
    'right:0',
    'z-index:9999',
    'background:#111111',
    'border-top:1px solid rgba(201,169,110,0.25)',
    'padding:1.1rem 5vw',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-shadow:0 -4px 24px rgba(0,0,0,.5)',
    'animation:cbSlideUp .35s ease'
  ].join(';');

  var style = document.createElement('style');
  style.textContent = '@keyframes cbSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}';
  document.head.appendChild(style);

  function dismiss(choice) {
    localStorage.setItem('cookieConsent', choice);
    banner.style.transition = 'opacity .25s ease, transform .25s ease';
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(8px)';
    setTimeout(function () { banner.remove(); }, 280);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(banner);
    document.getElementById('cookie-accept').addEventListener('click', function () { dismiss('accepted'); });
    document.getElementById('cookie-decline').addEventListener('click', function () { dismiss('declined'); });
  });

  if (document.readyState !== 'loading') {
    document.body.appendChild(banner);
    document.getElementById('cookie-accept').addEventListener('click', function () { dismiss('accepted'); });
    document.getElementById('cookie-decline').addEventListener('click', function () { dismiss('declined'); });
  }
})();
