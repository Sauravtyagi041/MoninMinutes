import PDFDocument from 'pdfkit';
import { fmtMeetingDate, fmtDue, STATUS_LABEL, PRIORITY_LABEL } from './shared.js';

const INDIGO = '#4f46e5';
const INK = '#0f172a';
const MUTED = '#64748b';

// Built-in PDF fonts only cover Latin-1/WinAnsi; replace anything else rather than emit garbage.
const clean = (s) => String(s ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF–—‘’“”•…]/g, '?');

export function buildPdf({ meeting, minutes, actionItems }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: clean(meeting.title), Author: 'MinuteMate AI' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100;
    const ensure = (h) => {
      if (doc.y + h > doc.page.height - 60) doc.addPage();
    };
    const heading = (t) => {
      ensure(60);
      doc.moveDown(0.9).font('Helvetica-Bold').fontSize(13).fillColor(INDIGO).text(t);
      doc.moveTo(50, doc.y + 2).lineTo(50 + W, doc.y + 2).strokeColor('#e2e8f0').lineWidth(1).stroke();
      doc.moveDown(0.5).fillColor(INK);
    };
    const para = (t, opts = {}) => doc.font('Helvetica').fontSize(10.5).fillColor(opts.color || INK).text(clean(t), { lineGap: 2, ...opts });
    const bullets = (items, empty, owner) => {
      if (!items.length) return para(empty, { color: MUTED });
      for (const i of items) {
        ensure(30);
        const ref = i.segment_ids?.length ? `  [#${i.segment_ids.join(', #')}]` : '';
        para(`•  ${i.text}${owner && i.owner ? ` — ${i.owner}` : ''}${ref}`, { indent: 0, paragraphGap: 3 });
      }
    };

    doc.font('Helvetica-Bold').fontSize(9).fillColor(INDIGO).text('MINUTEMATE AI', { characterSpacing: 1.5 });
    doc.moveDown(0.4).font('Helvetica-Bold').fontSize(22).fillColor(INK).text(clean(meeting.title));
    doc.moveDown(0.3);
    para(`${fmtMeetingDate(meeting.meetingDate)}  •  ${meeting.timezone}`, { color: MUTED });
    if (meeting.participants?.length) para(`Participants: ${meeting.participants.join(', ')}`, { color: MUTED });

    heading('Executive Summary');
    para(minutes?.overview || 'No summary available.');
    heading('Key Discussion Points');
    bullets(minutes?.keyPoints ?? [], 'None identified.');
    heading('Decisions Made');
    bullets(minutes?.decisions ?? [], 'No confirmed decisions.', true);

    heading('Action Items');
    if (!actionItems.length) para('No action items.', { color: MUTED });
    else {
      const cols = [
        { k: 'task', w: W * 0.36, h: 'Task' },
        { k: 'who', w: W * 0.16, h: 'Assigned To' },
        { k: 'due', w: W * 0.2, h: 'Due Date' },
        { k: 'pri', w: W * 0.1, h: 'Priority' },
        { k: 'st', w: W * 0.18, h: 'Status' },
      ];
      const drawRow = (vals, header) => {
        doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        const h = Math.max(...cols.map((c) => doc.heightOfString(clean(vals[c.k]), { width: c.w - 8 }))) + 10;
        ensure(h);
        const y = doc.y;
        if (header) doc.rect(50, y, W, h).fill('#eef2ff');
        else doc.moveTo(50, y + h).lineTo(50 + W, y + h).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        let x = 50;
        doc.fillColor(INK);
        for (const c of cols) {
          doc.text(clean(vals[c.k]), x + 4, y + 5, { width: c.w - 8 });
          x += c.w;
        }
        doc.x = 50;
        doc.y = y + h;
      };
      drawRow(Object.fromEntries(cols.map((c) => [c.k, c.h])), true);
      for (const a of actionItems) {
        drawRow({
          task: a.task,
          who: a.assignee || 'Not assigned',
          due: fmtDue(a.dueDate, a.originalDueDateText),
          pri: PRIORITY_LABEL[a.priority],
          st: STATUS_LABEL[a.status],
        });
      }
    }

    heading('Risks and Blockers');
    bullets(minutes?.risks ?? [], 'None identified.');
    heading('Open Questions');
    bullets(minutes?.openQuestions ?? [], 'None identified.');

    doc.end();
  });
}
