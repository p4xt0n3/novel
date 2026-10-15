(() => {
  const root = document.documentElement;
  const userAgent = navigator.userAgent || '';
  const mobileUserAgent = Boolean(navigator.userAgentData?.mobile)
    || /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(userAgent);
  const compactTouch = window.matchMedia('(pointer: coarse) and (max-width: 900px)');

  function detectDevice() {
    const isMobile = mobileUserAgent || compactTouch.matches;
    root.classList.toggle('device-mobile', isMobile);
    root.classList.toggle('device-pc', !isMobile);
    root.dataset.device = isMobile ? 'mobile' : 'pc';
  }

  detectDevice();
  if (compactTouch.addEventListener) compactTouch.addEventListener('change', detectDevice);
  else compactTouch.addListener(detectDevice);
})();
