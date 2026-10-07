const html = `<a href="/chapters/01J76XZ1AX37KBR3NN36G7XPZR" class="hover:bg-base-300 flex-1 flex items-center p-2">
        <span class="me-2">
            <img src="/static/images/chapter-badge-official.svg" alt="" width="16" height="16" class="w-4 h-4" decoding="async">
        </span>
        <span class="grow flex items-center gap-2">
            <span class="">Punch 1</span>
        </span>
    </a>`;
const textOnly = html.replace(/<[^>]+>/g, ' ').trim();
console.log('TextOnly:', textOnly);
const robustRegex = new RegExp('(?:Chapter|Punch|Episode|Ch\\.?|)\\s*0*1\\b', 'i');
console.log('Regex:', robustRegex);
console.log('Match?', robustRegex.test(textOnly));
