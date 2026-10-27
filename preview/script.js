/* Arrasta AI · página pública
   As brasas da abertura e do fim; a estrada do tutorial que acende conforme a página desce, com o ponto de luz na ponta e
   o mapa preso no alto (o passo atual e a linha de progresso); os botões de copiar o link; as estrelas do GitHub; a
   esteira dos 9 modelos; a entrada suave dos blocos. ?tudo na URL acende tudo de uma vez (as capturas usam). */
(() => {
  'use strict';
  const REPO = 'luighifeodrippe/arrasta';
  const NS = 'http://www.w3.org/2000/svg';
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tudo = new URLSearchParams(location.search).has('tudo');
  if (tudo) {
    document.documentElement.classList.add('tudo');
    document.querySelectorAll('img[loading="lazy"]').forEach((im) => { im.loading = 'eager'; });
  }
  const parado = reduz || tudo;
  const limita = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const no = (tag, attrs = {}, pai) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (pai) pai.appendChild(n);
    return n;
  };
  const el = (tag, cls, pai) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (pai) pai.appendChild(n);
    return n;
  };
  // refaz o desenho quando a largura muda (a barra do navegador do celular subindo e descendo não conta)
  const naLargura = (fn) => {
    let w = innerWidth, t;
    addEventListener('resize', () => {
      if (innerWidth === w) return;
      w = innerWidth;
      clearTimeout(t);
      t = setTimeout(fn, 120);
    }, { passive: true });
  };

  // ---------------------------------------------------------------- brasas: faíscas laranja subindo
  function brasas(cv) {
    const ctx = cv.getContext('2d');
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const g = sprite.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(.16, 'rgba(255,214,190,.95)');
    rg.addColorStop(.42, 'rgba(248,64,0,.55)');
    rg.addColorStop(1, 'rgba(183,35,17,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    let w = 0, h = 0, parts = [], vivo = false, antes = 0;
    const nova = (qualquer) => ({
      x: Math.random() * w, y: qualquer ? Math.random() * h : h + 12, v: 12 + Math.random() * 34,
      s: .5 + Math.random() * 1.6, f: Math.random() * 6.28, a: .3 + Math.random() * .6, d: (Math.random() - .5) * 20,
    });
    function mede() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: innerWidth < 760 ? 30 : 60 }, () => nova(true));
    }
    function desenha(dt) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        p.y -= p.v * dt;
        p.f += dt * 2;
        p.x += Math.sin(p.f) * p.d * dt;
        if (p.y < -16) Object.assign(p, nova(false));
        ctx.globalAlpha = p.a * (.62 + .38 * Math.sin(p.f * 3.3)) * limita((h - p.y) / (h * .2)) * limita(p.y / (h * .3));
        const r = p.s * 6;
        ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
      }
    }
    function quadro(t) {
      if (!vivo) return;
      const dt = Math.min(.05, (t - antes) / 1000 || 0);
      antes = t;
      desenha(dt);
      requestAnimationFrame(quadro);
    }
    mede();
    if (parado) { desenha(0); return; }
    new IntersectionObserver(([e]) => {
      const era = vivo;
      vivo = e.isIntersecting;
      if (vivo && !era) { antes = performance.now(); requestAnimationFrame(quadro); }
    }).observe(cv);
    naLargura(mede);
  }

  // ---------------------------------------------------------------- a estrada do tutorial: acende e o ponto de luz anda na ponta
  function rota() {
    const palco = document.querySelector('.rota-palco');
    if (!palco) return () => {};
    const paradas = [...palco.querySelectorAll('.parada')];
    const svg = no('svg', { class: 'estrada', 'aria-hidden': 'true' });
    palco.prepend(svg);
    const rot = el('div', 'rota-rotulos', palco);
    rot.setAttribute('aria-hidden', 'true');
    const aqui = palco.querySelector('.aqui');
    const mapa = document.querySelector('.rota-mapa');
    const numMapa = mapa && mapa.querySelector('.mapa-n');
    const nomeMapa = mapa && mapa.querySelector('.mapa-nome');
    let trechos = [], nos = [], atual = -2;

    function trecho(d) {
      const gr = no('g', {}, svg);
      no('path', { d, class: 'e-base' }, gr);
      const luz = ['e-halo', 'e-meio', 'e-luz', 'e-nucleo'].map((c) => no('path', { d, class: c }, gr));
      const len = luz[2].getTotalLength();
      luz.forEach((p) => { p.style.strokeDasharray = `${len} ${len + 2}`; p.style.strokeDashoffset = len; });
      // amostras da altura ao longo da estrada (ela sempre desce: dá para achar o ponto pela altura)
      const ys = [];
      for (let s = 0; s <= len; s += 6) ys.push([s, luz[2].getPointAtLength(s).y]);
      ys.push([len, luz[2].getPointAtLength(len).y]);
      return { luz, len, ys, p: -1 };
    }
    function rotulo(texto, x, y, meio) {
      const r = el('span', 'rota-rotulo', rot);
      r.innerHTML = `<i>${meio ? '→' : '↓'}</i> ${texto}`;
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      // na tela grande o rótulo fica logo acima da estrada (o ponto de luz passa embaixo dele, sem cobrir a letra)
      r.style.transform = meio ? 'translate(-50%, calc(-100% - 10px))' : 'translate(0, -50%)';
      return r;
    }

    function desenha() {
      svg.textContent = '';
      rot.textContent = '';
      const box = palco.getBoundingClientRect();
      const largo = matchMedia('(min-width: 1024px)').matches;
      nos = paradas.map((li) => {
        const n = li.querySelector('.no').getBoundingClientRect(), r = li.getBoundingClientRect();
        return { x: n.left - box.left + n.width / 2, y: n.top - box.top + n.height / 2, r: n.width / 2, topo: r.top - box.top, fim: r.bottom - box.top };
      });
      trechos = paradas.slice(0, -1).map((li, i) => {
        const a = nos[i], b = nos[i + 1];
        let t;
        if (largo && Math.abs(a.x - b.x) > 4) {
          // a estrada desce ao lado do texto e cruza para o outro lado no vão entre os passos
          const yA = a.fim + 16, yB = b.topo - 16, yM = (yA + yB) / 2;
          t = trecho(`M${a.x},${a.y + a.r} L${a.x},${yA} C${a.x},${yM} ${b.x},${yM} ${b.x},${yB} L${b.x},${b.y - b.r}`);
          t.rotulo = rotulo(li.dataset.fio, (a.x + b.x) / 2, yM, true);
        } else {
          t = trecho(`M${a.x},${a.y + a.r} L${b.x},${b.y - b.r}`);
          t.rotulo = rotulo(li.dataset.fio, a.x + 20, (a.fim + b.topo) / 2, false);
        }
        return t;
      });
      atual = -2;
      atualiza();
    }

    function acende(t, p) {
      p = limita(p);
      if (Math.abs(p - t.p) < .0005) return;
      t.p = p;
      t.luz.forEach((c) => { c.style.strokeDashoffset = t.len * (1 - p); });
      t.rotulo.classList.toggle('aceso', p >= .5);
    }
    // o comprimento aceso de um trecho para uma altura da página
    function ate(t, y) {
      const ys = t.ys;
      if (y <= ys[0][1]) return 0;
      if (y >= ys[ys.length - 1][1]) return t.len;
      let lo = 0, hi = ys.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (ys[m][1] < y) lo = m; else hi = m;
      }
      const [s0, y0] = ys[lo], [s1, y1] = ys[hi];
      return s0 + (s1 - s0) * ((y - y0) / ((y1 - y0) || 1));
    }

    function atualiza() {
      const sonda = .62 * innerHeight - palco.getBoundingClientRect().top;
      let ponta = null;
      trechos.forEach((t) => {
        const s = parado ? t.len : ate(t, sonda);
        acende(t, s / t.len);
        if (s > 0 && s < t.len) ponta = t.luz[2].getPointAtLength(s);
      });
      // o passo acende quando a estrada chega nele
      let chegou = -1;
      paradas.forEach((li, i) => {
        const ok = parado || sonda >= nos[i].y - 8;
        li.classList.toggle('aceso', ok);
        if (ok) chegou = i;
      });
      if (chegou !== atual) {
        atual = chegou;
        paradas.forEach((li, i) => li.classList.toggle('agora', i === chegou));
        if (mapa) {
          const i = Math.max(0, chegou);
          if (numMapa) numMapa.textContent = `Passo ${i + 1} de ${paradas.length}`;
          if (nomeMapa) nomeMapa.textContent = paradas[i].dataset.curto;
          mapa.style.setProperty('--progresso', (i + 1) / paradas.length);
        }
      }
      // o ponto de luz só anda na estrada; parado num passo, quem brilha é o próprio número
      if (aqui) {
        aqui.classList.toggle('mostra', !!ponta && !parado);
        if (ponta) aqui.style.transform = `translate(${ponta.x}px, ${ponta.y}px) translate(0, -50%)`;
      }
    }

    let pedido = false;
    addEventListener('scroll', () => {
      if (pedido) return;
      pedido = true;
      requestAnimationFrame(() => { pedido = false; atualiza(); });
    }, { passive: true });
    naLargura(desenha);
    desenha();
    return desenha;
  }

  // ---------------------------------------------------------------- copiar o link com o pedido
  function copiar() {
    const aviso = document.querySelector('.aviso-copiado');
    let some;
    const avisa = (texto) => {
      if (!aviso) return;
      aviso.textContent = texto;
      aviso.classList.add('mostra');
      clearTimeout(some);
      some = setTimeout(() => aviso.classList.remove('mostra'), 2600);
    };
    const reserva = (texto) => {
      const area = el('textarea', '', document.body);
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
      return ok;
    };
    // data-copiar-de aponta para o elemento com o texto (o prompt completo do passo 1 é a única fonte)
    document.querySelectorAll('[data-copiar], [data-copiar-de]').forEach((b) => {
      const rotulo = b.querySelector('.copiar-texto');
      const original = rotulo ? rotulo.innerHTML : '';
      let volta;
      b.addEventListener('click', async () => {
        const fonte = b.dataset.copiarDe && document.querySelector(b.dataset.copiarDe);
        const texto = fonte ? fonte.textContent.trim() : b.dataset.copiar;
        let ok = false;
        try { await navigator.clipboard.writeText(texto); ok = true; } catch { ok = reserva(texto); }
        if (!ok) { avisa('Não deu para copiar. Selecione o link e copie à mão.'); return; }
        b.classList.add('copiado');
        if (rotulo) rotulo.textContent = 'Copiado';
        avisa('Copiado. Agora cole no ChatGPT do seu computador.');
        clearTimeout(volta);
        volta = setTimeout(() => { b.classList.remove('copiado'); if (rotulo) rotulo.innerHTML = original; }, 2400);
      });
    });
  }

  // ---------------------------------------------------------------- estrelas do repositório (some se o GitHub não responder)
  function estrelas() {
    const alvos = document.querySelectorAll('[data-estrelas]');
    if (!alvos.length || tudo) return;
    fetch(`https://api.github.com/repos/${REPO}`, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const n = d && Number(d.stargazers_count);
        if (!Number.isFinite(n) || n < 1) return;
        const texto = new Intl.NumberFormat('pt-BR', { notation: n >= 10000 ? 'compact' : 'standard' }).format(n);
        alvos.forEach((a) => { a.textContent = texto; a.hidden = false; });
      })
      .catch(() => {});
  }

  // ---------------------------------------------------------------- a esteira dos modelos dá a volta sem emenda
  function esteira() {
    const trilho = document.querySelector('.esteira-trilho');
    if (!trilho || reduz) return;
    [...trilho.children].forEach((li) => {
      const copia = li.cloneNode(true);
      copia.setAttribute('aria-hidden', 'true');
      copia.querySelectorAll('img').forEach((im) => { im.alt = ''; });
      trilho.appendChild(copia);
    });
  }

  // ---------------------------------------------------------------- as barras dos carrosséis sobem quando aparecem
  function barras() {
    const alvo = document.querySelector('.barras');
    if (!alvo) return;
    alvo.querySelectorAll('.barra').forEach((b, i) => b.style.setProperty('--i', i));
    if (parado) { alvo.classList.add('visto'); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      alvo.classList.add('visto');
    }, { threshold: .4 });
    io.observe(alvo);
  }

  // ---------------------------------------------------------------- a estrela flutuante: aparece depois da abertura e some no fim
  function flutuante() {
    const botao = document.querySelector('.estrela-flutuante');
    const abertura = document.querySelector('.abertura-acoes');
    const fim = document.querySelector('.fim');
    if (!botao || !abertura || !fim || tudo) return;
    let passou = false, noFim = false;
    const aplica = () => botao.classList.toggle('mostra', passou && !noFim);
    new IntersectionObserver(([e]) => { passou = !e.isIntersecting && e.boundingClientRect.top < 0; aplica(); }).observe(abertura);
    new IntersectionObserver(([e]) => { noFim = e.isIntersecting; aplica(); }, { threshold: .25 }).observe(fim);
  }

  // ---------------------------------------------------------------- "Ver tudo" abre e fecha o prompt do passo 1
  function verTudo(refaz) {
    document.querySelectorAll('.ver-tudo').forEach((b) => {
      const caixa = document.getElementById(b.getAttribute('aria-controls')).parentElement;
      b.addEventListener('click', () => {
        const abre = !caixa.classList.contains('aberto');
        caixa.classList.toggle('aberto', abre);
        b.setAttribute('aria-expanded', String(abre));
        b.textContent = abre ? 'Ver menos' : 'Ver tudo';
      });
      // a altura do passo muda: a estrada se redesenha quando o cartão termina de abrir ou fechar
      caixa.addEventListener('transitionend', (e) => { if (e.propertyName === 'max-height') refaz(); });
    });
  }

  // ---------------------------------------------------------------- a entrada suave dos blocos
  function revela() {
    const alvos = document.querySelectorAll('.cabeca > *, .rota-cabeca > *, .operacao-texto > *, .operacao-capa, .tudo-lista li, .perguntas-lista details, .fim-texto > *, .esteira');
    if (parado) return;
    alvos.forEach((a) => a.classList.add('revela'));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const i = [...e.target.parentElement.children].indexOf(e.target);
      e.target.style.transitionDelay = `${Math.min(i, 8) * 60}ms`;
      e.target.classList.add('visto');
      io.unobserve(e.target);
    }), { threshold: .18, rootMargin: '0px 0px -6% 0px' });
    alvos.forEach((a) => io.observe(a));
  }

  document.querySelectorAll('.brasas').forEach(brasas);
  const refazRota = rota();
  verTudo(() => refazRota());
  copiar();
  estrelas();
  esteira();
  barras();
  flutuante();
  revela();
  // as telas carregam depois: a estrada se redesenha com as alturas certas
  let t;
  const refaz = () => { clearTimeout(t); t = setTimeout(refazRota, 80); };
  document.querySelectorAll('.rota img').forEach((im) => { if (!im.complete) im.addEventListener('load', refaz, { once: true }); });
  if (document.fonts) document.fonts.ready.then(refaz);
})();
