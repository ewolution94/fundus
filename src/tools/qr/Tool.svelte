<!--
  F-401 Make a QR code: a link, guest Wi-Fi, a contact card or plain text, with its error correction;
  shown big, saved as PNG (crisp, with its quiet zone) or SVG, the SVG copied. Scan: from a photo
  (jsQR) or the camera (BarcodeDetector where the browser has it, jsQR on the frames elsewhere). A
  scanned code is shown, never opened. The camera stops when the tool closes, Make is picked, or the
  page is hidden.
-->
<script lang="ts">
  import { untrack, tick } from 'svelte';
  import Seg from '../../components/kit/Seg.svelte';
  import Check from '../../components/kit/Check.svelte';
  import DropWell from '../../components/kit/DropWell.svelte';
  import CopyButton from '../../components/kit/CopyButton.svelte';
  import SaveButton from '../../components/kit/SaveButton.svelte';
  import NextTools from '../../components/kit/NextTools.svelte';
  import { words, t } from '../../lib/i18n.svelte.ts';
  import { remember, yours } from '../../lib/memory.svelte.ts';
  import { texts, files, type Item } from '../../lib/inbox.svelte.ts';
  import { save, type Output } from '../../lib/save.ts';
  import { isPhoto, decode, draw, fit, makeCanvas, toBlob } from '../../lib/images.ts';
  import type { Tool } from '../../lib/catalog.ts';
  import { toast } from '../../../vendor/ewo/elements/toaster.js';
  import { link, looksLikeLink, wifi, vcard, matrix, svgPath, svgFile, pixels, scaleFor, parseScanned, scannedText, TooLong, type Ecc, type Auth, type Matrix, type Scanned } from './qr.ts';

  let { tool, items }: { tool: Tool; items: Item[] } = $props();

  const w = words({
    en: {
      mode: 'Mode',
      make: 'Make',
      scan: 'Scan',
      kind: 'Holds',
      link: 'Link',
      wifi: 'Wi-Fi',
      contact: 'Contact',
      text: 'Text',
      linkHolder: 'example.com',
      network: 'Network',
      password: 'Password',
      security: 'Security',
      wpa: 'WPA',
      wep: 'WEP',
      open: 'Open',
      hidden: 'Hidden network',
      hiddenHint: 'It doesn’t show in the list of networks',
      first: 'First name',
      last: 'Last name',
      phone: 'Phone',
      email: 'Email',
      org: 'Organisation',
      textHolder: 'Any text',
      ecc: 'Error correction',
      eccL: 'L 7 %',
      eccM: 'M 15 %',
      eccQ: 'Q 25 %',
      eccH: 'H 30 %',
      eccHint: 'More survives a smudge or a logo on top; the code gets denser.',
      emptyLink: 'Type a link: its code appears here.',
      emptyWifi: 'Type the network’s name and password: guests point their camera at the code and join.',
      emptyContact: 'Fill in a name, a number or an email: the code saves the contact on a phone.',
      emptyText: 'Type a text: its code appears here.',
      notLink: 'That doesn’t look like a link. For other words, choose Text.',
      shortWpa: 'A WPA password has 8 to 63 characters: phones won’t join with this one.',
      tooLong: 'Too much for one QR code: shorten it, or choose less error correction.',
      figure: 'Version {v} · {n} × {n} modules',
      saveSvg: 'Save SVG',
      copySvg: 'Copy SVG',
      codeFor: 'QR code: {what}',
      dropScan: 'Drop a photo of a QR code, or choose one',
      dropScanHint: 'A screenshot, a photo, a saved code. It stays on this device.',
      camera: 'Use the camera',
      stop: 'Stop the camera',
      pointAt: 'Point the camera at a QR code.',
      reading: 'Looking for a code in {name}…',
      none: 'No QR code found in {name}. Try a sharper photo, closer to the code.',
      notPicture: '{name} isn’t a picture this browser can open.',
      denied: 'The camera wasn’t allowed. Allow it in the browser’s settings, or scan a photo instead.',
      noCamera: 'No camera found. Scan a photo instead.',
      cameraFailed: 'The camera didn’t start. Scan a photo instead.',
      noCameraHere: 'This browser can’t use a camera on this page. Scan a photo instead.',
      result: 'It says',
      fromFile: 'Read from {name}',
      fromCamera: 'Read by the camera',
      notOpened: 'Not opened: copy it if you trust where it leads.',
      yes: 'Yes',
      no: 'No',
      name: 'Name',
      title: 'Title',
      address: 'Address',
      url: 'Website',
      note: 'Note',
      again: 'Scan another',
      scanned: 'What it holds',
    },
    de: {
      mode: 'Modus',
      make: 'Erstellen',
      scan: 'Lesen',
      kind: 'Inhalt',
      link: 'Link',
      wifi: 'WLAN',
      contact: 'Kontakt',
      text: 'Text',
      linkHolder: 'beispiel.de',
      network: 'Netzwerk',
      password: 'Passwort',
      security: 'Sicherheit',
      wpa: 'WPA',
      wep: 'WEP',
      open: 'Offen',
      hidden: 'Verstecktes Netzwerk',
      hiddenHint: 'Es steht nicht in der Liste der Netzwerke',
      first: 'Vorname',
      last: 'Nachname',
      phone: 'Telefon',
      email: 'E-Mail',
      org: 'Firma',
      textHolder: 'Beliebiger Text',
      ecc: 'Fehlerkorrektur',
      eccL: 'L 7 %',
      eccM: 'M 15 %',
      eccQ: 'Q 25 %',
      eccH: 'H 30 %',
      eccHint: 'Mehr übersteht einen Fleck oder ein Logo darauf; der Code wird dichter.',
      emptyLink: 'Tipp einen Link: sein Code erscheint hier.',
      emptyWifi: 'Tipp Name und Passwort des Netzwerks: Gäste halten die Kamera auf den Code und sind drin.',
      emptyContact: 'Trag einen Namen, eine Nummer oder eine E-Mail ein: der Code speichert den Kontakt im Telefon.',
      emptyText: 'Tipp einen Text: sein Code erscheint hier.',
      notLink: 'Das sieht nicht nach einem Link aus. Für andere Wörter wähl Text.',
      shortWpa: 'Ein WPA-Passwort hat 8 bis 63 Zeichen: mit diesem verbinden sich Telefone nicht.',
      tooLong: 'Zu viel für einen QR-Code: kürz es, oder wähl weniger Fehlerkorrektur.',
      figure: 'Version {v} · {n} × {n} Module',
      saveSvg: 'SVG sichern',
      copySvg: 'SVG kopieren',
      codeFor: 'QR-Code: {what}',
      dropScan: 'Foto eines QR-Codes ablegen oder auswählen',
      dropScanHint: 'Ein Screenshot, ein Foto, ein gesicherter Code. Es bleibt auf diesem Gerät.',
      camera: 'Kamera benutzen',
      stop: 'Kamera stoppen',
      pointAt: 'Halte die Kamera auf einen QR-Code.',
      reading: 'Suche einen Code in {name}…',
      none: 'Kein QR-Code in {name} gefunden. Versuch ein schärferes Foto, näher am Code.',
      notPicture: '{name} ist kein Bild, das dieser Browser öffnen kann.',
      denied: 'Die Kamera wurde nicht erlaubt. Erlaub sie in den Browser-Einstellungen, oder lies ein Foto.',
      noCamera: 'Keine Kamera gefunden. Lies stattdessen ein Foto.',
      cameraFailed: 'Die Kamera ist nicht angegangen. Lies stattdessen ein Foto.',
      noCameraHere: 'Dieser Browser kann auf dieser Seite keine Kamera benutzen. Lies stattdessen ein Foto.',
      result: 'Er sagt',
      fromFile: 'Gelesen aus {name}',
      fromCamera: 'Mit der Kamera gelesen',
      notOpened: 'Nicht geöffnet: kopier es, wenn du dem Ziel traust.',
      yes: 'Ja',
      no: 'Nein',
      name: 'Name',
      title: 'Titel',
      address: 'Adresse',
      url: 'Website',
      note: 'Notiz',
      again: 'Noch einen lesen',
      scanned: 'Was er enthält',
    },
  });

  type Kind = 'link' | 'wifi' | 'contact' | 'text';
  // What it makes and how are kept; what's typed into it is not.
  const o = remember('qr', { mode: 'make' as 'make' | 'scan', kind: 'link' as Kind, ecc: 'M' as Ecc, auth: 'WPA' as Auth });

  let url = $state('');
  let net = $state({ ssid: '', password: '', hidden: false });
  let card = $state({ first: '', last: '', phone: '', email: '', org: '' });
  let plain = $state('');

  // ── Make ──────────────────────────────────────────────────────────────────────────────────

  /** What goes into the code, a problem with it, and a name for its files. */
  const payload = $derived.by((): { text: string; problem: string; name: string; label: string } => {
    if (o.kind === 'link') {
      if (!url.trim()) return { text: '', problem: '', name: '', label: '' };
      if (!looksLikeLink(url)) return { text: '', problem: w('notLink'), name: '', label: '' };
      const full = link(url);
      let host = 'link';
      try {
        host = new URL(full).hostname || 'link';
      } catch {}
      return { text: full, problem: '', name: host, label: full };
    }
    if (o.kind === 'wifi') {
      if (!net.ssid) return { text: '', problem: '', name: '', label: '' };
      const short = o.auth === 'WPA' && (net.password.length < 8 || net.password.length > 63);
      return { text: wifi({ ssid: net.ssid, password: net.password, auth: o.auth, hidden: net.hidden }), problem: short ? w('shortWpa') : '', name: `wifi-${net.ssid}`, label: net.ssid };
    }
    if (o.kind === 'contact') {
      const any = card.first.trim() || card.last.trim() || card.phone.trim() || card.email.trim() || card.org.trim();
      if (!any) return { text: '', problem: '', name: '', label: '' };
      const who = [card.first, card.last].map((s) => s.trim()).filter(Boolean).join(' ') || card.org.trim() || card.email.trim() || card.phone.trim();
      return { text: vcard({ ...card }), problem: '', name: who, label: who };
    }
    return { text: plain, problem: '', name: 'text', label: plain.slice(0, 40) };
  });

  const slug = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'code';

  const code = $derived.by((): { m: Matrix; name: string } | { error: string } | null => {
    if (!payload.text) return null;
    try {
      return { m: matrix(payload.text, o.ecc), name: `qr-${slug(payload.name)}` };
    } catch (error) {
      return { error: error instanceof TooLong ? w('tooLong') : String(error) };
    }
  });
  const made = $derived(code && 'm' in code ? code : null);
  const svg = $derived(made ? svgFile(made.m) : '');

  // The PNG is made a moment after typing stops, so Save hands it out straight from the tap.
  let png = $state<Output | null>(null);
  $effect(() => {
    const c = made;
    png = null;
    if (!c) return;
    let live = true;
    const timer = setTimeout(async () => {
      const scale = scaleFor(c.m.size);
      const px = pixels(c.m, scale);
      const canvas = makeCanvas(px.width, px.height);
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      ctx.putImageData(new ImageData(px.data, px.width, px.height), 0, 0);
      const blob = await toBlob(canvas, 'image/png', 1);
      if (live) png = { blob, name: `${c.name}.png` };
    }, 120);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  });
  const outputs = $derived(png ? [png] : null);
  const nextItems = $derived(png ? [{ file: new File([png.blob], png.name, { type: 'image/png' }) }] : null);

  async function saveSvg() {
    if (!made) return;
    const result = await save([{ blob: new Blob([svg], { type: 'image/svg+xml' }), name: `${made.name}.svg` }]);
    if (result === 'cancelled') return;
    yours.used(tool.id);
    toast(result === 'shared' ? t('tool.shared') : t('tool.saved'), { tone: 'ok', duration: 2200 });
  }

  const emptyLine = $derived(o.kind === 'link' ? w('emptyLink') : o.kind === 'wifi' ? w('emptyWifi') : o.kind === 'contact' ? w('emptyContact') : w('emptyText'));

  // ── Scan ──────────────────────────────────────────────────────────────────────────────────

  let found = $state<{ what: Scanned; from: string } | null>(null);
  let scanNote = $state('');
  let scanBad = $state(false);
  let busy = $state(false);

  async function scanFiles(list: File[]) {
    const file = list[0];
    if (!file) return;
    stopCamera();
    found = null;
    scanBad = false;
    scanNote = w('reading', { name: file.name });
    busy = true;
    try {
      if (!(await isPhoto(file))) throw new Error('not a picture');
      const d = await decode(file);
      const { default: jsQR } = await import('jsqr');
      let text: string | null = null;
      // Big photos are read smaller first (quicker, and jsQR finds codes better at that size).
      const sizes = [...new Set([1600, 800, Math.min(Math.max(d.width, d.height), 3200)])];
      for (const max of sizes) {
        const size = fit(d.width, d.height, max, max);
        const canvas = draw(d.bitmap, size.width, size.height, 'image/jpeg');
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        const img = ctx.getImageData(0, 0, size.width, size.height);
        const hit = jsQR(img.data, size.width, size.height, { inversionAttempts: 'attemptBoth' });
        if (hit) {
          text = scannedText(hit);
          break;
        }
        await new Promise((r) => setTimeout(r));
      }
      d.bitmap.close();
      if (text === null) {
        scanNote = w('none', { name: file.name });
        scanBad = true;
      } else {
        found = { what: parseScanned(text), from: w('fromFile', { name: file.name }) };
        scanNote = '';
      }
    } catch {
      scanNote = w('notPicture', { name: file.name });
      scanBad = true;
    } finally {
      busy = false;
    }
  }

  interface Detector {
    detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
  }
  type DetectorClass = { new (options: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> };

  let video = $state<HTMLVideoElement | null>(null);
  let stream: MediaStream | null = null;
  let filming = $state(false);
  let loop = 0;

  async function startCamera() {
    found = null;
    scanBad = false;
    scanNote = '';
    if (!navigator.mediaDevices?.getUserMedia) {
      scanNote = w('noCameraHere');
      scanBad = true;
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (error) {
      const name = (error as DOMException)?.name;
      scanNote = name === 'NotAllowedError' || name === 'SecurityError' ? w('denied') : name === 'NotFoundError' || name === 'OverconstrainedError' ? w('noCamera') : w('cameraFailed');
      scanBad = true;
      return;
    }
    filming = true;
    scanNote = w('pointAt');
    await tick();
    if (!video || !stream) return;
    video.srcObject = stream;
    await video.play().catch(() => {});

    const Native = (globalThis as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    let detector: Detector | null = null;
    if (Native) {
      try {
        if ((await Native.getSupportedFormats()).includes('qr_code')) detector = new Native({ formats: ['qr_code'] });
      } catch {}
    }
    const jsQR = detector ? null : (await import('jsqr')).default;
    const frame = makeCanvas(1, 1);
    const ctx = frame.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    const id = ++loop;

    const look = async () => {
      if (id !== loop || !stream || !video) return;
      let text: string | null = null;
      if (video.readyState >= 2 && video.videoWidth) {
        try {
          if (detector) text = (await detector.detect(video))[0]?.rawValue ?? null;
          else if (jsQR) {
            const size = fit(video.videoWidth, video.videoHeight, 720, 720);
            frame.width = size.width;
            frame.height = size.height;
            ctx.drawImage(video, 0, 0, size.width, size.height);
            const img = ctx.getImageData(0, 0, size.width, size.height);
            const hit = jsQR(img.data, size.width, size.height, { inversionAttempts: 'dontInvert' });
            text = hit ? scannedText(hit) : null;
          }
        } catch {}
      }
      if (id !== loop) return;
      if (text !== null) {
        found = { what: parseScanned(text), from: w('fromCamera') };
        scanNote = '';
        stopCamera();
        return;
      }
      setTimeout(look, 200);
    };
    void look();
  }

  function stopCamera() {
    loop++;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (video) video.srcObject = null;
    filming = false;
    if (scanNote === w('pointAt')) scanNote = '';
  }

  // The camera never outlives the Scan side, the tool, or a hidden page.
  $effect(() => {
    if (o.mode !== 'scan') untrack(stopCamera);
  });
  $effect(() => {
    const hide = () => document.visibilityState === 'hidden' && stopCamera();
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      stopCamera();
    };
  });

  // What came from the home: a link (or any text) to make, a picture to read.
  const givenText = untrack(() => texts(items))[0];
  const givenFile = untrack(() => files(items))[0];
  if (givenFile) {
    o.mode = 'scan';
    void scanFiles([givenFile]);
  } else if (givenText !== undefined) {
    o.mode = 'make';
    if (looksLikeLink(givenText)) {
      o.kind = 'link';
      url = givenText.trim();
    } else {
      o.kind = 'text';
      plain = givenText;
    }
  }

  const fieldName = (key: Extract<Scanned, { kind: 'contact' }>['fields'][number]['key']) =>
    ({ name: w('name'), org: w('org'), phone: w('phone'), email: w('email'), url: w('url'), address: w('address'), title: w('title'), note: w('note') })[key];
</script>

<div class="qr">
  <Seg
    large
    label={w('mode')}
    value={o.mode}
    options={[
      { value: 'make', label: w('make') },
      { value: 'scan', label: w('scan') },
    ]}
    onchange={(m) => (o.mode = m)}
  />

  {#if o.mode === 'make'}
    <div class="cols make">
      <div class="stack">
        <figure class="plate">
          <div class="frame code">
            {#if made}
              <svg viewBox="0 0 {made.m.size} {made.m.size}" shape-rendering="crispEdges" role="img" aria-label={w('codeFor', { what: payload.label })}>
                <rect width={made.m.size} height={made.m.size} fill="#fff" />
                <path d={svgPath(made.m)} fill="#000" />
              </svg>
            {:else}
              <p class="note blank" class:bad={!!payload.problem || !!(code && 'error' in code)} role={payload.problem || (code && 'error' in code) ? 'alert' : undefined}>
                {code && 'error' in code ? code.error : payload.problem || emptyLine}
              </p>
            {/if}
          </div>
          {#if made}
            <figcaption>
              <code>{w('figure', { v: made.m.version, n: made.m.size - 8 })}</code>
              <span>{w(o.kind)}</span>
            </figcaption>
          {/if}
        </figure>
        {#if made && payload.problem}<p class="note bad" role="alert">{payload.problem}</p>{/if}
        {#if made}
          <SaveButton {outputs} busy={!png} tool={tool.id} />
          <div class="acts">
            <button type="button" class="btn" onclick={saveSvg}>{w('saveSvg')}</button>
            <CopyButton text={svg} variant="button" label={w('copySvg')} />
          </div>
          <NextTools items={nextItems} from={tool.id} prefer={['topdf', 'resize']} />
        {/if}
      </div>

      <!-- On a phone the fields come first: the code follows what's typed. -->
      <div class="stack fields">
        <dl class="spec">
          <div>
            <dt>{w('kind')}</dt>
            <dd>
              <Seg
                label={w('kind')}
                value={o.kind}
                options={[
                  { value: 'link', label: w('link') },
                  { value: 'wifi', label: w('wifi') },
                  { value: 'contact', label: w('contact') },
                  { value: 'text', label: w('text') },
                ]}
                onchange={(k) => (o.kind = k)}
              />
            </dd>
          </div>
          {#if o.kind === 'link'}
            <div>
              <dt><label for="qr-link">{w('link')}</label></dt>
              <dd><input id="qr-link" class="field" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder={w('linkHolder')} bind:value={url} /></dd>
            </div>
          {:else if o.kind === 'wifi'}
            <div>
              <dt><label for="qr-ssid">{w('network')}</label></dt>
              <dd><input id="qr-ssid" class="field" autocomplete="off" autocapitalize="off" spellcheck="false" bind:value={net.ssid} /></dd>
            </div>
            <div>
              <dt>{w('security')}</dt>
              <dd>
                <Seg
                  label={w('security')}
                  value={o.auth}
                  options={[
                    { value: 'WPA', label: w('wpa') },
                    { value: 'WEP', label: w('wep') },
                    { value: 'nopass', label: w('open') },
                  ]}
                  onchange={(a) => (o.auth = a)}
                />
              </dd>
            </div>
            {#if o.auth !== 'nopass'}
              <div>
                <dt><label for="qr-pass">{w('password')}</label></dt>
                <dd><input id="qr-pass" class="field" autocomplete="off" autocapitalize="off" spellcheck="false" bind:value={net.password} /></dd>
              </div>
            {/if}
            <div>
              <dt></dt>
              <dd><Check checked={net.hidden} label={w('hidden')} hint={w('hiddenHint')} onchange={(v) => (net.hidden = v)} /></dd>
            </div>
          {:else if o.kind === 'contact'}
            <div>
              <dt><label for="qr-first">{w('first')}</label></dt>
              <dd><input id="qr-first" class="field" autocomplete="off" bind:value={card.first} /></dd>
            </div>
            <div>
              <dt><label for="qr-last">{w('last')}</label></dt>
              <dd><input id="qr-last" class="field" autocomplete="off" bind:value={card.last} /></dd>
            </div>
            <div>
              <dt><label for="qr-phone">{w('phone')}</label></dt>
              <dd><input id="qr-phone" class="field" type="tel" autocomplete="off" bind:value={card.phone} /></dd>
            </div>
            <div>
              <dt><label for="qr-email">{w('email')}</label></dt>
              <dd><input id="qr-email" class="field" type="email" autocomplete="off" autocapitalize="off" spellcheck="false" bind:value={card.email} /></dd>
            </div>
            <div>
              <dt><label for="qr-org">{w('org')}</label></dt>
              <dd><input id="qr-org" class="field" autocomplete="off" bind:value={card.org} /></dd>
            </div>
          {:else}
            <div>
              <dt><label for="qr-text">{w('text')}</label></dt>
              <dd><textarea id="qr-text" class="field" rows="4" placeholder={w('textHolder')} bind:value={plain}></textarea></dd>
            </div>
          {/if}
          <div>
            <dt>{w('ecc')}</dt>
            <dd>
              <Seg
                label={w('ecc')}
                value={o.ecc}
                options={[
                  { value: 'L', label: w('eccL') },
                  { value: 'M', label: w('eccM') },
                  { value: 'Q', label: w('eccQ') },
                  { value: 'H', label: w('eccH') },
                ]}
                onchange={(e) => (o.ecc = e)}
              />
              <span class="note">{w('eccHint')}</span>
            </dd>
          </div>
        </dl>

      </div>
    </div>
  {:else}
    <div class="cols">
      <div class="stack">
        {#if filming}
          <div class="work cam">
            <!-- svelte-ignore a11y_media_has_caption -->
            <video bind:this={video} playsinline muted></video>
          </div>
          <button type="button" class="btn" onclick={stopCamera}>{w('stop')}</button>
        {:else}
          <DropWell accept="image/*,.heic,.heif" title={w('dropScan')} hint={w('dropScanHint')} onfiles={scanFiles} />
          <button type="button" class="btn ink cam-btn" onclick={startCamera} disabled={busy}>{w('camera')}</button>
        {/if}
        {#if scanNote}<p class="note" class:bad={scanBad} role={scanBad ? 'alert' : undefined} aria-live="polite">{scanNote}</p>{/if}
      </div>

      <div class="stack">
        {#if found}
          {@const s = found.what}
          <h2 class="h">{w('scanned')}<em>{found.from}</em></h2>
          <dl class="spec read">
            {#if s.kind === 'link'}
              <div>
                <dt>{w('link')}</dt>
                <dd><span class="mono-out val">{s.url}</span><CopyButton text={s.url} /></dd>
              </div>
            {:else if s.kind === 'wifi'}
              <div>
                <dt>{w('network')}</dt>
                <dd><span class="mono-out val">{s.ssid}</span><CopyButton text={s.ssid} /></dd>
              </div>
              {#if s.auth !== 'nopass'}
                <div>
                  <dt>{w('password')}</dt>
                  <dd><span class="mono-out val">{s.password}</span><CopyButton text={s.password} /></dd>
                </div>
              {/if}
              <div>
                <dt>{w('security')}</dt>
                <dd><span class="val">{s.auth === 'nopass' ? w('open') : s.auth}</span></dd>
              </div>
              <div>
                <dt>{w('hidden')}</dt>
                <dd><span class="val">{s.hidden ? w('yes') : w('no')}</span></dd>
              </div>
            {:else if s.kind === 'contact'}
              {#each s.fields as f, i (i)}
                <div>
                  <dt>{fieldName(f.key)}</dt>
                  <dd><span class="mono-out val">{f.value}</span><CopyButton text={f.value} /></dd>
                </div>
              {/each}
            {:else}
              <div>
                <dt>{w('text')}</dt>
                <dd><span class="mono-out val">{s.text}</span><CopyButton text={s.text} /></dd>
              </div>
            {/if}
          </dl>
          {#if s.kind === 'link'}<p class="note">{w('notOpened')}</p>{/if}
          <button type="button" class="btn again" onclick={() => (found = null)}>{w('again')}</button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .qr {
    display: grid;
    gap: 18px;
  }

  /* The code is black on white whatever the theme: that's what a camera reads. */
  .code {
    padding: 18px;
    min-height: 260px;
  }

  .code svg {
    width: min(100%, 420px);
    height: auto;
    aspect-ratio: 1;
  }

  .blank {
    max-width: 34ch;
    text-align: center;
    padding: 20px;
  }

  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .cam {
    display: grid;
    place-items: center;
    background: var(--sunk);
    aspect-ratio: 4 / 3;
    overflow: hidden;
  }

  .cam video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cam-btn,
  .again {
    justify-self: start;
  }

  @media (max-width: 759px) {
    .make .fields {
      order: -1;
    }
  }

  .read {
    border-top: 0;
  }

  .read dd {
    grid-template-columns: minmax(0, 1fr) auto;
    display: grid;
    align-items: baseline;
    justify-items: stretch;
    gap: 10px;
  }

  .val {
    min-width: 0;
    font-size: 14px;
  }

  textarea.field {
    min-height: 110px;
  }
</style>
