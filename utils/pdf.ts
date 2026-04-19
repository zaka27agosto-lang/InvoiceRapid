import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type PlantillaPDF = 'default' | 'elegante' | 'antigua' | 'colorida' | 'minimal';

export async function generarYCompartirPDF(factura: any, items: any[], isPremium: boolean, plantilla: PlantillaPDF = 'default') {
  const fechaCreacion = new Date(factura.fecha).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const fechaVencimiento = factura.fecha_vencimiento
    ? new Date(factura.fecha_vencimiento).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'long', year: 'numeric'
      })
    : '—';

  const marcaAgua = !isPremium ? `
    <div style="
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 72px; font-weight: 900;
      color: rgba(108, 71, 255, 0.08);
      white-space: nowrap; pointer-events: none;
      z-index: 1000; letter-spacing: 8px;
    ">VERSIÓN GRATUITA</div>
  ` : '';

  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #1a1a1a;">${item.descripcion}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; text-align: center; font-size: 13px; color: #555;">${item.cantidad} ${item.unidad}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; text-align: right; font-size: 13px; color: #555;">${Number(item.precio_unitario).toFixed(2)} €</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; text-align: center; font-size: 13px; color: #555;">${item.descuento}%</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; text-align: right; font-size: 13px; font-weight: 700; color: #1a1a1a;">${Number(item.subtotal).toFixed(2)} €</td>
    </tr>
  `).join('');

  // Estilos según plantilla
  let styles = '';
  let logoHTML = '';
  let extraElements = '';

  switch (plantilla) {
    case 'elegante':
      styles = `
        body { font-family: 'Georgia', serif; background: #faf9f7; margin: 0; padding: 0; }
        .page { padding: 20px; max-width: 100%; margin: 0 auto; position: relative; background: #fff; box-shadow: 0 0 40px rgba(0,0,0,0.05); page-break-inside: avoid; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; border-bottom: 3px double #2c3e50; padding-bottom: 12px; }
        .logo { font-size: 20px; font-weight: normal; color: #2c3e50; letter-spacing: 3px; font-family: 'Georgia', serif; }
        .logo span { color: #8e44ad; font-style: italic; }
        .factura-num h1 { font-size: 24px; font-weight: normal; color: #2c3e50; font-family: 'Georgia', serif; }
        .divider { height: 2px; background: #2c3e50; margin-bottom: 15px; }
        .info-box h3 { font-size: 8px; text-transform: uppercase; letter-spacing: 2px; color: #5a6c7d; font-weight: normal; margin-bottom: 4px; }
        .info-box p { color: #2d3748; font-size: 11px; }
        .info-box strong { color: #1a202c; font-size: 13px; }
        .fecha-box { background: #f8f9fa; border: 1px solid #e9ecef; padding: 8px 12px; }
        thead tr { border-bottom: 2px solid #2c3e50; }
        thead th { font-family: 'Georgia', serif; color: #2c3e50; letter-spacing: 1px; font-size: 10px; }
        .totales { display: flex; justify-content: flex-end; margin-bottom: 15px; }
        .totales-box { width: 240px; }
        .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; color: #4a5568; margin-bottom: 3px; }
        .total-row.final { border-top: 2px solid #2c3e50; padding-top: 6px; margin-top: 3px; }
        .total-row.final span:first-child { font-size: 13px; font-weight: 800; color: #1a202c; }
        .total-row.final span:last-child { font-size: 16px; font-weight: 900; color: #8e44ad; }
      `;
      logoHTML = `<div class="logo">InvoiceRapid${isPremium ? ' Pro' : ''}</div>`;
      break;

    case 'antigua':
      styles = `
        body { font-family: 'Courier New', monospace; background: #f5f0e6; margin: 0; padding: 0; }
        .page { padding: 20px; max-width: 100%; margin: 0 auto; position: relative; background: #fffef8; border: 2px solid #8b4513; page-break-inside: avoid; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; border: 3px solid #8b4513; padding: 10px; background: #f5f0e6; }
        .logo { font-size: 18px; font-weight: bold; color: #8b4513; text-transform: uppercase; letter-spacing: 2px; }
        .logo span { color: #654321; font-size: 13px; }
        .factura-num h1 { font-size: 20px; font-weight: bold; color: #8b4513; text-decoration: underline; }
        .divider { height: 4px; background: repeating-linear-gradient(90deg, #8b4513, #8b4513 10px, #f5f0e6 10px, #f5f0e6 20px); margin-bottom: 15px; }
        .info-box h3 { font-size: 8px; text-transform: uppercase; color: #5a4a3a; border-bottom: 1px solid #8b4513; padding-bottom: 3px; }
        .info-box p { color: #3d3225; font-size: 11px; }
        .info-box strong { color: #2d2419; font-size: 13px; }
        .fecha-box { background: #f5f0e6; border: 1px solid #8b4513; padding: 6px 10px; }
        table { border: 2px solid #8b4513; }
        thead th { background: #8b4513; color: #fff; font-size: 10px; }
        td, th { border: 1px solid #8b4513; }
        .totales { display: flex; justify-content: flex-end; margin-bottom: 15px; }
        .totales-box { border: 2px solid #8b4513; padding: 8px; background: #f5f0e6; width: 220px; }
        .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; color: #5a4a3a; }
        .total-row.final { border-top: 2px solid #8b4513; padding-top: 6px; margin-top: 3px; }
        .total-row.final span:first-child { font-size: 13px; font-weight: 800; color: #2d2419; }
        .total-row.final span:last-child { font-size: 16px; font-weight: 900; color: #8b4513; }
      `;
      logoHTML = `<div class="logo">InvoiceRapid${isPremium ? ' PRO' : ''}</div>`;
      break;

    case 'colorida':
      styles = `
        body { font-family: -apple-system, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 0; }
        .page { padding: 20px; max-width: 100%; margin: 0 auto; position: relative; background: #fff; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); page-break-inside: avoid; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 15px; color: #fff; }
        .logo { font-size: 20px; font-weight: 900; color: #fff; }
        .logo span { color: #ffd700; font-weight: 700; }
        .factura-num h1 { font-size: 26px; font-weight: 900; color: #fff; }
        .factura-num p { color: rgba(255,255,255,0.9); }
        .divider { height: 4px; background: linear-gradient(90deg, #667eea, #764ba2, #f093fb, #f5576c); border-radius: 2px; margin-bottom: 15px; }
        .info-box { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 10px; border-radius: 12px; }
        .info-box h3 { color: #4a5568; font-size: 10px; }
        .info-box p { color: #2d3748; font-size: 11px; }
        .info-box strong { color: #1a202c; font-size: 13px; }
        .fecha-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 8px 12px; border-radius: 10px; color: #fff; }
        .fecha-box span { color: rgba(255,255,255,0.9); }
        .fecha-box strong { color: #fff; }
        table { border-radius: 12px; overflow: hidden; }
        thead tr { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        thead th { color: #fff; font-size: 10px; }
        tbody tr:nth-child(even) { background: #f8f9fa; }
        .totales-box { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 10px; border-radius: 12px; }
        .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; color: #4a5568; }
        .total-row.final { border-top: 2px solid #764ba2; padding-top: 6px; margin-top: 3px; }
        .total-row.final span:first-child { font-size: 13px; font-weight: 800; color: #1a202c; }
        .total-row.final span:last-child { font-size: 16px; font-weight: 900; color: #764ba2; }
      `;
      logoHTML = `<div class="logo">InvoiceRapid${isPremium ? ' Pro' : ''}</div>`;
      break;

    case 'minimal':
      styles = `
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; margin: 0; padding: 0; }
        .page { padding: 20px; max-width: 100%; margin: 0 auto; position: relative; page-break-inside: avoid; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .logo { font-size: 14px; font-weight: 300; color: #000; letter-spacing: 4px; }
        .logo span { font-weight: 600; }
        .factura-num h1 { font-size: 18px; font-weight: 300; color: #000; }
        .divider { height: 1px; background: #000; margin-bottom: 20px; }
        .info-box h3 { font-size: 8px; text-transform: uppercase; letter-spacing: 2px; color: #4a5568; font-weight: 400; margin-bottom: 4px; }
        .info-box p { color: #1a202c; font-size: 11px; }
        .info-box strong { color: #000; font-size: 13px; }
        .fecha-box { padding: 0; background: transparent; }
        .fecha-box span { font-size: 8px; text-transform: uppercase; letter-spacing: 2px; color: #4a5568; }
        .fecha-box strong { font-size: 11px; color: #000; font-weight: 400; }
        table { margin-bottom: 20px; }
        thead tr { border-bottom: 1px solid #000; }
        thead th { color: #000; font-weight: 400; letter-spacing: 1px; font-size: 9px; }
        thead th:not(:first-child), thead th:last-child { font-size: 8px; }
        tbody tr td { border-bottom: 1px solid #eee; }
        .totales { display: flex; justify-content: flex-end; margin-bottom: 20px; }
        .totales-box { width: 200px; }
        .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #4a5568; margin-bottom: 3px; }
        .total-row.final { border-top: 1px solid #000; padding-top: 6px; margin-top: 3px; }
        .total-row.final span:first-child { font-weight: 400; color: #000; }
        .total-row.final span:last-child { color: #000; font-weight: 900; font-size: 14px; }
        .notas { background: transparent; padding: 0; margin-bottom: 15px; }
        .notas h3 { font-size: 8px; text-transform: uppercase; letter-spacing: 2px; color: #4a5568; font-weight: 400; }
        .notas p { color: #1a202c; font-size: 10px; }
        .footer { color: #4a5568; font-size: 8px; }
      `;
      logoHTML = `<div class="logo">INVOICE${isPremium ? 'RAPID PRO' : 'RAPID'}</div>`;
      break;

    default: // default
      styles = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; background: #fff; color: #1a1a1a; margin: 0; padding: 0; }
        .page { padding: 20px; max-width: 100%; margin: 0 auto; position: relative; page-break-inside: avoid; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .logo { font-size: 20px; font-weight: 900; color: #6C47FF; }
        .logo span { color: #1a1a1a; font-weight: 400; font-size: 11px; }
        .factura-num { text-align: right; }
        .factura-num h1 { font-size: 22px; font-weight: 900; color: #6C47FF; }
        .factura-num p { font-size: 10px; color: #718096; margin-top: 2px; }
        .divider { height: 3px; background: linear-gradient(90deg, #6C47FF, #a78bfa); border-radius: 2px; margin-bottom: 20px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .info-box h3 { font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: #718096; font-weight: 600; margin-bottom: 4px; }
        .info-box p { font-size: 11px; color: #2d3748; line-height: 1.3; }
        .info-box strong { font-size: 13px; font-weight: 700; display: block; margin-bottom: 2px; color: #1a202c; }
        .fechas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
        .fecha-box { background: #F8F7FF; border-radius: 10px; padding: 8px 12px; }
        .fecha-box span { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #718096; display: block; margin-bottom: 2px; }
        .fecha-box strong { font-size: 11px; color: #1a202c; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead tr { border-bottom: 2px solid #6C47FF; }
        thead th { padding: 5px 0; font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6C47FF; font-weight: 700; text-align: left; }
        thead th:not(:first-child) { text-align: center; }
        thead th:last-child { text-align: right; }
        .totales { display: flex; justify-content: flex-end; margin-bottom: 20px; }
        .totales-box { width: 220px; }
        .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; color: #4a5568; }
        .total-row.final { border-top: 2px solid #6C47FF; padding-top: 8px; margin-top: 3px; }
        .total-row.final span:first-child { font-size: 13px; font-weight: 800; color: #1a202c; }
        .total-row.final span:last-child { font-size: 16px; font-weight: 900; color: #6C47FF; }
        .notas { background: #F8F7FF; border-radius: 12px; padding: 10px; margin-bottom: 20px; }
        .notas h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6C47FF; font-weight: 700; margin-bottom: 4px; }
        .notas p { font-size: 10px; color: #4a5568; line-height: 1.3; }
        .footer { text-align: center; font-size: 8px; color: #a0aec0; border-top: 1px solid #f0f0f0; padding-top: 10px; }
        .badge-premium { display: inline-block; background: #6C47FF; color: white; font-size: 9px; padding: 2px 6px; border-radius: 20px; font-weight: 700; letter-spacing: 0.5px; }
      `;
      logoHTML = `<div class="logo">InvoiceRapid${isPremium ? ' Pro' : ''}</div>`;
      break;
  }

  const html = `
    <style>
      ${styles}
      @page { margin: 0; size: auto; }
      body { page-break-after: avoid; page-break-before: avoid; }
      .page { page-break-after: avoid; page-break-inside: avoid; }
    </style>
    <body>
      <div class="page">
        ${marcaAgua}
        ${extraElements}
        <div class="header">
          ${logoHTML}
          <div class="factura-num">
            <h1>${factura.numero}</h1>
            <p>FACTURA</p>
          </div>
        </div>
        <div class="divider"></div>
        <div class="info-grid">
          <div class="info-box">
            <h3>Facturado por</h3>
            <strong>Mi Empresa / Autónomo</strong>
            <p>NIF: —<br>Dirección: —</p>
          </div>
          <div class="info-box">
            <h3>Facturado a</h3>
            <strong>${factura.cliente_nombre || '—'}</strong>
            <p>${factura.cliente_email || ''}<br>${factura.cliente_direccion || ''}</p>
          </div>
        </div>
        <div class="fechas">
          <div class="fecha-box">
            <span>Fecha de emisión</span>
            <strong>${fechaCreacion}</strong>
          </div>
          <div class="fecha-box">
            <span>Fecha de vencimiento</span>
            <strong>${fechaVencimiento}</strong>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Descripción</th>
              <th style="text-align:center">Cant.</th>
              <th style="text-align:right">Precio</th>
              <th style="text-align:center">Dto.</th>
              <th style="text-align:right">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsHTML}</tbody>
        </table>
        <div class="totales">
          <div class="totales-box">
            <div class="total-row"><span>Subtotal</span><span>${Number(factura.subtotal).toFixed(2)} €</span></div>
            <div class="total-row"><span>IVA (${factura.iva_porcentaje}%)</span><span>+${Number(factura.iva_importe).toFixed(2)} €</span></div>
            ${Number(factura.irpf_porcentaje) > 0 ? `<div class="total-row"><span>IRPF (${factura.irpf_porcentaje}%)</span><span style="color:#FF4757">-${Number(factura.irpf_importe).toFixed(2)} €</span></div>` : ''}
            <div class="total-row final">
              <span>TOTAL</span>
              <span>${Number(factura.total).toFixed(2)} €</span>
            </div>
          </div>
        </div>
        ${factura.notas ? `<div class="notas"><h3>Notas</h3><p>${factura.notas}</p></div>` : ''}
        <div class="footer">
          <p>Método de pago: ${factura.metodo_pago || 'Efectivo'} · Generado con InvoiceRapid Pro · ${new Date().toLocaleDateString('es-ES')}</p>
        </div>
      </div>
    </body>
  </html>
  `;

  // Generamos el PDF y compartimos directamente
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Factura ${factura.numero} - Generado con InvoiceRapid Pro`,
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.log('Error al compartir PDF:', error);
    }
  }
}