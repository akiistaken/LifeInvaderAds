import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, degrees } from 'pdf-lib';

// A4 in points
const PW = 595.28;
const PH = 841.89;
const ML = 71; // ~25mm
const MR = 71;
const CW = PW - ML - MR;

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxW && cur) {
            lines.push(cur);
            cur = w;
        } else {
            cur = test;
        }
    }
    if (cur) lines.push(cur);
    return lines;
}

function formatPrice(n: number): string {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function generateInvoice(data: any): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([PW, PH]);
    const hb = await doc.embedFont(StandardFonts.HelveticaBold);
    const h = await doc.embedFont(StandardFonts.Helvetica);
    const hi = await doc.embedFont(StandardFonts.HelveticaOblique);

    // Explicit white background
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: rgb(1, 1, 1) });

    // Red thick border (stick to walls)
    const red = rgb(0.75, 0.22, 0.17);
    const borderT = 8;
    page.drawRectangle({ x: 0, y: 0, width: PW, height: borderT, color: red }); // Bottom
    page.drawRectangle({ x: 0, y: PH - borderT, width: PW, height: borderT, color: red }); // Top
    page.drawRectangle({ x: 0, y: 0, width: borderT, height: PH, color: red }); // Left
    page.drawRectangle({ x: PW - borderT, y: 0, width: borderT, height: PH, color: red }); // Right

    let y = PH - 62;
    const { customerName, employeeName, invoiceNumber, cart, subtotal, date } = data;

    // Logo embedding
    try {
        const fs = require('fs');
        const path = require('path');
        const logoPath = path.join(process.cwd(), 'public', 'logo.png');
        if (fs.existsSync(logoPath)) {
            const logoBytes = fs.readFileSync(logoPath);
            const logoImage = await doc.embedPng(logoBytes);
            const dims = logoImage.scale(0.3); // Scaled down to fit header
            page.drawImage(logoImage, { 
                x: ML, 
                y: y - 25, 
                width: 140, 
                height: 140 * (dims.height / dims.width) 
            });
        }
    } catch (e) {
        console.error('[PDF] Logo load failed:', e);
    }

    // Address right
    const addr = ['LifeInvader', 'Rockford Hills', 'Los Santos', 'USA'];
    addr.forEach((line, i) => {
        const tw = hb.widthOfTextAtSize(line, 10);
        page.drawText(line, { x: PW - MR - tw, y: y + 17 - i * 14, size: 10, font: hb, color: rgb(0, 0, 0) });
    });
    y -= 55;

    // Red line
    page.drawLine({ start: { x: ML, y }, end: { x: PW - MR, y }, thickness: 2, color: red });
    y -= 20;

    // SERVICE INVOICE
    const titleW = hb.widthOfTextAtSize('SERVICE INVOICE', 14);
    page.drawText('SERVICE INVOICE', { x: (PW - titleW) / 2, y, size: 14, font: hb, color: red });
    y -= 17;
    page.drawLine({ start: { x: ML, y }, end: { x: PW - MR, y }, thickness: 2, color: red });
    y -= 28;

    // Bill To box
    page.drawRectangle({ x: ML, y: y - 55, width: CW, height: 80, borderColor: rgb(0.12, 0.12, 0.12), borderWidth: 0.8 });
    page.drawText('BILL TO:', { x: ML + 14, y: y, size: 8, font: hb });
    page.drawText(customerName || 'Client Name', { x: ML + 14, y: y - 17, size: 12, font: hb });
    page.drawText('Los Santos', { x: ML + 14, y: y - 31, size: 9, font: h });
    page.drawText('USA', { x: ML + 14, y: y - 43, size: 9, font: h });

    const invText = 'INVOICE ' + (invoiceNumber || 'XXXX');
    page.drawText(invText, { x: PW - MR - 14 - hb.widthOfTextAtSize(invText, 9), y, size: 9, font: hb });
    const cnText = employeeName || 'Employee Name';
    page.drawText(cnText, { x: PW - MR - 14 - hb.widthOfTextAtSize(cnText, 9), y: y - 17, size: 9, font: hb });
    const dtText = date || '';
    page.drawText(dtText, { x: PW - MR - 14 - h.widthOfTextAtSize(dtText, 9), y: y - 31, size: 9, font: h });
    y -= 80;

    // Table header
    y -= 20;
    const col = { desc: ML, qty: ML + 269, price: ML + 354, total: PW - MR };
    page.drawText('DESCRIPTION', { x: col.desc, y, size: 9, font: hb });
    page.drawText('QUANTITY', { x: col.qty - hb.widthOfTextAtSize('QUANTITY', 9) / 2, y, size: 9, font: hb });
    page.drawText('PRICE', { x: col.price - hb.widthOfTextAtSize('PRICE', 9) / 2, y, size: 9, font: hb });
    const totH = 'TOTAL';
    page.drawText(totH, { x: col.total - hb.widthOfTextAtSize(totH, 9), y, size: 9, font: hb });
    y -= 6;
    page.drawLine({ start: { x: ML, y }, end: { x: PW - MR, y }, thickness: 1.5, color: rgb(0.12, 0.12, 0.12) });
    y -= 17;

    // Table rows
    (cart || []).forEach((s: any) => {
        const up = parseInt(String(s.price).replace(/[^0-9]/g, '') || '0') || 0;
        const lt = up * (s.qty || 1);
        page.drawText(s.name || '', { x: col.desc, y, size: 10, font: h });
        const qtyStr = String(s.qty || 1);
        page.drawText(qtyStr, { x: col.qty - h.widthOfTextAtSize(qtyStr, 10) / 2, y, size: 10, font: h });
        const priceStr = formatPrice(up);
        page.drawText(priceStr, { x: col.price - h.widthOfTextAtSize(priceStr, 10) / 2, y, size: 10, font: h });
        const totalStr = formatPrice(lt);
        page.drawText(totalStr, { x: col.total - hb.widthOfTextAtSize(totalStr, 10), y, size: 10, font: hb });
        y -= 22;
    });

    // Total line
    page.drawLine({ start: { x: ML, y }, end: { x: PW - MR, y }, thickness: 0.8, color: rgb(0.12, 0.12, 0.12) });
    y -= 15;
    
    const { tax, total } = data;
    
    // Subtotal
    const subLabel = 'SUBTOTAL';
    page.drawText(subLabel, { x: col.price - hb.widthOfTextAtSize(subLabel, 9), y, size: 9, font: hb });
    const subVal = formatPrice(subtotal || 0);
    page.drawText(subVal, { x: col.total - h.widthOfTextAtSize(subVal, 9), y, size: 9, font: h });
    y -= 15;

    // Tax
    const taxLabel = 'TAX (3%)';
    page.drawText(taxLabel, { x: col.price - hb.widthOfTextAtSize(taxLabel, 9), y, size: 9, font: hb });
    const taxVal = formatPrice(tax || 0);
    page.drawText(taxVal, { x: col.total - h.widthOfTextAtSize(taxVal, 9), y, size: 9, font: h });
    y -= 20;

    // Total Due
    const tdLabel = 'TOTAL DUE';
    page.drawText(tdLabel, { x: col.price - hb.widthOfTextAtSize(tdLabel, 11), y, size: 11, font: hb });
    const tdVal = formatPrice(total || 0);
    page.drawText(tdVal, { x: col.total - hb.widthOfTextAtSize(tdVal, 14), y, size: 14, font: hb });
    y -= 62;

    // Thank you box
    page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 74, borderColor: rgb(0.12, 0.12, 0.12), borderWidth: 1.4 });
    page.drawText('Thank you for choosing LifeInvader for your services today!', { x: ML + 14, y: y + 34, size: 10, font: hb });
    page.drawText('If you require any further help or information, do not hesitate to contact us!', { x: ML + 14, y: y + 14, size: 10, font: hb });
    page.drawText('Have a wonderful day!', { x: ML + 14, y: y - 6, size: 10, font: hb });

    // PAID Stamp
    const stampText = 'PAID';
    const stampSize = 100;
    const stampWidth = hb.widthOfTextAtSize(stampText, stampSize) + 80;
    const stampHeight = stampSize + 40;
    const stampColor = rgb(0.94, 0.27, 0.27); // ef4444
    const stampOpacity = 0.15;
    
    page.drawRectangle({
        x: (PW - stampWidth) / 2 + 50,
        y: PH / 2 - 20,
        width: stampWidth,
        height: stampHeight,
        borderColor: stampColor,
        borderWidth: 10,
        rotate: degrees(-30),
        opacity: stampOpacity,
        borderOpacity: stampOpacity,
    });
    
    page.drawText(stampText, {
        x: (PW - stampWidth) / 2 + 90,
        y: PH / 2 + 10,
        size: stampSize,
        font: hb,
        color: stampColor,
        rotate: degrees(-30),
        opacity: stampOpacity,
    });

    return await doc.save();
}

