import { controlsTab, GROUP_TITLES, TAB_TITLES, type ControlsTab } from './controls-model';

const TABS:ControlsTab[]=['keyboard','pad','touch'];
function el<K extends keyof HTMLElementTagNameMap>(tag:K,className?:string):HTMLElementTagNameMap[K]{const node=document.createElement(tag);if(className)node.className=className;return node;}

/** Render the controls from the preset model and return the tab selector. */
export function renderControls(root:HTMLElement,initial:ControlsTab):{select(tab:ControlsTab):void}{
  root.replaceChildren();
  const list=el('div','controls-tabs');list.setAttribute('role','tablist');list.setAttribute('aria-label','Dispositivo');
  const panels=new Map<ControlsTab,HTMLElement>(),buttons=new Map<ControlsTab,HTMLButtonElement>();
  for(const tab of TABS){
    const button=el('button');button.type='button';button.id=`controls-tab-${tab}`;button.setAttribute('role','tab');button.setAttribute('aria-controls',`controls-panel-${tab}`);button.textContent=TAB_TITLES[tab];
    button.addEventListener('click',()=>select(tab));button.addEventListener('keydown',event=>{
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();const i=TABS.indexOf(tab),next=TABS[(i+(event.key==='ArrowRight'?1:-1)+TABS.length)%TABS.length];select(next);buttons.get(next)?.focus();
    });
    list.append(button);buttons.set(tab,button);
  }
  root.append(list);
  for(const tab of TABS){
    const panel=el('section','controls-panel');panel.id=`controls-panel-${tab}`;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',`controls-tab-${tab}`);
    const isKeyboard=tab==='keyboard';
    const sections=controlsTab(tab);
    for(const [sectionIndex,section] of sections.entries()){
      const heading=el('h3');heading.textContent=GROUP_TITLES[section.group];panel.append(heading);
      const table=el('table'),thead=el('thead'),tr=el('tr');
      for(const label of isKeyboard?['Acción','J1','J2']:['Acción',TAB_TITLES[tab]]){const th=el('th');th.scope='col';th.textContent=label;tr.append(th);}thead.append(tr);table.append(thead);
      const tbody=el('tbody');for(const [entryIndex,entry] of section.entries.entries()){const row=el('tr'),label=el('th');label.scope='row';label.textContent=entry.label;row.append(label);for(const cell of entry.cells){const td=el('td');td.textContent=cell;row.append(td);}if(sectionIndex===sections.length-1&&entryIndex===section.entries.length-1)row.tabIndex=0;tbody.append(row);}table.append(tbody);panel.append(table);
    }
    root.append(panel);panels.set(tab,panel);
  }
  function select(tab:ControlsTab){for(const item of TABS){const selected=item===tab;buttons.get(item)!.setAttribute('aria-selected',String(selected));buttons.get(item)!.tabIndex=selected?0:-1;buttons.get(item)!.classList.toggle('selected',selected);panels.get(item)!.hidden=!selected;}}
  select(initial);return{select};
}
