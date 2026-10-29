// Bottom cue of a scrolling dialog: it shows that content waits below the cut.
// It draws a fade and a CSS chevron. It holds no text and no pointer target.
// The dialog carries data-more="true" while content stays hidden.

const END_TOLERANCE = 4;

export function attachScrollCue(dialog: HTMLDialogElement): () => void {
  const cue = document.createElement('div');
  cue.className = 'scroll-cue';
  cue.setAttribute('aria-hidden', 'true');
  const fade = document.createElement('span');
  fade.className = 'scroll-cue-fade';
  const arrow = document.createElement('span');
  arrow.className = 'scroll-cue-arrow';
  cue.append(fade, arrow);
  dialog.append(cue);

  let frame = 0;
  // Hidden height = scroll range below the cut, minus the bottom padding: the
  // last pixels of the range hold no content.
  const measure = () => {
    frame = 0;
    const padding = parseFloat(getComputedStyle(dialog).paddingBottom) || 0;
    const hidden = dialog.scrollHeight - dialog.clientHeight - dialog.scrollTop - padding;
    dialog.dataset.more = hidden > END_TOLERANCE ? 'true' : 'false';
  };
  // One measure per frame: scroll and resize burst into many events.
  const update = () => { if (!frame) frame = requestAnimationFrame(measure); };

  dialog.addEventListener('scroll', update, { passive: true });
  // A details toggle, an opened dialog and a closed dialog change the content.
  dialog.addEventListener('toggle', update, true);
  dialog.addEventListener('close', update);
  window.addEventListener('resize', update);

  const resize = new ResizeObserver(update);
  const watch = () => {
    resize.disconnect();
    resize.observe(dialog);
    for (const child of dialog.children) if (child !== cue) resize.observe(child);
  };
  watch();
  const mutation = new MutationObserver(() => { watch(); update(); });
  mutation.observe(dialog, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'class', 'style'] });

  update();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    resize.disconnect();
    mutation.disconnect();
    dialog.removeEventListener('scroll', update);
    dialog.removeEventListener('toggle', update, true);
    dialog.removeEventListener('close', update);
    window.removeEventListener('resize', update);
    cue.remove();
  };
}