async function generateContract(data: any): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const hb = await doc.embedFont(StandardFonts.HelveticaBold);
    const h = await doc.embedFont(StandardFonts.Helvetica);
    const hi = await doc.embedFont(StandardFonts.TimesRomanItalic);
    const { customerName, employeeName, cart, subtotal, date } = data;

    const ml = 57, mr = 57, cw = PW - ml - mr;
    let page = doc.addPage([PW, PH]);
    let y = PH - 57;

    // Dark background
    const fillBg = (p: PDFPage) => {
        p.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: rgb(0.118, 0.118, 0.118) });
    };
    fillBg(page);

    const white = rgb(1, 1, 1);
    const gray = rgb(0.39, 0.39, 0.39);

    const checkPage = (need: number) => {
        if (y - need < 40) {
            page = doc.addPage([PW, PH]);
            fillBg(page);
            y = PH - 43;
        }
    };

    const writeWrapped = (text: string, x: number, maxW: number, sz: number, font: PDFFont, gap: number = 11) => {
        const lines = wrapText(text, font, sz, maxW);
        const lh = sz * 1.2;
        for (const line of lines) {
            checkPage(lh);
            page.drawText(line, { x, y, size: sz, font, color: white });
            y -= lh;
        }
        y -= gap;
    };

    // Title
    const titleText = 'GENERAL SERVICE AGREEMENT';
    const tw = hb.widthOfTextAtSize(titleText, 20);
    page.drawText(titleText, { x: (PW - tw) / 2, y, size: 20, font: hb, color: white });
    y -= 23;

    const dateText = 'This General Service Agreement is dated ' + (date || '').replace(/\./g, '-') + '.';
    const dtw = h.widthOfTextAtSize(dateText, 10);
    page.drawText(dateText, { x: (PW - dtw) / 2, y, size: 10, font: h, color: white });
    y -= 28;

    // Client / Contractor table
    const halfW = cw / 2;
    page.drawRectangle({ x: ml, y: y - 62, width: cw, height: 62, borderColor: gray, borderWidth: 0.8 });
    page.drawLine({ start: { x: ml + halfW, y }, end: { x: ml + halfW, y: y - 62 }, thickness: 0.8, color: gray });

    const centerText = (text: string, cx: number, ty: number, sz: number, font: PDFFont) => {
        const w = font.widthOfTextAtSize(text, sz);
        page.drawText(text, { x: cx - w / 2, y: ty, size: sz, font, color: white });
    };

    const lcx = ml + halfW / 2, rcx = ml + halfW + halfW / 2;
    centerText('CLIENT', lcx, y - 14, 9, hb);
    centerText('*' + (customerName || 'FIRST LAST NAME') + '*', lcx, y - 28, 8, h);
    centerText('Los Santos', lcx, y - 40, 8, h);
    centerText('(the \u201CClient\u201D)', lcx, y - 51, 8, h);
    centerText('CONTRACTOR', rcx, y - 14, 9, hb);
    centerText('LifeInvader', rcx, y - 28, 8, h);
    centerText('Rockford Hills, Los Santos', rcx, y - 40, 8, h);
    centerText('(the \u201CContractor\u201D)', rcx, y - 51, 8, h);
    y -= 80;

    // BACKGROUND
    writeWrapped('BACKGROUND:', ml, cw, 10, hb, 6);
    writeWrapped('A.  The Client is of the opinion that the Contractor has the necessary qualifications, experience, and abilities to provide services to the Client.', ml + 23, cw - 23, 9, h, 6);
    writeWrapped('B.  The Contractor is agreeable to providing such services to the Client on the terms and conditions set out in this Agreement.', ml + 23, cw - 23, 9, h, 11);

    checkPage(5);
    page.drawLine({ start: { x: ml, y }, end: { x: PW - mr, y }, thickness: 0.8, color: gray });
    y -= 17;

    writeWrapped('IN CONSIDERATION OF the matters described above, and of the mutual benefits and obligations set forth in this Agreement, the receipt and sufficiency of which considerations is hereby acknowledged, the Client and the Contractor (individually the \u201CParty\u201D and collectively the \u201Cparties\u201D to this Agreement) agree as follows:', ml, cw, 9, h, 14);

    // SERVICES PROVIDED
    writeWrapped('SERVICES PROVIDED', ml, cw, 10, hb, 6);
    writeWrapped('1.  The Client hereby agrees to engage the Contractor to provide the Client with the following services (the \u201CServices\u201D):', ml + 23, cw - 23, 9, h, 6);
    (cart || []).forEach((s: any) => { writeWrapped('\u2022  ' + (s.name || ''), ml + 57, cw - 57, 9, h, 3); });
    y -= 6;
    writeWrapped('2.  The services will also include any other tasks which the Parties may agree on. The Contractor hereby agrees to provide such Services to the Client.', ml + 23, cw - 23, 9, h, 11);

    const sections: [string, string][] = [
        ['TERM OF AGREEMENT', ''],
        ['', '3.  The term of this Agreement (the \u201CTerm\u201D) will begin on the date of this Agreement and will remain in full force and effect until the completion of the Services, subject to earlier termination as provided in this Agreement.'],
        ['', '4.  In the event that either Party wishes to terminate this Agreement prior to the completion of the Services, that Party can do so only if the Term of this Agreement was not followed, by immediately serving written notice on the Party in breach of the Term of the Agreement.'],
        ['PERFORMANCE', ''],
        ['', '5.  The Parties agree to do everything necessary to ensure that the terms of this Agreement take effect.'],
        ['CURRENCY', ''],
        ['', '6.  Except as otherwise provided in this Agreement, all monetary amounts referred to in this Agreement are in USD (US Dollars).'],
        ['COMPENSATION', ''],
        ['', '7.  The Contractor will charge the Client a flat fee of ' + formatPrice(subtotal || 0) + ' for the Services (the \u201CCompensation\u201D).'],
        ['', '8.  The Client will pay before the Services are provided.'],
        ['', '9.  The Contractor will not be reimbursed for any expenses incurred in connection with providing the Services of this Agreement.'],
        ['OWNERSHIP OF THE INTELLECTUAL PROPERTY', ''],
        ['', '10. All intellectual property and related material (the \u201CIntellectual Property\u201D) that is developed or produced under this Agreement, will be the property of the Contractor. The Client is granted a non-exclusive limited-use license of this Intellectual Property.'],
        ['', '11. Title, copyright, intellectual property rights and distribution rights of the Intellectual Property remain exclusively with the Contractor.'],
        ['RETURN OF PROPERTY', ''],
        ['', '12. Upon the expiration or termination of this Agreement, the Client will return to the Client any Intellectual Property which is the Property of the Contractor.'],
        ['CAPACITY/INDEPENDENT CONTRACTOR', ''],
        ['', '13. In providing the Services under this Agreement it is expressly agreed that the Contractor is acting as an independent contractor and not as an employee. The Contractor and the Client acknowledge that this Agreement does not create a partnership or joint venture between them, and is exclusively a contract for service.'],
        ['RIGHT OF SUBSTITUTION', ''],
        ['', '14. Except as otherwise provided in this Agreement, the Contractor may, at the Contractor\u2019s absolute discretion, engage a third party subcontractor to perform some of all the obligations of the Contractor under this Agreement and the Client will not hire or engage any third parties to assist with the provision of the Services.'],
        ['', '15. In the event that the Contractor hires a subcontractor:'],
        ['', '\u2022  The contractor will pay the subcontractor for its services and the Compensation will remain payable by the Client to the Contractor.'],
        ['', '\u2022  For the purposes of the indemnification clause of this Agreement, the sub-contractor is an agent of the Contractor.'],
        ['AUTONOMY', ''],
        ['', '16. Except as otherwise provided in this Agreement, the Contractor will have full control over working time, methods, and decision making in relation to provision of Services in accordance with the Agreement. The Contractor will work autonomously and not at the direction of the Client. However, the Contractor will be responsive to the reasonable needs and concerns of the Client.'],
        ['MODIFICATION OF AGREEMENT', ''],
        ['', '17. Any amendment or modification of this Agreement or additional obligation assumed by either Party in connection with this Agreement will only be binding if evidenced in writing signed by each Party or an authorized representative of each Party.'],
        ['ENUREMENT', ''],
        ['', '18. This Agreement will ensure to the benefit of and be binding on the Parties and their respective heirs, executors, administrators and permitted successors and assigns.'],
        ['GOVERNING LAW', ''],
        ['', '19. This Agreement will be governed by and constructed in accordance with the laws of the State of Los Santos.'],
        ['SEVERABILITY', ''],
        ['', '20. In the event that any of the provisions of this Agreement are held to be invalid or unenforceable in whole or in part, all other provisions will nevertheless continue to be valid and enforceable with the invalid or unenforceable parts severed from the remainder of this Agreement.'],
        ['WAIVER', ''],
        ['', '21. The waiver by either Party of a breach, default, delay or omission of any of the provisions of this Agreement by the other Party will not be constructed as a waiver of any subsequent breach of the same or other provisions.'],
    ];

    for (const [heading, body] of sections) {
        if (heading) writeWrapped(heading, ml, cw, 10, hb, 6);
        if (body) {
            const isBullet = body.startsWith('\u2022');
            writeWrapped(body, isBullet ? ml + 40 : ml + 23, isBullet ? cw - 40 : cw - 23, 9, h, 8);
        }
    }

    // Witness
    checkPage(85);
    page.drawLine({ start: { x: ml, y }, end: { x: PW - mr, y }, thickness: 0.8, color: gray });
    y -= 23;

    const witnessDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    writeWrapped('IN WITNESS WHERE OF the parties have duly affixed their signatures under hand and seal on the ' + witnessDate + '.', ml, cw, 9, hb, 43);

    // Signatures
    checkPage(71);
    const clientSig = customerName || 'Client Name Goes Here';
    page.drawText(clientSig, { x: PW - mr - hi.widthOfTextAtSize(clientSig, 16), y, size: 16, font: hi, color: white });
    const clientLabel = '(Client)';
    page.drawText(clientLabel, { x: PW - mr - h.widthOfTextAtSize(clientLabel, 9), y: y - 14, size: 9, font: h, color: white });
    y -= 34;

    const companyLabel = 'LifeInvader';
    page.drawText(companyLabel, { x: PW - mr - h.widthOfTextAtSize(companyLabel, 10), y, size: 10, font: h, color: white });
    y -= 17;
    const empSig = employeeName || 'A Name Goes Here';
    page.drawText(empSig, { x: PW - mr - hi.widthOfTextAtSize(empSig, 16), y, size: 16, font: hi, color: white });

    return await doc.save();
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, ...data } = body;

        let pdfBytes: Uint8Array;
        let filename: string;

        if (type === 'contract') {
            pdfBytes = await generateContract(data);
            filename = (data.customerName || 'Client') + ' Contract.pdf';
        } else {
            pdfBytes = await generateInvoice(data);
            filename = (data.customerName || 'Client') + ' Invoice.pdf';
        }

        console.log(`[PDF] Sending ${filename} (${pdfBytes.length} bytes)`);
        return new Response(Buffer.from(pdfBytes) as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
