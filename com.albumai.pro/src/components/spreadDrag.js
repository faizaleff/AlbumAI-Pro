// One workspace-level gesture survives switching the visible spread during a drag.
export function transferSpreadPhoto(source, target, from, to) {
    const photo = source.find(slot => String(slot.slotId) === String(from));
    if (!photo) return null;
    const other = target.find(slot => String(slot.slotId) === String(to));
    return {
        source: [...source.filter(slot => String(slot.slotId) !== String(from)), ...(other ? [{...other, slotId: from}] : [])],
        target: [...target.filter(slot => String(slot.slotId) !== String(to)), {...photo, slotId: to}]
    };
}

export function bindSpreadDrag(root, get, doc = document, host = window) {
    const request = fn => host.requestAnimationFrame ? host.requestAnimationFrame(fn) : setTimeout(fn, 16);
    const cancel = id => host.cancelAnimationFrame ? host.cancelAnimationFrame(id) : clearTimeout(id);
    let ghost;
    let drag, moved = false, suppress = false, timer, hover, frame, point;
    const cards = () => Array.from(root.querySelectorAll('[data-spread-card]'));
    const inside = (node, p) => { const r = node.getBoundingClientRect(); return p.clientX >= r.left && p.clientX < r.right && p.clientY >= r.top && p.clientY < r.bottom; };
    const cardAt = p => cards().find(node => inside(node, p));
    const slotAt = p => {
        const canvas = root.querySelector('.design-canvas-scroll');
        if (!canvas) return null;
        return Array.from(root.querySelectorAll('[data-drop-slot]'))
            .filter(node => canvas.contains(node) && inside(node, p))
            .sort((a,b) => {const x=a.getBoundingClientRect(), y=b.getBoundingClientRect(); return (x.right-x.left)*(x.bottom-x.top)-(y.right-y.left)*(y.bottom-y.top);})[0];
    };
    const clear = () => {
        get().live?.(null);
        if (ghost) {ghost.remove(); ghost = null;}
        clearTimeout(timer); timer = null; hover = null;
        if (frame != null) cancel(frame);
        frame = null; drag = null; moved = false;
        cards().forEach(node => node.removeAttribute('data-drag-target'));
    };
    const tick = () => {
        if (!drag || !moved || !point) return;
        const strip = root.querySelector('.design-storyboard-track');
        if (strip) {
            const r = strip.getBoundingClientRect();
            if (point.clientY >= r.top && point.clientY <= r.bottom) {
                if (point.clientX < r.left + 36) strip.scrollLeft -= 12;
                else if (point.clientX > r.right - 36) strip.scrollLeft += 12;
            }
        }
        frame = request(tick);
    };
    const down = e => {
        clear(); suppress = false;
        const state = get(); if (state.disabled || (e.button != null && e.button !== 0)) return;
        if (e.target?.closest?.('[data-spread-action]')) return;
        const card = e.target?.closest?.('[data-spread-card]');
        const candidate = e.target?.closest?.('[data-drop-slot]');
        const slot = candidate && root.querySelector('.design-canvas-scroll')?.contains(candidate) ? candidate : slotAt(e);
        const asset = e.target?.closest?.('[data-asset-photo]');
        if (card) drag = {sheet: card.getAttribute('data-spread-card'), x:e.clientX,y:e.clientY, node:card};
        else if (slot) drag = {sheet:state.sheetId, slot:slot.getAttribute('data-drop-slot'), x:e.clientX,y:e.clientY, node:slot};
        else if (asset) drag = {asset:true,x:e.clientX,y:e.clientY,node:asset};
    };
    const move = e => {
        if (!drag) return;
        if (get().disabled) {clear();return;}
        if (!moved && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5) return;
        moved = true; suppress = true; point = e; e.preventDefault();
        if (!ghost && doc.createElement) {
            ghost = doc.createElement('div'); ghost.className = 'design-drag-ghost';
            const image = drag.node.querySelector?.('img');
            if (image?.src) {const copy = doc.createElement('img'); copy.src = image.src; ghost.appendChild(copy);}
            else ghost.textContent = drag.asset || drag.slot != null ? 'Photo' : 'Spread';
            doc.body.appendChild(ghost);
        }
        if (ghost) {ghost.style.left = (e.clientX+14)+'px'; ghost.style.top = (e.clientY+14)+'px';}
        if (frame == null) frame = request(tick);
        const slot = slotAt(e);
        if (drag.slot != null && get().sheetId === drag.sheet && slot?.getAttribute('data-drop-slot') === drag.slot) {
            const r = slot.getBoundingClientRect();
            get().live?.({id:drag.slot,x:(e.clientX-drag.x)/(r.right-r.left),y:(e.clientY-drag.y)/(r.bottom-r.top)});
        } else get().live?.(null);
        const card = cardAt(e), id = card?.getAttribute('data-spread-card');
        cards().forEach(node => node.removeAttribute('data-drag-target'));
        card?.setAttribute('data-drag-target','true');
        if (id !== hover) {
            clearTimeout(timer); hover = id;
            if (drag.slot != null && id && id !== get().sheetId) timer = setTimeout(() => {
                if (drag && get().canTransfer(drag.sheet, drag.slot)) get().select(id);
            }, 450);
        }
    };
    const up = e => {
        if (!drag) return;
        const state = get();
        if (moved && !state.disabled && (e.button == null || e.button === 0)) {
            if (drag.asset) { /* Asset-to-slot placement is handled by bindAssetDrop. */ }
            else if (drag.slot == null) {
                const card = cardAt(e); if (card) state.reorder(drag.sheet, card.getAttribute('data-spread-card'));
            } else {
                const target = slotAt(e);
                if (target) {
                    const id = target.getAttribute('data-drop-slot');
                    if (state.sheetId !== drag.sheet) state.transfer(drag.sheet,drag.slot,state.sheetId,id);
                    else if (id !== drag.slot) state.swap?.(drag.sheet,drag.slot,id);
                    else {
                        const r=target.getBoundingClientRect();
                        state.pan?.(id,(e.clientX-drag.x)/(r.right-r.left),(e.clientY-drag.y)/(r.bottom-r.top));
                    }
                }
            }
        }
        clear();
    };
    const click = e => {if(suppress){e.preventDefault();e.stopPropagation();suppress=false;}};
    const key = e => {if(e.key==='Escape') clear();};
    const nativeDrag = e => {if(drag) e.preventDefault();};
    const bindings = [[root,'dragstart',nativeDrag],[root,'mousedown',down],[doc,'mousemove',move],[doc,'mouseup',up],[root,'click',click],[doc,'keydown',key],[host,'blur',clear]];
    bindings.forEach(([node,type,fn])=>node.addEventListener(type,fn,true));
    return ()=>{clear();bindings.forEach(([node,type,fn])=>node.removeEventListener(type,fn,true));};
}
